import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, DataSource, Brackets } from 'typeorm';
import {
  Prescription,
  PrescriptionItem,
  Dispensation,
  MedicationAdministration,
  PrescriptionStatus,
} from '../../database/entities/prescription.entity';
import { ControlledSubstanceLog } from '../../database/entities/controlled-substance.entity';
import { DrugSchedule } from '../../database/entities/drug-classification.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import {
  Item,
  StockBalance,
  StockLedger,
  MovementType,
} from '../../database/entities/inventory.entity';
import {
  CreatePrescriptionDto,
  DispenseItemDto,
  DispenseBatchDto,
  PrescriptionQueryDto,
  UpdateStatusDto,
  UpdatePrescriptionItemDto,
  AdministerMedicationDto,
  AddWitnessDto,
  DoubleCheckDto,
  NarcoticsRegisterQueryDto,
} from './prescriptions.dto';
import { BillingService } from '../billing/billing.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { QueueManagementService } from '../queue-management/queue-management.service';
import { DrugManagementService } from '../drug-management/drug-management.service';
import { MedicationSafetyService } from '../allergies/medication-safety.service';
import { IdentityGuardService } from '../../common/services/identity-guard.service';

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private itemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Dispensation)
    private dispensationRepository: Repository<Dispensation>,
    @InjectRepository(MedicationAdministration)
    private adminRepository: Repository<MedicationAdministration>,
    @InjectRepository(ControlledSubstanceLog)
    private controlledSubstanceLogRepository: Repository<ControlledSubstanceLog>,
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
    @Inject(forwardRef(() => InAppNotificationsService))
    private inAppNotificationsService: InAppNotificationsService,
    private queueManagementService: QueueManagementService,
    private drugManagementService: DrugManagementService,
    private medicationSafety: MedicationSafetyService,
    private identityGuard: IdentityGuardService,
    private dataSource: DataSource,
  ) {}

  private async generatePrescriptionNumber(tenantId?: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

    const result = await this.dataSource.query(
      `SELECT prescription_number FROM prescriptions 
       WHERE prescription_number LIKE $1 
       AND tenant_id = $2
       ORDER BY prescription_number DESC LIMIT 1 FOR UPDATE`,
      [`RX${datePrefix}%`, tenantId],
    );

    let sequence = 1;
    if (result.length > 0) {
      const lastSeq = parseInt(result[0].prescription_number.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `RX${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  async create(
    dto: CreatePrescriptionDto,
    userId: string,
    tenantId?: string,
  ): Promise<Prescription> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: dto.encounterId, ...(tenantId ? { tenantId } : {}) },
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    // Only allow prescriptions on active encounters
    const activeEncounterStatuses = [
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.RETURN_TO_DOCTOR,
      EncounterStatus.PENDING_LAB,
      EncounterStatus.PENDING_PHARMACY,
      EncounterStatus.ADMITTED,
    ];
    if (!activeEncounterStatuses.includes(encounter.status)) {
      throw new BadRequestException(
        `Cannot create prescription for encounter in '${encounter.status}' status. Encounter must be active (in consultation, admitted, etc.).`,
      );
    }

    // ─── Medication-safety pre-flight (DDI + allergy) ─────────────────────
    // Resolve drug IDs against inventory so DM service can match. Drug not
    // found in inventory falls through (no DDI/allergy check possible) but
    // is still allowed — caller may be prescribing free-text.
    const drugIds: string[] = [];
    const linesLite: {
      drugId?: string;
      drugCode?: string;
      drugName: string;
      dose?: string;
      frequency?: string;
    }[] = [];
    for (const item of dto.items) {
      const inv = await this.inventoryRepo.findOne({
        where: [
          { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
          { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
        ],
      });
      if (inv) {
        drugIds.push(inv.id);
        linesLite.push({
          drugId: inv.id,
          drugCode: item.drugCode,
          drugName: item.drugName,
          dose: item.dose,
          frequency: item.frequency,
        });
      } else {
        linesLite.push({
          drugCode: item.drugCode,
          drugName: item.drugName,
          dose: item.dose,
          frequency: item.frequency,
        });
      }
    }

    const patientIdForSafety: string | undefined = encounter.patientId;
    const safety = await this.medicationSafety.runSafetyChecks({
      patientId: patientIdForSafety,
      drugIds,
      lines: linesLite,
      tenantId,
    });

    if (safety.blocked && !dto.safetyOverride) {
      // Caller must re-submit with safetyOverride { reason } to proceed.
      throw new ConflictException({
        code: 'SAFETY_BLOCKED',
        message:
          safety.blockingAlerts.length > 0
            ? `Medication-safety alert: ${safety.blockingAlerts.length} blocking issue(s). Override required.`
            : `Medication-safety check is degraded (${safety.degradedReasons.join('; ')}). Override required.`,
        alerts: safety.alerts,
        degraded: safety.degraded,
        degradedReasons: safety.degradedReasons,
      });
    }

    const prescriptionNumber = await this.generatePrescriptionNumber(tenantId);

    // Use a transaction with row-level locking to prevent race conditions
    const saved = await this.dataSource.transaction(async (manager) => {
      const prescription = manager.create(Prescription, {
        prescriptionNumber,
        encounterId: dto.encounterId,
        prescribedById: userId,
        notes: dto.notes,
        prescriberSignature: dto.prescriberSignature || undefined,
        prescriberSignedAt: dto.prescriberSignature ? new Date() : undefined,
        items: dto.items.map((item) => manager.create(PrescriptionItem, item)),
        ...(tenantId ? { tenantId } : {}),
      });

      const savedPrescription = await manager.save(prescription);

      // Reserve stock for each item
      const facilityId = encounter.facilityId;
      if (facilityId) {
        const insufficientItems: string[] = [];

        for (const item of dto.items) {
          const inventoryItem = await manager.findOne(Item, {
            where: [
              { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
              { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
            ],
          });

          if (inventoryItem) {
            // Lock the row to prevent concurrent modifications
            const sbQuery = manager
              .createQueryBuilder(StockBalance, 'sb')
              .setLock('pessimistic_write')
              .where('sb.item_id = :itemId AND sb.facility_id = :facilityId', {
                itemId: inventoryItem.id,
                facilityId,
              });
            if (tenantId) {
              sbQuery.andWhere('sb.tenant_id = :tenantId', { tenantId });
            }
            const stockBalance = await sbQuery.getOne();

            if (stockBalance) {
              const available = Number(stockBalance.availableQuantity);
              if (available < item.quantity) {
                insufficientItems.push(
                  `${item.drugName}: requested ${item.quantity}, only ${available} available`,
                );
              } else {
                // Reserve: increment reservedQuantity, decrement availableQuantity
                stockBalance.reservedQuantity =
                  Number(stockBalance.reservedQuantity) + item.quantity;
                stockBalance.availableQuantity = available - item.quantity;
                stockBalance.lastMovementAt = new Date();
                await manager.save(stockBalance);
              }
            }
          }
        }

        if (insufficientItems.length > 0) {
          throw new BadRequestException(`Insufficient stock: ${insufficientItems.join('; ')}`);
        }
      }

      return savedPrescription;
    });

    // Persist safety-override audit row if checks were bypassed.
    if (safety.blocked && dto.safetyOverride) {
      try {
        await this.medicationSafety.recordOverride({
          prescriptionId: saved.id,
          patientId: patientIdForSafety,
          encounterId: dto.encounterId,
          alerts: safety.alerts,
          reason: dto.safetyOverride.reason,
          overriddenById: userId,
          cosignerId: dto.safetyOverride.cosignerId,
          tenantId,
        });
      } catch (err: any) {
        this.logger.error(`Safety-override audit write failed: ${err?.message}`, err?.stack);
      }
    }

    // Update encounter status
    if (encounter.status === EncounterStatus.IN_CONSULTATION) {
      encounter.status = EncounterStatus.PENDING_PHARMACY;
      await this.encounterRepository.save(encounter);
    }

    // Move queue to pharmacy service point
    try {
      await this.queueManagementService.moveToServicePoint(
        dto.encounterId,
        'pharmacy',
        'Prescription created',
        tenantId,
      );
    } catch (err) {
      this.logger.warn(`Queue move to pharmacy failed: ${err?.message}`);
    }

    // Notify pharmacy staff
    try {
      const patient = await this.encounterRepository.findOne({
        where: { id: dto.encounterId, ...(tenantId ? { tenantId } : {}) },
        relations: ['patient'],
      });
      await this.inAppNotificationsService.notifyNewPrescription(
        patient?.patient?.fullName || 'Patient',
        saved.id,
        encounter.facilityId,
      );
    } catch (err) {
      this.logger.warn(`Pharmacy notification failed: ${err?.message}`);
    }

    // Create interim invoice so cashier can see estimated costs immediately
    try {
      const fullRx = await this.findOne(saved.id, tenantId);
      for (const item of fullRx.items) {
        // Look up price from inventory
        const invItem = await this.inventoryRepo.findOne({
          where: [
            { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
            { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
          ],
        });
        let unitPrice = 0;
        if (invItem) {
          unitPrice = Number(invItem.sellingPrice) || 0;
        }
        await this.billingService.addBillableItem(
          {
            encounterId: encounter.id,
            patientId: encounter.patientId,
            serviceCode: item.drugCode || `DRUG-${item.id.slice(0, 8)}`,
            description: `${item.drugName} x ${item.quantity}`,
            quantity: item.quantity,
            unitPrice,
            chargeType: 'pharmacy',
            referenceType: 'prescription_item',
            referenceId: item.id,
          },
          userId,
          tenantId,
        );
      }
    } catch (err) {
      this.logger.warn('Failed to create interim invoice for prescription');
    }

    return this.findOne(saved.id, tenantId);
  }

  async findAll(
    query: PrescriptionQueryDto,
    tenantId?: string,
  ): Promise<{ data: Prescription[]; total: number }> {
    const { status, encounterId, patientId, page = 1, limit = 20 } = query;

    const qb = this.prescriptionRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.items', 'items')
      .leftJoinAndSelect('prescription.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('prescription.prescribedBy', 'prescribedBy');

    if (tenantId) {
      qb.andWhere('prescription.tenant_id = :tenantId', { tenantId });
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

  async findOne(id: string, tenantId?: string): Promise<Prescription> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const prescription = await this.prescriptionRepository.findOne({
      where,
      relations: ['items', 'encounter', 'encounter.patient', 'prescribedBy'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return {
      ...prescription,
      doctor: prescription.prescribedBy,
      doctorId: prescription.prescribedById,
      patient: prescription.encounter?.patient,
      patientId: prescription.encounter?.patientId,
    } as any;
  }

  async findByNumber(prescriptionNumber: string, tenantId?: string): Promise<Prescription> {
    const where: any = { prescriptionNumber };
    if (tenantId) where.tenantId = tenantId;
    const prescription = await this.prescriptionRepository.findOne({
      where,
      relations: ['items', 'encounter', 'encounter.patient', 'prescribedBy'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return {
      ...prescription,
      doctor: prescription.prescribedBy,
      doctorId: prescription.prescribedById,
      patient: prescription.encounter?.patient,
      patientId: prescription.encounter?.patientId,
    } as any;
  }

  async getPharmacyQueue(tenantId?: string): Promise<any[]> {
    const qb = this.prescriptionRepository
      .createQueryBuilder('prescription')
      .leftJoinAndSelect('prescription.items', 'items')
      .leftJoinAndSelect('prescription.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('prescription.prescribedBy', 'doctor')
      .where('prescription.status IN (:...statuses)', {
        statuses: [
          PrescriptionStatus.PENDING,
          PrescriptionStatus.DISPENSING,
          PrescriptionStatus.PARTIALLY_DISPENSED,
        ],
      });

    if (tenantId) {
      qb.andWhere('prescription.tenant_id = :tenantId', { tenantId });
    }

    const prescriptions = await qb.orderBy('prescription.createdAt', 'ASC').getMany();

    // Transform to include patient at top level for frontend compatibility
    return prescriptions.map((p) => ({
      ...p,
      patient: p.encounter?.patient,
      patientId: p.encounter?.patientId,
      doctor: p.prescribedBy,
      doctorId: p.prescribedById,
    }));
  }

  async dispenseItem(
    dto: DispenseItemDto,
    userId: string,
    tenantId?: string,
  ): Promise<Dispensation> {
    const item = await this.itemRepository.findOne({
      where: { id: dto.prescriptionItemId, ...(tenantId ? { tenantId } : {}) },
      relations: ['prescription', 'prescription.encounter'],
    });

    if (!item) {
      throw new NotFoundException('Prescription item not found');
    }

    const remainingQty = item.quantity - item.quantityDispensed;
    if (dto.quantity > remainingQty) {
      throw new BadRequestException(`Cannot dispense more than ${remainingQty} units`);
    }

    // ─── Medication-safety check at dispense time ───────────────────────
    const inv = await this.inventoryRepo.findOne({
      where: [
        { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
        { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
      ],
    });
    if (inv) {
      const patientId: string | undefined = item.prescription?.encounter?.patientId;
      const safety = await this.medicationSafety.runSafetyChecks({
        patientId,
        drugIds: [inv.id],
        lines: [
          {
            drugId: inv.id,
            drugCode: item.drugCode,
            drugName: item.drugName,
            dose: item.dose,
            frequency: item.frequency,
          },
        ],
        tenantId,
      });
      if (safety.blocked) {
        const summary =
          safety.blockingAlerts.length > 0
            ? safety.blockingAlerts
                .map((a) => `${a.kind.toUpperCase()} (${a.severity}): ${a.description}`)
                .join('; ')
            : `Safety check degraded: ${safety.degradedReasons.join('; ')}`;
        throw new BadRequestException(
          `MEDICATION SAFETY BLOCK: ${summary}. Cannot dispense ${item.drugName}. Override at pharmacy POS required.`,
        );
      }
    }
    // ─── End medication-safety check ────────────────────────────────────

    // Server-derived price ONLY: never trust client-supplied unitPrice.
    let resolvedPrice = 0;
    if (inv) {
      resolvedPrice =
        Number(inv.retailPrice) ||
        Number(inv.sellingPrice) ||
        Number(inv.unitCost) ||
        0;
    }
    if (resolvedPrice <= 0) {
      this.logger.warn(
        `dispenseItem price fallback to 0 for ${item.drugName} — no inventory price available`,
      );
    }

    // Create dispensation record
    const dispensation = this.dispensationRepository.create({
      prescriptionId: item.prescriptionId,
      prescriptionItemId: item.id,
      quantity: dto.quantity,
      batchNumber: dto.batchNumber,
      expiryDate: dto.expiryDate,
      unitPrice: resolvedPrice,
      totalPrice: resolvedPrice * dto.quantity,
      dispensedById: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    await this.dispensationRepository.save(dispensation);

    // Update prescription item
    item.quantityDispensed += dto.quantity;
    if (item.quantityDispensed >= item.quantity) {
      item.isDispensed = true;
    }
    await this.itemRepository.save(item);

    // Update prescription status
    await this.updatePrescriptionStatus(item.prescriptionId, tenantId);

    return dispensation;
  }

  private async updatePrescriptionStatus(prescriptionId: string, tenantId?: string): Promise<void> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId, ...(tenantId ? { tenantId } : {}) },
      relations: ['items'],
    });

    if (!prescription) return;

    const allDispensed = prescription.items.every((item) => item.isDispensed);
    const someDispensed = prescription.items.some((item) => item.quantityDispensed > 0);

    if (allDispensed) {
      prescription.status = PrescriptionStatus.DISPENSED;
      if (!prescription.dispensedAt) prescription.dispensedAt = new Date();
    } else if (someDispensed) {
      prescription.status = PrescriptionStatus.PARTIALLY_DISPENSED;
      if (!prescription.dispensedAt) prescription.dispensedAt = new Date();
    }

    await this.prescriptionRepository.save(prescription);
  }

  // Batch dispense all items in a prescription
  async dispenseBatch(
    dto: DispenseBatchDto,
    userId: string,
    tenantId?: string,
  ): Promise<Prescription> {
    return this.dataSource.transaction(async (manager) => {
      const prescriptionRepo = manager.getRepository(Prescription);
      const itemRepo = manager.getRepository(PrescriptionItem);
      const dispensationRepo = manager.getRepository(Dispensation);
      const inventoryRepo = manager.getRepository(Item);
      const stockBalanceRepo = manager.getRepository(StockBalance);
      const stockLedgerRepo = manager.getRepository(StockLedger);

      const prescription = await prescriptionRepo.findOne({
        where: { id: dto.prescriptionId, ...(tenantId ? { tenantId } : {}) },
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

      // === IDENTITY GUARDRAIL ===
      // If the caller submitted a witnessId, validate it server-side before any
      // controlled-substance log can rely on it (assertWitness throws on misuse:
      // self-witness, wrong tenant, inactive user, ineligible role).
      if (dto.witnessId) {
        await this.identityGuard.assertWitness({
          witnessId: dto.witnessId,
          actorUserId: userId,
          tenantId,
          context: 'prescription dispense',
        });
      }
      // === END IDENTITY GUARDRAIL ===

      // === MEDICATION SAFETY CHECKS (centralised + fail-closed) ===

      // Resolve drug IDs for all prescription items
      const drugIds: string[] = [];
      const drugIdMap = new Map<string, string>(); // prescriptionItemId -> inventoryItemId
      const linesLite: {
        drugId?: string;
        drugCode?: string;
        drugName: string;
        dose?: string;
        frequency?: string;
      }[] = [];
      for (const item of prescription.items) {
        const inventoryItem = await inventoryRepo.findOne({
          where: [
            { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
            { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
          ],
        });
        if (inventoryItem) {
          drugIds.push(inventoryItem.id);
          drugIdMap.set(item.id, inventoryItem.id);
          linesLite.push({
            drugId: inventoryItem.id,
            drugCode: item.drugCode,
            drugName: item.drugName,
            dose: item.dose,
            frequency: item.frequency,
          });
        } else {
          linesLite.push({
            drugCode: item.drugCode,
            drugName: item.drugName,
            dose: item.dose,
            frequency: item.frequency,
          });
        }
      }

      const patientIdForSafety: string | undefined = prescription.encounter?.patientId;
      const safety = await this.medicationSafety.runSafetyChecks({
        patientId: patientIdForSafety,
        drugIds,
        lines: linesLite,
        tenantId,
      });

      if (safety.blocked) {
        const summary =
          safety.blockingAlerts.length > 0
            ? safety.blockingAlerts
                .map((a) => `${a.kind.toUpperCase()} (${a.severity}): ${a.description}`)
                .join('; ')
            : `Safety check degraded: ${safety.degradedReasons.join('; ')}`;
        // Fail-closed: dispense is refused. An override at dispense time
        // requires going through pharmacy POS override flow (recordInteractionOverride),
        // not this path.
        throw new BadRequestException(
          `MEDICATION SAFETY BLOCK for Rx ${prescription.prescriptionNumber}: ${summary}. Override at pharmacy POS required to proceed.`,
        );
      }

      // Non-blocking moderate alerts → log only.
      for (const a of safety.alerts.filter((x) => !safety.blockingAlerts.includes(x))) {
        this.logger.warn(
          `Rx ${prescription.prescriptionNumber} ${a.kind} (${a.severity}): ${a.description}`,
        );
      }
      // === END MEDICATION SAFETY CHECKS ===

      // Record dispensing start timestamp
      if (!prescription.dispensingStartedAt) {
        prescription.dispensingStartedAt = new Date();
        if (dto.dispenserSignature) {
          prescription.dispenserSignature = dto.dispenserSignature;
          prescription.dispenserSignedAt = new Date();
        }
        await this.prescriptionRepository.save(prescription);
      } else if (dto.dispenserSignature && !prescription.dispenserSignature) {
        prescription.dispenserSignature = dto.dispenserSignature;
        prescription.dispenserSignedAt = new Date();
        await this.prescriptionRepository.save(prescription);
      }

      // Process each item
      for (const itemDto of dto.items) {
        const item = prescription.items.find((i) => i.id === itemDto.prescriptionItemId);
        if (!item) {
          throw new BadRequestException(
            `Prescription item ${itemDto.prescriptionItemId} not found`,
          );
        }

        const remainingQty = item.quantity - item.quantityDispensed;
        if (itemDto.quantity > remainingQty) {
          throw new BadRequestException(
            'Requested quantity exceeds the remaining dispensable amount for this item',
          );
        }

        // Block dispensing of expired stock — validate both client-provided and DB expiry date
        if (itemDto.expiryDate && new Date(itemDto.expiryDate) < new Date()) {
          throw new BadRequestException(
            `Cannot dispense expired batch for ${item.drugName}. Batch expiry: ${itemDto.expiryDate}. Select a valid batch.`,
          );
        }
        // Also validate expiry from database to prevent client tampering
        if (itemDto.batchNumber && drugIdMap.has(item.id)) {
          const dbBatch = await manager.query(
            `SELECT expiry_date FROM batch_stock_balances 
             WHERE item_id = $1 AND batch_number = $2 AND deleted_at IS NULL AND tenant_id = $3 LIMIT 1`,
            [drugIdMap.get(item.id), itemDto.batchNumber, tenantId],
          );
          if (dbBatch?.length > 0 && new Date(dbBatch[0].expiry_date) < new Date()) {
            throw new BadRequestException(
              `Cannot dispense expired batch ${itemDto.batchNumber} for ${item.drugName}. Database records show this batch expired on ${new Date(dbBatch[0].expiry_date).toISOString().slice(0, 10)}.`,
            );
          }
        }

        // FEFO enforcement: ensure earliest-expiring batch is used first
        // Use the actual expiry date from the database, not the client-provided value
        if (itemDto.batchNumber && drugIdMap.has(item.id)) {
          const selectedBatch = await manager.query(
            `SELECT expiry_date FROM batch_stock_balances 
             WHERE item_id = $1 AND batch_number = $2 AND deleted_at IS NULL LIMIT 1`,
            [drugIdMap.get(item.id), itemDto.batchNumber],
          );
          const selectedBatchExpiry =
            selectedBatch?.length > 0 ? selectedBatch[0].expiry_date : '9999-12-31';

          const earlierBatches = await manager.query(
            `SELECT batch_number, expiry_date FROM batch_stock_balances 
             WHERE item_id = $1 AND facility_id = $2 AND quantity > 0 AND status = 'active'
               AND expiry_date < $3 AND deleted_at IS NULL AND batch_number != $4
             ORDER BY expiry_date ASC LIMIT 1`,
            [
              drugIdMap.get(item.id),
              prescription.encounter?.facilityId,
              selectedBatchExpiry,
              itemDto.batchNumber,
            ],
          );
          if (earlierBatches?.length > 0) {
            throw new BadRequestException(
              `FEFO violation: Batch ${earlierBatches[0].batch_number} (expires ${new Date(earlierBatches[0].expiry_date).toISOString().slice(0, 10)}) must be dispensed before batch ${itemDto.batchNumber}. First-Expiry-First-Out (FEFO) policy applies.`,
            );
          }
        }

        // Dose limit validation
        const drugInventoryItem = drugIdMap.has(item.id)
          ? await inventoryRepo.findOne({ where: { id: drugIdMap.get(item.id) } })
          : null;
        if (drugInventoryItem) {
          const classification = await manager.query(
            `SELECT max_single_dose, max_daily_dose, dose_unit FROM drug_classifications WHERE item_id = $1 AND deleted_at IS NULL AND tenant_id = $2 LIMIT 1`,
            [drugInventoryItem.id, tenantId],
          );
          if (classification?.length > 0) {
            const { max_single_dose, max_daily_dose, dose_unit } = classification[0];
            if (max_single_dose && itemDto.quantity > max_single_dose) {
              throw new BadRequestException(
                `Dose limit exceeded for ${item.drugName}: requested ${itemDto.quantity} ${dose_unit || 'units'}, max single dose is ${max_single_dose} ${dose_unit || 'units'}`,
              );
            }
            if (max_daily_dose) {
              const totalDispensedToday = item.quantityDispensed + itemDto.quantity;
              if (totalDispensedToday > max_daily_dose) {
                throw new BadRequestException(
                  `Daily dose limit exceeded for ${item.drugName}: total would be ${totalDispensedToday} ${dose_unit || 'units'}, max daily dose is ${max_daily_dose} ${dose_unit || 'units'}`,
                );
              }
            }
          }
        }

        // Create dispensation record
        // Server-derived price ONLY: never trust client-supplied unitPrice.
        // Resolve from inventory: retail → selling → unit cost → 0 (with warning).
        let resolvedPrice = 0;
        const invItemId = drugIdMap.get(item.id);
        if (invItemId) {
          const invItem = await inventoryRepo.findOne({ where: { id: invItemId } });
          if (invItem) {
            resolvedPrice =
              Number(invItem.retailPrice) ||
              Number(invItem.sellingPrice) ||
              Number(invItem.unitCost) ||
              0;
          }
        }
        if (resolvedPrice <= 0) {
          this.logger.warn(
            `Dispense price fallback to 0 for ${item.drugName} (Rx ${prescription.prescriptionNumber}) — no inventory price available`,
          );
        }

        const dispensation = dispensationRepo.create({
          prescriptionId: prescription.id,
          prescriptionItemId: item.id,
          quantity: itemDto.quantity,
          unitPrice: resolvedPrice,
          totalPrice: resolvedPrice * itemDto.quantity,
          batchNumber: itemDto.batchNumber,
          expiryDate: itemDto.expiryDate ? new Date(itemDto.expiryDate) : undefined,
          dispensedById: userId,
          dispensedAt: new Date(),
          ...(tenantId ? { tenantId } : {}),
        });
        await dispensationRepo.save(dispensation);

        // Update prescription item
        item.quantityDispensed += itemDto.quantity;
        if (item.quantityDispensed >= item.quantity) {
          item.isDispensed = true;
        }
        await itemRepo.save(item);

        // Update invoice — update existing interim item or add new one
        let billingSuccess = true;
        let billingError: string | null = null;

        if (prescription.encounter) {
          try {
            // Try to update existing interim invoice item (created at prescription time)
            const updated = await this.billingService.updateBillableItem({
              referenceType: 'prescription_item',
              referenceId: item.id,
              description: `${item.drugName} x ${itemDto.quantity}`,
              quantity: itemDto.quantity,
              unitPrice: resolvedPrice,
            });
            if (!updated) {
              // No existing item — add new one
              await this.billingService.addBillableItem(
                {
                  encounterId: prescription.encounter.id,
                  patientId: prescription.encounter.patientId,
                  serviceCode: item.drugCode || `DRUG-${item.id.slice(0, 8)}`,
                  description: `${item.drugName} x ${itemDto.quantity}`,
                  quantity: itemDto.quantity,
                  unitPrice: resolvedPrice,
                  chargeType: 'pharmacy',
                  referenceType: 'prescription_item',
                  referenceId: item.id,
                },
                userId,
                tenantId,
              );
            }
          } catch (err) {
            billingSuccess = false;
            billingError = err.message;
            this.logger.error(`Failed to add pharmacy item to invoice: ${err.message}`);
          }
        }
        if (!billingSuccess) {
          this.logger.warn('Dispensation billing failed');
        }

        // Deduct stock — convert reservation to actual deduction
        const facilityId =
          prescription.encounter?.facilityId ||
          (prescription.encounter?.patient as any)?.facilityId ||
          null;
        const inventoryItem = await inventoryRepo.findOne({
          where: [
            { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
            { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
          ],
        });
        if (inventoryItem && facilityId) {
          const stockBalance = await stockBalanceRepo.findOne({
            where: { itemId: inventoryItem.id, facilityId, ...(tenantId ? { tenantId } : {}) },
            lock: { mode: 'pessimistic_write' },
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
              stockBalance.availableQuantity = Math.max(
                0,
                Number(stockBalance.availableQuantity) - unreservedDeduction,
              );
            }
            stockBalance.totalQuantity = Math.max(0, newTotal);
            stockBalance.lastMovementAt = new Date();
            await stockBalanceRepo.save(stockBalance);
            await stockLedgerRepo.save(
              stockLedgerRepo.create({
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
                ...(tenantId ? { tenantId } : {}),
              }),
            );
          }
        }
      }

      // Auto-create controlled substance log for Schedule I/II items
      const controlledLogRepo = manager.getRepository(ControlledSubstanceLog);
      for (const itemDto of dto.items) {
        const item = prescription.items.find((i) => i.id === itemDto.prescriptionItemId);
        if (!item) continue;

        // Look up drug classification to check schedule
        const inventoryItem = await inventoryRepo.findOne({
          where: [
            { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
            { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
          ],
        });

        if (inventoryItem) {
          const classification = await manager.query(
            `SELECT schedule FROM drug_classifications WHERE item_id = $1 AND deleted_at IS NULL AND tenant_id = $2 LIMIT 1`,
            [inventoryItem.id, tenantId],
          );

          if (classification?.length > 0) {
            const schedule = classification[0].schedule as DrugSchedule;
            const isControlled = [
              DrugSchedule.SCHEDULE_I,
              DrugSchedule.SCHEDULE_II,
              DrugSchedule.SCHEDULE_III,
              DrugSchedule.SCHEDULE_IV,
              DrugSchedule.SCHEDULE_V,
            ].includes(schedule);
            if (isControlled) {
              // Require witness for Schedule I/II
              if (
                (schedule === DrugSchedule.SCHEDULE_I || schedule === DrugSchedule.SCHEDULE_II) &&
                !dto.witnessId
              ) {
                throw new BadRequestException(
                  `Controlled substance (${schedule}) ${item.drugName} requires a witness for dispensation. Provide witnessId.`,
                );
              }

              // Always log controlled substance dispensations — find the dispensation just created in this transaction
              const dispensation = await dispensationRepo.findOne({
                where: { prescriptionItemId: item.id, dispensedById: userId },
                order: { dispensedAt: 'DESC' },
              });

              if (!dispensation) {
                throw new BadRequestException(
                  `Controlled substance logging failed for ${item.drugName}: dispensation record not found. Rolling back dispensation.`,
                );
              }

              const facilityId = prescription.encounter?.facilityId || null;
              // Get running balance for this drug at this facility
              const lastLog = await controlledLogRepo.findOne({
                where: {
                  prescriptionItemId: item.id,
                  ...(facilityId ? { facilityId } : {}),
                  ...(tenantId ? { tenantId } : {}),
                },
                order: { createdAt: 'DESC' },
              });
              const previousBalance = lastLog ? Number(lastLog.runningBalance) : 0;

              await controlledLogRepo.save(
                controlledLogRepo.create({
                  prescriptionItemId: item.id,
                  dispensationId: dispensation.id,
                  drugSchedule: schedule,
                  quantityDispensed: itemDto.quantity,
                  runningBalance: previousBalance - itemDto.quantity,
                  dispensedById: userId,
                  facilityId: facilityId || undefined,
                  ...(tenantId ? { tenantId } : {}),
                }),
              );
            }
          }
        }
      }

      // Update prescription status
      await this.updatePrescriptionStatus(prescription.id, tenantId);

      // Check if prescription is fully dispensed, update encounter status
      const updatedRx = await this.findOne(prescription.id, tenantId);
      if (updatedRx.status === PrescriptionStatus.DISPENSED && prescription.encounter) {
        // Move encounter to pending payment
        await manager
          .getRepository(Encounter)
          .update({ id: prescription.encounter.id }, { status: EncounterStatus.PENDING_PAYMENT });

        // Notify billing/cashier (non-critical side effect)
        try {
          const patientName = prescription.encounter?.patient?.fullName || 'Patient';
          await this.inAppNotificationsService.notifyPrescriptionDispensed(
            patientName,
            prescription.id,
            prescription.encounter?.facilityId,
          );
        } catch (err) {
          this.logger.warn(`Dispensation notification failed: ${err?.message}`);
        }
      }

      // Return updated prescription
      return updatedRx;
    });
  }

  async cancelPrescription(id: string, tenantId?: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
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
            { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
            { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
          ],
        });

        if (inventoryItem) {
          const stockBalance = await this.stockBalanceRepo.findOne({
            where: { itemId: inventoryItem.id, facilityId, ...(tenantId ? { tenantId } : {}) },
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

  async updateStatus(id: string, dto: UpdateStatusDto, tenantId?: string): Promise<Prescription> {
    const prescription = await this.findOne(id, tenantId);

    // State transition validation
    const VALID_TRANSITIONS: Record<string, string[]> = {
      pending: ['dispensing', 'cancelled'],
      dispensing: ['ready', 'partially_dispensed', 'cancelled'],
      ready: ['collected', 'cancelled'],
      partially_dispensed: ['dispensing', 'ready', 'cancelled'],
      dispensed: ['collected'],
      collected: [],
      cancelled: [],
    };

    const currentStatus = prescription.status;
    const allowedNextStatuses = VALID_TRANSITIONS[currentStatus];

    if (!allowedNextStatuses || allowedNextStatuses.length === 0) {
      throw new BadRequestException(
        `Cannot update prescription in '${currentStatus}' status — it is a terminal state.`,
      );
    }

    if (!allowedNextStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${dto.status}'. Allowed transitions: ${allowedNextStatuses.join(', ')}`,
      );
    }

    const allowed: Record<string, PrescriptionStatus> = {
      pending: PrescriptionStatus.PENDING,
      dispensing: PrescriptionStatus.DISPENSING,
      ready: PrescriptionStatus.READY,
      collected: PrescriptionStatus.COLLECTED,
      cancelled: PrescriptionStatus.CANCELLED,
      partially_dispensed: PrescriptionStatus.PARTIALLY_DISPENSED,
    };
    if (!allowed[dto.status]) {
      throw new BadRequestException(`Invalid status: ${dto.status}`);
    }
    prescription.status = allowed[dto.status];
    if (dto.notes) prescription.notes = dto.notes;

    // Record lifecycle timestamps
    if (dto.status === 'dispensing' && !prescription.dispensingStartedAt) {
      prescription.dispensingStartedAt = new Date();
    }
    if (dto.status === 'ready' && !prescription.readyAt) {
      prescription.readyAt = new Date();
    }
    if (dto.status === 'collected' && !prescription.collectedAt) {
      prescription.collectedAt = new Date();
    }

    return this.prescriptionRepository.save(prescription);
  }

  /** Update a prescription item (pharmacist edits before dispensing) */
  async updateItem(
    itemId: string,
    dto: UpdatePrescriptionItemDto,
    tenantId?: string,
  ): Promise<PrescriptionItem> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId, ...(tenantId ? { tenantId } : {}) },
      relations: ['prescription', 'prescription.encounter'],
    });
    if (!item) throw new NotFoundException('Prescription item not found');
    if (item.isDispensed) throw new BadRequestException('Cannot edit a dispensed item');

    const oldQuantity = item.quantity;

    // Update fields
    if (dto.drugName !== undefined) item.drugName = dto.drugName;
    if (dto.drugCode !== undefined) item.drugCode = dto.drugCode;
    if (dto.dose !== undefined) item.dose = dto.dose;
    if (dto.frequency !== undefined) item.frequency = dto.frequency;
    if (dto.duration !== undefined) item.duration = dto.duration;
    if (dto.instructions !== undefined) item.instructions = dto.instructions;
    if (dto.quantity !== undefined && dto.quantity !== oldQuantity) {
      // Adjust stock reservation
      const facilityId = item.prescription?.encounter?.facilityId;
      if (facilityId) {
        const invItem = await this.inventoryRepo.findOne({
          where: [
            { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
            { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
          ],
        });
        if (invItem) {
          const sb = await this.stockBalanceRepo.findOne({
            where: { itemId: invItem.id, facilityId, ...(tenantId ? { tenantId } : {}) },
          });
          if (sb) {
            const diff = dto.quantity - oldQuantity;
            if (diff > 0 && Number(sb.availableQuantity) < diff) {
              throw new BadRequestException(
                `Insufficient stock to increase quantity (available: ${sb.availableQuantity})`,
              );
            }
            sb.reservedQuantity = Math.max(0, Number(sb.reservedQuantity) + diff);
            sb.availableQuantity = Math.max(0, Number(sb.availableQuantity) - diff);
            sb.lastMovementAt = new Date();
            await this.stockBalanceRepo.save(sb);
          }
        }
      }
      item.quantity = dto.quantity;
    }

    const saved = await this.itemRepository.save(item);

    // Update interim invoice item if exists
    try {
      const unitPrice = dto.unitPrice !== undefined ? dto.unitPrice : undefined;
      await this.billingService.updateBillableItem({
        referenceType: 'prescription_item',
        referenceId: item.id,
        description: `${item.drugName} x ${item.quantity}`,
        quantity: item.quantity,
        unitPrice,
      });
    } catch (err) {
      this.logger.warn(
        `Billing item update failed for prescription item ${item.id}: ${err?.message}`,
      );
    }

    return saved;
  }

  /** Remove a prescription item (pharmacist removes before dispensing) */
  async removeItem(
    prescriptionId: string,
    itemId: string,
    tenantId?: string,
  ): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId, ...(tenantId ? { tenantId } : {}) },
      relations: ['items', 'encounter'],
    });
    if (!prescription) throw new NotFoundException('Prescription not found');
    if (prescription.status === PrescriptionStatus.DISPENSED) {
      throw new BadRequestException('Cannot remove items from a dispensed prescription');
    }

    const item = prescription.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Item not found in this prescription');
    if (item.isDispensed) throw new BadRequestException('Cannot remove a dispensed item');

    // Release stock reservation
    const facilityId = prescription.encounter?.facilityId;
    if (facilityId) {
      const undispensedQty = item.quantity - item.quantityDispensed;
      if (undispensedQty > 0) {
        const invItem = await this.inventoryRepo.findOne({
          where: [
            { code: item.drugCode, ...(tenantId ? { tenantId } : {}) },
            { name: ILike(`%${item.drugName}%`), ...(tenantId ? { tenantId } : {}) },
          ],
        });
        if (invItem) {
          const sb = await this.stockBalanceRepo.findOne({
            where: { itemId: invItem.id, facilityId, ...(tenantId ? { tenantId } : {}) },
          });
          if (sb && Number(sb.reservedQuantity) > 0) {
            const releaseQty = Math.min(undispensedQty, Number(sb.reservedQuantity));
            sb.reservedQuantity = Number(sb.reservedQuantity) - releaseQty;
            sb.availableQuantity = Number(sb.availableQuantity) + releaseQty;
            sb.lastMovementAt = new Date();
            await this.stockBalanceRepo.save(sb);
          }
        }
      }
    }

    // Remove from invoice
    try {
      await this.billingService.removeBillableItem('prescription_item', item.id);
    } catch (err) {
      this.logger.warn(
        `Billing item removal failed for prescription item ${item.id}: ${err?.message}`,
      );
    }

    // Soft-delete the item (mark as removed)
    await this.itemRepository.remove(item);

    // If no items left, cancel the prescription
    const remaining = prescription.items.filter((i) => i.id !== itemId);
    if (remaining.length === 0) {
      prescription.status = PrescriptionStatus.CANCELLED;
      await this.prescriptionRepository.save(prescription);
    }

    return this.findOne(prescriptionId, tenantId);
  }

  async search(query: string, tenantId?: string): Promise<Prescription[]> {
    const q = `%${query}%`;
    const qb = this.prescriptionRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('p.encounter', 'encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('p.prescribedBy', 'doctor');

    qb.where(
      new Brackets((sub) => {
        sub
          .where('p.prescription_number ILIKE :q', { q })
          .orWhere('patient.full_name ILIKE :q', { q })
          .orWhere('patient.mrn ILIKE :q', { q });
      }),
    );

    // Exclude fully dispensed and cancelled prescriptions
    qb.andWhere('p.status NOT IN (:...excludedStatuses)', {
      excludedStatuses: [PrescriptionStatus.DISPENSED, PrescriptionStatus.CANCELLED],
    });

    if (tenantId) {
      qb.andWhere('p.tenant_id = :tenantId', { tenantId });
    }

    return qb
      .orderBy('p.createdAt', 'DESC')
      .take(20)
      .getMany()
      .then((rows) =>
        rows.map((p) => ({
          ...p,
          patient: p.encounter?.patient,
          doctor: p.prescribedBy,
        })),
      ) as unknown as Prescription[];
  }

  async administerMedication(
    prescriptionItemId: string,
    dto: AdministerMedicationDto,
    userId: string,
    tenantId?: string,
  ): Promise<MedicationAdministration> {
    const item = await this.itemRepository.findOne({
      where: { id: prescriptionItemId, ...(tenantId ? { tenantId } : {}) },
      relations: ['prescription'],
    });
    if (!item) throw new NotFoundException('Prescription item not found');

    // ─── Timestamp validation ───────────────────────────────────────────
    const now = new Date();
    const administeredAt = dto.administeredAt ? new Date(dto.administeredAt) : now;
    if (isNaN(administeredAt.getTime())) {
      throw new BadRequestException('Invalid administeredAt timestamp');
    }
    if (administeredAt > now) {
      throw new BadRequestException('Cannot record medication administration in the future');
    }
    const MAX_BACKDATE_MS = 24 * 60 * 60 * 1000; // 24 hours
    if (now.getTime() - administeredAt.getTime() > MAX_BACKDATE_MS) {
      throw new BadRequestException(
        'Cannot backdate medication administration more than 24 hours. Contact a supervisor for corrections.',
      );
    }
    // ─── End timestamp validation ───────────────────────────────────────

    if (dto.witnessId) {
      await this.identityGuard.assertWitness({
        witnessId: dto.witnessId,
        actorUserId: userId,
        tenantId,
        context: 'medication administration',
      });
    }

    const record = this.adminRepository.create({
      prescriptionId: item.prescriptionId,
      prescriptionItemId: item.id,
      administeredById: userId,
      witnessId: dto.witnessId,
      administeredAt,
      doseGiven: dto.doseGiven,
      routeOfAdministration: dto.routeOfAdministration,
      notes: dto.notes,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.adminRepository.save(record);
  }

  async getAdministrationHistory(
    prescriptionId: string,
    tenantId?: string,
  ): Promise<MedicationAdministration[]> {
    return this.adminRepository.find({
      where: { prescriptionId, ...(tenantId ? { tenantId } : {}) },
      relations: ['prescriptionItem', 'administeredBy'],
      order: { administeredAt: 'DESC' },
    });
  }

  async getTimingAnalytics(dateFrom?: string, dateTo?: string, tenantId?: string) {
    // Defence-in-depth: cap the analytics window even if a caller bypasses
    // the controller-level DTO. Without this an attacker (or a UI bug) can
    // request a multi-decade window and force getMany() to load every
    // prescription row into memory for in-process aggregation below.
    const MAX_RANGE_DAYS = 366; // one year + leap day
    let from: Date | undefined;
    let to: Date | undefined;
    if (dateFrom) {
      from = new Date(dateFrom);
      if (isNaN(from.getTime())) throw new BadRequestException('Invalid dateFrom');
    }
    if (dateTo) {
      to = new Date(dateTo);
      if (isNaN(to.getTime())) throw new BadRequestException('Invalid dateTo');
      to.setDate(to.getDate() + 1);
    }
    if (from && to) {
      const days = (to.getTime() - from.getTime()) / 86_400_000;
      if (days < 0) throw new BadRequestException('dateTo must be after dateFrom');
      if (days > MAX_RANGE_DAYS) {
        throw new BadRequestException(`Date range exceeds maximum of ${MAX_RANGE_DAYS} days`);
      }
    }

    const qb = this.prescriptionRepository
      .createQueryBuilder('p')
      .where('p.dispensedAt IS NOT NULL')
      .andWhere('p.dispensingStartedAt IS NOT NULL');

    if (tenantId) qb.andWhere('p.tenant_id = :tenantId', { tenantId });
    if (from) qb.andWhere('p.createdAt >= :dateFrom', { dateFrom: from });
    if (to) qb.andWhere('p.createdAt < :dateTo', { dateTo: to });

    const prescriptions = await qb.getMany();

    if (prescriptions.length === 0) {
      return {
        avgWaitMinutes: 0,
        avgDispenseMinutes: 0,
        avgTotalMinutes: 0,
        count: 0,
        distribution: [],
      };
    }

    let totalWait = 0,
      totalDispense = 0,
      totalEnd2End = 0;
    const distribution = { under5: 0, under15: 0, under30: 0, under60: 0, over60: 0 };

    for (const p of prescriptions) {
      const waitMs = p.dispensingStartedAt.getTime() - p.createdAt.getTime();
      const dispenseMs = p.dispensedAt.getTime() - p.dispensingStartedAt.getTime();
      const totalMs = (p.collectedAt || p.dispensedAt).getTime() - p.createdAt.getTime();

      totalWait += waitMs;
      totalDispense += dispenseMs;
      totalEnd2End += totalMs;

      const totalMin = totalMs / 60000;
      if (totalMin < 5) distribution.under5++;
      else if (totalMin < 15) distribution.under15++;
      else if (totalMin < 30) distribution.under30++;
      else if (totalMin < 60) distribution.under60++;
      else distribution.over60++;
    }

    const count = prescriptions.length;
    return {
      avgWaitMinutes: Math.round(totalWait / count / 60000),
      avgDispenseMinutes: Math.round(totalDispense / count / 60000),
      avgTotalMinutes: Math.round(totalEnd2End / count / 60000),
      count,
      distribution,
    };
  }

  // ─── Feature 1: E-Prescription Digital Signatures ───

  async verifySignature(prescriptionId: string, tenantId?: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }
    if (!prescription.prescriberSignature) {
      throw new BadRequestException('No prescriber signature to verify');
    }
    prescription.signatureVerified = true;
    return this.prescriptionRepository.save(prescription);
  }

  // ─── Feature 2: Controlled Substance Enhancement ───

  async logControlledDispense(data: {
    prescriptionItemId: string;
    dispensationId: string;
    drugSchedule: DrugSchedule;
    quantityDispensed: number;
    dispensedById: string;
    facilityId?: string;
    notes?: string;
    tenantId?: string;
  }): Promise<ControlledSubstanceLog> {
    // Calculate running balance
    const lastLog = await this.controlledSubstanceLogRepository.findOne({
      where: {
        prescriptionItemId: data.prescriptionItemId,
        ...(data.facilityId ? { facilityId: data.facilityId } : {}),
        ...(data.tenantId ? { tenantId: data.tenantId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
    const previousBalance = lastLog ? Number(lastLog.runningBalance) : 0;

    const log = this.controlledSubstanceLogRepository.create({
      prescriptionItemId: data.prescriptionItemId,
      dispensationId: data.dispensationId,
      drugSchedule: data.drugSchedule,
      quantityDispensed: data.quantityDispensed,
      runningBalance: previousBalance - data.quantityDispensed,
      dispensedById: data.dispensedById,
      facilityId: data.facilityId,
      notes: data.notes,
      ...(data.tenantId ? { tenantId: data.tenantId } : {}),
    });

    return this.controlledSubstanceLogRepository.save(log);
  }

  async addWitness(
    logId: string,
    dto: AddWitnessDto,
    actorUserId: string,
    tenantId?: string,
  ): Promise<ControlledSubstanceLog> {
    const log = await this.controlledSubstanceLogRepository.findOne({
      where: { id: logId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!log) {
      throw new NotFoundException('Controlled substance log entry not found');
    }
    if (log.witnessId) {
      throw new BadRequestException('Witness already recorded for this entry');
    }
    if (log.dispensedById && dto.witnessId === log.dispensedById) {
      throw new BadRequestException('Witness must differ from the dispenser');
    }
    await this.identityGuard.assertWitness({
      witnessId: dto.witnessId,
      actorUserId: log.dispensedById || actorUserId,
      tenantId,
      context: 'controlled-substance witness',
    });
    log.witnessId = dto.witnessId;
    log.witnessSignature = dto.witnessSignature ?? log.witnessSignature;
    log.witnessedAt = new Date();
    return this.controlledSubstanceLogRepository.save(log);
  }

  async doubleCheck(
    logId: string,
    dto: DoubleCheckDto,
    actorUserId: string,
    tenantId?: string,
  ): Promise<ControlledSubstanceLog> {
    const log = await this.controlledSubstanceLogRepository.findOne({
      where: { id: logId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!log) {
      throw new NotFoundException('Controlled substance log entry not found');
    }
    if (log.doubleCheckById) {
      throw new BadRequestException('Double-check already recorded for this entry');
    }
    if (log.dispensedById === dto.checkerId) {
      throw new BadRequestException(
        'Double-check cannot be performed by the same person who dispensed',
      );
    }
    await this.identityGuard.assertWitness({
      witnessId: dto.checkerId,
      actorUserId: log.dispensedById || actorUserId,
      tenantId,
      context: 'controlled-substance double-check',
    });
    log.doubleCheckById = dto.checkerId;
    log.doubleCheckedAt = new Date();
    return this.controlledSubstanceLogRepository.save(log);
  }

  async getNarcoticsRegister(
    itemId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<ControlledSubstanceLog[]> {
    return this.controlledSubstanceLogRepository.find({
      where: {
        prescriptionItemId: itemId,
        facilityId,
        ...(tenantId ? { tenantId } : {}),
      },
      relations: ['prescriptionItem', 'dispensation', 'dispensedBy', 'witness', 'doubleCheckBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getControlledSubstanceRegister(
    query: NarcoticsRegisterQueryDto,
    tenantId?: string,
  ): Promise<{ data: ControlledSubstanceLog[]; total: number }> {
    const { facilityId, drugSchedule, dateFrom, dateTo, page = 1, limit = 50 } = query;

    const qb = this.controlledSubstanceLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.prescriptionItem', 'item')
      .leftJoinAndSelect('log.dispensation', 'dispensation')
      .leftJoinAndSelect('log.dispensedBy', 'dispensedBy')
      .leftJoinAndSelect('log.witness', 'witness')
      .leftJoinAndSelect('log.doubleCheckBy', 'doubleCheckBy');

    if (tenantId) {
      qb.andWhere('log.tenant_id = :tenantId', { tenantId });
    }
    if (facilityId) {
      qb.andWhere('log.facility_id = :facilityId', { facilityId });
    }
    if (drugSchedule) {
      qb.andWhere('log.drug_schedule = :drugSchedule', { drugSchedule });
    }
    if (dateFrom) {
      qb.andWhere('log.created_at >= :dateFrom', { dateFrom: new Date(dateFrom) });
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      qb.andWhere('log.created_at < :dateTo', { dateTo: end });
    }

    const total = await qb.getCount();
    const data = await qb
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total };
  }
}
