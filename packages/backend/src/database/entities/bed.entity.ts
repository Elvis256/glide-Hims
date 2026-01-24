import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Ward } from './ward.entity';

export enum BedStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  MAINTENANCE = 'maintenance',
  CLEANING = 'cleaning',
}

export enum BedType {
  STANDARD = 'standard',
  ICU = 'icu',
  PEDIATRIC = 'pediatric',
  MATERNITY = 'maternity',
  ISOLATION = 'isolation',
}

@Entity('beds')
export class Bed extends BaseEntity {
  @Column()
  bedNumber: string;

  @Column({ type: 'enum', enum: BedType, default: BedType.STANDARD })
  type: BedType;

  @Column({ type: 'enum', enum: BedStatus, default: BedStatus.AVAILABLE })
  status: BedStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  dailyRate: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ type: 'uuid' })
  wardId: string;

  @ManyToOne(() => Ward, ward => ward.beds)
  @JoinColumn({ name: 'wardId' })
  ward: Ward;

  @OneToMany('Admission', 'bed')
  admissions: any[];
}
