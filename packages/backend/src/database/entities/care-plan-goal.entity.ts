import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { CarePlan } from './care-plan.entity';

@Entity('care_plan_goals')
@Index(['carePlanId'])
@Index(['tenantId'])
export class CarePlanGoal extends BaseEntity {
  @Column({ type: 'uuid', name: 'care_plan_id' })
  carePlanId: string;

  @ManyToOne(() => CarePlan, cp => cp.goals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'care_plan_id' })
  carePlan?: CarePlan;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'date', name: 'target_date', nullable: true })
  targetDate?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // pending, in_progress, met, not_met

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
