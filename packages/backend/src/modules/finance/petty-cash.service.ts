import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  PettyCashFund,
  PettyCashTransaction,
  PettyCashTransactionType,
} from '../../database/entities/finance-extended.entity';
import { CreatePettyCashFundDto, RecordTransactionDto } from './dto/petty-cash.dto';

@Injectable()
export class PettyCashService {
  private readonly logger = new Logger(PettyCashService.name);

  constructor(
    @InjectRepository(PettyCashFund)
    private fundRepo: Repository<PettyCashFund>,
    @InjectRepository(PettyCashTransaction)
    private txnRepo: Repository<PettyCashTransaction>,
  ) {}

  async createFund(dto: CreatePettyCashFundDto, tenantId?: string): Promise<PettyCashFund> {
    const fund = this.fundRepo.create({
      facilityId: dto.facilityId,
      name: dto.name,
      imprestAmount: dto.imprestAmount,
      currentBalance: dto.imprestAmount,
      custodianId: dto.custodianId,
      isActive: dto.isActive ?? true,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.fundRepo.save(fund);
  }

  async findAllFunds(facilityId?: string, tenantId?: string): Promise<PettyCashFund[]> {
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;
    return this.fundRepo.find({ where, order: { name: 'ASC' } });
  }

  async findFund(id: string, tenantId?: string): Promise<PettyCashFund> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const fund = await this.fundRepo.findOne({
      where,
      relations: ['transactions'],
    });
    if (!fund) throw new NotFoundException(`Petty cash fund ${id} not found`);

    // Return only recent transactions (last 50)
    if (fund.transactions) {
      fund.transactions = fund.transactions
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 50);
    }
    return fund;
  }

  async recordTransaction(
    fundId: string,
    dto: RecordTransactionDto,
    tenantId?: string,
  ): Promise<PettyCashTransaction> {
    const fund = await this.findFund(fundId, tenantId);
    if (!fund.isActive) {
      throw new BadRequestException('Fund is not active');
    }

    const amount = Number(dto.amount);

    if (dto.type === PettyCashTransactionType.EXPENSE) {
      if (amount > Number(fund.currentBalance)) {
        throw new BadRequestException(
          `Insufficient balance. Current: ${fund.currentBalance}, Requested: ${amount}`,
        );
      }
      fund.currentBalance = Number(fund.currentBalance) - amount;
    } else {
      // topup or refund — increase balance
      fund.currentBalance = Number(fund.currentBalance) + amount;
    }

    const txn = this.txnRepo.create({
      fundId: fund.id,
      type: dto.type,
      amount,
      description: dto.description,
      category: dto.category,
      receiptReference: dto.receiptNumber,
      approvedBy: dto.approvedById,
      recordedBy: dto.approvedById || fund.custodianId,
      ...(tenantId ? { tenantId } : {}),
    });

    await this.fundRepo.save(fund);
    return this.txnRepo.save(txn);
  }

  async replenish(
    fundId: string,
    amount: number,
    approvedById: string,
    tenantId?: string,
  ): Promise<PettyCashTransaction> {
    const fund = await this.findFund(fundId, tenantId);
    if (!fund.isActive) {
      throw new BadRequestException('Fund is not active');
    }

    const replenishAmount = Number(fund.imprestAmount) - Number(fund.currentBalance);
    const actualAmount = amount || replenishAmount;

    fund.currentBalance = Number(fund.currentBalance) + actualAmount;

    const txn = this.txnRepo.create({
      fundId: fund.id,
      type: PettyCashTransactionType.TOPUP,
      amount: actualAmount,
      description: `Replenishment to imprest amount`,
      recordedBy: approvedById,
      approvedBy: approvedById,
      ...(tenantId ? { tenantId } : {}),
    });

    await this.fundRepo.save(fund);
    this.logger.log(`Replenished fund ${fundId} by ${actualAmount}`);
    return this.txnRepo.save(txn);
  }

  async getFundStatement(
    fundId: string,
    startDate?: string,
    endDate?: string,
    tenantId?: string,
  ): Promise<{ fund: PettyCashFund; transactions: (PettyCashTransaction & { runningBalance?: number })[] }> {
    const fund = await this.findFund(fundId, tenantId);

    const where: any = { fundId };
    if (tenantId) where.tenantId = tenantId;
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      where.createdAt = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      where.createdAt = LessThanOrEqual(new Date(endDate));
    }

    const transactions = await this.txnRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });

    // Compute running balance
    let balance = Number(fund.imprestAmount);
    if (startDate) {
      // Calculate opening balance from all prior transactions
      const priorTxns = await this.txnRepo.find({
        where: {
          fundId,
          ...(tenantId ? { tenantId } : {}),
        },
        order: { createdAt: 'ASC' },
      });
      balance = Number(fund.imprestAmount);
      for (const txn of priorTxns) {
        if (new Date(txn.createdAt) >= new Date(startDate)) break;
        if (txn.type === PettyCashTransactionType.EXPENSE) {
          balance -= Number(txn.amount);
        } else {
          balance += Number(txn.amount);
        }
      }
    }

    const txnsWithBalance = transactions.map((txn) => {
      if (txn.type === PettyCashTransactionType.EXPENSE) {
        balance -= Number(txn.amount);
      } else {
        balance += Number(txn.amount);
      }
      return { ...txn, runningBalance: balance };
    });

    return { fund, transactions: txnsWithBalance };
  }
}
