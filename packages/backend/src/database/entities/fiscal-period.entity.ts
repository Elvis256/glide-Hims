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

export enum PeriodStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  LOCKED = 'locked',
}

@Entity('fiscal_periods')
export class FiscalPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'int', name: 'fiscal_year' })
  fiscalYear: number;

  @Column({ type: 'int' })
  period: number; // 1-12 for months

  @Column({ length: 50, name: 'period_name' })
  periodName: string; // e.g., "January 2026"

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;

  @Column({ type: 'enum', enum: PeriodStatus, default: PeriodStatus.OPEN })
  status: PeriodStatus;

  @Column({ type: 'uuid', nullable: true, name: 'closed_by_id' })
  closedById: string;

  @Column({ type: 'timestamp', nullable: true, name: 'closed_at' })
  closedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
