import { Entity, Column } from 'typeorm';
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
}
