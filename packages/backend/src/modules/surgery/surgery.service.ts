import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Theatre, TheatreStatus, TheatreType } from '../../database/entities/theatre.entity';
import { SurgeryCase, SurgeryStatus, SurgeryPriority } from '../../database/entities/surgery-case.entity';
import { SurgeryConsumable, ConsumableCategory } from '../../database/entities/surgery-consumable.entity';
import { Item, StockBalance } from '../../database/entities/inventory.entity';
import {
  ScheduleSurgeryDto,
  PreOpChecklistDto,
  StartSurgeryDto,
  IntraOpNotesDto,
  CompleteSurgeryDto,
  CancelSurgeryDto,
  CreateTheatreDto,
  UpdateTheatreStatusDto,
  RecordConsumableDto,
} from './dto/surgery.dto';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class SurgeryService {
  constructor(
    @InjectRepository(Theatre)
    private theatreRepo: Repository<Theatre>,
    @InjectRepository(SurgeryCase)
    private surgeryCaseRepo: Repository<SurgeryCase>,
    @InjectRepository(SurgeryConsumable)
    private consumableRepo: Repository<SurgeryConsumable>,
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
    private inventoryService: InventoryService,
  ) {}

  // ============ THEATRE MANAGEMENT ============

  async createTheatre(dto: CreateTheatreDto): Promise<Theatre> {
    const theatre = this.theatreRepo.create({
      ...dto,
      type: dto.type as TheatreType,
    });
    return this.theatreRepo.save(theatre);
  }

  async getTheatres(facilityId: string): Promise<Theatre[]> {
    return this.theatreRepo.find({
      where: { facilityId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async getTheatreById(id: string): Promise<Theatre> {
    const theatre = await this.theatreRepo.findOne({
      where: { id },
      relations: ['facility'],
    });
    if (!theatre) throw new NotFoundException('Theatre not found');
    return theatre;
  }

  async updateTheatreStatus(id: string, dto: UpdateTheatreStatusDto): Promise<Theatre> {
    const theatre = await this.getTheatreById(id);
    theatre.status = dto.status as TheatreStatus;
    return this.theatreRepo.save(theatre);
  }

  // ============ SURGERY SCHEDULING ============

  private async generateCaseNumber(facilityId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.surgeryCaseRepo.count({
      where: {
        facilityId,
        createdAt: Between(startOfDay, endOfDay),
      },
    });

    return `SUR${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async scheduleSurgery(dto: ScheduleSurgeryDto, userId: string): Promise<SurgeryCase> {
    // Check theatre availability
    const conflicts = await this.checkTheatreConflicts(
      dto.theatreId,
      dto.scheduledDate,
      dto.scheduledTime,
      dto.estimatedDurationMinutes,
    );

    if (conflicts.length > 0) {
      throw new BadRequestException(
        `Theatre has ${conflicts.length} conflicting surgery at the requested time`,
      );
    }

    const caseNumber = await this.generateCaseNumber(dto.facilityId);

    const surgeryCase = this.surgeryCaseRepo.create({
      caseNumber,
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      theatreId: dto.theatreId,
      procedureName: dto.procedureName,
      procedureCode: dto.procedureCode,
      diagnosis: dto.diagnosis,
      surgeryType: dto.surgeryType,
      priority: dto.priority,
      scheduledDate: dto.scheduledDate,
      scheduledTime: dto.scheduledTime,
      estimatedDurationMinutes: dto.estimatedDurationMinutes,
      leadSurgeonId: dto.leadSurgeonId,
      assistantSurgeonId: dto.assistantSurgeonId,
      anesthesiologistId: dto.anesthesiologistId,
      anesthesiaType: dto.anesthesiaType,
      facilityId: dto.facilityId,
      createdById: userId,
      status: SurgeryStatus.SCHEDULED,
    });

    return this.surgeryCaseRepo.save(surgeryCase);
  }

  async checkTheatreConflicts(
    theatreId: string,
    date: string,
    time: string,
    durationMinutes: number,
    excludeCaseId?: string,
  ): Promise<SurgeryCase[]> {
    const cases = await this.surgeryCaseRepo.find({
      where: {
        theatreId,
        scheduledDate: new Date(date),
        status: SurgeryStatus.SCHEDULED,
      },
    });

    // Simple time overlap check
    const requestedStart = this.timeToMinutes(time);
    const requestedEnd = requestedStart + durationMinutes;

    return cases.filter((c) => {
      if (excludeCaseId && c.id === excludeCaseId) return false;
      const caseStart = this.timeToMinutes(c.scheduledTime);
      const caseEnd = caseStart + c.estimatedDurationMinutes;
      return requestedStart < caseEnd && requestedEnd > caseStart;
    });
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // ============ SURGERY WORKFLOW ============

  async getCaseById(id: string): Promise<SurgeryCase> {
    const surgeryCase = await this.surgeryCaseRepo.findOne({
      where: { id },
      relations: ['patient', 'theatre', 'leadSurgeon', 'anesthesiologist', 'encounter'],
    });
    if (!surgeryCase) throw new NotFoundException('Surgery case not found');
    return surgeryCase;
  }

  async updatePreOpChecklist(id: string, dto: PreOpChecklistDto): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id);

    if (surgeryCase.status !== SurgeryStatus.SCHEDULED && surgeryCase.status !== SurgeryStatus.PRE_OP) {
      throw new BadRequestException('Cannot update pre-op checklist at this stage');
    }

    surgeryCase.preOpChecklist = dto.checklist;
    surgeryCase.preOpNotes = dto.preOpNotes || surgeryCase.preOpNotes;
    
    if (dto.consentSigned !== undefined) {
      surgeryCase.consentSigned = dto.consentSigned;
      if (dto.consentSigned) surgeryCase.consentSignedAt = new Date();
    }
    
    if (dto.bloodAvailable !== undefined) surgeryCase.bloodAvailable = dto.bloodAvailable;
    if (dto.bloodGroup) surgeryCase.bloodGroup = dto.bloodGroup;

    surgeryCase.status = SurgeryStatus.PRE_OP;

    return this.surgeryCaseRepo.save(surgeryCase);
  }

  async startSurgery(id: string, dto: StartSurgeryDto): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id);

    if (surgeryCase.status !== SurgeryStatus.PRE_OP && surgeryCase.status !== SurgeryStatus.SCHEDULED) {
      throw new BadRequestException('Surgery cannot be started from current status');
    }

    // Check if consent is signed for elective surgeries
    if (surgeryCase.priority === SurgeryPriority.ELECTIVE && !surgeryCase.consentSigned) {
      throw new BadRequestException('Consent must be signed before starting elective surgery');
    }

    surgeryCase.status = SurgeryStatus.IN_PROGRESS;
    surgeryCase.actualStartTime = new Date();
    
    if (dto.anesthesiaNotes) surgeryCase.anesthesiaNotes = dto.anesthesiaNotes;
    if (dto.nursingTeam) surgeryCase.nursingTeam = dto.nursingTeam;

    // Update theatre status
    await this.theatreRepo.update(surgeryCase.theatreId, { status: TheatreStatus.IN_USE });

    return this.surgeryCaseRepo.save(surgeryCase);
  }

  async updateIntraOpNotes(id: string, dto: IntraOpNotesDto): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id);

    if (surgeryCase.status !== SurgeryStatus.IN_PROGRESS) {
      throw new BadRequestException('Intra-operative notes can only be added during surgery');
    }

    if (dto.operativeFindings) surgeryCase.operativeFindings = dto.operativeFindings;
    if (dto.operativeNotes) surgeryCase.operativeNotes = dto.operativeNotes;
    if (dto.complications) surgeryCase.complications = dto.complications;
    if (dto.bloodLossMl !== undefined) surgeryCase.bloodLossMl = dto.bloodLossMl;
    if (dto.specimensCollected) surgeryCase.specimensCollected = dto.specimensCollected;

    return this.surgeryCaseRepo.save(surgeryCase);
  }

  async completeSurgery(id: string, dto: CompleteSurgeryDto): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id);

    if (surgeryCase.status !== SurgeryStatus.IN_PROGRESS) {
      throw new BadRequestException('Only in-progress surgeries can be completed');
    }

    surgeryCase.status = SurgeryStatus.POST_OP;
    surgeryCase.actualEndTime = new Date();
    surgeryCase.operativeFindings = dto.operativeFindings;
    surgeryCase.operativeNotes = dto.operativeNotes;
    if (dto.bloodLossMl !== undefined) surgeryCase.bloodLossMl = dto.bloodLossMl;
    if (dto.postOpDiagnosis) surgeryCase.postOpDiagnosis = dto.postOpDiagnosis;
    if (dto.postOpInstructions) surgeryCase.postOpInstructions = dto.postOpInstructions;
    if (dto.recoveryNotes) surgeryCase.recoveryNotes = dto.recoveryNotes;
    surgeryCase.dischargeDestination = dto.dischargeDestination;
    surgeryCase.dischargeFromTheatre = new Date();

    // Update theatre to cleaning
    await this.theatreRepo.update(surgeryCase.theatreId, { status: TheatreStatus.CLEANING });

    return this.surgeryCaseRepo.save(surgeryCase);
  }

  async dischargeFromRecovery(id: string): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id);

    if (surgeryCase.status !== SurgeryStatus.POST_OP) {
      throw new BadRequestException('Only post-op cases can be discharged from recovery');
    }

    surgeryCase.status = SurgeryStatus.COMPLETED;
    return this.surgeryCaseRepo.save(surgeryCase);
  }

  async cancelSurgery(id: string, dto: CancelSurgeryDto): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id);

    if (surgeryCase.status === SurgeryStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot cancel surgery that is in progress');
    }

    if (surgeryCase.status === SurgeryStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed surgery');
    }

    if (dto.newDate && dto.newTime) {
      // Postpone
      surgeryCase.status = SurgeryStatus.POSTPONED;
      surgeryCase.scheduledDate = new Date(dto.newDate);
      surgeryCase.scheduledTime = dto.newTime;
      surgeryCase.preOpNotes = `${surgeryCase.preOpNotes || ''}\n[POSTPONED] ${dto.reason}`.trim();
    } else {
      // Cancel
      surgeryCase.status = SurgeryStatus.CANCELLED;
      surgeryCase.preOpNotes = `${surgeryCase.preOpNotes || ''}\n[CANCELLED] ${dto.reason}`.trim();
    }

    return this.surgeryCaseRepo.save(surgeryCase);
  }

  // ============ SCHEDULE & DASHBOARD ============

  async getTodaySchedule(facilityId: string): Promise<SurgeryCase[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.surgeryCaseRepo.find({
      where: {
        facilityId,
        scheduledDate: Between(today, tomorrow),
        status: SurgeryStatus.SCHEDULED,
      },
      relations: ['patient', 'theatre', 'leadSurgeon'],
      order: { scheduledTime: 'ASC' },
    });
  }

  async getScheduleByDate(facilityId: string, date: string): Promise<SurgeryCase[]> {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.surgeryCaseRepo.find({
      where: {
        facilityId,
        scheduledDate: Between(targetDate, nextDay),
      },
      relations: ['patient', 'theatre', 'leadSurgeon'],
      order: { scheduledTime: 'ASC' },
    });
  }

  async getWeekSchedule(facilityId: string, startDate?: string): Promise<SurgeryCase[]> {
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return this.surgeryCaseRepo.find({
      where: {
        facilityId,
        scheduledDate: Between(start, end),
      },
      relations: ['patient', 'theatre', 'leadSurgeon'],
      order: { scheduledDate: 'ASC', scheduledTime: 'ASC' },
    });
  }

  async getDashboard(facilityId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayScheduled, inProgress, postOp, theatres] = await Promise.all([
      this.surgeryCaseRepo.count({
        where: {
          facilityId,
          scheduledDate: Between(today, tomorrow),
          status: SurgeryStatus.SCHEDULED,
        },
      }),
      this.surgeryCaseRepo.find({
        where: { facilityId, status: SurgeryStatus.IN_PROGRESS },
        relations: ['patient', 'theatre', 'leadSurgeon'],
      }),
      this.surgeryCaseRepo.find({
        where: { facilityId, status: SurgeryStatus.POST_OP },
        relations: ['patient', 'theatre'],
      }),
      this.theatreRepo.find({ where: { facilityId, isActive: true } }),
    ]);

    return {
      todayScheduledCount: todayScheduled,
      inProgressCount: inProgress.length,
      inProgressCases: inProgress,
      postOpCount: postOp.length,
      postOpCases: postOp,
      theatres: theatres.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        type: t.type,
        status: t.status,
      })),
      theatreAvailable: theatres.filter((t) => t.status === TheatreStatus.AVAILABLE).length,
      theatreInUse: theatres.filter((t) => t.status === TheatreStatus.IN_USE).length,
    };
  }

  async getCases(facilityId: string, options: { status?: SurgeryStatus; limit?: number; offset?: number }) {
    const where: any = { facilityId };
    if (options.status) where.status = options.status;

    const [data, total] = await this.surgeryCaseRepo.findAndCount({
      where,
      relations: ['patient', 'theatre', 'leadSurgeon'],
      order: { scheduledDate: 'DESC', scheduledTime: 'DESC' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    return { data, meta: { total, limit: options.limit || 50, offset: options.offset || 0 } };
  }

  // ============ CONSUMABLES TRACKING ============

  async recordConsumable(dto: RecordConsumableDto, userId: string): Promise<SurgeryConsumable> {
    const surgeryCase = await this.getCaseById(dto.surgeryCaseId);
    
    // Get item details
    const item = await this.itemRepo.findOne({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException('Item not found');

    const totalCost = dto.quantityUsed * dto.unitCost;

    const consumable = this.consumableRepo.create({
      surgeryCaseId: dto.surgeryCaseId,
      itemId: dto.itemId,
      itemCode: item.code,
      itemName: item.name,
      category: dto.category || ConsumableCategory.SURGICAL_SUPPLIES,
      quantityUsed: dto.quantityUsed,
      unit: item.unit || 'unit',
      unitCost: dto.unitCost,
      totalCost,
      batchNumber: dto.batchNumber,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      usagePhase: dto.usagePhase,
      usedAt: new Date(),
      isBillable: dto.isBillable ?? true,
      isDeductedFromStock: false,
      notes: dto.notes,
      recordedById: userId,
    });

    const saved = await this.consumableRepo.save(consumable);

    // Deduct from inventory if requested
    if (dto.deductFromStock) {
      try {
        await this.inventoryService.deductStock(
          dto.itemId,
          surgeryCase.facilityId,
          dto.quantityUsed,
          'surgery_case',
          dto.surgeryCaseId,
          userId,
        );
        saved.isDeductedFromStock = true;
        await this.consumableRepo.save(saved);
      } catch (error) {
        // Log but don't fail - stock might not be available
        console.warn(`Failed to deduct stock for surgery consumable: ${error.message}`);
      }
    }

    return saved;
  }

  async recordMultipleConsumables(
    surgeryCaseId: string,
    items: RecordConsumableDto[],
    userId: string,
  ): Promise<SurgeryConsumable[]> {
    const results: SurgeryConsumable[] = [];
    for (const item of items) {
      const consumable = await this.recordConsumable({ ...item, surgeryCaseId }, userId);
      results.push(consumable);
    }
    return results;
  }

  async getConsumables(surgeryCaseId: string): Promise<SurgeryConsumable[]> {
    return this.consumableRepo.find({
      where: { surgeryCaseId },
      relations: ['item', 'recordedBy'],
      order: { usedAt: 'ASC' },
    });
  }

  async getConsumablesSummary(surgeryCaseId: string): Promise<{
    items: SurgeryConsumable[];
    totalCost: number;
    billableTotal: number;
    byCategory: Record<string, number>;
    byPhase: Record<string, number>;
  }> {
    const items = await this.getConsumables(surgeryCaseId);

    let totalCost = 0;
    let billableTotal = 0;
    const byCategory: Record<string, number> = {};
    const byPhase: Record<string, number> = {};

    for (const item of items) {
      totalCost += Number(item.totalCost);
      if (item.isBillable) billableTotal += Number(item.totalCost);

      byCategory[item.category] = (byCategory[item.category] || 0) + Number(item.totalCost);
      byPhase[item.usagePhase] = (byPhase[item.usagePhase] || 0) + Number(item.totalCost);
    }

    return { items, totalCost, billableTotal, byCategory, byPhase };
  }

  async updateConsumable(id: string, updates: Partial<RecordConsumableDto>): Promise<SurgeryConsumable> {
    const consumable = await this.consumableRepo.findOne({ where: { id } });
    if (!consumable) throw new NotFoundException('Consumable not found');

    if (updates.quantityUsed !== undefined) {
      consumable.quantityUsed = updates.quantityUsed;
      consumable.totalCost = updates.quantityUsed * Number(consumable.unitCost);
    }
    if (updates.notes !== undefined) consumable.notes = updates.notes;

    return this.consumableRepo.save(consumable);
  }

  async deleteConsumable(id: string): Promise<void> {
    const consumable = await this.consumableRepo.findOne({ where: { id } });
    if (!consumable) throw new NotFoundException('Consumable not found');
    await this.consumableRepo.remove(consumable);
  }

  async getConsumablesReport(facilityId: string, startDate: string, endDate: string) {
    const cases = await this.surgeryCaseRepo.find({
      where: {
        facilityId,
        actualStartTime: Between(new Date(startDate), new Date(endDate)),
      },
    });

    const caseIds = cases.map(c => c.id);
    if (caseIds.length === 0) return { surgeries: 0, consumables: [], totalCost: 0 };

    const consumables = await this.consumableRepo
      .createQueryBuilder('c')
      .select('c.itemId', 'itemId')
      .addSelect('c.itemName', 'itemName')
      .addSelect('c.category', 'category')
      .addSelect('SUM(c.quantityUsed)', 'totalQuantity')
      .addSelect('SUM(c.totalCost)', 'totalCost')
      .addSelect('COUNT(DISTINCT c.surgeryCaseId)', 'surgeryCount')
      .where('c.surgeryCaseId IN (:...caseIds)', { caseIds })
      .groupBy('c.itemId')
      .addGroupBy('c.itemName')
      .addGroupBy('c.category')
      .orderBy('SUM(c.totalCost)', 'DESC')
      .getRawMany();

    const totalCost = consumables.reduce((sum, c) => sum + Number(c.totalCost), 0);

    return {
      surgeries: cases.length,
      consumables,
      totalCost,
    };
  }
}
