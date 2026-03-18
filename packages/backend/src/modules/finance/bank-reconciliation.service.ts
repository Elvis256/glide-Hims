import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  BankReconciliation,
  BankReconciliationItem,
  ReconciliationStatus,
  ReconciliationItemStatus,
} from '../../database/entities/finance-extended.entity';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { CreateBankReconciliationDto, StatementItemDto } from './dto/bank-reconciliation.dto';

@Injectable()
export class BankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);

  constructor(
    @InjectRepository(BankReconciliation)
    private reconRepo: Repository<BankReconciliation>,
    @InjectRepository(BankReconciliationItem)
    private reconItemRepo: Repository<BankReconciliationItem>,
    @InjectRepository(JournalEntry)
    private journalRepo: Repository<JournalEntry>,
  ) {}

  async create(dto: CreateBankReconciliationDto, tenantId?: string): Promise<BankReconciliation> {
    const recon = this.reconRepo.create({
      facilityId: dto.facilityId,
      bankAccountId: dto.bankAccountId,
      statementDate: dto.statementDate as any,
      statementBalance: dto.statementBalance,
      bookBalance: dto.bookBalance,
      status: ReconciliationStatus.IN_PROGRESS,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.reconRepo.save(recon);
  }

  async findAll(facilityId?: string, tenantId?: string): Promise<BankReconciliation[]> {
    const where: any = {};
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;
    return this.reconRepo.find({
      where,
      relations: ['bankAccount'],
      order: { statementDate: 'DESC' },
    });
  }

  async findOne(id: string, tenantId?: string): Promise<BankReconciliation> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const recon = await this.reconRepo.findOne({
      where,
      relations: ['bankAccount', 'items'],
    });
    if (!recon) throw new NotFoundException(`Bank reconciliation ${id} not found`);
    return recon;
  }

  async addStatementItems(
    reconId: string,
    items: StatementItemDto[],
    tenantId?: string,
  ): Promise<BankReconciliationItem[]> {
    const recon = await this.findOne(reconId, tenantId);
    if (recon.status !== ReconciliationStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot add items to a completed reconciliation');
    }

    const entities = items.map((item) =>
      this.reconItemRepo.create({
        reconciliationId: recon.id,
        statementReference: item.statementReference,
        statementDescription: item.statementDescription,
        statementAmount: item.statementAmount,
        statementDate: item.statementDate as any,
        status: ReconciliationItemStatus.UNMATCHED,
        notes: item.notes,
        ...(tenantId ? { tenantId } : {}),
      }),
    );
    return this.reconItemRepo.save(entities);
  }

  async autoMatch(reconId: string, tenantId?: string): Promise<{ matchedCount: number }> {
    const recon = await this.findOne(reconId, tenantId);
    if (recon.status !== ReconciliationStatus.IN_PROGRESS) {
      throw new BadRequestException('Reconciliation is not in progress');
    }

    const unmatchedItems = await this.reconItemRepo.find({
      where: { reconciliationId: recon.id, status: ReconciliationItemStatus.UNMATCHED },
    });

    let matchedCount = 0;

    for (const item of unmatchedItems) {
      const itemDate = new Date(item.statementDate);
      const startDate = new Date(itemDate);
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date(itemDate);
      endDate.setDate(endDate.getDate() + 2);

      const amount = Math.abs(Number(item.statementAmount));

      // Find journal entries with exact amount match within ±2 days
      const candidates = await this.journalRepo
        .createQueryBuilder('je')
        .where('je.journal_date BETWEEN :startDate AND :endDate', {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        })
        .andWhere('je.status = :status', { status: JournalStatus.POSTED })
        .andWhere('(je.total_debit = :amount OR je.total_credit = :amount)', { amount })
        .andWhere(tenantId ? 'je.tenant_id = :tenantId' : '1=1', { tenantId })
        .getMany();

      if (candidates.length === 1) {
        // Exact single match — check it hasn't been matched already
        const alreadyMatched = await this.reconItemRepo.findOne({
          where: {
            reconciliationId: recon.id,
            journalEntryId: candidates[0].id,
            status: ReconciliationItemStatus.MATCHED,
          },
        });

        if (!alreadyMatched) {
          item.journalEntryId = candidates[0].id;
          item.status = ReconciliationItemStatus.MATCHED;
          await this.reconItemRepo.save(item);
          matchedCount++;
        }
      }
    }

    this.logger.log(`Auto-matched ${matchedCount} items for reconciliation ${reconId}`);
    return { matchedCount };
  }

  async manualMatch(
    itemId: string,
    journalEntryId: string,
    tenantId?: string,
  ): Promise<BankReconciliationItem> {
    const where: any = { id: itemId };
    if (tenantId) where.tenantId = tenantId;

    const item = await this.reconItemRepo.findOne({ where });
    if (!item) throw new NotFoundException(`Reconciliation item ${itemId} not found`);

    const journal = await this.journalRepo.findOne({
      where: { id: journalEntryId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!journal) throw new NotFoundException(`Journal entry ${journalEntryId} not found`);

    item.journalEntryId = journalEntryId;
    item.status = ReconciliationItemStatus.MATCHED;
    return this.reconItemRepo.save(item);
  }

  async complete(reconId: string, tenantId?: string): Promise<BankReconciliation> {
    const recon = await this.findOne(reconId, tenantId);
    if (recon.status !== ReconciliationStatus.IN_PROGRESS) {
      throw new BadRequestException('Reconciliation is not in progress');
    }

    const items = recon.items || [];
    const matchedTotal = items
      .filter((i) => i.status === ReconciliationItemStatus.MATCHED)
      .reduce((sum, i) => sum + Number(i.statementAmount), 0);

    recon.reconciledBalance = matchedTotal;
    recon.status = ReconciliationStatus.COMPLETED;
    recon.reconciledAt = new Date();
    return this.reconRepo.save(recon);
  }

  async getSummary(
    reconId: string,
    tenantId?: string,
  ): Promise<{
    matchedCount: number;
    unmatchedCount: number;
    adjustedCount: number;
    matchedTotal: number;
    unmatchedTotal: number;
    discrepancy: number;
  }> {
    const recon = await this.findOne(reconId, tenantId);
    const items = recon.items || [];

    const matched = items.filter((i) => i.status === ReconciliationItemStatus.MATCHED);
    const unmatched = items.filter((i) => i.status === ReconciliationItemStatus.UNMATCHED);
    const adjusted = items.filter((i) => i.status === ReconciliationItemStatus.ADJUSTED);

    const matchedTotal = matched.reduce((sum, i) => sum + Number(i.statementAmount), 0);
    const unmatchedTotal = unmatched.reduce((sum, i) => sum + Number(i.statementAmount), 0);
    const discrepancy = Number(recon.statementBalance) - Number(recon.bookBalance) - unmatchedTotal;

    return {
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      adjustedCount: adjusted.length,
      matchedTotal,
      unmatchedTotal,
      discrepancy,
    };
  }
}
