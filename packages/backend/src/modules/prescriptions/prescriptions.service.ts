import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription, PrescriptionItem, Dispensation, PrescriptionStatus } from '../../database/entities/prescription.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreatePrescriptionDto, DispenseItemDto, PrescriptionQueryDto } from './prescriptions.dto';

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private itemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Dispensation)
    private dispensationRepository: Repository<Dispensation>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
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

  async getPharmacyQueue(): Promise<Prescription[]> {
    return this.prescriptionRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.items', 'items')
      .leftJoinAndSelect('prescription.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .where('prescription.status IN (:...statuses)', {
        statuses: [PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_DISPENSED],
      })
      .orderBy('prescription.createdAt', 'ASC')
      .getMany();
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

  async cancelPrescription(id: string): Promise<Prescription> {
    const prescription = await this.findOne(id);

    if (prescription.status === PrescriptionStatus.DISPENSED) {
      throw new BadRequestException('Cannot cancel a fully dispensed prescription');
    }

    prescription.status = PrescriptionStatus.CANCELLED;
    return this.prescriptionRepository.save(prescription);
  }
}
