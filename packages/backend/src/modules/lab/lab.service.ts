import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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
  ) {}

  // ========== LAB TEST CATALOG ==========
  async createLabTest(dto: CreateLabTestDto): Promise<LabTest> {
    const existing = await this.labTestRepo.findOne({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Test code already exists');
    
    const test = this.labTestRepo.create(dto);
    return this.labTestRepo.save(test);
  }

  async getLabTests(query: LabTestQueryDto): Promise<LabTest[]> {
    const qb = this.labTestRepo.createQueryBuilder('test');

    if (query.category) qb.andWhere('test.category = :category', { category: query.category });
    if (query.status) qb.andWhere('test.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere('(test.code ILIKE :search OR test.name ILIKE :search)', 
        { search: `%${query.search}%` });
    }

    return qb.orderBy('test.name', 'ASC').getMany();
  }

  async getLabTest(id: string): Promise<LabTest> {
    const test = await this.labTestRepo.findOne({ where: { id } });
    if (!test) throw new NotFoundException('Lab test not found');
    return test;
  }

  async updateLabTest(id: string, dto: UpdateLabTestDto): Promise<LabTest> {
    const test = await this.getLabTest(id);
    Object.assign(test, dto);
    return this.labTestRepo.save(test);
  }

  // ========== SAMPLE MANAGEMENT ==========
  async collectSample(dto: CollectSampleDto, userId: string): Promise<LabSample> {
    // Resolve labTestId from code if not provided
    let labTestId = dto.labTestId;
    if (!labTestId && dto.labTestCode) {
      const labTest = await this.labTestRepo.findOne({ where: { code: dto.labTestCode } });
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
      this.orderRepo.findOne({ where: { id: dto.orderId } }),
      this.labTestRepo.findOne({ where: { id: labTestId } }),
      this.patientRepo.findOne({ where: { id: dto.patientId } }),
      this.facilityRepo.findOne({ where: { id: dto.facilityId } }),
    ]);

    if (!order) {
      throw new NotFoundException(`Order not found: ${dto.orderId}`);
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

    return this.dataSource.transaction(async (manager) => {
      // Generate sample number
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Count today's samples using raw query
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const result = await manager.query(
        `SELECT COUNT(*) as count FROM lab_samples WHERE created_at >= $1 AND created_at < $2`,
        [todayStart, todayEnd]
      );
      const count = parseInt(result[0]?.count || '0', 10);
      
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
      });

      const savedSample = await manager.save(sample);
      
      this.logger.log(`Sample collected: ${sampleNumber} for patient ${dto.patientId} by user ${userId}`);
      
      return savedSample;
    });
  }

  async getSamples(query: SampleQueryDto): Promise<{ data: LabSample[]; total: number }> {
    const qb = this.sampleRepo.createQueryBuilder('sample')
      .leftJoinAndSelect('sample.patient', 'patient')
      .leftJoinAndSelect('sample.labTest', 'labTest')
      .leftJoinAndSelect('sample.order', 'order')
      .leftJoinAndSelect('sample.collectedBy', 'collectedBy');

    if (query.facilityId) qb.andWhere('sample.facilityId = :facilityId', { facilityId: query.facilityId });
    if (query.status) qb.andWhere('sample.status = :status', { status: query.status });
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

  async getSample(id: string): Promise<LabSample> {
    const sample = await this.sampleRepo.findOne({
      where: { id },
      relations: ['patient', 'labTest', 'order', 'results', 'collectedBy', 'processedBy'],
    });
    if (!sample) throw new NotFoundException('Sample not found');
    return sample;
  }

  async receiveSample(id: string, dto: ReceiveSampleDto, userId: string): Promise<LabSample> {
    const sample = await this.getSample(id);
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

  async startProcessing(id: string, userId: string): Promise<LabSample> {
    const sample = await this.getSample(id);
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

  async rejectSample(id: string, dto: RejectSampleDto, userId: string): Promise<LabSample> {
    const sample = await this.getSample(id);
    
    sample.status = SampleStatus.REJECTED;
    sample.rejectionReason = dto.rejectionReason;

    const savedSample = await this.sampleRepo.save(sample);
    this.logger.warn(`Sample rejected: ${sample.sampleNumber} by user ${userId}, reason: ${dto.rejectionReason}`);
    return savedSample;
  }

  // ========== RESULT MANAGEMENT ==========
  async enterResult(sampleId: string, dto: EnterResultDto, userId: string): Promise<LabResult> {
    const sample = await this.getSample(sampleId);
    
    // Calculate abnormal flag if numeric value provided
    let abnormalFlag = dto.abnormalFlag || AbnormalFlag.NORMAL;
    if (dto.numericValue !== undefined && dto.referenceMin !== undefined && dto.referenceMax !== undefined) {
      abnormalFlag = this.calculateAbnormalFlag(dto.numericValue, dto.referenceMin, dto.referenceMax);
    }

    const result = this.resultRepo.create({
      ...dto,
      sampleId,
      abnormalFlag,
      status: ResultStatus.ENTERED,
      enteredById: userId,
    });

    const savedResult = await this.resultRepo.save(result);
    this.logger.log(`Lab result entered for sample ${sample.sampleNumber}: ${dto.parameter} by user ${userId}`);
    return savedResult;
  }

  async getResults(sampleId: string): Promise<LabResult[]> {
    return this.resultRepo.find({
      where: { sampleId },
      relations: ['enteredBy', 'validatedBy', 'releasedBy'],
      order: { createdAt: 'ASC' },
    });
  }

  async validateResult(id: string, dto: ValidateResultDto, userId: string): Promise<LabResult> {
    const result = await this.resultRepo.findOne({ where: { id } });
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
    return savedResult;
  }

  async releaseResult(id: string, userId: string): Promise<LabResult> {
    const result = await this.resultRepo.findOne({ where: { id } });
    if (!result) throw new NotFoundException('Result not found');
    
    if (result.status !== ResultStatus.VALIDATED) {
      throw new BadRequestException('Result must be validated before release');
    }

    result.status = ResultStatus.RELEASED;
    result.releasedById = userId;
    result.releasedAt = new Date();

    // Check if all results for sample are released
    const sample = await this.getSample(result.sampleId);
    const allResults = await this.getResults(result.sampleId);
    const allReleased = allResults.every(r => r.id === id || r.status === ResultStatus.RELEASED);
    
    if (allReleased) {
      sample.status = SampleStatus.COMPLETED;
      sample.completedTime = new Date();
      await this.sampleRepo.save(sample);

      // Update order status
      await this.orderRepo.update(sample.orderId, { status: OrderStatus.COMPLETED });
      this.logger.log(`Sample completed: ${sample.sampleNumber}`);
    }

    const savedResult = await this.resultRepo.save(result);
    this.logger.log(`Lab result released: ${id} by user ${userId}`);
    return savedResult;
  }

  async amendResult(id: string, dto: AmendResultDto, userId: string): Promise<LabResult> {
    const result = await this.resultRepo.findOne({ where: { id } });
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
    result.amendmentReason = dto.amendmentReason;
    result.previousValues = previousValues;
    result.status = ResultStatus.AMENDED;

    const savedResult = await this.resultRepo.save(result);
    this.logger.warn(`Lab result amended: ${id} by user ${userId}, reason: ${dto.amendmentReason}`);
    return savedResult;
  }

  // ========== LAB QUEUE & DASHBOARD ==========
  async getQueueStats(facilityId?: string): Promise<{ pending: number; completed: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingQuery = this.sampleRepo
      .createQueryBuilder('s')
      .where('s.status IN (:...statuses)', { 
        statuses: [SampleStatus.COLLECTED, SampleStatus.RECEIVED, SampleStatus.PROCESSING] 
      });
    
    if (facilityId) {
      pendingQuery.andWhere('s.facilityId = :facilityId', { facilityId });
    }

    const pending = await pendingQuery.getCount();

    const completedQuery = this.sampleRepo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SampleStatus.COMPLETED })
      .andWhere('s.completedTime >= :today', { today });
    
    if (facilityId) {
      completedQuery.andWhere('s.facilityId = :facilityId', { facilityId });
    }

    const completed = await completedQuery.getCount();

    return { pending, completed };
  }

  async getLabQueue(facilityId: string): Promise<any> {
    const pendingCollection = await this.orderRepo.count({
      where: { orderType: OrderType.LAB, status: OrderStatus.PENDING },
    });

    const pendingProcessing = await this.sampleRepo.count({
      where: { facilityId, status: SampleStatus.RECEIVED },
    });

    const inProgress = await this.sampleRepo.count({
      where: { facilityId, status: SampleStatus.PROCESSING },
    });

    const completedToday = await this.sampleRepo
      .createQueryBuilder('s')
      .where('s.facilityId = :facilityId', { facilityId })
      .andWhere('s.status = :status', { status: SampleStatus.COMPLETED })
      .andWhere('DATE(s.completedTime) = CURRENT_DATE')
      .getCount();

    return {
      pendingCollection,
      pendingProcessing,
      inProgress,
      completedToday,
    };
  }

  async getTurnaroundStats(facilityId: string, days = 7): Promise<any[]> {
    // Validate days parameter to prevent injection and ensure reasonable bounds
    const safeDays = Math.min(Math.max(Math.floor(days), 1), 365);
    
    const results = await this.sampleRepo
      .createQueryBuilder('s')
      .select('DATE(s.collectionTime)', 'date')
      .addSelect('AVG(EXTRACT(EPOCH FROM (s.completedTime - s.collectionTime)) / 60)', 'avgMinutes')
      .addSelect('COUNT(*)', 'count')
      .where('s.facilityId = :facilityId', { facilityId })
      .andWhere('s.status = :status', { status: SampleStatus.COMPLETED })
      .andWhere("s.collectionTime >= NOW() - CAST(:days || ' days' AS INTERVAL)", { days: safeDays })
      .groupBy('DATE(s.collectionTime)')
      .orderBy('date', 'DESC')
      .getRawMany();

    return results;
  }

  // ========== HELPERS ==========
  private calculateAbnormalFlag(value: number, min: number, max: number): AbnormalFlag {
    if (value < min) return AbnormalFlag.LOW;
    if (value > max) return AbnormalFlag.HIGH;
    return AbnormalFlag.NORMAL;
  }
}
