import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Facility } from './facility.entity';

export enum ModalityType {
  XRAY = 'xray',
  CT = 'ct',
  MRI = 'mri',
  ULTRASOUND = 'ultrasound',
  MAMMOGRAPHY = 'mammography',
  FLUOROSCOPY = 'fluoroscopy',
  DEXA = 'dexa',
  ECHOCARDIOGRAM = 'echocardiogram',
}

@Entity('imaging_modalities')
export class ImagingModality {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ModalityType, name: 'modality_type' })
  modalityType: ModalityType;

  @Column({ length: 50, nullable: true })
  manufacturer: string;

  @Column({ length: 100, nullable: true })
  model: string;

  @Column({ length: 50, nullable: true })
  location: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_available' })
  isAvailable: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
