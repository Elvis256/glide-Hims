import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Invoice, Payment } from '../../database/entities/invoice.entity';
import { Order } from '../../database/entities/order.entity';
import { Admission } from '../../database/entities/admission.entity';
import { EmergencyCase } from '../../database/entities/emergency-case.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Item, StockBalance } from '../../database/entities/inventory.entity';
import { LabResult, AbnormalFlag, ResultStatus } from '../../database/entities/lab-result.entity';

@Injectable()
export class AnalyticsService {
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
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
        AND i.created_at >= $2 AND i.status != 'cancelled' AND i.deleted_at IS NULL`;
    if (tenantId) {
      revTrendSql += ` AND i.tenant_id = $${revTrendParams.length + 1}`;
      revTrendParams.push(tenantId);
    }
    revTrendSql += `
      GROUP BY DATE_TRUNC('${validGroupBy}', i.created_at)
      ORDER BY period`;
    const revenueTrend = await this.invoiceRepo.query(revTrendSql, revTrendParams).catch(() => []);

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
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
        AND p.created_at >= $2 AND p.deleted_at IS NULL`;
    if (tenantId) {
      collTrendSql += ` AND p.tenant_id = $${collTrendParams.length + 1}`;
      collTrendParams.push(tenantId);
    }
    collTrendSql += `
      GROUP BY DATE_TRUNC('${validGroupBy}', p.created_at), p.method
      ORDER BY period`;
    const collectionsTrend = await this.paymentRepo.query(collTrendSql, collTrendParams).catch(() => []);

    // Revenue by department/service
    const revDeptParams: any[] = [facilityId, startDate];
    let revDeptSql = `
      SELECT 
        COALESCE(INITCAP(e.type::text), 'General') as department,
        SUM(i.total_amount) as revenue,
        COUNT(*) as count
      FROM invoices i
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
        AND i.created_at >= $2 AND i.status != 'cancelled' AND i.deleted_at IS NULL`;
    if (tenantId) {
      revDeptSql += ` AND i.tenant_id = $${revDeptParams.length + 1}`;
      revDeptParams.push(tenantId);
    }
    revDeptSql += `
      GROUP BY e.type
      ORDER BY revenue DESC`;
    const revenueByDepartment = await this.invoiceRepo.query(revDeptSql, revDeptParams).catch(() => []);

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
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
        AND p.created_at >= $2 AND p.deleted_at IS NULL`;
    if (tenantId) {
      payMethodSql += ` AND p.tenant_id = $${payMethodParams.length + 1}`;
      payMethodParams.push(tenantId);
    }
    payMethodSql += ` GROUP BY p.method`;
    const paymentMethods = await this.paymentRepo.query(payMethodSql, payMethodParams).catch(() => []);

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
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL) 
        AND i.status NOT IN ('paid', 'cancelled') AND i.balance_due > 0 AND i.deleted_at IS NULL`;
    if (tenantId) {
      outAgeSql += ` AND i.tenant_id = $${outAgeParams.length + 1}`;
      outAgeParams.push(tenantId);
    }
    outAgeSql += ` GROUP BY age_bucket`;
    const outstandingByAge = await this.invoiceRepo.query(outAgeSql, outAgeParams).catch(() => []);

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
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
        AND i.deleted_at IS NULL AND i.created_at >= $2`;
    if (tenantId) {
      recentTxSql += ` AND i.tenant_id = $${recentTxParams.length + 1}`;
      recentTxParams.push(tenantId);
    }
    recentTxSql += `
      ORDER BY i.created_at DESC
      LIMIT 20`;
    const recentTransactions = await this.invoiceRepo.query(recentTxSql, recentTxParams).catch(() => []);

    // Collections total for the period
    const collTotalParams: any[] = [facilityId, startDate];
    let collTotalSql = `
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      LEFT JOIN encounters e ON e.id = i.encounter_id
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
        AND p.created_at >= $2 AND p.deleted_at IS NULL`;
    if (tenantId) {
      collTotalSql += ` AND p.tenant_id = $${collTotalParams.length + 1}`;
      collTotalParams.push(tenantId);
    }
    const collectionsTotal = await this.paymentRepo.query(collTotalSql, collTotalParams).catch(() => [{ total: 0 }]);

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
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
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
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
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
      WHERE (e.facility_id = $1 OR e.facility_id IS NULL OR i.encounter_id IS NULL)
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
}
