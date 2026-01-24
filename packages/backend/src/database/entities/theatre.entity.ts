import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Facility } from './facility.entity';

export enum TheatreType {
  GENERAL = 'general',
  ORTHOPEDIC = 'orthopedic',
  CARDIAC = 'cardiac',
  NEURO = 'neuro',
  OBSTETRIC = 'obstetric',
  OPHTHALMIC = 'ophthalmic',
  ENT = 'ent',
  MINOR = 'minor',
}

export enum TheatreStatus {
  AVAILABLE = 'available',
  IN_USE = 'in_use',
  CLEANING = 'cleaning',
  MAINTENANCE = 'maintenance',
  OUT_OF_SERVICE = 'out_of_service',
}

@Entity('theatres')
export class Theatre {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 20, unique: true })
  code: string;

  @Column({ type: 'enum', enum: TheatreType, default: TheatreType.GENERAL })
  type: TheatreType;

  @Column({ type: 'enum', enum: TheatreStatus, default: TheatreStatus.AVAILABLE, name: 'status' })
  status: TheatreStatus;

  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ type: 'jsonb', nullable: true })
  equipment: {
    name: string;
    status: 'working' | 'maintenance' | 'broken';
    lastServiced?: string;
  }[];

  @Column({ type: 'int', default: 1, name: 'capacity' })
  capacity: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
