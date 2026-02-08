import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

// Document categories visible to different departments
export enum DocumentCategory {
  // Clinical documents - visible to doctors, nurses
  CLINICAL = 'clinical',
  LAB_REPORT = 'lab_report',
  IMAGING = 'imaging',
  PRESCRIPTION = 'prescription',
  DISCHARGE_SUMMARY = 'discharge_summary',
  REFERRAL = 'referral',
  MEDICAL_HISTORY = 'medical_history',
  
  // Identification - visible to registration, all staff
  IDENTIFICATION = 'identification',
  INSURANCE_CARD = 'insurance_card',
  
  // Financial - visible to finance, cashiers, billing
  FINANCIAL = 'financial',
  RECEIPT = 'receipt',
  CLAIM = 'claim',
  PAYMENT_PROOF = 'payment_proof',
  
  // Administrative - visible to registration, admin
  CONSENT = 'consent',
  REGISTRATION_FORM = 'registration_form',
  
  // General - visible to all with patient access
  OTHER = 'other',
}

// Which departments can view each category
export const DocumentCategoryAccess: Record<DocumentCategory, string[]> = {
  [DocumentCategory.CLINICAL]: ['doctor', 'nurse', 'admin'],
  [DocumentCategory.LAB_REPORT]: ['doctor', 'nurse', 'lab_technician', 'admin'],
  [DocumentCategory.IMAGING]: ['doctor', 'nurse', 'radiologist', 'admin'],
  [DocumentCategory.PRESCRIPTION]: ['doctor', 'nurse', 'pharmacist', 'admin'],
  [DocumentCategory.DISCHARGE_SUMMARY]: ['doctor', 'nurse', 'admin'],
  [DocumentCategory.REFERRAL]: ['doctor', 'nurse', 'admin'],
  [DocumentCategory.MEDICAL_HISTORY]: ['doctor', 'nurse', 'admin'],
  [DocumentCategory.IDENTIFICATION]: ['receptionist', 'registration', 'cashier', 'finance', 'admin', 'doctor', 'nurse'],
  [DocumentCategory.INSURANCE_CARD]: ['receptionist', 'registration', 'cashier', 'finance', 'insurance', 'admin'],
  [DocumentCategory.FINANCIAL]: ['cashier', 'finance', 'accountant', 'admin'],
  [DocumentCategory.RECEIPT]: ['cashier', 'finance', 'accountant', 'admin'],
  [DocumentCategory.CLAIM]: ['finance', 'insurance', 'admin'],
  [DocumentCategory.PAYMENT_PROOF]: ['cashier', 'finance', 'accountant', 'admin'],
  [DocumentCategory.CONSENT]: ['receptionist', 'registration', 'doctor', 'nurse', 'admin'],
  [DocumentCategory.REGISTRATION_FORM]: ['receptionist', 'registration', 'admin'],
  [DocumentCategory.OTHER]: ['admin'],
};

@Entity('patient_documents')
export class PatientDocument extends BaseEntity {
  @Index('idx_patient_documents_patient_id')
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Index('idx_patient_documents_category')
  @Column({ name: 'category', type: 'varchar', length: 50 })
  category: DocumentCategory;

  @Column({ name: 'document_name', type: 'varchar', length: 255 })
  documentName: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column({ name: 'file_path', type: 'varchar', length: 500 })
  filePath: string;

  @Column({ name: 'file_type', type: 'varchar', length: 100, nullable: true })
  fileType: string;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number;

  @Column({ name: 'original_filename', type: 'varchar', length: 255, nullable: true })
  originalFilename: string;

  // For documents like lab reports, imaging - link to the source record
  @Column({ name: 'source_type', type: 'varchar', length: 50, nullable: true })
  sourceType: string; // 'lab_result', 'imaging_result', 'prescription', etc.

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId: string;

  // Metadata
  @Column({ name: 'document_date', type: 'date', nullable: true })
  documentDate: Date;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'tags', type: 'simple-array', nullable: true })
  tags: string[];

  // Audit
  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;

  @Column({ name: 'is_confidential', type: 'boolean', default: false })
  isConfidential: boolean;

  @Column({ name: 'access_count', type: 'int', default: 0 })
  accessCount: number;

  @Column({ name: 'last_accessed_at', type: 'timestamp', nullable: true })
  lastAccessedAt: Date;

  @Column({ name: 'last_accessed_by', type: 'uuid', nullable: true })
  lastAccessedBy: string;
}
