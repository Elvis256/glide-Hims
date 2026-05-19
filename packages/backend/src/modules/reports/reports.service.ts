import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  DashboardQueryDto,
  VisitsQueryDto,
  PatientStatsQueryDto,
  DiseaseStatsQueryDto,
  MortalityQueryDto,
  RevenueQueryDto,
  CollectionsQueryDto,
  OutstandingQueryDto,
  StockQueryDto,
  ConsumptionQueryDto,
  ExpiryQueryDto,
  HmisMonthlyDto,
  HmisWeeklyDto,
} from './reports.dto';

/**
 * eIDSR notifiable diseases (Uganda subset). ICD-10 prefixes that should
 * trigger surveillance reporting. The list is intentionally conservative;
 * extend as the Ministry of Health publishes updates.
 */
export const NOTIFIABLE_ICD_PREFIXES: Array<{ code: string; name: string }> = [
  { code: 'A00', name: 'Cholera' },
  { code: 'A01', name: 'Typhoid & paratyphoid fevers' },
  { code: 'A03', name: 'Shigellosis (bacillary dysentery)' },
  { code: 'A20', name: 'Plague' },
  { code: 'A22', name: 'Anthrax' },
  { code: 'A36', name: 'Diphtheria' },
  { code: 'A37', name: 'Whooping cough' },
  { code: 'A39', name: 'Meningococcal infection' },
  { code: 'A75', name: 'Typhus fever' },
  { code: 'A80', name: 'Acute poliomyelitis' },
  { code: 'A82', name: 'Rabies' },
  { code: 'A90', name: 'Dengue fever' },
  { code: 'A91', name: 'Dengue haemorrhagic fever' },
  { code: 'A95', name: 'Yellow fever' },
  { code: 'A96', name: 'Arenaviral haemorrhagic fever' },
  { code: 'A98', name: 'Other viral haemorrhagic fevers' }, // Ebola, Marburg, CCHF
  { code: 'B05', name: 'Measles' },
  { code: 'B06', name: 'Rubella' },
  { code: 'B16', name: 'Acute hepatitis B' },
  { code: 'B17', name: 'Other acute viral hepatitis' },
  { code: 'B50', name: 'Plasmodium falciparum malaria' },
  { code: 'B51', name: 'Plasmodium vivax malaria' },
  { code: 'B54', name: 'Unspecified malaria' },
  { code: 'J09', name: 'Influenza due to identified zoonotic/pandemic virus' },
  { code: 'J10', name: 'Influenza due to other identified influenza virus' },
  { code: 'U07', name: 'Emergency use (COVID-19)' },
];

/**
 * mTrac essential medicines tracer list (Uganda). Item names matched
 * case-insensitively against `items.name` / `items.generic_name`.
 */
export const MTRAC_TRACER_ITEMS: string[] = [
  'Artemether/Lumefantrine',
  'Coartem',
  'ORS',
  'Oral Rehydration Salts',
  'Zinc',
  'Cotrimoxazole',
  'Amoxicillin',
  'Paracetamol',
  'Iron/Folic Acid',
  'Sulfadoxine/Pyrimethamine',
  'Measles Vaccine',
  'BCG Vaccine',
  'OPV',
  'DPT-HepB-Hib',
  'Tetanus Toxoid',
  'Depo-Provera',
  'Male Condoms',
  'Mama Kit',
  'RDT (Malaria)',
  'HIV Test Kit',
];

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  // ---------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------

  /**
   * Maximum span of a report query window. 5 years is generous for any
   * realistic clinical/financial report and bounds the worst-case row scan.
   * Returning 400 here is far better UX than letting the DB run for minutes.
   */
  private static readonly MAX_RANGE_DAYS = 365 * 5;

  private resolveRange(start?: string, end?: string): { start: Date; end: Date } {
    const e = end ? new Date(end) : new Date();
    const s = start ? new Date(start) : new Date(e.getFullYear(), e.getMonth(), 1);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      throw new BadRequestException('Invalid startDate/endDate');
    }
    if (s.getTime() > e.getTime()) {
      throw new BadRequestException('startDate must be on or before endDate');
    }
    const spanDays = Math.floor((e.getTime() - s.getTime()) / 86400000);
    if (spanDays > ReportsService.MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range too large (${spanDays} days). Maximum allowed is ${ReportsService.MAX_RANGE_DAYS} days.`,
      );
    }
    return { start: s, end: e };
  }

  private requireTenant(tenantId?: string): string {
    if (!tenantId) throw new BadRequestException('Missing tenant context');
    return tenantId;
  }

  /**
   * Verify the requested facility belongs to the caller's tenant. Without
   * this check every report endpoint silently accepts any UUID — same-tenant
   * users could probe other facilities they should not have visibility into,
   * and cross-tenant probing would just return zero rows (information leak
   * via timing / aggregate shape). Throwing NotFound is intentional: it
   * doesn't disclose whether the facility exists in another tenant.
   */
  private async requireFacility(tenantId: string, facilityId: string): Promise<void> {
    const [row] = await this.ds.query(
      `SELECT 1 FROM facilities WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [facilityId, tenantId],
    );
    if (!row) throw new NotFoundException('Facility not found');
  }

  /**
   * Verify the optional department UUID belongs to the requested facility
   * (and transitively the tenant). Mirrors `requireFacility` and stops a
   * caller from using a department from another facility/tenant to scope
   * the report.
   */
  private async requireDepartment(
    tenantId: string,
    facilityId: string,
    departmentId?: string,
  ): Promise<void> {
    if (!departmentId) return;
    const [row] = await this.ds.query(
      `SELECT 1
       FROM departments d
       JOIN facilities f ON f.id = d.facility_id
       WHERE d.id = $1 AND d.facility_id = $2 AND f.tenant_id = $3
       LIMIT 1`,
      [departmentId, facilityId, tenantId],
    );
    if (!row) throw new NotFoundException('Department not found');
  }

  /**
   * Verify the optional store UUID belongs to the requested facility (and
   * transitively the tenant). Same-class fix as `requireFacility`: without
   * it, a caller can pass any UUID to scope getStock and either probe across
   * tenants or just receive a misleadingly-empty report from another tenant.
   */
  private async requireStore(
    tenantId: string,
    facilityId: string,
    storeId?: string,
  ): Promise<void> {
    if (!storeId) return;
    const [row] = await this.ds.query(
      `SELECT 1 FROM stores
       WHERE id = $1 AND facility_id = $2 AND tenant_id = $3
       LIMIT 1`,
      [storeId, facilityId, tenantId],
    );
    if (!row) throw new NotFoundException('Store not found');
  }

  /**
   * Verify the optional item UUID belongs to the caller's tenant. Items in
   * this schema are a tenant-scoped catalog (items.facility_id is nullable
   * for shared/parent-catalog rows), so we scope on tenant only and accept
   * either NULL facility_id (shared catalog) or a row tied to the supplied
   * facility.
   */
  private async requireItem(
    tenantId: string,
    facilityId: string,
    itemId?: string,
  ): Promise<void> {
    if (!itemId) return;
    const [row] = await this.ds.query(
      `SELECT 1 FROM items
       WHERE id = $1 AND tenant_id = $2
         AND (facility_id IS NULL OR facility_id = $3)
         AND deleted_at IS NULL
       LIMIT 1`,
      [itemId, tenantId, facilityId],
    );
    if (!row) throw new NotFoundException('Item not found');
  }

  // ---------------------------------------------------------------------
  // 1. Composite KPI dashboard
  // ---------------------------------------------------------------------
  async getDashboard(q: DashboardQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    if (q.departmentId) await this.requireDepartment(tid, q.facilityId, q.departmentId);
    const { start, end } = this.resolveRange(q.startDate, q.endDate);

    const params: any[] = [tid, q.facilityId, start, end];
    const deptClause = q.departmentId ? 'AND e.department_id = $5' : '';
    if (q.departmentId) params.push(q.departmentId);

    const [visitsRow] = await this.ds.query(
      `SELECT COUNT(*)::int AS visits
       FROM encounters e
       WHERE e.tenant_id = $1 AND e.facility_id = $2
         AND e.start_time BETWEEN $3 AND $4
         AND e.deleted_at IS NULL ${deptClause}`,
      params,
    );

    const [revenueRow] = await this.ds.query(
      `SELECT COALESCE(SUM(i.total_amount), 0)::float AS revenue,
              COALESCE(SUM(i.amount_paid), 0)::float AS collected,
              COALESCE(SUM(i.balance_due), 0)::float AS outstanding
       FROM invoices i
       LEFT JOIN encounters e ON e.id = i.encounter_id
       WHERE i.tenant_id = $1
         AND (e.facility_id = $2 OR i.encounter_id IS NULL)
         AND i.created_at BETWEEN $3 AND $4
         AND i.deleted_at IS NULL`,
      [tid, q.facilityId, start, end],
    );

    const topDiagnoses = await this.ds.query(
      `SELECT pp.custom_icd_code AS code,
              COALESCE(d.name, pp.custom_diagnosis) AS name,
              COUNT(*)::int AS count
       FROM patient_problems pp
       LEFT JOIN diagnoses d ON d.id = pp.diagnosis_id
       WHERE pp.tenant_id = $1 AND pp.facility_id = $2
         AND pp.onset_date BETWEEN $3::date AND $4::date
         AND pp.deleted_at IS NULL
       GROUP BY 1, 2
       ORDER BY count DESC
       LIMIT 10`,
      [tid, q.facilityId, start, end],
    );

    const topMedications = await this.ds.query(
      `SELECT i.name AS name,
              SUM(ABS(sl.quantity))::int AS quantity
       FROM stock_ledger sl
       JOIN items i ON i.id = sl.item_id
       WHERE sl.tenant_id = $1 AND sl.facility_id = $2
         AND sl.created_at BETWEEN $3 AND $4
         AND sl.deleted_at IS NULL
         AND sl.movement_type IN ('sale', 'transfer_out')
         AND sl.quantity < 0
       GROUP BY i.name
       ORDER BY quantity DESC
       LIMIT 10`,
      [tid, q.facilityId, start, end],
    ).catch(() => []);

    const [lowStockRow] = await this.ds.query(
      `SELECT COUNT(*)::int AS low_stock
       FROM stock_balances sb
       JOIN items i ON i.id = sb.item_id
       WHERE sb.tenant_id = $1 AND sb.facility_id = $2
         AND sb.available_quantity <= COALESCE(i.reorder_level, 10)`,
      [tid, q.facilityId],
    ).catch(() => [{ low_stock: 0 }]);

    const [criticalRow] = await this.ds.query(
      `SELECT COUNT(*)::int AS critical
       FROM critical_result_alerts cra
       LEFT JOIN encounters e ON e.id = cra.encounter_id
       WHERE cra.tenant_id = $1
         AND (e.facility_id = $2 OR cra.encounter_id IS NULL)
         AND cra.created_at BETWEEN $3 AND $4
         AND cra.deleted_at IS NULL`,
      [tid, q.facilityId, start, end],
    ).catch(() => [{ critical: 0 }]);

    return {
      period: { start, end },
      visits: visitsRow?.visits ?? 0,
      revenue: Number(revenueRow?.revenue ?? 0),
      collected: Number(revenueRow?.collected ?? 0),
      outstanding: Number(revenueRow?.outstanding ?? 0),
      topDiagnoses,
      topMedications,
      lowStockCount: lowStockRow?.low_stock ?? 0,
      criticalResultsCount: criticalRow?.critical ?? 0,
    };
  }

  // ---------------------------------------------------------------------
  // 2. Visits
  // ---------------------------------------------------------------------
  async getVisits(q: VisitsQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    if (q.departmentId) await this.requireDepartment(tid, q.facilityId, q.departmentId);
    const { start, end } = this.resolveRange(q.startDate, q.endDate);
    const groupBy = q.groupBy || 'day';
    const trunc = groupBy === 'week' ? 'week' : groupBy === 'month' ? 'month' : 'day';

    const params: any[] = [tid, q.facilityId, start, end];
    const deptClause = q.departmentId ? 'AND e.department_id = $5' : '';
    if (q.departmentId) params.push(q.departmentId);

    const [trend, byType, byStatus, byDept] = await Promise.all([
      this.ds.query(
        `SELECT date_trunc('${trunc}', e.start_time) AS period,
                COUNT(*)::int AS count
         FROM encounters e
         WHERE e.tenant_id = $1 AND e.facility_id = $2
           AND e.start_time BETWEEN $3 AND $4 AND e.deleted_at IS NULL ${deptClause}
         GROUP BY 1 ORDER BY 1`,
        params,
      ),
      this.ds.query(
        `SELECT e.type, COUNT(*)::int AS count
         FROM encounters e
         WHERE e.tenant_id = $1 AND e.facility_id = $2
           AND e.start_time BETWEEN $3 AND $4 AND e.deleted_at IS NULL ${deptClause}
         GROUP BY e.type ORDER BY count DESC`,
        params,
      ),
      this.ds.query(
        `SELECT e.status, COUNT(*)::int AS count
         FROM encounters e
         WHERE e.tenant_id = $1 AND e.facility_id = $2
           AND e.start_time BETWEEN $3 AND $4 AND e.deleted_at IS NULL ${deptClause}
         GROUP BY e.status`,
        params,
      ),
      this.ds.query(
        `SELECT COALESCE(d.name, 'Unassigned') AS department,
                e.department_id,
                COUNT(*)::int AS count
         FROM encounters e
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.tenant_id = $1 AND e.facility_id = $2
           AND e.start_time BETWEEN $3 AND $4 AND e.deleted_at IS NULL ${deptClause}
         GROUP BY 1, 2 ORDER BY count DESC`,
        params,
      ),
    ]);

    const total = trend.reduce((s: number, r: any) => s + Number(r.count), 0);
    return { period: { start, end }, total, trend, byType, byStatus, byDepartment: byDept };
  }

  // ---------------------------------------------------------------------
  // 3. Patient statistics (age/sex/department)
  // ---------------------------------------------------------------------
  async getPatientStatistics(q: PatientStatsQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const period = q.period || 'month';
    const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;
    const since = new Date(Date.now() - days * 86400000);

    const [byGender, byAge, byDept, registrations] = await Promise.all([
      this.ds.query(
        `SELECT p.gender, COUNT(DISTINCT p.id)::int AS count
         FROM patients p
         JOIN encounters e ON e.patient_id = p.id
         WHERE p.tenant_id = $1 AND e.facility_id = $2
           AND e.start_time >= $3 AND p.deleted_at IS NULL
         GROUP BY p.gender`,
        [tid, q.facilityId, since],
      ),
      this.ds.query(
        `SELECT
           CASE
             WHEN age < 1 THEN '<1'
             WHEN age BETWEEN 1 AND 4 THEN '1-4'
             WHEN age BETWEEN 5 AND 14 THEN '5-14'
             WHEN age BETWEEN 15 AND 24 THEN '15-24'
             WHEN age BETWEEN 25 AND 49 THEN '25-49'
             WHEN age BETWEEN 50 AND 64 THEN '50-64'
             ELSE '65+'
           END AS age_band,
           COUNT(*)::int AS count
         FROM (
           SELECT DISTINCT p.id,
                  EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age
           FROM patients p
           JOIN encounters e ON e.patient_id = p.id
           WHERE p.tenant_id = $1 AND e.facility_id = $2 AND e.start_time >= $3
         ) sub
         GROUP BY age_band ORDER BY age_band`,
        [tid, q.facilityId, since],
      ),
      this.ds.query(
        `SELECT COALESCE(d.name, 'Unassigned') AS department,
                COUNT(DISTINCT e.patient_id)::int AS count
         FROM encounters e
         LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.tenant_id = $1 AND e.facility_id = $2 AND e.start_time >= $3
           AND e.deleted_at IS NULL
         GROUP BY 1 ORDER BY count DESC`,
        [tid, q.facilityId, since],
      ),
      this.ds.query(
        `SELECT date_trunc('day', p.created_at) AS day,
                COUNT(*)::int AS count
         FROM patients p
         WHERE p.tenant_id = $1 AND p.created_at >= $2
         GROUP BY 1 ORDER BY 1`,
        [tid, since],
      ),
    ]);

    return { period, byGender, byAge, byDepartment: byDept, registrations };
  }

  // ---------------------------------------------------------------------
  // 4. Disease statistics (top ICD codes)
  // ---------------------------------------------------------------------
  async getDiseaseStatistics(q: DiseaseStatsQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const { start, end } = this.resolveRange(q.startDate, q.endDate);

    const top = await this.ds.query(
      `SELECT pp.custom_icd_code AS code,
              COALESCE(d.name, pp.custom_diagnosis) AS name,
              COALESCE(d.chapter_name, 'Other') AS chapter,
              COUNT(*)::int AS count
       FROM patient_problems pp
       LEFT JOIN diagnoses d ON d.id = pp.diagnosis_id
       WHERE pp.tenant_id = $1 AND pp.facility_id = $2
         AND pp.onset_date BETWEEN $3::date AND $4::date
         AND pp.deleted_at IS NULL
       GROUP BY 1, 2, 3
       ORDER BY count DESC
       LIMIT 50`,
      [tid, q.facilityId, start, end],
    );

    const byChapter = await this.ds.query(
      `SELECT COALESCE(d.chapter_name, 'Other') AS chapter, COUNT(*)::int AS count
       FROM patient_problems pp
       LEFT JOIN diagnoses d ON d.id = pp.diagnosis_id
       WHERE pp.tenant_id = $1 AND pp.facility_id = $2
         AND pp.onset_date BETWEEN $3::date AND $4::date
         AND pp.deleted_at IS NULL
       GROUP BY 1 ORDER BY count DESC`,
      [tid, q.facilityId, start, end],
    );

    return { period: { start, end }, top, byChapter };
  }

  // ---------------------------------------------------------------------
  // 5. Mortality
  // ---------------------------------------------------------------------
  async getMortality(q: MortalityQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const { start, end } = this.resolveRange(q.startDate, q.endDate);

    const [summary, trend, byCause, byAge] = await Promise.all([
      this.ds.query(
        `SELECT COUNT(*)::int AS deaths
         FROM admissions a
         JOIN encounters e ON e.id = a."encounterId"
         WHERE a.tenant_id = $1 AND e.facility_id = $2
           AND a.status = 'deceased'
           AND a."dischargeDate" BETWEEN $3 AND $4
           AND a.deleted_at IS NULL`,
        [tid, q.facilityId, start, end],
      ).catch(() => [{ deaths: 0 }]),
      this.ds.query(
        `SELECT date_trunc('day', a."dischargeDate") AS day, COUNT(*)::int AS count
         FROM admissions a
         JOIN encounters e ON e.id = a."encounterId"
         WHERE a.tenant_id = $1 AND e.facility_id = $2
           AND a.status = 'deceased'
           AND a."dischargeDate" BETWEEN $3 AND $4
         GROUP BY 1 ORDER BY 1`,
        [tid, q.facilityId, start, end],
      ).catch(() => []),
      this.ds.query(
        `SELECT COALESCE(a."dischargeDiagnosis", 'Unknown') AS cause, COUNT(*)::int AS count
         FROM admissions a
         JOIN encounters e ON e.id = a."encounterId"
         WHERE a.tenant_id = $1 AND e.facility_id = $2 AND a.status = 'deceased'
           AND a."dischargeDate" BETWEEN $3 AND $4
         GROUP BY 1 ORDER BY count DESC LIMIT 20`,
        [tid, q.facilityId, start, end],
      ).catch(() => []),
      this.ds.query(
        `SELECT
           CASE WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth, a."dischargeDate")) < 5 THEN '<5' ELSE '>=5' END AS age_band,
           p.gender,
           COUNT(*)::int AS count
         FROM admissions a
         JOIN encounters e ON e.id = a."encounterId"
         JOIN patients p ON p.id = a."patientId"
         WHERE a.tenant_id = $1 AND e.facility_id = $2 AND a.status = 'deceased'
           AND a."dischargeDate" BETWEEN $3 AND $4
         GROUP BY 1, 2`,
        [tid, q.facilityId, start, end],
      ).catch(() => []),
    ]);

    return {
      period: { start, end },
      totalDeaths: summary[0]?.deaths ?? 0,
      trend,
      byCause,
      byAgeAndSex: byAge,
    };
  }

  // ---------------------------------------------------------------------
  // 6. Revenue
  // ---------------------------------------------------------------------
  async getRevenue(q: RevenueQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const { start, end } = this.resolveRange(q.startDate, q.endDate);
    const groupBy = q.groupBy || 'day';
    const trunc = groupBy === 'week' ? 'week' : groupBy === 'month' ? 'month' : 'day';

    const [trend, byService, totals] = await Promise.all([
      this.ds.query(
        `SELECT date_trunc('${trunc}', i.created_at) AS period,
                COALESCE(SUM(i.total_amount),0)::float AS revenue,
                COALESCE(SUM(i.amount_paid),0)::float AS collected
         FROM invoices i
         LEFT JOIN encounters e ON e.id = i.encounter_id
         WHERE i.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
           AND i.created_at BETWEEN $3 AND $4 AND i.deleted_at IS NULL
         GROUP BY 1 ORDER BY 1`,
        [tid, q.facilityId, start, end],
      ),
      this.ds.query(
        `SELECT ii.charge_type AS service_type, COALESCE(SUM(ii.amount),0)::float AS amount
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
         LEFT JOIN encounters e ON e.id = i.encounter_id
         WHERE i.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
           AND i.created_at BETWEEN $3 AND $4 AND i.deleted_at IS NULL
         GROUP BY ii.charge_type ORDER BY amount DESC`,
        [tid, q.facilityId, start, end],
      ).catch(() => []),
      this.ds.query(
        `SELECT COALESCE(SUM(i.total_amount),0)::float AS gross,
                COALESCE(SUM(i.discount_amount),0)::float AS discounts,
                COALESCE(SUM(i.amount_paid),0)::float AS collected,
                COALESCE(SUM(i.balance_due),0)::float AS outstanding,
                COUNT(*)::int AS invoices
         FROM invoices i
         LEFT JOIN encounters e ON e.id = i.encounter_id
         WHERE i.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
           AND i.created_at BETWEEN $3 AND $4 AND i.deleted_at IS NULL`,
        [tid, q.facilityId, start, end],
      ),
    ]);

    return { period: { start, end }, totals: totals[0], trend, byService };
  }

  // ---------------------------------------------------------------------
  // 7. Collections
  // ---------------------------------------------------------------------
  async getCollections(q: CollectionsQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const { start, end } = this.resolveRange(q.startDate, q.endDate);

    const params: any[] = [tid, q.facilityId, start, end];
    let methodClause = '';
    if (q.paymentMethod) {
      methodClause = 'AND p.payment_method = $5';
      params.push(q.paymentMethod);
    }

    const [byMethod, trend, totals] = await Promise.all([
      this.ds.query(
        `SELECT p.payment_method,
                COUNT(*)::int AS count,
                COALESCE(SUM(p.amount),0)::float AS amount
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         LEFT JOIN encounters e ON e.id = i.encounter_id
         WHERE p.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
           AND p.paid_at BETWEEN $3 AND $4 ${methodClause}
         GROUP BY p.payment_method`,
        params,
      ),
      this.ds.query(
        `SELECT date_trunc('day', p.paid_at) AS day,
                COALESCE(SUM(p.amount),0)::float AS amount
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         LEFT JOIN encounters e ON e.id = i.encounter_id
         WHERE p.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
           AND p.paid_at BETWEEN $3 AND $4 ${methodClause}
         GROUP BY 1 ORDER BY 1`,
        params,
      ),
      this.ds.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(p.amount),0)::float AS total
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         LEFT JOIN encounters e ON e.id = i.encounter_id
         WHERE p.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
           AND p.paid_at BETWEEN $3 AND $4 ${methodClause}`,
        params,
      ),
    ]);

    return { period: { start, end }, totals: totals[0], byMethod, trend };
  }

  // ---------------------------------------------------------------------
  // 8. Outstanding
  // ---------------------------------------------------------------------
  async getOutstanding(q: OutstandingQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const asOf = q.asOf ? new Date(q.asOf) : new Date();

    const aging = await this.ds.query(
      `SELECT
         CASE
           WHEN (DATE($3) - DATE(i.created_at)) <= 30 THEN '0-30'
           WHEN (DATE($3) - DATE(i.created_at)) <= 60 THEN '31-60'
           WHEN (DATE($3) - DATE(i.created_at)) <= 90 THEN '61-90'
           ELSE '90+'
         END AS bucket,
         COUNT(*)::int AS invoices,
         COALESCE(SUM(i.balance_due),0)::float AS amount
       FROM invoices i
       LEFT JOIN encounters e ON e.id = i.encounter_id
       WHERE i.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
         AND i.balance_due > 0 AND i.created_at <= $3
         AND i.deleted_at IS NULL
       GROUP BY bucket
       ORDER BY bucket`,
      [tid, q.facilityId, asOf],
    );

    const top = await this.ds.query(
      `SELECT i.id, i.invoice_number, p.full_name AS patient,
              i.balance_due::float AS balance,
              (DATE($3) - DATE(i.created_at))::int AS age_days,
              i.created_at
       FROM invoices i
       JOIN patients p ON p.id = i.patient_id
       LEFT JOIN encounters e ON e.id = i.encounter_id
       WHERE i.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
         AND i.balance_due > 0 AND i.created_at <= $3 AND i.deleted_at IS NULL
       ORDER BY i.balance_due DESC LIMIT 50`,
      [tid, q.facilityId, asOf],
    );

    const [totals] = await this.ds.query(
      `SELECT COUNT(*)::int AS invoices, COALESCE(SUM(i.balance_due),0)::float AS total
       FROM invoices i
       LEFT JOIN encounters e ON e.id = i.encounter_id
       WHERE i.tenant_id = $1 AND (e.facility_id = $2 OR i.encounter_id IS NULL)
         AND i.balance_due > 0 AND i.created_at <= $3 AND i.deleted_at IS NULL`,
      [tid, q.facilityId, asOf],
    );

    return { asOf, totals, aging, top };
  }

  // ---------------------------------------------------------------------
  // 9. Stock
  // ---------------------------------------------------------------------
  async getStock(q: StockQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    await this.requireStore(tid, q.facilityId, q.storeId);
    const params: any[] = [tid, q.facilityId];
    let storeClause = '';
    if (q.storeId) {
      storeClause = `AND sb.store_id = $${params.length + 1}`;
      params.push(q.storeId);
    }
    let catClause = '';
    if (q.category) {
      catClause = `AND ic.code = $${params.length + 1}`;
      params.push(q.category);
    }

    const rows = await this.ds.query(
      `SELECT i.id AS item_id, i.code, i.name, i.unit_cost::float AS unit_cost,
              i.selling_price::float AS selling_price,
              COALESCE(ic.name, 'Uncategorised') AS category,
              COALESCE(SUM(sb.available_quantity),0)::int AS on_hand,
              COALESCE(SUM(sb.reserved_quantity),0)::int AS reserved,
              i.reorder_level,
              (COALESCE(SUM(sb.available_quantity),0) * i.unit_cost)::float AS value
       FROM items i
       LEFT JOIN stock_balances sb ON sb.item_id = i.id AND sb.tenant_id = $1 AND sb.facility_id = $2 ${storeClause}
       LEFT JOIN item_categories ic ON ic.id = i.category_id
       WHERE i.tenant_id = $1 AND (i.facility_id = $2 OR i.facility_id IS NULL)
         AND i.deleted_at IS NULL ${catClause}
       GROUP BY i.id, ic.name, ic.code
       ORDER BY i.name`,
      params,
    );

    const totalValue = rows.reduce((s: number, r: any) => s + Number(r.value || 0), 0);
    const lowStock = rows.filter((r: any) => Number(r.on_hand) <= Number(r.reorder_level || 10)).length;
    return { totalItems: rows.length, totalValue, lowStock, items: rows };
  }

  // ---------------------------------------------------------------------
  // 10. Consumption
  // ---------------------------------------------------------------------
  async getConsumption(q: ConsumptionQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    await this.requireItem(tid, q.facilityId, q.itemId);
    const { start, end } = this.resolveRange(q.startDate, q.endDate);
    const params: any[] = [tid, q.facilityId, start, end];
    let itemClause = '';
    if (q.itemId) {
      itemClause = `AND sl.item_id = $${params.length + 1}`;
      params.push(q.itemId);
    }

    const byItem = await this.ds.query(
      `SELECT i.id AS item_id, i.code, i.name,
              SUM(ABS(sl.quantity))::int AS quantity,
              (SUM(ABS(sl.quantity)) * i.unit_cost)::float AS value
       FROM stock_ledger sl
       JOIN items i ON i.id = sl.item_id
       WHERE sl.tenant_id = $1 AND sl.facility_id = $2
         AND sl.created_at BETWEEN $3 AND $4
         AND sl.movement_type IN ('sale', 'transfer_out')
         AND sl.quantity < 0
         AND sl.deleted_at IS NULL ${itemClause}
       GROUP BY i.id ORDER BY quantity DESC LIMIT 100`,
      params,
    );

    const trend = await this.ds.query(
      `SELECT date_trunc('day', sl.created_at) AS day,
              SUM(ABS(sl.quantity))::int AS quantity
       FROM stock_ledger sl
       WHERE sl.tenant_id = $1 AND sl.facility_id = $2
         AND sl.created_at BETWEEN $3 AND $4
         AND sl.movement_type IN ('sale', 'transfer_out')
         AND sl.quantity < 0
         AND sl.deleted_at IS NULL ${itemClause}
       GROUP BY 1 ORDER BY 1`,
      params,
    );

    return { period: { start, end }, byItem, trend };
  }

  // ---------------------------------------------------------------------
  // 11. Expiry
  // ---------------------------------------------------------------------
  async getExpiry(q: ExpiryQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const days = q.daysAhead ?? 90;

    const items = await this.ds.query(
      `SELECT bs.id, bs.batch_number, bs.expiry_date, bs.quantity::float AS quantity,
              i.name AS item_name, i.code AS item_code,
              i.unit_cost::float AS unit_cost,
              (bs.quantity * i.unit_cost)::float AS value,
              (bs.expiry_date - CURRENT_DATE)::int AS days_until_expiry
       FROM batch_stock_balances bs
       JOIN items i ON i.id = bs.item_id
       WHERE bs.tenant_id = $1 AND bs.facility_id = $2
         AND bs.expiry_date <= CURRENT_DATE + ($3 || ' days')::interval
         AND bs.quantity > 0
       ORDER BY bs.expiry_date ASC`,
      [tid, q.facilityId, days],
    ).catch(() => []);

    const expired = items.filter((r: any) => Number(r.days_until_expiry) < 0);
    const within30 = items.filter((r: any) => Number(r.days_until_expiry) >= 0 && Number(r.days_until_expiry) <= 30);
    const within90 = items.filter((r: any) => Number(r.days_until_expiry) > 30 && Number(r.days_until_expiry) <= 90);

    return {
      daysAhead: days,
      totals: {
        expired: { count: expired.length, value: expired.reduce((s: number, r: any) => s + Number(r.value || 0), 0) },
        within30: { count: within30.length, value: within30.reduce((s: number, r: any) => s + Number(r.value || 0), 0) },
        within90: { count: within90.length, value: within90.reduce((s: number, r: any) => s + Number(r.value || 0), 0) },
      },
      items,
    };
  }

  // =====================================================================
  // STATUTORY REPORTS
  // =====================================================================

  private parsePeriodMonth(period: string): { start: Date; end: Date } {
    const [y, m] = period.split('-').map(Number);
    if (!Number.isInteger(y) || !Number.isInteger(m) || y < 2000 || y > 2099 || m < 1 || m > 12) {
      throw new BadRequestException(`Invalid period "${period}" — expected YYYY-MM with year 2000-2099`);
    }
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 1));
    return { start, end };
  }

  private parsePeriodWeek(week: string): { start: Date; end: Date } {
    const [y, w] = week.split('-').map(Number);
    if (!Number.isInteger(y) || !Number.isInteger(w) || y < 2000 || y > 2099 || w < 1 || w > 53) {
      throw new BadRequestException(`Invalid week "${week}" — expected YYYY-WW with year 2000-2099`);
    }
    // ISO week: Monday is day 1
    const jan4 = new Date(Date.UTC(y, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const week1Start = new Date(jan4);
    week1Start.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
    const start = new Date(week1Start);
    start.setUTCDate(week1Start.getUTCDate() + (w - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return { start, end };
  }

  /**
   * HMIS Form 108 — OPD monthly summary by disease/category and M/F × <5/≥5.
   */
  async getHmis108(q: HmisMonthlyDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const { start, end } = this.parsePeriodMonth(q.period);

    const rows = await this.ds.query(
      `SELECT
         COALESCE(d.chapter_name, 'Other') AS category,
         COALESCE(d.name, pp.custom_diagnosis, 'Unknown') AS disease,
         COALESCE(pp.custom_icd_code, d.icd10_code, '') AS icd10,
         SUM(CASE WHEN p.gender = 'male' AND EXTRACT(YEAR FROM AGE(pp.onset_date, p.date_of_birth)) < 5 THEN 1 ELSE 0 END)::int AS male_under5,
         SUM(CASE WHEN p.gender = 'male' AND EXTRACT(YEAR FROM AGE(pp.onset_date, p.date_of_birth)) >= 5 THEN 1 ELSE 0 END)::int AS male_5plus,
         SUM(CASE WHEN p.gender = 'female' AND EXTRACT(YEAR FROM AGE(pp.onset_date, p.date_of_birth)) < 5 THEN 1 ELSE 0 END)::int AS female_under5,
         SUM(CASE WHEN p.gender = 'female' AND EXTRACT(YEAR FROM AGE(pp.onset_date, p.date_of_birth)) >= 5 THEN 1 ELSE 0 END)::int AS female_5plus,
         COUNT(*)::int AS total
       FROM patient_problems pp
       JOIN patients p ON p.id = pp.patient_id
       LEFT JOIN diagnoses d ON d.id = pp.diagnosis_id
       WHERE pp.tenant_id = $1 AND pp.facility_id = $2
         AND pp.onset_date >= $3::date AND pp.onset_date < $4::date
         AND pp.deleted_at IS NULL
       GROUP BY 1, 2, 3
       ORDER BY total DESC`,
      [tid, q.facilityId, start, end],
    );

    return {
      report: 'HMIS 108',
      period: q.period,
      facilityId: q.facilityId,
      generatedAt: new Date(),
      rows,
    };
  }

  /**
   * HMIS Form 122 — Lab/PHC monthly. Counts by lab test category from `lab_samples`.
   */
  async getHmis122(q: HmisMonthlyDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const { start, end } = this.parsePeriodMonth(q.period);

    const rows = await this.ds.query(
      `SELECT lt.category,
              COUNT(*)::int AS samples,
              SUM(CASE WHEN ls.status IN ('completed','reported','verified') THEN 1 ELSE 0 END)::int AS reported,
              SUM(CASE WHEN ls.status = 'rejected' THEN 1 ELSE 0 END)::int AS rejected
       FROM lab_samples ls
       JOIN lab_tests lt ON lt.id = ls."labTestId"
       WHERE ls.tenant_id = $1
         AND ls.created_at >= $2 AND ls.created_at < $3
         AND ls.deleted_at IS NULL
       GROUP BY lt.category ORDER BY samples DESC`,
      [tid, start, end],
    ).catch((e: any) => {
      this.logger.warn(`HMIS122 query failed: ${e.message}`);
      return [];
    });

    return {
      report: 'HMIS 122',
      period: q.period,
      facilityId: q.facilityId,
      generatedAt: new Date(),
      rows,
    };
  }

  /**
   * eIDSR — weekly notifiable diseases.
   */
  async getEidsr(q: HmisWeeklyDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const { start, end } = this.parsePeriodWeek(q.week);

    const rows = await this.ds.query(
      `SELECT COALESCE(pp.custom_icd_code, d.icd10_code, '') AS icd10,
              COALESCE(d.name, pp.custom_diagnosis, 'Unknown') AS disease,
              SUM(CASE WHEN EXTRACT(YEAR FROM AGE(pp.onset_date, p.date_of_birth)) < 5 THEN 1 ELSE 0 END)::int AS cases_under5,
              SUM(CASE WHEN EXTRACT(YEAR FROM AGE(pp.onset_date, p.date_of_birth)) >= 5 THEN 1 ELSE 0 END)::int AS cases_5plus,
              COUNT(*)::int AS total_cases,
              0 AS deaths
       FROM patient_problems pp
       JOIN patients p ON p.id = pp.patient_id
       LEFT JOIN diagnoses d ON d.id = pp.diagnosis_id
       WHERE pp.tenant_id = $1 AND pp.facility_id = $2
         AND pp.onset_date >= $3::date AND pp.onset_date < $4::date
         AND pp.deleted_at IS NULL
         AND (
           d.is_notifiable = true
           OR ${NOTIFIABLE_ICD_PREFIXES.map((_, i) => `COALESCE(pp.custom_icd_code, d.icd10_code, '') LIKE $${5 + i}`).join(' OR ')}
         )
       GROUP BY 1, 2 ORDER BY total_cases DESC`,
      [tid, q.facilityId, start, end, ...NOTIFIABLE_ICD_PREFIXES.map((p) => `${p.code}%`)],
    );

    // Compute deaths per disease from admissions joined by ICD prefix in discharge_diagnosis
    const deathsByDisease = await this.ds.query(
      `SELECT a.discharge_diagnosis, COUNT(*)::int AS deaths
       FROM admissions a
       WHERE a.tenant_id = $1 AND a.facility_id = $2 AND a.status = 'deceased'
         AND a.discharge_date >= $3 AND a.discharge_date < $4
       GROUP BY 1`,
      [tid, q.facilityId, start, end],
    ).catch(() => []);

    for (const r of rows) {
      const match = deathsByDisease.find((d: any) => (d.discharge_diagnosis || '').toLowerCase().includes((r.disease || '').toLowerCase()));
      if (match) r.deaths = Number(match.deaths);
    }

    return {
      report: 'eIDSR',
      week: q.week,
      facilityId: q.facilityId,
      generatedAt: new Date(),
      rows,
    };
  }

  /**
   * mTrac — weekly stock-out indicators for tracer essential medicines.
   */
  async getMtrac(q: HmisWeeklyDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    await this.requireFacility(tid, q.facilityId);
    const { start, end } = this.parsePeriodWeek(q.week);

    const tracerLikes = MTRAC_TRACER_ITEMS.map((_, i) => `i.name ILIKE $${3 + i} OR i.generic_name ILIKE $${3 + i}`).join(' OR ');
    const params = [tid, q.facilityId, ...MTRAC_TRACER_ITEMS.map((n) => `%${n}%`)];

    const stockoutRows = await this.ds.query(
      `SELECT i.name AS item, i.generic_name,
              COALESCE(SUM(sb.available_quantity),0)::int AS on_hand,
              i.reorder_level,
              CASE WHEN COALESCE(SUM(sb.available_quantity),0) = 0 THEN true ELSE false END AS stocked_out
       FROM items i
       LEFT JOIN stock_balances sb ON sb.item_id = i.id AND sb.tenant_id = $1 AND sb.facility_id = $2
       WHERE i.tenant_id = $1 AND (i.facility_id = $2 OR i.facility_id IS NULL)
         AND (${tracerLikes})
       GROUP BY i.id ORDER BY i.name`,
      params,
    );

    const consumptionRows = await this.ds.query(
      `SELECT i.name AS item, SUM(ABS(sl.quantity))::int AS dispensed
       FROM stock_ledger sl
       JOIN items i ON i.id = sl.item_id
       WHERE sl.tenant_id = $1 AND sl.facility_id = $2
         AND sl.created_at >= $3 AND sl.created_at < $4
         AND sl.movement_type IN ('sale','transfer_out')
         AND sl.quantity < 0
         AND (${MTRAC_TRACER_ITEMS.map((_, i) => `i.name ILIKE $${5 + i} OR i.generic_name ILIKE $${5 + i}`).join(' OR ')})
       GROUP BY i.name`,
      [tid, q.facilityId, start, end, ...MTRAC_TRACER_ITEMS.map((n) => `%${n}%`)],
    ).catch(() => []);

    const consMap = new Map(consumptionRows.map((r: any) => [r.item, Number(r.dispensed)]));
    for (const r of stockoutRows) r.dispensed_in_week = consMap.get(r.item) || 0;

    return {
      report: 'mTrac',
      week: q.week,
      facilityId: q.facilityId,
      generatedAt: new Date(),
      rows: stockoutRows,
      stockOutCount: stockoutRows.filter((r: any) => r.stocked_out).length,
    };
  }
}
