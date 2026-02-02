import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

@Entity('departments')
export class Department extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId?: string;

  @ManyToOne(() => Department, (dept) => dept.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Department;

  @OneToMany(() => Department, (dept) => dept.parent)
  children?: Department[];

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;
}
