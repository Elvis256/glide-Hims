import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum DocumentType {
  NATIONAL_ID = 'national_id',
  ACADEMIC_CERTIFICATE = 'academic_certificate',
  PROFESSIONAL_LICENSE = 'professional_license',
  EMPLOYMENT_CONTRACT = 'employment_contract',
  MEDICAL_CERTIFICATE = 'medical_certificate',
  POLICE_CLEARANCE = 'police_clearance',
  REFERENCE_LETTER = 'reference_letter',
  PASSPORT = 'passport',
  VISA = 'visa',
  WORK_PERMIT = 'work_permit',
  OTHER = 'other',
}

export enum DocumentStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('staff_documents')
export class StaffDocument extends BaseEntity {
  @Index('idx_staff_documents_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('idx_staff_documents_document_type')
  @Column({ name: 'document_type', type: 'varchar', length: 50 })
  documentType: DocumentType;

  @Column({ name: 'document_name', type: 'varchar', length: 255 })
  documentName: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath: string;

  @Column({ name: 'file_type', type: 'varchar', length: 100, nullable: true })
  fileType: string;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number;

  @Column({ name: 'license_number', type: 'varchar', length: 100, nullable: true })
  licenseNumber: string;

  @Column({ name: 'issuing_authority', type: 'varchar', length: 255, nullable: true })
  issuingAuthority: string;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ name: 'status', type: 'varchar', length: 20, default: DocumentStatus.PENDING })
  status: DocumentStatus;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy: string;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date;
}
