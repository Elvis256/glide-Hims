import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { PatientDocument, DocumentCategory, DocumentCategoryAccess } from '../../database/entities/patient-document.entity';
import { PatientNote, NoteType } from '../../database/entities/patient-note.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { CreatePatientDto, UpdatePatientDto, PatientSearchDto } from './dto/patient.dto';
import { checkDuplicates, DuplicateMatch } from './duplicate-detector.util';

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
    dateOfBirth: string;
    phone?: string;
    nationalId?: string;
    gender: string;
    confidenceScore: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    matchReasons: string[];
    lastVisit?: string;
  }>;
}

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(PatientDocument)
    private documentRepository: Repository<PatientDocument>,
    @InjectRepository(PatientNote)
    private noteRepository: Repository<PatientNote>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    private dataSource: DataSource,
  ) {}

  private async generateMRN(): Promise<string> {
    // Get hospital name from system settings
    const hospitalNameSetting = await this.systemSettingRepository.findOne({
      where: { key: 'hospital_name' },
    });
    
    const hospitalName = hospitalNameSetting?.value?.name || 'HOSP';
    
    // Extract initials or first 4 characters of hospital name
    const prefix = this.getHospitalPrefix(hospitalName);
    
    // Get current date in YYYYMMDD format
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    // Generate random 4-digit number
    const random = Math.floor(1000 + Math.random() * 9000);
    
    // Format: {PREFIX}{DATE}{RANDOM} e.g., HOSP202602164523
    const mrn = `${prefix}${dateStr}${random}`;
    
    // Check if MRN already exists (very unlikely but handle it)
    const existing = await this.patientRepository.findOne({ where: { mrn } });
    if (existing) {
      // Recursively try again with a new random number
      return this.generateMRN();
    }
    
    return mrn;
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
    const words = name.split(/\s+/).filter(w => w.length > 0);
    if (words.length > 1) {
      const initials = words
        .map(w => w[0])
        .slice(0, 4)
        .join('');
      return initials;
    }
    
    // Single long word - take first 4 characters
    return name.substring(0, 4);
  }

  async create(dto: CreatePatientDto, userId?: string): Promise<Patient> {
    // Check for duplicate national ID
    if (dto.nationalId) {
      const existing = await this.patientRepository.findOne({
        where: { nationalId: dto.nationalId },
      });
      if (existing) {
        throw new ConflictException('Patient with this National ID already exists');
      }
    }

    // Retry logic for MRN generation in case of race conditions
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mrn = await this.generateMRN();
        const patient = this.patientRepository.create({
          ...dto,
          mrn,
          status: 'active',
        });

        const savedPatient = await this.patientRepository.save(patient);

        // Log audit trail
        if (userId) {
          await this.auditLogRepository.save({
            userId,
            action: 'PATIENT_CREATED',
            entityType: 'Patient',
            entityId: savedPatient.id,
            newValue: {
              mrn: savedPatient.mrn,
              fullName: savedPatient.fullName,
              dateOfBirth: savedPatient.dateOfBirth,
              nationalId: savedPatient.nationalId,
              phone: savedPatient.phone,
            },
          });
        }

        return savedPatient;
      } catch (error: any) {
        // Check if it's a unique constraint violation on MRN
        if (error.code === '23505' && error.detail?.includes('mrn') && attempt < maxRetries) {
          // Retry with a new MRN
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Unable to generate unique MRN. Please try again.');
  }

  async findAll(query: PatientSearchDto) {
    const { page = 1, limit = 20, search, mrn, nationalId, phone } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.patientRepository.createQueryBuilder('patient');

    if (search) {
      queryBuilder.where(
        '(patient.fullName ILIKE :search OR patient.mrn ILIKE :search OR patient.phone ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (mrn) {
      queryBuilder.andWhere('patient.mrn = :mrn', { mrn });
    }

    if (nationalId) {
      queryBuilder.andWhere('patient.nationalId = :nationalId', { nationalId });
    }

    if (phone) {
      queryBuilder.andWhere('patient.phone ILIKE :phone', { phone: `%${phone}%` });
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

  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async findByMRN(mrn: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { mrn } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findOne(id);

    // Check for duplicate national ID if updating
    if (dto.nationalId && dto.nationalId !== patient.nationalId) {
      const existing = await this.patientRepository.findOne({
        where: { nationalId: dto.nationalId },
      });
      if (existing) {
        throw new ConflictException('Patient with this National ID already exists');
      }
    }

    Object.assign(patient, dto);
    return this.patientRepository.save(patient);
  }

  async remove(id: string): Promise<void> {
    const patient = await this.findOne(id);
    await this.patientRepository.softRemove(patient);
  }

  async checkDuplicates(dto: CreatePatientDto): Promise<DuplicateCheckResult> {
    // Get all potential candidates for duplicate checking
    // We cast a wide net and let the utility narrow it down with confidence scoring
    const candidates: Patient[] = [];

    // 1. Check by national ID (if provided)
    if (dto.nationalId) {
      const byNationalId = await this.patientRepository.find({
        where: { nationalId: dto.nationalId },
      });
      candidates.push(...byNationalId);
    }

    // 2. Check by exact date of birth (broader search)
    const byDob = await this.patientRepository
      .createQueryBuilder('patient')
      .where('DATE(patient.dateOfBirth) = DATE(:dob)', { 
        dob: new Date(dto.dateOfBirth).toISOString().split('T')[0] 
      })
      .getMany();
    candidates.push(...byDob);

    // 3. Check by similar name using ILIKE as fallback
    // Try pg_trgm similarity first, fall back to ILIKE if extension not available
    try {
      const byName = await this.patientRepository
        .createQueryBuilder('patient')
        .where('SIMILARITY(patient.fullName, :name) > 0.3', { name: dto.fullName })
        .getMany();
      candidates.push(...byName);
    } catch (error) {
      // Fallback to ILIKE if pg_trgm not available
      const byNameFallback = await this.patientRepository
        .createQueryBuilder('patient')
        .where('patient.fullName ILIKE :name', { name: `%${dto.fullName}%` })
        .getMany();
      candidates.push(...byNameFallback);
    }

    // Remove duplicates from candidates array
    const uniqueCandidates = [...new Map(candidates.map(p => [p.id, p])).values()];

    // Use the duplicate detector utility to calculate confidence scores
    const matches = checkDuplicates(
      {
        fullName: dto.fullName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        nationalId: dto.nationalId,
        phone: dto.phone,
      },
      uniqueCandidates.map(p => ({
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
        const patient = uniqueCandidates.find(p => p.id === match.patientId);
        if (!patient) return null;

        return {
          id: patient.id,
          mrn: patient.mrn,
          fullName: patient.fullName,
          dateOfBirth: patient.dateOfBirth.toISOString().split('T')[0],
          phone: patient.phone,
          nationalId: patient.nationalId,
          gender: patient.gender,
          confidenceScore: match.confidenceScore,
          confidenceLevel: match.confidenceLevel,
          matchReasons: match.matchReasons,
          lastVisit: patient.createdAt.toISOString(),
        };
      }),
    );

    const validDuplicates = duplicatesWithDetails.filter(d => d !== null);

    return {
      hasDuplicates: validDuplicates.length > 0,
      duplicates: validDuplicates,
    };
  }

  // ==================== DOCUMENT METHODS ====================

  // Get categories accessible to a user based on their role
  getAccessibleCategories(userRoles: string[]): DocumentCategory[] {
    const categories: DocumentCategory[] = [];
    const normalizedRoles = userRoles.map(r => r.toLowerCase().replace(/\s+/g, '_'));
    
    for (const [category, allowedRoles] of Object.entries(DocumentCategoryAccess)) {
      // Admin can see everything
      if (normalizedRoles.includes('admin') || normalizedRoles.includes('super_admin')) {
        categories.push(category as DocumentCategory);
        continue;
      }
      // Check if user has any of the allowed roles
      if (allowedRoles.some(role => normalizedRoles.some(userRole => 
        userRole.includes(role) || role.includes(userRole)
      ))) {
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
  ): Promise<PatientDocument> {
    // Verify patient exists
    await this.findOne(patientId);

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
    });

    return this.documentRepository.save(document);
  }

  async getDocuments(
    patientId: string, 
    userRoles: string[],
    category?: DocumentCategory,
  ): Promise<PatientDocument[]> {
    // Get accessible categories for this user
    const accessibleCategories = this.getAccessibleCategories(userRoles);
    
    if (accessibleCategories.length === 0) {
      return [];
    }

    const queryBuilder = this.documentRepository.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.uploader', 'uploader')
      .where('doc.patientId = :patientId', { patientId })
      .andWhere('doc.category IN (:...categories)', { 
        categories: category ? [category] : accessibleCategories 
      });

    // If a specific category was requested, verify user has access
    if (category && !accessibleCategories.includes(category)) {
      throw new ForbiddenException(`You don't have access to ${category} documents`);
    }

    return queryBuilder
      .orderBy('doc.createdAt', 'DESC')
      .getMany();
  }

  async getDocument(documentId: string, userRoles: string[]): Promise<PatientDocument> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['uploader'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check access
    const accessibleCategories = this.getAccessibleCategories(userRoles);
    if (!accessibleCategories.includes(document.category)) {
      throw new ForbiddenException('You don\'t have access to this document');
    }

    // Update access tracking
    document.accessCount += 1;
    document.lastAccessedAt = new Date();
    await this.documentRepository.save(document);

    return document;
  }

  async deleteDocument(documentId: string, userId: string, userRoles: string[]): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check if user can delete (uploader or admin)
    const normalizedRoles = userRoles.map(r => r.toLowerCase());
    const isAdmin = normalizedRoles.some(r => r.includes('admin'));
    
    if (document.uploadedBy !== userId && !isAdmin) {
      throw new ForbiddenException('Only the uploader or admin can delete this document');
    }

    await this.documentRepository.remove(document);
  }

  async getDocumentStats(patientId: string, userRoles: string[]) {
    const accessibleCategories = this.getAccessibleCategories(userRoles);
    
    const stats = await this.documentRepository
      .createQueryBuilder('doc')
      .select('doc.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('doc.patientId = :patientId', { patientId })
      .andWhere('doc.category IN (:...categories)', { categories: accessibleCategories })
      .groupBy('doc.category')
      .getRawMany();

    return stats;
  }

  // ==================== NOTES METHODS ====================

  async createNote(patientId: string, dto: CreateNoteDto, userId: string): Promise<PatientNote> {
    // Verify patient exists
    await this.findOne(patientId);

    const note = this.noteRepository.create({
      patientId,
      type: dto.type,
      content: dto.content,
      createdById: userId,
    });

    return this.noteRepository.save(note);
  }

  async getNotes(patientId: string): Promise<PatientNote[]> {
    return this.noteRepository.find({
      where: { patientId },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getNote(noteId: string): Promise<PatientNote> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId },
      relations: ['createdBy'],
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return note;
  }

  async deleteNote(noteId: string, userId: string, userRoles: string[]): Promise<void> {
    const note = await this.noteRepository.findOne({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    // Check if user can delete (creator or admin)
    const normalizedRoles = userRoles.map(r => r.toLowerCase());
    const isAdmin = normalizedRoles.some(r => r.includes('admin'));
    
    if (note.createdById !== userId && !isAdmin) {
      throw new ForbiddenException('Only the note creator or admin can delete this note');
    }

    await this.noteRepository.softRemove(note);
  }

  // ==================== USER LINKING METHODS ====================

  /**
   * Link a user account to a patient record
   */
  async linkUser(patientId: string, userId: string): Promise<Patient> {
    const patient = await this.findOne(patientId);
    
    // Check if patient already has a linked user
    if (patient.userId) {
      throw new ConflictException('Patient already has a linked user account');
    }

    // Verify user exists
    const userExists = await this.dataSource.query(
      'SELECT id FROM users WHERE id = $1',
      [userId]
    );
    
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
  async unlinkUser(patientId: string): Promise<Patient> {
    const patient = await this.findOne(patientId);
    
    if (!patient.userId) {
      throw new NotFoundException('Patient does not have a linked user account');
    }

    patient.userId = undefined;
    return this.patientRepository.save(patient);
  }

  /**
   * Get linked user information for a patient
   */
  async getLinkedUser(patientId: string): Promise<{
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
      where: { id: patientId },
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
