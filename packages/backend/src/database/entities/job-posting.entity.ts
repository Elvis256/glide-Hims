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
import { Department } from './department.entity';

export enum JobStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
  ON_HOLD = 'on_hold',
  FILLED = 'filled',
}

export enum EmploymentType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  CONTRACT = 'contract',
  INTERN = 'intern',
}

@Entity('job_postings')
export class JobPosting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'uuid', nullable: true, name: 'department_id' })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  requirements: string;

  @Column({ type: 'text', nullable: true })
  responsibilities: string;

  @Column({ type: 'enum', enum: EmploymentType, default: EmploymentType.FULL_TIME, name: 'employment_type' })
  employmentType: EmploymentType;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'salary_min' })
  salaryMin: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true, name: 'salary_max' })
  salaryMax: number;

  @Column({ length: 100, nullable: true })
  location: string;

  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.DRAFT })
  status: JobStatus;

  @Column({ type: 'date', nullable: true, name: 'closing_date' })
  closingDate?: Date;

  @Column({ type: 'int', default: 1, name: 'positions_available' })
  positionsAvailable: number;

  @Column({ type: 'int', default: 0, name: 'applications_count' })
  applicationsCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
