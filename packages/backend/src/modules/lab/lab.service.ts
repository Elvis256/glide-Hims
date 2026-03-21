import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, DataSource } from 'typeorm';
import { LabTest, LabTestStatus } from '../../database/entities/lab-test.entity';
import { LabSample, SampleStatus } from '../../database/entities/lab-sample.entity';
import { LabResult, ResultStatus, AbnormalFlag } from '../../database/entities/lab-result.entity';
import { Order, OrderStatus, OrderType } from '../../database/entities/order.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Facility } from '../../database/entities/facility.entity';
import {
  CreateLabTestDto, UpdateLabTestDto, CollectSampleDto, ReceiveSampleDto,
  RejectSampleDto, EnterResultDto, ValidateResultDto, AmendResultDto,
  LabTestQueryDto, SampleQueryDto,
} from './dto/lab.dto';
import { BillingService } from '../billing/billing.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { EncountersService } from '../encounters/encounters.service';

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
    @Inject(forwardRef(() => EncountersService))
    private encountersService: EncountersService,
  ) {}

  // ========== LAB TEST CATALOG ==========
  async createLabTest(dto: CreateLabTestDto, tenantId?: string): Promise<LabTest> {
    const existing = await this.labTestRepo.findOne({ where: { code: dto.code, ...(tenantId ? { tenantId } : {}) } });
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
      qb.andWhere('(test.code ILIKE :search OR test.name ILIKE :search)', 
        { search: `%${query.search}%` });
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
  async prepareOrderSamples(orderId: string, userId: string, tenantId?: string): Promise<LabSample[]> {
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

    // Start processing the order if still pending
    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.IN_PROGRESS;
      await this.orderRepo.save(order);
    }

    const preparedSamples: LabSample[] = [];

    for (const tc of testCodes) {
      // Resolve lab test by code
      const labTest = await this.labTestRepo.findOne({
        where: { code: tc.code, ...(tenantId ? { tenantId } : {}) },
      });
      if (!labTest) {
        this.logger.warn(`Lab test not found for code: ${tc.code}, skipping`);
        continue;
      }

      // Check if sample already exists for this order+test
      let sample = await this.sampleRepo.findOne({
        where: { orderId, labTestId: labTest.id },
        relations: ['patient', 'labTest', 'order', 'collectedBy'],
      });

      if (!sample) {
        // Auto-collect: create sample
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

        const countResult = await this.sampleRepo.query(
          `SELECT COUNT(*) as count FROM lab_samples WHERE created_at >= $1 AND created_at < $2${tenantId ? ' AND tenant_id = $3' : ''}`,
          tenantId ? [todayStart, todayEnd, tenantId] : [todayStart, todayEnd]
        );
        const count = parseInt(countResult[0]?.count || '0', 10);
        const sampleNumber = `LAB${dateStr}${(count + 1).toString().padStart(5, '0')}`;

        sample = this.sampleRepo.create({
          orderId,
          patientId,
          labTestId: labTest.id,
          facilityId,
          sampleType: labTest.sampleType || 'blood',
          priority: order.priority as any || 'routine',
          sampleNumber,
          barcode: sampleNumber,
          status: SampleStatus.COLLECTED,
          collectionTime: new Date(),
          collectedById: userId,
          ...(tenantId ? { tenantId } : {}),
        });
        sample = await this.sampleRepo.save(sample);
        this.logger.log(`Sample auto-collected: ${sampleNumber} for order ${orderId} by user ${userId}`);
      }

      // Auto-receive if still in collected status
      if (sample.status === SampleStatus.COLLECTED) {
        sample.status = SampleStatus.RECEIVED;
        sample.receivedTime = new Date();
        sample = await this.sampleRepo.save(sample);
        this.logger.log(`Sample auto-received: ${sample.sampleNumber} for order ${orderId}`);
      }

      // Reload with full relations
      sample = await this.sampleRepo.findOne({
        where: { id: sample.id },
        relations: ['patient', 'labTest', 'order', 'collectedBy'],
      })!;
      if (sample) preparedSamples.push(sample);
    }

    return preparedSamples;
  }

  async collectSample(dto: CollectSampleDto, userId: string, tenantId?: string): Promise<LabSample> {
    // Resolve labTestId from code if not provided
    let labTestId = dto.labTestId;
    if (!labTestId && dto.labTestCode) {
      const labTest = await this.labTestRepo.findOne({ where: { code: dto.labTestCode, ...(tenantId ? { tenantId } : {}) } });
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
      this.facilityRepo.findOne({ where: { id: dto.facilityId, ...(tenantId ? { tenantId } : {}) } }),
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

    const existingSample = await this.sampleRepo.findOne({
      where: { orderId: dto.orderId, labTestId },
    });
    if (existingSample) {
      throw new BadRequestException(
        `Sample already collected for this order/test combination (Sample: ${existingSample.sampleNumber})`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

      const maxRetries = 3;
      let savedSample: LabSample | undefined;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const countResult = await manager.query(
          `SELECT COUNT(*) as count FROM lab_samples WHERE created_at >= $1 AND created_at < $2${tenantId ? ' AND tenant_id = $3' : ''}`,
          tenantId ? [todayStart, todayEnd, tenantId] : [todayStart, todayEnd]
        );
        const count = parseInt(countResult[0]?.count || '0', 10) + attempt;

        const sampleNumber = `LAB${dateStr}${(count + 1).toString().padStart(5, '0')}`;

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

        try {
          savedSample = await manager.save(sample);
          this.logger.log(`Sample collected: ${sampleNumber} for patient ${dto.patientId} by user ${userId}`);
          break;
        } catch (err: any) {
          const isDuplicate = err.code === '23505' || err.message?.includes('duplicate');
          if (!isDuplicate || attempt === maxRetries - 1) {
            throw err;
          }
          this.logger.warn(`Sample number ${sampleNumber} collision, retrying (attempt ${attempt + 1}/${maxRetries})`);
        }
      }

      return savedSample!;
    });
  }

  async getSamples(query: SampleQueryDto, tenantId?: string): Promise<{ data: LabSample[]; total: number }> {
    const qb = this.sampleRepo.createQueryBuilder('sample')
      .leftJoinAndSelect('sample.patient', 'patient')
      .leftJoinAndSelect('sample.labTest', 'labTest')
      .leftJoinAndSelect('sample.order', 'order')
      .leftJoinAndSelect('sample.collectedBy', 'collectedBy');

    if (tenantId) qb.andWhere('sample.tenant_id = :tenantId', { tenantId });
    if (query.facilityId) qb.andWhere('sample.facilityId = :facilityId', { facilityId: query.facilityId });
    if (query.orderId) qb.andWhere('sample.orderId = :orderId', { orderId: query.orderId });
    if (query.statuses) {
      const statusList = query.statuses.split(',').map(s => s.trim());
      qb.andWhere('sample.status IN (:...statusList)', { statusList });
    } else if (query.status) {
      qb.andWhere('sample.status = :status', { status: query.status });
    }
    if (query.priority) qb.andWhere('sample.priority = :priority', { priority: query.priority });
    if (query.fromDate && query.toDate) {
      qb.andWhere('sample.createdAt BETWEEN :from AND :to', {
        from: query.fromDate,
        to: query.toDate,
      });
    }

    const [data, total] = await qb
      .orderBy('sample.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total };
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

  async receiveSample(id: string, dto: ReceiveSampleDto, userId: string, tenantId?: string): Promise<LabSample> {
    const sample = await this.getSample(id, tenantId);
    if (sample.status !== SampleStatus.COLLECTED) {
      throw new BadRequestException('Sample is not in collected status');
    }

    sample.status = SampleStatus.RECEIVED;
    sample.receivedTime = new Date();
    if (dto.notes) sample.collectionNotes = (sample.collectionNotes || '') + '\n' + dto.notes;

    const savedSample = await this.sampleRepo.save(sample);
    this.logger.log(`Sample received: ${sample.sampleNumber} by user ${userId}`);
    return savedSample;
  }

  async startProcessing(id: string, userId: string, tenantId?: string): Promise<LabSample> {
    const sample = await this.getSample(id, tenantId);
    if (sample.status !== SampleStatus.RECEIVED) {
      throw new BadRequestException('Sample must be received before processing');
    }

    sample.status = SampleStatus.PROCESSING;
    sample.processedById = userId;
    sample.processedTime = new Date();

    const savedSample = await this.sampleRepo.save(sample);
    this.logger.log(`Sample processing started: ${sample.sampleNumber} by user ${userId}`);
    return savedSample;
  }

  async rejectSample(id: string, dto: RejectSampleDto, userId: string, tenantId?: string): Promise<LabSample> {
    const sample = await this.getSample(id, tenantId);
    
    sample.status = SampleStatus.REJECTED;
    sample.rejectionReason = dto.rejectionReason;

    const savedSample = await this.sampleRepo.save(sample);
    this.logger.warn(`Sample rejected: ${sample.sampleNumber} by user ${userId}, reason: ${dto.rejectionReason}`);
    return savedSample;
  }

  // ========== RESULT MANAGEMENT ==========
  async enterResult(sampleId: string, dto: EnterResultDto, userId: string, tenantId?: string): Promise<LabResult> {
    const sample = await this.getSample(sampleId, tenantId);

    // Auto-transition samples through the workflow if needed
    if (sample.status === SampleStatus.COLLECTED) {
      sample.status = SampleStatus.RECEIVED;
      sample.receivedTime = new Date();
      await this.sampleRepo.save(sample);
      this.logger.log(`Sample auto-received: ${sample.sampleNumber} during result entry by user ${userId}`);
    }
    if (sample.status === SampleStatus.RECEIVED) {
      sample.status = SampleStatus.PROCESSING;
      sample.processedById = userId;
      sample.processedTime = new Date();
      await this.sampleRepo.save(sample);
      this.logger.log(`Sample auto-processing started: ${sample.sampleNumber} during result entry by user ${userId}`);
    }

    if ((sample.status as string) !== SampleStatus.RECEIVED && (sample.status as string) !== SampleStatus.PROCESSING) {
      throw new BadRequestException(
        `Cannot enter results for sample in '${sample.status}' status. Sample must be in 'received' or 'processing' state.`,
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

    // Calculate abnormal flag if numeric value provided
    let abnormalFlag = dto.abnormalFlag || AbnormalFlag.NORMAL;
    if (dto.numericValue !== undefined && refMin !== undefined && refMax !== undefined) {
      let critLow: number | undefined;
      let critHigh: number | undefined;
      if (sample.labTest?.referenceRanges && dto.parameter) {
        const refRange = (sample.labTest.referenceRanges as any[]).find(
          (r: any) => r.parameter === dto.parameter,
        );
        if (refRange) {
          critLow = refRange.criticalLow !== undefined ? Number(refRange.criticalLow) : undefined;
          critHigh = refRange.criticalHigh !== undefined ? Number(refRange.criticalHigh) : undefined;
        }
      }
      abnormalFlag = this.calculateAbnormalFlag(dto.numericValue, refMin, refMax, critLow, critHigh);
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

    const savedResult = await this.resultRepo.save(result);
    this.logger.log(`Lab result entered for sample ${sample.sampleNumber}: ${dto.parameter} by user ${userId}`);
    return savedResult;
  }

  async getResults(sampleId: string, tenantId?: string): Promise<LabResult[]> {
    return this.resultRepo.find({
      where: { sampleId , ...(tenantId ? { tenantId } : {}) },
      relations: ['enteredBy', 'validatedBy', 'releasedBy'],
      order: { createdAt: 'ASC' },
    });
  }

  async validateResult(id: string, dto: ValidateResultDto, userId: string, tenantId?: string): Promise<LabResult> {
    const result = await this.resultRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!result) throw new NotFoundException('Result not found');
    
    if (result.status !== ResultStatus.ENTERED) {
      throw new BadRequestException('Result must be entered before validation');
    }

    result.status = ResultStatus.VALIDATED;
    result.validatedById = userId;
    result.validatedAt = new Date();
    if (dto.comments) result.comments = dto.comments;

    const savedResult = await this.resultRepo.save(result);
    this.logger.log(`Lab result validated: ${id} by user ${userId}`);

    // Notify ordering doctor
    try {
      const sample = await this.sampleRepo.findOne({ where: { id: savedResult.sampleId , ...(tenantId ? { tenantId } : {}) }, relations: ['order', 'order.encounter', 'order.encounter.patient'] });
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
    } catch (e) { this.logger.warn(`Failed to send lab result notification: ${e.message}`); }

    return savedResult;
  }

  async releaseResult(id: string, userId: string, tenantId?: string): Promise<LabResult> {
    const result = await this.resultRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!result) throw new NotFoundException('Result not found');
    
    if (result.status !== ResultStatus.VALIDATED) {
      throw new BadRequestException('Result must be validated before release');
    }

    const sample = await this.getSample(result.sampleId, tenantId);
    if (sample.status === SampleStatus.REJECTED) {
      throw new BadRequestException('Cannot release results for a rejected sample');
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock the sample row to prevent concurrent modifications
      const lockedSample = await manager.findOne(LabSample, {
        where: { id: result.sampleId },
        lock: { mode: 'pessimistic_write' },
      });

      result.status = ResultStatus.RELEASED;
      result.releasedById = userId;
      result.releasedAt = new Date();

      const savedResult = await manager.save(result);

      // Check if all results for sample are released
      const allResults = await manager.find(LabResult, {
        where: { sampleId: result.sampleId, ...(tenantId ? { tenantId } : {}) },
      });
      const allReleased = allResults.every(r => r.id === id || r.status === ResultStatus.RELEASED);

      if (allReleased && lockedSample) {
        lockedSample.status = SampleStatus.COMPLETED;
        lockedSample.completedTime = new Date();
        await manager.save(lockedSample);

        // Update order status
        await manager.update(Order, sample.orderId, { status: OrderStatus.COMPLETED });
        this.logger.log(`Sample completed: ${sample.sampleNumber}`);

        // Billing is handled at order-creation time in orders.service.ts.
        // Do NOT bill again here to avoid duplicate invoice items.

        // Return patient to doctor for results review
        if (sample.order?.encounterId) {
          try {
            await this.encountersService.returnToDoctor(
              sample.order.encounterId,
              'Lab results ready for review',
              userId,
            );
            this.logger.log(`Encounter ${sample.order.encounterId} returned to doctor for lab results review`);
          } catch (e) {
            this.logger.warn(`Failed to return encounter to doctor: ${e.message}`);
          }
        }
      }

      this.logger.log(`Lab result released: ${id} by user ${userId}`);
      return savedResult;
    });
  }

  async amendResult(id: string, dto: AmendResultDto, userId: string, tenantId?: string): Promise<LabResult> {
    const result = await this.resultRepo.findOne({ where: { id , ...(tenantId ? { tenantId } : {}) } });
    if (!result) throw new NotFoundException('Result not found');

    // Store previous value
    const previousValues = result.previousValues || [];
    previousValues.push({
      value: result.value,
      date: new Date(),
      amendedBy: userId,
      reason: dto.amendmentReason,
    });

    result.value = dto.newValue;
    if (dto.numericValue !== undefined) result.numericValue = dto.numericValue;

    // Recalculate abnormal flag if numericValue changed
    if (dto.numericValue !== undefined && result.referenceMin !== undefined && result.referenceMax !== undefined) {
      let critLow: number | undefined;
      let critHigh: number | undefined;
      const sample = await this.getSample(result.sampleId, tenantId);
      if (sample.labTest?.referenceRanges && result.parameter) {
        const refRange = (sample.labTest.referenceRanges as any[]).find(
          (r: any) => r.parameter === result.parameter,
        );
        if (refRange) {
          critLow = refRange.criticalLow !== undefined ? Number(refRange.criticalLow) : undefined;
          critHigh = refRange.criticalHigh !== undefined ? Number(refRange.criticalHigh) : undefined;
        }
      }
      result.abnormalFlag = this.calculateAbnormalFlag(dto.numericValue, result.referenceMin, result.referenceMax, critLow, critHigh);
    }

    result.amendmentReason = dto.amendmentReason;
    result.previousValues = previousValues;
    result.status = ResultStatus.AMENDED;

    const savedResult = await this.resultRepo.save(result);
    this.logger.warn(`Lab result amended: ${id} by user ${userId}, reason: ${dto.amendmentReason}`);
    return savedResult;
  }

  // ========== LAB QUEUE & DASHBOARD ==========
  async getQueueStats(facilityId?: string, tenantId?: string): Promise<{ pending: number; completed: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingQuery = this.sampleRepo
      .createQueryBuilder('s')
      .where('s.status IN (:...statuses)', { 
        statuses: [SampleStatus.COLLECTED, SampleStatus.RECEIVED, SampleStatus.PROCESSING] 
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
    // Validate days parameter to prevent injection and ensure reasonable bounds
    const safeDays = Math.min(Math.max(Math.floor(days), 1), 365);
    
    const qb = this.sampleRepo
      .createQueryBuilder('s')
      .select('DATE(s.collectionTime)', 'date')
      .addSelect('AVG(EXTRACT(EPOCH FROM (s.completedTime - s.collectionTime)) / 60)', 'avgMinutes')
      .addSelect('COUNT(*)', 'count')
      .where('s.facilityId = :facilityId', { facilityId })
      .andWhere('s.status = :status', { status: SampleStatus.COMPLETED })
      .andWhere("s.collectionTime >= NOW() - CAST(:days || ' days' AS INTERVAL)", { days: safeDays });

    if (tenantId) {
      qb.andWhere('s.tenant_id = :tenantId', { tenantId });
    }

    const results = await qb
      .groupBy('DATE(s.collectionTime)')
      .orderBy('date', 'DESC')
      .getRawMany();

    return results;
  }

  // ========== HELPERS ==========
  private calculateAbnormalFlag(value: number, min: number, max: number, critLow?: number, critHigh?: number): AbnormalFlag {
    if (critLow !== undefined && value < critLow) return AbnormalFlag.CRITICAL_LOW;
    if (critHigh !== undefined && value > critHigh) return AbnormalFlag.CRITICAL_HIGH;
    if (value < min) return AbnormalFlag.LOW;
    if (value > max) return AbnormalFlag.HIGH;
    return AbnormalFlag.NORMAL;
  }

  async getCriticalResults(facilityId?: string, tenantId?: string): Promise<LabResult[]> {
    const qb = this.resultRepo
      .createQueryBuilder('result')
      .leftJoinAndSelect('result.sample', 'sample')
      .leftJoinAndSelect('sample.patient', 'patient')
      .leftJoinAndSelect('result.enteredBy', 'enteredBy')
      .where('result.abnormalFlag IN (:...flags)', {
        flags: [AbnormalFlag.CRITICAL_LOW, AbnormalFlag.CRITICAL_HIGH],
      })
      .orderBy('result.createdAt', 'DESC')
      .take(200);

    if (tenantId) {
      qb.andWhere('sample.tenant_id = :tenantId', { tenantId });
    }
    if (facilityId) {
      qb.andWhere('sample.facilityId = :facilityId', { facilityId });
    }

    return qb.getMany();
  }
}
