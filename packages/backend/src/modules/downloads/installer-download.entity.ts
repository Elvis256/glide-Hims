import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Installer } from './installer.entity';

@Entity('installer_downloads')
export class InstallerDownload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  installerId: string;

  @ManyToOne(() => Installer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'installerId' })
  installer: Installer;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'bigint', nullable: true })
  bytesServed: string | null;

  @Column({ type: 'boolean', default: true })
  success: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
