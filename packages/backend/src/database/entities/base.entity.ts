import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
  Index,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // TODO: Data migration needed — change nullable to false once all 24 entities
  // have been backfilled with valid tenant_id values. Also add FK to tenants table.
  // Target: @Column({ type: 'uuid', nullable: false, name: 'tenant_id' })
  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  @Index()
  tenantId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
