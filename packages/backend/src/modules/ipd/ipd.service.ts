import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ward, WardStatus } from '../../database/entities/ward.entity';
import { Bed, BedStatus } from '../../database/entities/bed.entity';
import { Admission, AdmissionStatus } from '../../database/entities/admission.entity';
import { NursingNote } from '../../database/entities/nursing-note.entity';
import { MedicationAdministration, MedicationStatus } from '../../database/entities/medication-administration.entity';
import { BedTransfer } from '../../database/entities/bed-transfer.entity';
import { Encounter, EncounterStatus, EncounterType } from '../../database/entities/encounter.entity';
import {
  CreateWardDto, UpdateWardDto, CreateBedDto, UpdateBedDto, BulkCreateBedsDto,
  CreateAdmissionDto, DischargeAdmissionDto, TransferBedDto,
  CreateNursingNoteDto, ScheduleMedicationDto, AdministerMedicationDto,
  WardQueryDto, AdmissionQueryDto,
} from './dto/ipd.dto';

@Injectable()
export class IpdService {
  constructor(
    @InjectRepository(Ward) private wardRepo: Repository<Ward>,
    @InjectRepository(Bed) private bedRepo: Repository<Bed>,
    @InjectRepository(Admission) private admissionRepo: Repository<Admission>,
    @InjectRepository(NursingNote) private nursingNoteRepo: Repository<NursingNote>,
    @InjectRepository(MedicationAdministration) private medAdminRepo: Repository<MedicationAdministration>,
    @InjectRepository(BedTransfer) private transferRepo: Repository<BedTransfer>,
    @InjectRepository(Encounter) private encounterRepo: Repository<Encounter>,
  ) {}

  // ========== WARD MANAGEMENT ==========
  async createWard(dto: CreateWardDto): Promise<Ward> {
    const ward = this.wardRepo.create(dto);
    return this.wardRepo.save(ward);
  }

  async getWards(query: WardQueryDto): Promise<Ward[]> {
    const qb = this.wardRepo.createQueryBuilder('ward')
      .leftJoinAndSelect('ward.facility', 'facility')
      .leftJoinAndSelect('ward.beds', 'beds');

    if (query.facilityId) qb.andWhere('ward.facilityId = :facilityId', { facilityId: query.facilityId });
    if (query.type) qb.andWhere('ward.type = :type', { type: query.type });
    if (query.status) qb.andWhere('ward.status = :status', { status: query.status });

    return qb.orderBy('ward.name', 'ASC').getMany();
  }

  async getWard(id: string): Promise<Ward> {
    const ward = await this.wardRepo.findOne({
      where: { id },
      relations: ['facility', 'beds', 'admissions', 'admissions.patient'],
    });
    if (!ward) throw new NotFoundException('Ward not found');
    return ward;
  }

  async updateWard(id: string, dto: UpdateWardDto): Promise<Ward> {
    const ward = await this.getWard(id);
    Object.assign(ward, dto);
    return this.wardRepo.save(ward);
  }

  async getWardOccupancy(facilityId?: string): Promise<any[]> {
    const qb = this.wardRepo.createQueryBuilder('ward')
      .select('ward.id', 'id')
      .addSelect('ward.name', 'name')
      .addSelect('ward.type', 'type')
      .addSelect('ward.totalBeds', 'totalBeds')
      .addSelect('ward.occupiedBeds', 'occupiedBeds');

    if (facilityId) qb.where('ward.facilityId = :facilityId', { facilityId });

    const wards = await qb.getRawMany();
    return wards.map(w => ({
      ...w,
      availableBeds: w.totalBeds - w.occupiedBeds,
      occupancyRate: w.totalBeds > 0 ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0,
    }));
  }

  // ========== BED MANAGEMENT ==========
  async createBed(dto: CreateBedDto): Promise<Bed> {
    const bed = this.bedRepo.create(dto);
    const saved = await this.bedRepo.save(bed);
    await this.updateWardBedCount(dto.wardId);
    return saved;
  }

  async bulkCreateBeds(dto: BulkCreateBedsDto): Promise<Bed[]> {
    const beds: Bed[] = [];
    for (let i = 1; i <= dto.count; i++) {
      const bed = this.bedRepo.create({
        bedNumber: `${dto.prefix}${i.toString().padStart(2, '0')}`,
        wardId: dto.wardId,
        type: dto.type,
        dailyRate: dto.dailyRate || 0,
      });
      beds.push(bed);
    }
    const saved = await this.bedRepo.save(beds);
    await this.updateWardBedCount(dto.wardId);
    return saved;
  }

  async getBeds(wardId: string): Promise<Bed[]> {
    return this.bedRepo.find({
      where: { wardId },
      order: { bedNumber: 'ASC' },
    });
  }

  async getAvailableBeds(wardId?: string): Promise<Bed[]> {
    const qb = this.bedRepo.createQueryBuilder('bed')
      .leftJoinAndSelect('bed.ward', 'ward')
      .where('bed.status = :status', { status: BedStatus.AVAILABLE });

    if (wardId) qb.andWhere('bed.wardId = :wardId', { wardId });

    return qb.orderBy('ward.name', 'ASC').addOrderBy('bed.bedNumber', 'ASC').getMany();
  }

  async getBed(id: string): Promise<Bed> {
    const bed = await this.bedRepo.findOne({ 
      where: { id },
      relations: ['ward'],
    });
    if (!bed) throw new NotFoundException('Bed not found');
    return bed;
  }

  async updateBed(id: string, dto: UpdateBedDto): Promise<Bed> {
    const bed = await this.bedRepo.findOne({ where: { id } });
    if (!bed) throw new NotFoundException('Bed not found');
    Object.assign(bed, dto);
    return this.bedRepo.save(bed);
  }

  private async updateWardBedCount(wardId: string): Promise<void> {
    const totalBeds = await this.bedRepo.count({ where: { wardId } });
    const occupiedBeds = await this.bedRepo.count({ where: { wardId, status: BedStatus.OCCUPIED } });
    await this.wardRepo.update(wardId, { totalBeds, occupiedBeds });
  }

  // ========== ADMISSION MANAGEMENT ==========
  async createAdmission(dto: CreateAdmissionDto, userId: string): Promise<Admission> {
    try {
      
      // Verify bed is available
      const bed = await this.bedRepo.findOne({ where: { id: dto.bedId } });
      if (!bed) throw new NotFoundException('Bed not found');
      if (bed.status !== BedStatus.AVAILABLE) throw new BadRequestException('Bed is not available');

      // Generate admission number
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await this.admissionRepo.count() + 1;
      const admissionNumber = `ADM${dateStr}${count.toString().padStart(4, '0')}`;

      // Create admission - explicitly set all required fields
      const admissionData = {
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        wardId: dto.wardId,
        bedId: dto.bedId,
        type: dto.type,
        admissionReason: dto.admissionReason,
        admissionDiagnosis: dto.admissionDiagnosis,
        attendingDoctorId: dto.attendingDoctorId,
        admissionNumber,
        admissionDate: new Date(),
        admittedById: userId,
      };
      
      const admission = this.admissionRepo.create(admissionData);

      const saved = await this.admissionRepo.save(admission);

      // Update bed status
      await this.bedRepo.update(dto.bedId, { status: BedStatus.OCCUPIED });
      await this.updateWardBedCount(dto.wardId);

      // Update encounter to IPD status
      await this.encounterRepo.update(dto.encounterId, {
        type: EncounterType.IPD,
        status: EncounterStatus.ADMITTED,
      });

      return saved;
    } catch (error) {
      console.error('Admission creation error:', error);
      throw error;
    }
  }

  async getAdmissions(query: AdmissionQueryDto): Promise<{ data: Admission[]; total: number }> {
    const qb = this.admissionRepo.createQueryBuilder('admission')
      .leftJoinAndSelect('admission.patient', 'patient')
      .leftJoinAndSelect('admission.ward', 'ward')
      .leftJoinAndSelect('admission.bed', 'bed')
      .leftJoinAndSelect('admission.attendingDoctor', 'doctor');

    if (query.wardId) qb.andWhere('admission.wardId = :wardId', { wardId: query.wardId });
    if (query.patientId) qb.andWhere('admission.patientId = :patientId', { patientId: query.patientId });
    if (query.status) {
      qb.andWhere('admission.status = :status', { status: query.status });
    } else {
      qb.andWhere('admission.status = :status', { status: AdmissionStatus.ADMITTED });
    }

    const [data, total] = await qb
      .orderBy('admission.admissionDate', 'DESC')
      .skip(((query.page || 1) - 1) * (query.limit || 20))
      .take(query.limit || 20)
      .getManyAndCount();

    return { data, total };
  }

  async getAdmission(id: string): Promise<Admission> {
    const admission = await this.admissionRepo.findOne({
      where: { id },
      relations: ['patient', 'ward', 'bed', 'encounter', 'attendingDoctor', 'admittedBy', 'nursingNotes', 'nursingNotes.nurse'],
    });
    if (!admission) throw new NotFoundException('Admission not found');
    return admission;
  }

  async getCurrentAdmission(patientId: string): Promise<Admission | null> {
    return this.admissionRepo.findOne({
      where: { patientId, status: AdmissionStatus.ADMITTED },
      relations: ['ward', 'bed'],
    });
  }

  async dischargePatient(id: string, dto: DischargeAdmissionDto, userId: string): Promise<Admission> {
    const admission = await this.getAdmission(id);
    if (admission.status !== AdmissionStatus.ADMITTED) {
      throw new BadRequestException('Patient is not currently admitted');
    }

    // Update admission
    admission.status = AdmissionStatus.DISCHARGED;
    admission.dischargeDate = new Date();
    admission.dischargedById = userId;
    Object.assign(admission, dto);

    const saved = await this.admissionRepo.save(admission);

    // Free up bed
    await this.bedRepo.update(admission.bedId, { status: BedStatus.CLEANING });
    await this.updateWardBedCount(admission.wardId);

    // Update encounter
    await this.encounterRepo.update(admission.encounterId, { status: EncounterStatus.COMPLETED, endTime: new Date() });

    return saved;
  }

  async transferBed(id: string, dto: TransferBedDto, userId: string): Promise<Admission> {
    const admission = await this.getAdmission(id);
    if (admission.status !== AdmissionStatus.ADMITTED) {
      throw new BadRequestException('Patient is not currently admitted');
    }

    // Verify new bed is available
    const newBed = await this.bedRepo.findOne({ where: { id: dto.toBedId } });
    if (!newBed) throw new NotFoundException('New bed not found');
    if (newBed.status !== BedStatus.AVAILABLE) throw new BadRequestException('New bed is not available');

    // Record transfer
    const transfer = this.transferRepo.create({
      admissionId: id,
      fromWardId: admission.wardId,
      fromBedId: admission.bedId,
      toWardId: dto.toWardId,
      toBedId: dto.toBedId,
      reason: dto.reason,
      notes: dto.notes,
      transferredById: userId,
    });
    await this.transferRepo.save(transfer);

    // Free old bed
    await this.bedRepo.update(admission.bedId, { status: BedStatus.CLEANING });
    await this.updateWardBedCount(admission.wardId);

    // Occupy new bed
    await this.bedRepo.update(dto.toBedId, { status: BedStatus.OCCUPIED });
    await this.updateWardBedCount(dto.toWardId);

    // Update admission
    admission.wardId = dto.toWardId;
    admission.bedId = dto.toBedId;
    return this.admissionRepo.save(admission);
  }

  // ========== NURSING NOTES ==========
  async createNursingNote(dto: CreateNursingNoteDto, userId: string): Promise<NursingNote> {
    const note = this.nursingNoteRepo.create({
      ...dto,
      nurseId: userId,
      noteTime: new Date(),
    });
    return this.nursingNoteRepo.save(note);
  }

  async getNursingNotes(admissionId: string): Promise<NursingNote[]> {
    return this.nursingNoteRepo.find({
      where: { admissionId },
      relations: ['nurse'],
      order: { noteTime: 'DESC' },
    });
  }

  // ========== MEDICATION ADMINISTRATION ==========
  async scheduleMedication(dto: ScheduleMedicationDto, userId: string): Promise<MedicationAdministration> {
    const med = this.medAdminRepo.create({
      ...dto,
      scheduledTime: new Date(dto.scheduledTime),
      status: MedicationStatus.SCHEDULED,
    });
    return this.medAdminRepo.save(med);
  }

  async getMedicationSchedule(admissionId: string, date?: string): Promise<MedicationAdministration[]> {
    const qb = this.medAdminRepo.createQueryBuilder('med')
      .where('med.admissionId = :admissionId', { admissionId });

    if (date) {
      qb.andWhere('DATE(med.scheduledTime) = :date', { date });
    }

    return qb.orderBy('med.scheduledTime', 'ASC').getMany();
  }

  async administerMedication(id: string, dto: AdministerMedicationDto, userId: string): Promise<MedicationAdministration> {
    const med = await this.medAdminRepo.findOne({ where: { id } });
    if (!med) throw new NotFoundException('Medication schedule not found');

    med.status = dto.status;
    med.administeredById = userId;
    med.administeredTime = new Date();
    if (dto.batchNumber) med.batchNumber = dto.batchNumber;
    if (dto.notes) med.notes = dto.notes;
    if (dto.reason) med.reason = dto.reason;

    return this.medAdminRepo.save(med);
  }

  // ========== DASHBOARD STATS ==========
  async getIpdStats(facilityId?: string): Promise<any> {
    const activeAdmissions = await this.admissionRepo.count({
      where: { status: AdmissionStatus.ADMITTED },
    });

    const todayAdmissions = await this.admissionRepo
      .createQueryBuilder('a')
      .where('DATE(a.admissionDate) = CURRENT_DATE')
      .getCount();

    const todayDischarges = await this.admissionRepo
      .createQueryBuilder('a')
      .where('DATE(a.dischargeDate) = CURRENT_DATE')
      .andWhere('a.status = :status', { status: AdmissionStatus.DISCHARGED })
      .getCount();

    const occupancy = await this.getWardOccupancy(facilityId);
    const totalBeds = occupancy.reduce((sum, w) => sum + w.totalBeds, 0);
    const occupiedBeds = occupancy.reduce((sum, w) => sum + w.occupiedBeds, 0);

    return {
      activeAdmissions,
      todayAdmissions,
      todayDischarges,
      totalBeds,
      occupiedBeds,
      availableBeds: totalBeds - occupiedBeds,
      overallOccupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      wardOccupancy: occupancy,
    };
  }
}
