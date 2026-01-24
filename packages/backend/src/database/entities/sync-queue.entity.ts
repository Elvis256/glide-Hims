import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum SyncStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SYNCED = 'synced',
  CONFLICT = 'conflict',
  FAILED = 'failed',
}

export enum SyncableEntity {
  PATIENT = 'patient',
  ENCOUNTER = 'encounter',
  VITAL_SIGN = 'vital_sign',
  CLINICAL_NOTE = 'clinical_note',
  PRESCRIPTION = 'prescription',
  LAB_ORDER = 'lab_order',
  LAB_RESULT = 'lab_result',
  IMAGING_ORDER = 'imaging_order',
  ADMISSION = 'admission',
  INVOICE = 'invoice',
  PAYMENT = 'payment',
  ANTENATAL_VISIT = 'antenatal_visit',
  POSTNATAL_VISIT = 'postnatal_visit',
  IMMUNIZATION = 'immunization',
}

@Entity('sync_queue')
@Index(['facilityId', 'status'])
@Index(['clientId', 'createdAt'])
@Index(['entityType', 'entityId'])
export class SyncQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  // Client identification
  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string; // Unique ID of the offline client/device

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'device_name' })
  deviceName: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'device_type' })
  deviceType: string; // desktop, mobile, tablet

  // Entity information
  @Column({ type: 'enum', enum: SyncableEntity, name: 'entity_type' })
  entityType: SyncableEntity;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'enum', enum: SyncOperation })
  operation: SyncOperation;

  // Version tracking for conflict detection
  @Column({ type: 'int', name: 'client_version' })
  clientVersion: number;

  @Column({ type: 'bigint', name: 'client_timestamp' })
  clientTimestamp: number; // Unix timestamp when change was made offline

  // Payload
  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'previous_payload' })
  previousPayload: Record<string, any>; // For updates, store previous state

  // Sync status
  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.PENDING })
  status: SyncStatus;

  @Column({ type: 'timestamp', nullable: true, name: 'synced_at' })
  syncedAt: Date;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;

  // Related conflict if any
  @Column({ type: 'uuid', nullable: true, name: 'conflict_id' })
  conflictId: string;

  // User who made the change
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
