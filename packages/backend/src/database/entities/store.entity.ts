import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

export enum StoreType {
  MAIN = 'main',
  PHARMACY = 'pharmacy',
  WARD = 'ward',
  THEATRE = 'theatre',
  LAB = 'lab',
  RADIOLOGY = 'radiology',
  EMERGENCY = 'emergency',
  DEPARTMENT = 'department',
}

@Entity('stores')
@Unique(['tenantId', 'code'])
@Index(['facility'])
export class Store extends BaseEntity {
  @Column({  })
  code: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: StoreType,
    default: StoreType.MAIN,
  })
  type: StoreType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'can_dispense', default: false })
  canDispense: boolean; // Can dispense to patients

  @Column({ name: 'can_issue', default: true })
  canIssue: boolean; // Can issue to other stores

  @Column({ name: 'can_receive', default: true })
  canReceive: boolean; // Can receive from suppliers/stores

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @Column({ name: 'manager_id', nullable: true })
  managerId: string;
}
