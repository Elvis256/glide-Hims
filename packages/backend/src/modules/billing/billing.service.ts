import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource, EntityManager } from 'typeorm';
import {
  Invoice,
  InvoiceItem,
  Payment,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  PaymentType,
} from '../../database/entities/invoice.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { Queue, QueueStatus, ServicePoint } from '../../database/entities/queue.entity';
import { Facility } from '../../database/entities/facility.entity';
import { ChargeType } from '../../database/entities/invoice.entity';
import {
  CreateInvoiceDto,
  AddInvoiceItemDto,
  CreatePaymentDto,
  InvoiceQueryDto,
  PreviewInvoiceDto,
} from './billing.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { FinanceService } from '../finance/finance.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { CoverageCheckService } from '../insurance/coverage-check.service';
import { ServicesService } from '../services/services.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { PreAuthorization, PreAuthStatus } from '../../database/entities/pre-authorization.entity';
import { InsurancePolicy, PolicyStatus } from '../../database/entities/insurance-policy.entity';
import { MembershipScheme, PatientMembership } from '../../database/entities/membership.entity';
import { multiply, add, subtract, divide, roundCurrency } from '../../common/utils/currency';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private itemRepository: Repository<InvoiceItem>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
    private inAppNotifications: InAppNotificationsService,
    private settingsService: SystemSettingsService,
    private financeService: FinanceService,
    private pricingEngineService: PricingEngineService,
    private coverageCheckService: CoverageCheckService,
    private servicesService: ServicesService,
    private inventoryService: InventoryService,
    private auditLogService: AuditLogService,
  ) {}

  private async generateInvoiceNumber(manager: EntityManager, tenantId?: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const lockKey = `inv_num_${dateStr}_${tenantId || 'global'}`;

    // Use advisory lock to prevent concurrent generation collisions
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

    const lastInvoice = await manager
      .getRepository(Invoice)
      .createQueryBuilder('i')
      .where('i.invoiceNumber LIKE :prefix', { prefix: `INV${dateStr}%` })
      .andWhere(tenantId ? 'i.tenant_id = :tenantId' : '1=1', { tenantId })
      .orderBy('i.invoiceNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.slice(-4), 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `INV${dateStr}${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Generate the next sequential receipt number. Must be called from inside a
   * caller-provided transaction (`manager`) so the advisory lock is held until
   * the receipt is actually persisted to a payment row. If we ran this in its
   * own inner transaction, the lock would be released before the outer
   * transaction commits — and any rollback after assignment (validation
   * failure, pricing error, GL crash) would leave a permanent gap in the
   * receipt sequence, which fails URA / tax-audit reviews.
   */
  private async generateReceiptNumber(manager: EntityManager, tenantId?: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Advisory lock prevents concurrent duplicate receipt numbers
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `RCP${datePrefix}${tenantId || ''}`,
    ]);

    const result = await manager.query(
      `SELECT receipt_number FROM payments 
       WHERE receipt_number LIKE $1 
       ${tenantId ? 'AND tenant_id = $2' : ''}
       ORDER BY receipt_number DESC LIMIT 1`,
      tenantId ? [`RCP${datePrefix}%`, tenantId] : [`RCP${datePrefix}%`],
    );

    let sequence = 1;
    if (result.length > 0) {
      const lastSeq = parseInt(result[0].receipt_number.slice(-4), 10);
      sequence = lastSeq + 1;
    }

    return `RCP${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  async createInvoice(dto: CreateInvoiceDto, userId: string, tenantId?: string): Promise<Invoice> {
    // Validate no negative amounts
    for (const item of dto.items) {
      if (item.quantity <= 0) {
        throw new BadRequestException(
          `Item quantity must be positive: ${item.description || 'unknown item'}`,
        );
      }
      if (item.unitPrice <= 0) {
        throw new BadRequestException(
          `Unit price must be positive: ${item.description || 'unknown item'}`,
        );
      }
    }
    if (dto.discountAmount && dto.discountAmount < 0) {
      throw new BadRequestException('Discount amount cannot be negative');
    }

    // P1: Reject past due dates — an invoice's payment deadline must be in the future
    if (dto.dueDate) {
      const due = new Date(dto.dueDate);
      due.setHours(23, 59, 59, 999); // allow same-day
      if (due < new Date()) {
        throw new BadRequestException('Due date cannot be in the past');
      }
    }

    // VAT enforcement: taxPercent can only be 0 if explicitly marked as tax-exempt
    if (dto.taxPercent !== undefined && dto.taxPercent === 0 && !dto.taxExemptReason) {
      throw new BadRequestException(
        'VAT cannot be zero unless the invoice is tax-exempt. Provide a taxExemptReason or remove taxPercent to apply the default 18% VAT.',
      );
    }

    // Insurance pre-authorization enforcement
    if (dto.insurancePolicyId) {
      const policy = await this.dataSource.getRepository(InsurancePolicy).findOne({
        where: { id: dto.insurancePolicyId, ...(tenantId ? { tenantId } : {}) },
      });
      if (policy) {
        if (policy.status !== PolicyStatus.ACTIVE) {
          throw new BadRequestException(
            `Insurance policy ${policy.policyNumber} is ${policy.status}. Cannot create invoice against a non-active policy.`,
          );
        }

        // Check for approved pre-authorization
        const preAuth = await this.dataSource.getRepository(PreAuthorization).findOne({
          where: {
            policyId: dto.insurancePolicyId,
            patientId: dto.patientId,
            status: PreAuthStatus.APPROVED,
            ...(tenantId ? { tenantId } : {}),
          },
          order: { approvedAt: 'DESC' },
        });

        // Calculate total for pre-auth comparison
        let estimatedTotal = 0;
        for (const item of dto.items) {
          estimatedTotal = add(estimatedTotal, multiply(item.quantity, item.unitPrice));
        }

        if (preAuth) {
          // Validate the pre-auth hasn't expired
          if (preAuth.validUntil && new Date(preAuth.validUntil) < new Date()) {
            throw new BadRequestException(
              `Pre-authorization ${preAuth.authNumber} expired on ${new Date(preAuth.validUntil).toISOString().slice(0, 10)}. Please request a new pre-authorization.`,
            );
          }

          // Cumulative-usage check: subtract amounts already invoiced against
          // this same pre-auth (excluding cancelled/refunded). Without this a
          // single approved pre-auth could be split across multiple invoices
          // each at the full ceiling.
          const approvedAmount = Number(preAuth.approvedAmount) || 0;
          if (approvedAmount > 0) {
            const usedRow = await this.dataSource
              .getRepository(Invoice)
              .createQueryBuilder('inv')
              .select('COALESCE(SUM(inv.total_amount), 0)', 'used')
              .where('inv.insurance_policy_id = :policyId', { policyId: dto.insurancePolicyId })
              .andWhere('inv.patient_id = :patientId', { patientId: dto.patientId })
              .andWhere('inv.status NOT IN (:...excluded)', {
                excluded: [
                  InvoiceStatus.DRAFT,
                  InvoiceStatus.CANCELLED,
                  InvoiceStatus.REFUNDED,
                  InvoiceStatus.WRITTEN_OFF,
                ],
              })
              .andWhere(tenantId ? 'inv.tenant_id = :tenantId' : '1=1', { tenantId })
              .getRawOne<{ used: string }>();
            const alreadyUsed = Number(usedRow?.used || 0);
            const remaining = approvedAmount - alreadyUsed;
            if (estimatedTotal > remaining) {
              throw new BadRequestException(
                `Invoice total (${estimatedTotal.toLocaleString()}) exceeds remaining pre-authorization balance ` +
                  `(${remaining.toLocaleString()} of ${approvedAmount.toLocaleString()} on ${preAuth.authNumber}; ` +
                  `${alreadyUsed.toLocaleString()} already invoiced). ` +
                  `Please request a pre-auth extension or reduce the invoice amount.`,
              );
            }
          }
        }
      }
    }

    // Calculate totals from items (must happen before the transaction so the
    // values are captured by closure and used both in the Invoice row and the GL post).
    let subtotal = 0;
    const items = dto.items.map((item) => {
      const amount = multiply(item.quantity, item.unitPrice);
      subtotal = add(subtotal, amount);
      return this.itemRepository.create({
        ...item,
        amount,
        // Stamp tenant_id explicitly: cascading inserts run under a fresh
        // queryRunner inside dataSource.transaction() that does not inherit
        // the request's queryRunner.data, so TenantSubscriber cannot fill it in.
        ...(tenantId ? { tenantId } : {}),
      });
    });

    const taxPercent = dto.taxPercent ?? 18;
    const taxAmount = divide(multiply(subtotal, taxPercent), 100);
    const discountAmount = dto.discountAmount || 0;
    const totalAmount = subtract(add(subtotal, taxAmount), discountAmount);

    // P0: Discount exceeding subtotal+tax produces a negative invoice — reject
    if (totalAmount < 0) {
      throw new BadRequestException(
        `Discount amount (${discountAmount}) exceeds invoice total (${add(subtotal, taxAmount)}). Reduce the discount or add more items.`,
      );
    }

    // Wrap invoice number generation, save, GL posting, and encounter update
    // in a single transaction. The advisory lock taken by generateInvoiceNumber
    // (pg_advisory_xact_lock) is released at THIS transaction's commit, which
    // is also when the invoice row becomes visible — so concurrent createInvoice
    // calls cannot race to claim the same INV number.
    const saved = await this.dataSource.transaction(async (manager) => {
      const invoiceNumber = await this.generateInvoiceNumber(manager, tenantId);

      const invoice = this.invoiceRepository.create({
        invoiceNumber,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        createdById: userId,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        balanceDue: totalAmount,
        notes: dto.notes,
        dueDate: dto.dueDate,
        paymentType: dto.paymentType,
        insurancePolicyId: dto.insurancePolicyId,
        items,
        ...(tenantId ? { tenantId } : {}),
      });

      const savedInvoice = await manager.save(Invoice, invoice);

      // Auto-post to General Ledger: DR Accounts Receivable, CR Revenue
      if (dto.encounterId) {
        const encounter = await manager.findOne(Encounter, {
          where: { id: dto.encounterId, ...(tenantId ? { tenantId } : {}) },
        });
        // P1: Throw when caller supplies an encounterId that doesn't exist (or belongs to another tenant)
        if (!encounter) {
          throw new BadRequestException(
            `Encounter ${dto.encounterId} not found${tenantId ? ' for this tenant' : ''}`,
          );
        }
        if (encounter.facilityId) {
          await this.financeService.autoPostInvoiceJournal(
            {
              facilityId: encounter.facilityId,
              invoiceNumber: invoiceNumber,
              totalAmount: totalAmount,
              revenueCategory: dto.paymentType || 'consultation',
              userId,
            },
            tenantId,
          );
        }
        // Update encounter status if linked
        if (encounter && encounter.status === EncounterStatus.PENDING_PHARMACY) {
          encounter.status = EncounterStatus.PENDING_PAYMENT;
          await manager.save(Encounter, encounter);
        }
      }

      return savedInvoice;
    });

    // Best-effort auto-deduction of consumable inventory items linked to
    // each invoiced service. Failures are logged but never block invoicing.
    await this.autoDeductServiceConsumables(saved, dto, userId, tenantId).catch((err) => {
      this.logger.warn(
        `Auto-deduct consumables failed for ${saved.invoiceNumber}: ${err?.message || err}`,
      );
    });

    // Notify cashiers/billing staff that a new bill is awaiting payment.
    // Best-effort: never block invoice creation on notification failures.
    const fullForNotif = await this.findInvoice(saved.id, tenantId);
    try {
      await this.inAppNotifications.notifyInvoiceCreated({
        invoiceId: fullForNotif.id,
        invoiceNumber: fullForNotif.invoiceNumber,
        patientName: fullForNotif.patient?.fullName,
        totalAmount: Number(fullForNotif.totalAmount) || 0,
        facilityId: fullForNotif.encounter?.facilityId,
        tenantId,
      });
    } catch (err: any) {
      this.logger.warn(
        `notifyInvoiceCreated failed for ${fullForNotif.invoiceNumber}: ${err?.message || err}`,
      );
    }

    return fullForNotif;
  }

  /**
   * Compute invoice totals WITHOUT persisting anything. The single source
   * of truth for tax / coverage / membership math — every billing UI must
   * call this instead of approximating client-side (Math.round, hardcoded
   * 20% copay, 10% member discount).
   *
   * Surface-level validation: items must be positive; we do NOT enforce
   * pre-auth / policy-status here because callers may be drafting an
   * invoice before the policy is fully set up. Those rules fire at
   * createInvoice() time.
   */
  async previewInvoice(dto: PreviewInvoiceDto, tenantId?: string) {
    const warnings: string[] = [];

    if (!dto.items || dto.items.length === 0) {
      return {
        items: [],
        subtotal: 0,
        taxPercent: dto.taxPercent ?? 18,
        taxAmount: 0,
        discountAmount: dto.discountAmount || 0,
        insuranceCovers: 0,
        membershipDiscount: 0,
        patientCopay: 0,
        totalAmount: 0,
        patientPortion: 0,
        warnings: ['No items'],
      };
    }

    for (const it of dto.items) {
      if (it.quantity <= 0) {
        throw new BadRequestException(`Quantity must be positive: ${it.description}`);
      }
      // P1: Align with createInvoice() — warn on zero unitPrice in preview
      if (it.unitPrice < 0) {
        throw new BadRequestException(`Unit price cannot be negative: ${it.description}`);
      }
      if (it.unitPrice === 0) {
        warnings.push(
          `Item "${it.description}" has a zero unit price — it will be rejected on invoice creation.`,
        );
      }
    }

    // 1. Resolve policy / membership ONCE
    let copayPercent = 0;
    let copayFixed = 0;
    let policyActive = true;
    if (dto.paymentType === PaymentType.INSURANCE && dto.insurancePolicyId) {
      const policy = await this.dataSource.getRepository(InsurancePolicy).findOne({
        where: { id: dto.insurancePolicyId, ...(tenantId ? { tenantId } : {}) },
      });
      if (!policy) {
        warnings.push('Insurance policy not found — treating as cash for preview.');
      } else {
        if (policy.status !== PolicyStatus.ACTIVE) {
          policyActive = false;
          warnings.push(
            `Policy ${policy.policyNumber} is ${policy.status}; insurance will not be applied on creation.`,
          );
        }
        copayPercent = Number(policy.copayPercentage || 0);
        copayFixed = Number(policy.copayAmount || 0);
      }
    }

    let membershipDiscountPercent = 0;
    if (dto.membershipId) {
      const mem = await this.dataSource.getRepository(PatientMembership).findOne({
        where: { id: dto.membershipId, ...(tenantId ? { tenantId } : {}) },
        relations: ['scheme'],
      });
      if (mem) {
        if (mem.status !== 'active') {
          warnings.push(`Membership is ${mem.status} — discount not applied.`);
        } else {
          membershipDiscountPercent = Number(mem.scheme?.discountPercent || 0);
        }
      } else {
        warnings.push('Membership not found — discount not applied.');
      }
    }

    // 2. Per-line math
    let subtotal = 0;
    const lines = dto.items.map((it) => {
      const lineSubtotal = multiply(it.quantity, it.unitPrice);
      subtotal = add(subtotal, lineSubtotal);
      return {
        serviceCode: it.serviceCode,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineSubtotal,
      };
    });

    // 3. Tax (default 18% VAT, same rule as createInvoice) — use currency.ts to match createInvoice
    const taxPercent = dto.taxPercent ?? 18;
    const taxAmount = divide(multiply(subtotal, taxPercent), 100);

    // 4. Membership discount applies BEFORE coverage (covers fewer items)
    const membershipDiscount =
      membershipDiscountPercent > 0
        ? divide(multiply(subtotal, membershipDiscountPercent), 100)
        : 0;

    const taxedTotal = subtract(add(subtotal, taxAmount), membershipDiscount);

    // 5. Insurance coverage split (only when policy is usable)
    let insuranceCovers = 0;
    let patientCopay = taxedTotal;
    if (dto.paymentType === PaymentType.INSURANCE && policyActive && (copayPercent || copayFixed)) {
      if (copayPercent > 0 && copayPercent <= 100) {
        patientCopay = divide(multiply(taxedTotal, copayPercent), 100);
      } else if (copayFixed > 0) {
        patientCopay = Math.min(copayFixed, taxedTotal);
      }
      insuranceCovers = subtract(taxedTotal, patientCopay);
    } else if (dto.paymentType === PaymentType.INSURANCE && policyActive) {
      // Active policy with no copay rule on file → assume 100% covered, patient owes 0
      insuranceCovers = taxedTotal;
      patientCopay = 0;
      warnings.push('Policy has no copay configured — assuming 100% coverage.');
    }

    // 6. Final adjustments (manual discount on the bill)
    const manualDiscount = dto.discountAmount || 0;
    // P1-fix: was subtract(taxedTotal, 0) — manual discount was ignored in totalAmount
    const totalAmount = subtract(taxedTotal, manualDiscount);
    const patientPortion = Math.max(0, subtract(patientCopay, manualDiscount));

    return {
      items: lines,
      subtotal,
      taxPercent,
      taxAmount,
      membershipDiscount,
      membershipDiscountPercent,
      discountAmount: manualDiscount,
      insuranceCovers,
      patientCopay,
      copayPercent,
      copayFixed,
      totalAmount,
      patientPortion,
      paymentType: dto.paymentType,
      warnings,
    };
  }

  /** For each invoice item with a serviceCode, deduct any linked consumables from stock. */
  private async autoDeductServiceConsumables(
    invoice: Invoice,
    dto: CreateInvoiceDto,
    userId: string,
    tenantId?: string,
  ): Promise<void> {
    let facilityId: string | undefined;
    if (dto.encounterId) {
      const enc = await this.encounterRepository.findOne({
        where: { id: dto.encounterId, ...(tenantId ? { tenantId } : {}) },
      });
      facilityId = enc?.facilityId;
    }
    if (!facilityId) return; // No facility context — cannot deduct.

    for (const item of dto.items) {
      if (!item.serviceCode) continue;
      const consumables = await this.servicesService.getConsumablesByCode(
        item.serviceCode,
        tenantId,
      );
      for (const c of consumables) {
        const totalQty = Number(c.quantity) * Number(item.quantity || 1);
        try {
          await this.inventoryService.deductStock(
            c.itemId,
            facilityId,
            totalQty,
            'invoice',
            invoice.id,
            userId,
            tenantId,
          );
        } catch (err: any) {
          const msg = `Could not deduct ${totalQty} of item ${c.itemId} for service ${item.serviceCode}: ${err?.message || err}`;
          if (c.isOptional) {
            this.logger.warn(msg);
          } else {
            this.logger.error(msg);
          }
        }
      }
    }
  }

  /** Enhancement B: Reverse consumable deductions when an invoice is cancelled. */
  private async autoReverseServiceConsumables(
    invoice: Invoice,
    userId: string,
    tenantId?: string,
  ): Promise<void> {
    let facilityId: string | undefined;
    if (invoice.encounterId) {
      const enc = await this.encounterRepository.findOne({
        where: { id: invoice.encounterId, ...(tenantId ? { tenantId } : {}) },
      });
      facilityId = enc?.facilityId;
    }
    if (!facilityId) return;

    const items = await this.itemRepository.find({ where: { invoiceId: invoice.id } });
    for (const item of items) {
      if (!item.serviceCode) continue;
      const consumables = await this.servicesService.getConsumablesByCode(
        item.serviceCode,
        tenantId,
      );
      for (const c of consumables) {
        const totalQty = Number(c.quantity) * Number(item.quantity || 1);
        try {
          // Negative deduction = stock restoration
          await this.inventoryService.deductStock(
            c.itemId,
            facilityId,
            -totalQty,
            'invoice_cancel',
            invoice.id,
            userId,
            tenantId,
          );
        } catch (err: any) {
          this.logger.warn(
            `Could not reverse ${totalQty} of item ${c.itemId} for service ${item.serviceCode}: ${err?.message || err}`,
          );
        }
      }
    }
  }

  async findAll(
    query: InvoiceQueryDto,
    tenantId?: string,
  ): Promise<{ data: Invoice[]; total: number }> {
    const {
      status,
      patientId,
      encounterId,
      dateFrom,
      dateTo,
      search,
      patientMrn,
      page = 1,
      limit: rawLimit = 20,
    } = query;
    const limit = Math.min(rawLimit, 200);

    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .leftJoinAndSelect('invoice.payments', 'payments')
      .leftJoinAndSelect('invoice.encounter', 'encounter');

    // SECURITY: Always filter by tenant - no cross-tenant access
    if (tenantId) {
      qb.andWhere('invoice.tenant_id = :tenantId', { tenantId });
    }

    if (status) {
      qb.andWhere('invoice.status = :status', { status });
    }

    if (patientId) {
      qb.andWhere('invoice.patient_id = :patientId', { patientId });
    }

    if (encounterId) {
      qb.andWhere('invoice.encounter_id = :encounterId', { encounterId });
    }

    if (dateFrom) {
      qb.andWhere('invoice.created_at >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      qb.andWhere('invoice.created_at <= :dateTo', { dateTo });
    }

    // Search by patient name, MRN, or invoice number
    if (search) {
      qb.andWhere(
        '(patient.full_name ILIKE :search OR patient.mrn ILIKE :search OR invoice.invoice_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Search by patient MRN specifically
    if (patientMrn) {
      qb.andWhere('patient.mrn ILIKE :patientMrn', { patientMrn: `%${patientMrn}%` });
    }

    qb.orderBy('invoice.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findInvoice(id: string, tenantId?: string): Promise<Invoice> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const invoice = await this.invoiceRepository.findOne({
      where,
      relations: ['items', 'payments', 'patient', 'encounter', 'createdBy'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async findByInvoiceNumber(invoiceNumber: string, tenantId?: string): Promise<Invoice> {
    const where: any = { invoiceNumber };
    if (tenantId) where.tenantId = tenantId;
    const invoice = await this.invoiceRepository.findOne({
      where,
      relations: ['items', 'payments', 'patient'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async addItem(
    invoiceId: string,
    dto: AddInvoiceItemDto,
    userId?: string,
    tenantId?: string,
  ): Promise<Invoice> {
    // Lock + validate + insert + recalc in one transaction so a concurrent
    // recordPayment cannot observe a stale subtotal between the item save
    // and the recalculation.
    return this.dataSource.transaction(async (manager) => {
      const where: any = { id: invoiceId };
      if (tenantId) where.tenantId = tenantId;

      const invoice = await manager.findOne(Invoice, {
        where,
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Cannot add items to a paid invoice');
      }
      // P1: Allow adding items to PARTIALLY_PAID invoices (hospital setting — services
      // happen before payment completes). Aligned with addBillableItem() behavior.
      if (
        invoice.status === InvoiceStatus.CANCELLED ||
        invoice.status === InvoiceStatus.REFUNDED ||
        invoice.status === InvoiceStatus.WRITTEN_OFF
      ) {
        throw new BadRequestException(`Cannot add items to a ${invoice.status} invoice`);
      }

      const amount = multiply(dto.quantity, dto.unitPrice);
      const item = manager.create(InvoiceItem, {
        ...dto,
        invoiceId,
        amount,
        ...(tenantId ? { tenantId } : {}),
      });
      await manager.save(item);

      this.logger.log(
        `Invoice item added to ${invoiceId} by ${userId || 'unknown'}: ${dto.description || dto.serviceCode || 'item'} amount=${amount}`,
      );

      return this.recalculateInvoiceInTxn(manager, invoiceId, tenantId);
    });
  }

  async updateItemPrice(
    invoiceId: string,
    itemId: string,
    unitPrice: number,
    userId?: string,
    tenantId?: string,
  ): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const where: any = { id: invoiceId };
      if (tenantId) where.tenantId = tenantId;

      const invoice = await manager.findOne(Invoice, {
        where,
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (
        invoice.status === InvoiceStatus.PAID ||
        invoice.status === InvoiceStatus.PARTIALLY_PAID
      ) {
        throw new BadRequestException(
          'Cannot update item price on a paid or partially paid invoice',
        );
      }
      if (
        invoice.status === InvoiceStatus.CANCELLED ||
        invoice.status === InvoiceStatus.REFUNDED ||
        invoice.status === InvoiceStatus.WRITTEN_OFF
      ) {
        throw new BadRequestException(`Cannot update item price on a ${invoice.status} invoice`);
      }

      const item = await manager.findOne(InvoiceItem, {
        where: { id: itemId, invoiceId },
      });
      if (!item) {
        throw new NotFoundException('Invoice item not found');
      }

      item.unitPrice = unitPrice;
      item.amount = multiply(item.quantity, unitPrice);
      await manager.save(item);

      this.logger.log(
        `Invoice item ${itemId} price updated to ${unitPrice} on ${invoiceId} by ${userId || 'unknown'}`,
      );

      return this.recalculateInvoiceInTxn(manager, invoiceId, tenantId);
    });
  }

  async removeItemById(
    invoiceId: string,
    itemId: string,
    userId?: string,
    tenantId?: string,
  ): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const where: any = { id: invoiceId };
      if (tenantId) where.tenantId = tenantId;

      const invoice = await manager.findOne(Invoice, {
        where,
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Cannot remove items from a paid invoice');
      }
      if (invoice.status === InvoiceStatus.PARTIALLY_PAID) {
        throw new BadRequestException(
          'Cannot remove items from a partially paid invoice — refund or void the existing payments first',
        );
      }
      if (
        invoice.status === InvoiceStatus.CANCELLED ||
        invoice.status === InvoiceStatus.REFUNDED ||
        invoice.status === InvoiceStatus.WRITTEN_OFF
      ) {
        throw new BadRequestException(`Cannot remove items from a ${invoice.status} invoice`);
      }

      const item = await manager.findOne(InvoiceItem, {
        where: { id: itemId, invoiceId },
      });
      if (!item) {
        throw new NotFoundException('Invoice item not found');
      }

      await manager.remove(item);
      this.logger.log(
        `Invoice item ${itemId} (${item.description}) removed from ${invoiceId} by ${userId || 'unknown'}`,
      );

      return this.recalculateInvoiceInTxn(manager, invoiceId, tenantId);
    });
  }

  /**
   * In-transaction variant of recalculateInvoice — used by addItem /
   * updateItemPrice / removeItemById which already hold a pessimistic_write
   * lock on the invoice row. Avoids re-locking inside a nested transaction.
   */
  private async recalculateInvoiceInTxn(
    manager: EntityManager,
    invoiceId: string,
    tenantId?: string,
  ): Promise<Invoice> {
    const where: any = { id: invoiceId };
    if (tenantId) where.tenantId = tenantId;

    const invoice = await manager.findOne(Invoice, {
      where,
      relations: ['items', 'payments', 'patient', 'encounter', 'createdBy'],
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // P0: Use currency.ts add/subtract to avoid floating-point drift on decimal columns
    const subtotal = invoice.items.reduce((sum, item) => add(sum, Number(item.amount)), 0);
    const totalAmount = subtract(
      add(subtotal, Number(invoice.taxAmount)),
      Number(invoice.discountAmount),
    );
    const balanceDue = subtract(totalAmount, Number(invoice.amountPaid));

    const insuranceAmount = invoice.items.reduce(
      (sum, item) => add(sum, Number(item.insuranceAmount || 0)),
      0,
    );
    const copayAmount = invoice.items.reduce(
      (sum, item) => add(sum, Number(item.copayAmount || 0)),
      0,
    );
    const uncoveredAmount = invoice.items
      .filter((item) => !item.insuranceCovered)
      .reduce((sum, item) => add(sum, Number(item.amount || 0)), 0);
    const patientResponsibility = add(copayAmount, uncoveredAmount);

    invoice.subtotal = subtotal;
    invoice.totalAmount = totalAmount;
    invoice.balanceDue = balanceDue;
    invoice.insuranceAmount = insuranceAmount;
    invoice.copayAmount = copayAmount;
    invoice.patientResponsibility = patientResponsibility;

    if (balanceDue <= 0) {
      invoice.status = InvoiceStatus.PAID;
    } else if (Number(invoice.amountPaid) > 0) {
      invoice.status = InvoiceStatus.PARTIALLY_PAID;
    }

    return manager.save(Invoice, invoice);
  }

  private async recalculateInvoice(invoiceId: string, tenantId?: string): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const where: any = { id: invoiceId };
      if (tenantId) where.tenantId = tenantId;

      // Lock the invoice row first (no nullable relations to avoid FOR UPDATE on outer joins)
      await manager.findOne(Invoice, {
        where,
        lock: { mode: 'pessimistic_write' },
      });

      // Then load with all relations (no lock)
      const invoice = await manager.findOne(Invoice, {
        where,
        relations: ['items', 'payments', 'patient', 'encounter', 'createdBy'],
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // P0: Use currency.ts add/subtract to avoid floating-point drift on decimal columns
      const subtotal = invoice.items.reduce((sum, item) => add(sum, Number(item.amount)), 0);
      const totalAmount = subtract(
        add(subtotal, Number(invoice.taxAmount)),
        Number(invoice.discountAmount),
      );
      const balanceDue = subtract(totalAmount, Number(invoice.amountPaid));

      // Calculate insurance breakdown
      const insuranceAmount = invoice.items.reduce(
        (sum, item) => add(sum, Number(item.insuranceAmount || 0)),
        0,
      );
      const copayAmount = invoice.items.reduce(
        (sum, item) => add(sum, Number(item.copayAmount || 0)),
        0,
      );
      // Patient pays: copay on covered items + full amount on uncovered items
      const uncoveredAmount = invoice.items
        .filter((item) => !item.insuranceCovered)
        .reduce((sum, item) => add(sum, Number(item.amount || 0)), 0);
      const patientResponsibility = add(copayAmount, uncoveredAmount);

      invoice.subtotal = subtotal;
      invoice.totalAmount = totalAmount;
      invoice.balanceDue = balanceDue;
      invoice.insuranceAmount = insuranceAmount;
      invoice.copayAmount = copayAmount;
      invoice.patientResponsibility = patientResponsibility;

      // Update status based on payments
      if (balanceDue <= 0) {
        invoice.status = InvoiceStatus.PAID;
      } else if (Number(invoice.amountPaid) > 0) {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }

      return manager.save(Invoice, invoice);
    });
  }

  async recordPayment(dto: CreatePaymentDto, userId: string, tenantId?: string): Promise<Payment> {
    // Use transaction to prevent race conditions when multiple payments hit simultaneously
    return this.dataSource.transaction(async (manager) => {
      // Lock the invoice row for update to prevent concurrent payment issues
      const invoice = await manager.findOne(Invoice, {
        where: { id: dto.invoiceId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Invoice is already fully paid');
      }

      if (dto.amount > Number(invoice.balanceDue)) {
        throw new BadRequestException(`Payment amount exceeds balance due (${invoice.balanceDue})`);
      }

      // Insurance method validation: an INSURANCE payment must be against an
      // INSURANCE invoice. The reverse (cash on insurance invoice) is allowed
      // for co-payments and patient responsibility settlements.
      if (dto.method === PaymentMethod.INSURANCE && invoice.paymentType !== PaymentType.INSURANCE) {
        throw new BadRequestException(
          `Cannot record an INSURANCE payment on a ${invoice.paymentType} invoice. Convert the invoice payment type first or use a cash/card method.`,
        );
      }

      // Block payment if any items have zero prices
      const items = await manager.find(InvoiceItem, { where: { invoiceId: dto.invoiceId } });
      const zeroPriceItems = items.filter((i) => !i.unitPrice || Number(i.unitPrice) <= 0);
      if (zeroPriceItems.length > 0) {
        const names = zeroPriceItems.map((i) => i.description).join(', ');
        throw new BadRequestException(
          `Cannot process payment: the following items have no price set: ${names}. Please update prices first.`,
        );
      }

      // Prevent duplicate payment with same transaction reference. Done BEFORE
      // generating the receipt number so we don't waste a sequence on a
      // request we're going to reject.
      if (dto.transactionReference) {
        const existing = await manager.findOne(Payment, {
          where: {
            transactionReference: dto.transactionReference,
            ...(tenantId ? { tenantId } : {}),
          },
        });
        if (existing) {
          throw new BadRequestException(
            `Duplicate payment: transaction reference '${dto.transactionReference}' already exists on receipt ${existing.receiptNumber}`,
          );
        }
      } else {
        // Without a transactionReference, check for duplicate by composite key within 5-minute window
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const duplicateCheck = await manager
          .createQueryBuilder(Payment, 'p')
          .where('p.invoiceId = :invoiceId', { invoiceId: dto.invoiceId })
          .andWhere('p.amount = :amount', { amount: dto.amount })
          .andWhere('p.method = :method', { method: dto.method })
          .andWhere('p.paidAt >= :fiveMinAgo', { fiveMinAgo })
          .getOne();
        if (duplicateCheck) {
          throw new BadRequestException(
            `Possible duplicate payment: a payment of ${dto.amount} via ${dto.method} was already recorded on this invoice at ${duplicateCheck.paidAt?.toISOString() || 'recently'}. If this is intentional, provide a unique transactionReference.`,
          );
        }
      }

      const receiptNumber = await this.generateReceiptNumber(manager, tenantId);

      // P1: Set transactionReference before first save to avoid double-save.
      // For cash payments without an external reference, stamp the receipt number
      // so every payment row has a traceable code.
      const payment = manager.create(Payment, {
        receiptNumber,
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        transactionReference: dto.transactionReference || receiptNumber,
        notes: dto.notes,
        receivedById: userId,
        ...(tenantId ? { tenantId } : {}),
      });

      const savedPayment = await manager.save(payment);

      // Update invoice totals
      invoice.amountPaid = Number(invoice.amountPaid) + dto.amount;
      invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);

      let invoiceFullyPaid = false;
      if (invoice.balanceDue <= 0) {
        invoice.status = InvoiceStatus.PAID;
        invoiceFullyPaid = true;

        // Advance queue: if patient is in PENDING_PAYMENT, move to WAITING
        if (invoice.encounterId) {
          const queueEntry = await manager.findOne(Queue, {
            where: {
              encounterId: invoice.encounterId,
              status: QueueStatus.PENDING_PAYMENT,
            },
          });
          if (queueEntry) {
            await manager.update(
              Queue,
              { id: queueEntry.id },
              {
                status: QueueStatus.WAITING,
              },
            );
            this.logger.log(
              `Queue ${queueEntry.ticketNumber} advanced from PENDING_PAYMENT to WAITING after payment ${receiptNumber}`,
            );

            // Pre-pay mode: after payment, route patient to the next clinical
            // service point based on what was billed (lab > radiology > pharmacy).
            // Only applies when the facility has prePayMode enabled — otherwise
            // the queue stays where it is and the cashier/doctor routes manually.
            try {
              const facility = await manager.findOne(Facility, {
                where: { id: queueEntry.facilityId },
              });
              const prePayMode = Boolean(
                (facility?.settings as Record<string, unknown> | undefined)?.prePayMode,
              );
              if (prePayMode) {
                const lineChargeTypes = new Set((invoice.items || []).map((it) => it.chargeType));
                let nextServicePoint: string | null = null;
                if (lineChargeTypes.has(ChargeType.LAB)) {
                  nextServicePoint = 'laboratory';
                } else if (lineChargeTypes.has(ChargeType.RADIOLOGY)) {
                  nextServicePoint = 'radiology';
                } else if (lineChargeTypes.has(ChargeType.PHARMACY)) {
                  nextServicePoint = 'pharmacy';
                }
                if (nextServicePoint && queueEntry.servicePoint !== nextServicePoint) {
                  await manager.update(
                    Queue,
                    { id: queueEntry.id },
                    {
                      previousServicePoint: queueEntry.servicePoint,
                      servicePoint: nextServicePoint as ServicePoint,
                    },
                  );
                  this.logger.log(
                    `Pre-pay routing: queue ${queueEntry.ticketNumber} moved from ${queueEntry.servicePoint} to ${nextServicePoint} after payment ${receiptNumber}`,
                  );
                }
              }
            } catch (err) {
              this.logger.warn(
                `Pre-pay routing failed for queue ${queueEntry.ticketNumber}: ${(err as Error).message}`,
              );
            }
          }

          // If encounter is in PENDING_PAYMENT status (post-consultation), complete it
          // Only complete if ALL invoices for this encounter are paid
          const encounter = await manager.findOne(Encounter, {
            where: { id: invoice.encounterId },
          });
          if (encounter && encounter.status === EncounterStatus.PENDING_PAYMENT) {
            const remainingUnpaid = await manager
              .createQueryBuilder(Invoice, 'inv')
              .where('inv.encounter_id = :encounterId', { encounterId: invoice.encounterId })
              .andWhere('inv.id != :thisId', { thisId: invoice.id })
              .andWhere('inv.status NOT IN (:...terminal)', {
                terminal: ['paid', 'cancelled', 'refunded'],
              })
              .andWhere('inv.balance_due > 0')
              .getCount();
            if (remainingUnpaid === 0) {
              await manager.update(
                Encounter,
                { id: invoice.encounterId },
                {
                  status: EncounterStatus.COMPLETED,
                  endTime: new Date(),
                },
              );
            }
          }
        }
      } else {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }

      await manager.update(
        Invoice,
        { id: invoice.id },
        {
          amountPaid: invoice.amountPaid,
          balanceDue: invoice.balanceDue,
          status: invoice.status,
        },
      );

      // Load full invoice with relations for GL posting and notifications
      const fullInvoice = await manager.findOne(Invoice, {
        where: { id: invoice.id, ...(tenantId ? { tenantId } : {}) },
        relations: ['patient', 'encounter'],
      });

      // Auto-post to General Ledger: DR Cash/Bank, CR Accounts Receivable
      const facilityForGL = fullInvoice?.encounter?.facilityId;
      if (facilityForGL) {
        try {
          await this.financeService.autoPostPatientPaymentJournal(
            {
              facilityId: facilityForGL,
              receiptNumber,
              amount: dto.amount,
              paymentMethod: dto.method || 'cash',
              userId,
            },
            tenantId,
          );
        } catch (err) {
          // P1: Track GL failure on the payment row for reconciliation reports
          savedPayment.glPosted = false;
          await manager.save(Payment, savedPayment);
          this.logger.error(`GL auto-post failed for payment ${receiptNumber}: ${err.message}`, {
            receiptNumber,
            amount: dto.amount,
            error: err.stack,
          });
        }
      }

      // Send thank you SMS/Email after full payment (non-blocking)
      if (invoiceFullyPaid && invoice.patientId && fullInvoice?.patient) {
        const patientName = fullInvoice.patient.fullName;
        const facilityId = fullInvoice.encounter?.facilityId;
        if (facilityId) {
          this.notificationsService
            .sendThankYouMessage(facilityId, invoice.patientId, patientName, receiptNumber)
            .then((result) => {
              if (result.success) {
                this.logger.log(`Thank you message sent to ${patientName} via ${result.channel}`);
              }
            })
            .catch((err) => this.logger.warn(`Thank you message failed: ${err.message}`));
        }
      }

      // Audit log: every successful payment must be traceable to the cashier.
      await this.auditLogService
        .log({
          userId,
          action: 'PAYMENT_RECORDED',
          entityType: 'Payment',
          entityId: savedPayment.id,
          newValue: {
            receiptNumber,
            invoiceId: invoice.id,
            amount: Number(savedPayment.amount),
            method: savedPayment.method,
            status: savedPayment.status,
            invoiceFullyPaid,
          },
          ...(tenantId ? { tenantId } : {}),
        })
        .catch((err) =>
          this.logger.error(
            `Audit log failed for recordPayment ${savedPayment.id}: ${err.message}`,
          ),
        );

      // Notify the assigned doctor that the patient has cleared billing and is
      // now back in the queue. Fire-and-forget; never block the cashier.
      if (invoiceFullyPaid && invoice.encounterId) {
        try {
          const queueEntry = await manager.findOne(Queue, {
            where: { encounterId: invoice.encounterId },
            relations: ['patient'],
            order: { createdAt: 'DESC' },
          });
          if (queueEntry?.assignedDoctorId) {
            this.inAppNotifications
              .notifyPaymentCleared({
                doctorUserId: queueEntry.assignedDoctorId,
                patientName: queueEntry.patient?.fullName || 'Patient',
                invoiceNumber: invoice.invoiceNumber,
                amount: Number(invoice.totalAmount) || 0,
                facilityId: queueEntry.facilityId,
                tenantId,
              })
              .catch((err) =>
                this.logger.warn(
                  `notifyPaymentCleared failed for ${invoice.invoiceNumber}: ${err?.message || err}`,
                ),
              );
          }
        } catch (err: any) {
          this.logger.warn(
            `notifyPaymentCleared lookup failed for ${invoice.invoiceNumber}: ${err?.message || err}`,
          );
        }
      }

      return savedPayment;
    });
  }

  async getPaymentsByInvoice(invoiceId: string, tenantId?: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { invoiceId, ...(tenantId ? { tenantId } : {}) },
      order: { paidAt: 'DESC' },
      relations: ['receivedBy'],
    });
  }

  async listPayments(
    params: {
      startDate?: string;
      endDate?: string;
      method?: string;
      page?: number;
      limit?: number;
    },
    tenantId?: string,
  ): Promise<{ data: Payment[]; total: number }> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 50, 200);

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoinAndSelect('invoice.patient', 'patient')
      .leftJoinAndSelect('invoice.items', 'items')
      .leftJoinAndSelect('payment.receivedBy', 'receivedBy');

    if (tenantId) {
      qb.andWhere('invoice.tenant_id = :tenantId', { tenantId });
    }

    if (params.startDate) {
      const startDate = new Date(params.startDate);
      startDate.setHours(0, 0, 0, 0);
      qb.andWhere('payment.paid_at >= :startDate', { startDate });
    }

    if (params.endDate) {
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999);
      qb.andWhere('payment.paid_at <= :endDate', { endDate });
    }

    if (params.method) {
      qb.andWhere('payment.method = :method', { method: params.method });
    }

    qb.orderBy('payment.paidAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [payments, total] = await qb.getManyAndCount();

    // Transform to include patient info
    const data = payments.map((p) => ({
      ...p,
      patientName: p.invoice?.patient?.fullName || null,
    }));
    return { data, total };
  }

  async voidPayment(
    paymentId: string,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const invoiceRepo = manager.getRepository(Invoice);

      // Lock payment to prevent concurrent void
      const payment = await paymentRepo.findOne({
        where: { id: paymentId, ...(tenantId ? { tenantId } : {}) },
        relations: ['invoice', 'invoice.encounter'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status === PaymentStatus.VOIDED) {
        throw new BadRequestException('Payment is already voided');
      }
      if (payment.status === PaymentStatus.REFUNDED) {
        throw new BadRequestException('Cannot void a refunded payment');
      }

      // P1: Time window for voids — after the window, require refundPayment() instead
      const voidWindowHours = 24;
      const paymentAge = Date.now() - new Date(payment.paidAt).getTime();
      if (paymentAge > voidWindowHours * 60 * 60 * 1000) {
        throw new BadRequestException(
          `Payment is older than ${voidWindowHours} hours. Use refund instead of void.`,
        );
      }

      // P1: Reject void if partial refunds already exist — would double-reverse
      const existingRefunds = await paymentRepo
        .createQueryBuilder('p')
        .where('p.transactionReference = :ref', { ref: `REFUND-${payment.receiptNumber}` })
        .andWhere('p.status = :st', { st: PaymentStatus.REFUNDED })
        .getCount();
      if (existingRefunds > 0) {
        throw new BadRequestException(
          'Cannot void a payment that has partial refunds. Refund the remaining balance instead.',
        );
      }

      // Maker-checker: the user who received the payment cannot void it
      if (payment.receivedById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the payment receiver cannot void their own payment',
        );
      }

      // Void the payment
      payment.status = PaymentStatus.VOIDED;
      payment.notes = `${payment.notes || ''}\nVoided by ${userId}: ${reason}`.trim();

      await paymentRepo.save(payment);

      // Recalculate invoice totals atomically
      if (payment.invoice) {
        const invoice = await invoiceRepo.findOne({
          where: { id: payment.invoice.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (invoice) {
          invoice.amountPaid = Number(invoice.amountPaid) - Number(payment.amount);
          invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);

          if (invoice.amountPaid <= 0) {
            invoice.status = InvoiceStatus.PENDING;
          } else if (invoice.balanceDue > 0) {
            invoice.status = InvoiceStatus.PARTIALLY_PAID;
          }

          await invoiceRepo.save(invoice);
        }

        // Post GL reversal: DR Accounts Receivable, CR Cash (reverses the original payment posting)
        const facilityId = payment.invoice.encounter?.facilityId;
        if (facilityId && Number(payment.amount) > 0) {
          this.financeService
            .autoPostPatientPaymentJournal(
              {
                facilityId,
                receiptNumber: `${payment.receiptNumber}-VOID`,
                amount: -Number(payment.amount),
                paymentMethod: payment.method || 'cash',
                userId,
              },
              tenantId,
            )
            .catch((err) =>
              this.logger.error(
                `GL reversal failed for voided payment ${payment.receiptNumber}: ${err.message}`,
                { receiptNumber: payment.receiptNumber, amount: payment.amount, error: err.stack },
              ),
            );
        }
      }

      // Audit log: payment void is high-sensitivity
      await this.auditLogService
        .log({
          userId,
          action: 'PAYMENT_VOIDED',
          entityType: 'Payment',
          entityId: payment.id,
          oldValue: { status: PaymentStatus.COMPLETED, amount: Number(payment.amount) },
          newValue: { status: PaymentStatus.VOIDED, receiptNumber: payment.receiptNumber },
          reason,
          ...(tenantId ? { tenantId } : {}),
        })
        .catch((err) =>
          this.logger.error(`Audit log failed for voidPayment ${payment.id}: ${err.message}`),
        );

      return payment;
    });
  }

  /**
   * Issue a partial or full refund against a single payment.
   * Creates a counter-Payment row with status=REFUNDED and amount = -refundAmount,
   * adjusts the parent invoice balance, and posts a GL reversal for the refund leg.
   * Maker-checker: the original receiver cannot also process the refund.
   */
  async refundPayment(
    paymentId: string,
    refundAmount: number,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Payment> {
    if (!refundAmount || refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Refund reason is required');
    }

    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const invoiceRepo = manager.getRepository(Invoice);

      const original = await paymentRepo.findOne({
        where: { id: paymentId, ...(tenantId ? { tenantId } : {}) },
        relations: ['invoice', 'invoice.encounter'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!original) throw new NotFoundException('Payment not found');
      if (original.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(`Cannot refund a payment with status '${original.status}'`);
      }
      if (original.receivedById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the payment receiver cannot process its refund',
        );
      }

      // P1: Time window for refunds — 90-day limit
      const refundWindowDays = 90;
      const paymentAgeMs = Date.now() - new Date(original.paidAt).getTime();
      if (paymentAgeMs > refundWindowDays * 24 * 60 * 60 * 1000) {
        throw new BadRequestException(
          `Payment is older than ${refundWindowDays} days. Refunds are no longer allowed — use a write-off instead.`,
        );
      }

      // How much of this payment is still refundable?
      const priorRefunds = await paymentRepo
        .createQueryBuilder('p')
        .where('p.transactionReference = :ref', {
          ref: `REFUND-${original.receiptNumber}`,
        })
        .andWhere('p.status = :st', { st: PaymentStatus.REFUNDED })
        .getMany();
      const alreadyRefunded = priorRefunds.reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);
      const remaining = Number(original.amount) - alreadyRefunded;
      if (refundAmount > remaining) {
        throw new BadRequestException(
          `Refund amount ${refundAmount} exceeds remaining refundable balance ${remaining}`,
        );
      }

      // P0: Use advisory-locked receipt generator instead of Date.now() suffix (collision risk)
      const refundReceipt = (await this.generateReceiptNumber(manager, tenantId)).replace(
        /^RCP/,
        'REF',
      );

      const refund = manager.create(Payment, {
        receiptNumber: refundReceipt,
        invoiceId: original.invoiceId,
        amount: -Math.abs(refundAmount),
        method: original.method,
        status: PaymentStatus.REFUNDED,
        transactionReference: `REFUND-${original.receiptNumber}`,
        notes: `Partial refund of payment ${original.receiptNumber}: ${reason}`,
        receivedById: userId,
        ...(tenantId ? { tenantId } : {}),
      });
      const savedRefund = await manager.save(refund);

      // P0: Keep original payment as COMPLETED even when fully refunded — the refund
      // counter-payment rows track the reversal. Reports distinguish refunds from voids
      // by checking for counter-payments. Mark as REFUNDED (not VOIDED) for clarity.
      if (alreadyRefunded + refundAmount >= Number(original.amount)) {
        original.status = PaymentStatus.REFUNDED;
        original.notes = `${original.notes || ''}\nFully refunded by ${userId}: ${reason}`.trim();
        await paymentRepo.save(original);
      }

      // Adjust invoice balance
      if (original.invoice) {
        const invoice = await invoiceRepo.findOne({
          where: { id: original.invoice.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (invoice) {
          invoice.amountPaid = Number(invoice.amountPaid) - refundAmount;
          if (invoice.amountPaid < 0) invoice.amountPaid = 0;
          invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);

          if (invoice.amountPaid <= 0) {
            invoice.status = InvoiceStatus.REFUNDED;
          } else if (invoice.balanceDue > 0) {
            invoice.status = InvoiceStatus.PARTIALLY_PAID;
          }
          invoice.notes = `${invoice.notes || ''}\nRefund (${refundAmount}): ${reason}`.trim();
          await invoiceRepo.save(invoice);
        }

        // GL reversal for the refund leg
        const facilityId = original.invoice.encounter?.facilityId;
        if (facilityId && refundAmount > 0) {
          this.financeService
            .autoPostPatientPaymentJournal(
              {
                facilityId,
                receiptNumber: refundReceipt,
                amount: -refundAmount,
                paymentMethod: original.method || 'cash',
                userId,
              },
              tenantId,
            )
            .catch((err) =>
              this.logger.error(`GL reversal failed for refund ${refundReceipt}: ${err.message}`, {
                receiptNumber: refundReceipt,
                refundAmount,
                error: err.stack,
              }),
            );
        }
      }

      await this.auditLogService
        .log({
          userId,
          action: 'PAYMENT_REFUNDED',
          entityType: 'Payment',
          entityId: original.id,
          oldValue: { amount: Number(original.amount), receiptNumber: original.receiptNumber },
          newValue: { refundAmount, refundReceipt, status: original.status },
          reason,
          ...(tenantId ? { tenantId } : {}),
        })
        .catch((err) =>
          this.logger.error(`Audit log failed for refundPayment ${original.id}: ${err.message}`),
        );

      return savedRefund;
    });
  }

  /**
   * Internal helper used by InsuranceService when a claim payment is recorded.
   * Creates a Payment row of method=INSURANCE on the claim's invoice so the invoice
   * balance reflects insurance settlement automatically.
   * Idempotent on transactionReference (claim number).
   */
  async recordInsuranceClaimPayment(
    invoiceId: string,
    amount: number,
    claimNumber: string,
    paymentReference: string | undefined,
    userId: string,
    tenantId?: string,
  ): Promise<Payment | null> {
    if (!invoiceId || !amount || amount <= 0) return null;

    return this.dataSource.transaction(async (manager) => {
      const txnRef = `CLAIM-${claimNumber}`;
      const existing = await manager.findOne(Payment, {
        where: { transactionReference: txnRef, ...(tenantId ? { tenantId } : {}) },
      });
      if (existing) return existing;

      const invoice = await manager.findOne(Invoice, {
        where: { id: invoiceId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) return null;

      const settle = Math.min(amount, Number(invoice.balanceDue));
      if (settle <= 0) return null;

      const receiptNumber = await this.generateReceiptNumber(manager, tenantId);
      const payment = manager.create(Payment, {
        receiptNumber,
        invoiceId,
        amount: settle,
        method: PaymentMethod.INSURANCE,
        transactionReference: txnRef,
        notes: `Insurance settlement for claim ${claimNumber}${paymentReference ? ` (ref ${paymentReference})` : ''}`,
        receivedById: userId,
        ...(tenantId ? { tenantId } : {}),
      });
      const saved = await manager.save(payment);

      invoice.amountPaid = Number(invoice.amountPaid) + settle;
      invoice.balanceDue = Number(invoice.totalAmount) - Number(invoice.amountPaid);
      if (invoice.balanceDue <= 0) {
        invoice.status = InvoiceStatus.PAID;
      } else {
        invoice.status = InvoiceStatus.PARTIALLY_PAID;
      }
      await manager.save(invoice);

      return saved;
    });
  }

  async getPayment(paymentId: string, tenantId?: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, ...(tenantId ? { tenantId } : {}) },
      relations: ['invoice', 'invoice.items', 'invoice.patient', 'receivedBy'],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async getDailyRevenue(
    date: Date = new Date(),
    tenantId?: string,
  ): Promise<{
    totalCollected: number;
    cashAmount: number;
    mobileMoneyAmount: number;
    cardAmount: number;
    bankTransferAmount: number;
    insuranceAmount: number;
    otherAmount: number;
    paymentCount: number;
    byMethod: Record<string, number>;
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.paid_at BETWEEN :start AND :end', { start: startOfDay, end: endOfDay })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED });

    if (tenantId) {
      qb.leftJoin('payment.invoice', 'invoice').andWhere('invoice.tenant_id = :tenantId', {
        tenantId,
      });
    }

    const payments = await qb.getMany();

    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // P1: Full payment method breakdown — not just cash/mobile/card
    const byMethod: Record<string, number> = {};
    for (const p of payments) {
      const method = p.method || 'other';
      byMethod[method] = (byMethod[method] || 0) + Number(p.amount);
    }

    const cashAmount = byMethod[PaymentMethod.CASH] || 0;
    const mobileMoneyAmount = byMethod[PaymentMethod.MOBILE_MONEY] || 0;
    const cardAmount = byMethod[PaymentMethod.CARD] || 0;
    const bankTransferAmount = byMethod[PaymentMethod.BANK_TRANSFER] || 0;
    const insuranceAmount = byMethod[PaymentMethod.INSURANCE] || 0;
    const otherAmount =
      totalCollected -
      cashAmount -
      mobileMoneyAmount -
      cardAmount -
      bankTransferAmount -
      insuranceAmount;

    return {
      totalCollected,
      cashAmount,
      mobileMoneyAmount,
      cardAmount,
      bankTransferAmount,
      insuranceAmount,
      otherAmount,
      paymentCount: payments.length,
      byMethod,
    };
  }

  async getPendingInvoices(tenantId?: string): Promise<Invoice[]> {
    const where: any[] = [
      { status: InvoiceStatus.PENDING },
      { status: InvoiceStatus.PARTIALLY_PAID },
    ];
    if (tenantId) {
      where[0].tenantId = tenantId;
      where[1].tenantId = tenantId;
    }
    return this.invoiceRepository.find({
      where,
      relations: ['patient', 'items', 'encounter'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Patient running tab — consolidated view of a patient's billing across the
   * current (or specified) encounter. The cashier can use this at any stage of
   * the hospital flow to see what's been charged, what's been paid, what's
   * still owed, and to print an interim bill.
   *
   * - When `encounterId` is supplied, only that encounter's invoices are returned.
   * - Otherwise, returns ALL non-cancelled invoices for the patient that still
   *   carry an unpaid balance, plus the most recent paid ones in the same window.
   * - Items are grouped by chargeType for easy printing.
   */
  async getPatientTab(
    patientId: string,
    encounterId?: string,
    tenantId?: string,
  ): Promise<{
    patientId: string;
    encounterId?: string;
    generatedAt: string;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      status: InvoiceStatus;
      createdAt: Date;
      subtotal: number;
      totalAmount: number;
      amountPaid: number;
      balanceDue: number;
      paymentType: string | null;
      items: Array<{
        id: string;
        serviceCode: string;
        description: string;
        chargeType: string;
        quantity: number;
        unitPrice: number;
        amount: number;
      }>;
    }>;
    summary: {
      itemsByChargeType: Record<string, { count: number; total: number }>;
      grandTotal: number;
      grandPaid: number;
      grandBalance: number;
    };
  }> {
    const where: any = { patientId };
    if (encounterId) where.encounterId = encounterId;
    if (tenantId) where.tenantId = tenantId;

    const invoices = await this.invoiceRepository.find({
      where,
      relations: ['items'],
      order: { createdAt: 'ASC' },
    });

    // Filter out cancelled / refunded
    const active = invoices.filter(
      (inv) =>
        inv.status !== InvoiceStatus.CANCELLED &&
        inv.status !== InvoiceStatus.REFUNDED &&
        inv.status !== InvoiceStatus.WRITTEN_OFF,
    );

    let grandTotal = 0;
    let grandPaid = 0;
    let grandBalance = 0;
    const itemsByChargeType: Record<string, { count: number; total: number }> = {};

    const shaped = active.map((inv) => {
      grandTotal += Number(inv.totalAmount);
      grandPaid += Number(inv.amountPaid);
      grandBalance += Number(inv.balanceDue);
      const items = (inv.items || []).map((it) => {
        const ct = String(it.chargeType);
        if (!itemsByChargeType[ct]) itemsByChargeType[ct] = { count: 0, total: 0 };
        itemsByChargeType[ct].count += 1;
        itemsByChargeType[ct].total += Number(it.amount);
        return {
          id: it.id,
          serviceCode: it.serviceCode,
          description: it.description,
          chargeType: ct,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          amount: Number(it.amount),
        };
      });
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        createdAt: inv.createdAt,
        subtotal: Number(inv.subtotal),
        totalAmount: Number(inv.totalAmount),
        amountPaid: Number(inv.amountPaid),
        balanceDue: Number(inv.balanceDue),
        paymentType: inv.paymentType ?? null,
        items,
      };
    });

    return {
      patientId,
      encounterId,
      generatedAt: new Date().toISOString(),
      invoices: shaped,
      summary: {
        itemsByChargeType,
        grandTotal,
        grandPaid,
        grandBalance,
      },
    };
  }

  async cancelInvoice(
    id: string,
    reason: string,
    userId?: string,
    tenantId?: string,
  ): Promise<Invoice> {
    // P1: reason is now required
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Cancellation reason is required');
    }

    // P1: Wrap in transaction with pessimistic lock to prevent race with recordPayment()
    return this.dataSource.transaction(async (manager) => {
      const invoice = await manager.findOne(Invoice, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // Load relations separately (pessimistic lock doesn't support joins)
      const payments = await manager.find(Payment, { where: { invoiceId: id } });
      invoice.payments = payments;
      if (invoice.encounterId) {
        const enc = await manager.findOne(Encounter, { where: { id: invoice.encounterId } });
        if (enc) invoice.encounter = enc;
      }

      // Segregation of duties: the user who created the invoice cannot cancel it
      if (userId && invoice.createdById && invoice.createdById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the user who created the invoice cannot cancel it',
        );
      }

      // Segregation of duties: a user who collected any completed payment on this
      // invoice cannot also cancel it.
      if (userId) {
        const collectorOverlap = (invoice.payments || []).some(
          (p) => p.status === PaymentStatus.COMPLETED && p.receivedById === userId,
        );
        if (collectorOverlap) {
          throw new BadRequestException(
            'Segregation of duties violation: a user who collected payment on this invoice cannot also cancel it',
          );
        }
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Cannot cancel a paid invoice. Use refund instead.');
      }

      // P0: Block cancellation of partially-paid invoices — payments are COMPLETED on a
      // CANCELLED invoice, creating a reconciliation gap. Require refund of payments first.
      if (invoice.status === InvoiceStatus.PARTIALLY_PAID) {
        throw new BadRequestException(
          'Cannot cancel a partially paid invoice. Refund or void the outstanding payments first, then cancel.',
        );
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException('Invoice is already cancelled');
      }

      invoice.status = InvoiceStatus.CANCELLED;
      invoice.notes =
        `${invoice.notes || ''}\nCancelled${userId ? ` by ${userId}` : ''}: ${reason}`.trim();

      const saved = await manager.save(Invoice, invoice);

      // Enhancement B: Reverse consumable inventory deductions for cancelled invoice
      await this.autoReverseServiceConsumables(invoice, userId || 'system', tenantId).catch(
        (err) => {
          this.logger.warn(
            `Auto-reverse consumables failed for cancelled ${invoice.invoiceNumber}: ${err?.message || err}`,
          );
        },
      );

      // Post GL reversal: CR Accounts Receivable, DR Revenue (reverses the original posting)
      if (invoice.encounter?.facilityId && Number(invoice.totalAmount) > 0) {
        this.financeService
          .autoPostInvoiceJournal(
            {
              facilityId: invoice.encounter.facilityId,
              invoiceNumber: `${invoice.invoiceNumber}-REVERSAL`,
              totalAmount: -Number(invoice.totalAmount),
              revenueCategory: invoice.paymentType || 'consultation',
              userId: userId || 'system',
            },
            tenantId,
          )
          .catch((err) =>
            this.logger.error(
              `GL reversal failed for cancelled invoice ${invoice.invoiceNumber}: ${err.message}`,
              {
                invoiceNumber: invoice.invoiceNumber,
                totalAmount: invoice.totalAmount,
                error: err.stack,
              },
            ),
          );
      }

      if (userId) {
        await this.auditLogService
          .log({
            userId,
            action: 'INVOICE_CANCELLED',
            entityType: 'Invoice',
            entityId: invoice.id,
            oldValue: {
              status: 'previous',
              totalAmount: Number(invoice.totalAmount),
              invoiceNumber: invoice.invoiceNumber,
            },
            newValue: { status: InvoiceStatus.CANCELLED },
            reason,
            ...(tenantId ? { tenantId } : {}),
          })
          .catch((err) =>
            this.logger.error(`Audit log failed for cancelInvoice ${invoice.id}: ${err.message}`),
          );
      }

      return saved;
    });
  }

  async refundInvoice(
    id: string,
    reason?: string,
    userId?: string,
    tenantId?: string,
  ): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const paymentRepo = manager.getRepository(Payment);

      const invoice = await invoiceRepo.findOne({
        where: { id, ...(tenantId ? { tenantId } : {}) },
        relations: ['patient', 'payments', 'encounter'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // Segregation of duties: the user who created the invoice cannot refund it
      if (userId && invoice.createdById && invoice.createdById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the user who created the invoice cannot process a refund',
        );
      }

      // Segregation of duties: a user who collected any completed payment on this
      // invoice cannot also process the refund. Mirrors the per-payment check in
      // refundPayment(); without it a cashier could close their own day's float
      // by refunding the very payments they took.
      if (userId) {
        const collectorOverlap = (invoice.payments || []).some(
          (p) => p.status === PaymentStatus.COMPLETED && p.receivedById === userId,
        );
        if (collectorOverlap) {
          throw new BadRequestException(
            'Segregation of duties violation: a user who collected payment on this invoice cannot also process its refund',
          );
        }
      }

      if (
        invoice.status !== InvoiceStatus.PAID &&
        invoice.status !== InvoiceStatus.PARTIALLY_PAID
      ) {
        throw new BadRequestException('Can only refund paid or partially paid invoices');
      }

      // Void all completed payments for this invoice
      const completedPayments = (invoice.payments || []).filter(
        (p) => p.status === PaymentStatus.COMPLETED,
      );
      for (const payment of completedPayments) {
        payment.status = PaymentStatus.VOIDED;
        payment.notes = `${payment.notes || ''}\nRefunded: ${reason || 'Invoice refund'}`.trim();
        await paymentRepo.save(payment);
      }

      const refundAmount = Number(invoice.amountPaid);

      invoice.status = InvoiceStatus.REFUNDED;
      invoice.amountPaid = 0;
      invoice.balanceDue = Number(invoice.totalAmount);
      invoice.notes = reason ? `${invoice.notes || ''}\nRefunded: ${reason}`.trim() : invoice.notes;

      const saved = await invoiceRepo.save(invoice);

      // Post GL reversal: CR Revenue, DR Cash (reverses original invoice + payment postings)
      if (invoice.encounter?.facilityId && refundAmount > 0) {
        // Reverse the revenue recognition (CR AR, DR Revenue)
        this.financeService
          .autoPostInvoiceJournal(
            {
              facilityId: invoice.encounter.facilityId,
              invoiceNumber: `${invoice.invoiceNumber}-REFUND`,
              totalAmount: -Number(invoice.totalAmount),
              revenueCategory: invoice.paymentType || 'consultation',
              userId: userId || 'system',
            },
            tenantId,
          )
          .catch((err) =>
            this.logger.error(
              `GL reversal failed for refunded invoice ${invoice.invoiceNumber}: ${err.message}`,
              {
                invoiceNumber: invoice.invoiceNumber,
                totalAmount: invoice.totalAmount,
                error: err.stack,
              },
            ),
          );

        // Reverse the cash receipt (DR AR, CR Cash)
        this.financeService
          .autoPostPatientPaymentJournal(
            {
              facilityId: invoice.encounter.facilityId,
              receiptNumber: `${invoice.invoiceNumber}-REFUND`,
              amount: -refundAmount,
              paymentMethod: completedPayments[0]?.method || 'cash',
              userId: userId || 'system',
            },
            tenantId,
          )
          .catch((err) =>
            this.logger.error(
              `GL payment reversal failed for refunded invoice ${invoice.invoiceNumber}: ${err.message}`,
              { invoiceNumber: invoice.invoiceNumber, refundAmount, error: err.stack },
            ),
          );
      }

      if (userId) {
        await this.auditLogService
          .log({
            userId,
            action: 'INVOICE_REFUNDED',
            entityType: 'Invoice',
            entityId: invoice.id,
            oldValue: {
              totalAmount: Number(invoice.totalAmount),
              amountPaid: refundAmount,
              invoiceNumber: invoice.invoiceNumber,
            },
            newValue: { status: InvoiceStatus.REFUNDED, refundAmount },
            reason: reason || 'No reason provided',
            ...(tenantId ? { tenantId } : {}),
          })
          .catch((err) =>
            this.logger.error(`Audit log failed for refundInvoice ${invoice.id}: ${err.message}`),
          );
      }

      return saved;
    });
  }

  /**
   * Add billable item to encounter's invoice (creates invoice if none exists)
   * Used by Orders, Lab, Pharmacy modules to auto-bill services
   */
  async addBillableItem(
    params: {
      encounterId: string;
      patientId: string;
      serviceCode: string;
      description: string;
      quantity: number;
      unitPrice: number;
      chargeType?: string;
      referenceType?: string;
      referenceId?: string;
      insurancePolicyId?: string;
      paymentType?: string;
      serviceId?: string;
      labTestId?: string;
    },
    userId: string,
    tenantId?: string,
  ): Promise<InvoiceItem> {
    return this.dataSource.transaction(async (manager) => {
      // Find or create invoice for this encounter (with pessimistic lock)
      let invoice = await manager.findOne(Invoice, {
        where: {
          encounterId: params.encounterId,
          status: In([InvoiceStatus.DRAFT, InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID]),
          ...(tenantId ? { tenantId } : {}),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) {
        // P0: Use outer transaction manager — inner transaction releases advisory lock too early
        const invoiceNumber = await this.generateInvoiceNumber(manager, tenantId);
        invoice = await manager.save(
          Invoice,
          manager.create(Invoice, {
            invoiceNumber,
            patientId: params.patientId,
            encounterId: params.encounterId,
            createdById: userId,
            subtotal: 0,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            balanceDue: 0,
            status: InvoiceStatus.PENDING,
            ...(params.insurancePolicyId ? { insurancePolicyId: params.insurancePolicyId } : {}),
            ...(params.paymentType ? { paymentType: params.paymentType as PaymentType } : {}),
            ...(tenantId ? { tenantId } : {}),
          }),
        );
      }

      // Deduplication: skip if item with same referenceType + referenceId already exists
      if (params.referenceType && params.referenceId) {
        const duplicate = await manager.findOne(InvoiceItem, {
          where: {
            invoiceId: invoice.id,
            referenceType: params.referenceType,
            referenceId: params.referenceId,
          },
        });
        if (duplicate) {
          this.logger.warn(
            `Duplicate billable item skipped: ${params.referenceType}/${params.referenceId} on invoice ${invoice.invoiceNumber}`,
          );
          return duplicate;
        }
      }

      // Resolve insurance pricing if applicable
      let resolvedUnitPrice = params.unitPrice;
      let insuranceCoveredAmount: number | undefined;
      let patientCopay: number | undefined;
      let coverageNote: string | undefined;

      // Check if the encounter is insurance-based
      const encounter = await manager.findOne(Encounter, {
        where: { id: params.encounterId },
        relations: ['insurancePolicy', 'insurancePolicy.provider'],
      });

      if (encounter?.payerType === 'insurance' && encounter.insurancePolicyId) {
        let isCovered = true;

        try {
          const resolved = await this.pricingEngineService.resolvePrice(
            {
              serviceId: params.serviceId,
              labTestId: params.labTestId,
              patientId: params.patientId,
              encounterId: params.encounterId,
              payerType: 'insurance',
              insuranceProviderId: encounter.insurancePolicy?.providerId,
            },
            tenantId,
          );

          if (resolved && resolved.finalPrice > 0) {
            resolvedUnitPrice = resolved.finalPrice;
          }

          // Run coverage check (exclusions, annual limit, pre-auth)
          try {
            const coverageResult = await this.coverageCheckService.checkCoverage(
              {
                patientId: params.patientId,
                items: [{ drugId: params.serviceCode, quantity: params.quantity }],
              },
              tenantId,
            );

            const detail = coverageResult.coverageDetails?.[0];
            if (detail && !detail.covered) {
              isCovered = false;
              coverageNote = detail.rejectionReason || 'Not covered by insurance';
              this.logger.log(`Item ${params.serviceCode} not covered: ${coverageNote}`);
            } else if (detail?.requiresPreAuth) {
              coverageNote = 'Requires pre-authorization';
            }
          } catch (covErr) {
            this.logger.warn(`Coverage check failed for ${params.serviceCode}: ${covErr.message}`);
          }

          // Calculate copay from policy (only if covered)
          const policy = encounter.insurancePolicy;
          if (policy && isCovered) {
            const copayPercent = Number(policy.copayPercentage || 0);
            const copayFixed = Number(policy.copayAmount || 0);
            const totalAmount = multiply(params.quantity, resolvedUnitPrice);

            if (copayPercent > 0 && copayPercent <= 100) {
              patientCopay = Math.round((totalAmount * copayPercent) / 100);
              insuranceCoveredAmount = totalAmount - patientCopay;
            } else if (copayFixed > 0) {
              patientCopay = Math.min(copayFixed, totalAmount);
              insuranceCoveredAmount = totalAmount - patientCopay;
            } else {
              insuranceCoveredAmount = totalAmount;
              patientCopay = 0;
            }
          } else if (!isCovered) {
            // Not covered — patient pays full amount
            insuranceCoveredAmount = 0;
            patientCopay = 0;
          }
        } catch (err) {
          this.logger.warn(
            `Failed to resolve insurance price for ${params.serviceCode}: ${err.message}`,
          );
        }

        // Also ensure the invoice has insurance fields set
        if (!invoice.insurancePolicyId) {
          await manager.update(Invoice, invoice.id, {
            insurancePolicyId: encounter.insurancePolicyId,
            paymentType: PaymentType.INSURANCE,
          });
        }
      }

      // Add item — P1: stamp tenantId explicitly for cascading insert isolation
      const amount = multiply(params.quantity, resolvedUnitPrice);
      const item = await manager.save(
        InvoiceItem,
        manager.create(InvoiceItem, {
          invoiceId: invoice.id,
          serviceCode: params.serviceCode,
          description: params.description,
          chargeType: (params.chargeType as any) || undefined,
          quantity: params.quantity,
          unitPrice: resolvedUnitPrice,
          amount,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          insuranceCovered: insuranceCoveredAmount != null && insuranceCoveredAmount > 0,
          insuranceAmount: insuranceCoveredAmount || 0,
          copayAmount: patientCopay || 0,
          coverageNote: coverageNote,
          ...(tenantId ? { tenantId } : {}),
        }),
      );

      // Recalculate invoice totals
      await this.recalculateInvoice(invoice.id, tenantId);

      // P1: Audit log for billable item additions
      this.auditLogService
        .log({
          userId,
          action: 'BILLABLE_ITEM_ADDED',
          entityType: 'InvoiceItem',
          entityId: item.id,
          newValue: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            serviceCode: params.serviceCode,
            description: params.description,
            quantity: params.quantity,
            unitPrice: resolvedUnitPrice,
            amount,
          },
          ...(tenantId ? { tenantId } : {}),
        })
        .catch((err) => this.logger.error(`Audit log failed for addBillableItem: ${err.message}`));

      return item;
    });
  }

  /** Update an existing billable item by reference (returns true if updated) */
  async updateBillableItem(
    params: {
      referenceType: string;
      referenceId: string;
      description?: string;
      quantity?: number;
      unitPrice?: number;
    },
    userId?: string,
    tenantId?: string,
  ): Promise<boolean> {
    // P0: Wrap in transaction with pessimistic lock on parent invoice
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(InvoiceItem, {
        where: {
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          ...(tenantId ? { tenantId } : {}),
        },
      });
      if (!existing) return false;

      // P1: Block modifications on terminal invoice statuses
      const invoice = await manager.findOne(Invoice, {
        where: { id: existing.invoiceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) return false;
      const terminalStatuses: InvoiceStatus[] = [
        InvoiceStatus.PAID,
        InvoiceStatus.CANCELLED,
        InvoiceStatus.REFUNDED,
        InvoiceStatus.WRITTEN_OFF,
      ];
      if (terminalStatuses.includes(invoice.status)) {
        throw new BadRequestException(`Cannot modify items on a ${invoice.status} invoice`);
      }

      const oldAmount = existing.amount;
      if (params.description !== undefined) existing.description = params.description;
      if (params.quantity !== undefined) existing.quantity = params.quantity;
      if (params.unitPrice !== undefined) existing.unitPrice = params.unitPrice;
      existing.amount = multiply(existing.quantity, existing.unitPrice);

      await manager.save(InvoiceItem, existing);
      this.logger.log(
        `Billable item updated: ${params.referenceType}/${params.referenceId} by ${userId || 'unknown'}`,
      );

      // Recalculate within the same transaction context
      await this.recalculateInvoiceInTxn(manager, existing.invoiceId, tenantId);

      // P1: Audit log
      if (userId) {
        this.auditLogService
          .log({
            userId,
            action: 'BILLABLE_ITEM_UPDATED',
            entityType: 'InvoiceItem',
            entityId: existing.id,
            oldValue: { amount: Number(oldAmount) },
            newValue: {
              quantity: existing.quantity,
              unitPrice: existing.unitPrice,
              amount: existing.amount,
            },
            ...(tenantId ? { tenantId } : {}),
          })
          .catch((err) =>
            this.logger.error(`Audit log failed for updateBillableItem: ${err.message}`),
          );
      }

      return true;
    });
  }

  /** Remove a billable item by reference */
  async removeBillableItem(
    referenceType: string,
    referenceId: string,
    userId?: string,
    tenantId?: string,
  ): Promise<boolean> {
    // P0: Wrap in transaction with pessimistic lock on parent invoice
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(InvoiceItem, {
        where: { referenceType, referenceId, ...(tenantId ? { tenantId } : {}) },
      });
      if (!existing) return false;

      // P1: Block modifications on terminal invoice statuses
      const invoice = await manager.findOne(Invoice, {
        where: { id: existing.invoiceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) return false;
      const terminalStatuses: InvoiceStatus[] = [
        InvoiceStatus.PAID,
        InvoiceStatus.CANCELLED,
        InvoiceStatus.REFUNDED,
        InvoiceStatus.WRITTEN_OFF,
      ];
      if (terminalStatuses.includes(invoice.status)) {
        throw new BadRequestException(`Cannot remove items from a ${invoice.status} invoice`);
      }

      const invoiceId = existing.invoiceId;
      const removedItem = { ...existing };
      await manager.remove(InvoiceItem, existing);
      this.logger.log(
        `Billable item removed: ${referenceType}/${referenceId} from invoice ${invoiceId} by ${userId || 'unknown'}`,
      );

      // Recalculate within the same transaction context
      await this.recalculateInvoiceInTxn(manager, invoiceId, tenantId);

      // P1: Audit log
      if (userId) {
        this.auditLogService
          .log({
            userId,
            action: 'BILLABLE_ITEM_REMOVED',
            entityType: 'InvoiceItem',
            entityId: removedItem.id,
            oldValue: {
              invoiceId,
              serviceCode: removedItem.serviceCode,
              description: removedItem.description,
              amount: Number(removedItem.amount),
            },
            ...(tenantId ? { tenantId } : {}),
          })
          .catch((err) =>
            this.logger.error(`Audit log failed for removeBillableItem: ${err.message}`),
          );
      }

      return true;
    });
  }

  // ============ REVENUE DASHBOARD ============

  async getRevenueDashboard(
    facilityId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'monthly',
    tenantId?: string,
  ): Promise<{
    totalRevenue: number;
    revenueBySource: Array<{ source: string; current: number; previous: number; target: number }>;
    topGenerators: Array<{ name: string; department: string; revenue: number; visits: number }>;
    receivables: Array<{
      id: string;
      customer: string;
      type: string;
      amount: number;
      dueDate: string;
      aging: number;
    }>;
    dailyTrend: Array<{ day: string; revenue: number }>;
  }> {
    const now = new Date();
    let periodDays: number;

    switch (period) {
      case 'daily':
        periodDays = 1;
        break;
      case 'weekly':
        periodDays = 7;
        break;
      default:
        periodDays = 30;
    }

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - periodDays);
    startDate.setHours(0, 0, 0, 0);

    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - periodDays);

    // Get current period payments — P1: join through encounter to filter by facilityId
    const currentPaymentsQb = this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.invoice', 'inv')
      .leftJoin('inv.encounter', 'enc')
      .where('p.paid_at >= :startDate', { startDate })
      .andWhere('p.paid_at <= :now', { now })
      .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED });

    if (facilityId) {
      currentPaymentsQb.andWhere('enc.facility_id = :facilityId', { facilityId });
    }
    if (tenantId) {
      currentPaymentsQb.andWhere('p.tenant_id = :tenantId', { tenantId });
    }

    const currentPayments = await currentPaymentsQb.getMany();

    // Get previous period payments for comparison
    const previousPaymentsQb = this.paymentRepository
      .createQueryBuilder('p')
      .leftJoin('p.invoice', 'inv2')
      .leftJoin('inv2.encounter', 'enc2')
      .where('p.paid_at >= :start', { start: previousStart })
      .andWhere('p.paid_at < :end', { end: startDate })
      .andWhere('p.status = :status', { status: PaymentStatus.COMPLETED });

    if (facilityId) {
      previousPaymentsQb.andWhere('enc2.facility_id = :facilityId', { facilityId });
    }
    if (tenantId) {
      previousPaymentsQb.andWhere('p.tenant_id = :tenantId', { tenantId });
    }

    const previousPayments = await previousPaymentsQb.getMany();

    const totalRevenue = currentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const previousRevenue = previousPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Revenue by source - calculate from actual invoice items charge types
    const currentInvoiceIds = currentPayments.map((p) => p.invoiceId).filter(Boolean);
    const previousInvoiceIds = previousPayments.map((p) => p.invoiceId).filter(Boolean);

    // Get revenue breakdown by charge type from invoice items
    const getRevenueByChargeType = async (invoiceIds: string[]) => {
      if (invoiceIds.length === 0) {
        return { opd: 0, lab: 0, pharmacy: 0, imaging: 0, procedures: 0, other: 0 };
      }

      // P1: Filter out items from cancelled/refunded/written_off invoices
      const items = await this.itemRepository
        .createQueryBuilder('item')
        .innerJoin('item.invoice', 'inv')
        .where('item.invoice_id IN (:...ids)', { ids: invoiceIds })
        .andWhere('inv.status NOT IN (:...excludedStatuses)', {
          excludedStatuses: [
            InvoiceStatus.CANCELLED,
            InvoiceStatus.REFUNDED,
            InvoiceStatus.WRITTEN_OFF,
          ],
        })
        .getMany();

      const breakdown: any = { opd: 0, lab: 0, pharmacy: 0, imaging: 0, procedures: 0, other: 0 };
      for (const item of items) {
        const amount = Number(item.amount) || Number(item.quantity) * Number(item.unitPrice);
        const chargeType = (item.chargeType || 'other').toLowerCase();

        if (chargeType === 'consultation' || chargeType === 'opd') {
          breakdown.opd += amount;
        } else if (chargeType === 'laboratory' || chargeType === 'lab') {
          breakdown.lab += amount;
        } else if (chargeType === 'pharmacy' || chargeType === 'medication') {
          breakdown.pharmacy += amount;
        } else if (chargeType === 'radiology' || chargeType === 'imaging') {
          breakdown.imaging += amount;
        } else if (chargeType === 'procedure' || chargeType === 'procedures') {
          breakdown.procedures += amount;
        } else {
          breakdown.other += amount;
        }
      }
      return breakdown;
    };

    const currentBreakdown = await getRevenueByChargeType(currentInvoiceIds);
    const previousBreakdown = await getRevenueByChargeType(previousInvoiceIds);

    // Load revenue targets from settings (key: revenue_targets), fall back to defaults
    let revenueTargets: Record<string, number> = {
      opd: 5000000,
      lab: 2500000,
      pharmacy: 3000000,
      imaging: 500000,
      procedures: 1000000,
      other: 200000,
    };
    try {
      const targetSetting = await this.settingsService.getByKey('revenue_targets');
      const parsed = JSON.parse(targetSetting.value);
      if (parsed && typeof parsed === 'object') revenueTargets = { ...revenueTargets, ...parsed };
    } catch {
      /* use defaults */
    }

    const sources = ['opd', 'lab', 'pharmacy', 'imaging', 'procedures', 'other'] as const;
    const revenueBySource = sources.map((source) => ({
      source,
      current: currentBreakdown[source] || 0,
      previous: previousBreakdown[source] || 0,
      target: revenueTargets[source] || 0,
    }));

    // Get pending receivables
    const pendingInvoicesQb = this.invoiceRepository
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.patient', 'patient')
      .where('inv.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
      })
      .orderBy('inv.dueDate', 'ASC')
      .take(10);

    if (tenantId) {
      pendingInvoicesQb.andWhere('inv.tenant_id = :tenantId', { tenantId });
    }

    const pendingInvoices = await pendingInvoicesQb.getMany();

    const receivables = pendingInvoices.map((inv) => {
      // P2: Use dueDate for aging calculation (not createdAt) — reflects actual payment terms
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.createdAt);
      if (!inv.dueDate) dueDate.setDate(dueDate.getDate() + 30); // Default 30-day terms
      const agingBase = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.createdAt);
      const aging = Math.floor((now.getTime() - agingBase.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: inv.id,
        customer: inv.patient?.fullName || 'Unknown Patient',
        type: 'patient' as const,
        amount: Number(inv.totalAmount) - Number(inv.amountPaid || 0),
        dueDate: dueDate.toISOString().split('T')[0],
        aging,
      };
    });

    // Daily trend for the past 7 days
    const dailyTrend: Array<{ day: string; revenue: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayPayments = currentPayments.filter((p) => {
        const paidAt = new Date(p.paidAt);
        return paidAt >= dayStart && paidAt <= dayEnd;
      });

      dailyTrend.push({
        day: day.toLocaleDateString('en-UG', { weekday: 'short' }),
        revenue: dayPayments.reduce((sum, p) => sum + Number(p.amount), 0),
      });
    }

    // Top generators — real query from invoice items grouped by charge type and description
    const topGeneratorsQb = this.itemRepository
      .createQueryBuilder('item')
      .select('item.description', 'name')
      .addSelect('item.charge_type', 'chargeType')
      .addSelect('SUM(item.amount)', 'revenue')
      .addSelect('COUNT(DISTINCT item.invoice_id)', 'visits')
      .innerJoin('item.invoice', 'inv')
      .where('inv.created_at >= :startDate', { startDate })
      .andWhere('inv.status != :cancelled', { cancelled: 'cancelled' })
      .groupBy('item.description')
      .addGroupBy('item.charge_type')
      .orderBy('revenue', 'DESC')
      .limit(10);

    if (tenantId) {
      topGeneratorsQb.andWhere('inv.tenant_id = :tenantId', { tenantId });
    }

    const topGeneratorsRaw = await topGeneratorsQb.getRawMany();

    const deptMap: Record<string, string> = {
      consultation: 'OPD',
      lab: 'Laboratory',
      pharmacy: 'Pharmacy',
      radiology: 'Radiology',
      procedure: 'Theatre',
      bed: 'IPD',
      nursing: 'Nursing',
      other: 'Other',
    };

    const topGenerators = topGeneratorsRaw
      .map((r) => ({
        name: r.name || r.description,
        department: deptMap[r.chargeType || r.charge_type] || 'Other',
        revenue: Number(r.revenue) || 0,
        visits: Number(r.visits) || 0,
      }))
      .filter((g) => g.revenue > 0);

    return {
      totalRevenue,
      revenueBySource,
      topGenerators,
      receivables,
      dailyTrend,
    };
  }

  // ============ WRITE-OFFS ============

  /**
   * Default write-off threshold (in tenant currency, default UGX).
   * Amounts above this require the `finance.write_off_large` permission, or
   * (back-compat) one of the supervisor/admin/finance_manager roles.
   * P2: Now loaded from system settings `write_off_threshold` per tenant at runtime.
   */
  private static readonly DEFAULT_WRITE_OFF_LIMIT = 5_000_000;
  private static readonly WRITE_OFF_SUPERVISOR_ROLES = [
    'supervisor',
    'admin',
    'finance_manager',
    'Finance Manager',
    'Super Admin',
  ];

  async writeOffInvoice(
    invoiceId: string,
    reason: string,
    userId: string,
    tenantId?: string,
    userRoles?: string[],
    userPermissions?: string[],
  ): Promise<Invoice> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Write-off reason is required');
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock the invoice row so a concurrent payment / cancel / write-off
      // cannot race against us between status check and status flip.
      const invoice = await manager.findOne(Invoice, {
        where: { id: invoiceId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      // Encounter is loaded separately because pessimistic locks cannot be
      // combined with relations (FOR UPDATE on nullable side of outer join).
      if (invoice.encounterId) {
        const enc = await manager.findOne(Encounter, {
          where: { id: invoice.encounterId },
        });
        if (enc) invoice.encounter = enc;
      }
      if (invoice.status === InvoiceStatus.PAID)
        throw new BadRequestException('Cannot write off a paid invoice');
      if (invoice.status === InvoiceStatus.CANCELLED)
        throw new BadRequestException('Cannot write off a cancelled invoice');
      if (invoice.status === InvoiceStatus.REFUNDED)
        throw new BadRequestException('Cannot write off a refunded invoice');
      if (invoice.status === InvoiceStatus.WRITTEN_OFF)
        throw new BadRequestException('Invoice is already written off');

      // P1: Maker-checker — the creator of the invoice cannot write it off
      if (invoice.createdById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the user who created the invoice cannot write it off',
        );
      }

      const writeOffAmount = Number(invoice.balanceDue);
      if (writeOffAmount <= 0) {
        throw new BadRequestException('Nothing to write off — invoice has no outstanding balance');
      }

      // P2: Load configurable threshold from system settings, fall back to default
      let writeOffLimit = BillingService.DEFAULT_WRITE_OFF_LIMIT;
      try {
        const setting = await this.settingsService.getByKey('write_off_threshold');
        const parsed = Number(setting?.value);
        if (parsed > 0) writeOffLimit = parsed;
      } catch {
        /* use default */
      }

      // Enforce threshold via permission first, then back-compat role list.
      if (writeOffAmount > writeOffLimit) {
        const perms = userPermissions || [];
        const roles = userRoles || [];
        const hasLargeWriteOffPerm =
          perms.includes('finance.write_off_large') || perms.includes('finance.manage_large');
        const isSupervisor = roles.some((r) =>
          BillingService.WRITE_OFF_SUPERVISOR_ROLES.includes(r),
        );
        if (!hasLargeWriteOffPerm && !isSupervisor) {
          throw new BadRequestException(
            `Write-off amount (${writeOffAmount.toLocaleString()}) exceeds the limit of ` +
              `${writeOffLimit.toLocaleString()}. ` +
              `The 'finance.write_off_large' permission (or supervisor / finance-manager role) is required.`,
          );
        }
      }

      // P1: Use dedicated WRITTEN_OFF status instead of CANCELLED
      invoice.status = InvoiceStatus.WRITTEN_OFF;
      invoice.notes =
        `${invoice.notes || ''}\nWRITTEN OFF (${new Date().toISOString().slice(0, 10)}): ${reason} — Amount: ${writeOffAmount}`.trim();
      const saved = await manager.save(Invoice, invoice);

      // GL: DR Bad Debt Expense (5503), CR Accounts Receivable (1200).
      // financeService manages its own connection; failures are logged
      // loudly but do NOT roll back the invoice flip — operational policy
      // is that a written-off invoice must not silently revert to OPEN.
      // The audit log entry below records the discrepancy so reconciliation
      // can detect a missing GL leg.
      let glPosted = true;
      if (invoice.encounter?.facilityId) {
        try {
          await this.financeService.autoPostInvoiceJournal(
            {
              facilityId: invoice.encounter.facilityId,
              invoiceNumber: `WRITEOFF-${invoice.invoiceNumber}`,
              totalAmount: writeOffAmount,
              revenueCategory: 'write_off',
              userId,
            },
            tenantId,
          );
        } catch (err) {
          glPosted = false;
          this.logger.error(
            `GL write-off posting failed for ${invoice.invoiceNumber}: ${err.message}`,
            err.stack,
          );
        }
      }

      await this.auditLogService
        .log({
          userId,
          action: 'INVOICE_WRITTEN_OFF',
          entityType: 'Invoice',
          entityId: invoice.id,
          oldValue: {
            balanceDue: writeOffAmount,
            status: 'previous',
            invoiceNumber: invoice.invoiceNumber,
          },
          newValue: { status: InvoiceStatus.WRITTEN_OFF, writeOffAmount, glPosted },
          reason,
          ...(tenantId ? { tenantId } : {}),
        })
        .catch((err) =>
          this.logger.error(`Audit log failed for writeOffInvoice ${invoice.id}: ${err.message}`),
        );

      return saved;
    });
  }

  // ============ RECEIPT PRINT DATA ============

  async getReceiptPrintData(paymentId: string, tenantId?: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, ...(tenantId ? { tenantId } : {}) },
      relations: ['invoice', 'invoice.items', 'invoice.patient', 'invoice.encounter', 'receivedBy'],
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const invoice = payment.invoice;

    // Enhancement C: Load facility for URA-compliant receipt fields (name, address, TIN, logo)
    let facility: {
      name?: string;
      address?: string;
      tin?: string;
      logoUrl?: string;
      phone?: string;
    } = {};
    const facilityId = invoice?.encounter?.facilityId;
    if (facilityId) {
      const fac = await this.dataSource.getRepository(Facility).findOne({
        where: { id: facilityId },
      });
      if (fac) {
        facility = {
          name: fac.name,
          address: (fac as any).address || '',
          tin: (fac as any).tin || '',
          logoUrl: (fac as any).logoUrl || '',
          phone: (fac as any).phone || '',
        };
      }
    }

    return {
      receiptNumber: payment.receiptNumber,
      date: payment.paidAt || payment.createdAt,
      patientName: invoice?.patient?.fullName || 'Walk-in',
      patientMrn: invoice?.patient?.mrn || '',
      invoiceNumber: invoice?.invoiceNumber || '',
      items: (invoice?.items || []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        amount: Number(item.amount),
      })),
      subtotal: Number(invoice?.subtotal || 0),
      tax: Number(invoice?.taxAmount || 0),
      discount: Number(invoice?.discountAmount || 0),
      totalAmount: Number(invoice?.totalAmount || 0),
      amountPaid: Number(payment.amount),
      paymentMethod: payment.method,
      transactionReference: payment.transactionReference,
      balanceDue: Number(invoice?.balanceDue || 0),
      cashier: payment.receivedBy?.fullName || payment.receivedBy?.email || '',
      // Enhancement C: URA-compliant receipt fields
      facilityName: facility.name || '',
      facilityAddress: facility.address || '',
      facilityTin: facility.tin || '',
      facilityLogoUrl: facility.logoUrl || '',
      facilityPhone: facility.phone || '',
    };
  }
}
