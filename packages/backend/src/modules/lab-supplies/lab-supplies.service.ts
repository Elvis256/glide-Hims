import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
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

@Injectable()
export class LabSuppliesService {
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
  ) {}

  // ==================== REAGENTS ====================

  async createReagent(data: Partial<LabReagent>): Promise<LabReagent> {
    const reagent = this.reagentRepo.create(data);
    return this.reagentRepo.save(reagent);
  }

  async updateReagent(id: string, data: Partial<LabReagent>): Promise<LabReagent> {
    const reagent = await this.reagentRepo.findOne({ where: { id } });
    if (!reagent) throw new NotFoundException('Reagent not found');
    Object.assign(reagent, data);
    return this.reagentRepo.save(reagent);
  }

  async getReagent(id: string): Promise<LabReagent> {
    const reagent = await this.reagentRepo.findOne({
      where: { id },
      relations: ['lots'],
    });
    if (!reagent) throw new NotFoundException('Reagent not found');
    return reagent;
  }

  async listReagents(facilityId: string, category?: string): Promise<LabReagent[]> {
    const where: any = { facilityId };
    if (category) where.category = category;
    return this.reagentRepo.find({ where, order: { name: 'ASC' } });
  }

  async getLowStockReagents(facilityId: string): Promise<LabReagent[]> {
    return this.reagentRepo.createQueryBuilder('r')
      .where('r.facilityId = :facilityId', { facilityId })
      .andWhere('r.stockQuantity <= r.reorderLevel')
      .andWhere('r.isActive = true')
      .orderBy('r.stockQuantity', 'ASC')
      .getMany();
  }

  async getExpiringReagents(facilityId: string, daysAhead = 30): Promise<ReagentLot[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.lotRepo.createQueryBuilder('lot')
      .leftJoinAndSelect('lot.reagent', 'reagent')
      .where('lot.facilityId = :facilityId', { facilityId })
      .andWhere('lot.expiryDate <= :futureDate', { futureDate })
      .andWhere('lot.currentQuantity > 0')
      .andWhere('lot.isActive = true')
      .orderBy('lot.expiryDate', 'ASC')
      .getMany();
  }

  // ==================== REAGENT LOTS ====================

  async receiveLot(data: Partial<ReagentLot>): Promise<ReagentLot> {
    const reagent = await this.reagentRepo.findOne({ where: { id: data.reagentId } });
    if (!reagent) throw new NotFoundException('Reagent not found');

    const lot = this.lotRepo.create({
      ...data,
      currentQuantity: data.initialQuantity,
    });
    const saved = await this.lotRepo.save(lot);

    // Update reagent stock
    reagent.stockQuantity = Number(reagent.stockQuantity) + Number(data.initialQuantity);
    await this.updateReagentStatus(reagent);
    await this.reagentRepo.save(reagent);

    return saved;
  }

  async openLot(lotId: string): Promise<ReagentLot> {
    const lot = await this.lotRepo.findOne({ where: { id: lotId } });
    if (!lot) throw new NotFoundException('Lot not found');
    lot.openedDate = new Date();
    return this.lotRepo.save(lot);
  }

  async recordConsumption(data: Partial<ReagentConsumption>): Promise<ReagentConsumption> {
    const lot = await this.lotRepo.findOne({
      where: { id: data.lotId },
      relations: ['reagent'],
    });
    if (!lot) throw new NotFoundException('Lot not found');

    if (Number(lot.currentQuantity) < Number(data.quantityUsed)) {
      throw new BadRequestException('Insufficient quantity in lot');
    }

    const consumption = this.consumptionRepo.create({
      ...data,
      consumedAt: new Date(),
    });
    const saved = await this.consumptionRepo.save(consumption);

    // Update lot quantity
    lot.currentQuantity = Number(lot.currentQuantity) - Number(data.quantityUsed);
    await this.lotRepo.save(lot);

    // Update reagent stock
    const reagent = lot.reagent;
    reagent.stockQuantity = Number(reagent.stockQuantity) - Number(data.quantityUsed);
    await this.updateReagentStatus(reagent);
    await this.reagentRepo.save(reagent);

    return saved;
  }

  private async updateReagentStatus(reagent: LabReagent): Promise<void> {
    if (reagent.stockQuantity <= 0) {
      reagent.status = ReagentStatus.OUT_OF_STOCK;
    } else if (reagent.stockQuantity <= reagent.reorderLevel) {
      reagent.status = ReagentStatus.LOW_STOCK;
    } else {
      reagent.status = ReagentStatus.ACTIVE;
    }
  }

  async getConsumptionReport(facilityId: string, startDate: Date, endDate: Date): Promise<{
    totalConsumption: number;
    byReagent: Record<string, number>;
    byTest: Record<string, number>;
  }> {
    const consumptions = await this.consumptionRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.lot', 'lot')
      .leftJoinAndSelect('lot.reagent', 'reagent')
      .where('c.facilityId = :facilityId', { facilityId })
      .andWhere('c.consumedAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const byReagent: Record<string, number> = {};
    const byTest: Record<string, number> = {};

    for (const c of consumptions) {
      const reagentName = c.lot?.reagent?.name || 'Unknown';
      byReagent[reagentName] = (byReagent[reagentName] || 0) + Number(c.quantityUsed);

      if (c.testCode) {
        byTest[c.testCode] = (byTest[c.testCode] || 0) + Number(c.quantityUsed);
      }
    }

    return {
      totalConsumption: consumptions.reduce((sum, c) => sum + Number(c.quantityUsed), 0),
      byReagent,
      byTest,
    };
  }

  // ==================== EQUIPMENT ====================

  async createEquipment(data: Partial<LabEquipment>): Promise<LabEquipment> {
    const equipment = this.equipmentRepo.create(data);
    return this.equipmentRepo.save(equipment);
  }

  async updateEquipment(id: string, data: Partial<LabEquipment>): Promise<LabEquipment> {
    const equipment = await this.equipmentRepo.findOne({ where: { id } });
    if (!equipment) throw new NotFoundException('Equipment not found');
    Object.assign(equipment, data);
    return this.equipmentRepo.save(equipment);
  }

  async getEquipment(id: string): Promise<LabEquipment> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id },
      relations: ['calibrations', 'maintenances', 'responsiblePerson'],
    });
    if (!equipment) throw new NotFoundException('Equipment not found');
    return equipment;
  }

  async listEquipment(facilityId: string, category?: string): Promise<LabEquipment[]> {
    const where: any = { facilityId };
    if (category) where.category = category;
    return this.equipmentRepo.find({ where, order: { name: 'ASC' } });
  }

  async getEquipmentDueForCalibration(facilityId: string, daysAhead = 30): Promise<LabEquipment[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.equipmentRepo.find({
      where: {
        facilityId,
        requiresCalibration: true,
        nextCalibrationDate: LessThan(futureDate),
        status: EquipmentStatus.OPERATIONAL,
      },
      order: { nextCalibrationDate: 'ASC' },
    });
  }

  async recordCalibration(data: Partial<EquipmentCalibration>): Promise<EquipmentCalibration> {
    const equipment = await this.equipmentRepo.findOne({ where: { id: data.equipmentId } });
    if (!equipment) throw new NotFoundException('Equipment not found');

    const calibration = this.calibrationRepo.create(data);
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

    equipment.calibrationStatus = data.passed ? CalibrationStatus.CURRENT : CalibrationStatus.OVERDUE;
    await this.equipmentRepo.save(equipment);

    return saved;
  }

  async recordEquipmentMaintenance(data: Partial<EquipmentMaintenance>): Promise<EquipmentMaintenance> {
    const equipment = await this.equipmentRepo.findOne({ where: { id: data.equipmentId } });
    if (!equipment) throw new NotFoundException('Equipment not found');

    const maintenance = this.maintenanceRepo.create(data);
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

    return saved;
  }

  // ==================== QC MATERIALS ====================

  async createQCMaterial(data: Partial<QCMaterial>): Promise<QCMaterial> {
    const material = this.qcMaterialRepo.create(data);
    return this.qcMaterialRepo.save(material);
  }

  async listQCMaterials(facilityId: string, testCode?: string): Promise<QCMaterial[]> {
    const where: any = { facilityId, isActive: true };
    if (testCode) where.testCode = testCode;
    return this.qcMaterialRepo.find({ where, order: { testCode: 'ASC', level: 'ASC' } });
  }

  // ==================== QC RESULTS ====================

  async recordQCResult(data: Partial<QCResult>): Promise<QCResult> {
    const material = await this.qcMaterialRepo.findOne({ where: { id: data.qcMaterialId } });
    if (!material) throw new NotFoundException('QC Material not found');

    // Calculate z-score
    const zScore = (Number(data.resultValue) - Number(material.targetMean)) / Number(material.targetSd);

    // Get previous results for Westgard evaluation
    const previousResults = await this.qcResultRepo.find({
      where: {
        qcMaterialId: data.qcMaterialId,
        facilityId: data.facilityId,
      },
      order: { runDate: 'DESC' },
      take: 10,
    });

    const previousValues = previousResults.map(r => Number(r.resultValue));
    const evaluation = evaluateWestgardRules(
      Number(data.resultValue),
      Number(material.targetMean),
      Number(material.targetSd),
      previousValues,
    );

    const result = this.qcResultRepo.create({
      ...data,
      targetMean: material.targetMean,
      targetSd: material.targetSd,
      zScore,
      status: evaluation.status,
      violatedRules: evaluation.violatedRules,
    });

    return this.qcResultRepo.save(result);
  }

  async getQCResults(facilityId: string, testCode: string, startDate: Date, endDate: Date): Promise<QCResult[]> {
    return this.qcResultRepo.find({
      where: {
        facilityId,
        testCode,
        runDate: Between(startDate, endDate),
      },
      relations: ['performedByUser', 'qcMaterial'],
      order: { runDate: 'ASC' },
    });
  }

  async getLeveyJenningsData(qcMaterialId: string, months = 6): Promise<{
    material: QCMaterial;
    results: QCResult[];
    statistics: {
      mean: number;
      sd: number;
      cv: number;
      inControlPercentage: number;
    };
  }> {
    const material = await this.qcMaterialRepo.findOne({ where: { id: qcMaterialId } });
    if (!material) throw new NotFoundException('QC Material not found');

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const results = await this.qcResultRepo.find({
      where: {
        qcMaterialId,
        runDate: MoreThan(startDate),
      },
      order: { runDate: 'ASC' },
    });

    const values = results.map(r => Number(r.resultValue));
    const mean = values.reduce((a, b) => a + b, 0) / values.length || 0;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length || 0;
    const sd = Math.sqrt(variance);
    const cv = mean !== 0 ? (sd / mean) * 100 : 0;

    const inControlCount = results.filter(r => r.status === QCStatus.IN_CONTROL).length;
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

  async getQCSummaryReport(facilityId: string, month: number, year: number): Promise<{
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
      byTest[test].percentage = byTest[test].total > 0
        ? (byTest[test].inControl / byTest[test].total) * 100
        : 100;
    }

    const inControlRuns = results.filter(r => r.status === QCStatus.IN_CONTROL).length;

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
