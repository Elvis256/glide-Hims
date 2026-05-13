import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApprovalPolicyDocType,
  ApprovalPolicyStepType,
  ProcurementApprovalPolicy,
  ProcurementApprovalPolicyStep,
} from '../../database/entities/org-approval.entities';

interface SeedStep {
  approverType: ApprovalPolicyStepType;
  roleName?: string;
  levelsUp?: number;
  slaHours?: number;
  condition?: Record<string, unknown> | null;
  isOptional?: boolean;
  skipIfSelf?: boolean;
}

interface SeedPolicy {
  name: string;
  module: string;
  documentType: ApprovalPolicyDocType;
  category?: string;
  amountMin?: number;
  amountMax?: number;
  priority?: number;
  steps: SeedStep[];
}

/**
 * Per-tenant default approval policies. Idempotent: seeding the same tenant
 * twice with the same policy `name` is a no-op (we look up by tenant + name).
 *
 * Defaults are deliberately conservative — they exercise every framework
 * feature (direct manager, role-based, JSONLogic conditions, SLAs) without
 * requiring any tenant-side configuration.
 */
@Injectable()
export class ApprovalsSeederService {
  private readonly logger = new Logger(ApprovalsSeederService.name);

  constructor(
    @InjectRepository(ProcurementApprovalPolicy)
    private readonly policyRepo: Repository<ProcurementApprovalPolicy>,
    @InjectRepository(ProcurementApprovalPolicyStep)
    private readonly stepRepo: Repository<ProcurementApprovalPolicyStep>,
  ) {}

  defaultPolicies(): SeedPolicy[] {
    return [
      // ---- Procurement: PR ----
      {
        name: 'Default PR — Manager → Finance(>=1M) → CFO(>=10M)',
        module: 'procurement',
        documentType: ApprovalPolicyDocType.PR,
        priority: 10,
        steps: [
          { approverType: ApprovalPolicyStepType.DIRECT_MANAGER, slaHours: 48 },
          {
            approverType: ApprovalPolicyStepType.ROLE,
            roleName: 'permission:finance.approve',
            condition: { '>=': [{ var: 'amount' }, 1_000_000] },
            slaHours: 48,
          },
          {
            approverType: ApprovalPolicyStepType.ROLE,
            roleName: 'role:CFO',
            condition: { '>=': [{ var: 'amount' }, 10_000_000] },
            slaHours: 72,
          },
        ],
      },
      // ---- Procurement: PO ----
      {
        name: 'Default PO — Manager → Finance(>=1M) → CFO(>=10M)',
        module: 'procurement',
        documentType: ApprovalPolicyDocType.PO,
        priority: 10,
        steps: [
          { approverType: ApprovalPolicyStepType.DIRECT_MANAGER, slaHours: 48 },
          {
            approverType: ApprovalPolicyStepType.ROLE,
            roleName: 'permission:finance.approve',
            condition: { '>=': [{ var: 'amount' }, 1_000_000] },
            slaHours: 48,
          },
          {
            approverType: ApprovalPolicyStepType.ROLE,
            roleName: 'role:CFO',
            condition: { '>=': [{ var: 'amount' }, 10_000_000] },
            slaHours: 72,
          },
        ],
      },
      // ---- HR: leave ----
      {
        name: 'Default HR Leave — Manager (+ HR if >5 days)',
        module: 'hr',
        documentType: ApprovalPolicyDocType.ANY,
        priority: 10,
        steps: [
          { approverType: ApprovalPolicyStepType.DIRECT_MANAGER, slaHours: 48 },
          {
            approverType: ApprovalPolicyStepType.ROLE,
            roleName: 'permission:hr.approve_leave',
            condition: { '>': [{ var: 'amount' }, 5] },
            slaHours: 72,
          },
        ],
      },
      // ---- Finance: journal posting ----
      {
        name: 'Default Finance Journal — Self → CFO(>=5M)',
        module: 'finance',
        documentType: ApprovalPolicyDocType.ANY,
        priority: 10,
        steps: [
          {
            approverType: ApprovalPolicyStepType.ROLE,
            roleName: 'permission:finance.post_journal',
            condition: { '>=': [{ var: 'amount' }, 5_000_000] },
            slaHours: 72,
          },
        ],
      },
    ];
  }

  /**
   * Idempotently seed every default policy for `tenantId`. Returns the
   * count of policies actually created.
   */
  async seedForTenant(tenantId: string): Promise<{ created: number; skipped: number }> {
    if (!tenantId) return { created: 0, skipped: 0 };
    let created = 0;
    let skipped = 0;
    for (const def of this.defaultPolicies()) {
      const existing = await this.policyRepo.findOne({
        where: { tenantId, name: def.name } as any,
      });
      if (existing) {
        skipped++;
        continue;
      }
      const policy = await this.policyRepo.save(
        this.policyRepo.create({
          tenantId,
          name: def.name,
          module: def.module,
          documentType: def.documentType,
          category: def.category,
          amountMin: def.amountMin,
          amountMax: def.amountMax,
          priority: def.priority ?? 10,
          isActive: true,
        } as any),
      );
      let order = 1;
      for (const s of def.steps) {
        await this.stepRepo.save(
          this.stepRepo.create({
            tenantId,
            policyId: (policy as any).id,
            stepOrder: order++,
            approverType: s.approverType,
            roleName: s.roleName,
            levelsUp: s.levelsUp ?? 1,
            isOptional: s.isOptional ?? false,
            skipIfSelf: s.skipIfSelf ?? true,
            condition: s.condition ?? null,
            slaHours: s.slaHours ?? null,
          } as any),
        );
      }
      created++;
    }
    this.logger.log(
      `Approval policy seed for tenant ${tenantId}: created=${created} skipped=${skipped}`,
    );
    return { created, skipped };
  }
}
