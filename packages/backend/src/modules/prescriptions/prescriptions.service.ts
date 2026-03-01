import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, DataSource } from 'typeorm';
import { Prescription, PrescriptionItem, Dispensation, PrescriptionStatus } from '../../database/entities/prescription.entity';
import { MedicationAdministration } from '../../database/entities/medication-administration.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { Item, StockBalance, StockLedger, MovementType } from '../../database/entities/inventory.entity';
import { CreatePrescriptionDto, DispenseItemDto, DispenseBatchDto, PrescriptionQueryDto, UpdateStatusDto, AdministerMedicationDto } from './prescriptions.dto';
import { BillingService } from '../billing/billing.service';
import { InAppNotificationService } from '../in-app-notifications/in-app-notification.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';

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
    private dataSource: DataSource,
    private readonly inAppNotificationService: InAppNotificationService,
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

    // Use a transaction with row-level locking to prevent race conditions
    const saved = await this.dataSource.transaction(async (manager) => {
      const prescription = manager.create(Prescription, {
        prescriptionNumber,
        encounterId: dto.encounterId,
        prescribedById: userId,
        notes: dto.notes,
        items: dto.items.map(item => manager.create(PrescriptionItem, item)),
      });

      const savedPrescription = await manager.save(prescription);

      // Reserve stock for each item
      const facilityId = encounter.facilityId;
      if (facilityId) {
        const insufficientItems: string[] = [];

        for (const item of dto.items) {
          const inventoryItem = await manager.findOne(Item, {
            where: [
              { code: item.drugCode },
              { name: ILike(`%${item.drugName}%`) },
            ],
          });

          if (inventoryItem) {
            // Lock the row to prevent concurrent modifications
            const stockBalance = await manager
              .createQueryBuilder(StockBalance, 'sb')
              .setLock('pessimistic_write')
              .where('sb.item_id = :itemId AND sb.facility_id = :facilityId', {
                itemId: inventoryItem.id,
                facilityId,
              })
              .getOne();

            if (stockBalance) {
              const available = Number(stockBalance.availableQuantity);
              if (available < item.quantity) {
                insufficientItems.push(
                  `${item.drugName}: requested ${item.quantity}, only ${available} available`,
                );
              } else {
                // Reserve: increment reservedQuantity, decrement availableQuantity
                stockBalance.reservedQuantity = Number(stockBalance.reservedQuantity) + item.quantity;
                stockBalance.availableQuantity = available - item.quantity;
                stockBalance.lastMovementAt = new Date();
                await manager.save(stockBalance);
              }
            }
          }
        }

        if (insufficientItems.length > 0) {
          throw new BadRequestException(
            `Insufficient stock: ${insufficientItems.join('; ')}`,
          );
        }
      }

      return savedPrescription;
    });

    // Update encounter status
    if (encounter.status === EncounterStatus.IN_CONSULTATION) {
      encounter.status = EncounterStatus.PENDING_PHARMACY;
      await this.encounterRepository.save(encounter);
    }

    // Notify pharmacy about new prescription
    const savedPrescription = await this.findOne(saved.id);
    this.inAppNotificationService.notify({
      facilityId: encounter.facilityId,
      senderUserId: userId,
      type: InAppNotificationType.PRESCRIPTION_CREATED,
      title: 'New Prescription',
      message: `New prescription (${dto.items?.length || 0} items) for patient ${encounter.patient?.fullName || 'Unknown'}`,
      metadata: { patientId: encounter.patientId, prescriptionId: saved.id, encounterId: dto.encounterId, itemCount: dto.items?.length || 0 },
    });

    // Add provisional billing items so cashier can see estimated cost immediately
    if (encounter.facilityId) {
      for (const item of savedPrescription.items || []) {
        try {
          const inventoryItem = await this.inventoryRepo.findOne({
            where: [
              { code: item.drugCode },
              { name: ILike(`%${item.drugName}%`) },
            ],
          });
          const unitPrice = inventoryItem ? Number(inventoryItem.sellingPrice) : 0;
          if (unitPrice > 0) {
            await this.billingService.addBillableItem({
              encounterId: dto.encounterId,
              patientId: encounter.patientId,
              serviceCode: item.drugCode || `DRUG-${item.id.slice(0, 8)}`,
              description: `${item.drugName} x ${item.quantity} (provisional)`,
              quantity: item.quantity,
              unitPrice,
              chargeType: 'PHARMACY',
              referenceType: 'prescription_item',
              referenceId: item.id,
            }, userId);
          }
        } catch (e) {
          // Non-critical — don't block prescription creation
        }
      }
    }

    return savedPrescription;
  }

  async findAll(query: PrescriptionQueryDto, facilityId?: string): Promise<{ data: Prescription[]; total: number }> {
    const { status, encounterId, patientId, page = 1, limit = 20 } = query;

    const qb = this.prescriptionRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.items', 'items')
      .leftJoinAndSelect('prescription.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('prescription.prescribedBy', 'prescribedBy');

    if (facilityId) {
      qb.andWhere('encounter.facility_id = :facilityId', { facilityId });
    }

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

  async findOne(id: string, facilityId?: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['items', 'encounter', 'encounter.patient', 'prescribedBy'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    if (facilityId && prescription.encounter?.facilityId !== facilityId) {
      throw new NotFoundException('Prescription not found');
    }

    return prescription;
  }

  async getPharmacyQueue(facilityId?: string): Promise<any[]> {
    const qb = this.prescriptionRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.items', 'items')
      .leftJoinAndSelect('prescription.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('prescription.prescribedBy', 'doctor')
      .where('prescription.status IN (:...statuses)', {
        statuses: [PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_DISPENSED],
      });
    if (facilityId) {
      qb.andWhere('encounter.facility_id = :facilityId', { facilityId });
    }
    const prescriptions = await qb
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

      // Deduct stock — convert reservation to actual deduction
      const facilityId = prescription.encounter?.facilityId
        || (prescription.encounter?.patient as any)?.facilityId
        || null;
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
          const qty = itemDto.quantity;
          const currentReserved = Number(stockBalance.reservedQuantity);
          const newTotal = Number(stockBalance.totalQuantity) - qty;

          // Release from reservation and deduct from total
          if (currentReserved >= qty) {
            // Stock was reserved — convert reservation to actual deduction
            stockBalance.reservedQuantity = currentReserved - qty;
            // availableQuantity stays the same (was already decremented on reservation)
          } else {
            // Partial or no reservation (legacy data) — deduct from available
            stockBalance.reservedQuantity = Math.max(0, currentReserved - qty);
            const unreservedDeduction = qty - currentReserved;
            stockBalance.availableQuantity = Math.max(0, Number(stockBalance.availableQuantity) - unreservedDeduction);
          }
          stockBalance.totalQuantity = Math.max(0, newTotal);
          stockBalance.lastMovementAt = new Date();
          await this.stockBalanceRepo.save(stockBalance);
          await this.stockLedgerRepo.save(this.stockLedgerRepo.create({
            itemId: inventoryItem.id,
            movementType: MovementType.SALE,
            quantity: -qty,
            balanceAfter: Math.max(0, newTotal),
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

      // Notify billing/cashier that patient is ready for payment
      this.inAppNotificationService.notify({
        facilityId: prescription.encounter.facilityId,
        senderUserId: userId,
        type: InAppNotificationType.PRESCRIPTION_DISPENSED,
        title: 'Medication Dispensed - Ready for Payment',
        message: `Prescription for patient ${prescription.encounter.patient?.fullName || 'Unknown'} has been dispensed. Pending payment.`,
        metadata: { patientId: prescription.encounter.patientId, prescriptionId: prescription.id, encounterId: prescription.encounter.id },
      });
    }

    // Return updated prescription
    return updated;
  }

  async cancelPrescription(id: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['items', 'encounter'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    if (prescription.status === PrescriptionStatus.DISPENSED) {
      throw new BadRequestException('Cannot cancel a fully dispensed prescription');
    }

    // Release reserved stock for undispensed items
    const facilityId = prescription.encounter?.facilityId;
    if (facilityId) {
      for (const item of prescription.items) {
        const undispensedQty = item.quantity - item.quantityDispensed;
        if (undispensedQty <= 0) continue;

        const inventoryItem = await this.inventoryRepo.findOne({
          where: [
            { code: item.drugCode },
            { name: ILike(`%${item.drugName}%`) },
          ],
        });

        if (inventoryItem) {
          const stockBalance = await this.stockBalanceRepo.findOne({
            where: { itemId: inventoryItem.id, facilityId },
          });

          if (stockBalance && Number(stockBalance.reservedQuantity) > 0) {
            const releaseQty = Math.min(undispensedQty, Number(stockBalance.reservedQuantity));
            stockBalance.reservedQuantity = Number(stockBalance.reservedQuantity) - releaseQty;
            stockBalance.availableQuantity = Number(stockBalance.availableQuantity) + releaseQty;
            stockBalance.lastMovementAt = new Date();
            await this.stockBalanceRepo.save(stockBalance);
          }
        }
      }
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

  async search(query: string, facilityId?: string): Promise<Prescription[]> {
    const q = `%${query}%`;
    const qb = this.prescriptionRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('p.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('p.prescribedBy', 'doctor')
      .where('(p.prescription_number ILIKE :q OR patient.full_name ILIKE :q OR patient.mrn ILIKE :q)', { q });
    if (facilityId) {
      qb.andWhere('encounter.facility_id = :facilityId', { facilityId });
    }
    return qb
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
