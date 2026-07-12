import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { piiColumnTransformer } from '../../common/crypto/pii-crypto';

export type FingerIndex =
  | 'right_thumb'
  | 'right_index'
  | 'right_middle'
  | 'right_ring'
  | 'right_little'
  | 'left_thumb'
  | 'left_index'
  | 'left_middle'
  | 'left_ring'
  | 'left_little';

@Entity('biometric_data')
@Unique(['userId', 'fingerIndex'])
export class BiometricData extends BaseEntity {
  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'finger_index', type: 'varchar', length: 20 })
  fingerIndex: FingerIndex;

  // Encrypted at rest (AES-256-GCM via pii-crypto): unlike a password, a
  // leaked fingerprint template can never be rotated. The transformer
  // tolerates legacy plaintext rows; migration 72 re-encrypts them.
  @Column({ name: 'template_data', type: 'text', transformer: piiColumnTransformer })
  templateData: string; // Base64 encoded fingerprint template

  @Column({ name: 'quality_score', type: 'int', nullable: true })
  qualityScore?: number;

  @Column({ name: 'registered_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  registeredAt: Date;

  @Column({ name: 'last_verified_at', type: 'timestamp', nullable: true })
  lastVerifiedAt?: Date;
}
