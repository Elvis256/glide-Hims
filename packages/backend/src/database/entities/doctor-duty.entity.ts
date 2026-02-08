import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';

export enum DutyStatus {
  ON_DUTY = 'on_duty',
  OFF_DUTY = 'off_duty',
  ON_BREAK = 'on_break',
  IN_CONSULTATION = 'in_consultation',
}

@Entity('doctor_duties')
@Index(['facilityId', 'dutyDate'])
@Unique(['doctorId', 'facilityId', 'dutyDate'])
export class DoctorDuty extends BaseEntity {
  @Column({ type: 'uuid', name: 'doctor_id' })
  doctorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', name: 'department_id', nullable: true })
  departmentId?: string;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @Column({ type: 'date', name: 'duty_date' })
  dutyDate: Date;

  @Column({ type: 'enum', enum: DutyStatus, default: DutyStatus.OFF_DUTY })
  status: DutyStatus;

  @Column({ type: 'time', nullable: true, name: 'check_in_time' })
  checkInTime?: string;

  @Column({ type: 'time', nullable: true, name: 'check_out_time' })
  checkOutTime?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'room_number' })
  roomNumber?: string;

  @Column({ type: 'int', default: 0, name: 'current_queue_count' })
  currentQueueCount: number;

  @Column({ type: 'int', default: 20, name: 'max_patients' })
  maxPatients: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Who marked this doctor on duty
  @Column({ type: 'uuid', name: 'marked_by_id' })
  markedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'marked_by_id' })
  markedBy: User;
}
