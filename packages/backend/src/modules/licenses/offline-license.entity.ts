import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('offline_licenses')
export class OfflineLicense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  licenseKey!: string;

  @Column({ type: 'varchar', length: 255 })
  organizationName!: string;

  @Column({ type: 'varchar', length: 50, default: 'standalone' })
  licenseType!: string;

  @Column({ type: 'varchar', length: 50, default: 'basic' })
  tier!: string;

  @Column({ type: 'integer', default: 1 })
  maxDeployments!: number;

  @Column({ type: 'integer', default: 0 })
  maxUsers!: number;

  @Column({ type: 'integer', default: 0 })
  maxPatients!: number;

  @Column({ type: 'timestamp' })
  issuedAt!: Date;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 1024 })
  signature!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
