import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, DataSource } from 'typeorm';
import {
  PettyCashFund,
  PettyCashTransaction,
  PettyCashTransactionType,
} from '../../database/entities/finance-extended.entity';
import { CreatePettyCashFundDto, RecordTransactionDto } from './dto/petty-cash.dto';
import { sumCents, fromCents, toCents, cmpMoney } from '../../common/utils/money';

@Injectable()
export class PettyCashService {
  private readonly logger = new Logger(PettyCashService.name);

  constructor(
    @InjectRepository(PettyCashFund)
    private fundRepo: Repository<PettyCashFund>,
    @InjectRepository(PettyCashTransaction)
    private txnRepo: Repository<PettyCashTransaction>,
    private dataSource: DataSource,
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
    actingUserId?: string,
  ): Promise<PettyCashTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const fundRepo = manager.getRepository(PettyCashFund);
      const txnRepo = manager.getRepository(PettyCashTransaction);

      // Lock the fund to prevent concurrent modifications
      const fund = await fundRepo.findOne({
        where: { id: fundId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fund) throw new NotFoundException(`Petty cash fund ${fundId} not found`);
      if (!fund.isActive) {
        throw new BadRequestException('Fund is not active');
      }

      const amount = Number(dto.amount);
      if (amount <= 0) {
        throw new BadRequestException('Transaction amount must be positive');
      }

      if (dto.type === PettyCashTransactionType.EXPENSE) {
        // Custodian SoD: only the assigned custodian may record
        // expenses against the fund. Without this, any user with the
        // finance.manage permission can drain any petty-cash float.
        if (actingUserId && fund.custodianId && actingUserId !== fund.custodianId) {
          throw new ForbiddenException(
            'Only the assigned custodian can record expenses against this petty cash fund',
          );
        }

        if (cmpMoney(amount, fund.currentBalance) > 0) {
          throw new BadRequestException(
            `Insufficient balance. Current: ${fund.currentBalance}, Requested: ${amount}`,
          );
        }
        fund.currentBalance = fromCents(toCents(fund.currentBalance) - toCents(amount));
      } else {
        fund.currentBalance = fromCents(sumCents(fund.currentBalance, amount));
      }

      const txn = txnRepo.create({
        fundId: fund.id,
        type: dto.type,
        amount,
        description: dto.description,
        category: dto.category,
        receiptReference: dto.receiptNumber,
        approvedBy: dto.approvedById,
        recordedBy: actingUserId || dto.approvedById || fund.custodianId,
        ...(tenantId ? { tenantId } : {}),
      });

      await fundRepo.save(fund);
      return txnRepo.save(txn);
    });
  }

  async replenish(
    fundId: string,
    amount: number,
    approvedById: string,
    tenantId?: string,
  ): Promise<PettyCashTransaction> {
    return this.dataSource.transaction(async (manager) => {
      const fundRepo = manager.getRepository(PettyCashFund);
      const txnRepo = manager.getRepository(PettyCashTransaction);

      const fund = await fundRepo.findOne({
        where: { id: fundId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!fund) throw new NotFoundException(`Petty cash fund ${fundId} not found`);
      if (!fund.isActive) {
        throw new BadRequestException('Fund is not active');
      }

      // Sprint-6 money-cents sweep: do all imprest/headroom math at
      // cent precision so the cap is exact and the stored balance
      // can never drift above imprestAmount due to float error.
      const imprestCents = toCents(fund.imprestAmount);
      const balanceCents = toCents(fund.currentBalance);
      const headroomCents = Math.max(imprestCents - balanceCents, 0);
      const requestedCents = amount && amount > 0 ? toCents(amount) : headroomCents;

      if (headroomCents <= 0) {
        throw new BadRequestException(
          'Fund is already at or above imprest amount; no replenishment required',
        );
      }
      if (requestedCents <= 0) {
        throw new BadRequestException('Replenishment amount must be greater than zero');
      }
      const actualCents = Math.min(requestedCents, headroomCents);
      const actualAmount = fromCents(actualCents);
      if (actualCents < requestedCents) {
        this.logger.warn(
          `Petty cash replenish for ${fundId} capped: requested ${fromCents(requestedCents)}, capped to ${actualAmount} (headroom)`,
        );
      }

      fund.currentBalance = fromCents(balanceCents + actualCents);

      const txn = txnRepo.create({
        fundId: fund.id,
        type: PettyCashTransactionType.TOPUP,
        amount: actualAmount,
        description: `Replenishment to imprest amount`,
        recordedBy: approvedById,
        approvedBy: approvedById,
        ...(tenantId ? { tenantId } : {}),
      });

      await fundRepo.save(fund);
      this.logger.log(`Replenished fund ${fundId} by ${actualAmount}`);
      return txnRepo.save(txn);
    });
  }

  async getFundStatement(
    fundId: string,
    startDate?: string,
    endDate?: string,
    tenantId?: string,
  ): Promise<{
    fund: PettyCashFund;
    transactions: (PettyCashTransaction & { runningBalance?: number })[];
  }> {
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
