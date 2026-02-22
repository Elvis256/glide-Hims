import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Prescription, PrescriptionItem, Dispensation, MedicationAdministration, PrescriptionStatus } from '../../database/entities/prescription.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { Item, StockBalance, StockLedger, MovementType } from '../../database/entities/inventory.entity';
import { CreatePrescriptionDto, DispenseItemDto, DispenseBatchDto, PrescriptionQueryDto, UpdateStatusDto, AdministerMedicationDto } from './prescriptions.dto';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private itemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Dispensation)
    private dispensationRepository: Repository<Dispensation>,
    @InjectRepository(MedicationAdministration)
    private adminRepository: Repository<MedicationAdministration>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    @InjectRepository(Item)
    private inventoryRepo: Repository<Item>,
    @InjectRepository(StockBalance)
    private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(StockLedger)
    private stockLedgerRepo: Repository<StockLedger>,
    @Inject(forwardRef(() => BillingService))
    private billingService: BillingService,
  ) {}

  private async generatePrescriptionNumber(): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const last = await this.prescriptionRepository
      .createQueryBuilder('p')
      .where('p.prescription_number LIKE :prefix', { prefix: `RX${datePrefix}%` })
      .orderBy('p.prescription_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (last) {
      const lastSeq = parseInt(last.prescriptionNumber.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `RX${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  async create(dto: CreatePrescriptionDto, userId: string): Promise<Prescription> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId },
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    const prescriptionNumber = await this.generatePrescriptionNumber();

    const prescription = this.prescriptionRepository.create({
      prescriptionNumber,
      encounterId: dto.encounterId,
      prescribedById: userId,
      notes: dto.notes,
      items: dto.items.map(item => this.itemRepository.create(item)),
    });

    const saved = await this.prescriptionRepository.save(prescription);

    // Update encounter status
    if (encounter.status === EncounterStatus.IN_CONSULTATION) {
      encounter.status = EncounterStatus.PENDING_PHARMACY;
      await this.encounterRepository.save(encounter);
    }

    return this.findOne(saved.id);
  }

  async findAll(query: PrescriptionQueryDto): Promise<{ data: Prescription[]; total: number }> {
    const { status, encounterId, patientId, page = 1, limit = 20 } = query;

    const qb = this.prescriptionRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.items', 'items')
      .leftJoinAndSelect('prescription.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('prescription.prescribedBy', 'prescribedBy');

    if (status) {
      qb.andWhere('prescription.status = :status', { status });
    }

    if (encounterId) {
      qb.andWhere('prescription.encounter_id = :encounterId', { encounterId });
    }

    if (patientId) {
      qb.andWhere('encounter.patient_id = :patientId', { patientId });
    }

    qb.orderBy('prescription.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['items', 'encounter', 'encounter.patient', 'prescribedBy'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return prescription;
  }

  async getPharmacyQueue(): Promise<any[]> {
    const prescriptions = await this.prescriptionRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.items', 'items')
      .leftJoinAndSelect('prescription.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('prescription.prescribedBy', 'doctor')
      .where('prescription.status IN (:...statuses)', {
        statuses: [PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_DISPENSED],
      })
      .orderBy('prescription.createdAt', 'ASC')
      .getMany();

    // Transform to include patient at top level for frontend compatibility
    return prescriptions.map((p) => ({
      ...p,
      patient: p.encounter?.patient,
      patientId: p.encounter?.patientId,
      doctor: p.prescribedBy,
      doctorId: p.prescribedById,
    }));
  }

  async dispenseItem(dto: DispenseItemDto, userId: string): Promise<Dispensation> {
    const item = await this.itemRepository.findOne({
      where: { id: dto.prescriptionItemId },
      relations: ['prescription'],
    });

    if (!item) {
      throw new NotFoundException('Prescription item not found');
    }

    const remainingQty = item.quantity - item.quantityDispensed;
    if (dto.quantity > remainingQty) {
      throw new BadRequestException(`Cannot dispense more than ${remainingQty} units`);
    }

    // Create dispensation record
    const dispensation = this.dispensationRepository.create({
      prescriptionId: item.prescriptionId,
      prescriptionItemId: item.id,
      quantity: dto.quantity,
      batchNumber: dto.batchNumber,
      expiryDate: dto.expiryDate,
      unitPrice: dto.unitPrice || 0,
      totalPrice: (dto.unitPrice || 0) * dto.quantity,
      dispensedById: userId,
    });

    await this.dispensationRepository.save(dispensation);

    // Update prescription item
    item.quantityDispensed += dto.quantity;
    if (item.quantityDispensed >= item.quantity) {
      item.isDispensed = true;
    }
    await this.itemRepository.save(item);

    // Update prescription status
    await this.updatePrescriptionStatus(item.prescriptionId);

    return dispensation;
  }

  private async updatePrescriptionStatus(prescriptionId: string): Promise<void> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['items'],
    });

    if (!prescription) return;

    const allDispensed = prescription.items.every(item => item.isDispensed);
    const someDispensed = prescription.items.some(item => item.quantityDispensed > 0);

    if (allDispensed) {
      prescription.status = PrescriptionStatus.DISPENSED;
    } else if (someDispensed) {
      prescription.status = PrescriptionStatus.PARTIALLY_DISPENSED;
    }

    await this.prescriptionRepository.save(prescription);
  }

  // Batch dispense all items in a prescription
  async dispenseBatch(dto: DispenseBatchDto, userId: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: dto.prescriptionId },
      relations: ['items', 'encounter', 'encounter.patient'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    if (prescription.status === PrescriptionStatus.DISPENSED) {
      throw new BadRequestException('Prescription already fully dispensed');
    }

    if (prescription.status === PrescriptionStatus.CANCELLED) {
      throw new BadRequestException('Cannot dispense a cancelled prescription');
    }

    // Process each item
    for (const itemDto of dto.items) {
      const item = prescription.items.find(i => i.id === itemDto.prescriptionItemId);
      if (!item) {
        throw new BadRequestException(`Prescription item ${itemDto.prescriptionItemId} not found`);
      }

      const remainingQty = item.quantity - item.quantityDispensed;
      if (itemDto.quantity > remainingQty) {
        throw new BadRequestException(`Cannot dispense more than ${remainingQty} units for ${item.drugName}`);
      }

      // Create dispensation record
      const dispensation = this.dispensationRepository.create({
        prescriptionId: prescription.id,
        prescriptionItemId: item.id,
        quantity: itemDto.quantity,
        batchNumber: itemDto.batchNumber,
        expiryDate: itemDto.expiryDate ? new Date(itemDto.expiryDate) : undefined,
        dispensedById: userId,
        dispensedAt: new Date(),
      });
      await this.dispensationRepository.save(dispensation);

      // Update prescription item
      item.quantityDispensed += itemDto.quantity;
      if (item.quantityDispensed >= item.quantity) {
        item.isDispensed = true;
      }
      await this.itemRepository.save(item);

      // Add to invoice (billing)
      let billingSuccess = true;
      let billingError: string | null = null;
      
      if (prescription.encounter) {
        try {
          const itemPrice = itemDto.unitPrice || dispensation.unitPrice || 0;
          if (itemPrice <= 0) {
            console.warn(`Warning: Adding pharmacy item ${item.drugName} with zero price`);
          }
          await this.billingService.addBillableItem({
            encounterId: prescription.encounter.id,
            patientId: prescription.encounter.patientId,
            serviceCode: item.drugCode || `DRUG-${item.id.slice(0, 8)}`,
            description: `${item.drugName} x ${itemDto.quantity}`,
            quantity: itemDto.quantity,
            unitPrice: itemPrice,
            chargeType: 'PHARMACY',
            referenceType: 'prescription_item',
            referenceId: item.id,
          }, userId);
        } catch (err) {
          billingSuccess = false;
          billingError = err.message;
          console.error('Failed to add pharmacy item to invoice:', err.message);
        }
      }
      if (!billingSuccess && billingError) {
        console.warn(`Dispensation ${dispensation.id} billing failed: ${billingError}`);
      }

      // Deduct stock — find by drug code or name against inventory items
      const facilityId = prescription.encounter?.patient
        ? (prescription.encounter as any).facilityId
        : null;
      const inventoryItem = await this.inventoryRepo.findOne({
        where: [
          { code: item.drugCode },
          { name: ILike(`%${item.drugName}%`) },
        ],
      });
      if (inventoryItem && facilityId) {
        const stockBalance = await this.stockBalanceRepo.findOne({
          where: { itemId: inventoryItem.id, facilityId },
        });
        if (stockBalance) {
          const newTotal = Number(stockBalance.totalQuantity) - itemDto.quantity;
          const newAvail = Number(stockBalance.availableQuantity) - itemDto.quantity;
          stockBalance.totalQuantity = newTotal;
          stockBalance.availableQuantity = Math.max(0, newAvail);
          stockBalance.lastMovementAt = new Date();
          await this.stockBalanceRepo.save(stockBalance);
          await this.stockLedgerRepo.save(this.stockLedgerRepo.create({
            itemId: inventoryItem.id,
            movementType: MovementType.SALE,
            quantity: -itemDto.quantity,
            balanceAfter: newTotal,
            batchNumber: itemDto.batchNumber,
            referenceType: 'prescription_dispensation',
            referenceId: dispensation.id,
            notes: `Dispensed: Rx ${prescription.prescriptionNumber}`,
            createdById: userId,
            facilityId,
          }));
        }
      }
    }

    // Update prescription status
    await this.updatePrescriptionStatus(prescription.id);

    // Check if prescription is fully dispensed, update encounter status
    const updated = await this.findOne(prescription.id);
    if (updated.status === PrescriptionStatus.DISPENSED && prescription.encounter) {
      // Move encounter to pending payment
      await this.encounterRepository.update(
        { id: prescription.encounter.id },
        { status: EncounterStatus.PENDING_PAYMENT }
      );
    }

    // Return updated prescription
    return updated;
  }

  async cancelPrescription(id: string): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status === PrescriptionStatus.DISPENSED) {
      throw new BadRequestException('Cannot cancel a fully dispensed prescription');
    }

    prescription.status = PrescriptionStatus.CANCELLED;
    return this.prescriptionRepository.save(prescription);
  }

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<Prescription> {
    const prescription = await this.findOne(id);
    if (prescription.status === PrescriptionStatus.CANCELLED) {
      throw new BadRequestException('Cannot update status of a cancelled prescription');
    }
    if (prescription.status === PrescriptionStatus.DISPENSED && dto.status !== 'collected') {
      throw new BadRequestException('Prescription already dispensed');
    }
    const allowed: Record<string, PrescriptionStatus> = {
      pending: PrescriptionStatus.PENDING,
      dispensing: PrescriptionStatus.DISPENSING,
      ready: PrescriptionStatus.READY,
      collected: PrescriptionStatus.COLLECTED,
      cancelled: PrescriptionStatus.CANCELLED,
    };
    if (!allowed[dto.status]) {
      throw new BadRequestException(`Invalid status: ${dto.status}`);
    }
    prescription.status = allowed[dto.status];
    if (dto.notes) prescription.notes = dto.notes;
    return this.prescriptionRepository.save(prescription);
  }

  async search(query: string): Promise<Prescription[]> {
    const q = `%${query}%`;
    return this.prescriptionRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('p.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('p.prescribedBy', 'doctor')
      .where('p.prescription_number ILIKE :q', { q })
      .orWhere('patient.full_name ILIKE :q', { q })
      .orWhere('patient.mrn ILIKE :q', { q })
      .orderBy('p.createdAt', 'DESC')
      .take(20)
      .getMany()
      .then(rows => rows.map(p => ({
        ...p,
        patient: p.encounter?.patient,
        doctor: p.prescribedBy,
      }))) as unknown as Prescription[];
  }

  async administerMedication(
    prescriptionItemId: string,
    dto: AdministerMedicationDto,
    userId: string,
  ): Promise<MedicationAdministration> {
    const item = await this.itemRepository.findOne({
      where: { id: prescriptionItemId },
      relations: ['prescription'],
    });
    if (!item) throw new NotFoundException('Prescription item not found');

    const record = this.adminRepository.create({
      prescriptionId: item.prescriptionId,
      prescriptionItemId: item.id,
      administeredById: userId,
      witnessId: dto.witnessId,
      administeredAt: dto.administeredAt ? new Date(dto.administeredAt) : new Date(),
      doseGiven: dto.doseGiven,
      routeOfAdministration: dto.routeOfAdministration,
      notes: dto.notes,
    });
    return this.adminRepository.save(record);
  }

  async getAdministrationHistory(prescriptionId: string): Promise<MedicationAdministration[]> {
    return this.adminRepository.find({
      where: { prescriptionId },
      relations: ['prescriptionItem', 'administeredBy'],
      order: { administeredAt: 'DESC' },
    });
  }
}
