import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { CreatePatientDto, UpdatePatientDto, PatientSearchDto } from './dto/patient.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  private async generateMRN(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await this.patientRepository.count();
    const sequence = (count + 1).toString().padStart(6, '0');
    return `MRN${year}${sequence}`;
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

    const mrn = await this.generateMRN();
    const patient = this.patientRepository.create({
      ...dto,
      mrn,
      status: 'active',
    });

    return this.patientRepository.save(patient);
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
}
