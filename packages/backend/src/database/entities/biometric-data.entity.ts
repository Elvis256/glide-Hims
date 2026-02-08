import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export type FingerIndex = 
  | 'right_thumb' | 'right_index' | 'right_middle' | 'right_ring' | 'right_little'
  | 'left_thumb' | 'left_index' | 'left_middle' | 'left_ring' | 'left_little';

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

  @Column({ name: 'template_data', type: 'text' })
  templateData: string; // Base64 encoded fingerprint template

  @Column({ name: 'quality_score', type: 'int', nullable: true })
  qualityScore?: number;

  @Column({ name: 'registered_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  registeredAt: Date;

  @Column({ name: 'last_verified_at', type: 'timestamp', nullable: true })
  lastVerifiedAt?: Date;
}
