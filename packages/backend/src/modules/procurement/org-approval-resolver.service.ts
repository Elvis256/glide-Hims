import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProcurementApprovalChain, ApprovalChainStatus } from '../../database/entities/procurement-approval-chain.entity';
import {
  ApprovalDelegation,
  ApprovalPolicyDocType,
  ApprovalPolicyStepType,
  ApproverGroup,
  ApproverGroupMember,
  ApproverGroupQuorum,
  ProcurementApprovalPolicy,
  ProcurementApprovalPolicyStep,
} from '../../database/entities/org-approval.entities';
import { Employee } from '../../database/entities/employee.entity';
import { Department } from '../../database/entities/department.entity';

export interface ResolveApprovalChainInput {
  documentId: string;
  documentType: 'PR' | 'PO';
  amount: number;
  facilityId?: string | null;
  departmentId?: string | null;
  category?: string | null;
  requesterId: string;
  tenantId: string;
}

export interface ResolvedStep {
  approvalLevel: number;
  approverId?: string | null;
  requiredRole: string;
  groupId?: string | null;
  quorumType?: ApproverGroupQuorum;
  quorumCount?: number | null;
}

export interface ResolvedChainPreview {
  source: 'policy' | 'default-manager-chain' | 'fallback';
  policyId?: string | null;
  policyName?: string | null;
  steps: ResolvedStep[];
}

@Injectable()
export class OrgApprovalResolverService {
  private readonly logger = new Logger(OrgApprovalResolverService.name);

  constructor(
    @InjectRepository(ProcurementApprovalPolicy)
    private readonly policyRepo: Repository<ProcurementApprovalPolicy>,
    @InjectRepository(ProcurementApprovalPolicyStep)
    private readonly stepRepo: Repository<ProcurementApprovalPolicyStep>,
    @InjectRepository(ProcurementApprovalChain)
    private readonly chainRepo: Repository<ProcurementApprovalChain>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(ApproverGroup)
    private readonly groupRepo: Repository<ApproverGroup>,
    @InjectRepository(ApproverGroupMember)
    private readonly groupMemberRepo: Repository<ApproverGroupMember>,
    @InjectRepository(ApprovalDelegation)
    private readonly delegationRepo: Repository<ApprovalDelegation>,
  ) {}

  /**
   * Build (and persist) an approval chain for a document.
   * Returns the saved chain rows. If no policy matches, falls back to
   * direct-manager → department-head, then finally a single "manager" role step.
   */
  async buildAndPersistChain(input: ResolveApprovalChainInput): Promise<ProcurementApprovalChain[]> {
    const { documentId, documentType, tenantId } = input;

    const preview = await this.resolveStepsWithMetadata(input);
    const steps = [...preview.steps];

    if (steps.length === 0) {
      // Hard fallback: single "manager" role step
      steps.push({
        approvalLevel: 1,
        requiredRole: 'manager',
        approverId: null,
      });
    }

    const saved: ProcurementApprovalChain[] = [];
    for (const step of steps) {
      const row = this.chainRepo.create({
        documentId,
        documentType,
        tenantId,
        approvalLevel: step.approvalLevel,
        requiredRole: step.requiredRole,
        approverId: step.approverId || undefined,
        status: ApprovalChainStatus.PENDING,
      });
      saved.push(await this.chainRepo.save(row));
    }
    this.logger.log(
      `Resolved ${saved.length}-step approval chain for ${documentType} ${documentId}`,
    );
    return saved;
  }

  /**
   * Resolve the steps without persisting (preview / unit-test friendly).
   */
  async resolveSteps(input: ResolveApprovalChainInput): Promise<ResolvedStep[]> {
    return (await this.resolveStepsWithMetadata(input)).steps;
  }

  /**
   * Same as resolveSteps but also returns the source label and matched policy
   * so the UI can show "Using policy X" vs "Falling back to default manager chain".
   */
  async resolveStepsWithMetadata(
    input: ResolveApprovalChainInput,
  ): Promise<ResolvedChainPreview> {
    const policy = await this.findBestPolicy(input);
    let source: ResolvedChainPreview['source'] = policy ? 'policy' : 'default-manager-chain';

    let rawSteps: Array<Partial<ResolvedStep> & { rawType: ApprovalPolicyStepType; stepRow?: ProcurementApprovalPolicyStep }> = [];

    if (policy) {
      const stepRows = await this.stepRepo.find({
        where: { policyId: policy.id, tenantId: input.tenantId },
        order: { stepOrder: 'ASC' },
      });
      for (const sr of stepRows) {
        const resolved = await this.resolveStep(sr, input);
        if (resolved) {
          rawSteps.push({ ...resolved, rawType: sr.approverType, stepRow: sr });
        } else if (!sr.isOptional) {
          // Couldn't resolve a required step — drop policy and fall back
          this.logger.warn(
            `Policy ${policy.id} step ${sr.stepOrder} (${sr.approverType}) couldn't resolve approver; falling back to defaults`,
          );
          rawSteps = [];
          source = 'default-manager-chain';
          break;
        }
      }
    }

    if (rawSteps.length === 0) {
      // Default policy: direct manager → department head
      const mgr = await this.resolveDirectManager(input.requesterId, input.tenantId, 1);
      if (mgr && mgr !== input.requesterId) {
        rawSteps.push({
          approverId: mgr,
          requiredRole: 'manager',
          rawType: ApprovalPolicyStepType.DIRECT_MANAGER,
        });
      }
      const head = input.departmentId
        ? await this.resolveDepartmentHead(input.departmentId, input.tenantId, false)
        : null;
      if (head && head !== input.requesterId && head !== mgr) {
        rawSteps.push({
          approverId: head,
          requiredRole: 'department head',
          rawType: ApprovalPolicyStepType.DEPARTMENT_HEAD,
        });
      }
    }

    // Apply delegations + skip self + de-dup consecutive same approver
    const finalSteps: ResolvedStep[] = [];
    let level = 1;
    const seen = new Set<string>();
    for (const s of rawSteps) {
      let approverId = s.approverId || null;

      // Apply active delegation if approverId set
      if (approverId) {
        const delegated = await this.applyDelegation(
          approverId,
          input.documentType,
          input.tenantId,
        );
        if (delegated) approverId = delegated;
      }

      // Skip self approval
      if (
        approverId &&
        approverId === input.requesterId &&
        (s.stepRow?.skipIfSelf ?? true)
      ) {
        // Try to escalate one level up via direct manager chain
        const escalated = await this.resolveDirectManager(approverId, input.tenantId, 1);
        if (escalated && escalated !== input.requesterId) {
          approverId = escalated;
        } else {
          continue;
        }
      }

      const key = `${approverId || ''}|${s.groupId || ''}|${s.requiredRole || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);

      finalSteps.push({
        approvalLevel: level++,
        approverId,
        requiredRole: s.requiredRole || 'manager',
        groupId: s.groupId || null,
        quorumType: s.quorumType,
        quorumCount: s.quorumCount,
      });
    }

    return {
      source: finalSteps.length === 0 ? 'fallback' : source,
      policyId: source === 'policy' && policy ? policy.id : null,
      policyName: source === 'policy' && policy ? policy.name : null,
      steps: finalSteps,
    };
  }

  /**
   * Look up display names for approverIds and groupIds in a chain so the UI
   * can render "Jane Doe (Manager)" instead of an opaque uuid. Reuses query
   * batching to avoid N+1 lookups.
   */
  async enrichSteps(
    steps: Array<{ approverId?: string | null; groupId?: string | null }>,
    tenantId: string,
  ): Promise<Map<string, { approverName?: string; groupName?: string }>> {
    const result = new Map<string, { approverName?: string; groupName?: string }>();
    const userIds = Array.from(
      new Set(steps.map((s) => s.approverId).filter((v): v is string => !!v)),
    );
    const groupIds = Array.from(
      new Set(steps.map((s) => s.groupId).filter((v): v is string => !!v)),
    );

    const userNameById = new Map<string, string>();
    if (userIds.length) {
      const userRepo = this.chainRepo.manager.getRepository('User');
      const users = (await userRepo
        .createQueryBuilder('u')
        .select(['u.id', 'u.fullName', 'u.email'])
        .where('u.id IN (:...ids)', { ids: userIds })
        .getMany()) as Array<{ id: string; fullName?: string; email?: string }>;
      for (const u of users) {
        const name = (u.fullName && u.fullName.trim()) || u.email || u.id;
        userNameById.set(u.id, name);
      }
    }

    const groupNameById = new Map<string, string>();
    if (groupIds.length) {
      const groups = await this.groupRepo.find({
        where: { id: In(groupIds), tenantId } as any,
      });
      for (const g of groups) groupNameById.set(g.id, g.name);
    }

    for (const s of steps) {
      const key = `${s.approverId || ''}|${s.groupId || ''}`;
      result.set(key, {
        approverName: s.approverId ? userNameById.get(s.approverId) : undefined,
        groupName: s.groupId ? groupNameById.get(s.groupId) : undefined,
      });
    }
    return result;
  }

  // ---------- Internals ----------

  private async findBestPolicy(input: ResolveApprovalChainInput): Promise<ProcurementApprovalPolicy | null> {
    const qb = this.policyRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId: input.tenantId })
      .andWhere('p.isActive = true')
      .andWhere('p.documentType IN (:...types)', {
        types: [input.documentType, ApprovalPolicyDocType.ANY],
      });

    if (input.facilityId) {
      qb.andWhere('(p.facilityId IS NULL OR p.facilityId = :fid)', { fid: input.facilityId });
    } else {
      qb.andWhere('p.facilityId IS NULL');
    }
    if (input.departmentId) {
      qb.andWhere('(p.departmentId IS NULL OR p.departmentId = :did)', { did: input.departmentId });
    } else {
      qb.andWhere('p.departmentId IS NULL');
    }
    if (input.category) {
      qb.andWhere('(p.category IS NULL OR p.category = :cat)', { cat: input.category });
    } else {
      qb.andWhere('p.category IS NULL');
    }

    qb.andWhere('(p.amountMin IS NULL OR p.amountMin <= :amt)', { amt: input.amount });
    qb.andWhere('(p.amountMax IS NULL OR p.amountMax >= :amt)', { amt: input.amount });

    qb.orderBy('p.priority', 'DESC').addOrderBy('p.createdAt', 'DESC');

    const policies = await qb.getMany();
    return policies[0] || null;
  }

  private async resolveStep(
    step: ProcurementApprovalPolicyStep,
    input: ResolveApprovalChainInput,
  ): Promise<Partial<ResolvedStep> | null> {
    switch (step.approverType) {
      case ApprovalPolicyStepType.DIRECT_MANAGER: {
        const u = await this.resolveDirectManager(
          input.requesterId,
          input.tenantId,
          step.levelsUp || 1,
        );
        return u ? { approverId: u, requiredRole: 'manager' } : null;
      }
      case ApprovalPolicyStepType.DEPARTMENT_HEAD: {
        if (!input.departmentId) return null;
        const u = await this.resolveDepartmentHead(
          input.departmentId,
          input.tenantId,
          step.escalateToParent,
        );
        return u ? { approverId: u, requiredRole: 'department head' } : null;
      }
      case ApprovalPolicyStepType.PARENT_DEPARTMENT_HEAD: {
        if (!input.departmentId) return null;
        const u = await this.resolveDepartmentHead(input.departmentId, input.tenantId, true);
        return u ? { approverId: u, requiredRole: 'department head' } : null;
      }
      case ApprovalPolicyStepType.ROLE: {
        // Role-based: leave approver_id null, store required role for runtime match
        return { approverId: null, requiredRole: (step.roleName || 'manager').toLowerCase() };
      }
      case ApprovalPolicyStepType.POSITION: {
        if (!step.positionId) return null;
        const employee = await this.employeeRepo.findOne({
          where: {
            tenantId: input.tenantId,
            positionId: step.positionId,
          } as any,
        });
        return employee?.userId
          ? { approverId: employee.userId, requiredRole: 'position approver' }
          : null;
      }
      case ApprovalPolicyStepType.SPECIFIC_USER: {
        return step.userId
          ? { approverId: step.userId, requiredRole: 'specific user' }
          : null;
      }
      case ApprovalPolicyStepType.GROUP: {
        if (!step.groupId) return null;
        const group = await this.groupRepo.findOne({
          where: { id: step.groupId, tenantId: input.tenantId },
        });
        if (!group) return null;
        return {
          approverId: null,
          groupId: group.id,
          requiredRole: `group:${group.name}`,
          quorumType: group.quorumType,
          quorumCount: group.quorumCount || null,
        };
      }
    }
    return null;
  }

  private async resolveDirectManager(
    userId: string,
    tenantId: string,
    levelsUp: number,
  ): Promise<string | null> {
    let currentUserId: string | null = userId;
    for (let i = 0; i < Math.max(1, levelsUp); i++) {
      const emp = await this.employeeRepo.findOne({
        where: { userId: currentUserId, tenantId } as any,
      });
      if (!emp || !emp.managerId) return null;
      const mgrEmp = await this.employeeRepo.findOne({
        where: { id: emp.managerId, tenantId } as any,
      });
      if (!mgrEmp || !mgrEmp.userId) return null;
      currentUserId = mgrEmp.userId;
    }
    return currentUserId === userId ? null : currentUserId;
  }

  private async resolveDepartmentHead(
    departmentId: string,
    tenantId: string,
    escalateToParent: boolean,
  ): Promise<string | null> {
    let did: string | null = departmentId;
    let depth = 0;
    while (did && depth < 10) {
      const dept = await this.departmentRepo.findOne({
        where: { id: did, tenantId } as any,
      });
      if (!dept) return null;
      if ((dept as any).headUserId) return (dept as any).headUserId;
      if (!escalateToParent) return null;
      did = (dept as any).parentId || null;
      depth++;
    }
    return null;
  }

  private async applyDelegation(
    userId: string,
    documentType: 'PR' | 'PO',
    tenantId: string,
  ): Promise<string | null> {
    const now = new Date();
    const delegations = await this.delegationRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId })
      .andWhere('d.fromUserId = :uid', { uid: userId })
      .andWhere('d.isActive = true')
      .andWhere('d.validFrom <= :now', { now })
      .andWhere('(d.validTo IS NULL OR d.validTo >= :now)', { now })
      .getMany();

    for (const d of delegations) {
      const types = d.documentTypes || ['ANY'];
      if (types.includes('ANY') || types.includes(documentType)) {
        return d.toUserId;
      }
    }
    return null;
  }

  /**
   * Group approval helper: count approvals on a chain row's group.
   * Returns true when quorum reached.
   */
  async isGroupQuorumReached(
    chain: ProcurementApprovalChain,
    approvedUserIds: string[],
  ): Promise<boolean> {
    if (!(chain as any).groupId) return true;
    const group = await this.groupRepo.findOne({
      where: { id: (chain as any).groupId, tenantId: chain.tenantId } as any,
    });
    if (!group) return true;
    const members = await this.groupMemberRepo.find({
      where: { groupId: group.id, tenantId: chain.tenantId } as any,
    });
    const memberIds = new Set(members.map((m) => m.userId));
    const approvalsByMembers = approvedUserIds.filter((u) => memberIds.has(u)).length;
    const total = members.length;
    switch (group.quorumType) {
      case ApproverGroupQuorum.ANY:
        return approvalsByMembers >= 1;
      case ApproverGroupQuorum.ALL:
        return approvalsByMembers >= total;
      case ApproverGroupQuorum.MAJORITY:
        return approvalsByMembers > total / 2;
      case ApproverGroupQuorum.M_OF_N:
        return approvalsByMembers >= (group.quorumCount || total);
    }
    return false;
  }
}
