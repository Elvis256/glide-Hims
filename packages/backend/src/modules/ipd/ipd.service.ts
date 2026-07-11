import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Ward, WardStatus } from '../../database/entities/ward.entity';
import { Bed, BedStatus } from '../../database/entities/bed.entity';
import { Admission, AdmissionStatus } from '../../database/entities/admission.entity';
import { NursingNote } from '../../database/entities/nursing-note.entity';
import {
  MedicationAdministration,
  MedicationStatus,
} from '../../database/entities/medication-administration.entity';
import { BedTransfer } from '../../database/entities/bed-transfer.entity';
import {
  Encounter,
  EncounterStatus,
  EncounterType,
} from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { PrescriptionItem } from '../../database/entities/prescription.entity';
import {
  CreateWardDto,
  UpdateWardDto,
  CreateBedDto,
  UpdateBedDto,
  BulkCreateBedsDto,
  CreateAdmissionDto,
  DischargeAdmissionDto,
  TransferBedDto,
  CreateNursingNoteDto,
  ScheduleMedicationDto,
  AdministerMedicationDto,
  WardQueryDto,
  AdmissionQueryDto,
} from './dto/ipd.dto';
import { BillingService } from '../billing/billing.service';
import { BedBoardService } from './bed-board.service';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { VitalsService } from '../vitals/vitals.service';
import { VitalSource } from '../../database/entities/vital.entity';

@Injectable()
export class IpdService {
  private readonly logger = new Logger(IpdService.name);

  constructor(
    @InjectRepository(Ward) private wardRepo: Repository<Ward>,
    @InjectRepository(Bed) private bedRepo: Repository<Bed>,
    @InjectRepository(Admission) private admissionRepo: Repository<Admission>,
    @InjectRepository(NursingNote) private nursingNoteRepo: Repository<NursingNote>,
    @InjectRepository(MedicationAdministration)
    private medAdminRepo: Repository<MedicationAdministration>,
    @InjectRepository(BedTransfer) private transferRepo: Repository<BedTransfer>,
    @InjectRepository(Encounter) private encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(PrescriptionItem) private prescriptionItemRepo: Repository<PrescriptionItem>,
    private dataSource: DataSource,
    @Inject(forwardRef(() => BillingService))
    private billingService: BillingService,
    private bedBoardService: BedBoardService,
    private auditLogService: AuditLogService,
    private vitalsService: VitalsService,
  ) {}

  // ========== WARD MANAGEMENT ==========
  async createWard(dto: CreateWardDto, tenantId?: string): Promise<Ward> {
    const ward = this.wardRepo.create(dto);
    if (tenantId) ward.tenantId = tenantId;
    return this.wardRepo.save(ward);
  }

  async getWards(query: WardQueryDto, tenantId?: string): Promise<Ward[]> {
    const qb = this.wardRepo
      .createQueryBuilder('ward')
      .leftJoinAndSelect('ward.facility', 'facility')
      .leftJoinAndSelect('ward.beds', 'beds');

    if (tenantId) qb.andWhere('ward.tenant_id = :tenantId', { tenantId });
    if (query.facilityId)
      qb.andWhere('ward.facilityId = :facilityId', { facilityId: query.facilityId });
    if (query.type) qb.andWhere('ward.type = :type', { type: query.type });
    if (query.status) qb.andWhere('ward.status = :status', { status: query.status });

    return qb.orderBy('ward.name', 'ASC').getMany();
  }

  async getWard(id: string, tenantId?: string): Promise<Ward> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const ward = await this.wardRepo.findOne({
      where,
      relations: ['facility', 'beds', 'admissions', 'admissions.patient'],
    });
    if (!ward) throw new NotFoundException('Ward not found');
    return ward;
  }

  async updateWard(id: string, dto: UpdateWardDto, tenantId?: string): Promise<Ward> {
    const ward = await this.getWard(id, tenantId);
    Object.assign(ward, dto);
    return this.wardRepo.save(ward);
  }

  async getWardOccupancy(facilityId?: string, tenantId?: string): Promise<any[]> {
    const qb = this.wardRepo
      .createQueryBuilder('ward')
      .select('ward.id', 'id')
      .addSelect('ward.name', 'name')
      .addSelect('ward.type', 'type')
      .addSelect('ward.totalBeds', 'totalBeds')
      .addSelect('ward.occupiedBeds', 'occupiedBeds');

    if (facilityId) qb.where('ward.facilityId = :facilityId', { facilityId });
    if (tenantId) qb.andWhere('ward.tenant_id = :tenantId', { tenantId });

    const wards = await qb.getRawMany();
    return wards.map((w) => ({
      ...w,
      availableBeds: w.totalBeds - w.occupiedBeds,
      occupancyRate: w.totalBeds > 0 ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0,
    }));
  }

  // ========== BED MANAGEMENT ==========
  async createBed(dto: CreateBedDto, tenantId?: string): Promise<Bed> {
    const bed = this.bedRepo.create(dto);
    if (tenantId) bed.tenantId = tenantId;
    const saved = await this.bedRepo.save(bed);
    await this.updateWardBedCount(dto.wardId, tenantId);
    return saved;
  }

  async bulkCreateBeds(dto: BulkCreateBedsDto, tenantId?: string): Promise<Bed[]> {
    const beds: Bed[] = [];
    for (let i = 1; i <= dto.count; i++) {
      const bed = this.bedRepo.create({
        bedNumber: `${dto.prefix}${i.toString().padStart(2, '0')}`,
        wardId: dto.wardId,
        type: dto.type,
        dailyRate: dto.dailyRate || 0,
      });
      if (tenantId) bed.tenantId = tenantId;
      beds.push(bed);
    }
    const saved = await this.bedRepo.save(beds);
    await this.updateWardBedCount(dto.wardId, tenantId);
    return saved;
  }

  async getBeds(wardId?: string, tenantId?: string): Promise<Bed[]> {
    if (!wardId) {
      return [];
    }
    const where: any = { wardId };
    if (tenantId) where.tenantId = tenantId;
    return this.bedRepo.find({
      where,
      order: { bedNumber: 'ASC' },
    });
  }

  async getAvailableBeds(wardId?: string, tenantId?: string): Promise<Bed[]> {
    const qb = this.bedRepo
      .createQueryBuilder('bed')
      .leftJoinAndSelect('bed.ward', 'ward')
      .where('bed.status = :status', { status: BedStatus.AVAILABLE });

    if (tenantId) qb.andWhere('bed.tenant_id = :tenantId', { tenantId });
    if (wardId) qb.andWhere('bed.wardId = :wardId', { wardId });

    return qb.orderBy('ward.name', 'ASC').addOrderBy('bed.bedNumber', 'ASC').getMany();
  }

  async getBed(id: string, tenantId?: string): Promise<Bed> {
    const bed = await this.bedRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['ward'],
    });
    if (!bed) throw new NotFoundException('Bed not found');
    return bed;
  }

  async updateBed(id: string, dto: UpdateBedDto, tenantId?: string): Promise<Bed> {
    const bed = await this.bedRepo.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!bed) throw new NotFoundException('Bed not found');
    Object.assign(bed, dto);
    return this.bedRepo.save(bed);
  }

  async markBedAvailable(id: string, tenantId?: string): Promise<Bed> {
    const bed = await this.bedRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['ward'],
    });
    if (!bed) throw new NotFoundException('Bed not found');
    if (bed.status !== BedStatus.CLEANING) {
      throw new BadRequestException(
        `Bed can only be marked available from 'cleaning' status, current status is '${bed.status}'`,
      );
    }

    bed.status = BedStatus.AVAILABLE;
    const saved = await this.bedRepo.save(bed);

    // Update ward bed counts
    if (bed.wardId) {
      await this.updateWardBedCount(bed.wardId, tenantId);
    }

    this.logger.log(`Bed ${bed.bedNumber} marked as available after cleaning`);
    return saved;
  }

  private async updateWardBedCount(wardId: string, tenantId?: string): Promise<void> {
    const totalBeds = await this.bedRepo.count({
      where: { wardId, ...(tenantId ? { tenantId } : {}) },
    });
    const occupiedBeds = await this.bedRepo.count({
      where: { wardId, status: BedStatus.OCCUPIED, ...(tenantId ? { tenantId } : {}) },
    });
    await this.wardRepo.update(wardId, { totalBeds, occupiedBeds });
  }

  // ========== ADMISSION MANAGEMENT ==========
  async createAdmission(
    dto: CreateAdmissionDto,
    userId: string,
    tenantId?: string,
  ): Promise<Admission> {
    return this.dataSource.transaction(async (manager) => {
      // Check for duplicate admission — patient must not already be admitted
      const existingAdmission = await manager.findOne(Admission, {
        where: {
          patientId: dto.patientId,
          status: AdmissionStatus.ADMITTED,
          ...(tenantId ? { tenantId } : {}),
        },
      });
      if (existingAdmission) {
        throw new BadRequestException(
          `Patient is already admitted (admission ${existingAdmission.admissionNumber}). Discharge or transfer the existing admission first.`,
        );
      }

      // Verify bed is available with lock
      const bedQb = manager
        .createQueryBuilder(Bed, 'bed')
        .setLock('pessimistic_write')
        .where('bed.id = :id', { id: dto.bedId });
      if (tenantId) bedQb.andWhere('bed.tenant_id = :tenantId', { tenantId });
      const bed = await bedQb.getOne();

      if (!bed) throw new NotFoundException('Bed not found');
      if (bed.status !== BedStatus.AVAILABLE) throw new BadRequestException('Bed is not available');

      // Generate admission number with pessimistic locking
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

      // Lock and count today's admissions to prevent race condition
      // Create separate date objects to avoid mutation issues
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const dailyCountQb = manager
        .createQueryBuilder(Admission, 'admission')
        .setLock('pessimistic_write')
        .where('admission.admissionDate >= :start AND admission.admissionDate <= :end', {
          start: todayStart,
          end: todayEnd,
        });
      if (tenantId) dailyCountQb.andWhere('admission.tenant_id = :tenantId', { tenantId });
      const dailyCount = await dailyCountQb.getCount();

      const admissionNumber = `ADM${dateStr}${(dailyCount + 1).toString().padStart(4, '0')}`;

      // Create admission
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
        ...(tenantId ? { tenantId } : {}),
      };

      const admission = manager.create(Admission, admissionData);
      const saved = await manager.save(admission);

      // Update bed status
      await manager.update(Bed, dto.bedId, { status: BedStatus.OCCUPIED });

      // Update ward bed count
      const totalBeds = await manager.count(Bed, {
        where: { wardId: dto.wardId, ...(tenantId ? { tenantId } : {}) },
      });
      const occupiedBeds = await manager.count(Bed, {
        where: {
          wardId: dto.wardId,
          status: BedStatus.OCCUPIED,
          ...(tenantId ? { tenantId } : {}),
        },
      });
      await manager.update(Ward, dto.wardId, { totalBeds, occupiedBeds });

      // Update encounter to IPD status (only if encounterId provided)
      if (dto.encounterId) {
        await manager.update(Encounter, dto.encounterId, {
          type: EncounterType.IPD,
          status: EncounterStatus.ADMITTED,
        });
      }

      this.logger.log(
        `Admission created: ${admissionNumber} for patient ${dto.patientId} by user ${userId}`,
      );

      // Auto-bill admission/bed charge if encounter is linked
      if (dto.encounterId) {
        try {
          const ward = await manager.findOne(Ward, {
            where: { id: dto.wardId, ...(tenantId ? { tenantId } : {}) },
          });
          const bed = await manager.findOne(Bed, {
            where: { id: dto.bedId, ...(tenantId ? { tenantId } : {}) },
          });
          await this.billingService.addBillableItem(
            {
              encounterId: dto.encounterId,
              patientId: dto.patientId,
              serviceCode: `BED-${bed?.bedNumber || dto.bedId.slice(0, 8)}`,
              description:
                `Bed Charge – ${ward?.name || 'Ward'} Bed ${bed?.bedNumber || ''}`.trim(),
              quantity: 1,
              unitPrice: 0, // Admin sets price via settings
              chargeType: 'inpatient',
              referenceType: 'admission',
              referenceId: saved.id,
            },
            userId,
            tenantId,
          );
        } catch (err) {
          this.logger.warn(
            `Auto bed-billing failed for admission ${admissionNumber}: ${err.message}`,
          );
        }
      }

      return saved;
    });
  }

  async getAdmissions(
    query: AdmissionQueryDto,
    tenantId?: string,
  ): Promise<{ data: Admission[]; total: number }> {
    const qb = this.admissionRepo
      .createQueryBuilder('admission')
      .leftJoinAndSelect('admission.patient', 'patient')
      .leftJoinAndSelect('admission.ward', 'ward')
      .leftJoinAndSelect('admission.bed', 'bed')
      .leftJoinAndSelect('admission.attendingDoctor', 'doctor');

    if (tenantId) qb.andWhere('admission.tenant_id = :tenantId', { tenantId });
    if (query.wardId) qb.andWhere('admission.wardId = :wardId', { wardId: query.wardId });
    if (query.patientId)
      qb.andWhere('admission.patientId = :patientId', { patientId: query.patientId });
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

  async getAdmission(id: string, tenantId?: string): Promise<Admission> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const admission = await this.admissionRepo.findOne({
      where,
      relations: [
        'patient',
        'ward',
        'bed',
        'encounter',
        'attendingDoctor',
        'admittedBy',
        'nursingNotes',
        'nursingNotes.nurse',
      ],
    });
    if (!admission) throw new NotFoundException('Admission not found');
    return admission;
  }

  async getCurrentAdmission(patientId: string, tenantId?: string): Promise<Admission | null> {
    return this.admissionRepo.findOne({
      where: { patientId, status: AdmissionStatus.ADMITTED, ...(tenantId ? { tenantId } : {}) },
      relations: ['ward', 'bed'],
    });
  }

  async dischargePatient(
    id: string,
    dto: DischargeAdmissionDto,
    userId: string,
    tenantId?: string,
  ): Promise<Admission> {
    return this.dataSource.transaction(async (manager) => {
      const admission = await manager.findOne(Admission, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        relations: ['patient', 'ward', 'bed', 'encounter', 'attendingDoctor'],
      });

      if (!admission) throw new NotFoundException('Admission not found');
      if (admission.status !== AdmissionStatus.ADMITTED) {
        throw new BadRequestException('Patient is not currently admitted');
      }

      // Update admission
      admission.status = AdmissionStatus.DISCHARGED;
      admission.dischargeDate = new Date();
      admission.dischargedById = userId;
      Object.assign(admission, dto);

      const saved = await manager.save(admission);

      // Free up bed
      await manager.update(Bed, admission.bedId, { status: BedStatus.CLEANING });

      // Update ward bed count
      const totalBeds = await manager.count(Bed, {
        where: { wardId: admission.wardId, ...(tenantId ? { tenantId } : {}) },
      });
      const occupiedBeds = await manager.count(Bed, {
        where: {
          wardId: admission.wardId,
          status: BedStatus.OCCUPIED,
          ...(tenantId ? { tenantId } : {}),
        },
      });
      await manager.update(Ward, admission.wardId, { totalBeds, occupiedBeds });

      // Update encounter
      await manager.update(Encounter, admission.encounterId, {
        status: EncounterStatus.COMPLETED,
        endTime: new Date(),
      });

      // Auto-generate the inpatient invoice for bed-days (handles transfers).
      // We compute outside the transaction's manager because BillingService owns
      // its own validation + numbering; failures are logged but don't roll back
      // the discharge (a clerk can re-run billing manually).
      let invoiceId: string | undefined;
      try {
        const bedLines = await this.bedBoardService.computeBedDayCharges(saved.id, tenantId);
        if (bedLines.length) {
          const invoice = await this.billingService.createInvoice(
            {
              patientId: saved.patientId,
              encounterId: saved.encounterId,
              items: bedLines as any,
            } as any,
            userId,
            tenantId,
          );
          invoiceId = invoice.id;
          saved.metadata = {
            ...(saved.metadata || {}),
            inpatientInvoiceId: invoiceId,
          };
          await manager.save(saved);
        }
      } catch (err: any) {
        this.logger.warn(
          `Auto-bill on discharge failed for admission ${saved.admissionNumber}: ${err.message}`,
        );
      }

      this.logger.log(
        `Patient discharged: admission ${admission.admissionNumber}, patient ${admission.patientId} by user ${userId}${
          invoiceId ? ` (invoice ${invoiceId})` : ''
        }`,
      );
      return saved;
    });
  }

  async transferBed(
    id: string,
    dto: TransferBedDto,
    userId: string,
    tenantId?: string,
  ): Promise<Admission> {
    return this.dataSource.transaction(async (manager) => {
      // Read admission inside transaction with pessimistic lock to prevent race conditions
      const admissionQb = manager
        .createQueryBuilder(Admission, 'admission')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('admission.patient', 'patient')
        .leftJoinAndSelect('admission.ward', 'ward')
        .leftJoinAndSelect('admission.bed', 'bed')
        .leftJoinAndSelect('admission.encounter', 'encounter')
        .leftJoinAndSelect('admission.attendingDoctor', 'doctor')
        .where('admission.id = :id', { id });
      if (tenantId) admissionQb.andWhere('admission.tenant_id = :tenantId', { tenantId });
      const admission = await admissionQb.getOne();

      if (!admission) throw new NotFoundException('Admission not found');
      if (admission.status !== AdmissionStatus.ADMITTED) {
        throw new BadRequestException('Patient is not currently admitted');
      }

      const fromBedId = admission.bedId;
      const fromWardId = admission.wardId;

      // Verify new bed is available with lock
      const newBedQb = manager
        .createQueryBuilder(Bed, 'bed')
        .setLock('pessimistic_write')
        .where('bed.id = :id', { id: dto.toBedId });
      if (tenantId) newBedQb.andWhere('bed.tenant_id = :tenantId', { tenantId });
      const newBed = await newBedQb.getOne();

      if (!newBed) throw new NotFoundException('New bed not found');
      if (newBed.status !== BedStatus.AVAILABLE)
        throw new BadRequestException('New bed is not available');

      // Record transfer
      const transfer = manager.create(BedTransfer, {
        admissionId: id,
        fromWardId,
        fromBedId,
        toWardId: dto.toWardId,
        toBedId: dto.toBedId,
        reason: dto.reason,
        notes: dto.notes,
        transferredById: userId,
      });
      await manager.save(transfer);

      // Free old bed
      await manager.update(Bed, fromBedId, { status: BedStatus.CLEANING });

      // Occupy new bed
      await manager.update(Bed, dto.toBedId, { status: BedStatus.OCCUPIED });

      // Update ward bed counts — single aggregation query instead of 2N count queries
      const wardIds = fromWardId === dto.toWardId ? [fromWardId] : [fromWardId, dto.toWardId];
      const bedStats: { wardId: string; total: string; occupied: string }[] = await manager
        .createQueryBuilder(Bed, 'b')
        .select('b.wardId', 'wardId')
        .addSelect('COUNT(*)::int', 'total')
        .addSelect(`COUNT(*) FILTER (WHERE b.status = '${BedStatus.OCCUPIED}')::int`, 'occupied')
        .where('b.wardId IN (:...wardIds)', { wardIds })
        .andWhere(tenantId ? 'b.tenantId = :tenantId' : '1=1', tenantId ? { tenantId } : {})
        .groupBy('b.wardId')
        .getRawMany();
      for (const stat of bedStats) {
        await manager.update(Ward, stat.wardId, {
          totalBeds: Number(stat.total),
          occupiedBeds: Number(stat.occupied),
        });
      }

      // Update admission
      admission.wardId = dto.toWardId;
      admission.bedId = dto.toBedId;
      const saved = await manager.save(admission);

      this.logger.log(
        `Bed transfer: admission ${admission.admissionNumber} from bed ${fromBedId} to bed ${dto.toBedId} by user ${userId}`,
      );
      return saved;
    });
  }

  // ========== NURSING NOTES ==========
  async createNursingNote(
    dto: CreateNursingNoteDto,
    userId: string,
    tenantId?: string,
  ): Promise<NursingNote> {
    // Verify admission exists and is active
    const admission = await this.admissionRepo.findOne({
      where: { id: dto.admissionId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.status !== AdmissionStatus.ADMITTED) {
      throw new BadRequestException('Cannot add nursing note to a non-active admission');
    }

    const note = this.nursingNoteRepo.create({
      ...dto,
      nurseId: userId,
      noteTime: new Date(),
      ...(tenantId ? { tenantId } : {}),
    });
    const saved = await this.nursingNoteRepo.save(note);
    this.logger.log(
      `Nursing note created: ${saved.id} type ${dto.type} for admission ${dto.admissionId} by user ${userId}`,
    );

    // Mirror inline `vitals` blob into the canonical `vitals` table so
    // ward-round vitals show on the patient timeline + drive critical alerts.
    if (dto.vitals) {
      await this.vitalsService.recordFromSource({
        source: VitalSource.IPD_WARD_ROUND,
        sourceRefId: saved.id,
        patientId: admission.patientId,
        encounterId: admission.encounterId ?? null,
        recordedById: userId,
        tenantId,
        recordedAt: saved.noteTime ?? new Date(),
        vitals: {
          temperature: dto.vitals.temperature,
          pulse: dto.vitals.pulse,
          bpSystolic: dto.vitals.bpSystolic,
          bpDiastolic: dto.vitals.bpDiastolic,
          respiratoryRate: dto.vitals.respiratoryRate,
          oxygenSaturation: dto.vitals.oxygenSaturation,
          painScale: dto.vitals.painLevel,
        },
      });
    }

    return saved;
  }

  async getNursingNotes(admissionId: string, tenantId?: string): Promise<NursingNote[]> {
    return this.nursingNoteRepo.find({
      where: { admissionId, ...(tenantId ? { tenantId } : {}) },
      relations: ['nurse'],
      order: { noteTime: 'DESC' },
    });
  }

  // ========== MEDICATION ADMINISTRATION ==========
  async scheduleMedication(
    dto: ScheduleMedicationDto,
    userId: string,
    tenantId?: string,
  ): Promise<MedicationAdministration> {
    // Verify admission exists and is active
    const admission = await this.admissionRepo.findOne({
      where: { id: dto.admissionId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!admission) throw new NotFoundException('Admission not found');
    if (admission.status !== AdmissionStatus.ADMITTED) {
      throw new BadRequestException('Cannot schedule medication for a non-active admission');
    }

    const med = this.medAdminRepo.create({
      admissionId: dto.admissionId,
      prescriptionItemId: dto.prescriptionItemId,
      drugName: dto.drugName,
      dose: dto.dose,
      route: dto.route,
      notes: dto.notes,
      scheduledTime: new Date(dto.scheduledTime),
      status: MedicationStatus.SCHEDULED,
      ...(tenantId ? { tenantId } : {}),
    });
    const saved = await this.medAdminRepo.save(med);
    this.logger.log(
      `Medication scheduled: ${dto.drugName} ${dto.dose} for admission ${dto.admissionId} at ${dto.scheduledTime}`,
    );
    return saved;
  }

  async getMedicationSchedule(
    admissionId: string,
    date?: string,
    tenantId?: string,
  ): Promise<MedicationAdministration[]> {
    const qb = this.medAdminRepo
      .createQueryBuilder('med')
      .where('med.admissionId = :admissionId', { admissionId });
    if (tenantId) qb.andWhere('med.tenant_id = :tenantId', { tenantId });

    if (date) {
      qb.andWhere('DATE(med.scheduledTime) = :date', { date });
    }

    return qb.orderBy('med.scheduledTime', 'ASC').getMany();
  }

  async administerMedication(
    id: string,
    dto: AdministerMedicationDto,
    userId: string,
    tenantId?: string,
  ): Promise<MedicationAdministration> {
    return this.dataSource.transaction(async (manager) => {
      // C2: pessimistic lock prevents two nurses double-administering the same dose.
      const med = await manager.findOne(MedicationAdministration, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!med) throw new NotFoundException('Medication schedule not found');

      // Refuse re-administration of a dose already finalized as ADMINISTERED.
      if (med.status === MedicationStatus.ADMINISTERED) {
        throw new BadRequestException('This dose has already been administered');
      }

      // C3: documented-allergy guard. We use the patient.allergies free-text array
      // as the source of truth (frontend writes to it). Substring match is the
      // safest non-invasive default; pharmacists can override with a reason.
      if (dto.status === MedicationStatus.ADMINISTERED && med.admissionId && med.drugName) {
        const admission = await manager.findOne(Admission, {
          where: { id: med.admissionId, ...(tenantId ? { tenantId } : {}) },
          relations: ['patient'],
        });
        const allergies = admission?.patient?.allergies || [];
        const drug = med.drugName.toLowerCase();
        const hit = allergies.find((a) => {
          const tag = String(a || '')
            .trim()
            .toLowerCase();
          return tag.length > 2 && drug.includes(tag);
        });
        if (hit && !dto.allergyOverrideReason) {
          throw new BadRequestException(
            `Patient has documented allergy to "${hit}". Provide allergyOverrideReason to proceed.`,
          );
        }
      }

      const previousStatus = med.status;
      med.status = dto.status;
      med.administeredById = userId;
      med.administeredAt = new Date();
      if (dto.batchNumber) med.batchNumber = dto.batchNumber;
      if (dto.notes) med.notes = dto.notes;
      if (dto.reason) med.reason = dto.reason;

      const saved = await manager.save(med);

      // C5: dose tracking — increment quantityDispensed on the linked Rx item
      // so prescription remaining-count reflects what was actually given.
      if (dto.status === MedicationStatus.ADMINISTERED && med.prescriptionItemId) {
        await manager.increment(
          PrescriptionItem,
          { id: med.prescriptionItemId },
          'quantityDispensed',
          1,
        );
      }

      // C6: audit log (best-effort, never blocks the dose).
      this.auditLogService
        .log({
          userId,
          action: 'MEDICATION_ADMINISTERED',
          entityType: 'MedicationAdministration',
          entityId: saved.id,
          oldValue: { status: previousStatus },
          newValue: {
            status: saved.status,
            drugName: saved.drugName,
            admissionId: saved.admissionId,
            allergyOverrideReason: dto.allergyOverrideReason || null,
          },
          ...(tenantId ? { tenantId } : {}),
        })
        .catch((err) =>
          this.logger.error(`Audit log failed for med admin ${saved.id}: ${err.message}`),
        );

      this.logger.log(
        `Medication administered: ${med.drugName} status ${dto.status} for admission ${med.admissionId} by user ${userId}`,
      );
      return saved;
    });
  }

  // ========== DASHBOARD STATS ==========
  async getIpdStats(facilityId?: string, tenantId?: string): Promise<any> {
    const admissionQb = this.admissionRepo.createQueryBuilder('a').leftJoin('a.ward', 'w');

    if (facilityId) {
      admissionQb.where('w.facilityId = :facilityId', { facilityId });
    }

    if (tenantId) {
      admissionQb.andWhere('a.tenant_id = :tenantId', { tenantId });
    }

    const activeAdmissions = await admissionQb
      .clone()
      .andWhere('a.status = :status', { status: AdmissionStatus.ADMITTED })
      .getCount();

    const todayAdmissions = await admissionQb
      .clone()
      .andWhere('DATE(a.admissionDate) = CURRENT_DATE')
      .getCount();

    const todayDischarges = await admissionQb
      .clone()
      .andWhere('DATE(a.dischargeDate) = CURRENT_DATE')
      .andWhere('a.status = :status', { status: AdmissionStatus.DISCHARGED })
      .getCount();

    const occupancy = await this.getWardOccupancy(facilityId, tenantId);
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
