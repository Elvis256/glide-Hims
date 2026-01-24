import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Employee } from './employee.entity';
import { Facility } from './facility.entity';

@Entity('attendance_records')
export class AttendanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time', nullable: true, name: 'clock_in' })
  clockIn: string;

  @Column({ type: 'time', nullable: true, name: 'clock_out' })
  clockOut: string;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'hours_worked' })
  hoursWorked: number;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'overtime_hours' })
  overtimeHours: number;

  @Column({ length: 20, default: 'present' })
  status: string; // present, absent, late, half_day, holiday, weekend

  @Column({ type: 'text', nullable: true })
  notes: string;

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
