import { Entity, Column, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Admission } from './admission.entity';
import { User } from './user.entity';

@Entity('intake_output_entries')
@Index(['admissionId', 'timestamp'])
@Index(['tenantId'])
export class IntakeOutputEntry extends BaseEntity {
  @Column({ type: 'uuid', name: 'admission_id' })
  admissionId: string;

  @ManyToOne(() => Admission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'admission_id' })
  admission?: Admission;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 10 })
  type: 'intake' | 'output';

  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: 'ml' })
  unit: string;

  @Column({ type: 'jsonb', nullable: true })
  characteristics?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', name: 'recorded_by_id', nullable: true })
  recordedById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy?: User;
}
