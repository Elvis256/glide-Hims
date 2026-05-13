import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ProcurementApprovalChain,
  ApprovalChainStatus,
} from '../../database/entities/procurement-approval-chain.entity';
import { ApprovalAction, ApprovalActionType } from '../../database/entities/approval-action.entity';
import {
  OrgApprovalResolverService,
  ResolvedChainPreview,
  ResolveApprovalChainInput,
} from '../procurement/org-approval-resolver.service';

export interface DocumentRef {
  module: string;
  documentType: string;
  documentId: string;
}

export interface SubmitInput extends DocumentRef {
  tenantId: string;
  requesterId: string;
  amount: number;
  facilityId?: string | null;
  departmentId?: string | null;
  category?: string | null;
}

export interface PreviewInput {
  module?: string;
  documentType: string;
  amount: number;
  tenantId: string;
  requesterId: string;
  facilityId?: string | null;
  departmentId?: string | null;
  category?: string | null;
}

export interface ApprovalActor {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    @InjectRepository(ProcurementApprovalChain)
    private readonly chainRepo: Repository<ProcurementApprovalChain>,
    @InjectRepository(ApprovalAction)
    private readonly actionRepo: Repository<ApprovalAction>,
    private readonly resolver: OrgApprovalResolverService,
    private readonly events: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- Preview (no persistence) ----------

  async preview(input: PreviewInput): Promise<ResolvedChainPreview> {
    return this.resolver.resolveStepsWithMetadata({
      documentId: 'preview',
      documentType: input.documentType as 'PR' | 'PO',
      amount: Number(input.amount || 0),
      facilityId: input.facilityId || null,
      departmentId: input.departmentId || null,
      category: input.category || null,
      requesterId: input.requesterId,
      tenantId: input.tenantId,
    });
  }

  async previewEnriched(input: PreviewInput) {
    const preview = await this.preview(input);
    const namesByKey = await this.resolver.enrichSteps(preview.steps, input.tenantId);
    return {
      source: preview.source,
      policyId: preview.policyId ?? null,
      policyName: preview.policyName ?? null,
      steps: preview.steps.map((s) => {
        const key = `${s.approverId || ''}|${s.groupId || ''}`;
        const enriched = namesByKey.get(key) || {};
        return {
          approvalLevel: s.approvalLevel,
          approverId: s.approverId ?? null,
          approverName: enriched.approverName ?? null,
          requiredRole: s.requiredRole,
          groupId: s.groupId ?? null,
          groupName: enriched.groupName ?? null,
          quorumType: s.quorumType ?? null,
          quorumCount: s.quorumCount ?? null,
        };
      }),
    };
  }

  // ---------- Submit ----------

  /**
   * Resolve and persist the approval chain for a document, then emit
   * `approval.submitted`. Idempotent: if a chain already exists for the
   * document, returns existing rows.
   */
  async submit(input: SubmitInput): Promise<ProcurementApprovalChain[]> {
    const existing = await this.chainRepo.find({
      where: {
        module: input.module,
        documentType: input.documentType,
        documentId: input.documentId,
      } as any,
      order: { approvalLevel: 'ASC' },
    });
    if (existing.length > 0) return existing;

    const preview = await this.resolver.resolveStepsWithMetadata({
      documentId: input.documentId,
      documentType: input.documentType as 'PR' | 'PO',
      amount: Number(input.amount || 0),
      facilityId: input.facilityId || null,
      departmentId: input.departmentId || null,
      category: input.category || null,
      requesterId: input.requesterId,
      tenantId: input.tenantId,
    } as ResolveApprovalChainInput);

    const steps = preview.steps.length
      ? preview.steps
      : [{ approvalLevel: 1, approverId: null, requiredRole: 'manager' } as any];

    const saved: ProcurementApprovalChain[] = [];
    for (const step of steps) {
      const slaHours = (step as any).slaHours ?? null;
      const slaDueAt = slaHours
        ? new Date(Date.now() + slaHours * 3600 * 1000)
        : undefined;
      const row = this.chainRepo.create({
        module: input.module,
        documentId: input.documentId,
        documentType: input.documentType,
        tenantId: input.tenantId,
        approvalLevel: step.approvalLevel,
        requiredRole: step.requiredRole,
        approverId: step.approverId || undefined,
        groupId: (step as any).groupId || undefined,
        quorumType: (step as any).quorumType || undefined,
        quorumCount: (step as any).quorumCount || undefined,
        slaHours: slaHours ?? undefined,
        slaDueAt,
        status: ApprovalChainStatus.PENDING,
      });
      saved.push(await this.chainRepo.save(row));
    }

    await this.recordAction({
      tenantId: input.tenantId,
      chainId: saved[0]?.id || '',
      module: input.module,
      documentType: input.documentType,
      documentId: input.documentId,
      actorUserId: input.requesterId,
      action: 'submit',
      afterJson: { source: preview.source, policyId: preview.policyId, steps: steps.length },
    });

    this.events.emit('approval.submitted', {
      documentRef: { module: input.module, documentType: input.documentType, documentId: input.documentId },
      chainId: saved[0]?.id,
      stepCount: saved.length,
      source: preview.source,
      tenantId: input.tenantId,
    });

    this.logger.log(
      `Submitted ${saved.length}-step chain for ${input.module}/${input.documentType}/${input.documentId} (source=${preview.source})`,
    );
    return saved;
  }

  // ---------- Read ----------

  async getChain(ref: DocumentRef, tenantId?: string) {
    const where: any = {
      module: ref.module,
      documentType: ref.documentType,
      documentId: ref.documentId,
    };
    if (tenantId) where.tenantId = tenantId;
    const rows = await this.chainRepo.find({
      where,
      relations: ['approver', 'approvedBy'],
      order: { approvalLevel: 'ASC', createdAt: 'ASC' },
    });
    if (rows.length === 0) return [];
    const namesByKey = await this.resolver.enrichSteps(
      rows.map((r) => ({ approverId: r.approverId, groupId: r.groupId })),
      tenantId || '',
    );
    return rows.map((r) => {
      const key = `${r.approverId || ''}|${r.groupId || ''}`;
      const enriched = namesByKey.get(key) || {};
      const approver = (r as any).approver;
      const approvedBy = (r as any).approvedBy;
      return {
        id: r.id,
        approvalLevel: r.approvalLevel,
        requiredRole: r.requiredRole,
        approverId: r.approverId ?? null,
        approverName:
          enriched.approverName ||
          (approver ? approver.fullName || approver.email : null),
        groupId: r.groupId ?? null,
        groupName: enriched.groupName ?? null,
        quorumType: r.quorumType ?? null,
        quorumCount: r.quorumCount ?? null,
        status: r.status,
        approvedById: r.approvedById ?? null,
        approvedByName: approvedBy ? approvedBy.fullName || approvedBy.email : null,
        approvedAt: r.approvedAt ?? null,
        comments: r.comments ?? null,
        createdAt: r.createdAt,
      };
    });
  }

  // ---------- Act ----------

  /**
   * Verify the actor is authorised to act on this step. Authorised when ANY:
   *   1. They are the explicitly named approver (`approverId` matches).
   *   2. They are a member of the assigned approver group (`groupId`).
   *   3. The step's `requiredRole` starts with `permission:` and the actor
   *      holds that permission (directly or via role).
   *   4. The step's `requiredRole` starts with `role:` and the actor holds
   *      that role.
   */
  async assertCanAct(
    step: ProcurementApprovalChain,
    actorUserId: string,
  ): Promise<void> {
    if (!actorUserId) throw new ForbiddenException('Authentication required');
    if (step.approverId && step.approverId === actorUserId) return;
    if (step.groupId) {
      const isMember = await this.dataSource.query(
        `SELECT 1 FROM approver_group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
        [step.groupId, actorUserId],
      );
      if (isMember && isMember.length > 0) return;
    }
    const role = step.requiredRole || '';
    if (role.startsWith('permission:')) {
      const code = role.slice('permission:'.length).trim();
      if (await this.userHasPermission(actorUserId, code, step.tenantId)) return;
    }
    if (role.startsWith('role:')) {
      const wantRole = role.slice('role:'.length).trim();
      const has = await this.dataSource.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1 AND r.name = $2 LIMIT 1`,
        [actorUserId, wantRole],
      );
      if (has && has.length > 0) return;
    }
    throw new ForbiddenException('You are not authorised to act on this approval step');
  }

  /**
   * Returns true if the user holds `permissionCode` either directly or via
   * any of their roles.
   */
  async userHasPermission(
    userId: string,
    permissionCode: string,
    tenantId?: string,
  ): Promise<boolean> {
    const tenantClause = tenantId ? 'AND (up.tenant_id = $3 OR up.tenant_id IS NULL)' : '';
    const params: any[] = [userId, permissionCode];
    if (tenantId) params.push(tenantId);
    const direct = await this.dataSource.query(
      `SELECT 1 FROM user_permissions up
       JOIN permissions p ON p.id = up.permission_id
       WHERE up.user_id = $1 AND p.code = $2 ${tenantClause} LIMIT 1`,
      params,
    );
    if (direct && direct.length > 0) return true;
    const viaRole = await this.dataSource.query(
      `SELECT 1 FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1 AND p.code = $2 LIMIT 1`,
      [userId, permissionCode],
    );
    return !!(viaRole && viaRole.length > 0);
  }

  /**
   * Returns user IDs who can act on a chain step (used to populate inbox).
   */
  async resolvePotentialApprovers(
    step: ProcurementApprovalChain,
  ): Promise<string[]> {
    const ids = new Set<string>();
    if (step.approverId) ids.add(step.approverId);
    if (step.groupId) {
      const rows = await this.dataSource.query(
        `SELECT user_id FROM approver_group_members WHERE group_id = $1`,
        [step.groupId],
      );
      for (const r of rows) ids.add(r.user_id);
    }
    const role = step.requiredRole || '';
    if (role.startsWith('permission:')) {
      const code = role.slice('permission:'.length).trim();
      const rows = await this.dataSource.query(
        `SELECT DISTINCT u.id FROM users u
         LEFT JOIN user_permissions up ON up.user_id = u.id
         LEFT JOIN permissions p1 ON p1.id = up.permission_id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN role_permissions rp ON rp.role_id = ur.role_id
         LEFT JOIN permissions p2 ON p2.id = rp.permission_id
         WHERE p1.code = $1 OR p2.code = $1`,
        [code],
      );
      for (const r of rows) ids.add(r.id);
    }
    return [...ids];
  }

  /**
   * Inbox: pending approval steps where the user can act. Includes module +
   * documentRef + level so a generic UI can render rows for any module.
   */
  async getInbox(userId: string, tenantId?: string) {
    if (!userId) return [];
    const where: any = { status: ApprovalChainStatus.PENDING };
    if (tenantId) where.tenantId = tenantId;
    const all = await this.chainRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 500,
    });
    const mine: ProcurementApprovalChain[] = [];
    for (const step of all) {
      try {
        await this.assertCanAct(step, userId);
        mine.push(step);
      } catch {
        // not theirs
      }
    }
    if (mine.length === 0) return [];
    const namesByKey = await this.resolver.enrichSteps(
      mine.map((r) => ({ approverId: r.approverId, groupId: r.groupId })),
      tenantId || '',
    );
    return mine.map((r) => {
      const key = `${r.approverId || ''}|${r.groupId || ''}`;
      const enriched = namesByKey.get(key) || {};
      return {
        stepId: r.id,
        module: r.module,
        documentType: r.documentType,
        documentId: r.documentId,
        approvalLevel: r.approvalLevel,
        requiredRole: r.requiredRole,
        approverId: r.approverId ?? null,
        approverName: enriched.approverName ?? null,
        groupId: r.groupId ?? null,
        groupName: enriched.groupName ?? null,
        createdAt: r.createdAt,
      };
    });
  }

  async approveStep(stepId: string, actor: ApprovalActor, comment?: string) {
    const step = await this.chainRepo.findOne({ where: { id: stepId } });
    if (!step) throw new NotFoundException('Approval step not found');
    if (step.status !== ApprovalChainStatus.PENDING) {
      throw new BadRequestException(`Step is not pending (status=${step.status})`);
    }
    await this.assertCanAct(step, actor.userId);
    const before = { status: step.status, approvedById: step.approvedById };
    step.status = ApprovalChainStatus.APPROVED;
    step.approvedById = actor.userId;
    step.approvedAt = new Date();
    if (comment) step.comments = comment;
    await this.chainRepo.save(step);

    await this.recordAction({
      tenantId: step.tenantId,
      chainId: step.id,
      chainStepId: step.id,
      module: step.module,
      documentType: step.documentType,
      documentId: step.documentId,
      actorUserId: actor.userId,
      action: 'approve',
      comment,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      beforeJson: before,
      afterJson: { status: step.status, approvedById: step.approvedById },
    });

    this.events.emit('approval.step.approved', {
      documentRef: { module: step.module, documentType: step.documentType, documentId: step.documentId },
      chainStepId: step.id,
      approvalLevel: step.approvalLevel,
      actorUserId: actor.userId,
      tenantId: step.tenantId,
    });

    const remaining = await this.chainRepo.count({
      where: {
        module: step.module,
        documentType: step.documentType,
        documentId: step.documentId,
        status: ApprovalChainStatus.PENDING,
      } as any,
    });
    if (remaining === 0) {
      this.events.emit('approval.completed', {
        documentRef: { module: step.module, documentType: step.documentType, documentId: step.documentId },
        tenantId: step.tenantId,
      });
    }
    return step;
  }

  async rejectStep(stepId: string, actor: ApprovalActor, comment: string) {
    if (!comment || !comment.trim()) {
      throw new BadRequestException('Comment required when rejecting');
    }
    const step = await this.chainRepo.findOne({ where: { id: stepId } });
    if (!step) throw new NotFoundException('Approval step not found');
    if (step.status !== ApprovalChainStatus.PENDING) {
      throw new BadRequestException(`Step is not pending (status=${step.status})`);
    }
    await this.assertCanAct(step, actor.userId);
    const before = { status: step.status };
    step.status = ApprovalChainStatus.REJECTED;
    step.approvedById = actor.userId;
    step.approvedAt = new Date();
    step.comments = comment;
    await this.chainRepo.save(step);

    await this.recordAction({
      tenantId: step.tenantId,
      chainId: step.id,
      chainStepId: step.id,
      module: step.module,
      documentType: step.documentType,
      documentId: step.documentId,
      actorUserId: actor.userId,
      action: 'reject',
      comment,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      beforeJson: before,
      afterJson: { status: step.status },
    });

    this.events.emit('approval.step.rejected', {
      documentRef: { module: step.module, documentType: step.documentType, documentId: step.documentId },
      chainStepId: step.id,
      approvalLevel: step.approvalLevel,
      actorUserId: actor.userId,
      tenantId: step.tenantId,
    });
    this.events.emit('approval.rejected', {
      documentRef: { module: step.module, documentType: step.documentType, documentId: step.documentId },
      reason: comment,
      tenantId: step.tenantId,
    });
    return step;
  }

  async recall(ref: DocumentRef, actor: ApprovalActor) {
    const rows = await this.chainRepo.find({
      where: {
        module: ref.module,
        documentType: ref.documentType,
        documentId: ref.documentId,
        status: ApprovalChainStatus.PENDING,
      } as any,
    });
    if (rows.length === 0) {
      throw new BadRequestException('No pending approvals to recall');
    }
    for (const r of rows) {
      r.status = ApprovalChainStatus.REJECTED;
      r.comments = (r.comments ? r.comments + '\n' : '') + '[recalled by requester]';
      await this.chainRepo.save(r);
    }
    await this.recordAction({
      tenantId: rows[0].tenantId,
      chainId: rows[0].id,
      module: ref.module,
      documentType: ref.documentType,
      documentId: ref.documentId,
      actorUserId: actor.userId,
      action: 'recall',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    this.events.emit('approval.recalled', {
      documentRef: ref,
      actorUserId: actor.userId,
      tenantId: rows[0].tenantId,
    });
    return { recalled: rows.length };
  }

  // ---------- SLA escalation ----------

  /**
   * Mark a pending step as escalated. Does NOT change `status` (the original
   * approver can still act); records the timestamp + escalation target so
   * notifications can fan out and the UI can show an SLA-breached badge.
   */
  async escalate(step: ProcurementApprovalChain, escalateToUserId?: string | null) {
    if (step.status !== ApprovalChainStatus.PENDING) return step;
    if (step.escalatedAt) return step;
    const before = { escalatedAt: step.escalatedAt };
    step.escalatedAt = new Date();
    await this.chainRepo.save(step);
    await this.recordAction({
      tenantId: step.tenantId,
      chainId: step.id,
      chainStepId: step.id,
      module: step.module,
      documentType: step.documentType,
      documentId: step.documentId,
      action: 'escalate',
      beforeJson: before,
      afterJson: { escalatedAt: step.escalatedAt, escalateToUserId: escalateToUserId ?? null },
    });
    this.events.emit('approval.step.escalated', {
      documentRef: { module: step.module, documentType: step.documentType, documentId: step.documentId },
      chainStepId: step.id,
      escalateToUserId: escalateToUserId ?? null,
      tenantId: step.tenantId,
    });
    return step;
  }

  /** Find pending steps whose SLA has elapsed and have not yet been escalated. */
  async findBreachedSteps(limit = 100): Promise<ProcurementApprovalChain[]> {
    return this.chainRepo
      .createQueryBuilder('c')
      .where('c.status = :st', { st: ApprovalChainStatus.PENDING })
      .andWhere('c.sla_due_at IS NOT NULL')
      .andWhere('c.sla_due_at < NOW()')
      .andWhere('c.escalated_at IS NULL')
      .orderBy('c.sla_due_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  // ---------- Audit ----------

  async listActions(ref: DocumentRef, tenantId?: string) {
    const where: any = {
      module: ref.module,
      documentType: ref.documentType,
      documentId: ref.documentId,
    };
    if (tenantId) where.tenantId = tenantId;
    return this.actionRepo.find({ where, order: { createdAt: 'ASC' } });
  }

  // ---------- Helpers ----------

  private async recordAction(args: {
    tenantId?: string;
    chainId: string;
    chainStepId?: string;
    module: string;
    documentType: string;
    documentId: string;
    actorUserId?: string;
    action: ApprovalActionType;
    comment?: string;
    ipAddress?: string;
    userAgent?: string;
    beforeJson?: Record<string, unknown>;
    afterJson?: Record<string, unknown>;
  }) {
    if (!args.chainId) return;
    try {
      await this.actionRepo.save(
        this.actionRepo.create({
          tenantId: args.tenantId,
          chainId: args.chainId,
          chainStepId: args.chainStepId,
          module: args.module,
          documentType: args.documentType,
          documentId: args.documentId,
          actorUserId: args.actorUserId,
          action: args.action,
          comment: args.comment,
          ipAddress: args.ipAddress,
          userAgent: args.userAgent,
          beforeJson: args.beforeJson,
          afterJson: args.afterJson,
        }),
      );
    } catch (e: any) {
      this.logger.warn(`Failed to record approval action: ${e?.message || e}`);
    }
  }
}
