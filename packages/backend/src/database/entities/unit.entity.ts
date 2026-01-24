import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Department } from './department.entity';
import { Facility } from './facility.entity';

@Entity('units')
@Index(['departmentId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
export class Unit extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', name: 'department_id' })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'uuid', nullable: true, name: 'head_user_id' })
  headUserId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  location?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;
}
