import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThan, Between } from 'typeorm';
import {
  LabReagent,
  ReagentLot,
  ReagentConsumption,
  ReagentStatus,
} from '../../database/entities/lab-reagent.entity';
import {
  LabEquipment,
  EquipmentCalibration,
  EquipmentMaintenance,
  EquipmentStatus,
  CalibrationStatus,
} from '../../database/entities/lab-equipment.entity';
import {
  QCMaterial,
  QCResult,
  QCLeveyJenningsData,
  QCStatus,
  evaluateWestgardRules,
} from '../../database/entities/lab-qc.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';

@Injectable()
export class LabSuppliesService {
  private readonly logger = new Logger(LabSuppliesService.name);

  constructor(
    @InjectRepository(LabReagent)
    private reagentRepo: Repository<LabReagent>,
    @InjectRepository(ReagentLot)
    private lotRepo: Repository<ReagentLot>,
    @InjectRepository(ReagentConsumption)
    private consumptionRepo: Repository<ReagentConsumption>,
    @InjectRepository(LabEquipment)
    private equipmentRepo: Repository<LabEquipment>,
    @InjectRepository(EquipmentCalibration)
    private calibrationRepo: Repository<EquipmentCalibration>,
    @InjectRepository(EquipmentMaintenance)
    private maintenanceRepo: Repository<EquipmentMaintenance>,
    @InjectRepository(QCMaterial)
    private qcMaterialRepo: Repository<QCMaterial>,
    @InjectRepository(QCResult)
    private qcResultRepo: Repository<QCResult>,
    @InjectRepository(QCLeveyJenningsData)
    private ljDataRepo: Repository<QCLeveyJenningsData>,
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
  ) {}

  // ==================== REAGENTS ====================

  async createReagent(data: Partial<LabReagent>, tenantId?: string): Promise<LabReagent> {
    const reagent = this.reagentRepo.create({ ...data, ...(tenantId ? { tenantId } : {}) });
    return this.reagentRepo.save(reagent);
  }

  async updateReagent(
    id: string,
    data: Partial<LabReagent>,
    tenantId?: string,
  ): Promise<LabReagent> {
    const reagent = await this.reagentRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!reagent) throw new NotFoundException('Reagent not found');
    Object.assign(reagent, data);
    return this.reagentRepo.save(reagent);
  }

  async getReagent(id: string, tenantId?: string): Promise<LabReagent> {
    const reagent = await this.reagentRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['lots'],
    });
    if (!reagent) throw new NotFoundException('Reagent not found');
    return reagent;
  }

  async listReagents(
    facilityId: string,
    category?: string,
    tenantId?: string,
  ): Promise<LabReagent[]> {
    const where: any = { facilityId };
    if (category) where.category = category;
    if (tenantId) where.tenantId = tenantId;
    return this.reagentRepo.find({ where, order: { name: 'ASC' } });
  }

  async getLowStockReagents(facilityId: string, tenantId?: string): Promise<LabReagent[]> {
    const qb = this.reagentRepo
      .createQueryBuilder('r')
      .where('r.facilityId = :facilityId', { facilityId })
      .andWhere('r.stockQuantity <= r.reorderLevel')
      .andWhere('r.isActive = true');
    if (tenantId) {
      qb.andWhere('r.tenant_id = :tenantId', { tenantId });
    }
    return qb.orderBy('r.stockQuantity', 'ASC').getMany();
  }

  async getExpiringReagents(
    facilityId: string,
    daysAhead = 30,
    tenantId?: string,
  ): Promise<ReagentLot[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const qb = this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.reagent', 'reagent')
      .where('lot.facilityId = :facilityId', { facilityId })
      .andWhere('lot.expiryDate <= :futureDate', { futureDate })
      .andWhere('lot.currentQuantity > 0')
      .andWhere('lot.isActive = true');
    if (tenantId) {
      qb.andWhere('lot.tenant_id = :tenantId', { tenantId });
    }
    return qb.orderBy('lot.expiryDate', 'ASC').getMany();
  }

  // ==================== REAGENT LOTS ====================

  async receiveLot(
    data: Partial<ReagentLot>,
    tenantId?: string,
    userId?: string,
  ): Promise<ReagentLot> {
    // P1: validate expiry > received date
    if (data.expiryDate && data.receivedDate) {
      const expiry = new Date(data.expiryDate);
      const received = new Date(data.receivedDate);
      if (expiry < received) {
        throw new BadRequestException('Expiry date cannot be before received date');
      }
    }

    // P0: wrap in transaction with pessimistic lock to prevent lost stock updates
    return this.dataSource.transaction(async (manager) => {
      const reagent = await manager.findOne(LabReagent, {
        where: { id: data.reagentId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reagent) throw new NotFoundException('Reagent not found');

      const lot = manager.getRepository(ReagentLot).create({
        ...data,
        currentQuantity: data.initialQuantity,
        ...(tenantId ? { tenantId } : {}),
      });
      const saved = await manager.save(lot);

      // Update reagent stock under lock
      reagent.stockQuantity = Number(reagent.stockQuantity) + Number(data.initialQuantity);
      this.applyReagentStatus(reagent);
      await manager.save(reagent);

      // Audit
      try {
        await this.auditLogService.log({
          action: 'REAGENT_LOT_RECEIVED',
          entityType: 'ReagentLot',
          entityId: saved.id,
          userId,
          tenantId,
          newValue: {
            lotId: saved.id,
            reagentId: reagent.id,
            reagentName: reagent.name,
            initialQuantity: data.initialQuantity,
            lotNumber: data.lotNumber,
            facilityId: data.facilityId,
          },
        });
      } catch (e) {
        this.logger.warn(`Audit log failed (REAGENT_LOT_RECEIVED): ${(e as Error).message}`);
      }

      return saved;
    });
  }

  async openLot(lotId: string, tenantId?: string): Promise<ReagentLot> {
    const lot = await this.lotRepo.findOne({
      where: { id: lotId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!lot) throw new NotFoundException('Lot not found');
    lot.openedDate = new Date();
    return this.lotRepo.save(lot);
  }

  async recordConsumption(
    data: Partial<ReagentConsumption>,
    tenantId?: string,
    userId?: string,
  ): Promise<ReagentConsumption> {
    // P0: wrap in transaction with pessimistic lock to prevent stock going negative
    return this.dataSource.transaction(async (manager) => {
      const lot = await manager.findOne(ReagentLot, {
        where: { id: data.lotId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lot) throw new NotFoundException('Lot not found');

      if (Number(lot.currentQuantity) < Number(data.quantityUsed)) {
        throw new BadRequestException('Insufficient quantity in lot');
      }

      const consumption = manager.getRepository(ReagentConsumption).create({
        ...data,
        consumedAt: new Date(),
        facilityId: lot.facilityId,
        ...(tenantId ? { tenantId } : {}),
      });
      const saved = await manager.save(consumption);

      // Update lot quantity
      lot.currentQuantity = Number(lot.currentQuantity) - Number(data.quantityUsed);
      await manager.save(lot);

      // Update reagent stock (lock reagent too)
      const reagent = await manager.findOne(LabReagent, {
        where: { id: lot.reagentId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (reagent) {
        reagent.stockQuantity = Number(reagent.stockQuantity) - Number(data.quantityUsed);
        this.applyReagentStatus(reagent);
        await manager.save(reagent);
      }

      // Audit
      try {
        await this.auditLogService.log({
          action: 'REAGENT_CONSUMED',
          entityType: 'ReagentConsumption',
          entityId: saved.id,
          userId,
          tenantId,
          newValue: {
            consumptionId: saved.id,
            lotId: lot.id,
            quantityUsed: data.quantityUsed,
            remainingQuantity: lot.currentQuantity,
            facilityId: lot.facilityId,
          },
        });
      } catch (e) {
        this.logger.warn(`Audit log failed (REAGENT_CONSUMED): ${(e as Error).message}`);
      }

      return saved;
    });
  }

  private applyReagentStatus(reagent: LabReagent): void {
    if (reagent.stockQuantity <= 0) {
      reagent.status = ReagentStatus.OUT_OF_STOCK;
    } else if (reagent.stockQuantity <= reagent.reorderLevel) {
      reagent.status = ReagentStatus.LOW_STOCK;
    } else {
      reagent.status = ReagentStatus.ACTIVE;
    }
  }

  async getConsumptionReport(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<{
    totalConsumption: number;
    byReagent: Record<string, number>;
    byTest: Record<string, number>;
  }> {
    const consumptions = await this.consumptionRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.lot', 'lot')
      .leftJoinAndSelect('lot.reagent', 'reagent')
      .where('c.facilityId = :facilityId', { facilityId })
      .andWhere('c.consumedAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    if (tenantId) {
      consumptions.andWhere('c.tenant_id = :tenantId', { tenantId });
    }
    const results = await consumptions.getMany();

    const byReagent: Record<string, number> = {};
    const byTest: Record<string, number> = {};

    for (const c of results) {
      const reagentName = c.lot?.reagent?.name || 'Unknown';
      byReagent[reagentName] = (byReagent[reagentName] || 0) + Number(c.quantityUsed);

      if (c.testCode) {
        byTest[c.testCode] = (byTest[c.testCode] || 0) + Number(c.quantityUsed);
      }
    }

    return {
      totalConsumption: results.reduce((sum, c) => sum + Number(c.quantityUsed), 0),
      byReagent,
      byTest,
    };
  }

  // ==================== EQUIPMENT ====================

  async createEquipment(data: Partial<LabEquipment>, tenantId?: string): Promise<LabEquipment> {
    const equipment = this.equipmentRepo.create({ ...data, ...(tenantId ? { tenantId } : {}) });
    return this.equipmentRepo.save(equipment);
  }

  async updateEquipment(
    id: string,
    data: Partial<LabEquipment>,
    tenantId?: string,
  ): Promise<LabEquipment> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!equipment) throw new NotFoundException('Equipment not found');
    Object.assign(equipment, data);
    return this.equipmentRepo.save(equipment);
  }

  async getEquipment(id: string, tenantId?: string): Promise<LabEquipment> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['calibrations', 'maintenances', 'responsiblePerson'],
    });
    if (!equipment) throw new NotFoundException('Equipment not found');
    return equipment;
  }

  async listEquipment(
    facilityId: string,
    category?: string,
    tenantId?: string,
  ): Promise<LabEquipment[]> {
    const where: any = { facilityId };
    if (category) where.category = category;
    if (tenantId) where.tenantId = tenantId;
    return this.equipmentRepo.find({ where, order: { name: 'ASC' } });
  }

  async getEquipmentDueForCalibration(
    facilityId: string,
    daysAhead = 30,
    tenantId?: string,
  ): Promise<LabEquipment[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.equipmentRepo.find({
      where: {
        facilityId,
        requiresCalibration: true,
        nextCalibrationDate: LessThan(futureDate),
        status: EquipmentStatus.OPERATIONAL,
        ...(tenantId ? { tenantId } : {}),
      },
      order: { nextCalibrationDate: 'ASC' },
    });
  }

  async recordCalibration(
    data: Partial<EquipmentCalibration>,
    tenantId?: string,
    userId?: string,
  ): Promise<EquipmentCalibration> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id: data.equipmentId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!equipment) throw new NotFoundException('Equipment not found');

    // P1: reject calibration on decommissioned/retired equipment
    if (equipment.status === EquipmentStatus.DECOMMISSIONED) {
      throw new BadRequestException(`Cannot calibrate equipment with status '${equipment.status}'`);
    }

    const calibration = this.calibrationRepo.create({ ...data, ...(tenantId ? { tenantId } : {}) });
    const saved = await this.calibrationRepo.save(calibration);

    // Update equipment
    equipment.lastCalibrationDate = data.calibrationDate;
    if (data.nextDueDate) {
      equipment.nextCalibrationDate = data.nextDueDate;
    } else if (equipment.calibrationFrequencyDays) {
      const nextDate = new Date(data.calibrationDate!);
      nextDate.setDate(nextDate.getDate() + equipment.calibrationFrequencyDays);
      equipment.nextCalibrationDate = nextDate;
    }

    if (data.passed) {
      equipment.calibrationStatus = CalibrationStatus.CURRENT;
    } else {
      // P1: failed calibration → equipment out of service
      equipment.calibrationStatus = CalibrationStatus.OVERDUE;
      equipment.status = EquipmentStatus.OUT_OF_SERVICE;
    }
    await this.equipmentRepo.save(equipment);

    // Audit
    try {
      await this.auditLogService.log({
        action: 'EQUIPMENT_CALIBRATED',
        entityType: 'EquipmentCalibration',
        entityId: saved.id,
        userId,
        tenantId,
        newValue: {
          calibrationId: saved.id,
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          passed: data.passed,
          calibrationDate: data.calibrationDate,
          equipmentStatus: equipment.status,
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log failed (EQUIPMENT_CALIBRATED): ${(e as Error).message}`);
    }

    return saved;
  }

  async recordEquipmentMaintenance(
    data: Partial<EquipmentMaintenance>,
    tenantId?: string,
    userId?: string,
  ): Promise<EquipmentMaintenance> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id: data.equipmentId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!equipment) throw new NotFoundException('Equipment not found');

    // P1: reject maintenance on decommissioned/retired equipment
    if (equipment.status === EquipmentStatus.DECOMMISSIONED) {
      throw new BadRequestException(
        `Cannot perform maintenance on equipment with status '${equipment.status}'`,
      );
    }

    const maintenance = this.maintenanceRepo.create({ ...data, ...(tenantId ? { tenantId } : {}) });
    const saved = await this.maintenanceRepo.save(maintenance);

    // Update equipment
    equipment.lastMaintenanceDate = data.maintenanceDate;
    if (data.nextDueDate) {
      equipment.nextMaintenanceDate = data.nextDueDate;
    } else if (equipment.maintenanceFrequencyDays) {
      const nextDate = new Date(data.maintenanceDate!);
      nextDate.setDate(nextDate.getDate() + equipment.maintenanceFrequencyDays);
      equipment.nextMaintenanceDate = nextDate;
    }
    await this.equipmentRepo.save(equipment);

    // Audit
    try {
      await this.auditLogService.log({
        action: 'EQUIPMENT_MAINTAINED',
        entityType: 'EquipmentMaintenance',
        entityId: saved.id,
        userId,
        tenantId,
        newValue: {
          maintenanceId: saved.id,
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          maintenanceType: data.type,
          maintenanceDate: data.maintenanceDate,
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log failed (EQUIPMENT_MAINTAINED): ${(e as Error).message}`);
    }

    return saved;
  }

  // ==================== QC MATERIALS ====================

  async createQCMaterial(data: Partial<QCMaterial>, tenantId?: string): Promise<QCMaterial> {
    const material = this.qcMaterialRepo.create({ ...data, ...(tenantId ? { tenantId } : {}) });
    return this.qcMaterialRepo.save(material);
  }

  async listQCMaterials(
    facilityId: string,
    testCode?: string,
    tenantId?: string,
  ): Promise<QCMaterial[]> {
    const where: any = { facilityId, isActive: true };
    if (testCode) where.testCode = testCode;
    if (tenantId) where.tenantId = tenantId;
    return this.qcMaterialRepo.find({ where, order: { testCode: 'ASC', level: 'ASC' } });
  }

  // ==================== QC RESULTS ====================

  async recordQCResult(
    data: Partial<QCResult>,
    tenantId?: string,
    userId?: string,
  ): Promise<QCResult> {
    const material = await this.qcMaterialRepo.findOne({
      where: { id: data.qcMaterialId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!material) throw new NotFoundException('QC Material not found');

    // P0: use data.resultValue (entity field) — callers must map DTO 'value' to 'resultValue'
    const resultValue = Number(data.resultValue);

    // Calculate z-score
    const zScore = (resultValue - Number(material.targetMean)) / Number(material.targetSd);

    // Get previous results for Westgard evaluation
    const previousResults = await this.qcResultRepo.find({
      where: {
        qcMaterialId: data.qcMaterialId,
        facilityId: data.facilityId,
        ...(tenantId ? { tenantId } : {}),
      },
      order: { runDate: 'DESC' },
      take: 10,
    });

    const previousValues = previousResults.map((r) => Number(r.resultValue));
    const evaluation = evaluateWestgardRules(
      resultValue,
      Number(material.targetMean),
      Number(material.targetSd),
      previousValues,
    );

    // P0: stamp performedBy from JWT user
    const result = this.qcResultRepo.create({
      ...data,
      performedBy: userId || data.performedBy,
      targetMean: material.targetMean,
      targetSd: material.targetSd,
      zScore,
      status: evaluation.status,
      violatedRules: evaluation.violatedRules,
      ...(tenantId ? { tenantId } : {}),
    });

    const saved = await this.qcResultRepo.save(result);

    // Audit
    try {
      await this.auditLogService.log({
        action: 'QC_RESULT_RECORDED',
        entityType: 'QCResult',
        entityId: saved.id,
        userId,
        tenantId,
        newValue: {
          qcResultId: saved.id,
          qcMaterialId: material.id,
          testCode: data.testCode,
          resultValue,
          zScore,
          status: evaluation.status,
          violatedRules: evaluation.violatedRules,
          facilityId: data.facilityId,
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log failed (QC_RESULT_RECORDED): ${(e as Error).message}`);
    }

    return saved;
  }

  async getQCResults(
    facilityId: string,
    testCode: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<QCResult[]> {
    return this.qcResultRepo.find({
      where: {
        facilityId,
        testCode,
        runDate: Between(startDate, endDate),
        ...(tenantId ? { tenantId } : {}),
      },
      relations: ['performedByUser', 'qcMaterial'],
      order: { runDate: 'ASC' },
    });
  }

  async getLeveyJenningsData(
    qcMaterialId: string,
    months = 6,
    tenantId?: string,
  ): Promise<{
    material: QCMaterial;
    results: QCResult[];
    statistics: {
      mean: number;
      sd: number;
      cv: number;
      inControlPercentage: number;
    };
  }> {
    const material = await this.qcMaterialRepo.findOne({
      where: { id: qcMaterialId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!material) throw new NotFoundException('QC Material not found');

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const results = await this.qcResultRepo.find({
      where: {
        qcMaterialId,
        runDate: MoreThan(startDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { runDate: 'ASC' },
    });

    const values = results.map((r) => Number(r.resultValue));
    const mean = values.reduce((a, b) => a + b, 0) / values.length || 0;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length || 0;
    const sd = Math.sqrt(variance);
    const cv = mean !== 0 ? (sd / mean) * 100 : 0;

    const inControlCount = results.filter((r) => r.status === QCStatus.IN_CONTROL).length;
    const inControlPercentage = results.length > 0 ? (inControlCount / results.length) * 100 : 100;

    return {
      material,
      results,
      statistics: {
        mean,
        sd,
        cv,
        inControlPercentage,
      },
    };
  }

  async getQCSummaryReport(
    facilityId: string,
    month: number,
    year: number,
    tenantId?: string,
  ): Promise<{
    totalRuns: number;
    inControlRuns: number;
    outOfControlRuns: number;
    inControlPercentage: number;
    byTest: Record<string, { total: number; inControl: number; percentage: number }>;
    violationsByRule: Record<string, number>;
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const results = await this.qcResultRepo.find({
      where: {
        facilityId,
        runDate: Between(startDate, endDate),
        ...(tenantId ? { tenantId } : {}),
      },
    });

    const byTest: Record<string, { total: number; inControl: number; percentage: number }> = {};
    const violationsByRule: Record<string, number> = {};

    for (const result of results) {
      if (!byTest[result.testCode]) {
        byTest[result.testCode] = { total: 0, inControl: 0, percentage: 0 };
      }
      byTest[result.testCode].total++;
      if (result.status === QCStatus.IN_CONTROL) {
        byTest[result.testCode].inControl++;
      }

      if (result.violatedRules) {
        for (const rule of result.violatedRules) {
          violationsByRule[rule] = (violationsByRule[rule] || 0) + 1;
        }
      }
    }

    for (const test of Object.keys(byTest)) {
      byTest[test].percentage =
        byTest[test].total > 0 ? (byTest[test].inControl / byTest[test].total) * 100 : 100;
    }

    const inControlRuns = results.filter((r) => r.status === QCStatus.IN_CONTROL).length;

    return {
      totalRuns: results.length,
      inControlRuns,
      outOfControlRuns: results.length - inControlRuns,
      inControlPercentage: results.length > 0 ? (inControlRuns / results.length) * 100 : 100,
      byTest,
      violationsByRule,
    };
  }
}
