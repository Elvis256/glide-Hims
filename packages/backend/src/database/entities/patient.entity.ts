import { Entity, Column, Index, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { piiColumnTransformer, hashPii } from '../../common/crypto/pii-crypto';

export enum PatientDebtStatus {
  NONE = 'none',
  CURRENT = 'current',
  OVERDUE_30 = 'overdue_30',
  OVERDUE_60 = 'overdue_60',
  OVERDUE_90 = 'overdue_90',
  COLLECTIONS = 'collections',
}

@Entity('patients')
@Index(['mrn'], { unique: true, where: 'deleted_at IS NULL' })
// Uniqueness on national ID is enforced via the blind-index hash column because
// the plaintext column now stores random AES-GCM ciphertext.
@Index(['nationalIdHash'], {
  unique: true,
  where: 'national_id_hash IS NOT NULL AND deleted_at IS NULL',
})
@Index(['userId'])
@Index(['fullName'])
@Index(['dateOfBirth'])
@Index(['phoneHash'])
@Index(['emailHash'])
@Index(['fullName', 'dateOfBirth'])
export class Patient extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  mrn: string; // Medical Record Number

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Encrypted at rest (AES-256-GCM). Searchable via nationalIdHash.
  @Column({ type: 'text', nullable: true, name: 'national_id', transformer: piiColumnTransformer })
  nationalId?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'national_id_hash' })
  nationalIdHash?: string;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 20 })
  gender: string;

  @Column({ type: 'date', name: 'date_of_birth' })
  dateOfBirth: Date;

  // Encrypted at rest. Searchable via phoneHash (digits-only normalization).
  @Column({ type: 'text', nullable: true, transformer: piiColumnTransformer })
  phone?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'phone_hash' })
  phoneHash?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  // Encrypted at rest. Searchable via emailHash (lowercase normalization).
  @Column({ type: 'text', nullable: true, transformer: piiColumnTransformer })
  email?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'email_hash' })
  emailHash?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'blood_group' })
  bloodGroup?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'next_of_kin' })
  nextOfKin?: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  // --- New fields ---

  @Column({ type: 'jsonb', nullable: true })
  allergies?: string[];

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'marital_status' })
  maritalStatus?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  occupation?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  language?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'photograph_url' })
  photographUrl?: string;

  // ─── Communication preferences ────────────────────────────────────────────
  // When true, the patient has opted out of marketing/reminder SMS/WhatsApp.
  // Transactional messages (OTPs, critical results) may still be sent.
  @Column({ type: 'boolean', default: false, name: 'sms_opt_out' })
  smsOptOut: boolean;

  @Column({ type: 'boolean', default: false, name: 'whatsapp_opt_out' })
  whatsappOptOut: boolean;

  @Column({ type: 'boolean', default: false, name: 'email_opt_out' })
  emailOptOut: boolean;

  // ─── Debt tracking ──────────────────────────────────────────────────────
  @Column({
    type: 'enum',
    enum: ['none', 'current', 'overdue_30', 'overdue_60', 'overdue_90', 'collections'],
    default: 'none',
    name: 'debt_status',
  })
  debtStatus: PatientDebtStatus;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'total_outstanding_balance' })
  totalOutstandingBalance: number;

  @Column({ type: 'boolean', default: false, name: 'blocks_new_visits' })
  blocksNewVisits: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'debt_last_calculated_at' })
  debtLastCalculatedAt: Date | null;

  /**
   * Keep blind-index hash columns in sync with their plaintext sources on every
   * insert/update. Runs against the in-memory plaintext BEFORE the column
   * transformer encrypts the value on write.
   */
  @BeforeInsert()
  @BeforeUpdate()
  syncPiiHashes() {
    this.nationalIdHash = this.nationalId ? hashPii(this.nationalId, 'generic') : undefined;
    this.phoneHash = this.phone ? hashPii(this.phone, 'phone') : undefined;
    this.emailHash = this.email ? hashPii(this.email, 'email') : undefined;
  }
}
