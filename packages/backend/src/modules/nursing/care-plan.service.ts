import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CarePlan } from '../../database/entities/care-plan.entity';
import { CarePlanGoal } from '../../database/entities/care-plan-goal.entity';
import { CarePlanIntervention } from '../../database/entities/care-plan-intervention.entity';
import { requireTenantId } from '../../common/utils/tenant.util';
import { CreateCarePlanDto, UpdateCarePlanDto, AddGoalDto, AddInterventionDto, QueryCarePlanDto } from './dto/care-plan.dto';

@Injectable()
export class CarePlanService {
  private readonly logger = new Logger(CarePlanService.name);

  constructor(
    @InjectRepository(CarePlan) private readonly repo: Repository<CarePlan>,
    @InjectRepository(CarePlanGoal) private readonly goalRepo: Repository<CarePlanGoal>,
    @InjectRepository(CarePlanIntervention) private readonly interventionRepo: Repository<CarePlanIntervention>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateCarePlanDto, userId: string, tenantId?: string): Promise<CarePlan> {
    const tid = requireTenantId(tenantId);

    return this.dataSource.transaction(async (manager) => {
      const plan = manager.create(CarePlan, {
        admissionId: dto.admissionId,
        diagnosis: dto.diagnosis,
        priority: dto.priority || 'medium',
        notes: dto.notes,
        tenantId: tid,
        createdById: userId,
      });
      const saved = await manager.save(plan);

      if (dto.goals?.length) {
        const goals = dto.goals.map(g => manager.create(CarePlanGoal, {
          ...g,
          carePlanId: saved.id,
          tenantId: tid,
        }));
        saved.goals = await manager.save(goals);
      }

      if (dto.interventions?.length) {
        const interventions = dto.interventions.map(i => manager.create(CarePlanIntervention, {
          ...i,
          carePlanId: saved.id,
          tenantId: tid,
        }));
        saved.interventions = await manager.save(interventions);
      }

      return saved;
    });
  }

  async list(query: QueryCarePlanDto, tenantId?: string): Promise<CarePlan[]> {
    const tid = requireTenantId(tenantId);
    const qb = this.repo.createQueryBuilder('cp')
      .leftJoinAndSelect('cp.goals', 'goals')
      .leftJoinAndSelect('cp.interventions', 'interventions')
      .leftJoinAndSelect('cp.createdBy', 'createdBy')
      .where('cp.tenant_id = :tenantId', { tenantId: tid });

    if (query.admissionId) qb.andWhere('cp.admission_id = :admissionId', { admissionId: query.admissionId });
    if (query.status) qb.andWhere('cp.status = :status', { status: query.status });

    return qb.orderBy('cp.created_at', 'DESC').getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<CarePlan> {
    const tid = requireTenantId(tenantId);
    const plan = await this.repo.findOne({
      where: { id, tenantId: tid },
      relations: ['goals', 'interventions', 'createdBy'],
    });
    if (!plan) throw new NotFoundException('Care plan not found');
    return plan;
  }

  async update(id: string, dto: UpdateCarePlanDto, tenantId?: string): Promise<CarePlan> {
    const plan = await this.findOne(id, tenantId);
    Object.assign(plan, dto);
    return this.repo.save(plan);
  }

  async addGoal(carePlanId: string, dto: AddGoalDto, tenantId?: string): Promise<CarePlanGoal> {
    const tid = requireTenantId(tenantId);
    await this.findOne(carePlanId, tenantId); // ensure plan exists
    const goal = this.goalRepo.create({
      ...dto,
      carePlanId,
      tenantId: tid,
    });
    return this.goalRepo.save(goal);
  }

  async addIntervention(carePlanId: string, dto: AddInterventionDto, tenantId?: string): Promise<CarePlanIntervention> {
    const tid = requireTenantId(tenantId);
    await this.findOne(carePlanId, tenantId);
    const intervention = this.interventionRepo.create({
      ...dto,
      carePlanId,
      tenantId: tid,
    });
    return this.interventionRepo.save(intervention);
  }
}
