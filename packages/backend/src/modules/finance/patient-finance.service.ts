import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  PatientCreditNote,
  CreditNoteStatus,
  PatientDeposit,
  DepositStatus,
  DepositApplication,
  Waiver,
  WaiverStatus,
} from '../../database/entities/finance-extended.entity';

function requireTenant(tenantId?: string): string {
  if (!tenantId) {
    throw new ForbiddenException('Tenant context required');
  }
  return tenantId;
}

@Injectable()
export class PatientFinanceService {
  private readonly logger = new Logger(PatientFinanceService.name);

  constructor(
    @InjectRepository(PatientCreditNote)
    private creditNoteRepo: Repository<PatientCreditNote>,
    @InjectRepository(PatientDeposit)
    private depositRepo: Repository<PatientDeposit>,
    @InjectRepository(DepositApplication)
    private depositAppRepo: Repository<DepositApplication>,
    @InjectRepository(Waiver)
    private waiverRepo: Repository<Waiver>,
    private dataSource: DataSource,
  ) {}

  // ─── CREDIT NOTES ───────────────────────────────────────────────────────────

  async createCreditNote(
    dto: {
      patientId: string;
      invoiceId?: string;
      noteNumber: string;
      amount: number;
      reason: string;
      issuedById: string;
      facilityId: string;
    },
    tenantId?: string,
  ): Promise<PatientCreditNote> {
    const creditNote = this.creditNoteRepo.create({
      patientId: dto.patientId,
      invoiceId: dto.invoiceId,
      noteNumber: dto.noteNumber,
      amount: dto.amount,
      reason: dto.reason,
      createdBy: dto.issuedById,
      facilityId: dto.facilityId,
      status: CreditNoteStatus.DRAFT,
      tenantId,
    });
    return this.creditNoteRepo.save(creditNote);
  }

  async findAllCreditNotes(
    patientId?: string,
    facilityId?: string,
    tenantId?: string,
  ): Promise<PatientCreditNote[]> {
    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;
    return this.creditNoteRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async applyCreditNote(
    creditNoteId: string,
    invoiceId: string,
    amount: number,
    tenantId?: string,
  ): Promise<PatientCreditNote> {
    const tid = requireTenant(tenantId);

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PatientCreditNote);

      const creditNote = await repo.findOne({
        where: { id: creditNoteId, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!creditNote) {
        throw new NotFoundException(`Credit note ${creditNoteId} not found`);
      }

      // Only APPROVED credit notes may be applied. DRAFT must go through approval first.
      if (creditNote.status !== CreditNoteStatus.APPROVED) {
        throw new BadRequestException(
          `Credit note must be APPROVED before application (current status: '${creditNote.status}')`,
        );
      }

      if (amount <= 0) {
        throw new BadRequestException('Application amount must be positive');
      }

      if (amount > Number(creditNote.amount)) {
        throw new BadRequestException(
          `Application amount ${amount} exceeds credit note amount ${creditNote.amount}`,
        );
      }

      creditNote.invoiceId = invoiceId;
      creditNote.status = CreditNoteStatus.APPLIED;
      creditNote.appliedAt = new Date();
      return repo.save(creditNote);
    });
  }

  // ─── DEPOSITS ───────────────────────────────────────────────────────────────

  async createDeposit(
    dto: {
      patientId: string;
      depositNumber: string;
      amount: number;
      paymentMethod: string;
      facilityId: string;
      receivedById: string;
      notes?: string;
    },
    tenantId?: string,
  ): Promise<PatientDeposit> {
    const deposit = this.depositRepo.create({
      patientId: dto.patientId,
      depositNumber: dto.depositNumber,
      amount: dto.amount,
      balance: dto.amount,
      paymentMethod: dto.paymentMethod,
      facilityId: dto.facilityId,
      receivedBy: dto.receivedById,
      notes: dto.notes,
      status: DepositStatus.ACTIVE,
      tenantId,
    });
    return this.depositRepo.save(deposit);
  }

  async getPatientDeposits(patientId: string, tenantId?: string): Promise<PatientDeposit[]> {
    const where: any = { patientId };
    if (tenantId) where.tenantId = tenantId;
    return this.depositRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async applyDeposit(
    depositId: string,
    invoiceId: string,
    amount: number,
    appliedById: string,
    tenantId?: string,
  ): Promise<DepositApplication> {
    return this.dataSource.transaction(async (manager) => {
      const depositRepo = manager.getRepository(PatientDeposit);
      const appRepo = manager.getRepository(DepositApplication);

      // Lock the deposit row to prevent concurrent applications
      const deposit = await depositRepo.findOne({
        where: { id: depositId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!deposit) {
        throw new NotFoundException(`Deposit ${depositId} not found`);
      }

      const currentBalance = Number(deposit.balance);
      if (amount > currentBalance) {
        throw new BadRequestException(
          `Application amount ${amount} exceeds available balance ${currentBalance}`,
        );
      }
      if (amount <= 0) {
        throw new BadRequestException('Application amount must be positive');
      }

      const application = appRepo.create({
        depositId,
        invoiceId,
        amount,
        appliedBy: appliedById,
        tenantId,
      });
      const savedApplication = await appRepo.save(application);

      const newBalance = currentBalance - amount;
      deposit.balance = newBalance;
      deposit.status =
        newBalance <= 0 ? DepositStatus.FULLY_APPLIED : DepositStatus.PARTIALLY_APPLIED;
      await depositRepo.save(deposit);

      return savedApplication;
    });
  }

  async getPatientBalance(
    patientId: string,
    tenantId?: string,
  ): Promise<{ totalDeposits: number; totalApplied: number; availableBalance: number }> {
    const where: any = { patientId };
    if (tenantId) where.tenantId = tenantId;

    const deposits = await this.depositRepo.find({ where });

    const totalDeposits = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
    const availableBalance = deposits.reduce((sum, d) => sum + Number(d.balance), 0);
    const totalApplied = totalDeposits - availableBalance;

    return { totalDeposits, totalApplied, availableBalance };
  }

  // ─── WAIVERS ────────────────────────────────────────────────────────────────

  async requestWaiver(
    dto: {
      invoiceId: string;
      patientId: string;
      requestedAmount: number;
      reason: string;
      requestedById: string;
      facilityId: string;
    },
    tenantId?: string,
  ): Promise<Waiver> {
    const waiver = this.waiverRepo.create({
      invoiceId: dto.invoiceId,
      patientId: dto.patientId,
      waiverAmount: dto.requestedAmount,
      reason: dto.reason,
      requestedBy: dto.requestedById,
      facilityId: dto.facilityId,
      status: WaiverStatus.PENDING,
      tenantId,
    });
    return this.waiverRepo.save(waiver);
  }

  async findAllWaivers(facilityId?: string, status?: string, tenantId?: string): Promise<Waiver[]> {
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    if (status) where.status = status;
    if (tenantId) where.tenantId = tenantId;
    return this.waiverRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async approveWaiver(
    waiverId: string,
    userId: string,
    amount: number,
    notes?: string,
    tenantId?: string,
  ): Promise<Waiver> {
    const tid = requireTenant(tenantId);
    if (!userId) throw new ForbiddenException('Authenticated user required');

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Waiver);
      const waiver = await repo.findOne({
        where: { id: waiverId, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!waiver) {
        throw new NotFoundException(`Waiver ${waiverId} not found`);
      }

      if (waiver.status !== WaiverStatus.PENDING) {
        throw new BadRequestException(
          `Waiver is in status '${waiver.status}' and cannot be approved`,
        );
      }

      // Segregation of duties: requester cannot approve their own waiver
      if (waiver.requestedBy && waiver.requestedBy === userId) {
        throw new ForbiddenException('You cannot approve a waiver you requested');
      }

      if (!(amount > 0)) {
        throw new BadRequestException('Approved waiver amount must be positive');
      }

      if (amount > Number(waiver.waiverAmount)) {
        throw new BadRequestException(
          `Approved waiver amount (${amount}) cannot exceed the requested amount (${waiver.waiverAmount})`,
        );
      }

      waiver.status = WaiverStatus.APPROVED;
      waiver.approvedBy = userId;
      waiver.waiverAmount = amount;
      waiver.approvedAt = new Date();
      return repo.save(waiver);
    });
  }

  async rejectWaiver(
    waiverId: string,
    userId: string,
    reason: string,
    tenantId?: string,
  ): Promise<Waiver> {
    const where: any = { id: waiverId };
    if (tenantId) where.tenantId = tenantId;

    const waiver = await this.waiverRepo.findOne({ where });
    if (!waiver) {
      throw new NotFoundException(`Waiver ${waiverId} not found`);
    }

    if (waiver.status !== WaiverStatus.PENDING) {
      throw new BadRequestException(
        `Waiver is in status '${waiver.status}' and cannot be rejected`,
      );
    }

    waiver.status = WaiverStatus.REJECTED;
    waiver.approvedBy = userId;
    waiver.rejectionReason = reason;
    return this.waiverRepo.save(waiver);
  }
}
