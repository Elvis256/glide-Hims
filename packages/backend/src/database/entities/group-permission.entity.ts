import { Entity, Column, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn, Index } from 'typeorm';
import { PermissionGroup } from './permission-group.entity';
import { Permission } from './permission.entity';

@Entity('group_permissions')
@Index(['groupId', 'permissionId'], { unique: true })
export class GroupPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  @Index()
  tenantId?: string;

  @Column({ type: 'uuid', name: 'group_id' })
  groupId: string;

  @Column({ type: 'uuid', name: 'permission_id' })
  permissionId: string;

  @ManyToOne(() => PermissionGroup, (group) => group.groupPermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: PermissionGroup;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
