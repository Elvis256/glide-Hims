import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum LabelType {
  PRESCRIPTION = 'prescription',
  OTC = 'otc',
  CONTROLLED = 'controlled',
  EXTERNAL_USE = 'external_use',
}

@Entity('drug_label_templates')
@Index(['language', 'labelType', 'tenantId'])
@Index(['isDefault', 'tenantId'])
export class DrugLabelTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  language: string;

  @Column({
    type: 'enum',
    enum: LabelType,
    name: 'label_type',
    default: LabelType.PRESCRIPTION,
  })
  labelType: LabelType;

  @Column({ type: 'text', name: 'header_template' })
  headerTemplate: string;

  @Column({ type: 'text', name: 'body_template' })
  bodyTemplate: string;

  @Column({ type: 'text', name: 'footer_template' })
  footerTemplate: string;

  @Column({ type: 'boolean', name: 'is_default', default: false })
  isDefault: boolean;
}

@Entity('common_drug_translations')
@Index(['drugName', 'language', 'tenantId'])
export class CommonDrugTranslation extends BaseEntity {
  @Column({ type: 'varchar', length: 255, name: 'drug_name' })
  drugName: string;

  @Column({ type: 'varchar', length: 10 })
  language: string;

  @Column({ type: 'varchar', length: 255, name: 'translated_name' })
  translatedName: string;

  @Column({ type: 'text', nullable: true })
  directions: string;

  @Column({ type: 'text', nullable: true })
  warnings: string;
}
