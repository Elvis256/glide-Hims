import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TreatmentPlan, TreatmentPlanStatus } from '../../database/entities/treatment-plan.entity';
import { CreateTreatmentPlanDto, UpdateTreatmentPlanDto, AddProgressNoteDto, RevisePlanDto, TreatmentPlanFilterDto } from './dto/treatment-plan.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TreatmentPlansService {
  constructor(
    @InjectRepository(TreatmentPlan)
    private treatmentPlanRepository: Repository<TreatmentPlan>,
  ) {}

  async create(dto: CreateTreatmentPlanDto, userId: string): Promise<TreatmentPlan> {
    const planNumber = await this.generatePlanNumber();

    const plan = this.treatmentPlanRepository.create({
      ...dto,
      planNumber,
      startDate: new Date(dto.startDate),
      expectedEndDate: dto.expectedEndDate ? new Date(dto.expectedEndDate) : undefined,
      createdById: userId,
      status: TreatmentPlanStatus.DRAFT,
      revisionNumber: 1,
    } as any);

    return this.treatmentPlanRepository.save(plan) as unknown as Promise<TreatmentPlan>;
  }

  async findAll(filter: TreatmentPlanFilterDto): Promise<TreatmentPlan[]> {
    const query = this.treatmentPlanRepository.createQueryBuilder('plan')
      .leftJoinAndSelect('plan.patient', 'patient')
      .leftJoinAndSelect('plan.primaryProvider', 'primaryProvider')
      .leftJoinAndSelect('plan.createdBy', 'createdBy');

    if (filter.patientId) {
      query.andWhere('plan.patient_id = :patientId', { patientId: filter.patientId });
    }
    if (filter.status) {
      query.andWhere('plan.status = :status', { status: filter.status });
    }
    if (filter.type) {
      query.andWhere('plan.type = :type', { type: filter.type });
    }
    if (filter.fromDate && filter.toDate) {
      query.andWhere('plan.start_date BETWEEN :fromDate AND :toDate', {
        fromDate: filter.fromDate,
        toDate: filter.toDate,
      });
    }

    query.orderBy('plan.created_at', 'DESC');

    return query.getMany();
  }

  async findOne(id: string): Promise<TreatmentPlan> {
    const plan = await this.treatmentPlanRepository.findOne({
      where: { id },
      relations: ['patient', 'encounter', 'primaryProvider', 'createdBy'],
    });

    if (!plan) {
      throw new NotFoundException('Treatment plan not found');
    }

    return plan;
  }

  async findByPatient(patientId: string): Promise<TreatmentPlan[]> {
    return this.treatmentPlanRepository.find({
      where: { patientId },
      relations: ['primaryProvider', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getActivePlans(patientId: string): Promise<TreatmentPlan[]> {
    return this.treatmentPlanRepository.find({
      where: { patientId, status: TreatmentPlanStatus.ACTIVE },
      relations: ['primaryProvider'],
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, dto: UpdateTreatmentPlanDto): Promise<TreatmentPlan> {
    const plan = await this.findOne(id);
    
    Object.assign(plan, dto);
    
    return this.treatmentPlanRepository.save(plan);
  }

  async activate(id: string): Promise<TreatmentPlan> {
    const plan = await this.findOne(id);

    if (plan.status !== TreatmentPlanStatus.DRAFT) {
      throw new BadRequestException('Only draft plans can be activated');
    }

    plan.status = TreatmentPlanStatus.ACTIVE;
    return this.treatmentPlanRepository.save(plan);
  }

  async complete(id: string): Promise<TreatmentPlan> {
    const plan = await this.findOne(id);

    if (plan.status !== TreatmentPlanStatus.ACTIVE) {
      throw new BadRequestException('Only active plans can be completed');
    }

    plan.status = TreatmentPlanStatus.COMPLETED;
    plan.actualEndDate = new Date();
    return this.treatmentPlanRepository.save(plan);
  }

  async discontinue(id: string, reason: string): Promise<TreatmentPlan> {
    const plan = await this.findOne(id);

    if (plan.status === TreatmentPlanStatus.COMPLETED) {
      throw new BadRequestException('Completed plans cannot be discontinued');
    }

    plan.status = TreatmentPlanStatus.DISCONTINUED;
    plan.actualEndDate = new Date();
    
    // Add discontinuation note
    const progressNotes = plan.progressNotes || [];
    progressNotes.push({
      date: new Date().toISOString(),
      note: `Plan discontinued: ${reason}`,
      provider: 'System',
    });
    plan.progressNotes = progressNotes;

    return this.treatmentPlanRepository.save(plan);
  }

  async addProgressNote(id: string, dto: AddProgressNoteDto, userId: string, providerName: string): Promise<TreatmentPlan> {
    const plan = await this.findOne(id);

    const progressNotes = plan.progressNotes || [];
    progressNotes.push({
      date: new Date().toISOString(),
      note: dto.note,
      provider: providerName,
    });
    plan.progressNotes = progressNotes;

    return this.treatmentPlanRepository.save(plan);
  }

  async updateGoalStatus(id: string, goalId: string, status: string): Promise<TreatmentPlan> {
    const plan = await this.findOne(id);

    if (!plan.goals) {
      throw new BadRequestException('No goals found in this plan');
    }

    const goalIndex = plan.goals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) {
      throw new NotFoundException('Goal not found');
    }

    plan.goals[goalIndex].status = status as any;
    return this.treatmentPlanRepository.save(plan);
  }

  async revisePlan(id: string, dto: RevisePlanDto, userId: string): Promise<TreatmentPlan> {
    const oldPlan = await this.findOne(id);

    // Mark old plan as revised
    oldPlan.status = TreatmentPlanStatus.REVISED;
    await this.treatmentPlanRepository.save(oldPlan);

    // Create new version
    const newPlanNumber = await this.generatePlanNumber();
    const newPlan = this.treatmentPlanRepository.create({
      ...oldPlan,
      id: undefined,
      planNumber: newPlanNumber,
      status: TreatmentPlanStatus.DRAFT,
      revisionNumber: oldPlan.revisionNumber + 1,
      revisionReason: dto.revisionReason,
      previousPlanId: oldPlan.id,
      createdById: userId,
      createdAt: undefined,
      updatedAt: undefined,
      ...dto.updates,
    } as any);

    return this.treatmentPlanRepository.save(newPlan) as unknown as Promise<TreatmentPlan>;
  }

  async recordConsent(id: string): Promise<TreatmentPlan> {
    const plan = await this.findOne(id);
    plan.patientConsentObtained = true;
    plan.consentDate = new Date();
    return this.treatmentPlanRepository.save(plan);
  }

  private async generatePlanNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `TP${year}${month}`;

    const lastPlan = await this.treatmentPlanRepository
      .createQueryBuilder('plan')
      .where('plan.plan_number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('plan.plan_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastPlan) {
      const lastSequence = parseInt(lastPlan.planNumber.slice(-5), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(5, '0')}`;
  }
}
