import { Entity, Column, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { User } from './user.entity';
import { CarePlanGoal } from './care-plan-goal.entity';
import { CarePlanIntervention } from './care-plan-intervention.entity';

@Entity('care_plans')
@Index(['admissionId'])
@Index(['tenantId'])
export class CarePlan extends BaseEntity {
  @Column({ type: 'uuid', name: 'admission_id' })
  admissionId: string;

  @ManyToOne(() => Admission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admission_id' })
  admission?: Admission;

  @Column({ type: 'varchar', length: 500 })
  diagnosis: string;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  priority: string; // low, medium, high

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // active, completed, discontinued

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: User;

  @OneToMany(() => CarePlanGoal, g => g.carePlan, { cascade: true })
  goals?: CarePlanGoal[];

  @OneToMany(() => CarePlanIntervention, i => i.carePlan, { cascade: true })
  interventions?: CarePlanIntervention[];
}
