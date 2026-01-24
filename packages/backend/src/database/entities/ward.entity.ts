import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

export enum WardType {
  GENERAL = 'general',
  PRIVATE = 'private',
  ICU = 'icu',
  PEDIATRIC = 'pediatric',
  MATERNITY = 'maternity',
  SURGICAL = 'surgical',
  EMERGENCY = 'emergency',
}

export enum WardStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

@Entity('wards')
export class Ward extends BaseEntity {
  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'enum', enum: WardType, default: WardType.GENERAL })
  type: WardType;

  @Column({ type: 'enum', enum: WardStatus, default: WardStatus.ACTIVE })
  status: WardStatus;

  @Column({ type: 'int', default: 0 })
  totalBeds: number;

  @Column({ type: 'int', default: 0 })
  occupiedBeds: number;

  @Column({ nullable: true })
  floor: string;

  @Column({ nullable: true })
  building: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facilityId' })
  facility: Facility;

  @OneToMany('Bed', 'ward')
  beds: any[];

  @OneToMany('Admission', 'ward')
  admissions: any[];
}
