import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, EntityManager, ILike } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import {
  PatientDocument,
  DocumentCategory,
  DocumentCategoryAccess,
} from '../../database/entities/patient-document.entity';
import { PatientNote, NoteType } from '../../database/entities/patient-note.entity';
import { PatientMerge } from '../../database/entities/patient-merge.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { ConsentType } from '../../database/entities/patient-consent.entity';
import { CreatePatientDto, UpdatePatientDto, PatientSearchDto } from './dto/patient.dto';
import { hashPii } from '../../common/crypto/pii-crypto';
import { checkDuplicates, DuplicateMatch } from './duplicate-detector.util';
import { PatientConsentService } from './patient-consent.service';

export interface UploadDocumentDto {
  category: DocumentCategory;
  description?: string;
  documentDate?: string;
  notes?: string;
  tags?: string[];
}

export interface CreateNoteDto {
  type: NoteType;
  content: string;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: Array<{
    id: string;
    mrn: string;
    fullName: string;
    gender: string;
    confidenceScore: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    matchReasons: string[];
    lastVisit?: string;
  }>;
}

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(PatientDocument)
    private documentRepository: Repository<PatientDocument>,
    @InjectRepository(PatientNote)
    private noteRepository: Repository<PatientNote>,
    @InjectRepository(PatientMerge)
    private mergeRepository: Repository<PatientMerge>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    private dataSource: DataSource,
    @Optional() private patientConsentService?: PatientConsentService,
  ) {}

  private async generateMRN(manager: EntityManager, tenantId?: string): Promise<string> {
    // Get hospital name from system settings
    const hospitalNameSetting = await manager.getRepository(SystemSetting).findOne({
      where: { key: 'hospital_name' },
    });

    const hospitalName = hospitalNameSetting?.value?.name || 'HOSP';

    // Extract initials or first 4 characters of hospital name
    const prefix = this.getHospitalPrefix(hospitalName);

    // Get current date in YYYYMMDD format
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const lockKey = `mrn_gen_${dateStr}_${tenantId || 'global'}`;

    // Use advisory lock to prevent concurrent generation collisions
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

    for (let attempt = 0; attempt < 10; attempt++) {
      // Generate random 4-digit number
      const random = Math.floor(1000 + Math.random() * 9000);

      // Format: {PREFIX}{DATE}{RANDOM} e.g., HOSP202602164523
      const mrn = `${prefix}${dateStr}${random}`;

      // Check if MRN already exists
      const whereCondition: any = { mrn };
      if (tenantId) whereCondition.tenantId = tenantId;
      const existing = await manager.getRepository(Patient).findOne({ where: whereCondition });
      if (!existing) return mrn;
    }

    throw new BadRequestException('Failed to generate unique MRN after 10 attempts');
  }

  /**
   * Extract hospital prefix from hospital name
   * - If <= 4 chars, use as-is
   * - If multiple words, use initials (max 4)
   * - Otherwise, use first 4 characters
   */
  private getHospitalPrefix(hospitalName: string): string {
    const name = hospitalName.toUpperCase().trim();

    if (name.length <= 4) {
      return name;
    }

    // If multiple words, extract initials
    const words = name.split(/\s+/).filter((w) => w.length > 0);
    if (words.length > 1) {
      const initials = words
        .map((w) => w[0])
        .slice(0, 4)
        .join('');
      return initials;
    }

    // Single long word - take first 4 characters
    return name.substring(0, 4);
  }

  async create(dto: CreatePatientDto, userId?: string, tenantId?: string): Promise<Patient> {
    const savedPatient = await this.dataSource.transaction(async (manager) => {
      // 1. Generate unique MRN (includes advisory lock)
      const mrn = await this.generateMRN(manager, tenantId);

      // 2. Check national ID uniqueness with lock inside transaction
      if (dto.nationalId) {
        const whereCondition: any = { nationalIdHash: hashPii(dto.nationalId, 'generic') };
        if (tenantId) whereCondition.tenantId = tenantId;
        const existing = await manager.findOne(Patient, {
          where: whereCondition,
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) {
          throw new ConflictException('Patient with this national ID already exists');
        }
      }

      // 3. Re-check duplicates server-side BEFORE save. The frontend already
      // does this on the Register button via /patients/check-duplicates, but
      // an API client (Swagger / curl / mobile) can bypass that. We block
      // creation only on a high-confidence match — receptionists can still
      // create a "John Smith" if the existing one is a low-confidence match
      // (different DOB, different phone). Override is via explicit
      // `forceCreate: true` in the DTO (audit-logged below).
      const dupResult = await this.checkDuplicates(dto, tenantId);
      const hasHighConfidence = dupResult.duplicates.some((d) => d.confidenceLevel === 'high');
      if (hasHighConfidence && !(dto as any).forceCreate) {
        throw new ConflictException({
          message:
            'Possible duplicate patient detected. Confirm via /patients/check-duplicates and resubmit with forceCreate=true if this is genuinely a different person.',
          duplicates: dupResult.duplicates
            .filter((d) => d.confidenceLevel === 'high')
            .slice(0, 3)
            .map((d) => ({
              id: d.id,
              mrn: d.mrn,
              fullName: d.fullName,
              confidenceLevel: d.confidenceLevel,
              matchReasons: d.matchReasons,
            })),
        });
      }

      // 4. Create and save patient
      const patient = manager.create(Patient, {
        ...dto,
        mrn,
        status: 'active',
        tenantId: tenantId || undefined,
      });

      return manager.save(Patient, patient);
    });

    // Log audit trail (outside transaction — non-critical)
    if (userId) {
      try {
        await this.auditLogRepository.save({
          userId,
          action: 'PATIENT_CREATED',
          entityType: 'Patient',
          entityId: savedPatient.id,
          newValue: {
            mrn: savedPatient.mrn,
            patientId: savedPatient.id,
            hasNationalId: !!savedPatient.nationalId,
            hasPhone: !!savedPatient.phone,
          },
        });
      } catch (auditError) {
        this.logger.warn(
          `Failed to log audit trail for patient ${savedPatient.id}: ${auditError.message}`,
        );
      }
    }

    // Record consents if provided at registration
    if (this.patientConsentService && (dto as any).consents?.length) {
      for (const c of (dto as any).consents) {
        try {
          await this.patientConsentService.recordConsent({
            patientId: savedPatient.id,
            consentType: c.consentType,
            version: c.version,
            accepted: c.accepted,
            recordedById: userId,
            tenantId,
          });
        } catch (err) {
          this.logger.warn(`Failed to record consent ${c.consentType} for ${savedPatient.id}: ${err.message}`);
        }
      }
    } else if (!(dto as any).skipConsentValidation) {
      this.logger.warn(
        `Patient ${savedPatient.id} registered without data_processing consent`,
      );
    }

    return savedPatient;
  }

  async findAll(query: PatientSearchDto, tenantId?: string, facilityId?: string) {
    const { page = 1, limit = 20, search, mrn, nationalId, phone } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.patientRepository.createQueryBuilder('patient');

    // createQueryBuilder bypasses TypeORM's soft-delete auto-filter, so
    // soft-removed patients would otherwise show up in receptionist search.
    queryBuilder.where('patient.deletedAt IS NULL');

    if (tenantId) {
      queryBuilder.andWhere('patient.tenantId = :tenantId', { tenantId });
    }

    // Facility filter: prefer patients with encounters at this facility, but don't exclude new patients
    // New patients (no encounters yet) must still be searchable for OPD token issuance
    if (facilityId && search) {
      // When searching, show all tenant patients — facility scoping happens at encounter level
    } else if (facilityId && !search && !mrn && !nationalId && !phone) {
      // Browsing without search: show patients with encounters at this facility + recently registered
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      queryBuilder.andWhere(
        `(patient.id IN (SELECT e.patient_id FROM encounters e WHERE e.facility_id = :facilityId AND e.deleted_at IS NULL) OR patient.createdAt >= :recentDate)`,
        { facilityId, recentDate: sevenDaysAgo },
      );
    }

    if (search) {
      // Phone is encrypted, so substring ILIKE no longer works against ciphertext.
      // Match on the deterministic phone hash instead (exact normalized number).
      queryBuilder.andWhere(
        '(patient.fullName ILIKE :search OR patient.mrn ILIKE :search OR patient.phoneHash = :searchPhoneHash)',
        { search: `%${search}%`, searchPhoneHash: hashPii(search, 'phone') },
      );
    }

    if (mrn) {
      queryBuilder.andWhere('patient.mrn = :mrn', { mrn });
    }

    if (nationalId) {
      queryBuilder.andWhere('patient.nationalIdHash = :nationalIdHash', {
        nationalIdHash: hashPii(nationalId, 'generic'),
      });
    }

    if (phone) {
      queryBuilder.andWhere('patient.phoneHash = :phoneHash', {
        phoneHash: hashPii(phone, 'phone'),
      });
    }

    const [patients, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('patient.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: patients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId?: string): Promise<Patient> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const patient = await this.patientRepository.findOne({ where });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async findByMRN(mrn: string, tenantId?: string): Promise<Patient> {
    const where: any = { mrn };
    if (tenantId) where.tenantId = tenantId;
    const patient = await this.patientRepository.findOne({ where });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, tenantId?: string): Promise<Patient> {
    const patient = await this.findOne(id, tenantId);

    // Check for duplicate national ID if updating
    if (dto.nationalId && dto.nationalId !== patient.nationalId) {
      const existing = await this.patientRepository.findOne({
        where: {
          nationalIdHash: hashPii(dto.nationalId, 'generic'),
          ...(tenantId ? { tenantId } : {}),
        },
      });
      if (existing) {
        throw new ConflictException('Patient with this National ID already exists');
      }
    }

    Object.assign(patient, dto);
    return this.patientRepository.save(patient);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const patient = await this.findOne(id, tenantId);
    await this.patientRepository.softRemove(patient);
  }

  async checkDuplicates(dto: CreatePatientDto, tenantId?: string): Promise<DuplicateCheckResult> {
    // Get all potential candidates for duplicate checking
    // We cast a wide net and let the utility narrow it down with confidence scoring
    const candidates: Patient[] = [];

    // 1. Check by national ID (if provided)
    if (dto.nationalId) {
      const byNationalId = await this.patientRepository.find({
        where: {
          nationalIdHash: hashPii(dto.nationalId, 'generic'),
          ...(tenantId ? { tenantId } : {}),
        },
      });
      candidates.push(...byNationalId);
    }

    // 2. Check by exact date of birth (broader search)
    const byDobQb = this.patientRepository
      .createQueryBuilder('patient')
      .where('DATE(patient.dateOfBirth) = DATE(:dob)', {
        dob: new Date(dto.dateOfBirth).toISOString().split('T')[0],
      });
    if (tenantId) byDobQb.andWhere('patient.tenantId = :tenantId', { tenantId });
    const byDob = await byDobQb.getMany();
    candidates.push(...byDob);

    // 3. Check by similar name using ILIKE as fallback
    // Try pg_trgm similarity first, fall back to ILIKE if extension not available
    try {
      const byNameQb = this.patientRepository
        .createQueryBuilder('patient')
        .where('SIMILARITY(patient.fullName, :name) > 0.3', { name: dto.fullName });
      if (tenantId) byNameQb.andWhere('patient.tenantId = :tenantId', { tenantId });
      const byName = await byNameQb.getMany();
      candidates.push(...byName);
    } catch (error) {
      // Fallback to ILIKE if pg_trgm not available
      const byNameFallbackQb = this.patientRepository
        .createQueryBuilder('patient')
        .where('patient.fullName ILIKE :name', { name: `%${dto.fullName}%` });
      if (tenantId) byNameFallbackQb.andWhere('patient.tenantId = :tenantId', { tenantId });
      const byNameFallback = await byNameFallbackQb.getMany();
      candidates.push(...byNameFallback);
    }

    // Remove duplicates from candidates array
    const uniqueCandidates = [...new Map(candidates.map((p) => [p.id, p])).values()];

    // Use the duplicate detector utility to calculate confidence scores
    const matches = checkDuplicates(
      {
        fullName: dto.fullName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        nationalId: dto.nationalId,
        phone: dto.phone,
      },
      uniqueCandidates.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        dateOfBirth: new Date(p.dateOfBirth),
        gender: p.gender,
        nationalId: p.nationalId,
        phone: p.phone,
      })),
    );

    // Get last visit dates for matched patients
    const duplicatesWithDetails = await Promise.all(
      matches.map(async (match) => {
        const patient = uniqueCandidates.find((p) => p.id === match.patientId);
        if (!patient) return null;

        return {
          id: patient.id,
          mrn: patient.mrn,
          fullName: patient.fullName,
          gender: patient.gender,
          confidenceScore: match.confidenceScore,
          confidenceLevel: match.confidenceLevel,
          matchReasons: match.matchReasons,
          lastVisit: patient.createdAt.toISOString(),
        };
      }),
    );

    const validDuplicates = duplicatesWithDetails.filter((d) => d !== null);

    return {
      hasDuplicates: validDuplicates.length > 0,
      duplicates: validDuplicates,
    };
  }

  // ==================== DOCUMENT METHODS ====================

  // Get categories accessible to a user based on their role
  getAccessibleCategories(userRoles: string[]): DocumentCategory[] {
    const categories: DocumentCategory[] = [];
    const normalizedRoles = userRoles.map((r) => r.toLowerCase().replace(/\s+/g, '_'));

    for (const [category, allowedRoles] of Object.entries(DocumentCategoryAccess)) {
      // Admin can see everything
      if (normalizedRoles.includes('admin') || normalizedRoles.includes('super_admin')) {
        categories.push(category as DocumentCategory);
        continue;
      }
      // Check if user has any of the allowed roles
      if (
        allowedRoles.some((role) =>
          normalizedRoles.some((userRole) => userRole.includes(role) || role.includes(userRole)),
        )
      ) {
        categories.push(category as DocumentCategory);
      }
    }
    return [...new Set(categories)]; // Remove duplicates
  }

  async uploadDocument(
    patientId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    uploadedBy: string,

    tenantId?: string,
  ): Promise<PatientDocument> {
    // Verify patient exists (scoped by tenant)
    await this.findOne(patientId, tenantId);

    const document = this.documentRepository.create({
      patientId,
      category: dto.category,
      documentName: file.originalname,
      description: dto.description,
      filePath: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
      originalFilename: file.originalname,
      documentDate: dto.documentDate ? new Date(dto.documentDate) : new Date(),
      notes: dto.notes,
      tags: dto.tags,
      uploadedBy,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.documentRepository.save(document);
  }

  async getDocuments(
    patientId: string,
    userRoles: string[],
    category?: DocumentCategory,

    tenantId?: string,
  ): Promise<PatientDocument[]> {
    // Get accessible categories for this user
    const accessibleCategories = this.getAccessibleCategories(userRoles);

    if (accessibleCategories.length === 0) {
      return [];
    }

    const queryBuilder = this.documentRepository
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.uploader', 'uploader')
      .where('doc.patientId = :patientId', { patientId })
      .andWhere('doc.category IN (:...categories)', {
        categories: category ? [category] : accessibleCategories,
      });
    if (tenantId) queryBuilder.andWhere('doc.tenant_id = :tenantId', { tenantId });

    // If a specific category was requested, verify user has access
    if (category && !accessibleCategories.includes(category)) {
      throw new ForbiddenException(`You don't have access to ${category} documents`);
    }

    return queryBuilder.orderBy('doc.createdAt', 'DESC').getMany();
  }

  async getDocument(
    documentId: string,
    userRoles: string[],
    tenantId?: string,
  ): Promise<PatientDocument> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ...(tenantId ? { tenantId } : {}) },
      relations: ['uploader'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check access
    const accessibleCategories = this.getAccessibleCategories(userRoles);
    if (!accessibleCategories.includes(document.category)) {
      throw new ForbiddenException("You don't have access to this document");
    }

    // Update access tracking
    document.accessCount += 1;
    document.lastAccessedAt = new Date();
    await this.documentRepository.save(document);

    return document;
  }

  async deleteDocument(
    documentId: string,
    userId: string,
    userRoles: string[],
    tenantId?: string,
  ): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, ...(tenantId ? { tenantId } : {}) },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check if user can delete (uploader or admin)
    const normalizedRoles = userRoles.map((r) => r.toLowerCase());
    const isAdmin = normalizedRoles.some((r) => r.includes('admin'));

    if (document.uploadedBy !== userId && !isAdmin) {
      throw new ForbiddenException('Only the uploader or admin can delete this document');
    }

    await this.documentRepository.softRemove(document);
  }

  async getDocumentStats(patientId: string, userRoles: string[], tenantId?: string) {
    const accessibleCategories = this.getAccessibleCategories(userRoles);

    const statsQb = this.documentRepository
      .createQueryBuilder('doc')
      .select('doc.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('doc.patientId = :patientId', { patientId })
      .andWhere('doc.category IN (:...categories)', { categories: accessibleCategories });
    if (tenantId) statsQb.andWhere('doc.tenant_id = :tenantId', { tenantId });
    const stats = await statsQb.groupBy('doc.category').getRawMany();

    return stats;
  }

  // ==================== NOTES METHODS ====================

  async createNote(
    patientId: string,
    dto: CreateNoteDto,
    userId: string,
    tenantId?: string,
  ): Promise<PatientNote> {
    // Verify patient exists (scoped by tenant)
    await this.findOne(patientId, tenantId);

    const note = this.noteRepository.create({
      patientId,
      type: dto.type,
      content: dto.content,
      createdById: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.noteRepository.save(note);
  }

  async getNotes(patientId: string, tenantId?: string): Promise<PatientNote[]> {
    return this.noteRepository.find({
      where: { patientId, ...(tenantId ? { tenantId } : {}) },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getNote(noteId: string, tenantId?: string): Promise<PatientNote> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId, ...(tenantId ? { tenantId } : {}) },
      relations: ['createdBy'],
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return note;
  }

  async deleteNote(
    noteId: string,
    userId: string,
    userRoles: string[],
    tenantId?: string,
  ): Promise<void> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId, ...(tenantId ? { tenantId } : {}) },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Check if user can delete (creator or admin)
    const normalizedRoles = userRoles.map((r) => r.toLowerCase());
    const isAdmin = normalizedRoles.some((r) => r.includes('admin'));

    if (note.createdById !== userId && !isAdmin) {
      throw new ForbiddenException('Only the note creator or admin can delete this note');
    }

    await this.noteRepository.softRemove(note);
  }

  // ==================== PATIENT MERGE METHODS ====================

  async mergePatients(
    primaryId: string,
    secondaryId: string,
    mergedById: string,
    reason?: string,
    tenantId?: string,
  ): Promise<PatientMerge> {
    if (primaryId === secondaryId) {
      throw new BadRequestException('Cannot merge a patient with themselves');
    }

    const primary = await this.findOne(primaryId, tenantId);
    const secondary = await this.findOne(secondaryId, tenantId);

    return this.dataSource.transaction(async (manager) => {
      // Snapshot the secondary patient before merge
      const secondarySnapshot = { ...secondary };

      // Move encounters from secondary to primary
      const encounterResult = await manager
        .createQueryBuilder()
        .update('encounters')
        .set({ patientId: primaryId })
        .where('patient_id = :secondaryId', { secondaryId })
        .execute();

      // Move documents from secondary to primary
      const docResult = await manager
        .createQueryBuilder()
        .update('patient_documents')
        .set({ patientId: primaryId })
        .where('patient_id = :secondaryId', { secondaryId })
        .execute();

      // Move notes from secondary to primary
      const noteResult = await manager
        .createQueryBuilder()
        .update('patient_notes')
        .set({ patientId: primaryId })
        .where('patient_id = :secondaryId', { secondaryId })
        .execute();

      // Merge allergies (union)
      const primaryAllergies = primary.allergies || [];
      const secondaryAllergies = secondary.allergies || [];
      const mergedAllergies = [...new Set([...primaryAllergies, ...secondaryAllergies])];
      if (mergedAllergies.length > 0) {
        primary.allergies = mergedAllergies;
      }

      // Fill in missing fields from secondary
      if (!primary.phone && secondary.phone) primary.phone = secondary.phone;
      if (!primary.email && secondary.email) primary.email = secondary.email;
      if (!primary.address && secondary.address) primary.address = secondary.address;
      if (!primary.nationalId && secondary.nationalId) primary.nationalId = secondary.nationalId;
      if (!primary.bloodGroup && secondary.bloodGroup) primary.bloodGroup = secondary.bloodGroup;
      if (!primary.occupation && secondary.occupation) primary.occupation = secondary.occupation;
      if (!primary.language && secondary.language) primary.language = secondary.language;
      if (!primary.photographUrl && secondary.photographUrl)
        primary.photographUrl = secondary.photographUrl;

      await manager.save(Patient, primary);

      // Soft-delete the secondary patient
      secondary.status = 'merged';
      await manager.save(Patient, secondary);
      await manager.softRemove(Patient, secondary);

      // Record the merge
      const merge = manager.create(PatientMerge, {
        primaryPatientId: primaryId,
        secondaryPatientId: secondaryId,
        mergedById,
        secondaryPatientSnapshot: secondarySnapshot,
        mergedDataSummary: {
          encountersMoved: encounterResult.affected || 0,
          documentsMoved: docResult.affected || 0,
          notesMoved: noteResult.affected || 0,
        },
        reason,
        ...(tenantId ? { tenantId } : {}),
      });

      const savedMerge = await manager.save(PatientMerge, merge);

      this.logger.log(
        `Patient merge: ${secondary.mrn} → ${primary.mrn} by user ${mergedById}. ` +
          `Moved: ${encounterResult.affected} encounters, ${docResult.affected} docs, ${noteResult.affected} notes`,
      );

      return savedMerge;
    });
  }

  async getMergeHistory(tenantId?: string): Promise<PatientMerge[]> {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    return this.mergeRepository.find({
      where,
      relations: ['primaryPatient', 'secondaryPatient', 'mergedBy'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  // ==================== USER LINKING METHODS ====================

  /**
   * Link a user account to a patient record
   */
  async linkUser(patientId: string, userId: string, tenantId?: string): Promise<Patient> {
    const patient = await this.findOne(patientId, tenantId);

    // Check if patient already has a linked user
    if (patient.userId) {
      throw new ConflictException('Patient already has a linked user account');
    }

    // Verify user exists
    const userExists = await this.dataSource.query('SELECT id FROM users WHERE id = $1', [userId]);

    if (userExists.length === 0) {
      throw new NotFoundException('User not found');
    }

    // Update patient with user ID
    patient.userId = userId;
    return this.patientRepository.save(patient);
  }

  /**
   * Unlink user account from patient
   */
  async unlinkUser(patientId: string, tenantId?: string): Promise<Patient> {
    const patient = await this.findOne(patientId, tenantId);

    if (!patient.userId) {
      throw new NotFoundException('Patient does not have a linked user account');
    }

    patient.userId = undefined;
    return this.patientRepository.save(patient);
  }

  /**
   * Get linked user information for a patient
   */
  async getLinkedUser(
    patientId: string,
    tenantId?: string,
  ): Promise<{
    linked: boolean;
    user?: {
      id: string;
      username: string;
      fullName: string;
      email?: string;
      phone?: string;
    };
  }> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId, ...(tenantId ? { tenantId } : {}) },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (!patient.userId || !patient.user) {
      return { linked: false };
    }

    return {
      linked: true,
      user: {
        id: patient.user.id,
        username: patient.user.username,
        fullName: patient.user.fullName,
        email: patient.user.email,
        phone: patient.user.phone,
      },
    };
  }
}
