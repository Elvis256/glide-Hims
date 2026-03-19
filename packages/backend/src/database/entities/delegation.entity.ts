import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Role } from './role.entity';

@Entity('delegations')
@Index(['delegateId', 'status'])
@Index(['delegatorId'])
export class Delegation extends BaseEntity {
  @Column({ type: 'uuid', name: 'delegator_id' })
  delegatorId: string;

  @Column({ type: 'uuid', name: 'delegate_id' })
  delegateId: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string; // active, expired, revoked

  @ManyToOne(() => User)
  @JoinColumn({ name: 'delegator_id' })
  delegator?: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'delegate_id' })
  delegate?: User;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role?: Role;
}
