import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JobPosting } from './job-posting.entity';

export enum ApplicationStatus {
  SUBMITTED = 'submitted',
  SCREENING = 'screening',
  SHORTLISTED = 'shortlisted',
  INTERVIEW = 'interview',
  OFFERED = 'offered',
  HIRED = 'hired',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

@Entity('job_applications')
export class JobApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'job_posting_id' })
  jobPostingId: string;

  @ManyToOne(() => JobPosting)
  @JoinColumn({ name: 'job_posting_id' })
  jobPosting: JobPosting;

  @Column({ length: 100, name: 'first_name' })
  firstName: string;

  @Column({ length: 100, name: 'last_name' })
  lastName: string;

  @Column({ length: 100 })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true, name: 'cover_letter' })
  coverLetter: string;

  @Column({ length: 500, nullable: true, name: 'resume_url' })
  resumeUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  experience: { company: string; role: string; years: number }[];

  @Column({ type: 'jsonb', nullable: true })
  education: { institution: string; degree: string; year: number }[];

  @Column({ type: 'enum', enum: ApplicationStatus, default: ApplicationStatus.SUBMITTED })
  status: ApplicationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'int', nullable: true })
  rating: number;

  @Column({ type: 'date', nullable: true, name: 'interview_date' })
  interviewDate: Date;

  @CreateDateColumn({ name: 'applied_at' })
  appliedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
