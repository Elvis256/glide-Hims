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
import { StaffRoster } from './staff-roster.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum SwapRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('shift_swap_requests')
export class ShiftSwapRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  // Requester (wants to swap away)
  @Column({ type: 'uuid', name: 'requester_id' })
  requesterId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'requester_id' })
  requester: Employee;

  @Column({ type: 'uuid', name: 'requester_roster_id' })
  requesterRosterId: string;

  @ManyToOne(() => StaffRoster)
  @JoinColumn({ name: 'requester_roster_id' })
  requesterRoster: StaffRoster;

  // Target (will take over the shift)
  @Column({ type: 'uuid', name: 'target_employee_id' })
  targetEmployeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'target_employee_id' })
  targetEmployee: Employee;

  @Column({ type: 'uuid', nullable: true, name: 'target_roster_id' })
  targetRosterId: string; // If mutual swap

  @ManyToOne(() => StaffRoster)
  @JoinColumn({ name: 'target_roster_id' })
  targetRoster: StaffRoster;

  // Request details
  @Column({ type: 'boolean', default: false, name: 'is_mutual_swap' })
  isMutualSwap: boolean; // True if swapping shifts, false if just taking over

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: SwapRequestStatus, default: SwapRequestStatus.PENDING })
  status: SwapRequestStatus;

  // Target employee acceptance
  @Column({ type: 'boolean', nullable: true, name: 'target_accepted' })
  targetAccepted: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'target_responded_at' })
  targetRespondedAt: Date;

  // Manager approval
  @Column({ type: 'uuid', nullable: true, name: 'approved_by_id' })
  approvedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt: Date;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
