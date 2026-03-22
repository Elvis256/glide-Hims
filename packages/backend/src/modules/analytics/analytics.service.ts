import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Invoice, Payment } from '../../database/entities/invoice.entity';
import { Order } from '../../database/entities/order.entity';
import { Admission } from '../../database/entities/admission.entity';
import { EmergencyCase } from '../../database/entities/emergency-case.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Item, StockBalance, StockLedger } from '../../database/entities/inventory.entity';
import { LabResult, AbnormalFlag, ResultStatus } from '../../database/entities/lab-result.entity';

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
  ) {}

  // Executive Dashboard KPIs
  async getExecutiveDashboard(facilityId: string, tenantId?: string) {
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
      tenantId ? this.patientRepo.count({ where: { tenantId } }) : this.patientRepo.count(),
      this.countPatientsSince(today, tenantId),
      this.countPatientsSince(monthStart, tenantId),
      this.countEncountersSince(facilityId, today, tenantId),
      this.countEncountersSince(facilityId, monthStart, tenantId),
      this.getRevenueSum(facilityId, today, tenantId),
      this.getRevenueSum(facilityId, monthStart, tenantId),
      this.getRevenueSum(facilityId, yearStart, tenantId),
      this.getCollectionsSum(facilityId, monthStart, tenantId),
      this.getOutstandingBalance(facilityId, tenantId),
      this.countActiveAdmissions(facilityId, tenantId),
      this.countEmergenciesSince(facilityId, today, tenantId),
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
  async getPatientAnalytics(facilityId: string, period: 'day' | 'week' | 'month' | 'year' = 'month', tenantId?: string) {
    const { startDate, groupBy } = this.getPeriodParams(period);
    const validGroupBy = ['hour', 'day', 'week', 'month', 'year'].includes(groupBy) ? groupBy : 'day';

    // Registration trend
    const regParams: any[] = [startDate];
    let regSql = `
      SELECT 
        DATE_TRUNC('${validGroupBy}', created_at) as period,
        COUNT(*) as count
      FROM patients
      WHERE created_at >= $1`;
    if (tenantId) {
      regSql += ` AND tenant_id = $${regParams.length + 1}`;
      regParams.push(tenantId);
    }
    regSql += `
      GROUP BY DATE_TRUNC('${validGroupBy}', created_at)
      ORDER BY period`;
    const registrationTrend = await this.patientRepo.query(regSql, regParams);

    // Gender distribution
    const genderParams: any[] = [];
    let genderSql = `SELECT gender, COUNT(*) as count FROM patients`;
    if (tenantId) {
      genderSql += ` WHERE tenant_id = $${genderParams.length + 1}`;
      genderParams.push(tenantId);
    }
    genderSql += ` GROUP BY gender`;
    const genderDistribution = await this.patientRepo.query(genderSql, genderParams);

    // Age distribution
    const ageParams: any[] = [];
    let ageSql = `
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
      WHERE date_of_birth IS NOT NULL`;
    if (tenantId) {
      ageSql += ` AND tenant_id = $${ageParams.length + 1}`;
      ageParams.push(tenantId);
    }
    ageSql += `
      GROUP BY age_group
      ORDER BY age_group`;
    const ageDistribution = await this.patientRepo.query(ageSql, ageParams);

    // Blood group distribution
    const bloodParams: any[] = [];
    let bloodSql = `
      SELECT
        COALESCE(blood_group, 'Unknown') as blood_group,
        COUNT(*) as count
      FROM patients
      WHERE deleted_at IS NULL`;
    if (tenantId) {
      bloodSql += ` AND tenant_id = $${bloodParams.length + 1}`;
      bloodParams.push(tenantId);
    }
    bloodSql += `
      GROUP BY blood_group
      ORDER BY count DESC`;
    const bloodGroupDistribution = await this.patientRepo.query(bloodSql, bloodParams);

    return {
      registrationTrend,
      genderDistribution,
      ageDistribution,
      bloodGroupDistribution,
    };
  }

  // Clinical Analytics
  async getClinicalAnalytics(facilityId: string, period: 'day' | 'week' | 'month' | 'year' = 'month', tenantId?: string) {
    const { startDate, groupBy } = this.getPeriodParams(period);
    const validGroupBy = ['hour', 'day', 'week', 'month', 'year'].includes(groupBy) ? groupBy : 'day';

    // Encounter volume trend
    const encTrendParams: any[] = [facilityId, startDate];
    let encTrendSql = `
      SELECT 
        DATE_TRUNC('${validGroupBy}', created_at) as period,
        type as encounter_type,
        COUNT(*) as count
      FROM encounters
      WHERE facility_id = $1 AND created_at >= $2`;
    if (tenantId) {
      encTrendSql += ` AND tenant_id = $${encTrendParams.length + 1}`;
      encTrendParams.push(tenantId);
    }
    encTrendSql += `
      GROUP BY DATE_TRUNC('${validGroupBy}', created_at), type
      ORDER BY period`;
    const encounterTrend = await this.encounterRepo.query(encTrendSql, encTrendParams);

    // Top diagnoses from clinical_notes JSON
    const diagParams: any[] = [facilityId, startDate];
    let diagSql = `
      SELECT 
        d->>'description' as diagnosis,
        d->>'code' as code,
        COUNT(*) as count
      FROM clinical_notes cn
      JOIN encounters e ON e.id = cn.encounter_id,
        jsonb_array_elements(cn.diagnoses::jsonb) AS d
      WHERE e.facility_id = $1 AND cn.created_at >= $2 AND cn.diagnoses IS NOT NULL`;
    if (tenantId) {
      diagSql += ` AND e.tenant_id = $${diagParams.length + 1}`;
      diagParams.push(tenantId);
    }
    diagSql += `
      GROUP BY d->>'description', d->>'code'
      ORDER BY count DESC
      LIMIT 10`;
    const topDiagnoses = await this.encounterRepo.query(diagSql, diagParams);

    // Encounter by type
    const encTypeParams: any[] = [facilityId, startDate];
    let encTypeSql = `
      SELECT 
        type as encounter_type,
        COUNT(*) as count
      FROM encounters
      WHERE facility_id = $1 AND created_at >= $2`;
    if (tenantId) {
      encTypeSql += ` AND tenant_id = $${encTypeParams.length + 1}`;
      encTypeParams.push(tenantId);
    }
    encTypeSql += ` GROUP BY type`;
    const encountersByType = await this.encounterRepo.query(encTypeSql, encTypeParams);

    return {
      encounterTrend,
      topDiagnoses,
      encountersByType,
    };
  }

  // Financial Analytics
  async getFinancialAnalytics(facilityId: string, period: 'day' | 'week' | 'month' | 'year' = 'month', tenantId?: string) {
    const { startDate, groupBy } = this.getPeriodParams(period);
    const validGroupBy = ['hour', 'day', 'week', 'month', 'year'].includes(groupBy) ? groupBy : 'day';

    // Revenue trend
    const revTrendParams: any[] = [facilityId, startDate];
    let revTrendSql = `
      SELECT 
        DATE_TRUNC('${validGroupBy}', i.created_at) as period,
        SUM(i.total_amount) as revenue,
        COUNT(*) as invoice_count
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND i.created_at >= $2 AND i.status != 'cancelled' AND i.deleted_at IS NULL`;
    if (tenantId) {
      revTrendSql += ` AND i.tenant_id = $${revTrendParams.length + 1}`;
      revTrendParams.push(tenantId);
    }
    revTrendSql += `
      GROUP BY DATE_TRUNC('${validGroupBy}', i.created_at)
      ORDER BY period`;
    const revenueTrend = await this.invoiceRepo.query(revTrendSql, revTrendParams).catch((err) => { this.logger.warn('Analytics query failed: ' + err.message); return []; });

    // Collections trend
    const collTrendParams: any[] = [facilityId, startDate];
    let collTrendSql = `
      SELECT 
        DATE_TRUNC('${validGroupBy}', p.created_at) as period,
        SUM(p.amount) as collections,
        p.method as payment_method,
        COUNT(*) as payment_count
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND p.created_at >= $2 AND p.deleted_at IS NULL`;
    if (tenantId) {
      collTrendSql += ` AND p.tenant_id = $${collTrendParams.length + 1}`;
      collTrendParams.push(tenantId);
    }
    collTrendSql += `
      GROUP BY DATE_TRUNC('${validGroupBy}', p.created_at), p.method
      ORDER BY period`;
    const collectionsTrend = await this.paymentRepo.query(collTrendSql, collTrendParams).catch((err) => { this.logger.warn('Analytics query failed: ' + err.message); return []; });

    // Revenue by department/service
    const revDeptParams: any[] = [facilityId, startDate];
    let revDeptSql = `
      SELECT 
        COALESCE(INITCAP(e.type::text), 'General') as department,
        SUM(i.total_amount) as revenue,
        COUNT(*) as count
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND i.created_at >= $2 AND i.status != 'cancelled' AND i.deleted_at IS NULL`;
    if (tenantId) {
      revDeptSql += ` AND i.tenant_id = $${revDeptParams.length + 1}`;
      revDeptParams.push(tenantId);
    }
    revDeptSql += `
      GROUP BY e.type
      ORDER BY revenue DESC`;
    const revenueByDepartment = await this.invoiceRepo.query(revDeptSql, revDeptParams).catch((err) => { this.logger.warn('Analytics query failed: ' + err.message); return []; });

    // Payment methods distribution
    const payMethodParams: any[] = [facilityId, startDate];
    let payMethodSql = `
      SELECT 
        p.method as payment_method,
        SUM(p.amount) as total,
        COUNT(*) as count
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND p.created_at >= $2 AND p.deleted_at IS NULL`;
    if (tenantId) {
      payMethodSql += ` AND p.tenant_id = $${payMethodParams.length + 1}`;
      payMethodParams.push(tenantId);
    }
    payMethodSql += ` GROUP BY p.method`;
    const paymentMethods = await this.paymentRepo.query(payMethodSql, payMethodParams).catch((err) => { this.logger.warn('Analytics query failed: ' + err.message); return []; });

    // Outstanding by age
    const outAgeParams: any[] = [facilityId];
    let outAgeSql = `
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
        AND i.status NOT IN ('paid', 'cancelled') AND i.balance_due > 0 AND i.deleted_at IS NULL`;
    if (tenantId) {
      outAgeSql += ` AND i.tenant_id = $${outAgeParams.length + 1}`;
      outAgeParams.push(tenantId);
    }
    outAgeSql += ` GROUP BY age_bucket`;
    const outstandingByAge = await this.invoiceRepo.query(outAgeSql, outAgeParams).catch((err) => { this.logger.warn('Analytics query failed: ' + err.message); return []; });

    // Recent transactions
    const recentTxParams: any[] = [facilityId, startDate];
    let recentTxSql = `
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
        AND i.deleted_at IS NULL AND i.created_at >= $2`;
    if (tenantId) {
      recentTxSql += ` AND i.tenant_id = $${recentTxParams.length + 1}`;
      recentTxParams.push(tenantId);
    }
    recentTxSql += `
      ORDER BY i.created_at DESC
      LIMIT 20`;
    const recentTransactions = await this.invoiceRepo.query(recentTxSql, recentTxParams).catch((err) => { this.logger.warn('Analytics query failed: ' + err.message); return []; });

    // Collections total for the period
    const collTotalParams: any[] = [facilityId, startDate];
    let collTotalSql = `
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND p.created_at >= $2 AND p.deleted_at IS NULL`;
    if (tenantId) {
      collTotalSql += ` AND p.tenant_id = $${collTotalParams.length + 1}`;
      collTotalParams.push(tenantId);
    }
    const collectionsTotal = await this.paymentRepo.query(collTotalSql, collTotalParams).catch((err) => { this.logger.warn('Analytics query failed: ' + err.message); return [{ total: 0 }]; });

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
    // Bed occupancy - wards uses camelCase column
    const bedParams: any[] = [facilityId];
    let bedSql = `
      SELECT 
        w.name as ward,
        COUNT(CASE WHEN a.status = 'admitted' THEN 1 END) as occupied,
        w."totalBeds" as total,
        ROUND(COUNT(CASE WHEN a.status = 'admitted' THEN 1 END) * 100.0 / NULLIF(w."totalBeds", 0), 1) as occupancy_rate
      FROM wards w
      LEFT JOIN beds b ON b."wardId" = w.id
      LEFT JOIN admissions a ON a."bedId" = b.id AND a.status = 'admitted'
      WHERE w."facilityId" = $1`;
    if (tenantId) {
      bedSql += ` AND w.tenant_id = $${bedParams.length + 1}`;
      bedParams.push(tenantId);
    }
    bedSql += ` GROUP BY w.id, w.name, w."totalBeds"`;
    const bedOccupancy = await this.admissionRepo.query(bedSql, bedParams);

    // Lab turnaround time - join orders through encounter for facility filter
    const labTATParams: any[] = [facilityId];
    let labTATSql = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at))/3600) as avg_tat_hours,
        COUNT(*) as total_tests,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_tests
      FROM orders o
      JOIN encounters e ON e.id = o.encounter_id
      WHERE e.facility_id = $1 AND o.order_type = 'lab' AND o.created_at >= NOW() - INTERVAL '30 days'`;
    if (tenantId) {
      labTATSql += ` AND o.tenant_id = $${labTATParams.length + 1}`;
      labTATParams.push(tenantId);
    }
    const labTAT = await this.orderRepo.query(labTATSql, labTATParams);

    // Average length of stay - join through encounter
    const losParams: any[] = [facilityId];
    let losSql = `
      SELECT 
        AVG(EXTRACT(DAY FROM (a."dischargeDate" - a."admissionDate"))) as avg_los_days
      FROM admissions a
      JOIN encounters e ON e.id = a."encounterId"
      WHERE e.facility_id = $1 
        AND a.status = 'discharged' 
        AND a."dischargeDate" IS NOT NULL
        AND a."admissionDate" >= NOW() - INTERVAL '90 days'`;
    if (tenantId) {
      losSql += ` AND a.tenant_id = $${losParams.length + 1}`;
      losParams.push(tenantId);
    }
    const avgLOS = await this.admissionRepo.query(losSql, losParams);

    // Emergency response
    const emParams: any[] = [facilityId];
    let emSql = `
      SELECT 
        triage_level,
        COUNT(*) as count
      FROM emergency_cases
      WHERE facility_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`;
    if (tenantId) {
      emSql += ` AND tenant_id = $${emParams.length + 1}`;
      emParams.push(tenantId);
    }
    emSql += ` GROUP BY triage_level`;
    const emergencyMetrics = await this.emergencyRepo.query(emSql, emParams);

    return {
      bedOccupancy,
      labTAT: labTAT[0] || {},
      avgLengthOfStay: avgLOS[0]?.avg_los_days || null,
      emergencyMetrics,
    };
  }

  // Summary report for a date range
  async getSummaryReport(facilityId: string, startDate: Date, endDate: Date, tenantId?: string) {
    const [
      patientStats,
      encounterStats,
      revenueStats,
      admissionStats,
    ] = await Promise.all([
      (() => {
        const params: any[] = [startDate, endDate];
        let sql = `
          SELECT 
            COUNT(*) as new_patients
          FROM patients
          WHERE created_at BETWEEN $1 AND $2`;
        if (tenantId) {
          sql += ` AND tenant_id = $${params.length + 1}`;
          params.push(tenantId);
        }
        return this.patientRepo.query(sql, params);
      })(),
      
      (() => {
        const params: any[] = [facilityId, startDate, endDate];
        let sql = `
          SELECT 
            type as encounter_type,
            COUNT(*) as count
          FROM encounters
          WHERE facility_id = $1 AND created_at BETWEEN $2 AND $3`;
        if (tenantId) {
          sql += ` AND tenant_id = $${params.length + 1}`;
          params.push(tenantId);
        }
        sql += ` GROUP BY type`;
        return this.encounterRepo.query(sql, params);
      })(),
      
      (() => {
        const params: any[] = [facilityId, startDate, endDate];
        let sql = `
          SELECT 
            SUM(i.total_amount) as total_billed,
            SUM(i.amount_paid) as total_collected,
            COUNT(*) as invoice_count
          FROM invoices i
          JOIN encounters e ON e.id = i.encounter_id
          WHERE e.facility_id = $1 AND i.created_at BETWEEN $2 AND $3`;
        if (tenantId) {
          sql += ` AND i.tenant_id = $${params.length + 1}`;
          params.push(tenantId);
        }
        return this.invoiceRepo.query(sql, params);
      })(),
      
      (() => {
        const params: any[] = [facilityId, startDate, endDate];
        let sql = `
          SELECT 
            COUNT(*) as total_admissions,
            COUNT(CASE WHEN a.status = 'discharged' THEN 1 END) as discharges
          FROM admissions a
          JOIN encounters e ON e.id = a."encounterId"
          WHERE e.facility_id = $1 AND a."admissionDate" BETWEEN $2 AND $3`;
        if (tenantId) {
          sql += ` AND a.tenant_id = $${params.length + 1}`;
          params.push(tenantId);
        }
        return this.admissionRepo.query(sql, params);
      })(),
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
    const tenantFilter = tenantId ? ' AND tenant_id = $2' : '';
    const params = tenantId ? [since, tenantId] : [since];
    const result = await this.patientRepo.query(`
      SELECT COUNT(*) as count FROM patients WHERE created_at >= $1${tenantFilter}
    `, params);
    return parseInt(result[0]?.count || 0);
  }

  private async countActiveAdmissions(facilityId: string, tenantId?: string): Promise<number> {
    const params: any[] = [facilityId];
    let sql = `
      SELECT COUNT(*) as count 
      FROM admissions a
      JOIN encounters e ON e.id = a."encounterId"
      WHERE e.facility_id = $1 AND a.status = 'admitted'`;
    if (tenantId) {
      sql += ` AND a.tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }
    const result = await this.admissionRepo.query(sql, params);
    return parseInt(result[0]?.count || 0);
  }

  private async countEncountersSince(facilityId: string, since: Date, tenantId?: string): Promise<number> {
    const params: any[] = [facilityId, since];
    let sql = `SELECT COUNT(*) as count FROM encounters WHERE facility_id = $1 AND created_at >= $2`;
    if (tenantId) {
      sql += ` AND tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }
    const result = await this.encounterRepo.query(sql, params);
    return parseInt(result[0]?.count || 0);
  }

  private async countEmergenciesSince(facilityId: string, since: Date, tenantId?: string): Promise<number> {
    const params: any[] = [facilityId, since];
    let sql = `SELECT COUNT(*) as count FROM emergency_cases WHERE facility_id = $1 AND created_at >= $2`;
    if (tenantId) {
      sql += ` AND tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }
    const result = await this.emergencyRepo.query(sql, params);
    return parseInt(result[0]?.count || 0);
  }

  private async getRevenueSum(facilityId: string, since: Date, tenantId?: string): Promise<number> {
    const params: any[] = [facilityId, since];
    let sql = `
      SELECT COALESCE(SUM(i.total_amount), 0) as total
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND i.created_at >= $2 AND i.status != 'cancelled' AND i.deleted_at IS NULL`;
    if (tenantId) {
      sql += ` AND i.tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }
    const result = await this.invoiceRepo.query(sql, params);
    return parseFloat(result[0]?.total || 0);
  }

  private async getCollectionsSum(facilityId: string, since: Date, tenantId?: string): Promise<number> {
    const params: any[] = [facilityId, since];
    let sql = `
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND p.created_at >= $2 AND p.deleted_at IS NULL`;
    if (tenantId) {
      sql += ` AND p.tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }
    const result = await this.paymentRepo.query(sql, params);
    return parseFloat(result[0]?.total || 0);
  }

  private async getOutstandingBalance(facilityId: string, tenantId?: string): Promise<number> {
    const params: any[] = [facilityId];
    let sql = `
      SELECT COALESCE(SUM(i.balance_due), 0) as outstanding
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1)
        AND i.status NOT IN ('paid', 'cancelled') AND i.deleted_at IS NULL`;
    if (tenantId) {
      sql += ` AND i.tenant_id = $${params.length + 1}`;
      params.push(tenantId);
    }
    const result = await this.invoiceRepo.query(sql, params);
    return parseFloat(result[0]?.outstanding || 0);
  }

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

    return { startDate, groupBy };
  }

  // Recent Activity - fetch real activities from various sources
  async getRecentActivity(facilityId: string, limit = 10, tenantId?: string) {
    const activities: Array<{
      type: string;
      title: string;
      description: string;
      timestamp: Date;
      icon: string;
    }> = [];

    // Get recent patient registrations (tenant-scoped)
    const patientWhere: any = {};
    if (tenantId) patientWhere.tenantId = tenantId;
    const recentPatients = await this.patientRepo.find({
      where: patientWhere,
      order: { createdAt: 'DESC' },
      take: 3,
      select: ['id', 'fullName', 'mrn', 'createdAt'],
    });
    recentPatients.forEach(p => {
      activities.push({
        type: 'registration',
        title: 'New patient registered',
        description: `${p.fullName} (${p.mrn})`,
        timestamp: p.createdAt,
        icon: 'user-plus',
      });
    });

    // Get recent completed encounters
    const encounterWhere: any = { facilityId, status: 'completed' as any };
    if (tenantId) encounterWhere.tenantId = tenantId;
    const recentEncounters = await this.encounterRepo.find({
      where: encounterWhere,
      order: { updatedAt: 'DESC' },
      take: 3,
      relations: ['patient'],
    });
    recentEncounters.forEach(e => {
      activities.push({
        type: 'consultation',
        title: 'Consultation completed',
        description: `${e.patient?.fullName || 'Patient'} - ${e.type || 'OPD'}`,
        timestamp: e.updatedAt,
        icon: 'stethoscope',
      });
    });

    // Get recent lab results (via sample -> patient)
    const labResultWhere: any = { status: 'validated' as any };
    if (tenantId) labResultWhere.tenantId = tenantId;
    const recentLabResults = await this.labResultRepo.find({
      where: labResultWhere,
      order: { updatedAt: 'DESC' },
      take: 3,
      relations: ['sample', 'sample.patient', 'sample.labTest'],
    });
    recentLabResults.forEach(r => {
      activities.push({
        type: 'lab',
        title: 'Lab results ready',
        description: `${r.sample?.patient?.fullName || 'Patient'} - ${r.sample?.labTest?.name || r.parameter || 'Test'}`,
        timestamp: r.updatedAt,
        icon: 'flask',
      });
    });

    // Get recent payments
    const paymentWhere: any = {};
    if (tenantId) paymentWhere.tenantId = tenantId;
    const recentPayments = await this.paymentRepo.find({
      where: paymentWhere,
      order: { createdAt: 'DESC' },
      take: 3,
      relations: ['invoice', 'invoice.encounter', 'invoice.encounter.patient'],
    });
    recentPayments.forEach(p => {
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
    const alerts: Array<{
      type: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      count?: number;
    }> = [];

    // Check for critical lab results (abnormal flag)
    const criticalLabResults = await this.labResultRepo.count({
      where: { abnormalFlag: In([AbnormalFlag.CRITICAL_LOW, AbnormalFlag.CRITICAL_HIGH]), ...(tenantId ? { tenantId } : {}) },
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
      .andWhere('item.reorder_level > 0');
    if (tenantId) lowStockQb.andWhere('sb.tenant_id = :tenantId', { tenantId });
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
      where: { status: ResultStatus.ENTERED, ...(tenantId ? { tenantId } : {}) },
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
      .andWhere('invoice.created_at < :date', { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) });
    if (tenantId) overdueQb.andWhere('invoice.tenant_id = :tenantId', { tenantId });
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

    const qb = this.admissionRepo.createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'patient')
      .leftJoinAndSelect('a.ward', 'ward')
      .where('a.status = :status', { status: 'deceased' })
      .andWhere('a.dischargeDate >= :startDate', { startDate });

    if (tenantId) {
      qb.andWhere('a.tenant_id = :tenantId', { tenantId });
    }

    const deceased = await qb.getMany();

    const totalAdmissionsQb = this.admissionRepo.createQueryBuilder('a')
      .where('a.admissionDate >= :startDate', { startDate });
    if (tenantId) {
      totalAdmissionsQb.andWhere('a.tenant_id = :tenantId', { tenantId });
    }
    const totalAdmissions = await totalAdmissionsQb.getCount();

    const totalDeaths = deceased.length;
    const mortalityRate = totalAdmissions > 0
      ? parseFloat(((totalDeaths / totalAdmissions) * 100).toFixed(2))
      : 0;

    let maleDeaths = 0;
    let femaleDeaths = 0;
    const ageGroups: Record<string, number> = { '0-18': 0, '19-40': 0, '41-60': 0, '61-80': 0, '80+': 0 };
    const causeMap: Record<string, number> = {};
    const ages: number[] = [];

    for (const admission of deceased) {
      const patient = admission.patient;
      if (patient?.gender === 'male') maleDeaths++;
      else femaleDeaths++;

      if (patient?.dateOfBirth) {
        const age = Math.floor((now.getTime() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
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

    const averageAge = ages.length > 0
      ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      : 0;

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

      const deathsInMonth = deceased.filter(a =>
        a.dischargeDate && new Date(a.dischargeDate) >= monthStart && new Date(a.dischargeDate) <= monthEnd,
      ).length;

      const monthlyAdmissionsQb = this.admissionRepo.createQueryBuilder('a')
        .where('a.admissionDate >= :monthStart', { monthStart })
        .andWhere('a.admissionDate <= :monthEnd', { monthEnd });
      if (tenantId) {
        monthlyAdmissionsQb.andWhere('a.tenant_id = :tenantId', { tenantId });
      }
      const monthAdmissions = await monthlyAdmissionsQb.getCount();

      monthlyTrend.push({
        month: monthName,
        deaths: deathsInMonth,
        rate: monthAdmissions > 0 ? parseFloat(((deathsInMonth / monthAdmissions) * 1000).toFixed(2)) : 0, // per 1000 admissions
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
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const [sectionA, sectionB, sectionC, sectionD, sectionE] =
      await Promise.all([
        this.hmis105SectionA(facilityId, startDate, endDate, tenantId),
        this.hmis105SectionB(facilityId, startDate, endDate, tenantId),
        this.hmis105SectionC(facilityId, startDate, endDate, tenantId),
        this.hmis105SectionD(facilityId, startDate, endDate, tenantId),
        this.hmis105SectionE(facilityId, startDate, endDate, tenantId),
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
    // ── Top 20 diagnoses by age band / sex ──
    const topParams: any[] = [facilityId, startDate, endDate];
    let topSql = `
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
        AND cn.deleted_at IS NULL`;
    if (tenantId) {
      topSql += ` AND e.tenant_id = $${topParams.length + 1}`;
      topParams.push(tenantId);
    }
    topSql += `
      GROUP BY d->>'code', d->>'description', age_band, sex
      ORDER BY count DESC`;

    const rawDiagnoses = await this.encounterRepo
      .query(topSql, topParams)
      .catch((err) => {
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
    const grpParams: any[] = [facilityId, startDate, endDate];
    let grpSql = `
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
        AND cn.deleted_at IS NULL`;
    if (tenantId) {
      grpSql += ` AND e.tenant_id = $${grpParams.length + 1}`;
      grpParams.push(tenantId);
    }
    grpSql += `
      GROUP BY chapter_letter, age_band, sex
      ORDER BY chapter_letter`;

    const rawGroups = await this.encounterRepo
      .query(grpSql, grpParams)
      .catch((err) => {
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
      diagnosisByChapter: [...chapterMap.values()].sort(
        (a, b) => b.totalCount - a.totalCount,
      ),
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
    // Tests performed grouped by test category
    const catParams: any[] = [facilityId, startDate, endDate];
    let catSql = `
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
        AND ls.deleted_at IS NULL`;
    if (tenantId) {
      catSql += ` AND ls.tenant_id = $${catParams.length + 1}`;
      catParams.push(tenantId);
    }
    catSql += `
      GROUP BY lt.category
      ORDER BY total_samples DESC`;

    const byCategory = await this.encounterRepo
      .query(catSql, catParams)
      .catch((err) => {
        this.logger.warn('HMIS105 SectionB lab by category failed: ' + err.message);
        return [];
      });

    // Totals
    const totParams: any[] = [facilityId, startDate, endDate];
    let totSql = `
      SELECT
        COUNT(DISTINCT ls.id) AS total_samples,
        COUNT(lr.id)          AS total_results
      FROM lab_samples ls
      LEFT JOIN lab_results lr ON lr.sample_id = ls.id AND lr.deleted_at IS NULL
      WHERE ls.facility_id = $1
        AND ls.created_at >= $2
        AND ls.created_at <  $3
        AND ls.deleted_at IS NULL`;
    if (tenantId) {
      totSql += ` AND ls.tenant_id = $${totParams.length + 1}`;
      totParams.push(tenantId);
    }

    const totals = await this.encounterRepo
      .query(totSql, totParams)
      .catch((err) => {
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
    // Top 20 dispensed medicines by quantity
    const medParams: any[] = [facilityId, startDate, endDate];
    let medSql = `
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
        AND pi.deleted_at IS NULL`;
    if (tenantId) {
      medSql += ` AND p.tenant_id = $${medParams.length + 1}`;
      medParams.push(tenantId);
    }
    medSql += `
      GROUP BY pi.drug_name, pi.drug_code
      ORDER BY total_dispensed DESC
      LIMIT 20`;

    const topMedicines = await this.encounterRepo
      .query(medSql, medParams)
      .catch((err) => {
        this.logger.warn('HMIS105 SectionC top medicines failed: ' + err.message);
        return [];
      });

    // Total prescriptions filled
    const rxParams: any[] = [facilityId, startDate, endDate];
    let rxSql = `
      SELECT
        COUNT(*) FILTER (WHERE p.status IN ('DISPENSED','PARTIALLY_DISPENSED','COLLECTED')) AS filled,
        COUNT(*) AS total
      FROM prescriptions p
      JOIN encounters e ON e.id = p.encounter_id
      WHERE e.facility_id = $1
        AND p.created_at >= $2
        AND p.created_at <  $3
        AND p.deleted_at IS NULL`;
    if (tenantId) {
      rxSql += ` AND p.tenant_id = $${rxParams.length + 1}`;
      rxParams.push(tenantId);
    }

    const rxTotals = await this.encounterRepo
      .query(rxSql, rxParams)
      .catch((err) => {
        this.logger.warn('HMIS105 SectionC prescription totals failed: ' + err.message);
        return [{ filled: 0, total: 0 }];
      });

    // Stock-out days: count days with zero balance_after on SALE movements
    const soParams: any[] = [facilityId, startDate, endDate];
    let soSql = `
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
        AND sl.deleted_at IS NULL`;
    if (tenantId) {
      soSql += ` AND sl.tenant_id = $${soParams.length + 1}`;
      soParams.push(tenantId);
    }
    soSql += `
      GROUP BY i.name
      ORDER BY stockout_days DESC
      LIMIT 20`;

    const stockOuts = await this.encounterRepo
      .query(soSql, soParams)
      .catch((err) => {
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
   */
  private async hmis105SectionD(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    _tenantId?: string,
  ) {
    // ANC visits (first vs return) – maternity tables have no tenant_id
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

    const ancData = await this.encounterRepo
      .query(ancSql, ancParams)
      .catch((err) => {
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

    const deliveries = await this.encounterRepo
      .query(delSql, delParams)
      .catch((err) => {
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

    const outcomes = await this.encounterRepo
      .query(outSql, outParams)
      .catch((err) => {
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
    // OPD attendance (new encounters = first for that patient in month, rest = return)
    const opdParams: any[] = [facilityId, startDate, endDate];
    let opdSql = `
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
          AND e.deleted_at IS NULL`;
    if (tenantId) {
      opdSql += ` AND e.tenant_id = $${opdParams.length + 1}`;
      opdParams.push(tenantId);
    }
    opdSql += `
      ) e`;

    const opdData = await this.encounterRepo
      .query(opdSql, opdParams)
      .catch((err) => {
        this.logger.warn('HMIS105 SectionE OPD attendance failed: ' + err.message);
        return [{ total_opd: 0, opd_visits: 0, new_visits: 0, return_visits: 0 }];
      });

    // Admissions, discharges, deaths
    const admParams: any[] = [facilityId, startDate, endDate];
    let admSql = `
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
        )`;
    if (tenantId) {
      admSql += ` AND a.tenant_id = $${admParams.length + 1}`;
      admParams.push(tenantId);
    }

    const admData = await this.admissionRepo
      .query(admSql, admParams)
      .catch((err) => {
        this.logger.warn('HMIS105 SectionE admissions failed: ' + err.message);
        return [{ admissions: 0, discharges: 0, deaths: 0 }];
      });

    // Referrals out
    const refParams: any[] = [facilityId, startDate, endDate];
    let refSql = `
      SELECT COUNT(*) AS referrals_out
      FROM referrals r
      WHERE r.from_facility_id = $1
        AND r.created_at >= $2
        AND r.created_at <  $3
        AND r.deleted_at IS NULL`;
    if (tenantId) {
      refSql += ` AND r.tenant_id = $${refParams.length + 1}`;
      refParams.push(tenantId);
    }

    const refData = await this.encounterRepo
      .query(refSql, refParams)
      .catch((err) => {
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
