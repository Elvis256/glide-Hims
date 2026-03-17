import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  Prescription,
  PrescriptionItem,
} from '../../database/entities/prescription.entity';
import { DrugClassification, TherapeuticClass } from '../../database/entities/drug-classification.entity';

@Injectable()
export class DURReportsService {
  private readonly logger = new Logger(DURReportsService.name);

  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private readonly prescriptionItemRepo: Repository<PrescriptionItem>,
    @InjectRepository(DrugClassification)
    private readonly drugClassRepo: Repository<DrugClassification>,
  ) {}

  /**
   * Top prescribed drugs with counts and average quantities
   */
  async getPrescribingPatterns(
    tenantId: string,
    facilityId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const qb = this.prescriptionItemRepo
      .createQueryBuilder('pi')
      .innerJoin('pi.prescription', 'p')
      .select('pi.drugName', 'drugName')
      .addSelect('pi.drugCode', 'drugCode')
      .addSelect('COUNT(pi.id)', 'totalPrescribed')
      .addSelect('SUM(pi.quantity)', 'totalQuantity')
      .addSelect('AVG(pi.quantity)', 'avgQuantity')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      qb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    qb.groupBy('pi.drugName')
      .addGroupBy('pi.drugCode')
      .orderBy('"totalPrescribed"', 'DESC')
      .limit(50);

    const results = await qb.getRawMany();

    return results.map((r) => ({
      drugName: r.drugName,
      drugCode: r.drugCode,
      totalPrescribed: parseInt(r.totalPrescribed, 10),
      totalQuantity: parseInt(r.totalQuantity, 10),
      avgQuantity: parseFloat(parseFloat(r.avgQuantity).toFixed(2)),
    }));
  }

  /**
   * Prescriptions grouped by therapeutic class with trends over time
   */
  async getTherapeuticClassTrends(
    tenantId: string,
    facilityId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    // Get per-class totals
    const classQb = this.prescriptionItemRepo
      .createQueryBuilder('pi')
      .innerJoin('pi.prescription', 'p')
      .leftJoin(DrugClassification, 'dc', 'dc.genericName = pi.drugName AND dc.tenantId = :tenantId', { tenantId })
      .select('COALESCE(dc.therapeuticClass, :other)', 'therapeuticClass')
      .setParameter('other', 'other')
      .addSelect('COUNT(pi.id)', 'totalItems')
      .addSelect('COUNT(DISTINCT p.id)', 'totalPrescriptions')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      classQb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      classQb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    classQb
      .groupBy('dc.therapeuticClass')
      .orderBy('"totalItems"', 'DESC');

    const classTotals = await classQb.getRawMany();

    // Get monthly trends
    const trendQb = this.prescriptionItemRepo
      .createQueryBuilder('pi')
      .innerJoin('pi.prescription', 'p')
      .leftJoin(DrugClassification, 'dc', 'dc.genericName = pi.drugName AND dc.tenantId = :tenantId', { tenantId })
      .select('COALESCE(dc.therapeuticClass, :other)', 'therapeuticClass')
      .setParameter('other', 'other')
      .addSelect("TO_CHAR(p.createdAt, 'YYYY-MM')", 'month')
      .addSelect('COUNT(pi.id)', 'count')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      trendQb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      trendQb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    trendQb
      .groupBy('dc.therapeuticClass')
      .addGroupBy("TO_CHAR(p.createdAt, 'YYYY-MM')")
      .orderBy('"month"', 'ASC');

    const trends = await trendQb.getRawMany();

    return {
      classTotals: classTotals.map((r) => ({
        therapeuticClass: r.therapeuticClass,
        totalItems: parseInt(r.totalItems, 10),
        totalPrescriptions: parseInt(r.totalPrescriptions, 10),
      })),
      monthlyTrends: trends.map((r) => ({
        therapeuticClass: r.therapeuticClass,
        month: r.month,
        count: parseInt(r.count, 10),
      })),
    };
  }

  /**
   * Per-prescriber analytics
   */
  async getPrescriberAnalytics(
    tenantId: string,
    facilityId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const qb = this.prescriptionRepo
      .createQueryBuilder('p')
      .leftJoin('p.prescribedBy', 'u')
      .leftJoin('p.items', 'pi')
      .select('p.prescribedById', 'prescriberId')
      .addSelect("COALESCE(CONCAT(u.firstName, ' ', u.lastName), 'Unknown')", 'prescriberName')
      .addSelect('COUNT(DISTINCT p.id)', 'totalPrescriptions')
      .addSelect('COUNT(pi.id)', 'totalItems')
      .addSelect('ROUND(COUNT(pi.id)::numeric / NULLIF(COUNT(DISTINCT p.id), 0), 2)', 'avgItemsPerRx')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      qb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      qb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    qb.groupBy('p.prescribedById')
      .addGroupBy('u.firstName')
      .addGroupBy('u.lastName')
      .orderBy('"totalPrescriptions"', 'DESC');

    const results = await qb.getRawMany();

    // For each prescriber, get their top drugs
    const prescriberIds = results.map((r) => r.prescriberId);
    let topDrugsMap: Record<string, string[]> = {};

    if (prescriberIds.length > 0) {
      const topDrugsQb = this.prescriptionItemRepo
        .createQueryBuilder('pi')
        .innerJoin('pi.prescription', 'p')
        .select('p.prescribedById', 'prescriberId')
        .addSelect('pi.drugName', 'drugName')
        .addSelect('COUNT(pi.id)', 'cnt')
        .where('p.tenantId = :tenantId', { tenantId })
        .andWhere('p.prescribedById IN (:...prescriberIds)', { prescriberIds });

      if (dateFrom) {
        topDrugsQb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
      }
      if (dateTo) {
        topDrugsQb.andWhere('p.createdAt <= :dateTo', { dateTo });
      }

      topDrugsQb
        .groupBy('p.prescribedById')
        .addGroupBy('pi.drugName')
        .orderBy('"cnt"', 'DESC');

      const topDrugs = await topDrugsQb.getRawMany();

      topDrugsMap = topDrugs.reduce((acc, r) => {
        if (!acc[r.prescriberId]) acc[r.prescriberId] = [];
        if (acc[r.prescriberId].length < 5) {
          acc[r.prescriberId].push(r.drugName);
        }
        return acc;
      }, {} as Record<string, string[]>);
    }

    return results.map((r) => ({
      prescriberId: r.prescriberId,
      prescriberName: r.prescriberName,
      totalPrescriptions: parseInt(r.totalPrescriptions, 10),
      totalItems: parseInt(r.totalItems, 10),
      avgItemsPerRx: parseFloat(r.avgItemsPerRx || '0'),
      topDrugs: topDrugsMap[r.prescriberId] || [],
    }));
  }

  /**
   * Combined DUR summary with key metrics
   */
  async getDURSummary(
    tenantId: string,
    facilityId?: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    const baseQb = this.prescriptionRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      baseQb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      baseQb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    // Total prescriptions
    const totalRx = await baseQb.getCount();

    // Unique drugs
    const uniqueDrugsQb = this.prescriptionItemRepo
      .createQueryBuilder('pi')
      .innerJoin('pi.prescription', 'p')
      .select('COUNT(DISTINCT pi.drugName)', 'count')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      uniqueDrugsQb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      uniqueDrugsQb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    const uniqueDrugs = await uniqueDrugsQb.getRawOne();

    // Avg items per Rx
    const avgItemsQb = this.prescriptionItemRepo
      .createQueryBuilder('pi')
      .innerJoin('pi.prescription', 'p')
      .select('COUNT(pi.id)', 'totalItems')
      .addSelect('COUNT(DISTINCT p.id)', 'totalRx')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      avgItemsQb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      avgItemsQb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    const avgItems = await avgItemsQb.getRawOne();
    const avgItemsPerRx =
      parseInt(avgItems?.totalRx, 10) > 0
        ? (parseInt(avgItems?.totalItems, 10) / parseInt(avgItems?.totalRx, 10)).toFixed(2)
        : '0';

    // Top therapeutic class
    const topClassQb = this.prescriptionItemRepo
      .createQueryBuilder('pi')
      .innerJoin('pi.prescription', 'p')
      .leftJoin(DrugClassification, 'dc', 'dc.genericName = pi.drugName AND dc.tenantId = :tenantId', { tenantId })
      .select('COALESCE(dc.therapeuticClass, :other)', 'therapeuticClass')
      .setParameter('other', 'other')
      .addSelect('COUNT(pi.id)', 'count')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      topClassQb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      topClassQb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    topClassQb
      .groupBy('dc.therapeuticClass')
      .orderBy('"count"', 'DESC')
      .limit(1);

    const topClass = await topClassQb.getRawOne();

    // Unique prescribers
    const prescribersQb = this.prescriptionRepo
      .createQueryBuilder('p')
      .select('COUNT(DISTINCT p.prescribedById)', 'count')
      .where('p.tenantId = :tenantId', { tenantId });

    if (dateFrom) {
      prescribersQb.andWhere('p.createdAt >= :dateFrom', { dateFrom });
    }
    if (dateTo) {
      prescribersQb.andWhere('p.createdAt <= :dateTo', { dateTo });
    }

    const prescribers = await prescribersQb.getRawOne();

    return {
      totalPrescriptions: totalRx,
      uniqueDrugs: parseInt(uniqueDrugs?.count || '0', 10),
      avgItemsPerRx: parseFloat(avgItemsPerRx),
      topTherapeuticClass: topClass?.therapeuticClass || 'N/A',
      uniquePrescribers: parseInt(prescribers?.count || '0', 10),
    };
  }
}
