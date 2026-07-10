import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, DataSource, EntityManager, ILike, In, DeepPartial } from 'typeorm';
import { LabTest, LabTestStatus } from '../../database/entities/lab-test.entity';
import { LabSample, SampleStatus } from '../../database/entities/lab-sample.entity';
import { LabResult, ResultStatus, AbnormalFlag } from '../../database/entities/lab-result.entity';
import { Order, OrderStatus, OrderType } from '../../database/entities/order.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Facility } from '../../database/entities/facility.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import {
  CreateLabTestDto,
  UpdateLabTestDto,
  CollectSampleDto,
  ReceiveSampleDto,
  RejectSampleDto,
  EnterResultDto,
  ValidateResultDto,
  AmendResultDto,
  LabTestQueryDto,
  SampleQueryDto,
} from './dto/lab.dto';
import { BillingService } from '../billing/billing.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EncountersService } from '../encounters/encounters.service';
import { CriticalResultsService } from '../critical-results/critical-results.service';

@Injectable()
export class LabService {
  private readonly logger = new Logger(LabService.name);

  constructor(
    @InjectRepository(LabTest) private labTestRepo: Repository<LabTest>,
    @InjectRepository(LabSample) private sampleRepo: Repository<LabSample>,
    @InjectRepository(LabResult) private resultRepo: Repository<LabResult>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Facility) private facilityRepo: Repository<Facility>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => BillingService))
    private billingService: BillingService,
    @Inject(forwardRef(() => InAppNotificationsService))
    private inAppNotificationsService: InAppNotificationsService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => EncountersService))
    private encountersService: EncountersService,
    private criticalResultsService: CriticalResultsService,
  ) {}

  private async generateSampleNumber(manager: EntityManager, tenantId?: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const lockKey = `lab_sample_num_${dateStr}_${tenantId || 'global'}`;

    // Use advisory lock to prevent concurrent generation collisions
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

    const lastSample = await manager
      .getRepository(LabSample)
      .createQueryBuilder('s')
      .where('s.sampleNumber LIKE :prefix', { prefix: `LAB${dateStr}%` })
      .andWhere(tenantId ? 's.tenant_id = :tenantId' : '1=1', { tenantId })
      .orderBy('s.sampleNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastSample) {
      const lastSeq = parseInt(lastSample.sampleNumber.slice(-5), 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `LAB${dateStr}${sequence.toString().padStart(5, '0')}`;
  }

  // P2: shared plausibility guards for ranges + date windows.
  private validateReferenceRanges(ranges?: any[] | null): void {
    if (!Array.isArray(ranges)) return;
    for (const r of ranges) {
      if (!r) continue;
      const { normalMin, normalMax, criticalLow, criticalHigh } = r;
      if (normalMin !== undefined && normalMax !== undefined && normalMin > normalMax) {
        throw new BadRequestException(
          `Reference range for '${r.parameter}': normalMin (${normalMin}) must be <= normalMax (${normalMax}).`,
        );
      }
      if (criticalLow !== undefined && criticalHigh !== undefined && criticalLow > criticalHigh) {
        throw new BadRequestException(
          `Reference range for '${r.parameter}': criticalLow (${criticalLow}) must be <= criticalHigh (${criticalHigh}).`,
        );
      }
      if (criticalLow !== undefined && normalMin !== undefined && criticalLow > normalMin) {
        throw new BadRequestException(
          `Reference range for '${r.parameter}': criticalLow (${criticalLow}) must be <= normalMin (${normalMin}).`,
        );
      }
      if (criticalHigh !== undefined && normalMax !== undefined && criticalHigh < normalMax) {
        throw new BadRequestException(
          `Reference range for '${r.parameter}': criticalHigh (${criticalHigh}) must be >= normalMax (${normalMax}).`,
        );
      }
    }
  }

  private validateDateRange(fromDate?: string | Date, toDate?: string | Date): void {
    if (!fromDate || !toDate) return;
    const f = fromDate instanceof Date ? fromDate.getTime() : new Date(fromDate).getTime();
    const t = toDate instanceof Date ? toDate.getTime() : new Date(toDate).getTime();
    if (!Number.isFinite(f) || !Number.isFinite(t)) return;
    if (f > t) {
      throw new BadRequestException('fromDate must be on or before toDate.');
    }
  }

  // ========== LAB TEST CATALOG ==========
  async createLabTest(dto: CreateLabTestDto, tenantId?: string): Promise<LabTest> {
    this.validateReferenceRanges(dto.referenceRanges);

    const existing = await this.labTestRepo.findOne({
      where: { code: dto.code, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new BadRequestException('Test code already exists');

    const test = this.labTestRepo.create({ ...dto, ...(tenantId ? { tenantId } : {}) });
    return this.labTestRepo.save(test);
  }

  async getLabTests(query: LabTestQueryDto, tenantId?: string): Promise<LabTest[]> {
    const qb = this.labTestRepo.createQueryBuilder('test');

    if (tenantId) qb.andWhere('test.tenant_id = :tenantId', { tenantId });
    if (query.category) qb.andWhere('test.category = :category', { category: query.category });
    if (query.status) qb.andWhere('test.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere('(test.code ILIKE :search OR test.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    return qb.orderBy('test.name', 'ASC').getMany();
  }

  async getLabTest(id: string, tenantId?: string): Promise<LabTest> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const test = await this.labTestRepo.findOne({ where });
    if (!test) throw new NotFoundException('Lab test not found');
    return test;
  }

  async updateLabTest(id: string, dto: UpdateLabTestDto, tenantId?: string): Promise<LabTest> {
    this.validateReferenceRanges(dto.referenceRanges);
    const test = await this.getLabTest(id, tenantId);
    Object.assign(test, dto);
    return this.labTestRepo.save(test);
  }

  // ========== SAMPLE MANAGEMENT ==========

  /**
   * Auto-prepares samples for all tests in an order.
   * For each test code in the order, creates a sample (if it doesn't already exist)
   * and auto-transitions it to RECEIVED status so results can be entered immediately.
   */
  async prepareOrderSamples(
    orderId: string,
    userId: string,
    tenantId?: string,
  ): Promise<LabSample[]> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, ...(tenantId ? { tenantId } : {}) },
      relations: ['encounter'],
    });
    if (!order) throw new NotFoundException(`Order not found: ${orderId}`);
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot prepare samples for a cancelled order');
    }
    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot prepare samples for a completed order');
    }

    const patientId = order.encounter?.patientId;
    const facilityId = order.encounter?.facilityId;
    if (!patientId || !facilityId) {
      throw new BadRequestException('Order encounter is missing patient or facility information');
    }

    const testCodes: { code: string; name: string }[] = order.testCodes || [];
    if (testCodes.length === 0) {
      throw new BadRequestException('Order has no test codes');
    }

    // Start processing the order if still pending (within sample preparation context)
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.IN_PROGRESS;
    }

    const preparedSamples: LabSample[] = [];

    // Wrap order update + sample creation in a single transaction
    await this.dataSource.transaction(async (manager) => {
      if (order.status === OrderStatus.IN_PROGRESS) {
        await manager.save(Order, order);
      }

      for (const tc of testCodes) {
        // Resolve lab test by code, with keyword-based name fallback
        let labTest = await manager.findOne(LabTest, {
          where: { code: tc.code, ...(tenantId ? { tenantId } : {}) },
        });
        if (!labTest && tc.name) {
          const stopWords = new Set([
            'test',
            'tests',
            'blood',
            'screening',
            'panel',
            'complete',
            'full',
            'basic',
            'the',
            'a',
            'of',
          ]);
          const keywords = tc.name
            .split(/\s+/)
            .filter((w: string) => w.length > 1 && !stopWords.has(w.toLowerCase()));
          if (keywords.length > 0) {
            const qb = manager.createQueryBuilder(LabTest, 't');
            const orConds = keywords.map((_: string, i: number) => `t.name ILIKE :kw${i}`);
            qb.where(
              `(${orConds.join(' OR ')})`,
              keywords.reduce(
                (p: any, kw: string, i: number) => ({ ...p, [`kw${i}`]: `%${kw}%` }),
                {},
              ),
            );
            if (tenantId) qb.andWhere('t.tenant_id = :tenantId', { tenantId });
            labTest = await qb.limit(1).getOne();
          }
        }
        if (!labTest) {
          this.logger.warn(`Lab test not found for code: ${tc.code} (name: ${tc.name}), skipping`);
          continue;
        }

        // Check if sample already exists for this order+test
        let sample = await manager.findOne(LabSample, {
          where: { orderId, labTestId: labTest.id },
          relations: ['patient', 'labTest', 'order', 'collectedBy'],
        });

        if (!sample) {
          // Auto-collect: create sample
          const sampleNumber = await this.generateSampleNumber(manager, tenantId);

          sample = manager.create(LabSample, {
            orderId,
            patientId,
            labTestId: labTest.id,
            facilityId,
            sampleType: labTest.sampleType || 'blood',
            priority: (order.priority as any) || 'routine',
            sampleNumber,
            barcode: sampleNumber,
            status: SampleStatus.COLLECTED,
            collectionTime: new Date(),
            collectedById: userId,
            ...(tenantId ? { tenantId } : {}),
          });
          sample = await manager.save(LabSample, sample);
          this.logger.log(
            `Sample auto-collected: ${sampleNumber} for order ${orderId} by user ${userId}`,
          );
        }

        // Auto-receive if still in collected status
        if (sample.status === SampleStatus.COLLECTED) {
          sample.status = SampleStatus.RECEIVED;
          sample.receivedTime = new Date();
          sample = await manager.save(LabSample, sample);
          this.logger.log(`Sample auto-received: ${sample.sampleNumber} for order ${orderId}`);
        }

        // Reload with full relations
        sample = await manager.findOne(LabSample, {
          where: { id: sample.id },
          relations: ['patient', 'labTest', 'order', 'collectedBy'],
        })!;
        if (sample) preparedSamples.push(sample);
      }
    }); // end transaction

    return preparedSamples;
  }

  async collectSample(
    dto: CollectSampleDto,
    userId: string,
    tenantId?: string,
  ): Promise<LabSample> {
    // Resolve labTestId from code if not provided
    let labTestId = dto.labTestId;
    if (!labTestId && dto.labTestCode) {
      const tenantWhere = tenantId ? { tenantId } : {};
      // Try exact code match first
      let labTest = await this.labTestRepo.findOne({
        where: { code: dto.labTestCode, ...tenantWhere },
      });
      // Fallback: search by name keywords from the order's test entry
      if (!labTest) {
        const order = await this.orderRepo.findOne({
          where: { id: dto.orderId, ...(tenantId ? { tenantId } : {}) },
        });
        const testEntry = order?.testCodes?.find((t) => t.code === dto.labTestCode);
        if (testEntry?.name) {
          const stopWords = new Set([
            'test',
            'tests',
            'blood',
            'screening',
            'panel',
            'complete',
            'full',
            'basic',
            'the',
            'a',
            'of',
          ]);
          const keywords = testEntry.name
            .split(/\s+/)
            .filter((w: string) => w.length > 1 && !stopWords.has(w.toLowerCase()));
          if (keywords.length > 0) {
            const qb = this.labTestRepo.createQueryBuilder('t');
            const orConds = keywords.map((_: string, i: number) => `t.name ILIKE :kw${i}`);
            qb.where(
              `(${orConds.join(' OR ')})`,
              keywords.reduce(
                (p: any, kw: string, i: number) => ({ ...p, [`kw${i}`]: `%${kw}%` }),
                {},
              ),
            );
            if (tenantId) qb.andWhere('t.tenant_id = :tenantId', { tenantId });
            labTest = await qb.limit(1).getOne();
          }
        }
      }
      if (!labTest) {
        throw new NotFoundException(`Lab test not found with code: ${dto.labTestCode}`);
      }
      labTestId = labTest.id;
    }

    if (!labTestId) {
      throw new BadRequestException('Either labTestId or labTestCode must be provided');
    }

    // Validate that all referenced entities exist before creating sample
    const [order, labTest, patient, facility] = await Promise.all([
      this.orderRepo.findOne({ where: { id: dto.orderId, ...(tenantId ? { tenantId } : {}) } }),
      this.labTestRepo.findOne({ where: { id: labTestId, ...(tenantId ? { tenantId } : {}) } }),
      this.patientRepo.findOne({ where: { id: dto.patientId, ...(tenantId ? { tenantId } : {}) } }),
      this.facilityRepo.findOne({
        where: { id: dto.facilityId, ...(tenantId ? { tenantId } : {}) },
      }),
    ]);

    if (!order) {
      throw new NotFoundException(`Order not found: ${dto.orderId}`);
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot collect sample for a cancelled order');
    }
    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot collect sample for an already completed order');
    }
    if (!labTest) {
      throw new NotFoundException(`Lab test not found: ${dto.labTestId}`);
    }
    if (!patient) {
      throw new NotFoundException(`Patient not found: ${dto.patientId}`);
    }
    if (!facility) {
      throw new NotFoundException(`Facility not found: ${dto.facilityId}`);
    }

    // P0: duplicate check moved INSIDE the transaction (below) under an
    // advisory lock so two concurrent collect calls cannot both observe a
    // null pre-check and both insert. A non-locked pre-check here would
    // provide false confidence.

    return this.dataSource.transaction(async (manager) => {
      // P0: re-check duplicate INSIDE the transaction under an advisory lock
      // keyed by (order, test). Without this, two concurrent collect calls
      // both observe `existing=null` outside the txn, both pass the guard,
      // and both insert — there is no DB UNIQUE on (orderId, labTestId).
      const dupLockKey = `lab_sample_dup_${dto.orderId}_${labTestId}_${tenantId || 'global'}`;
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [dupLockKey]);

      const dupWhere: any = { orderId: dto.orderId, labTestId };
      if (tenantId) dupWhere.tenantId = tenantId;
      const duplicate = await manager.findOne(LabSample, { where: dupWhere });
      if (duplicate) {
        throw new BadRequestException(
          `Sample already collected for this order/test combination (Sample: ${duplicate.sampleNumber})`,
        );
      }

      const sampleNumber = await this.generateSampleNumber(manager, tenantId);

      const sample = manager.create(LabSample, {
        orderId: dto.orderId,
        patientId: dto.patientId,
        labTestId: labTestId,
        facilityId: dto.facilityId,
        sampleType: dto.sampleType,
        priority: dto.priority,
        collectionNotes: dto.collectionNotes,
        sampleNumber,
        barcode: sampleNumber,
        status: SampleStatus.COLLECTED,
        collectionTime: new Date(),
        collectedById: userId,
        ...(tenantId ? { tenantId } : {}),
      });

      const savedSample = await manager.save(sample);
      this.logger.log(
        `Sample collected: ${sampleNumber} for patient ${dto.patientId} by user ${userId}`,
      );
      return savedSample;
    });
  }

  async getSamples(
    query: SampleQueryDto,
    tenantId?: string,
  ): Promise<{ data: LabSample[]; total: number; limit: number; offset: number }> {
    const qb = this.sampleRepo
      .createQueryBuilder('sample')
      .leftJoinAndSelect('sample.patient', 'patient')
      .leftJoinAndSelect('sample.labTest', 'labTest')
      .leftJoinAndSelect('sample.order', 'order')
      .leftJoinAndSelect('sample.collectedBy', 'collectedBy');

    if (tenantId) qb.andWhere('sample.tenant_id = :tenantId', { tenantId });
    if (query.facilityId)
      qb.andWhere('sample.facilityId = :facilityId', { facilityId: query.facilityId });
    if (query.orderId) qb.andWhere('sample.orderId = :orderId', { orderId: query.orderId });
    if (query.statuses) {
      const statusList = query.statuses.split(',').map((s) => s.trim());
      qb.andWhere('sample.status IN (:...statusList)', { statusList });
    } else if (query.status) {
      qb.andWhere('sample.status = :status', { status: query.status });
    }
    if (query.priority) qb.andWhere('sample.priority = :priority', { priority: query.priority });
    this.validateDateRange(query.fromDate, query.toDate);
    if (query.fromDate && query.toDate) {
      qb.andWhere('sample.createdAt BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      });
    }

    const take = Math.min(query.limit || 50, 200);
    const skip = query.offset || 0;
    qb.orderBy('sample.createdAt', 'DESC').skip(skip).take(take);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, limit: take, offset: skip };
  }

  async getSample(id: string, tenantId?: string): Promise<LabSample> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const sample = await this.sampleRepo.findOne({
      where,
      relations: ['patient', 'labTest', 'order', 'results', 'collectedBy', 'processedBy'],
    });
    if (!sample) throw new NotFoundException('Sample not found');
    return sample;
  }

  async receiveSample(
    id: string,
    dto: ReceiveSampleDto,
    userId: string,
    tenantId?: string,
  ): Promise<LabSample> {
    // P1-3: lock the sample row inside a transaction and re-check status,
    // otherwise two concurrent receive calls both observe COLLECTED, both
    // pass the guard, and the second silently overwrites receivedTime.
    return this.dataSource.transaction(async (manager) => {
      const qb = manager
        .getRepository(LabSample)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id });
      if (tenantId) qb.andWhere('s.tenant_id = :tenantId', { tenantId });
      const sample = await qb.getOne();
      if (!sample) throw new NotFoundException('Sample not found');

      // Idempotent: if already past collected, return as-is
      if (
        [SampleStatus.RECEIVED, SampleStatus.PROCESSING, SampleStatus.COMPLETED].includes(
          sample.status as SampleStatus,
        )
      ) {
        return sample;
      }
      if (sample.status !== SampleStatus.COLLECTED) {
        throw new BadRequestException('Sample is not in collected status');
      }

      const previousStatus = sample.status;
      sample.status = SampleStatus.RECEIVED;
      sample.receivedTime = new Date();
      if (dto.notes) sample.collectionNotes = (sample.collectionNotes || '') + '\n' + dto.notes;

      const savedSample = await manager.save(sample);

      await this.writeLabAudit(manager, {
        action: 'LAB_SAMPLE_RECEIVED',
        entityId: savedSample.id,
        userId,
        tenantId,
        previousStatus,
        newValue: {
          sampleNumber: savedSample.sampleNumber,
          status: savedSample.status,
          receivedTime: savedSample.receivedTime,
          notes: dto.notes || null,
        },
      });

      this.logger.log(`Sample received: ${sample.sampleNumber} by user ${userId}`);
      return savedSample;
    });
  }

  async startProcessing(id: string, userId: string, tenantId?: string): Promise<LabSample> {
    // P1-3: lock + re-check inside txn (same rationale as receiveSample).
    return this.dataSource.transaction(async (manager) => {
      const qb = manager
        .getRepository(LabSample)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id });
      if (tenantId) qb.andWhere('s.tenant_id = :tenantId', { tenantId });
      const sample = await qb.getOne();
      if (!sample) throw new NotFoundException('Sample not found');

      if (
        [SampleStatus.PROCESSING, SampleStatus.COMPLETED].includes(sample.status as SampleStatus)
      ) {
        return sample;
      }
      if (sample.status !== SampleStatus.RECEIVED) {
        throw new BadRequestException('Sample must be received before processing');
      }

      const previousStatus = sample.status;
      sample.status = SampleStatus.PROCESSING;
      sample.processedById = userId;
      sample.processedTime = new Date();

      const savedSample = await manager.save(sample);

      await this.writeLabAudit(manager, {
        action: 'LAB_SAMPLE_PROCESSING_STARTED',
        entityId: savedSample.id,
        userId,
        tenantId,
        previousStatus,
        newValue: {
          sampleNumber: savedSample.sampleNumber,
          status: savedSample.status,
          processedTime: savedSample.processedTime,
        },
      });

      this.logger.log(`Sample processing started: ${sample.sampleNumber} by user ${userId}`);
      return savedSample;
    });
  }

  async rejectSample(
    id: string,
    dto: RejectSampleDto,
    userId: string,
    tenantId?: string,
  ): Promise<LabSample> {
    // P1-4: TOCTOU — guard + status save must happen under one txn with
    // a row lock; otherwise a concurrent releaseResult can insert a
    // RELEASED row between the guard and the save, leaving the sample
    // in REJECTED with a released result attached.
    // P1-9: on rejection, revert the parent order to PENDING so the
    // clinical workflow knows a re-collect is required (otherwise the
    // order stays IN_PROGRESS forever and the dropped sample is silent).
    return this.dataSource.transaction(async (manager) => {
      const qb = manager
        .getRepository(LabSample)
        .createQueryBuilder('s')
        .setLock('pessimistic_write')
        .where('s.id = :id', { id });
      if (tenantId) qb.andWhere('s.tenant_id = :tenantId', { tenantId });
      const sample = await qb.getOne();
      if (!sample) throw new NotFoundException('Sample not found');

      if (sample.status === SampleStatus.COMPLETED) {
        const releasedResults = await manager.getRepository(LabResult).find({
          where: {
            sampleId: id,
            status: ResultStatus.RELEASED,
            ...(tenantId ? { tenantId } : {}),
          },
        });
        if (releasedResults.length > 0) {
          throw new BadRequestException(
            'Cannot reject a completed sample with released results. Amend the results instead.',
          );
        }
      }

      const rejectableStatuses = [
        SampleStatus.PENDING_COLLECTION,
        SampleStatus.COLLECTED,
        SampleStatus.RECEIVED,
        SampleStatus.PROCESSING,
      ];
      if (!rejectableStatuses.includes(sample.status as SampleStatus)) {
        throw new BadRequestException(
          `Cannot reject sample in '${sample.status}' status. Only pending, collected, received, or processing samples can be rejected.`,
        );
      }

      const previousStatus = sample.status;
      sample.status = SampleStatus.REJECTED;
      sample.rejectionReason = dto.rejectionReason;

      const savedSample = await manager.save(sample);

      // P1-9: revert parent order so re-collection is signalled.
      let revertedOrderId: string | null = null;
      if (sample.orderId) {
        const order = await manager.getRepository(Order).findOne({
          where: { id: sample.orderId, ...(tenantId ? { tenantId } : {}) },
        });
        if (order && order.status === OrderStatus.IN_PROGRESS) {
          order.status = OrderStatus.PENDING;
          await manager.save(order);
          revertedOrderId = order.id;
        }
      }

      await this.writeLabAudit(manager, {
        action: 'LAB_SAMPLE_REJECTED',
        entityId: savedSample.id,
        userId,
        tenantId,
        previousStatus,
        newValue: {
          sampleNumber: savedSample.sampleNumber,
          status: savedSample.status,
          rejectionReason: dto.rejectionReason,
          revertedOrderId,
        },
      });

      this.logger.warn(
        `Sample rejected: ${sample.sampleNumber} by user ${userId}, reason: ${dto.rejectionReason}` +
          (revertedOrderId
            ? ` (order ${revertedOrderId} reverted to PENDING for re-collection)`
            : ''),
      );

      // Notify ordering doctor (outside critical path; failure non-fatal)
      if (revertedOrderId) {
        try {
          const fullSample = await manager.getRepository(LabSample).findOne({
            where: { id: savedSample.id },
            relations: ['order', 'order.encounter', 'order.encounter.patient'],
          });
          const orderedById = fullSample?.order?.orderedById;
          const patientName = fullSample?.order?.encounter?.patient?.fullName || 'Patient';
          if (orderedById) {
            await this.inAppNotificationsService
              .create(
                {
                  targetUserId: orderedById,
                  facilityId: sample.facilityId,
                  type: 'LAB_SAMPLE_REJECTED' as any,
                  title: 'Lab Sample Rejected — Re-collect Required',
                  message: `Sample ${savedSample.sampleNumber} for ${patientName} was rejected: ${dto.rejectionReason}. Please re-collect.`,
                  metadata: {
                    sampleId: savedSample.id,
                    sampleNumber: savedSample.sampleNumber,
                    orderId: revertedOrderId,
                    rejectionReason: dto.rejectionReason,
                  },
                },
                tenantId,
              )
              .catch(() => undefined);
          }
        } catch (err) {
          this.logger.warn(
            `Failed to send rejection notification for ${savedSample.sampleNumber}: ${(err as Error).message}`,
          );
        }
      }

      return savedSample;
    });
  }

  // P1-1: write a structured audit_logs row for state-mutating lab
  // operations. Errors here MUST NOT roll back the parent txn (we log
  // and swallow) — but because the call site passes the txn manager,
  // a successful insert participates in the same commit as the state
  // change, so we never log "validated" for a row that never persisted.
  private async writeLabAudit(
    manager: EntityManager,
    payload: {
      action: string;
      entityId: string;
      userId: string;
      tenantId?: string;
      previousStatus?: string;
      newValue: Record<string, any>;
    },
  ): Promise<void> {
    try {
      const repo = manager.getRepository(AuditLog);
      await repo.save(
        repo.create({
          action: payload.action,
          entityType: 'LabSample',
          entityId: payload.entityId,
          userId: payload.userId,
          oldValue: payload.previousStatus ? { status: payload.previousStatus } : undefined,
          newValue: payload.newValue,
          ...(payload.tenantId ? { tenantId: payload.tenantId } : {}),
        } as DeepPartial<AuditLog>),
      );
    } catch (err) {
      this.logger.warn(`Lab audit write failed (${payload.action}): ${(err as Error).message}`);
    }
  }

  // ========== LAB SAMPLE STATE MACHINE ==========
  /** Valid status transitions for lab samples */
  private static readonly VALID_SAMPLE_TRANSITIONS: Record<string, string[]> = {
    [SampleStatus.PENDING_COLLECTION]: [SampleStatus.COLLECTED, SampleStatus.REJECTED],
    [SampleStatus.COLLECTED]: [SampleStatus.RECEIVED, SampleStatus.REJECTED],
    [SampleStatus.RECEIVED]: [SampleStatus.PROCESSING, SampleStatus.REJECTED],
    [SampleStatus.PROCESSING]: [SampleStatus.COMPLETED, SampleStatus.REJECTED],
    [SampleStatus.COMPLETED]: [],
    [SampleStatus.REJECTED]: [],
  };

  private validateSampleTransition(from: string, to: string): void {
    const allowed = LabService.VALID_SAMPLE_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid sample status transition: '${from}' → '${to}'. Allowed: ${(allowed || []).join(', ') || 'none'}`,
      );
    }
  }

  // ========== RESULT MANAGEMENT ==========
  async enterResult(
    sampleId: string,
    dto: EnterResultDto,
    userId: string,
    tenantId?: string,
  ): Promise<LabResult> {
    const sample = await this.getSample(sampleId, tenantId);

    // P2: numeric plausibility on per-result reference bounds.
    if (
      dto.referenceMin !== undefined &&
      dto.referenceMax !== undefined &&
      dto.referenceMin > dto.referenceMax
    ) {
      throw new BadRequestException(
        `referenceMin (${dto.referenceMin}) must be <= referenceMax (${dto.referenceMax}).`,
      );
    }

    // P1: reject physically impossible numeric values (negative or absurdly large).
    // This catches data-entry typos (e.g. hemoglobin 500, glucose -10).
    if (dto.numericValue !== undefined) {
      if (dto.numericValue < 0) {
        throw new BadRequestException(
          `Numeric value (${dto.numericValue}) cannot be negative. Please verify the result.`,
        );
      }
      // Absolute ceiling: no known lab parameter exceeds 1,000,000.
      // Individual test configs can enforce tighter bounds via referenceMax/criticalHigh.
      if (dto.numericValue > 1_000_000) {
        throw new BadRequestException(
          `Numeric value (${dto.numericValue}) exceeds maximum plausible range. Please verify the result.`,
        );
      }
      // Warn (but don't block) if value is > 10x the reference max — likely a unit or decimal error.
      if (dto.referenceMax !== undefined && dto.numericValue > dto.referenceMax * 10) {
        this.logger.warn(
          `enterResult: value ${dto.numericValue} is >10x reference max (${dto.referenceMax}) for sample ${sampleId}. Possible unit/decimal error.`,
        );
      }
    }

    // Wrap all status transitions and result save in a single transaction
    return this.dataSource.transaction(async (manager) => {
      // Auto-transition samples through the workflow if needed
      if (sample.status === SampleStatus.COLLECTED) {
        this.validateSampleTransition(sample.status, SampleStatus.RECEIVED);
        sample.status = SampleStatus.RECEIVED;
        sample.receivedTime = new Date();
        await manager.save(LabSample, sample);
        this.logger.log(
          `Sample auto-received: ${sample.sampleNumber} during result entry by user ${userId}`,
        );
      }
      if (sample.status === SampleStatus.RECEIVED) {
        this.validateSampleTransition(sample.status, SampleStatus.PROCESSING);
        sample.status = SampleStatus.PROCESSING;
        sample.processedById = userId;
        sample.processedTime = new Date();
        await manager.save(LabSample, sample);
        this.logger.log(
          `Sample auto-processing started: ${sample.sampleNumber} during result entry by user ${userId}`,
        );
      }

      if (
        (sample.status as string) !== SampleStatus.RECEIVED &&
        (sample.status as string) !== SampleStatus.PROCESSING &&
        (sample.status as string) !== SampleStatus.COMPLETED
      ) {
        throw new BadRequestException(
          `Cannot enter results for sample in '${sample.status}' status. Sample must be in 'received', 'processing', or 'completed' state.`,
        );
      }

      // Parse referenceMin/referenceMax from referenceRange string if not explicitly provided
      let refMin = dto.referenceMin;
      let refMax = dto.referenceMax;
      if (refMin === undefined && refMax === undefined && dto.referenceRange) {
        const match = dto.referenceRange.match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
        if (match) {
          refMin = parseFloat(match[1]);
          refMax = parseFloat(match[2]);
        }
      }

      // Calculate abnormal flag if numeric value provided.
      //
      // P0 (clinical safety): if numericValue is provided but the lab test
      // or its referenceRanges row cannot be resolved (deactivated test,
      // cross-tenant mismatch, missing config), we must NOT silently default
      // to NORMAL — a critically low haemoglobin would never raise an
      // alert. Fail-closed: flag as ABNORMAL and surface a warning so the
      // validator catches the misconfiguration.
      let abnormalFlag = dto.abnormalFlag || AbnormalFlag.NORMAL;
      if (dto.numericValue !== undefined && refMin !== undefined && refMax !== undefined) {
        let critLow: number | undefined;
        let critHigh: number | undefined;
        let rangeResolved = false;
        if (sample.labTest?.referenceRanges && dto.parameter) {
          const refRange = sample.labTest.referenceRanges.find(
            (r) => r.parameter === dto.parameter,
          );
          if (refRange) {
            rangeResolved = true;
            critLow = refRange.criticalLow !== undefined ? Number(refRange.criticalLow) : undefined;
            critHigh =
              refRange.criticalHigh !== undefined ? Number(refRange.criticalHigh) : undefined;
          }
        }
        abnormalFlag = this.calculateAbnormalFlag(
          dto.numericValue,
          refMin,
          refMax,
          critLow,
          critHigh,
        );
        if (!rangeResolved && abnormalFlag === AbnormalFlag.NORMAL) {
          this.logger.warn(
            `enterResult: reference ranges not resolved for sample ${sample.sampleNumber}, parameter=${dto.parameter}. Flagging ABNORMAL fail-closed.`,
          );
          abnormalFlag = AbnormalFlag.ABNORMAL;
        }
      }

      const result = this.resultRepo.create({
        ...dto,
        sampleId,
        referenceMin: refMin,
        referenceMax: refMax,
        abnormalFlag,
        status: ResultStatus.ENTERED,
        enteredById: userId,
        ...(tenantId ? { tenantId } : {}),
      });

      const savedResult = await manager.save(LabResult, result);
      this.logger.log(
        `Lab result entered for sample ${sample.sampleNumber}: ${dto.parameter} by user ${userId}`,
      );
      return savedResult;
    }); // end transaction
  }

  async getResults(
    sampleId: string,
    tenantId?: string,
    opts: { canSeeUnreleased?: boolean } = {},
  ): Promise<LabResult[]> {
    const where: any = { sampleId, ...(tenantId ? { tenantId } : {}) };
    // P1-RBAC: clinicians without labqc.view see only released/amended
    // results — pending/entered/validated stay invisible until QC release.
    if (!opts.canSeeUnreleased) {
      where.status = In([ResultStatus.RELEASED, ResultStatus.AMENDED]);
    }
    return this.resultRepo.find({
      where,
      relations: ['enteredBy', 'validatedBy', 'releasedBy'],
      order: { createdAt: 'ASC' },
    });
  }

  async validateResult(
    id: string,
    dto: ValidateResultDto,
    userId: string,
    tenantId?: string,
  ): Promise<LabResult> {
    // P0: lock the result row INSIDE a transaction before checking status,
    // otherwise two concurrent reviewers can both observe status=ENTERED,
    // both pass the guard, and both stamp validatedBy — defeating the
    // two-person rule and silently overwriting each other's metadata.
    const savedResult = await this.dataSource.transaction(async (manager) => {
      const qb = manager
        .getRepository(LabResult)
        .createQueryBuilder('lr')
        .setLock('pessimistic_write')
        .where('lr.id = :id', { id });
      if (tenantId) qb.andWhere('lr.tenant_id = :tenantId', { tenantId });
      const result = await qb.getOne();
      if (!result) throw new NotFoundException('Result not found');

      if (result.status !== ResultStatus.ENTERED) {
        throw new BadRequestException('Result must be entered before validation');
      }

      // P1-RBAC: enforce two-person rule — the validator must be a
      // different user than the technician who entered the result.
      if (result.enteredById && result.enteredById === userId) {
        throw new BadRequestException(
          'Validator must differ from the technician who entered the result',
        );
      }

      result.status = ResultStatus.VALIDATED;
      result.validatedById = userId;
      result.validatedAt = new Date();
      if (dto.comments) result.comments = dto.comments;

      const saved = await manager.save(result);

      await this.writeLabAudit(manager, {
        action: 'LAB_RESULT_VALIDATED',
        entityId: saved.id,
        userId,
        tenantId,
        previousStatus: ResultStatus.ENTERED,
        newValue: {
          resultId: saved.id,
          sampleId: saved.sampleId,
          parameter: saved.parameter,
          status: saved.status,
          comments: dto.comments || null,
        },
      });

      return saved;
    });

    this.logger.log(`Lab result validated: ${id} by user ${userId}`);

    // Notify ordering doctor + raise a critical-result alert if abnormal/critical
    try {
      const sample = await this.sampleRepo.findOne({
        where: { id: savedResult.sampleId, ...(tenantId ? { tenantId } : {}) },
        relations: ['order', 'order.encounter', 'order.encounter.patient'],
      });
      if (sample?.order?.orderedById && sample.order.encounter?.patient) {
        await this.inAppNotificationsService.notifyLabResultReady(
          sample.order.orderedById,
          sample.order.encounter.patient.fullName || 'Patient',
          savedResult.parameter || 'Lab test',
          sample.id,
          sample.order.encounter?.facilityId,
          tenantId,
        );
      }

      // Closed-loop critical-result acknowledgement
      const sev = this.toCriticalSeverity(savedResult.abnormalFlag);
      if (sev && sample?.order) {
        await this.criticalResultsService.flag({
          resourceType: 'lab',
          resourceId: savedResult.id,
          orderId: sample.orderId,
          patientId: sample.patientId || sample.order.encounter?.patient?.id || '',
          encounterId: sample.order.encounterId,
          severity: sev,
          summary: `${savedResult.parameter || 'Lab result'}: ${savedResult.value ?? ''}${savedResult.unit ? ' ' + savedResult.unit : ''} (${savedResult.abnormalFlag})`,
          flaggedById: userId,
          assignedToId: sample.order.orderedById,
          tenantId,
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to send lab result notification: ${e.message}`);
    }

    return savedResult;
  }

  async releaseResult(id: string, userId: string, tenantId?: string): Promise<LabResult> {
    // P0: lock the result row INSIDE the transaction and re-check status.
    // The previous implementation read the result OUTSIDE the txn so two
    // concurrent release calls could both observe status=VALIDATED, both
    // pass the guard, and both fire patient SMS + encounter return-to-doctor
    // side effects. We also keep the sample lock for the cascade write.
    return this.dataSource.transaction(async (manager) => {
      const resultQb = manager
        .getRepository(LabResult)
        .createQueryBuilder('lr')
        .setLock('pessimistic_write')
        .where('lr.id = :id', { id });
      if (tenantId) resultQb.andWhere('lr.tenant_id = :tenantId', { tenantId });
      const result = await resultQb.getOne();
      if (!result) throw new NotFoundException('Result not found');

      if (result.status !== ResultStatus.VALIDATED) {
        throw new BadRequestException('Result must be validated before release');
      }

      // P1: two-person rule — releaser must differ from validator
      if (result.validatedById && result.validatedById === userId) {
        throw new BadRequestException('Releaser must differ from validator');
      }

      // Lock the sample row to prevent concurrent modifications
      const lockedSample = await manager.findOne(LabSample, {
        where: { id: result.sampleId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedSample && lockedSample.status === SampleStatus.REJECTED) {
        throw new BadRequestException('Cannot release results for a rejected sample');
      }

      result.status = ResultStatus.RELEASED;
      result.releasedById = userId;
      result.releasedAt = new Date();

      const savedResult = await manager.save(result);

      await this.writeLabAudit(manager, {
        action: 'LAB_RESULT_RELEASED',
        entityId: savedResult.id,
        userId,
        tenantId,
        previousStatus: ResultStatus.VALIDATED,
        newValue: {
          resultId: savedResult.id,
          sampleId: savedResult.sampleId,
          parameter: savedResult.parameter,
          status: savedResult.status,
          abnormalFlag: savedResult.abnormalFlag,
        },
      });

      // Check if all results for sample are released
      const allResults = await manager.find(LabResult, {
        where: { sampleId: result.sampleId, ...(tenantId ? { tenantId } : {}) },
      });
      const allReleased = allResults.every(
        (r) => r.id === id || r.status === ResultStatus.RELEASED,
      );

      if (allReleased && lockedSample) {
        lockedSample.status = SampleStatus.COMPLETED;
        lockedSample.completedTime = new Date();
        await manager.save(lockedSample);

        // Update order status (also stamp completed_at so "Completed Today"
        // counters and audit trails work correctly — the orders endpoint
        // sets this when status is updated, but the lab result-release
        // path bypasses that and writes directly).
        await manager.update(Order, lockedSample.orderId, {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        });
        this.logger.log(`Sample completed: ${lockedSample.sampleNumber}`);

        // Notify patient via SMS that lab results are ready (fire-and-forget)
        try {
          const fullSample = await manager.findOne(LabSample, {
            where: { id: result.sampleId },
            relations: [
              'order',
              'order.encounter',
              'order.encounter.patient',
              'order.encounter.facility',
            ],
          });
          const patient = fullSample?.order?.encounter?.patient;
          const facility = fullSample?.order?.encounter?.facility;
          const facilityId = fullSample?.order?.encounter?.facilityId;
          if (patient && facilityId) {
            const fname = String(patient.fullName || 'patient').split(' ')[0];
            const facName = facility?.name || 'the facility';
            const msg =
              `Hello ${fname}, your lab results from ${facName} are ready. ` +
              `Please visit the facility or log in to your patient portal to view them.`;
            this.notificationsService
              .sendSmsToPatient({
                patient,
                facilityId,
                message: msg,
                tenantId,
              })
              .catch((e) => this.logger.warn(`Patient lab-ready SMS failed: ${e.message}`));
          }
        } catch (e) {
          this.logger.warn(`Patient lab-ready SMS lookup failed: ${(e as Error).message}`);
        }

        // Billing is handled at order-creation time in orders.service.ts.
        // Do NOT bill again here to avoid duplicate invoice items.

        // Return patient to doctor for results review
        const fullSampleForOrder = await manager.findOne(LabSample, {
          where: { id: result.sampleId },
          relations: ['order'],
        });
        if (fullSampleForOrder?.order?.encounterId) {
          try {
            await this.encountersService.returnToDoctor(
              fullSampleForOrder.order.encounterId,
              'Lab results ready for review',
              userId,
            );
            this.logger.log(
              `Encounter ${fullSampleForOrder.order.encounterId} returned to doctor for lab results review`,
            );
          } catch (e) {
            this.logger.warn(`Failed to return encounter to doctor: ${e.message}`);
          }
        }
      }

      this.logger.log(`Lab result released: ${id} by user ${userId}`);
      return savedResult;
    });
  }

  async amendResult(
    id: string,
    dto: AmendResultDto,
    userId: string,
    tenantId?: string,
  ): Promise<LabResult> {
    // Concurrent amendments on the same result must not silently clobber
    // each other. We open a transaction and acquire a pessimistic write lock
    // on the row before reading-modifying-writing, so the second amender
    // observes the first amender's `previousValues` and value.
    return this.dataSource.transaction(async (manager) => {
      const resultRepo = manager.getRepository(LabResult);

      const qb = resultRepo
        .createQueryBuilder('lr')
        .setLock('pessimistic_write')
        .where('lr.id = :id', { id });
      if (tenantId) qb.andWhere('lr.tenant_id = :tenantId', { tenantId });
      const result = await qb.getOne();
      if (!result) throw new NotFoundException('Result not found');

      // P0: only allow amendments to results that have actually been
      // released (or previously amended). Without this guard, a tech could
      // amend a PENDING/ENTERED/VALIDATED result and the unreviewed value
      // would be silently archived into `previousValues` as if it had been
      // a released-then-amended value, polluting the chain-of-custody.
      const amendableStatuses: ResultStatus[] = [ResultStatus.RELEASED, ResultStatus.AMENDED];
      if (!amendableStatuses.includes(result.status as ResultStatus)) {
        throw new BadRequestException(
          `Cannot amend a result in '${result.status}' status. Only released or already-amended results may be amended.`,
        );
      }

      // P1: segregation of duties — amender must differ from releaser
      if (result.releasedById && result.releasedById === userId) {
        throw new BadRequestException('Amender must differ from the user who released the result');
      }

      // Store previous value (append to history acquired under the lock)
      const previousValues = result.previousValues || [];
      previousValues.push({
        value: result.value,
        date: new Date(),
        amendedBy: userId,
        reason: dto.amendmentReason,
      });

      result.value = dto.newValue;
      if (dto.numericValue !== undefined) result.numericValue = dto.numericValue;

      // Recalculate abnormal flag if numericValue changed.
      // P0 fail-closed (see enterResult): if reference ranges cannot be
      // resolved, never silently default to NORMAL.
      if (
        dto.numericValue !== undefined &&
        result.referenceMin !== undefined &&
        result.referenceMax !== undefined
      ) {
        let critLow: number | undefined;
        let critHigh: number | undefined;
        let rangeResolved = false;
        const sample = await this.getSample(result.sampleId, tenantId);
        if (sample.labTest?.referenceRanges && result.parameter) {
          const refRange = sample.labTest.referenceRanges.find(
            (r) => r.parameter === result.parameter,
          );
          if (refRange) {
            rangeResolved = true;
            critLow = refRange.criticalLow !== undefined ? Number(refRange.criticalLow) : undefined;
            critHigh =
              refRange.criticalHigh !== undefined ? Number(refRange.criticalHigh) : undefined;
          }
        }
        result.abnormalFlag = this.calculateAbnormalFlag(
          dto.numericValue,
          result.referenceMin,
          result.referenceMax,
          critLow,
          critHigh,
        );
        if (!rangeResolved && result.abnormalFlag === AbnormalFlag.NORMAL) {
          this.logger.warn(
            `amendResult: reference ranges not resolved for result ${result.id}, parameter=${result.parameter}. Flagging ABNORMAL fail-closed.`,
          );
          result.abnormalFlag = AbnormalFlag.ABNORMAL;
        }
      }

      result.amendmentReason = dto.amendmentReason;
      result.previousValues = previousValues;
      result.status = ResultStatus.AMENDED;

      const savedResult = await resultRepo.save(result);

      await this.writeLabAudit(manager, {
        action: 'LAB_RESULT_AMENDED',
        entityId: savedResult.id,
        userId,
        tenantId,
        previousStatus: ResultStatus.RELEASED,
        newValue: {
          resultId: savedResult.id,
          sampleId: savedResult.sampleId,
          parameter: savedResult.parameter,
          status: savedResult.status,
          value: savedResult.value,
          numericValue: savedResult.numericValue,
          unit: savedResult.unit,
          abnormalFlag: savedResult.abnormalFlag,
          amendmentReason: dto.amendmentReason,
          previousValuesCount: previousValues.length,
        },
      });

      this.logger.warn(
        `Lab result amended: ${id} by user ${userId}, reason: ${dto.amendmentReason}`,
      );

      // Re-flag (or bump) critical-result alert if the amendment moved into a
      // critical band. Idempotent: flag() de-dupes by (resourceType,resourceId).
      try {
        const sev = this.toCriticalSeverity(savedResult.abnormalFlag);
        if (sev) {
          const sample = await this.getSample(savedResult.sampleId, tenantId);
          if (sample?.order) {
            await this.criticalResultsService.flag({
              resourceType: 'lab',
              resourceId: savedResult.id,
              orderId: sample.orderId,
              patientId: sample.patientId || '',
              encounterId: sample.order.encounterId,
              severity: sev,
              summary: `[AMENDED] ${savedResult.parameter || 'Lab result'}: ${savedResult.value ?? ''}${savedResult.unit ? ' ' + savedResult.unit : ''} (${savedResult.abnormalFlag})`,
              flaggedById: userId,
              assignedToId: sample.order.orderedById,
              tenantId,
            });
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to flag amended critical result: ${e.message}`);
      }

      return savedResult;
    });
  }

  private toCriticalSeverity(
    flag?: AbnormalFlag,
  ): 'critical' | 'critical_low' | 'critical_high' | 'abnormal' | null {
    switch (flag) {
      case AbnormalFlag.CRITICAL_LOW:
        return 'critical_low';
      case AbnormalFlag.CRITICAL_HIGH:
        return 'critical_high';
      case AbnormalFlag.ABNORMAL:
        return 'abnormal';
      default:
        return null;
    }
  }

  // ========== LAB QUEUE & DASHBOARD ==========
  async getQueueStats(
    facilityId?: string,
    tenantId?: string,
  ): Promise<{ pending: number; completed: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingQuery = this.sampleRepo
      .createQueryBuilder('s')
      .where('s.status IN (:...statuses)', {
        statuses: [SampleStatus.COLLECTED, SampleStatus.RECEIVED, SampleStatus.PROCESSING],
      });

    if (tenantId) {
      pendingQuery.andWhere('s.tenant_id = :tenantId', { tenantId });
    }
    if (facilityId) {
      pendingQuery.andWhere('s.facilityId = :facilityId', { facilityId });
    }

    const pending = await pendingQuery.getCount();

    const completedQuery = this.sampleRepo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SampleStatus.COMPLETED })
      .andWhere('s.completedTime >= :today', { today });

    if (tenantId) {
      completedQuery.andWhere('s.tenant_id = :tenantId', { tenantId });
    }
    if (facilityId) {
      completedQuery.andWhere('s.facilityId = :facilityId', { facilityId });
    }

    const completed = await completedQuery.getCount();

    return { pending, completed };
  }

  async getLabQueue(facilityId: string, tenantId?: string): Promise<any> {
    const pendingCollectionWhere: any = { orderType: OrderType.LAB, status: OrderStatus.PENDING };
    if (tenantId) pendingCollectionWhere.tenantId = tenantId;
    const pendingCollection = await this.orderRepo.count({
      where: pendingCollectionWhere,
    });

    const pendingProcessing = await this.sampleRepo.count({
      where: { facilityId, status: SampleStatus.RECEIVED, ...(tenantId ? { tenantId } : {}) },
    });

    const inProgress = await this.sampleRepo.count({
      where: { facilityId, status: SampleStatus.PROCESSING, ...(tenantId ? { tenantId } : {}) },
    });

    const completedTodayQb = this.sampleRepo
      .createQueryBuilder('s')
      .where('s.facilityId = :facilityId', { facilityId })
      .andWhere('s.status = :status', { status: SampleStatus.COMPLETED })
      .andWhere('DATE(s.completedTime) = CURRENT_DATE');
    if (tenantId) completedTodayQb.andWhere('s.tenant_id = :tenantId', { tenantId });
    const completedToday = await completedTodayQb.getCount();

    return {
      pendingCollection,
      pendingProcessing,
      inProgress,
      completedToday,
    };
  }

  async getTurnaroundStats(facilityId: string, days = 7, tenantId?: string): Promise<any[]> {
    // P1: validate facility exists and belongs to tenant
    const facility = await this.facilityRepo.findOne({
      where: { id: facilityId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!facility) throw new NotFoundException('Facility not found');

    // Validate days parameter to prevent injection and ensure reasonable bounds
    const safeDays = Math.min(Math.max(Math.floor(days), 1), 365);

    const qb = this.sampleRepo
      .createQueryBuilder('s')
      .select('DATE(s.collectionTime)', 'date')
      .addSelect('AVG(EXTRACT(EPOCH FROM (s.completedTime - s.collectionTime)) / 60)', 'avgMinutes')
      .addSelect('COUNT(*)', 'count')
      .where('s.facilityId = :facilityId', { facilityId })
      .andWhere('s.status = :status', { status: SampleStatus.COMPLETED })
      .andWhere("s.collectionTime >= NOW() - CAST(:days || ' days' AS INTERVAL)", {
        days: safeDays,
      });

    if (tenantId) {
      qb.andWhere('s.tenant_id = :tenantId', { tenantId });
    }

    const results = await qb.groupBy('DATE(s.collectionTime)').orderBy('date', 'DESC').getRawMany();

    return results;
  }

  // ========== HELPERS ==========
  private calculateAbnormalFlag(
    value: number,
    min: number,
    max: number,
    critLow?: number,
    critHigh?: number,
  ): AbnormalFlag {
    if (critLow !== undefined && value < critLow) return AbnormalFlag.CRITICAL_LOW;
    if (critHigh !== undefined && value > critHigh) return AbnormalFlag.CRITICAL_HIGH;
    if (value < min) return AbnormalFlag.LOW;
    if (value > max) return AbnormalFlag.HIGH;
    return AbnormalFlag.NORMAL;
  }

  async getCriticalResults(
    facilityId?: string,
    tenantId?: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: LabResult[]; total: number }> {
    const safePage = Math.max(Math.floor(page), 1);
    const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 200);

    const qb = this.resultRepo
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.sample', 'sample')
      .leftJoinAndSelect('sample.patient', 'patient')
      .leftJoinAndSelect('result.enteredBy', 'enteredBy')
      .where('result.abnormalFlag IN (:...flags)', {
        flags: [AbnormalFlag.CRITICAL_LOW, AbnormalFlag.CRITICAL_HIGH],
      })
      .orderBy('result.createdAt', 'DESC');

    if (tenantId) {
      // P0: filter on the result row's own tenant_id, not the joined
      // sample's. A NULL sample (orphaned/soft-deleted) would otherwise
      // make the join-side filter pass silently and leak cross-tenant
      // critical results.
      qb.andWhere('result.tenant_id = :tenantId', { tenantId });
    }
    if (facilityId) {
      // P1: inner-join through sample to ensure only results from that
      // facility appear (left join would include results with NULL sample).
      qb.andWhere('sample.facilityId = :facilityId', { facilityId });
    }

    const [data, total] = await qb
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return { data, total };
  }
}
