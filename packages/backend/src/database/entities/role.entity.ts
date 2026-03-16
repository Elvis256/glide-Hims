import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true, name: 'is_system_role' })
  isSystemRole: boolean;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'uuid', nullable: true, name: 'parent_role_id' })
  parentRoleId?: string;

  @ManyToOne(() => Role, (role) => role.childRoles, { nullable: true })
  @JoinColumn({ name: 'parent_role_id' })
  parentRole?: Role;

  @OneToMany(() => Role, (role) => role.parentRole)
  childRoles?: Role[];
}
