import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Invoice, InvoiceStatus } from '../../database/entities/invoice.entity';
import { Patient, PatientDebtStatus } from '../../database/entities/patient.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class PatientDebtService {
  private readonly logger = new Logger(PatientDebtService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
  ) {}

  async recalculatePatientDebt(
    patientId: string,
    tenantId?: string,
  ): Promise<{ debtStatus: PatientDebtStatus; totalOutstanding: number }> {
    const tid = requireTenantId(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const patient = await manager.findOne(Patient, {
        where: { id: patientId, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!patient) {
        throw new NotFoundException('Patient not found');
      }

      // Sum unpaid invoices with aging buckets
      const rows = await manager.query(
        `
        SELECT
          COALESCE(SUM(balance_due), 0) AS total_outstanding,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN balance_due ELSE 0 END), 0) AS current_amount,
          COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '30 days' AND created_at >= NOW() - INTERVAL '60 days' THEN balance_due ELSE 0 END), 0) AS overdue_30,
          COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '60 days' AND created_at >= NOW() - INTERVAL '90 days' THEN balance_due ELSE 0 END), 0) AS overdue_60,
          COALESCE(SUM(CASE WHEN created_at < NOW() - INTERVAL '90 days' THEN balance_due ELSE 0 END), 0) AS overdue_90
        FROM invoices
        WHERE patient_id = $1
          AND status IN ('pending', 'partially_paid')
          AND balance_due > 0
          AND deleted_at IS NULL
          AND tenant_id = $2
        `,
        [patientId, tid],
      );

      const row = rows[0] || {};
      const totalOutstanding = Number(row.total_outstanding) || 0;
      const overdue90 = Number(row.overdue_90) || 0;
      const overdue60 = Number(row.overdue_60) || 0;
      const overdue30 = Number(row.overdue_30) || 0;

      let debtStatus: PatientDebtStatus;
      if (totalOutstanding <= 0) {
        debtStatus = PatientDebtStatus.NONE;
      } else if (overdue90 > 0) {
        debtStatus = PatientDebtStatus.OVERDUE_90;
      } else if (overdue60 > 0) {
        debtStatus = PatientDebtStatus.OVERDUE_60;
      } else if (overdue30 > 0) {
        debtStatus = PatientDebtStatus.OVERDUE_30;
      } else {
        debtStatus = PatientDebtStatus.CURRENT;
      }

      patient.debtStatus = debtStatus;
      patient.totalOutstandingBalance = totalOutstanding;
      patient.debtLastCalculatedAt = new Date();
      await manager.save(Patient, patient);

      return { debtStatus, totalOutstanding };
    });
  }

  async getDebtSummary(
    patientId: string,
    tenantId?: string,
  ): Promise<{
    debtStatus: string;
    totalOutstanding: number;
    blocksNewVisits: boolean;
    agingBuckets: { current: number; overdue30: number; overdue60: number; overdue90: number };
    unpaidInvoices: Array<{ id: string; invoiceNumber: string; balanceDue: number; createdAt: Date }>;
  }> {
    const tid = requireTenantId(tenantId);
    const patient = await this.patientRepo.findOne({
      where: { id: patientId, tenantId: tid },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const unpaidInvoices = await this.invoiceRepo.find({
      where: {
        patientId,
        status: In([InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID]),
        tenantId: tid,
      },
      order: { createdAt: 'ASC' },
    });

    const now = new Date();
    let current = 0;
    let overdue30 = 0;
    let overdue60 = 0;
    let overdue90 = 0;

    for (const inv of unpaidInvoices) {
      const balance = Number(inv.balanceDue);
      if (balance <= 0) continue;
      const daysDiff = Math.floor((now.getTime() - new Date(inv.createdAt).getTime()) / 86400000);
      if (daysDiff >= 90) {
        overdue90 += balance;
      } else if (daysDiff >= 60) {
        overdue60 += balance;
      } else if (daysDiff >= 30) {
        overdue30 += balance;
      } else {
        current += balance;
      }
    }

    return {
      debtStatus: patient.debtStatus,
      totalOutstanding: Number(patient.totalOutstandingBalance),
      blocksNewVisits: patient.blocksNewVisits,
      agingBuckets: { current, overdue30, overdue60, overdue90 },
      unpaidInvoices: unpaidInvoices
        .filter((inv) => Number(inv.balanceDue) > 0)
        .map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          balanceDue: Number(inv.balanceDue),
          createdAt: inv.createdAt,
        })),
    };
  }

  async setVisitBlock(params: {
    patientId: string;
    blocked: boolean;
    userId: string;
    reason?: string;
    tenantId?: string;
  }): Promise<void> {
    const tid = requireTenantId(params.tenantId);
    const patient = await this.patientRepo.findOne({
      where: { id: params.patientId, tenantId: tid },
    });
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    patient.blocksNewVisits = params.blocked;
    await this.patientRepo.save(patient);

    this.auditLogService
      .log({
        userId: params.userId,
        action: params.blocked ? 'PATIENT_VISIT_BLOCKED' : 'PATIENT_VISIT_UNBLOCKED',
        entityType: 'Patient',
        entityId: params.patientId,
        newValue: {
          blocked: params.blocked,
          reason: params.reason,
          debtStatus: patient.debtStatus,
          totalOutstanding: Number(patient.totalOutstandingBalance),
        },
        tenantId: params.tenantId,
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));
  }

  /**
   * Nightly batch: recalculate debt for all patients with unpaid invoices.
   * Auto-block patients with overdue_90 or collections status.
   */
  @Cron('0 2 * * *')
  async cronRecalculateDebt(): Promise<void> {
    this.logger.log('Starting nightly debt recalculation...');

    const patientIds: Array<{ patient_id: string; tenant_id: string | null }> =
      await this.dataSource.query(`
        SELECT DISTINCT patient_id, tenant_id
        FROM invoices
        WHERE status IN ('pending', 'partially_paid')
          AND balance_due > 0
          AND deleted_at IS NULL
      `);

    let processed = 0;
    let blocked = 0;

    for (const row of patientIds) {
      try {
        const result = await this.recalculatePatientDebt(
          row.patient_id,
          row.tenant_id || undefined,
        );

        // Auto-block for severe delinquency
        if (
          result.debtStatus === PatientDebtStatus.OVERDUE_90 ||
          result.debtStatus === PatientDebtStatus.COLLECTIONS
        ) {
          await this.patientRepo.update(row.patient_id, { blocksNewVisits: true });
          blocked++;
        }

        processed++;
      } catch (err) {
        this.logger.warn(
          `Debt recalculation failed for patient ${row.patient_id}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Nightly debt recalculation complete: ${processed} patients processed, ${blocked} auto-blocked`,
    );
  }
}
