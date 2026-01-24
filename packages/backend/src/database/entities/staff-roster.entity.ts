import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Employee } from './employee.entity';
import { ShiftDefinition } from './shift-definition.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum RosterStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ABSENT = 'absent',
  SWAP_PENDING = 'swap_pending',
  CANCELLED = 'cancelled',
}

@Entity('staff_rosters')
@Index(['facilityId', 'rosterDate'])
@Index(['employeeId', 'rosterDate'])
export class StaffRoster {
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

  @Column({ type: 'uuid', name: 'shift_definition_id' })
  shiftDefinitionId: string;

  @ManyToOne(() => ShiftDefinition)
  @JoinColumn({ name: 'shift_definition_id' })
  shiftDefinition: ShiftDefinition;

  @Column({ type: 'date', name: 'roster_date' })
  rosterDate: Date;

  @Column({ type: 'enum', enum: RosterStatus, default: RosterStatus.SCHEDULED })
  status: RosterStatus;

  // Actual times (for tracking)
  @Column({ type: 'time', nullable: true, name: 'actual_start_time' })
  actualStartTime: string;

  @Column({ type: 'time', nullable: true, name: 'actual_end_time' })
  actualEndTime: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'hours_worked' })
  hoursWorked: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'overtime_hours' })
  overtimeHours: number;

  // Swap tracking
  @Column({ type: 'uuid', nullable: true, name: 'original_employee_id' })
  originalEmployeeId: string; // If this was swapped

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'original_employee_id' })
  originalEmployee: Employee;

  // Notes
  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true, name: 'absence_reason' })
  absenceReason: string;

  // Created by
  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ type: 'uuid', nullable: true, name: 'confirmed_by_id' })
  confirmedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'confirmed_by_id' })
  confirmedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
