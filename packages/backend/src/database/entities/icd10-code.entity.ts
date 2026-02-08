import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
} from 'typeorm';

@Entity('icd10_codes')
@Index(['code'], { unique: true })
@Index(['description'])
@Index(['category'])
export class ICD10Code {
  @PrimaryColumn({ length: 10 })
  code: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'category_description', nullable: true })
  categoryDescription: string;

  @Column({ nullable: true })
  chapter: string;

  @Column({ name: 'chapter_description', nullable: true })
  chapterDescription: string;

  @Column({ name: 'is_billable', default: true })
  isBillable: boolean;

  @Column({ name: 'search_terms', type: 'text', nullable: true })
  searchTerms: string; // Additional keywords for better search

  @Column({ name: 'use_count', default: 0 })
  useCount: number; // Track popularity for sorting

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt: Date;

  @Column({ name: 'source', default: 'who_api' })
  source: string; // 'who_api', 'manual', 'seed'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
