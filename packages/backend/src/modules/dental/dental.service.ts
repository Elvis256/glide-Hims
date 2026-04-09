import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  DentalChart,
  ToothRecord,
  DentalProcedure,
  DentalTreatmentPlan,
  TreatmentPlanItem,
  DentalImage,
  DentalLabOrder,
  OrthodonticCase,
  PeriodontalChart,
} from '../../database/entities/dental.entity';
import {
  CreateToothRecordDto,
  UpdateToothRecordDto,
  CreateDentalProcedureDto,
  CreateTreatmentPlanDto,
  UpdateTreatmentPlanItemStatusDto,
  UploadDentalImageDto,
  CreateLabOrderDto,
  UpdateLabOrderStatusDto,
  CreateOrthoCaseDto,
  UpdateOrthoCaseDto,
  RecordOrthoAdjustmentDto,
  CreatePerioChartDto,
} from './dental.dto';

@Injectable()
export class DentalService {
  private readonly logger = new Logger(DentalService.name);

  constructor(
    @InjectRepository(DentalChart)
    private chartRepo: Repository<DentalChart>,
    @InjectRepository(ToothRecord)
    private toothRepo: Repository<ToothRecord>,
    @InjectRepository(DentalProcedure)
    private procedureRepo: Repository<DentalProcedure>,
    @InjectRepository(DentalTreatmentPlan)
    private treatmentPlanRepo: Repository<DentalTreatmentPlan>,
    @InjectRepository(TreatmentPlanItem)
    private planItemRepo: Repository<TreatmentPlanItem>,
    @InjectRepository(DentalImage)
    private imageRepo: Repository<DentalImage>,
    @InjectRepository(DentalLabOrder)
    private labOrderRepo: Repository<DentalLabOrder>,
    @InjectRepository(OrthodonticCase)
    private orthoCaseRepo: Repository<OrthodonticCase>,
    @InjectRepository(PeriodontalChart)
    private perioChartRepo: Repository<PeriodontalChart>,
    private dataSource: DataSource,
  ) {}

  // ============ CHARTING ============

  async getOrCreateChart(patientId: string, tenantId: string): Promise<DentalChart> {
    let chart = await this.chartRepo.findOne({
      where: { patientId, tenantId },
      relations: ['teeth', 'patient'],
    });

    if (!chart) {
      chart = this.chartRepo.create({ patientId, tenantId });
      chart = await this.chartRepo.save(chart);
      chart = await this.chartRepo.findOne({
        where: { id: chart.id, tenantId },
        relations: ['teeth', 'patient'],
      }) as DentalChart;
    }

    return chart;
  }

  async getChart(patientId: string, tenantId: string): Promise<DentalChart> {
    return this.getOrCreateChart(patientId, tenantId);
  }

  async updateTooth(
    chartId: string,
    toothNumber: string,
    dto: UpdateToothRecordDto,
    tenantId: string,
  ): Promise<ToothRecord> {
    const chart = await this.chartRepo.findOne({
      where: { id: chartId, tenantId },
    });
    if (!chart) {
      throw new NotFoundException('Dental chart not found');
    }

    let tooth = await this.toothRepo.findOne({
      where: { chartId, toothNumber, tenantId },
    });

    if (tooth) {
      Object.assign(tooth, dto);
      return this.toothRepo.save(tooth);
    }

    // Create new tooth record
    tooth = this.toothRepo.create({
      chartId,
      toothNumber,
      tenantId,
      ...dto,
    });
    return this.toothRepo.save(tooth);
  }

  async getToothHistory(
    patientId: string,
    toothNumber: string,
    tenantId: string,
  ): Promise<ToothRecord | null> {
    const chart = await this.chartRepo.findOne({
      where: { patientId, tenantId },
    });
    if (!chart) {
      return null;
    }

    return this.toothRepo.findOne({
      where: { chartId: chart.id, toothNumber, tenantId },
    });
  }

  // ============ PROCEDURES ============

  async createProcedure(
    dto: CreateDentalProcedureDto,
    tenantId: string,
  ): Promise<DentalProcedure> {
    const existing = await this.procedureRepo.findOne({
      where: { code: dto.code, tenantId },
    });
    if (existing) {
      throw new BadRequestException(`Procedure with code ${dto.code} already exists`);
    }

    const procedure = this.procedureRepo.create({
      ...dto,
      tenantId,
    });
    return this.procedureRepo.save(procedure);
  }

  async findAllProcedures(
    tenantId: string,
    category?: string,
  ): Promise<DentalProcedure[]> {
    const where: any = { tenantId, isActive: true };
    if (category) {
      where.category = category;
    }
    return this.procedureRepo.find({
      where,
      order: { code: 'ASC' },
    });
  }

  async findProcedure(id: string, tenantId: string): Promise<DentalProcedure> {
    const procedure = await this.procedureRepo.findOne({
      where: { id, tenantId },
    });
    if (!procedure) {
      throw new NotFoundException('Dental procedure not found');
    }
    return procedure;
  }

  // ============ TREATMENT PLANS ============

  async createPlan(
    dto: CreateTreatmentPlanDto,
    tenantId: string,
    dentistId: string,
  ): Promise<DentalTreatmentPlan> {
    return this.dataSource.transaction(async (manager) => {
      let totalEstimated = 0;
      let totalInsurance = 0;
      let totalPatient = 0;

      const plan = manager.create(DentalTreatmentPlan, {
        patientId: dto.patientId,
        dentistId,
        name: dto.name,
        notes: dto.notes,
        tenantId,
      });
      const savedPlan = await manager.save(plan);

      const items: TreatmentPlanItem[] = [];
      for (const itemDto of dto.items) {
        const item = manager.create(TreatmentPlanItem, {
          treatmentPlanId: savedPlan.id,
          toothNumber: itemDto.toothNumber,
          surface: itemDto.surface,
          procedureId: itemDto.procedureId,
          dentistId,
          priority: itemDto.priority || 'routine',
          estimatedCost: itemDto.estimatedCost,
          insuranceCoverage: itemDto.insuranceCoverage,
          patientCost: itemDto.patientCost,
          notes: itemDto.notes,
          tenantId,
        });
        items.push(item);

        totalEstimated += Number(itemDto.estimatedCost || 0);
        totalInsurance += Number(itemDto.insuranceCoverage || 0);
        totalPatient += Number(itemDto.patientCost || 0);
      }
      await manager.save(TreatmentPlanItem, items);

      savedPlan.totalEstimated = totalEstimated || null;
      savedPlan.totalInsurance = totalInsurance || null;
      savedPlan.totalPatient = totalPatient || null;
      await manager.save(savedPlan);

      return manager.findOne(DentalTreatmentPlan, {
        where: { id: savedPlan.id, tenantId },
        relations: ['items', 'items.procedure', 'patient', 'dentist'],
      }) as Promise<DentalTreatmentPlan>;
    });
  }

  async findPatientPlans(
    patientId: string,
    tenantId: string,
  ): Promise<DentalTreatmentPlan[]> {
    return this.treatmentPlanRepo.find({
      where: { patientId, tenantId },
      relations: ['items', 'items.procedure', 'dentist'],
      order: { createdAt: 'DESC' },
    });
  }

  async updatePlanItemStatus(
    itemId: string,
    dto: UpdateTreatmentPlanItemStatusDto,
    tenantId: string,
  ): Promise<TreatmentPlanItem> {
    const item = await this.planItemRepo.findOne({
      where: { id: itemId, tenantId },
    });
    if (!item) {
      throw new NotFoundException('Treatment plan item not found');
    }

    item.status = dto.status;
    if (dto.notes) {
      item.notes = dto.notes;
    }
    if (dto.status === 'completed') {
      item.completedAt = new Date();
    }

    return this.planItemRepo.save(item);
  }

  async acceptPlan(planId: string, tenantId: string): Promise<DentalTreatmentPlan> {
    const plan = await this.treatmentPlanRepo.findOne({
      where: { id: planId, tenantId },
      relations: ['items'],
    });
    if (!plan) {
      throw new NotFoundException('Treatment plan not found');
    }
    if (plan.status !== 'proposed') {
      throw new BadRequestException('Only proposed plans can be accepted');
    }

    plan.status = 'accepted';
    plan.acceptedAt = new Date();
    return this.treatmentPlanRepo.save(plan);
  }

  // ============ IMAGES ============

  async recordImage(
    dto: UploadDentalImageDto,
    filePath: string,
    tenantId: string,
    userId: string,
  ): Promise<DentalImage> {
    const image = this.imageRepo.create({
      patientId: dto.patientId,
      toothNumber: dto.toothNumber,
      imageType: dto.imageType,
      filePath,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      takenById: userId,
      notes: dto.notes,
      tenantId,
    });
    return this.imageRepo.save(image);
  }

  async findPatientImages(
    patientId: string,
    tenantId: string,
    toothNumber?: string,
  ): Promise<DentalImage[]> {
    const where: any = { patientId, tenantId };
    if (toothNumber) {
      where.toothNumber = toothNumber;
    }
    return this.imageRepo.find({
      where,
      relations: ['takenBy'],
      order: { takenAt: 'DESC' },
    });
  }

  async deleteImage(id: string, tenantId: string): Promise<void> {
    const image = await this.imageRepo.findOne({
      where: { id, tenantId },
    });
    if (!image) {
      throw new NotFoundException('Dental image not found');
    }
    await this.imageRepo.softRemove(image);
  }

  // ============ LAB ORDERS ============

  async createLabOrder(
    dto: CreateLabOrderDto,
    tenantId: string,
    dentistId: string,
  ): Promise<DentalLabOrder> {
    const order = this.labOrderRepo.create({
      patientId: dto.patientId,
      dentistId,
      labName: dto.labName,
      orderType: dto.orderType,
      toothNumber: dto.toothNumber,
      shade: dto.shade,
      material: dto.material,
      impressionType: dto.impressionType,
      expectedAt: dto.expectedAt ? new Date(dto.expectedAt) : null,
      cost: dto.cost,
      notes: dto.notes,
      tenantId,
    });
    return this.labOrderRepo.save(order);
  }

  async findLabOrders(
    tenantId: string,
    status?: string,
  ): Promise<DentalLabOrder[]> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }
    return this.labOrderRepo.find({
      where,
      relations: ['patient', 'dentist'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateLabOrderStatus(
    id: string,
    dto: UpdateLabOrderStatusDto,
    tenantId: string,
  ): Promise<DentalLabOrder> {
    const order = await this.labOrderRepo.findOne({
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException('Lab order not found');
    }

    order.status = dto.status;
    if (dto.notes) {
      order.notes = dto.notes;
    }

    // Auto-set timestamps based on status transitions
    if (dto.status === 'sent' && !order.sentAt) {
      order.sentAt = new Date();
    }
    if (dto.status === 'received' && !order.receivedAt) {
      order.receivedAt = new Date();
    }

    return this.labOrderRepo.save(order);
  }

  async getLabOrderStats(tenantId: string): Promise<Record<string, number>> {
    const results = await this.labOrderRepo
      .createQueryBuilder('order')
      .select('order.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('order.tenantId = :tenantId', { tenantId })
      .andWhere('order.deletedAt IS NULL')
      .groupBy('order.status')
      .getRawMany();

    const stats: Record<string, number> = {};
    for (const row of results) {
      stats[row.status] = parseInt(row.count, 10);
    }
    return stats;
  }

  // ============ ORTHODONTICS ============

  async createCase(
    dto: CreateOrthoCaseDto,
    tenantId: string,
    orthodontistId: string,
  ): Promise<OrthodonticCase> {
    const orthoCase = this.orthoCaseRepo.create({
      patientId: dto.patientId,
      orthodontistId,
      caseType: dto.caseType,
      malocclusion: dto.malocclusion,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      estimatedEndDate: dto.estimatedEndDate ? new Date(dto.estimatedEndDate) : null,
      totalAligners: dto.totalAligners,
      adjustmentInterval: dto.adjustmentInterval || 4,
      estimatedCost: dto.estimatedCost,
      notes: dto.notes,
      tenantId,
    });
    return this.orthoCaseRepo.save(orthoCase);
  }

  async findCases(
    tenantId: string,
    status?: string,
  ): Promise<OrthodonticCase[]> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }
    return this.orthoCaseRepo.find({
      where,
      relations: ['patient', 'orthodontist'],
      order: { createdAt: 'DESC' },
    });
  }

  async getCase(id: string, tenantId: string): Promise<OrthodonticCase> {
    const orthoCase = await this.orthoCaseRepo.findOne({
      where: { id, tenantId },
      relations: ['patient', 'orthodontist'],
    });
    if (!orthoCase) {
      throw new NotFoundException('Orthodontic case not found');
    }
    return orthoCase;
  }

  async recordAdjustment(
    id: string,
    dto: RecordOrthoAdjustmentDto,
    tenantId: string,
  ): Promise<OrthodonticCase> {
    const orthoCase = await this.orthoCaseRepo.findOne({
      where: { id, tenantId },
    });
    if (!orthoCase) {
      throw new NotFoundException('Orthodontic case not found');
    }

    orthoCase.lastAdjustmentDate = new Date();
    if (dto.nextAdjustmentDate) {
      orthoCase.nextAdjustmentDate = new Date(dto.nextAdjustmentDate);
    }
    if (dto.currentAligner !== undefined) {
      orthoCase.currentAligner = dto.currentAligner;
    }
    if (dto.notes) {
      orthoCase.notes = dto.notes;
    }

    return this.orthoCaseRepo.save(orthoCase);
  }

  async updateCase(
    id: string,
    dto: UpdateOrthoCaseDto,
    tenantId: string,
  ): Promise<OrthodonticCase> {
    const orthoCase = await this.orthoCaseRepo.findOne({
      where: { id, tenantId },
    });
    if (!orthoCase) {
      throw new NotFoundException('Orthodontic case not found');
    }

    if (dto.caseType !== undefined) orthoCase.caseType = dto.caseType;
    if (dto.malocclusion !== undefined) orthoCase.malocclusion = dto.malocclusion;
    if (dto.startDate !== undefined) orthoCase.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.estimatedEndDate !== undefined) orthoCase.estimatedEndDate = dto.estimatedEndDate ? new Date(dto.estimatedEndDate) : null;
    if (dto.totalAligners !== undefined) orthoCase.totalAligners = dto.totalAligners;
    if (dto.currentAligner !== undefined) orthoCase.currentAligner = dto.currentAligner;
    if (dto.adjustmentInterval !== undefined) orthoCase.adjustmentInterval = dto.adjustmentInterval;
    if (dto.estimatedCost !== undefined) orthoCase.estimatedCost = dto.estimatedCost;
    if (dto.status !== undefined) orthoCase.status = dto.status;
    if (dto.notes !== undefined) orthoCase.notes = dto.notes;

    if (dto.status === 'completed') {
      orthoCase.actualEndDate = new Date();
    }

    return this.orthoCaseRepo.save(orthoCase);
  }

  // ============ PERIODONTICS ============

  async createPerioChart(
    dto: CreatePerioChartDto,
    tenantId: string,
    examinerId: string,
  ): Promise<PeriodontalChart> {
    const chart = this.perioChartRepo.create({
      patientId: dto.patientId,
      examinerId,
      measurements: dto.measurements,
      plaqueScore: dto.plaqueScore,
      bleedingOnProbing: dto.bleedingOnProbing,
      notes: dto.notes,
      tenantId,
    });
    return this.perioChartRepo.save(chart);
  }

  async findPatientPerioCharts(
    patientId: string,
    tenantId: string,
  ): Promise<PeriodontalChart[]> {
    return this.perioChartRepo.find({
      where: { patientId, tenantId },
      relations: ['examiner'],
      order: { examDate: 'DESC' },
    });
  }

  async getPerioChart(id: string, tenantId: string): Promise<PeriodontalChart> {
    const chart = await this.perioChartRepo.findOne({
      where: { id, tenantId },
      relations: ['patient', 'examiner'],
    });
    if (!chart) {
      throw new NotFoundException('Periodontal chart not found');
    }
    return chart;
  }

  async comparePerioCharts(
    patientId: string,
    tenantId: string,
  ): Promise<{ current: PeriodontalChart | null; previous: PeriodontalChart | null }> {
    const charts = await this.perioChartRepo.find({
      where: { patientId, tenantId },
      relations: ['examiner'],
      order: { examDate: 'DESC' },
      take: 2,
    });

    return {
      current: charts[0] || null,
      previous: charts[1] || null,
    };
  }
}
