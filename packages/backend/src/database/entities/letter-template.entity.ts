import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum LetterTemplateType {
  OFFER = 'offer',
  CONTRACT = 'contract',
  PROMOTION = 'promotion',
  TERMINATION = 'termination',
  WARNING = 'warning',
  COMMENDATION = 'commendation',
  REFERENCE = 'reference',
  GENERIC = 'generic',
}

@Entity('hr_letter_templates')
export class LetterTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'enum', enum: LetterTemplateType, default: LetterTemplateType.GENERIC })
  type: LetterTemplateType;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  // Handlebars-compatible template body (e.g. {{employee.fullName}})
  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
