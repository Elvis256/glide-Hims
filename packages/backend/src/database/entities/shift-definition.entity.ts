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

export enum ShiftType {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  NIGHT = 'night',
  ON_CALL = 'on_call',
  CUSTOM = 'custom',
}

@Entity('shift_definitions')
export class ShiftDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'enum', enum: ShiftType, name: 'shift_type' })
  shiftType: ShiftType;

  @Column({ type: 'time', name: 'start_time' })
  startTime: string;

  @Column({ type: 'time', name: 'end_time' })
  endTime: string;

  @Column({ type: 'decimal', precision: 4, scale: 2, name: 'duration_hours' })
  durationHours: number;

  @Column({ type: 'boolean', name: 'crosses_midnight', default: false })
  crossesMidnight: boolean;

  // Break time
  @Column({ type: 'int', default: 0, name: 'break_minutes' })
  breakMinutes: number;

  // Department (optional - null means all departments)
  @Column({ type: 'uuid', name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  // Minimum staff required for this shift
  @Column({ type: 'int', default: 1, name: 'min_staff' })
  minStaff: number;

  @Column({ type: 'int', nullable: true, name: 'max_staff' })
  maxStaff: number;

  // Pay multiplier (for night shifts, weekends)
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0, name: 'pay_multiplier' })
  payMultiplier: number;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string; // Hex color for calendar display

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
