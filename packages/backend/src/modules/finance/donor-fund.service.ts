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
  DonorFund,
  FundStatus,
  InterFacilityTransaction,
  InterFacilityStatus,
} from '../../database/entities/finance-extended.entity';

function requireTenant(tenantId?: string): string {
  if (!tenantId) {
    throw new ForbiddenException('Tenant context required');
  }
  return tenantId;
}

@Injectable()
export class DonorFundService {
  private readonly logger = new Logger(DonorFundService.name);

  constructor(
    @InjectRepository(DonorFund)
    private donorFundRepo: Repository<DonorFund>,
    @InjectRepository(InterFacilityTransaction)
    private interFacilityRepo: Repository<InterFacilityTransaction>,
    private dataSource: DataSource,
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
    const tid = requireTenant(tenantId);
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
      tenantId: tid,
    });
    return this.donorFundRepo.save(fund);
  }

  async findAllDonorFunds(facilityId?: string, tenantId?: string): Promise<DonorFund[]> {
    const tid = requireTenant(tenantId);
    const where: any = { tenantId: tid };
    if (facilityId) where.facilityId = facilityId;
    return this.donorFundRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOneDonorFund(id: string, tenantId?: string): Promise<DonorFund> {
    const tid = requireTenant(tenantId);
    const fund = await this.donorFundRepo.findOne({
      where: { id, tenantId: tid },
    });
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
    const tid = requireTenant(tenantId);
    if (!(amount > 0)) {
      throw new BadRequestException('Disbursement amount must be positive');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DonorFund);

      // Pessimistic lock to serialise concurrent disbursements against
      // the same fund — prevents two parallel calls both passing the
      // grant-cap check and over-disbursing.
      const fund = await repo
        .createQueryBuilder('f')
        .setLock('pessimistic_write')
        .where('f.id = :id AND f.tenant_id = :tid', { id: fundId, tid })
        .getOne();

      if (!fund) {
        throw new NotFoundException(`Donor fund ${fundId} not found`);
      }
      if (fund.status !== FundStatus.ACTIVE) {
        throw new BadRequestException(
          `Fund is in status '${fund.status}' and cannot accept disbursements`,
        );
      }

      const newDisbursed = Number(fund.disbursedAmount) + amount;
      if (newDisbursed > Number(fund.grantAmount)) {
        throw new BadRequestException(
          `Disbursement amount ${amount} would exceed grant amount ${fund.grantAmount} (already disbursed: ${fund.disbursedAmount})`,
        );
      }

      fund.disbursedAmount = newDisbursed;
      fund.remainingBalance = Number(fund.grantAmount) - newDisbursed;

      if (fund.remainingBalance <= 0) {
        fund.status = FundStatus.EXHAUSTED;
      }

      this.logger.log(
        `Donor fund ${fundId} disbursed ${amount} by user ${userId}: ${description}`,
      );
      return repo.save(fund);
    });
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
    const tid = requireTenant(tenantId);
    const txn = this.interFacilityRepo.create({
      sourceFacilityId: dto.fromFacilityId,
      targetFacilityId: dto.toFacilityId,
      amount: dto.amount,
      description: dto.description,
      referenceNumber: dto.referenceNumber,
      transactionType: 'transfer',
      createdBy: dto.initiatedById,
      status: InterFacilityStatus.PENDING,
      tenantId: tid,
    });
    return this.interFacilityRepo.save(txn);
  }

  async findAllInterFacility(
    facilityId?: string,
    tenantId?: string,
  ): Promise<InterFacilityTransaction[]> {
    const tid = requireTenant(tenantId);
    const baseWhere: any = { tenantId: tid };
    const where: any[] = facilityId
      ? [
          { ...baseWhere, sourceFacilityId: facilityId },
          { ...baseWhere, targetFacilityId: facilityId },
        ]
      : [baseWhere];

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
    const tid = requireTenant(tenantId);

    const txn = await this.interFacilityRepo.findOne({
      where: { id, tenantId: tid },
    });
    if (!txn) {
      throw new NotFoundException(`Inter-facility transaction ${id} not found`);
    }

    if (txn.status !== InterFacilityStatus.PENDING) {
      throw new BadRequestException(
        `Transaction is in status '${txn.status}' and cannot be approved`,
      );
    }

    // Segregation of duties: initiator cannot also approve
    if (txn.createdBy && txn.createdBy === userId) {
      throw new ForbiddenException(
        'You cannot approve an inter-facility transaction you initiated',
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
    const tid = requireTenant(tenantId);

    const txn = await this.interFacilityRepo.findOne({
      where: { id, tenantId: tid },
    });
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
