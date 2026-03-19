import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('approval_requests')
export class ApprovalRequest extends BaseEntity {
  @Column({ type: 'varchar', length: 50, name: 'operation_type' })
  operationType: string; // payroll_process, user_termination, admin_role_change

  @Column({ type: 'uuid', name: 'requested_by_id' })
  requestedById: string;

  @Column({ type: 'jsonb', nullable: true, name: 'operation_data' })
  operationData?: any;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // pending, approved, rejected

  @Column({ type: 'uuid', nullable: true, name: 'approved_by_id' })
  approvedById?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: User;
}
