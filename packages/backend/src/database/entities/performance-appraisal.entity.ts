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
import { Employee } from './employee.entity';

export enum AppraisalStatus {
  DRAFT = 'draft',
  SELF_REVIEW = 'self_review',
  MANAGER_REVIEW = 'manager_review',
  COMPLETED = 'completed',
  ACKNOWLEDGED = 'acknowledged',
}

export enum AppraisalPeriod {
  Q1 = 'Q1',
  Q2 = 'Q2',
  Q3 = 'Q3',
  Q4 = 'Q4',
  ANNUAL = 'annual',
  PROBATION = 'probation',
}

@Entity('performance_appraisals')
export class PerformanceAppraisal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'uuid', name: 'reviewer_id' })
  reviewerId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: Employee;

  @Column({ type: 'enum', enum: AppraisalPeriod, name: 'appraisal_period' })
  appraisalPeriod: AppraisalPeriod;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'enum', enum: AppraisalStatus, default: AppraisalStatus.DRAFT })
  status: AppraisalStatus;

  // Ratings (1-5 scale)
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'job_knowledge_rating' })
  jobKnowledgeRating: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'work_quality_rating' })
  workQualityRating: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'attendance_rating' })
  attendanceRating: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'communication_rating' })
  communicationRating: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'teamwork_rating' })
  teamworkRating: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'initiative_rating' })
  initiativeRating: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true, name: 'overall_rating' })
  overallRating: number;

  // Comments
  @Column({ type: 'text', nullable: true, name: 'employee_comments' })
  employeeComments: string;

  @Column({ type: 'text', nullable: true, name: 'reviewer_comments' })
  reviewerComments: string;

  @Column({ type: 'text', nullable: true })
  strengths: string;

  @Column({ type: 'text', nullable: true, name: 'areas_for_improvement' })
  areasForImprovement: string;

  @Column({ type: 'text', nullable: true })
  goals: string;

  @Column({ type: 'date', nullable: true, name: 'review_date' })
  reviewDate: Date;

  @Column({ type: 'date', nullable: true, name: 'acknowledged_date' })
  acknowledgedDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
