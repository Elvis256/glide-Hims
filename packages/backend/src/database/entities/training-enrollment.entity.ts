import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TrainingProgram } from './training-program.entity';
import { Employee } from './employee.entity';

export enum EnrollmentStatus {
  ENROLLED = 'enrolled',
  ATTENDING = 'attending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

@Entity('training_enrollments')
export class TrainingEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'training_program_id' })
  trainingProgramId: string;

  @ManyToOne(() => TrainingProgram)
  @JoinColumn({ name: 'training_program_id' })
  trainingProgram: TrainingProgram;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'enum', enum: EnrollmentStatus, default: EnrollmentStatus.ENROLLED })
  status: EnrollmentStatus;

  @Column({ type: 'date', nullable: true, name: 'completion_date' })
  completionDate: Date;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number;

  @Column({ type: 'boolean', default: false })
  certified: boolean;

  @Column({ type: 'date', nullable: true, name: 'certification_expiry' })
  certificationExpiry: Date;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @CreateDateColumn({ name: 'enrolled_at' })
  enrolledAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
