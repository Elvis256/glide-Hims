import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import { Role } from './role.entity';
import { PermissionGroup } from './permission-group.entity';

@Entity('role_permission_groups')
@Index(['roleId', 'groupId'], { unique: true })
export class RolePermissionGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  @Index()
  tenantId?: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId: string;

  @Column({ type: 'uuid', name: 'group_id' })
  groupId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => PermissionGroup, (group) => group.rolePermissionGroups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: PermissionGroup;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
