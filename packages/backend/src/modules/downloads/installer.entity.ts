import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type InstallerChannel = 'stable' | 'beta' | 'lts';
export type InstallerKind = 'docker-image' | 'tarball' | 'iso' | 'usb-bundle' | 'updater';

@Entity('installers')
export class Installer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  @Index()
  name: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  version: string;

  @Column({ type: 'varchar', length: 30, default: 'stable' })
  @Index()
  channel: InstallerChannel;

  @Column({ type: 'varchar', length: 30, default: 'tarball' })
  kind: InstallerKind;

  @Column({ type: 'varchar', length: 20, default: 'linux-amd64' })
  platform: string;

  @Column({ type: 'varchar', length: 300 })
  filename: string;

  @Column({ type: 'bigint' })
  sizeBytes: string;

  @Column({ type: 'varchar', length: 64 })
  sha256: string;

  @Column({ type: 'text', nullable: true })
  releaseNotes: string | null;

  @Column({ type: 'boolean', default: true })
  isPublished: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  minLicenseTier: string | null;

  @CreateDateColumn()
  releasedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
