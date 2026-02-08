import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { PatientDocument, DocumentCategory, DocumentCategoryAccess } from '../../database/entities/patient-document.entity';
import { PatientNote, NoteType } from '../../database/entities/patient-note.entity';
import { CreatePatientDto, UpdatePatientDto, PatientSearchDto } from './dto/patient.dto';

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

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(PatientDocument)
    private documentRepository: Repository<PatientDocument>,
    @InjectRepository(PatientNote)
    private noteRepository: Repository<PatientNote>,
  ) {}

  private async generateMRN(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const prefix = `MRN${year}`;
    
    // Get the highest MRN for this year to avoid duplicates
    const latestPatient = await this.patientRepository
      .createQueryBuilder('patient')
      .withDeleted() // Include soft-deleted records
      .where('patient.mrn LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('patient.mrn', 'DESC')
      .getOne();
    
    let sequence = 1;
    if (latestPatient) {
      const lastSequence = parseInt(latestPatient.mrn.slice(-6), 10);
      sequence = lastSequence + 1;
    }
    
    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
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

        return await this.patientRepository.save(patient);
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

  async checkDuplicates(dto: CreatePatientDto) {
    const duplicates: Patient[] = [];

    if (dto.nationalId) {
      const byNationalId = await this.patientRepository.findOne({
        where: { nationalId: dto.nationalId },
      });
      if (byNationalId) duplicates.push(byNationalId);
    }

    if (dto.phone) {
      const byPhone = await this.patientRepository.find({
        where: { phone: dto.phone },
      });
      duplicates.push(...byPhone);
    }

    // Check by name and DOB
    const byNameDob = await this.patientRepository.find({
      where: {
        fullName: dto.fullName,
        dateOfBirth: new Date(dto.dateOfBirth),
      },
    });
    duplicates.push(...byNameDob);

    // Remove duplicates
    const unique = [...new Map(duplicates.map((p) => [p.id, p])).values()];
    return unique;
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
}
