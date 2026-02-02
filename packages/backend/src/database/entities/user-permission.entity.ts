import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Permission } from './permission.entity';

@Entity('user_permissions')
@Unique(['userId', 'permissionId'])
export class UserPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', name: 'permission_id' })
  permissionId: string;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @Column({ type: 'uuid', nullable: true, name: 'granted_by' })
  grantedBy?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'granted_by' })
  grantedByUser?: User;

  @CreateDateColumn({ name: 'granted_at' })
  grantedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
