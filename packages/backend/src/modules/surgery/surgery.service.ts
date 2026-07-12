import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { BillingService } from '../billing/billing.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, MoreThanOrEqual, LessThanOrEqual, DataSource } from 'typeorm';
import { Theatre, TheatreStatus, TheatreType } from '../../database/entities/theatre.entity';
import {
  SurgeryCase,
  SurgeryStatus,
  SurgeryPriority,
} from '../../database/entities/surgery-case.entity';
import {
  SurgeryConsumable,
  ConsumableCategory,
} from '../../database/entities/surgery-consumable.entity';
import {
  Item,
  StockBalance,
  StockLedger,
  MovementType,
} from '../../database/entities/inventory.entity';
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
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class SurgeryService {
  private readonly logger = new Logger(SurgeryService.name);

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
    private dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    @Optional()
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService | null,
  ) {}

  // ============ THEATRE MANAGEMENT ============

  async createTheatre(dto: CreateTheatreDto, tenantId?: string): Promise<Theatre> {
    const tid = requireTenantId(tenantId);
    const theatre = this.theatreRepo.create({
      ...dto,
      type: dto.type as TheatreType,
    });
    theatre.tenantId = tid;
    return this.theatreRepo.save(theatre);
  }

  async getTheatres(facilityId: string, tenantId?: string): Promise<Theatre[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { facilityId, isActive: true };
    where.tenantId = tid;

    return this.theatreRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  async getTheatreById(id: string, tenantId?: string): Promise<Theatre> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;

    const theatre = await this.theatreRepo.findOne({
      where,
      relations: ['facility'],
    });
    if (!theatre) throw new NotFoundException('Theatre not found');
    return theatre;
  }

  async updateTheatreStatus(
    id: string,
    dto: UpdateTheatreStatusDto,
    tenantId?: string,
  ): Promise<Theatre> {
    const theatre = await this.getTheatreById(id, tenantId);
    theatre.status = dto.status as TheatreStatus;
    return this.theatreRepo.save(theatre);
  }

  // ============ SURGERY SCHEDULING ============

  /**
   * MAX+1 per TENANT under an advisory lock. The old version counted per
   * facility with no facility component in the number (same-tenant collision)
   * and read through the repository, escaping the caller's transaction.
   */
  private async generateCaseNumber(
    tid: string,
    manager: import('typeorm').EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
      today.getDate(),
    ).padStart(2, '0')}`;
    const prefix = `SUR${dateStr}-`;

    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `surgery_case_number:${tid}:${dateStr}`,
    ]);

    const last = await manager
      .createQueryBuilder(SurgeryCase, 's')
      .where('s.case_number LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('s.tenant_id = :tid', { tid })
      .orderBy('s.case_number', 'DESC')
      .getOne();

    const seq = last ? (parseInt(last.caseNumber.slice(prefix.length), 10) || 0) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /** Statuses that occupy a theatre slot for conflict purposes. */
  private static readonly SLOT_BLOCKING_STATUSES = [
    SurgeryStatus.SCHEDULED,
    SurgeryStatus.PRE_OP,
    SurgeryStatus.IN_PROGRESS,
  ];

  async scheduleSurgery(
    dto: ScheduleSurgeryDto,
    userId: string,
    tenantId?: string,
  ): Promise<SurgeryCase> {
    const tid = requireTenantId(tenantId);
    return this.dataSource.transaction(async (manager) => {
      // Lock the theatre row to prevent concurrent scheduling race conditions
      const theatreQb = manager
        .createQueryBuilder(Theatre, 'theatre')
        .setLock('pessimistic_write')
        .where('theatre.id = :id', { id: dto.theatreId });
      theatreQb.andWhere('theatre.tenant_id = :tenantId', { tenantId: tid });
      const theatre = await theatreQb.getOne();

      if (!theatre) {
        throw new NotFoundException('Theatre not found');
      }

      // Check theatre availability within the lock. PRE_OP and IN_PROGRESS
      // cases still occupy the slot — checking only SCHEDULED allowed
      // double-booking as soon as a case moved to pre-op.
      const existingCases = await manager.find(SurgeryCase, {
        where: {
          theatreId: dto.theatreId,
          scheduledDate: new Date(dto.scheduledDate),
          status: In(SurgeryService.SLOT_BLOCKING_STATUSES),
          tenantId: tid,
        },
      });

      const requestedStart = this.timeToMinutes(dto.scheduledTime);
      const requestedEnd = requestedStart + dto.estimatedDurationMinutes;

      const conflicts = existingCases.filter((c) => {
        const caseStart = this.timeToMinutes(c.scheduledTime);
        const caseEnd = caseStart + c.estimatedDurationMinutes;
        return requestedStart < caseEnd && requestedEnd > caseStart;
      });

      if (conflicts.length > 0) {
        throw new BadRequestException(
          `Theatre has ${conflicts.length} conflicting surgery at the requested time`,
        );
      }

      const caseNumber = await this.generateCaseNumber(tid, manager);

      const surgeryCase = manager.create(SurgeryCase, {
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
      surgeryCase.tenantId = tid;

      const saved = await manager.save(surgeryCase);

      this.auditLogService
        .log({
          action: 'SCHEDULE_SURGERY',
          entityType: 'SurgeryCase',
          entityId: saved.id,
          userId,
          tenantId,
          newValue: {
            caseNumber: saved.caseNumber,
            status: SurgeryStatus.SCHEDULED,
            procedureName: dto.procedureName,
          },
        })
        .catch(() => {});

      return saved;
    });
  }

  async checkTheatreConflicts(
    theatreId: string,
    date: string,
    time: string,
    durationMinutes: number,
    excludeCaseId?: string,
    tenantId?: string,
  ): Promise<SurgeryCase[]> {
    const tid = requireTenantId(tenantId);
    const where: any = {
      theatreId,
      scheduledDate: new Date(date),
      status: In(SurgeryService.SLOT_BLOCKING_STATUSES),
    };
    where.tenantId = tid;

    const cases = await this.surgeryCaseRepo.find({
      where,
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

  async getCaseById(id: string, tenantId?: string): Promise<SurgeryCase> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;

    const surgeryCase = await this.surgeryCaseRepo.findOne({
      where,
      relations: ['patient', 'theatre', 'leadSurgeon', 'anesthesiologist', 'encounter'],
    });
    if (!surgeryCase) throw new NotFoundException('Surgery case not found');
    return surgeryCase;
  }

  async updatePreOpChecklist(
    id: string,
    dto: PreOpChecklistDto,
    tenantId?: string,
  ): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id, tenantId);

    if (
      surgeryCase.status !== SurgeryStatus.SCHEDULED &&
      surgeryCase.status !== SurgeryStatus.PRE_OP
    ) {
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

  async startSurgery(id: string, dto: StartSurgeryDto, tenantId?: string): Promise<SurgeryCase> {
    const tid = requireTenantId(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const surgeryCase = await manager.findOne(SurgeryCase, {
        where: { id, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!surgeryCase) throw new NotFoundException('Surgery case not found');

      if (
      surgeryCase.status !== SurgeryStatus.PRE_OP &&
      surgeryCase.status !== SurgeryStatus.SCHEDULED
    ) {
      throw new BadRequestException('Surgery cannot be started from current status');
    }

    // Check if consent is signed for elective surgeries
    if (surgeryCase.priority === SurgeryPriority.ELECTIVE && !surgeryCase.consentSigned) {
      throw new BadRequestException('Consent must be signed before starting elective surgery');
    }

    // Validate pre-op checklist is complete before allowing transition to IN_PROGRESS
    if (!surgeryCase.preOpChecklist || surgeryCase.preOpChecklist.length === 0) {
      throw new BadRequestException(
        'Pre-operative checklist must be completed before starting surgery',
      );
    }
    const uncheckedItems = surgeryCase.preOpChecklist.filter((item) => !item.checked);
    if (uncheckedItems.length > 0) {
      throw new BadRequestException(
        `Pre-operative checklist is incomplete. ${uncheckedItems.length} item(s) not checked: ${uncheckedItems.map((i) => i.item).join(', ')}`,
      );
    }

    const previousStatus = surgeryCase.status;
    surgeryCase.status = SurgeryStatus.IN_PROGRESS;
    surgeryCase.actualStartTime = new Date();

    if (dto.anesthesiaNotes) surgeryCase.anesthesiaNotes = dto.anesthesiaNotes;
    if (dto.nursingTeam) surgeryCase.nursingTeam = dto.nursingTeam;

    // Update theatre status atomically with the case
    await manager.update(Theatre, surgeryCase.theatreId, { status: TheatreStatus.IN_USE });

    const saved = await manager.save(surgeryCase);

    this.auditLogService
      .log({
        action: 'START_SURGERY',
        entityType: 'SurgeryCase',
        entityId: id,
        tenantId,
        oldValue: { status: previousStatus },
        newValue: { status: SurgeryStatus.IN_PROGRESS },
      })
      .catch(() => {});

    return saved;
    });
  }

  async updateIntraOpNotes(
    id: string,
    dto: IntraOpNotesDto,
    tenantId?: string,
  ): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id, tenantId);

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

  async completeSurgery(
    id: string,
    dto: CompleteSurgeryDto,
    tenantId?: string,
    userId?: string,
  ): Promise<SurgeryCase> {
    const tid = requireTenantId(tenantId);
    const completed = await this.dataSource.transaction(async (manager) => {
      const surgeryCase = await manager.findOne(SurgeryCase, {
        where: { id, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!surgeryCase) throw new NotFoundException('Surgery case not found');

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

      // Update theatre to cleaning atomically with the case
      await manager.update(Theatre, surgeryCase.theatreId, { status: TheatreStatus.CLEANING });

      const saved = await manager.save(surgeryCase);

      this.auditLogService
        .log({
          action: 'COMPLETE_SURGERY',
          entityType: 'SurgeryCase',
          entityId: id,
          tenantId,
          oldValue: { status: SurgeryStatus.IN_PROGRESS },
          newValue: { status: SurgeryStatus.POST_OP },
        })
        .catch(() => {});

      return saved;
    });

    // Post billable theatre consumables to the encounter invoice AFTER the
    // commit (BillingService runs its own transactions). Previously
    // billableTotal was computed for display but never billed — a straight
    // revenue leak for theatre supplies. addBillableItem dedups on
    // (referenceType, referenceId), so re-completing cannot double-bill.
    await this.postConsumablesToBilling(completed, userId, tenantId);

    return completed;
  }

  /** Best-effort: bill each billable consumable onto the case's encounter. */
  private async postConsumablesToBilling(
    surgeryCase: SurgeryCase,
    userId?: string,
    tenantId?: string,
  ): Promise<void> {
    if (!this.billingService || !surgeryCase.encounterId || !surgeryCase.patientId) return;
    try {
      const consumables = await this.consumableRepo.find({
        where: {
          surgeryCaseId: surgeryCase.id,
          isBillable: true,
          tenantId: requireTenantId(tenantId),
        },
      });
      for (const c of consumables) {
        try {
          await this.billingService.addBillableItem(
            {
              encounterId: surgeryCase.encounterId,
              patientId: surgeryCase.patientId,
              serviceCode: c.itemCode || `SURG-CONS-${c.id.slice(0, 8)}`,
              description: `Theatre consumable – ${c.itemName}`,
              quantity: Number(c.quantityUsed),
              unitPrice: Number(c.unitCost),
              chargeType: 'procedure',
              referenceType: 'surgery_consumable',
              referenceId: c.id,
            },
            userId || 'system',
            tenantId,
          );
        } catch (err: any) {
          this.logger.warn(
            `Billing consumable ${c.id} for surgery ${surgeryCase.caseNumber} failed: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Consumable billing sweep failed for surgery ${surgeryCase.caseNumber}: ${err.message}`,
      );
    }
  }

  async dischargeFromRecovery(id: string, tenantId?: string): Promise<SurgeryCase> {
    const surgeryCase = await this.getCaseById(id, tenantId);

    if (surgeryCase.status !== SurgeryStatus.POST_OP) {
      throw new BadRequestException('Only post-op cases can be discharged from recovery');
    }

    surgeryCase.status = SurgeryStatus.COMPLETED;
    return this.surgeryCaseRepo.save(surgeryCase);
  }

  /**
   * POSTPONED → SCHEDULED. Postponed cases hold a new date/time but nothing
   * moved them back onto the day lists — this closes that gap. The held slot
   * is conflict-checked again since other cases may have taken it meanwhile.
   */
  async reconfirmSurgery(id: string, tenantId?: string): Promise<SurgeryCase> {
    const tid = requireTenantId(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const surgeryCase = await manager.findOne(SurgeryCase, {
        where: { id, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!surgeryCase) throw new NotFoundException('Surgery case not found');
      if (surgeryCase.status !== SurgeryStatus.POSTPONED) {
        throw new BadRequestException(
          `Only postponed surgeries can be reconfirmed (current: ${surgeryCase.status})`,
        );
      }

      const dateStr =
        surgeryCase.scheduledDate instanceof Date
          ? surgeryCase.scheduledDate.toISOString().slice(0, 10)
          : String(surgeryCase.scheduledDate);
      const conflicts = await this.checkTheatreConflicts(
        surgeryCase.theatreId,
        dateStr,
        surgeryCase.scheduledTime,
        surgeryCase.estimatedDurationMinutes,
        surgeryCase.id,
        tenantId,
      );
      if (conflicts.length > 0) {
        throw new BadRequestException(
          `Theatre has ${conflicts.length} conflicting surgery at the held slot — postpone again with a new time`,
        );
      }

      surgeryCase.status = SurgeryStatus.SCHEDULED;
      surgeryCase.preOpNotes = `${surgeryCase.preOpNotes || ''}\n[RECONFIRMED]`.trim();
      const saved = await manager.save(surgeryCase);

      this.auditLogService
        .log({
          action: 'RECONFIRM_SURGERY',
          entityType: 'SurgeryCase',
          entityId: id,
          tenantId,
          oldValue: { status: SurgeryStatus.POSTPONED },
          newValue: { status: SurgeryStatus.SCHEDULED },
        })
        .catch(() => {});

      return saved;
    });
  }

  async cancelSurgery(id: string, dto: CancelSurgeryDto, tenantId?: string): Promise<SurgeryCase> {
    const tid = requireTenantId(tenantId);
    return this.dataSource.transaction(async (manager) => {
      const surgeryCase = await manager.findOne(SurgeryCase, {
        where: { id, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!surgeryCase) throw new NotFoundException('Surgery case not found');

      if (surgeryCase.status === SurgeryStatus.IN_PROGRESS) {
        throw new BadRequestException('Cannot cancel surgery that is in progress');
      }

      if (surgeryCase.status === SurgeryStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel completed surgery');
      }

      const previousStatus = surgeryCase.status;

      if (dto.newDate && dto.newTime) {
        // Postpone — the new slot must be free (this path skipped the
        // conflict check entirely before)
        const conflicts = await this.checkTheatreConflicts(
          surgeryCase.theatreId,
          dto.newDate,
          dto.newTime,
          surgeryCase.estimatedDurationMinutes,
          surgeryCase.id,
          tenantId,
        );
        if (conflicts.length > 0) {
          throw new BadRequestException(
            `Theatre has ${conflicts.length} conflicting surgery at the requested new time`,
          );
        }
        surgeryCase.status = SurgeryStatus.POSTPONED;
        surgeryCase.scheduledDate = new Date(dto.newDate);
        surgeryCase.scheduledTime = dto.newTime;
        surgeryCase.preOpNotes =
          `${surgeryCase.preOpNotes || ''}\n[POSTPONED] ${dto.reason}`.trim();
      } else {
        // Cancel
        surgeryCase.status = SurgeryStatus.CANCELLED;
        surgeryCase.preOpNotes =
          `${surgeryCase.preOpNotes || ''}\n[CANCELLED] ${dto.reason}`.trim();
      }

      const saved = await manager.save(surgeryCase);

      this.auditLogService
        .log({
          action: 'CANCEL_SURGERY',
          entityType: 'SurgeryCase',
          entityId: id,
          tenantId,
          oldValue: { status: previousStatus },
          newValue: { status: saved.status, reason: dto.reason },
        })
        .catch(() => {});

      return saved;
    });
  }

  // ============ SCHEDULE & DASHBOARD ============

  async getTodaySchedule(facilityId: string, tenantId?: string): Promise<SurgeryCase[]> {
    const tid = requireTenantId(tenantId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // PRE_OP and IN_PROGRESS cases are still today's workload — filtering
    // only SCHEDULED made cases vanish from the list once prepped
    const where: any = {
      facilityId,
      scheduledDate: Between(today, tomorrow),
      status: In(SurgeryService.SLOT_BLOCKING_STATUSES),
    };
    where.tenantId = tid;

    return this.surgeryCaseRepo.find({
      where,
      relations: ['patient', 'theatre', 'leadSurgeon'],
      order: { scheduledTime: 'ASC' },
    });
  }

  async getScheduleByDate(
    facilityId: string,
    date: string,
    tenantId?: string,
  ): Promise<SurgeryCase[]> {
    const tid = requireTenantId(tenantId);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const where: any = {
      facilityId,
      scheduledDate: Between(targetDate, nextDay),
    };
    where.tenantId = tid;

    return this.surgeryCaseRepo.find({
      where,
      relations: ['patient', 'theatre', 'leadSurgeon'],
      order: { scheduledTime: 'ASC' },
    });
  }

  async getWeekSchedule(
    facilityId: string,
    startDate?: string,
    tenantId?: string,
  ): Promise<SurgeryCase[]> {
    const tid = requireTenantId(tenantId);
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const where: any = {
      facilityId,
      scheduledDate: Between(start, end),
    };
    where.tenantId = tid;

    return this.surgeryCaseRepo.find({
      where,
      relations: ['patient', 'theatre', 'leadSurgeon'],
      order: { scheduledDate: 'ASC', scheduledTime: 'ASC' },
    });
  }

  async getDashboard(facilityId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayScheduledWhere: any = {
      facilityId,
      scheduledDate: Between(today, tomorrow),
      status: SurgeryStatus.SCHEDULED,
    };
    todayScheduledWhere.tenantId = tid;

    const inProgressWhere: any = { facilityId, status: SurgeryStatus.IN_PROGRESS };
    inProgressWhere.tenantId = tid;

    const postOpWhere: any = { facilityId, status: SurgeryStatus.POST_OP };
    postOpWhere.tenantId = tid;

    const theatreWhere: any = { facilityId, isActive: true };
    theatreWhere.tenantId = tid;

    const [todayScheduled, inProgress, postOp, theatres] = await Promise.all([
      this.surgeryCaseRepo.count({
        where: todayScheduledWhere,
      }),
      this.surgeryCaseRepo.find({
        where: inProgressWhere,
        relations: ['patient', 'theatre', 'leadSurgeon'],
      }),
      this.surgeryCaseRepo.find({
        where: postOpWhere,
        relations: ['patient', 'theatre'],
      }),
      this.theatreRepo.find({ where: theatreWhere }),
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

  async getCases(
    facilityId: string,
    options: { status?: SurgeryStatus; limit?: number; offset?: number },
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    const where: any = { facilityId };
    if (options.status) where.status = options.status;
    where.tenantId = tid;

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

  async recordConsumable(
    dto: RecordConsumableDto,
    userId: string,
    tenantId?: string,
  ): Promise<SurgeryConsumable> {
    const surgeryCase = await this.getCaseById(dto.surgeryCaseId, tenantId);

    // Get item details
    const itemWhere: any = { id: dto.itemId };
    itemWhere.tenantId = requireTenantId(tenantId);
    const item = await this.itemRepo.findOne({ where: itemWhere });
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
    consumable.tenantId = requireTenantId(tenantId);

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
        this.logger.warn(`Failed to deduct stock for surgery consumable: ${error.message}`);
      }
    }

    return saved;
  }

  async recordMultipleConsumables(
    surgeryCaseId: string,
    items: RecordConsumableDto[],
    userId: string,
    tenantId?: string,
  ): Promise<SurgeryConsumable[]> {
    const results: SurgeryConsumable[] = [];
    for (const item of items) {
      const consumable = await this.recordConsumable({ ...item, surgeryCaseId }, userId, tenantId);
      results.push(consumable);
    }
    return results;
  }

  async getConsumables(surgeryCaseId: string, tenantId?: string): Promise<SurgeryConsumable[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { surgeryCaseId };
    where.tenantId = tid;

    return this.consumableRepo.find({
      where,
      relations: ['item', 'recordedBy'],
      order: { usedAt: 'ASC' },
    });
  }

  async getConsumablesSummary(
    surgeryCaseId: string,
    tenantId?: string,
  ): Promise<{
    items: SurgeryConsumable[];
    totalCost: number;
    billableTotal: number;
    byCategory: Record<string, number>;
    byPhase: Record<string, number>;
  }> {
    const items = await this.getConsumables(surgeryCaseId, tenantId);

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

  async updateConsumable(
    id: string,
    updates: Partial<RecordConsumableDto>,
    tenantId?: string,
  ): Promise<SurgeryConsumable> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;

    const consumable = await this.consumableRepo.findOne({ where });
    if (!consumable) throw new NotFoundException('Consumable not found');

    if (updates.quantityUsed !== undefined) {
      consumable.quantityUsed = updates.quantityUsed;
      consumable.totalCost = updates.quantityUsed * Number(consumable.unitCost);
    }
    if (updates.notes !== undefined) consumable.notes = updates.notes;

    return this.consumableRepo.save(consumable);
  }

  async deleteConsumable(id: string, tenantId?: string): Promise<void> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;

    const consumable = await this.consumableRepo.findOne({ where });
    if (!consumable) throw new NotFoundException('Consumable not found');

    // Already billed onto an invoice? Deleting would leave an orphaned
    // charge — the invoice line must be removed first.
    const billed = await this.dataSource.query(
      `SELECT 1
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
        WHERE ii.reference_type = 'surgery_consumable'
          AND ii.reference_id = $1
          AND i.tenant_id = $2
          AND i.status NOT IN ('cancelled', 'written_off')
        LIMIT 1`,
      [id, tid],
    );
    if (billed.length > 0) {
      throw new BadRequestException(
        'This consumable has already been billed. Remove the invoice item first, then delete.',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // Return the stock that was deducted — deleting used to leave
      // inventory permanently short by the consumed quantity
      if (consumable.isDeductedFromStock) {
        const surgeryCase = await manager.findOne(SurgeryCase, {
          where: { id: consumable.surgeryCaseId, tenantId: tid },
        });
        const facilityId = surgeryCase?.facilityId;
        if (facilityId) {
          const qty = Number(consumable.quantityUsed);
          const stockBalance = await manager.findOne(StockBalance, {
            where: { itemId: consumable.itemId, facilityId, tenantId: tid },
            lock: { mode: 'pessimistic_write' },
          });
          if (stockBalance) {
            stockBalance.totalQuantity = Number(stockBalance.totalQuantity) + qty;
            stockBalance.availableQuantity = Number(stockBalance.availableQuantity) + qty;
            stockBalance.lastMovementAt = new Date();
            await manager.save(StockBalance, stockBalance);
          }
          await manager.save(
            StockLedger,
            manager.create(StockLedger, {
              itemId: consumable.itemId,
              movementType: MovementType.RETURN,
              quantity: qty,
              balanceAfter: stockBalance ? Number(stockBalance.totalQuantity) : qty,
              referenceType: 'surgery_consumable_delete',
              referenceId: id,
              notes: 'Stock returned on surgery consumable deletion',
              createdById: 'system',
              facilityId,
              tenantId: tid,
            }),
          );
        }
      }

      await manager.softRemove(SurgeryConsumable, consumable);
    });
  }

  async getConsumablesReport(
    facilityId: string,
    startDate: string,
    endDate: string,
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    const where: any = {
      facilityId,
      actualStartTime: Between(new Date(startDate), new Date(endDate)),
    };
    where.tenantId = tid;

    const cases = await this.surgeryCaseRepo.find({
      where,
    });

    const caseIds = cases.map((c) => c.id);
    if (caseIds.length === 0) return { surgeries: 0, consumables: [], totalCost: 0 };

    const consumablesQb = this.consumableRepo
      .createQueryBuilder('c')
      .select('c.itemId', 'itemId')
      .addSelect('c.itemName', 'itemName')
      .addSelect('c.category', 'category')
      .addSelect('SUM(c.quantityUsed)', 'totalQuantity')
      .addSelect('SUM(c.totalCost)', 'totalCost')
      .addSelect('COUNT(DISTINCT c.surgeryCaseId)', 'surgeryCount')
      .where('c.surgeryCaseId IN (:...caseIds)', { caseIds });
    consumablesQb.andWhere('c.tenant_id = :tenantId', { tenantId: tid });
    const consumables = await consumablesQb
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
