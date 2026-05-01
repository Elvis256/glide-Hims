import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Prescription, PrescriptionItem, PrescriptionStatus } from '../../database/entities/prescription.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Item } from '../../database/entities/inventory.entity';

export interface PrescriptionItemDraft {
  prescriptionItemId: string;
  qtyToDispense: number;
}

export interface CartItemPayload {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  prescriptionItemId: string;
  instructions?: string;
}

export interface FromPrescriptionDraft {
  prescriptionId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  prescriptionNumber: string;
  cartItems: CartItemPayload[];
}

@Injectable()
export class PrescriptionLookupService {
  private readonly logger = new Logger(PrescriptionLookupService.name);

  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private prescriptionItemRepo: Repository<PrescriptionItem>,
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
    private dataSource: DataSource,
  ) {}

  /**
   * C2: Look up a prescription by prescriptionNumber (or short code).
   * Returns full Rx with items + remaining quantities + patient summary.
   */
  async findByCode(code: string, tenantId?: string): Promise<any> {
    const where: any = { prescriptionNumber: code };
    if (tenantId) where.tenantId = tenantId;

    const prescription = await this.prescriptionRepo.findOne({
      where,
      relations: ['items', 'encounter', 'encounter.patient', 'prescribedBy'],
    });

    if (!prescription) {
      throw new NotFoundException(`Prescription with code "${code}" not found`);
    }

    // Map items with remaining quantities
    const items = prescription.items.map((item) => ({
      id: item.id,
      drugCode: item.drugCode,
      drugName: item.drugName,
      dose: item.dose,
      frequency: item.frequency,
      duration: item.duration,
      quantity: item.quantity,
      quantityDispensed: item.quantityDispensed,
      remainingQty: Math.max(0, item.quantity - item.quantityDispensed),
      isDispensed: item.isDispensed,
      instructions: item.instructions,
    }));

    const patient = prescription.encounter?.patient;
    const prescriber = prescription.prescribedBy;

    return {
      id: prescription.id,
      prescriptionNumber: prescription.prescriptionNumber,
      status: prescription.status,
      notes: prescription.notes,
      createdAt: prescription.createdAt,
      patient: patient
        ? {
            id: patient.id,
            mrn: patient.mrn,
            fullName: patient.fullName,
            gender: patient.gender,
            dateOfBirth: patient.dateOfBirth,
            phone: patient.phone,
          }
        : null,
      prescriber: prescriber
        ? {
            id: prescriber.id,
            name: (prescriber as any).name || (prescriber as any).fullName || prescriber.email,
          }
        : null,
      items,
      fullyDispensed: items.every((i) => i.isDispensed || i.remainingQty === 0),
    };
  }

  /**
   * C2: Build a draft cart from selected prescription items.
   * Validates: prescription approved/dispensable, quantities not exceeded.
   * Does NOT create a sale — frontend opens the draft in POS for cashier to confirm.
   */
  async buildCartFromPrescription(
    prescriptionId: string,
    selections: PrescriptionItemDraft[],
    tenantId?: string,
  ): Promise<FromPrescriptionDraft> {
    const where: any = { id: prescriptionId };
    if (tenantId) where.tenantId = tenantId;

    const prescription = await this.prescriptionRepo.findOne({
      where,
      relations: ['items', 'encounter', 'encounter.patient'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    // Validate prescription is in a dispensable state
    const dispensableStatuses: PrescriptionStatus[] = [
      PrescriptionStatus.PENDING,
      PrescriptionStatus.DISPENSING,
      PrescriptionStatus.READY,
      PrescriptionStatus.PARTIALLY_DISPENSED,
    ];
    if (!dispensableStatuses.includes(prescription.status)) {
      throw new BadRequestException(
        `Prescription is not dispensable. Current status: ${prescription.status}`,
      );
    }

    const cartItems: CartItemPayload[] = [];

    for (const sel of selections) {
      const rxItem = prescription.items.find((i) => i.id === sel.prescriptionItemId);
      if (!rxItem) {
        throw new BadRequestException(`Prescription item ${sel.prescriptionItemId} not found`);
      }

      const remaining = Math.max(0, rxItem.quantity - rxItem.quantityDispensed);
      if (rxItem.isDispensed || remaining === 0) {
        throw new BadRequestException(
          `Prescription item "${rxItem.drugName}" has already been fully dispensed`,
        );
      }
      if (sel.qtyToDispense > remaining) {
        throw new BadRequestException(
          `Cannot dispense ${sel.qtyToDispense} of "${rxItem.drugName}" — only ${remaining} remaining`,
        );
      }

      // Look up inventory item by drug code (match against item.code or barcode)
      const inventoryItem = await this.itemRepo.findOne({
        where: tenantId
          ? [
              { code: rxItem.drugCode, tenantId },
              { barcode: rxItem.drugCode, tenantId },
            ]
          : [{ code: rxItem.drugCode }, { barcode: rxItem.drugCode }],
      });

      const price = inventoryItem ? Number(inventoryItem.sellingPrice ?? 0) : 0;
      const unit = inventoryItem ? (inventoryItem.unit || 'unit') : 'unit';

      cartItems.push({
        productId: inventoryItem?.id ?? rxItem.drugCode,
        name: rxItem.drugName,
        price,
        quantity: sel.qtyToDispense,
        unit,
        prescriptionItemId: rxItem.id,
        instructions: rxItem.instructions ?? undefined,
      });
    }

    const patient = prescription.encounter?.patient;

    return {
      prescriptionId: prescription.id,
      patientId: patient?.id ?? '',
      patientName: patient?.fullName ?? '',
      patientMrn: patient?.mrn ?? '',
      prescriptionNumber: prescription.prescriptionNumber,
      cartItems,
    };
  }
}
