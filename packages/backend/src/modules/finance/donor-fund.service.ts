import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DonorFund,
  FundStatus,
  InterFacilityTransaction,
  InterFacilityStatus,
} from '../../database/entities/finance-extended.entity';

@Injectable()
export class DonorFundService {
  private readonly logger = new Logger(DonorFundService.name);

  constructor(
    @InjectRepository(DonorFund)
    private donorFundRepo: Repository<DonorFund>,
    @InjectRepository(InterFacilityTransaction)
    private interFacilityRepo: Repository<InterFacilityTransaction>,
  ) {}

  // ─── DONOR FUNDS ────────────────────────────────────────────────────────────

  async createDonorFund(
    dto: {
      facilityId: string;
      fundCode: string;
      name: string;
      donorName: string;
      grantAmount: number;
      restriction?: string;
      startDate: string;
      endDate?: string;
      description?: string;
      accountId?: string;
    },
    tenantId?: string,
  ): Promise<DonorFund> {
    const fund = this.donorFundRepo.create({
      facilityId: dto.facilityId,
      fundCode: dto.fundCode,
      name: dto.name,
      donorName: dto.donorName,
      grantAmount: dto.grantAmount,
      remainingBalance: dto.grantAmount,
      disbursedAmount: 0,
      restriction: dto.restriction as any,
      startDate: dto.startDate as any,
      endDate: dto.endDate as any,
      description: dto.description,
      accountId: dto.accountId,
      status: FundStatus.ACTIVE,
      tenantId,
    });
    return this.donorFundRepo.save(fund);
  }

  async findAllDonorFunds(facilityId?: string, tenantId?: string): Promise<DonorFund[]> {
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;
    return this.donorFundRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOneDonorFund(id: string, tenantId?: string): Promise<DonorFund> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const fund = await this.donorFundRepo.findOne({ where });
    if (!fund) {
      throw new NotFoundException(`Donor fund ${id} not found`);
    }
    return fund;
  }

  async recordDonorExpense(
    fundId: string,
    amount: number,
    description: string,
    userId: string,
    tenantId?: string,
  ): Promise<DonorFund> {
    const fund = await this.findOneDonorFund(fundId, tenantId);

    const newDisbursed = Number(fund.disbursedAmount) + amount;
    if (newDisbursed > Number(fund.grantAmount)) {
      throw new BadRequestException(
        `Expense amount ${amount} would exceed grant amount ${fund.grantAmount} (already disbursed: ${fund.disbursedAmount})`,
      );
    }

    fund.disbursedAmount = newDisbursed;
    fund.remainingBalance = Number(fund.grantAmount) - newDisbursed;

    if (fund.remainingBalance <= 0) {
      fund.status = FundStatus.EXHAUSTED;
    }

    return this.donorFundRepo.save(fund);
  }

  // ─── INTER-FACILITY TRANSACTIONS ───────────────────────────────────────────

  async createInterFacilityTransaction(
    dto: {
      fromFacilityId: string;
      toFacilityId: string;
      amount: number;
      description: string;
      referenceNumber: string;
      initiatedById: string;
    },
    tenantId?: string,
  ): Promise<InterFacilityTransaction> {
    const txn = this.interFacilityRepo.create({
      sourceFacilityId: dto.fromFacilityId,
      targetFacilityId: dto.toFacilityId,
      amount: dto.amount,
      description: dto.description,
      referenceNumber: dto.referenceNumber,
      transactionType: 'transfer',
      createdBy: dto.initiatedById,
      status: InterFacilityStatus.PENDING,
      tenantId,
    });
    return this.interFacilityRepo.save(txn);
  }

  async findAllInterFacility(
    facilityId?: string,
    tenantId?: string,
  ): Promise<InterFacilityTransaction[]> {
    const where: any[] = [];
    const baseWhere: any = {};
    if (tenantId) baseWhere.tenantId = tenantId;

    if (facilityId) {
      where.push(
        { ...baseWhere, sourceFacilityId: facilityId },
        { ...baseWhere, targetFacilityId: facilityId },
      );
    } else {
      where.push(baseWhere);
    }

    return this.interFacilityRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async approveInterFacility(
    id: string,
    userId: string,
    tenantId?: string,
  ): Promise<InterFacilityTransaction> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const txn = await this.interFacilityRepo.findOne({ where });
    if (!txn) {
      throw new NotFoundException(`Inter-facility transaction ${id} not found`);
    }

    if (txn.status !== InterFacilityStatus.PENDING) {
      throw new BadRequestException(
        `Transaction is in status '${txn.status}' and cannot be approved`,
      );
    }

    txn.status = InterFacilityStatus.CONFIRMED;
    txn.confirmedBy = userId;
    return this.interFacilityRepo.save(txn);
  }

  async settleInterFacility(
    id: string,
    userId: string,
    tenantId?: string,
  ): Promise<InterFacilityTransaction> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const txn = await this.interFacilityRepo.findOne({ where });
    if (!txn) {
      throw new NotFoundException(`Inter-facility transaction ${id} not found`);
    }

    if (txn.status !== InterFacilityStatus.CONFIRMED) {
      throw new BadRequestException(
        `Transaction must be confirmed before settling (current status: '${txn.status}')`,
      );
    }

    txn.status = InterFacilityStatus.SETTLED;
    txn.settledAt = new Date();
    return this.interFacilityRepo.save(txn);
  }
}
