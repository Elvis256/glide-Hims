import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { GroupPermission } from './group-permission.entity';
import { RolePermissionGroup } from './role-permission-group.entity';

@Entity('permission_groups')
export class PermissionGroup extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => GroupPermission, (gp) => gp.group)
  groupPermissions?: GroupPermission[];

  @OneToMany(() => RolePermissionGroup, (rpg) => rpg.group)
  rolePermissionGroups?: RolePermissionGroup[];
}
