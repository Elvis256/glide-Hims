import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SaasPayment } from './saas.entity';

@Entity('saas_payment_proofs')
export class SaasPaymentProof {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) @Index() paymentId: string;
  @ManyToOne(() => SaasPayment, (p) => p.proofs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: SaasPayment;

  @Column({ type: 'varchar', length: 500 }) filePath: string;
  @Column({ type: 'varchar', length: 300 }) originalFilename: string;
  @Column({ type: 'varchar', length: 100 }) fileType: string;
  @Column({ type: 'integer' }) fileSize: number;

  @Column({ type: 'uuid' }) uploadedBy: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @CreateDateColumn() createdAt: Date;
}
