import { Entity, Column, Index, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * App Version - Tracks version history for updates
 */
@Entity('app_versions')
export class AppVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  version: string;

  @Column({ type: 'varchar', length: 50, name: 'version_code' })
  versionCode: string;

  @Column({ type: 'text', nullable: true, name: 'release_notes' })
  releaseNotes: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'min_upgrade_from' })
  minUpgradeFrom: string;

  @Column({ type: 'boolean', default: false, name: 'is_mandatory' })
  isMandatory: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_latest' })
  isLatest: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'download_url' })
  downloadUrl: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum: string;

  @Column({ type: 'bigint', nullable: true, name: 'file_size' })
  fileSize: number;

  @CreateDateColumn({ name: 'released_at' })
  releasedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'end_of_support' })
  endOfSupport: Date;
}
