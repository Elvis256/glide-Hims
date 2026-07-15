import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { CarePlan } from './care-plan.entity';
import { CarePlanGoal } from './care-plan-goal.entity';

@Entity('care_plan_interventions')
@Index(['carePlanId'])
@Index(['tenantId'])
export class CarePlanIntervention extends BaseEntity {
  @Column({ type: 'uuid', name: 'care_plan_id' })
  carePlanId: string;

  @ManyToOne(() => CarePlan, cp => cp.interventions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'care_plan_id' })
  carePlan?: CarePlan;

  @Column({ type: 'uuid', name: 'goal_id', nullable: true })
  goalId?: string;

  @ManyToOne(() => CarePlanGoal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'goal_id' })
  goal?: CarePlanGoal;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frequency?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
