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
import { SyncableEntity } from './sync-queue.entity';

export enum ConflictResolution {
  PENDING = 'pending',
  CLIENT_WINS = 'client_wins',
  SERVER_WINS = 'server_wins',
  MERGED = 'merged',
  MANUAL = 'manual',
}

export enum ConflictType {
  VERSION_MISMATCH = 'version_mismatch',
  CONCURRENT_EDIT = 'concurrent_edit',
  DELETE_EDIT = 'delete_edit', // Deleted on server, edited on client
  EDIT_DELETE = 'edit_delete', // Edited on server, deleted on client
  UNIQUE_CONSTRAINT = 'unique_constraint',
}

@Entity('sync_conflicts')
@Index(['facilityId', 'resolution'])
@Index(['entityType', 'entityId'])
export class SyncConflict {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  // Entity identification
  @Column({ type: 'enum', enum: SyncableEntity, name: 'entity_type' })
  entityType: SyncableEntity;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  // Conflict type
  @Column({ type: 'enum', enum: ConflictType, name: 'conflict_type' })
  conflictType: ConflictType;

  // Version information
  @Column({ type: 'int', name: 'client_version' })
  clientVersion: number;

  @Column({ type: 'int', name: 'server_version' })
  serverVersion: number;

  @Column({ type: 'bigint', name: 'client_timestamp' })
  clientTimestamp: number;

  @Column({ type: 'bigint', name: 'server_timestamp' })
  serverTimestamp: number;

  // Payloads for comparison
  @Column({ type: 'jsonb', name: 'client_payload' })
  clientPayload: Record<string, any>;

  @Column({ type: 'jsonb', name: 'server_payload' })
  serverPayload: Record<string, any>;

  // Base version (if available)
  @Column({ type: 'jsonb', nullable: true, name: 'base_payload' })
  basePayload: Record<string, any>; // Common ancestor if known

  // Conflicting fields
  @Column({ type: 'jsonb', name: 'conflicting_fields' })
  conflictingFields: string[];

  // Auto-merge suggestion (if possible)
  @Column({ type: 'jsonb', nullable: true, name: 'suggested_merge' })
  suggestedMerge?: Record<string, any>;

  // Resolution
  @Column({ type: 'enum', enum: ConflictResolution, default: ConflictResolution.PENDING })
  resolution: ConflictResolution;

  @Column({ type: 'jsonb', nullable: true, name: 'resolved_payload' })
  resolvedPayload?: Record<string, any>;

  @Column({ type: 'uuid', nullable: true, name: 'resolved_by_id' })
  resolvedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'resolved_by_id' })
  resolvedBy: User;

  @Column({ type: 'timestamp', nullable: true, name: 'resolved_at' })
  resolvedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'resolution_notes' })
  resolutionNotes?: string;

  // Client information
  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @Column({ type: 'uuid', name: 'client_user_id' })
  clientUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'client_user_id' })
  clientUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
