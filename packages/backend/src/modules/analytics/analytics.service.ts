import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { Invoice, Payment } from '../../database/entities/invoice.entity';
import { Order } from '../../database/entities/order.entity';
import { Admission } from '../../database/entities/admission.entity';
import { EmergencyCase } from '../../database/entities/emergency-case.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { LabResult, AbnormalFlag, ResultStatus } from '../../database/entities/lab-result.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(Encounter)
    private encounterRepo: Repository<Encounter>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(Admission)
    private admissionRepo: Repository<Admission>,
    @InjectRepository(EmergencyCase)
    private emergencyRepo: Repository<EmergencyCase>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
    @InjectRepository(StockBalance)
    private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(StockLedger)
    private stockLedgerRepo: Repository<StockLedger>,
    @InjectRepository(LabResult)
    private labResultRepo: Repository<LabResult>,
    private readonly dataSource: DataSource,
  ) {}

  // Admin Dashboard Analytics
  // System admin: cross-tenant view allowed when tenantId is omitted
  async getAdminDashboard(tenantId?: string) {
    const tenantFilter = tenantId ? 'AND tenant_id = $1' : '';
    const params = tenantId ? [tenantId] : [];

    const [userStats, patientStats, moduleUsage, recentActivity, userActivityTrend, topUsers] =
      await Promise.all([
        this.getAdminUserStats(tenantFilter, params),
        this.getAdminPatientStats(tenantFilter, params),
        this.getAdminModuleUsage(tenantFilter, params),
        this.getAdminRecentActivity(tenantFilter, params),
        this.getAdminUserActivityTrend(tenantFilter, params),
        this.getAdminTopUsers(tenantFilter, params),
      ]);

    return {
      userStats,
      patientStats,
      moduleUsage,
      recentActivity,
      userActivityTrend,
      topUsers,
    };
  }

  private async getAdminUserStats(tenantFilter: string, params: any[]) {
    try {
      const totalRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL ${tenantFilter}`,
        params,
      );
      const activeRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND last_login_at >= NOW() - INTERVAL '30 days' ${tenantFilter}`,
        params,
      );
      const newRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL AND created_at >= date_trunc('month', NOW()) ${tenantFilter}`,
        params,
      );
      return {
        totalUsers: parseInt(totalRes[0]?.count, 10) || 0,
        activeUsers: parseInt(activeRes[0]?.count, 10) || 0,
        newUsersThisMonth: parseInt(newRes[0]?.count, 10) || 0,
      };
    } catch (e) {
      this.logger.warn('getAdminUserStats failed: ' + e.message);
      return { totalUsers: 0, activeUsers: 0, newUsersThisMonth: 0 };
    }
  }

  private async getAdminPatientStats(tenantFilter: string, params: any[]) {
    try {
      const totalRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM patients WHERE deleted_at IS NULL ${tenantFilter}`,
        params,
      );
      const newThisMonthRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM patients WHERE deleted_at IS NULL AND created_at >= date_trunc('month', NOW()) ${tenantFilter}`,
        params,
      );
      const newLastMonthRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM patients WHERE deleted_at IS NULL AND created_at >= date_trunc('month', NOW() - INTERVAL '1 month') AND created_at < date_trunc('month', NOW()) ${tenantFilter}`,
        params,
      );
      return {
        totalPatients: parseInt(totalRes[0]?.count, 10) || 0,
        newPatientsThisMonth: parseInt(newThisMonthRes[0]?.count, 10) || 0,
        newPatientsLastMonth: parseInt(newLastMonthRes[0]?.count, 10) || 0,
      };
    } catch (e) {
      this.logger.warn('getAdminPatientStats failed: ' + e.message);
      return { totalPatients: 0, newPatientsThisMonth: 0, newPatientsLastMonth: 0 };
    }
  }

  private async getAdminModuleUsage(tenantFilter: string, params: any[]) {
    try {
      const rows = await this.dataSource.query(
        `SELECT entity_type as module, COUNT(*) as count
         FROM audit_logs
         WHERE deleted_at IS NULL ${tenantFilter}
         GROUP BY entity_type
         ORDER BY count DESC
         LIMIT 20`,
        params,
      );
      return rows.map((r: any) => ({
        module: r.module || 'Unknown',
        count: parseInt(r.count, 10) || 0,
      }));
    } catch (e) {
      this.logger.warn('getAdminModuleUsage failed: ' + e.message);
      return [];
    }
  }

  private async getAdminRecentActivity(tenantFilter: string, params: any[]) {
    try {
      const todayRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM audit_logs WHERE deleted_at IS NULL AND created_at >= date_trunc('day', NOW()) ${tenantFilter}`,
        params,
      );
      const weekRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM audit_logs WHERE deleted_at IS NULL AND created_at >= date_trunc('week', NOW()) ${tenantFilter}`,
        params,
      );
      const monthRes = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM audit_logs WHERE deleted_at IS NULL AND created_at >= date_trunc('month', NOW()) ${tenantFilter}`,
        params,
      );
      return {
        totalActionsToday: parseInt(todayRes[0]?.count, 10) || 0,
        totalActionsThisWeek: parseInt(weekRes[0]?.count, 10) || 0,
        totalActionsThisMonth: parseInt(monthRes[0]?.count, 10) || 0,
      };
    } catch (e) {
      this.logger.warn('getAdminRecentActivity failed: ' + e.message);
      return { totalActionsToday: 0, totalActionsThisWeek: 0, totalActionsThisMonth: 0 };
    }
  }

  private async getAdminUserActivityTrend(tenantFilter: string, params: any[]) {
    try {
      const rows = await this.dataSource.query(
        `SELECT
           d.date,
           COALESCE(logins.cnt, 0) as logins,
           COALESCE(actions.cnt, 0) as actions
         FROM generate_series(
           (NOW() - INTERVAL '29 days')::date,
           NOW()::date,
           '1 day'::interval
         ) AS d(date)
         LEFT JOIN (
           SELECT created_at::date as day, COUNT(*) as cnt
           FROM audit_logs
           WHERE deleted_at IS NULL AND action = 'LOGIN' ${tenantFilter}
             AND created_at >= NOW() - INTERVAL '30 days'
           GROUP BY created_at::date
         ) logins ON logins.day = d.date
         LEFT JOIN (
           SELECT created_at::date as day, COUNT(*) as cnt
           FROM audit_logs
           WHERE deleted_at IS NULL ${tenantFilter}
             AND created_at >= NOW() - INTERVAL '30 days'
           GROUP BY created_at::date
         ) actions ON actions.day = d.date
         ORDER BY d.date`,
        params,
      );
      return rows.map((r: any) => ({
        date:
          r.date instanceof Date
            ? r.date.toISOString().split('T')[0]
            : String(r.date).split('T')[0],
        logins: parseInt(r.logins, 10) || 0,
        actions: parseInt(r.actions, 10) || 0,
      }));
    } catch (e) {
      this.logger.warn('getAdminUserActivityTrend failed: ' + e.message);
      return [];
    }
  }

  private async getAdminTopUsers(tenantFilter: string, params: any[]) {
    try {
      const rows = await this.dataSource.query(
        `SELECT
           u.username,
           u.full_name as "fullName",
           COUNT(a.id) as "actionCount",
           u.last_login_at as "lastLogin"
         FROM users u
         LEFT JOIN audit_logs a ON a.user_id = u.id AND a.deleted_at IS NULL
         WHERE u.deleted_at IS NULL ${tenantFilter.replace(/tenant_id/g, 'u.tenant_id')}
         GROUP BY u.id, u.username, u.full_name, u.last_login_at
         ORDER BY "actionCount" DESC
         LIMIT 10`,
        params,
      );
      return rows.map((r: any) => ({
        username: r.username,
        fullName: r.fullName,
        actionCount: parseInt(r.actionCount, 10) || 0,
        lastLogin: r.lastLogin,
      }));
    } catch (e) {
      this.logger.warn('getAdminTopUsers failed: ' + e.message);
      return [];
    }
  }

  // Executive Dashboard KPIs
  async getExecutiveDashboard(facilityId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      totalPatients,
      newPatientsToday,
      newPatientsMonth,
      encountersToday,
      encountersMonth,
      revenueToday,
      revenueMonth,
      revenueYear,
      collectionsMonth,
      outstandingBalance,
      admissionsActive,
      emergenciesToday,
    ] = await Promise.all([
      this.patientRepo.count({ where: { tenantId: tid } }),
      this.countPatientsSince(today, tid),
      this.countPatientsSince(monthStart, tid),
      this.countEncountersSince(facilityId, today, tid),
      this.countEncountersSince(facilityId, monthStart, tid),
      this.getRevenueSum(facilityId, today, tid),
      this.getRevenueSum(facilityId, monthStart, tid),
      this.getRevenueSum(facilityId, yearStart, tid),
      this.getCollectionsSum(facilityId, monthStart, tid),
      this.getOutstandingBalance(facilityId, tid),
      this.countActiveAdmissions(facilityId, tid),
      this.countEmergenciesSince(facilityId, today, tid),
    ]);

    return {
      patients: {
        total: totalPatients,
        newToday: newPatientsToday,
        newThisMonth: newPatientsMonth,
      },
      encounters: {
        today: encountersToday,
        thisMonth: encountersMonth,
      },
      revenue: {
        today: revenueToday,
        thisMonth: revenueMonth,
        thisYear: revenueYear,
      },
      collections: {
        thisMonth: collectionsMonth,
      },
      outstanding: outstandingBalance,
      admissions: {
        active: admissionsActive,
      },
      emergencies: {
        today: emergenciesToday,
      },
    };
  }

  // Patient Analytics
  async getPatientAnalytics(
    facilityId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    const { startDate, groupBy } = this.getPeriodParams(period);
    // Registration trend
    const regSql = `
      SELECT
        DATE_TRUNC('${groupBy}', created_at) as period,
        COUNT(*) as count
      FROM patients
      WHERE created_at >= $1 AND tenant_id = $2
      GROUP BY DATE_TRUNC('${groupBy}', created_at)
      ORDER BY period`;
    const registrationTrend = await this.patientRepo.query(regSql, [startDate, tid]);

    // Gender distribution
    const genderSql = `SELECT gender, COUNT(*) as count FROM patients WHERE tenant_id = $1 GROUP BY gender`;
    const genderDistribution = await this.patientRepo.query(genderSql, [tid]);

    // Age distribution
    const ageSql = `
      SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 5 THEN '0-4'
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 18 THEN '5-17'
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 35 THEN '18-34'
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 50 THEN '35-49'
          WHEN EXTRACT(YEAR FROM AGE(date_of_birth)) < 65 THEN '50-64'
          ELSE '65+'
        END as age_group,
        COUNT(*) as count
      FROM patients
      WHERE date_of_birth IS NOT NULL AND tenant_id = $1
      GROUP BY age_group
      ORDER BY age_group`;
    const ageDistribution = await this.patientRepo.query(ageSql, [tid]);

    // Blood group distribution
    const bloodSql = `
      SELECT
        COALESCE(blood_group, 'Unknown') as blood_group,
        COUNT(*) as count
      FROM patients
      WHERE deleted_at IS NULL AND tenant_id = $1
      GROUP BY blood_group
      ORDER BY count DESC`;
    const bloodGroupDistribution = await this.patientRepo.query(bloodSql, [tid]);

    return {
      registrationTrend,
      genderDistribution,
      ageDistribution,
      bloodGroupDistribution,
    };
  }

  // Clinical Analytics
  async getClinicalAnalytics(
    facilityId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    const { startDate, groupBy } = this.getPeriodParams(period);

    // Encounter volume trend
    const encTrendSql = `
      SELECT
        DATE_TRUNC('${groupBy}', created_at) as period,
        type as encounter_type,
        COUNT(*) as count
      FROM encounters
      WHERE facility_id = $1 AND created_at >= $2 AND tenant_id = $3
      GROUP BY DATE_TRUNC('${groupBy}', created_at), type
      ORDER BY period`;
    const encounterTrend = await this.encounterRepo.query(encTrendSql, [facilityId, startDate, tid]);

    // Top diagnoses from clinical_notes JSON
    const diagSql = `
      SELECT
        d->>'description' as diagnosis,
        d->>'code' as code,
        COUNT(*) as count
      FROM clinical_notes cn
      JOIN encounters e ON e.id = cn.encounter_id,
        jsonb_array_elements(cn.diagnoses::jsonb) AS d
      WHERE e.facility_id = $1 AND cn.created_at >= $2 AND cn.diagnoses IS NOT NULL
        AND e.tenant_id = $3
      GROUP BY d->>'description', d->>'code'
      ORDER BY count DESC
      LIMIT 10`;
    const topDiagnoses = await this.encounterRepo.query(diagSql, [facilityId, startDate, tid]);

    // Encounter by type
    const encTypeSql = `
      SELECT
        type as encounter_type,
        COUNT(*) as count
      FROM encounters
      WHERE facility_id = $1 AND created_at >= $2 AND tenant_id = $3
      GROUP BY type`;
    const encountersByType = await this.encounterRepo.query(encTypeSql, [facilityId, startDate, tid]);

    return {
      encounterTrend,
      topDiagnoses,
      encountersByType,
    };
  }

  // Financial Analytics
  async getFinancialAnalytics(
    facilityId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month',
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    const { startDate, groupBy } = this.getPeriodParams(period);

    // Revenue trend
    const revTrendSql = `
      SELECT
        DATE_TRUNC('${groupBy}', i.created_at) as period,
        SUM(i.total_amount) as revenue,
        COUNT(*) as invoice_count
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND i.created_at >= $2 AND i.status != 'cancelled' AND i.deleted_at IS NULL
        AND i.tenant_id = $3
      GROUP BY DATE_TRUNC('${groupBy}', i.created_at)
      ORDER BY period`;
    const revenueTrend = await this.invoiceRepo.query(revTrendSql, [facilityId, startDate, tid]).catch((err) => {
      this.logger.warn('Analytics query failed: ' + err.message);
      return [];
    });

    // Collections trend
    const collTrendSql = `
      SELECT
        DATE_TRUNC('${groupBy}', p.created_at) as period,
        SUM(p.amount) as collections,
        p.method as payment_method,
        COUNT(*) as payment_count
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND p.created_at >= $2 AND p.deleted_at IS NULL
        AND p.tenant_id = $3
      GROUP BY DATE_TRUNC('${groupBy}', p.created_at), p.method
      ORDER BY period`;
    const collectionsTrend = await this.paymentRepo
      .query(collTrendSql, [facilityId, startDate, tid])
      .catch((err) => {
        this.logger.warn('Analytics query failed: ' + err.message);
        return [];
      });

    // Revenue by department/service
    const revDeptSql = `
      SELECT
        COALESCE(INITCAP(e.type::text), 'General') as department,
        SUM(i.total_amount) as revenue,
        COUNT(*) as count
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND i.created_at >= $2 AND i.status != 'cancelled' AND i.deleted_at IS NULL
        AND i.tenant_id = $3
      GROUP BY e.type
      ORDER BY revenue DESC`;
    const revenueByDepartment = await this.invoiceRepo
      .query(revDeptSql, [facilityId, startDate, tid])
      .catch((err) => {
        this.logger.warn('Analytics query failed: ' + err.message);
        return [];
      });

    // Payment methods distribution
    const payMethodSql = `
      SELECT
        p.method as payment_method,
        SUM(p.amount) as total,
        COUNT(*) as count
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND p.created_at >= $2 AND p.deleted_at IS NULL
        AND p.tenant_id = $3
      GROUP BY p.method`;
    const paymentMethods = await this.paymentRepo
      .query(payMethodSql, [facilityId, startDate, tid])
      .catch((err) => {
        this.logger.warn('Analytics query failed: ' + err.message);
        return [];
      });

    // Outstanding by age
    const outAgeSql = `
      SELECT
        CASE
          WHEN i.created_at >= NOW() - INTERVAL '30 days' THEN '0-30 days'
          WHEN i.created_at >= NOW() - INTERVAL '60 days' THEN '31-60 days'
          WHEN i.created_at >= NOW() - INTERVAL '90 days' THEN '61-90 days'
          ELSE '90+ days'
        END as age_bucket,
        SUM(i.balance_due) as outstanding,
        COUNT(*) as count
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND i.status NOT IN ('paid', 'cancelled') AND i.balance_due > 0 AND i.deleted_at IS NULL
        AND i.tenant_id = $2
      GROUP BY age_bucket`;
    const outstandingByAge = await this.invoiceRepo.query(outAgeSql, [facilityId, tid]).catch((err) => {
      this.logger.warn('Analytics query failed: ' + err.message);
      return [];
    });

    // Recent transactions
    const recentTxSql = `
      SELECT
        i.id,
        i.invoice_number,
        i.total_amount,
        i.amount_paid,
        i.balance_due,
        i.status,
        i.created_at,
        p2.full_name as patient_name,
        p2.mrn
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      LEFT JOIN patients p2 ON p2.id = i.patient_id
      WHERE (e.facility_id = $1)
        AND i.deleted_at IS NULL AND i.created_at >= $2
        AND i.tenant_id = $3
      ORDER BY i.created_at DESC
      LIMIT 20`;
    const recentTransactions = await this.invoiceRepo
      .query(recentTxSql, [facilityId, startDate, tid])
      .catch((err) => {
        this.logger.warn('Analytics query failed: ' + err.message);
        return [];
      });

    // Collections total for the period
    const collTotalSql = `
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND p.created_at >= $2 AND p.deleted_at IS NULL
        AND p.tenant_id = $3`;
    const collectionsTotal = await this.paymentRepo
      .query(collTotalSql, [facilityId, startDate, tid])
      .catch((err) => {
        this.logger.warn('Analytics query failed: ' + err.message);
        return [{ total: 0 }];
      });

    return {
      revenueTrend,
      collectionsTrend,
      revenueByDepartment,
      paymentMethods,
      outstandingByAge,
      recentTransactions,
      collectionsTotal: parseFloat(collectionsTotal[0]?.total || 0),
    };
  }

  // Operational Analytics
  async getOperationalAnalytics(facilityId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    // Bed occupancy - wards uses camelCase column
    const bedSql = `
      SELECT
        w.name as ward,
        COUNT(CASE WHEN a.status = 'admitted' THEN 1 END) as occupied,
        w."totalBeds" as total,
        ROUND(COUNT(CASE WHEN a.status = 'admitted' THEN 1 END) * 100.0 / NULLIF(w."totalBeds", 0), 1) as occupancy_rate
      FROM wards w
      LEFT JOIN beds b ON b."wardId" = w.id
      LEFT JOIN admissions a ON a."bedId" = b.id AND a.status = 'admitted'
      WHERE w."facilityId" = $1 AND w.tenant_id = $2
      GROUP BY w.id, w.name, w."totalBeds"`;
    const bedOccupancy = await this.admissionRepo.query(bedSql, [facilityId, tid]);

    // Lab turnaround time - join orders through encounter for facility filter
    const labTATSql = `
      SELECT
        AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at))/3600) as avg_tat_hours,
        COUNT(*) as total_tests,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_tests
      FROM orders o
      JOIN encounters e ON e.id = o.encounter_id
      WHERE e.facility_id = $1 AND o.order_type = 'lab' AND o.created_at >= NOW() - INTERVAL '30 days'
        AND o.tenant_id = $2`;
    const labTAT = await this.orderRepo.query(labTATSql, [facilityId, tid]);

    // Average length of stay - join through encounter
    const losSql = `
      SELECT
        AVG(EXTRACT(DAY FROM (a."dischargeDate" - a."admissionDate"))) as avg_los_days
      FROM admissions a
      JOIN encounters e ON e.id = a."encounterId"
      WHERE e.facility_id = $1
        AND a.status = 'discharged'
        AND a."dischargeDate" IS NOT NULL
        AND a."admissionDate" >= NOW() - INTERVAL '90 days'
        AND a.tenant_id = $2`;
    const avgLOS = await this.admissionRepo.query(losSql, [facilityId, tid]);

    // Emergency response
    const emSql = `
      SELECT
        triage_level,
        COUNT(*) as count
      FROM emergency_cases
      WHERE facility_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
        AND tenant_id = $2
      GROUP BY triage_level`;
    const emergencyMetrics = await this.emergencyRepo.query(emSql, [facilityId, tid]);

    return {
      bedOccupancy,
      labTAT: labTAT[0] || {},
      avgLengthOfStay: avgLOS[0]?.avg_los_days || null,
      emergencyMetrics,
    };
  }

  // Summary report for a date range
  async getSummaryReport(facilityId: string, startDate: Date, endDate: Date, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const [patientStats, encounterStats, revenueStats, admissionStats] = await Promise.all([
      this.patientRepo.query(
        `SELECT COUNT(*) as new_patients
         FROM patients
         WHERE created_at BETWEEN $1 AND $2 AND tenant_id = $3`,
        [startDate, endDate, tid],
      ),

      this.encounterRepo.query(
        `SELECT
           type as encounter_type,
           COUNT(*) as count
         FROM encounters
         WHERE facility_id = $1 AND created_at BETWEEN $2 AND $3 AND tenant_id = $4
         GROUP BY type`,
        [facilityId, startDate, endDate, tid],
      ),

      this.invoiceRepo.query(
        `SELECT
           SUM(i.total_amount) as total_billed,
           SUM(i.amount_paid) as total_collected,
           COUNT(*) as invoice_count
         FROM invoices i
         JOIN encounters e ON e.id = i.encounter_id
         WHERE e.facility_id = $1 AND i.created_at BETWEEN $2 AND $3 AND i.tenant_id = $4`,
        [facilityId, startDate, endDate, tid],
      ),

      this.admissionRepo.query(
        `SELECT
           COUNT(*) as total_admissions,
           COUNT(CASE WHEN a.status = 'discharged' THEN 1 END) as discharges
         FROM admissions a
         JOIN encounters e ON e.id = a."encounterId"
         WHERE e.facility_id = $1 AND a."admissionDate" BETWEEN $2 AND $3 AND a.tenant_id = $4`,
        [facilityId, startDate, endDate, tid],
      ),
    ]);

    return {
      period: { startDate, endDate },
      patients: patientStats[0] || {},
      encounters: encounterStats,
      revenue: revenueStats[0] || {},
      admissions: admissionStats[0] || {},
    };
  }

  // Helper methods
  private async countPatientsSince(since: Date, tenantId?: string): Promise<number> {
    const tid = requireTenantId(tenantId);
    const result = await this.patientRepo.query(
      `SELECT COUNT(*) as count FROM patients WHERE created_at >= $1 AND tenant_id = $2`,
      [since, tid],
    );
    return parseInt(result[0]?.count || 0);
  }

  private async countActiveAdmissions(facilityId: string, tenantId?: string): Promise<number> {
    const tid = requireTenantId(tenantId);
    const result = await this.admissionRepo.query(
      `SELECT COUNT(*) as count
       FROM admissions a
       JOIN encounters e ON e.id = a."encounterId"
       WHERE e.facility_id = $1 AND a.status = 'admitted' AND a.tenant_id = $2`,
      [facilityId, tid],
    );
    return parseInt(result[0]?.count || 0);
  }

  private async countEncountersSince(
    facilityId: string,
    since: Date,
    tenantId?: string,
  ): Promise<number> {
    const tid = requireTenantId(tenantId);
    const result = await this.encounterRepo.query(
      `SELECT COUNT(*) as count FROM encounters WHERE facility_id = $1 AND created_at >= $2 AND tenant_id = $3`,
      [facilityId, since, tid],
    );
    return parseInt(result[0]?.count || 0);
  }

  private async countEmergenciesSince(
    facilityId: string,
    since: Date,
    tenantId?: string,
  ): Promise<number> {
    const tid = requireTenantId(tenantId);
    const result = await this.emergencyRepo.query(
      `SELECT COUNT(*) as count FROM emergency_cases WHERE facility_id = $1 AND created_at >= $2 AND tenant_id = $3`,
      [facilityId, since, tid],
    );
    return parseInt(result[0]?.count || 0);
  }

  private async getRevenueSum(facilityId: string, since: Date, tenantId?: string): Promise<number> {
    const tid = requireTenantId(tenantId);
    const result = await this.invoiceRepo.query(
      `SELECT COALESCE(SUM(i.total_amount), 0) as total
       FROM invoices i
       LEFT JOIN encounters e ON e.id = i.encounter_id
       WHERE (e.facility_id = $1)
         AND i.created_at >= $2 AND i.status != 'cancelled' AND i.deleted_at IS NULL
         AND i.tenant_id = $3`,
      [facilityId, since, tid],
    );
    return parseFloat(result[0]?.total || 0);
  }

  private async getCollectionsSum(
    facilityId: string,
    since: Date,
    tenantId?: string,
  ): Promise<number> {
    const tid = requireTenantId(tenantId);
    const result = await this.paymentRepo.query(
      `SELECT COALESCE(SUM(p.amount), 0) as total
       FROM payments p
       JOIN invoices i ON i.id = p.invoice_id
       LEFT JOIN encounters e ON e.id = i.encounter_id
       WHERE (e.facility_id = $1)
         AND p.created_at >= $2 AND p.deleted_at IS NULL
         AND p.tenant_id = $3`,
      [facilityId, since, tid],
    );
    return parseFloat(result[0]?.total || 0);
  }

  private async getOutstandingBalance(facilityId: string, tenantId?: string): Promise<number> {
    const tid = requireTenantId(tenantId);
    const result = await this.invoiceRepo.query(
      `SELECT COALESCE(SUM(i.balance_due), 0) as outstanding
       FROM invoices i
       LEFT JOIN encounters e ON e.id = i.encounter_id
       WHERE (e.facility_id = $1)
         AND i.status NOT IN ('paid', 'cancelled') AND i.deleted_at IS NULL
         AND i.tenant_id = $2`,
      [facilityId, tid],
    );
    return parseFloat(result[0]?.outstanding || 0);
  }

  // Safe mapping — only these values can appear in DATE_TRUNC SQL.
  private static readonly SAFE_GROUP_BY: Record<string, string> = {
    hour: 'hour',
    day: 'day',
    week: 'week',
    month: 'month',
    year: 'year',
  };

  private getPeriodParams(period: 'day' | 'week' | 'month' | 'year') {
    const now = new Date();
    let startDate: Date;
    let groupBy: string;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        groupBy = 'hour';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'day';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = 'day';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        groupBy = 'month';
        break;
    }

    return { startDate, groupBy: AnalyticsService.SAFE_GROUP_BY[groupBy] || 'day' };
  }

  // Recent Activity - fetch real activities from various sources
  async getRecentActivity(facilityId: string, limit = 10, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const activities: Array<{
      type: string;
      title: string;
      description: string;
      timestamp: Date;
      icon: string;
    }> = [];

    // Get recent patient registrations (tenant-scoped)
    const recentPatients = await this.patientRepo.find({
      where: { tenantId: tid },
      order: { createdAt: 'DESC' },
      take: 3,
      select: ['id', 'fullName', 'mrn', 'createdAt'],
    });
    recentPatients.forEach((p) => {
      activities.push({
        type: 'registration',
        title: 'New patient registered',
        description: `${p.fullName} (${p.mrn})`,
        timestamp: p.createdAt,
        icon: 'user-plus',
      });
    });

    // Get recent completed encounters
    const recentEncounters = await this.encounterRepo.find({
      where: { facilityId, status: EncounterStatus.COMPLETED, tenantId: tid },
      order: { updatedAt: 'DESC' },
      take: 3,
      relations: ['patient'],
    });
    recentEncounters.forEach((e) => {
      activities.push({
        type: 'consultation',
        title: 'Consultation completed',
        description: `${e.patient?.fullName || 'Patient'} - ${e.type || 'OPD'}`,
        timestamp: e.updatedAt,
        icon: 'stethoscope',
      });
    });

    // Get recent lab results (via sample -> patient)
    const labResultWhere: any = { status: 'validated', tenantId: tid };
    const recentLabResults = await this.labResultRepo.find({
      where: labResultWhere,
      order: { updatedAt: 'DESC' },
      take: 3,
      relations: ['sample', 'sample.patient', 'sample.labTest'],
    });
    recentLabResults.forEach((r) => {
      activities.push({
        type: 'lab',
        title: 'Lab results ready',
        description: `${r.sample?.patient?.fullName || 'Patient'} - ${r.sample?.labTest?.name || r.parameter || 'Test'}`,
        timestamp: r.updatedAt,
        icon: 'flask',
      });
    });

    // Get recent payments
    const recentPayments = await this.paymentRepo.find({
      where: { tenantId: tid },
      order: { createdAt: 'DESC' },
      take: 3,
      relations: ['invoice', 'invoice.encounter', 'invoice.encounter.patient'],
    });
    recentPayments.forEach((p) => {
      activities.push({
        type: 'payment',
        title: 'Payment received',
        description: `${p.invoice?.encounter?.patient?.fullName || 'Patient'} - ${p.amount?.toLocaleString() || 0} UGX`,
        timestamp: p.createdAt,
        icon: 'credit-card',
      });
    });

    // Sort by timestamp and return top N
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Dashboard Alerts - fetch real alerts from various sources
  async getDashboardAlerts(facilityId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const alerts: Array<{
      type: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      count?: number;
    }> = [];

    // Check for critical lab results (abnormal flag)
    const criticalLabResults = await this.labResultRepo.count({
      where: {
        abnormalFlag: In([AbnormalFlag.CRITICAL_LOW, AbnormalFlag.CRITICAL_HIGH]),
        tenantId: tid,
      },
    });
    if (criticalLabResults > 0) {
      alerts.push({
        type: 'critical',
        title: 'Critical lab results',
        description: `${criticalLabResults} result(s) require immediate attention`,
        count: criticalLabResults,
      });
    }

    // Check for low stock items
    const lowStockQb = this.stockBalanceRepo
      .createQueryBuilder('sb')
      .innerJoin('sb.item', 'item')
      .where('sb.available_quantity <= item.reorder_level')
      .andWhere('item.reorder_level > 0')
      .andWhere('sb.tenant_id = :tenantId', { tenantId: tid });
    const lowStockItems = await lowStockQb.getCount();
    if (lowStockItems > 0) {
      alerts.push({
        type: 'warning',
        title: 'Low stock alert',
        description: `${lowStockItems} item(s) below reorder level`,
        count: lowStockItems,
      });
    }

    // Check for pending lab results awaiting validation
    const pendingLabValidation = await this.labResultRepo.count({
      where: { status: ResultStatus.ENTERED, tenantId: tid },
    });
    if (pendingLabValidation > 0) {
      alerts.push({
        type: 'info',
        title: 'Pending approvals',
        description: `${pendingLabValidation} lab result(s) awaiting validation`,
        count: pendingLabValidation,
      });
    }

    // Check for unpaid invoices older than 30 days
    const overdueQb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .innerJoin('invoice.encounter', 'encounter')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('invoice.status != :status', { status: 'paid' })
      .andWhere('invoice.balance_due > 0')
      .andWhere('invoice.created_at < :date', {
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      })
      .andWhere('invoice.tenant_id = :tenantId', { tenantId: tid });
    const overdueInvoices = await overdueQb.getCount();
    if (overdueInvoices > 0) {
      alerts.push({
        type: 'warning',
        title: 'Overdue invoices',
        description: `${overdueInvoices} invoice(s) unpaid for 30+ days`,
        count: overdueInvoices,
      });
    }

    return alerts;
  }

  async getMortalityStatistics(tenantId?: string, range: string = 'month') {
    const tid = requireTenantId(tenantId);
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    const qb = this.admissionRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.ward', 'ward')
      .where('a.status = :status', { status: 'deceased' })
      .andWhere('a.dischargeDate >= :startDate', { startDate })
      .andWhere('a.tenant_id = :tenantId', { tenantId: tid });

    const deceased = await qb.getMany();

    const totalAdmissionsQb = this.admissionRepo
      .createQueryBuilder('a')
      .where('a.admissionDate >= :startDate', { startDate })
      .andWhere('a.tenant_id = :tenantId', { tenantId: tid });
    const totalAdmissions = await totalAdmissionsQb.getCount();

    const totalDeaths = deceased.length;
    const mortalityRate =
      totalAdmissions > 0 ? parseFloat(((totalDeaths / totalAdmissions) * 100).toFixed(2)) : 0;

    let maleDeaths = 0;
    let femaleDeaths = 0;
    const ageGroups: Record<string, number> = {
      '0-18': 0,
      '19-40': 0,
      '41-60': 0,
      '61-80': 0,
      '80+': 0,
    };
    const causeMap: Record<string, number> = {};
    const ages: number[] = [];

    for (const admission of deceased) {
      const patient = admission.patient;
      if (patient?.gender === 'male') maleDeaths++;
      else femaleDeaths++;

      if (patient?.dateOfBirth) {
        const age = Math.floor(
          (now.getTime() - new Date(patient.dateOfBirth).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000),
        );
        ages.push(age);
        if (age <= 18) ageGroups['0-18']++;
        else if (age <= 40) ageGroups['19-40']++;
        else if (age <= 60) ageGroups['41-60']++;
        else if (age <= 80) ageGroups['61-80']++;
        else ageGroups['80+']++;
      }

      const cause = admission.dischargeDiagnosis || 'Unknown';
      causeMap[cause] = (causeMap[cause] || 0) + 1;
    }

    const averageAge =
      ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;

    const causesOfDeath = Object.entries(causeMap)
      .map(([cause, count]) => {
        const icdMatch = cause.match(/\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/);
        return { cause, icdCode: icdMatch ? icdMatch[1] : '', count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const genderDistribution = [
      { name: 'Male', value: maleDeaths },
      { name: 'Female', value: femaleDeaths },
    ];

    const ageDistribution = Object.entries(ageGroups).map(([range, count]) => ({
      range,
      count,
    }));

    // Monthly trend for the last 12 months
    const monthlyTrend: { month: string; deaths: number; rate: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const monthName = monthStart.toLocaleString('default', { month: 'short', year: '2-digit' });

      const deathsInMonth = deceased.filter(
        (a) =>
          a.dischargeDate &&
          new Date(a.dischargeDate) >= monthStart &&
          new Date(a.dischargeDate) <= monthEnd,
      ).length;

      const monthlyAdmissionsQb = this.admissionRepo
        .createQueryBuilder('a')
        .where('a.admissionDate >= :monthStart', { monthStart })
        .andWhere('a.admissionDate <= :monthEnd', { monthEnd })
        .andWhere('a.tenant_id = :tenantId', { tenantId: tid });
      const monthAdmissions = await monthlyAdmissionsQb.getCount();

      monthlyTrend.push({
        month: monthName,
        deaths: deathsInMonth,
        rate:
          monthAdmissions > 0
            ? parseFloat(((deathsInMonth / monthAdmissions) * 1000).toFixed(2))
            : 0, // per 1000 admissions
      });
    }

    return {
      totalDeaths,
      mortalityRate,
      maleDeaths,
      femaleDeaths,
      averageAge,
      causesOfDeath,
      genderDistribution,
      ageDistribution,
      monthlyTrend,
    };
  }

  // ─── HMIS 105: Uganda Monthly OPD Summary ───────────────────────────

  async getHMIS105Report(
    tenantId: string | undefined,
    facilityId: string,
    month: number,
    year: number,
  ) {
    const tid = requireTenantId(tenantId);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const [sectionA, sectionB, sectionC, sectionD, sectionE] = await Promise.all([
      this.hmis105SectionA(facilityId, startDate, endDate, tid),
      this.hmis105SectionB(facilityId, startDate, endDate, tid),
      this.hmis105SectionC(facilityId, startDate, endDate, tid),
      this.hmis105SectionD(facilityId, startDate, endDate, tid),
      this.hmis105SectionE(facilityId, startDate, endDate, tid),
    ]);

    return {
      reportTitle: 'HMIS 105 - Health Unit Outpatient Monthly Report',
      facility: facilityId,
      period: { month, year },
      generatedAt: new Date().toISOString(),
      sectionA,
      sectionB,
      sectionC,
      sectionD,
      sectionE,
    };
  }

  /**
   * Section A: OPD Diagnoses – encounters grouped by ICD-10 category,
   * broken down by age-band and sex.
   */
  private async hmis105SectionA(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    // ── Top 20 diagnoses by age band / sex ──
    const topSql = `
      SELECT
        d->>'code'        AS code,
        d->>'description' AS diagnosis,
        CASE
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '29 days'  THEN '0-28d'
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '5 years'  THEN '29d-4y'
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '13 years' THEN '5-12y'
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '20 years' THEN '13-19y'
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '60 years' THEN '20-59y'
          ELSE '60+'
        END AS age_band,
        UPPER(LEFT(p.gender, 1)) AS sex,
        COUNT(*) AS count
      FROM clinical_notes cn
      JOIN encounters e ON e.id = cn.encounter_id
      JOIN patients p    ON p.id = e.patient_id,
        jsonb_array_elements(cn.diagnoses::jsonb) AS d
      WHERE e.facility_id = $1
        AND cn.created_at >= $2
        AND cn.created_at <  $3
        AND cn.diagnoses IS NOT NULL
        AND e.deleted_at IS NULL
        AND cn.deleted_at IS NULL
        AND e.tenant_id = $4
      GROUP BY d->>'code', d->>'description', age_band, sex
      ORDER BY count DESC`;

    const rawDiagnoses = await this.encounterRepo.query(topSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionA top diagnoses failed: ' + err.message);
      return [];
    });

    // Pivot raw rows into { code, diagnosis, totalCount, ageSexBreakdown }
    const diagMap = new Map<string, any>();
    for (const r of rawDiagnoses) {
      const key = r.code || r.diagnosis;
      if (!diagMap.has(key)) {
        diagMap.set(key, {
          code: r.code,
          diagnosis: r.diagnosis,
          totalCount: 0,
          ageSexBreakdown: {},
        });
      }
      const entry = diagMap.get(key);
      const cnt = parseInt(r.count, 10) || 0;
      entry.totalCount += cnt;
      if (!entry.ageSexBreakdown[r.age_band]) {
        entry.ageSexBreakdown[r.age_band] = { M: 0, F: 0 };
      }
      entry.ageSexBreakdown[r.age_band][r.sex === 'M' ? 'M' : 'F'] += cnt;
    }

    const top20Diagnoses = [...diagMap.values()]
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 20);

    // ── Diagnosis groups by ICD-10 chapter (first letter of code) ──
    const grpSql = `
      SELECT
        UPPER(LEFT(d->>'code', 1))  AS chapter_letter,
        CASE
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '29 days'  THEN '0-28d'
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '5 years'  THEN '29d-4y'
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '13 years' THEN '5-12y'
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '20 years' THEN '13-19y'
          WHEN AGE(date_trunc('month', $2::timestamptz), p.date_of_birth) < INTERVAL '60 years' THEN '20-59y'
          ELSE '60+'
        END AS age_band,
        UPPER(LEFT(p.gender, 1)) AS sex,
        COUNT(*) AS count
      FROM clinical_notes cn
      JOIN encounters e ON e.id = cn.encounter_id
      JOIN patients p    ON p.id = e.patient_id,
        jsonb_array_elements(cn.diagnoses::jsonb) AS d
      WHERE e.facility_id = $1
        AND cn.created_at >= $2
        AND cn.created_at <  $3
        AND cn.diagnoses IS NOT NULL
        AND d->>'code' IS NOT NULL
        AND e.deleted_at IS NULL
        AND cn.deleted_at IS NULL
        AND e.tenant_id = $4
      GROUP BY chapter_letter, age_band, sex
      ORDER BY chapter_letter`;

    const rawGroups = await this.encounterRepo.query(grpSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionA diagnosis groups failed: ' + err.message);
      return [];
    });

    const chapterMap = new Map<string, any>();
    for (const r of rawGroups) {
      const ch = r.chapter_letter || '?';
      if (!chapterMap.has(ch)) {
        chapterMap.set(ch, { chapter: ch, totalCount: 0, ageSexBreakdown: {} });
      }
      const entry = chapterMap.get(ch);
      const cnt = parseInt(r.count, 10) || 0;
      entry.totalCount += cnt;
      if (!entry.ageSexBreakdown[r.age_band]) {
        entry.ageSexBreakdown[r.age_band] = { M: 0, F: 0 };
      }
      entry.ageSexBreakdown[r.age_band][r.sex === 'M' ? 'M' : 'F'] += cnt;
    }

    return {
      title: 'Section A: OPD Diagnoses',
      diagnosisByChapter: [...chapterMap.values()].sort((a, b) => b.totalCount - a.totalCount),
      top20Diagnoses,
    };
  }

  /**
   * Section B: Laboratory – tests by category with positive / negative counts.
   */
  private async hmis105SectionB(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    // Tests performed grouped by test category
    const catSql = `
      SELECT
        lt.category,
        COUNT(DISTINCT ls.id) AS total_samples,
        COUNT(lr.id)          AS total_results,
        COUNT(lr.id) FILTER (WHERE lr.abnormal_flag != 'NORMAL') AS positive_abnormal,
        COUNT(lr.id) FILTER (WHERE lr.abnormal_flag  = 'NORMAL') AS negative_normal
      FROM lab_samples ls
      JOIN lab_tests   lt ON lt.id = ls.lab_test_id
      LEFT JOIN lab_results lr ON lr.sample_id = ls.id AND lr.deleted_at IS NULL
      WHERE ls.facility_id = $1
        AND ls.created_at >= $2
        AND ls.created_at <  $3
        AND ls.deleted_at IS NULL
        AND ls.tenant_id = $4
      GROUP BY lt.category
      ORDER BY total_samples DESC`;

    const byCategory = await this.encounterRepo.query(catSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionB lab by category failed: ' + err.message);
      return [];
    });

    // Totals
    const totSql = `
      SELECT
        COUNT(DISTINCT ls.id) AS total_samples,
        COUNT(lr.id)          AS total_results
      FROM lab_samples ls
      LEFT JOIN lab_results lr ON lr.sample_id = ls.id AND lr.deleted_at IS NULL
      WHERE ls.facility_id = $1
        AND ls.created_at >= $2
        AND ls.created_at <  $3
        AND ls.deleted_at IS NULL
        AND ls.tenant_id = $4`;

    const totals = await this.encounterRepo.query(totSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionB lab totals failed: ' + err.message);
      return [{ total_samples: 0, total_results: 0 }];
    });

    return {
      title: 'Section B: Laboratory',
      byCategory: byCategory.map((r: any) => ({
        category: r.category,
        totalSamples: parseInt(r.total_samples, 10) || 0,
        totalResults: parseInt(r.total_results, 10) || 0,
        positiveAbnormal: parseInt(r.positive_abnormal, 10) || 0,
        negativeNormal: parseInt(r.negative_normal, 10) || 0,
      })),
      totalSamples: parseInt(totals[0]?.total_samples, 10) || 0,
      totalResults: parseInt(totals[0]?.total_results, 10) || 0,
    };
  }

  /**
   * Section C: Pharmacy / Dispensing – top medicines, prescriptions filled,
   * and stock-out days.
   */
  private async hmis105SectionC(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    // Top 20 dispensed medicines by quantity
    const medSql = `
      SELECT
        pi.drug_name,
        pi.drug_code,
        SUM(pi.quantity_dispensed) AS total_dispensed
      FROM prescription_items pi
      JOIN prescriptions p ON p.id = pi.prescription_id
      JOIN encounters e    ON e.id = p.encounter_id
      WHERE e.facility_id = $1
        AND p.created_at >= $2
        AND p.created_at <  $3
        AND pi.is_dispensed = true
        AND p.deleted_at IS NULL
        AND pi.deleted_at IS NULL
        AND p.tenant_id = $4
      GROUP BY pi.drug_name, pi.drug_code
      ORDER BY total_dispensed DESC
      LIMIT 20`;

    const topMedicines = await this.encounterRepo.query(medSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionC top medicines failed: ' + err.message);
      return [];
    });

    // Total prescriptions filled
    const rxSql = `
      SELECT
        COUNT(*) FILTER (WHERE p.status IN ('DISPENSED','PARTIALLY_DISPENSED','COLLECTED')) AS filled,
        COUNT(*) AS total
      FROM prescriptions p
      JOIN encounters e ON e.id = p.encounter_id
      WHERE e.facility_id = $1
        AND p.created_at >= $2
        AND p.created_at <  $3
        AND p.deleted_at IS NULL
        AND p.tenant_id = $4`;

    const rxTotals = await this.encounterRepo.query(rxSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionC prescription totals failed: ' + err.message);
      return [{ filled: 0, total: 0 }];
    });

    // Stock-out days: count days with zero balance_after on SALE movements
    const soSql = `
      SELECT
        i.name AS item_name,
        COUNT(DISTINCT DATE(sl.created_at)) AS stockout_days
      FROM stock_ledger sl
      JOIN items i ON i.id = sl.item_id
      WHERE sl.facility_id = $1
        AND sl.created_at >= $2
        AND sl.created_at <  $3
        AND sl.balance_after = 0
        AND i.is_drug = true
        AND sl.deleted_at IS NULL
        AND sl.tenant_id = $4
      GROUP BY i.name
      ORDER BY stockout_days DESC
      LIMIT 20`;

    const stockOuts = await this.encounterRepo.query(soSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionC stock-out days failed: ' + err.message);
      return [];
    });

    return {
      title: 'Section C: Pharmacy / Dispensing',
      top20Medicines: topMedicines.map((r: any) => ({
        drugName: r.drug_name,
        drugCode: r.drug_code,
        totalDispensed: parseInt(r.total_dispensed, 10) || 0,
      })),
      prescriptionsFilled: parseInt(rxTotals[0]?.filled, 10) || 0,
      prescriptionsTotal: parseInt(rxTotals[0]?.total, 10) || 0,
      stockOutItems: stockOuts.map((r: any) => ({
        itemName: r.item_name,
        stockoutDays: parseInt(r.stockout_days, 10) || 0,
      })),
    };
  }

  /**
   * Section D: Maternal Health – ANC visits, deliveries, birth outcomes.
   * NOTE: Maternity tables (antenatal_visits, antenatal_registrations,
   * labour_records, delivery_outcomes) do not have tenant_id columns.
   * Tenant isolation relies on facility_id filtering only.
   * tenantId is accepted for API consistency but cannot be applied to these queries.
   */
  private async hmis105SectionD(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    // Validate tenant context even though maternity tables lack tenant_id columns
    requireTenantId(tenantId);
    // ANC visits (first vs return) – maternity tables have no tenant_id column
    const ancParams: any[] = [facilityId, startDate, endDate];
    const ancSql = `
      SELECT
        COUNT(*) FILTER (WHERE av.visit_number = 1) AS anc_first_visits,
        COUNT(*) FILTER (WHERE av.visit_number > 1) AS anc_return_visits,
        COUNT(*) AS anc_total_visits
      FROM antenatal_visits av
      JOIN antenatal_registrations ar ON ar.id = av.registration_id
      WHERE ar.facility_id = $1
        AND av.visit_date >= $2
        AND av.visit_date <  $3`;

    const ancData = await this.encounterRepo.query(ancSql, ancParams).catch((err) => {
      this.logger.warn('HMIS105 SectionD ANC visits failed: ' + err.message);
      return [{ anc_first_visits: 0, anc_return_visits: 0, anc_total_visits: 0 }];
    });

    // Deliveries by mode
    const delParams: any[] = [facilityId, startDate, endDate];
    const delSql = `
      SELECT
        lr.delivery_mode,
        COUNT(*) AS count
      FROM labour_records lr
      WHERE lr.facility_id = $1
        AND lr.delivery_time >= $2
        AND lr.delivery_time <  $3
        AND lr.delivery_time IS NOT NULL
      GROUP BY lr.delivery_mode`;

    const deliveries = await this.encounterRepo.query(delSql, delParams).catch((err) => {
      this.logger.warn('HMIS105 SectionD deliveries failed: ' + err.message);
      return [];
    });

    const deliverySummary: Record<string, number> = {
      svd: 0,
      assisted: 0,
      caesarean: 0,
      breech: 0,
      total: 0,
    };
    for (const r of deliveries) {
      const cnt = parseInt(r.count, 10) || 0;
      deliverySummary[r.delivery_mode] = cnt;
      deliverySummary.total += cnt;
    }

    // Birth outcomes
    const outParams: any[] = [facilityId, startDate, endDate];
    const outSql = `
      SELECT
        dout.outcome,
        COUNT(*) AS count
      FROM delivery_outcomes dout
      JOIN labour_records lr ON lr.id = dout.labour_record_id
      WHERE lr.facility_id = $1
        AND dout.time_of_birth >= $2
        AND dout.time_of_birth <  $3
      GROUP BY dout.outcome`;

    const outcomes = await this.encounterRepo.query(outSql, outParams).catch((err) => {
      this.logger.warn('HMIS105 SectionD birth outcomes failed: ' + err.message);
      return [];
    });

    const birthOutcomes: Record<string, number> = {
      live_birth: 0,
      stillbirth: 0,
      neonatal_death: 0,
      total: 0,
    };
    for (const r of outcomes) {
      const cnt = parseInt(r.count, 10) || 0;
      birthOutcomes[r.outcome] = cnt;
      birthOutcomes.total += cnt;
    }

    return {
      title: 'Section D: Maternal Health',
      ancFirstVisits: parseInt(ancData[0]?.anc_first_visits, 10) || 0,
      ancReturnVisits: parseInt(ancData[0]?.anc_return_visits, 10) || 0,
      ancTotalVisits: parseInt(ancData[0]?.anc_total_visits, 10) || 0,
      deliveries: deliverySummary,
      birthOutcomes,
    };
  }

  /**
   * Section E: Summary Statistics – attendance, admissions, discharges,
   * deaths, referrals.
   */
  private async hmis105SectionE(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    // OPD attendance (new encounters = first for that patient in month, rest = return)
    const opdSql = `
      SELECT
        COUNT(*) AS total_opd,
        COUNT(*) FILTER (WHERE e.type = 'OPD') AS opd_visits,
        COUNT(*) FILTER (WHERE rn = 1) AS new_visits,
        COUNT(*) FILTER (WHERE rn > 1) AS return_visits
      FROM (
        SELECT
          e.id,
          e.type,
          ROW_NUMBER() OVER (PARTITION BY e.patient_id ORDER BY e.created_at) AS rn
        FROM encounters e
        WHERE e.facility_id = $1
          AND e.created_at >= $2
          AND e.created_at <  $3
          AND e.status != 'CANCELLED'
          AND e.deleted_at IS NULL
          AND e.tenant_id = $4
      ) e`;

    const opdData = await this.encounterRepo.query(opdSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionE OPD attendance failed: ' + err.message);
      return [{ total_opd: 0, opd_visits: 0, new_visits: 0, return_visits: 0 }];
    });

    // Admissions, discharges, deaths
    const admSql = `
      SELECT
        COUNT(*) FILTER (WHERE a.admission_date >= $2 AND a.admission_date < $3) AS admissions,
        COUNT(*) FILTER (WHERE a.discharge_date >= $2 AND a.discharge_date < $3 AND a.status = 'DISCHARGED') AS discharges,
        COUNT(*) FILTER (WHERE a.discharge_date >= $2 AND a.discharge_date < $3 AND a.status = 'DECEASED')   AS deaths
      FROM admissions a
      JOIN encounters e ON e.id = a.encounter_id
      WHERE e.facility_id = $1
        AND a.deleted_at IS NULL
        AND (
          (a.admission_date >= $2 AND a.admission_date < $3)
          OR (a.discharge_date >= $2 AND a.discharge_date < $3)
        )
        AND a.tenant_id = $4`;

    const admData = await this.admissionRepo.query(admSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionE admissions failed: ' + err.message);
      return [{ admissions: 0, discharges: 0, deaths: 0 }];
    });

    // Referrals out
    const refSql = `
      SELECT COUNT(*) AS referrals_out
      FROM referrals r
      WHERE r.from_facility_id = $1
        AND r.created_at >= $2
        AND r.created_at <  $3
        AND r.deleted_at IS NULL
        AND r.tenant_id = $4`;

    const refData = await this.encounterRepo.query(refSql, [facilityId, startDate, endDate, tid]).catch((err) => {
      this.logger.warn('HMIS105 SectionE referrals failed: ' + err.message);
      return [{ referrals_out: 0 }];
    });

    return {
      title: 'Section E: Summary Statistics',
      totalOPDAttendance: parseInt(opdData[0]?.total_opd, 10) || 0,
      opdVisits: parseInt(opdData[0]?.opd_visits, 10) || 0,
      newVisits: parseInt(opdData[0]?.new_visits, 10) || 0,
      returnVisits: parseInt(opdData[0]?.return_visits, 10) || 0,
      totalAdmissions: parseInt(admData[0]?.admissions, 10) || 0,
      totalDischarges: parseInt(admData[0]?.discharges, 10) || 0,
      deaths: parseInt(admData[0]?.deaths, 10) || 0,
      referralsOut: parseInt(refData[0]?.referrals_out, 10) || 0,
    };
  }
}
