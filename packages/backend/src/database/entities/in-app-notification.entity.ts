import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  LAB_RESULT_READY = 'lab_result_ready',
  RADIOLOGY_RESULT_READY = 'radiology_result_ready',
  PRESCRIPTION_DISPENSED = 'prescription_dispensed',
  NEW_PRESCRIPTION = 'new_prescription',
  NEW_ORDER = 'new_order',
  BILL_RETURNED = 'bill_returned',
}

@Entity('in_app_notifications')
export class InAppNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  facilityId: string;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ nullable: true })
  referenceType: string;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ default: false })
  @Index()
  isRead: boolean;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
