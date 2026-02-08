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
  async getExecutiveDashboard(facilityId: string) {
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
      this.patientRepo.count(),
      this.countPatientsSince(today),
      this.countPatientsSince(monthStart),
      this.countEncountersSince(facilityId, today),
      this.countEncountersSince(facilityId, monthStart),
      this.getRevenueSum(facilityId, today),
      this.getRevenueSum(facilityId, monthStart),
      this.getRevenueSum(facilityId, yearStart),
      this.getCollectionsSum(facilityId, monthStart),
      this.getOutstandingBalance(facilityId),
      this.countActiveAdmissions(facilityId),
      this.countEmergenciesSince(facilityId, today),
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
  async getPatientAnalytics(facilityId: string, period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const { startDate, groupBy } = this.getPeriodParams(period);

    // Registration trend - patients are global, show all
    const registrationTrend = await this.patientRepo.query(`
      SELECT 
        DATE_TRUNC($1, created_at) as period,
        COUNT(*) as count
      FROM patients
      WHERE created_at >= $2
      GROUP BY DATE_TRUNC($1, created_at)
      ORDER BY period
    `, [groupBy, startDate]);

    // Gender distribution - all patients
    const genderDistribution = await this.patientRepo.query(`
      SELECT gender, COUNT(*) as count
      FROM patients
      GROUP BY gender
    `);

    // Age distribution - all patients
    const ageDistribution = await this.patientRepo.query(`
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
      WHERE date_of_birth IS NOT NULL
      GROUP BY age_group
      ORDER BY age_group
    `);

    return {
      registrationTrend,
      genderDistribution,
      ageDistribution,
    };
  }

  // Clinical Analytics
  async getClinicalAnalytics(facilityId: string, period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const { startDate, groupBy } = this.getPeriodParams(period);

    // Encounter volume trend
    const encounterTrend = await this.encounterRepo.query(`
      SELECT 
        DATE_TRUNC($1, created_at) as period,
        encounter_type,
        COUNT(*) as count
      FROM encounters
      WHERE facility_id = $2 AND created_at >= $3
      GROUP BY DATE_TRUNC($1, created_at), encounter_type
      ORDER BY period
    `, [groupBy, facilityId, startDate]);

    // Top diagnoses
    const topDiagnoses = await this.encounterRepo.query(`
      SELECT 
        diagnosis,
        COUNT(*) as count
      FROM encounters
      WHERE facility_id = $1 AND diagnosis IS NOT NULL AND created_at >= $2
      GROUP BY diagnosis
      ORDER BY count DESC
      LIMIT 10
    `, [facilityId, startDate]);

    // Encounter by type
    const encountersByType = await this.encounterRepo.query(`
      SELECT 
        encounter_type,
        COUNT(*) as count
      FROM encounters
      WHERE facility_id = $1 AND created_at >= $2
      GROUP BY encounter_type
    `, [facilityId, startDate]);

    return {
      encounterTrend,
      topDiagnoses,
      encountersByType,
    };
  }

  // Financial Analytics
  async getFinancialAnalytics(facilityId: string, period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const { startDate, groupBy } = this.getPeriodParams(period);

    // Revenue trend
    const revenueTrend = await this.invoiceRepo.query(`
      SELECT 
        DATE_TRUNC($1, i.created_at) as period,
        SUM(i.total_amount) as revenue,
        COUNT(*) as invoice_count
      FROM invoices i
      JOIN encounters e ON e.id = i.encounter_id
      WHERE e.facility_id = $2 AND i.created_at >= $3
      GROUP BY DATE_TRUNC($1, i.created_at)
      ORDER BY period
    `, [groupBy, facilityId, startDate]);

    // Collections trend
    const collectionsTrend = await this.paymentRepo.query(`
      SELECT 
        DATE_TRUNC($1, p.created_at) as period,
        SUM(p.amount) as collections,
        p.payment_method,
        COUNT(*) as payment_count
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN encounters e ON e.id = i.encounter_id
      WHERE e.facility_id = $2 AND p.created_at >= $3
      GROUP BY DATE_TRUNC($1, p.created_at), p.payment_method
      ORDER BY period
    `, [groupBy, facilityId, startDate]);

    // Revenue by department/service - using encounter type as department proxy
    const revenueByDepartment = await this.invoiceRepo.query(`
      SELECT 
        COALESCE(e.encounter_type, 'General') as department,
        SUM(i.total_amount) as revenue
      FROM invoices i
      JOIN encounters e ON e.id = i.encounter_id
      WHERE e.facility_id = $1 AND i.created_at >= $2
      GROUP BY e.encounter_type
      ORDER BY revenue DESC
    `, [facilityId, startDate]);

    // Payment methods distribution
    const paymentMethods = await this.paymentRepo.query(`
      SELECT 
        p.payment_method,
        SUM(p.amount) as total,
        COUNT(*) as count
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN encounters e ON e.id = i.encounter_id
      WHERE e.facility_id = $1 AND p.created_at >= $2
      GROUP BY p.payment_method
    `, [facilityId, startDate]);

    // Outstanding by age
    const outstandingByAge = await this.invoiceRepo.query(`
      SELECT 
        CASE 
          WHEN i.created_at >= NOW() - INTERVAL '30 days' THEN '0-30 days'
          WHEN i.created_at >= NOW() - INTERVAL '60 days' THEN '31-60 days'
          WHEN i.created_at >= NOW() - INTERVAL '90 days' THEN '61-90 days'
          ELSE '90+ days'
        END as age_bucket,
        SUM(i.balance_due) as outstanding
      FROM invoices i
      JOIN encounters e ON e.id = i.encounter_id
      WHERE e.facility_id = $1 AND i.status != 'paid' AND i.balance_due > 0
      GROUP BY age_bucket
    `, [facilityId]);

    return {
      revenueTrend,
      collectionsTrend,
      revenueByDepartment,
      paymentMethods,
      outstandingByAge,
    };
  }

  // Operational Analytics
  async getOperationalAnalytics(facilityId: string) {
    // Bed occupancy - wards uses camelCase column
    const bedOccupancy = await this.admissionRepo.query(`
      SELECT 
        w.name as ward,
        COUNT(CASE WHEN a.status = 'admitted' THEN 1 END) as occupied,
        w."totalBeds" as total,
        ROUND(COUNT(CASE WHEN a.status = 'admitted' THEN 1 END) * 100.0 / NULLIF(w."totalBeds", 0), 1) as occupancy_rate
      FROM wards w
      LEFT JOIN beds b ON b."wardId" = w.id
      LEFT JOIN admissions a ON a."bedId" = b.id AND a.status = 'admitted'
      WHERE w."facilityId" = $1
      GROUP BY w.id, w.name, w."totalBeds"
    `, [facilityId]);

    // Lab turnaround time - join orders through encounter for facility filter
    const labTAT = await this.orderRepo.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at))/3600) as avg_tat_hours,
        COUNT(*) as total_tests,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_tests
      FROM orders o
      JOIN encounters e ON e.id = o.encounter_id
      WHERE e.facility_id = $1 AND o.order_type = 'lab' AND o.created_at >= NOW() - INTERVAL '30 days'
    `, [facilityId]);

    // Average length of stay - join through encounter
    const avgLOS = await this.admissionRepo.query(`
      SELECT 
        AVG(EXTRACT(DAY FROM (a."dischargeDate" - a."admissionDate"))) as avg_los_days
      FROM admissions a
      JOIN encounters e ON e.id = a."encounterId"
      WHERE e.facility_id = $1 
        AND a.status = 'discharged' 
        AND a."dischargeDate" IS NOT NULL
        AND a."admissionDate" >= NOW() - INTERVAL '90 days'
    `, [facilityId]);

    // Emergency response
    const emergencyMetrics = await this.emergencyRepo.query(`
      SELECT 
        triage_level,
        COUNT(*) as count
      FROM emergency_cases
      WHERE facility_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY triage_level
    `, [facilityId]);

    return {
      bedOccupancy,
      labTAT: labTAT[0] || {},
      avgLengthOfStay: avgLOS[0]?.avg_los_days || null,
      emergencyMetrics,
    };
  }

  // Summary report for a date range
  async getSummaryReport(facilityId: string, startDate: Date, endDate: Date) {
    const [
      patientStats,
      encounterStats,
      revenueStats,
      admissionStats,
    ] = await Promise.all([
      this.patientRepo.query(`
        SELECT 
          COUNT(*) as new_patients
        FROM patients
        WHERE created_at BETWEEN $1 AND $2
      `, [startDate, endDate]),
      
      this.encounterRepo.query(`
        SELECT 
          encounter_type,
          COUNT(*) as count
        FROM encounters
        WHERE facility_id = $1 AND created_at BETWEEN $2 AND $3
        GROUP BY encounter_type
      `, [facilityId, startDate, endDate]),
      
      this.invoiceRepo.query(`
        SELECT 
          SUM(i.total_amount) as total_billed,
          SUM(i.amount_paid) as total_collected,
          COUNT(*) as invoice_count
        FROM invoices i
        JOIN encounters e ON e.id = i.encounter_id
        WHERE e.facility_id = $1 AND i.created_at BETWEEN $2 AND $3
      `, [facilityId, startDate, endDate]),
      
      this.admissionRepo.query(`
        SELECT 
          COUNT(*) as total_admissions,
          COUNT(CASE WHEN a.status = 'discharged' THEN 1 END) as discharges
        FROM admissions a
        JOIN encounters e ON e.id = a."encounterId"
        WHERE e.facility_id = $1 AND a."admissionDate" BETWEEN $2 AND $3
      `, [facilityId, startDate, endDate]),
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
  private async countPatientsSince(since: Date): Promise<number> {
    const result = await this.patientRepo.query(`
      SELECT COUNT(*) as count FROM patients WHERE created_at >= $1
    `, [since]);
    return parseInt(result[0]?.count || 0);
  }

  private async countActiveAdmissions(facilityId: string): Promise<number> {
    const result = await this.admissionRepo.query(`
      SELECT COUNT(*) as count 
      FROM admissions a
      JOIN encounters e ON e.id = a."encounterId"
      WHERE e.facility_id = $1 AND a.status = 'admitted'
    `, [facilityId]);
    return parseInt(result[0]?.count || 0);
  }

  private async countEncountersSince(facilityId: string, since: Date): Promise<number> {
    const result = await this.encounterRepo.query(`
      SELECT COUNT(*) as count FROM encounters WHERE facility_id = $1 AND created_at >= $2
    `, [facilityId, since]);
    return parseInt(result[0]?.count || 0);
  }

  private async countEmergenciesSince(facilityId: string, since: Date): Promise<number> {
    const result = await this.emergencyRepo.query(`
      SELECT COUNT(*) as count FROM emergency_cases WHERE facility_id = $1 AND created_at >= $2
    `, [facilityId, since]);
    return parseInt(result[0]?.count || 0);
  }

  private async getRevenueSum(facilityId: string, since: Date): Promise<number> {
    const result = await this.invoiceRepo.query(`
      SELECT COALESCE(SUM(i.total_amount), 0) as total
      FROM invoices i
      JOIN encounters e ON e.id = i.encounter_id
      WHERE e.facility_id = $1 AND i.created_at >= $2
    `, [facilityId, since]);
    return parseFloat(result[0]?.total || 0);
  }

  private async getCollectionsSum(facilityId: string, since: Date): Promise<number> {
    const result = await this.paymentRepo.query(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN invoices i ON i.id = p.invoice_id
      JOIN encounters e ON e.id = i.encounter_id
      WHERE e.facility_id = $1 AND p.created_at >= $2
    `, [facilityId, since]);
    return parseFloat(result[0]?.total || 0);
  }

  private async getOutstandingBalance(facilityId: string): Promise<number> {
    const result = await this.invoiceRepo.query(`
      SELECT COALESCE(SUM(i.balance_due), 0) as outstanding
      FROM invoices i
      JOIN encounters e ON e.id = i.encounter_id
      WHERE e.facility_id = $1 AND i.status != 'paid'
    `, [facilityId]);
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
  async getRecentActivity(facilityId: string, limit = 10) {
    const activities: Array<{
      type: string;
      title: string;
      description: string;
      timestamp: Date;
      icon: string;
    }> = [];

    // Get recent patient registrations
    const recentPatients = await this.patientRepo.find({
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
    const recentEncounters = await this.encounterRepo.find({
      where: { facilityId, status: 'completed' as any },
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
    const recentLabResults = await this.labResultRepo.find({
      where: { status: 'validated' as any },
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
    const recentPayments = await this.paymentRepo.find({
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
  async getDashboardAlerts(facilityId: string) {
    const alerts: Array<{
      type: 'critical' | 'warning' | 'info';
      title: string;
      description: string;
      count?: number;
    }> = [];

    // Check for critical lab results (abnormal flag)
    const criticalLabResults = await this.labResultRepo.count({
      where: { abnormalFlag: In([AbnormalFlag.CRITICAL_LOW, AbnormalFlag.CRITICAL_HIGH]) },
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
    const lowStockItems = await this.stockBalanceRepo
      .createQueryBuilder('sb')
      .innerJoin('sb.item', 'item')
      .where('sb.available_quantity <= item.reorder_level')
      .andWhere('item.reorder_level > 0')
      .getCount();
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
      where: { status: ResultStatus.ENTERED },
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
    const overdueInvoices = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .innerJoin('invoice.encounter', 'encounter')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('invoice.status != :status', { status: 'paid' })
      .andWhere('invoice.balance_due > 0')
      .andWhere('invoice.created_at < :date', { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
      .getCount();
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
