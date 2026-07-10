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
  BankReconciliation,
  BankReconciliationItem,
  ReconciliationStatus,
  ReconciliationItemStatus,
} from '../../database/entities/finance-extended.entity';
import { JournalEntry, JournalStatus } from '../../database/entities/journal-entry.entity';
import { CreateBankReconciliationDto, StatementItemDto } from './dto/bank-reconciliation.dto';

function requireTenant(tenantId?: string): string {
  if (!tenantId) {
    throw new ForbiddenException('Tenant context required');
  }
  return tenantId;
}

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
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateBankReconciliationDto, tenantId?: string): Promise<BankReconciliation> {
    const tid = requireTenant(tenantId);
    const recon = this.reconRepo.create({
      facilityId: dto.facilityId,
      bankAccountId: dto.bankAccountId,
      statementDate: dto.statementDate as any,
      statementBalance: dto.statementBalance,
      bookBalance: dto.bookBalance,
      status: ReconciliationStatus.IN_PROGRESS,
      tenantId: tid,
    });
    return this.reconRepo.save(recon);
  }

  async findAll(facilityId?: string, tenantId?: string): Promise<BankReconciliation[]> {
    const tid = requireTenant(tenantId);
    const where: any = { tenantId: tid };
    if (facilityId) where.facilityId = facilityId;
    return this.reconRepo.find({
      where,
      relations: ['bankAccount'],
      order: { statementDate: 'DESC' },
    });
  }

  async findOne(id: string, tenantId?: string): Promise<BankReconciliation> {
    const tid = requireTenant(tenantId);
    const recon = await this.reconRepo.findOne({
      where: { id, tenantId: tid },
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
    const tid = requireTenant(tenantId);
    const recon = await this.findOne(reconId, tid);
    if (recon.status !== ReconciliationStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot add items to a completed reconciliation');
    }

    // Sprint-6 idempotency: re-uploading the same statement file must
    // not create duplicate lines. We dedupe within this reconciliation
    // by the natural key (date, amount, reference|description). If a
    // matching row already exists we silently skip the new one and
    // return the already-persisted entity instead.
    const existing = await this.reconItemRepo.find({
      where: { reconciliationId: recon.id, tenantId: tid },
    });
    const fingerprint = (
      ref: string | undefined | null,
      desc: string | undefined | null,
      date: any,
      amount: number | string,
    ) => {
      const d = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
      const key = (ref && String(ref).trim()) || (desc && String(desc).trim()) || '';
      return `${d}|${Number(amount).toFixed(2)}|${key.toLowerCase()}`;
    };
    const existingByKey = new Map<string, BankReconciliationItem>();
    for (const e of existing) {
      existingByKey.set(
        fingerprint(
          e.statementReference,
          e.statementDescription,
          e.statementDate,
          e.statementAmount,
        ),
        e,
      );
    }

    const toInsert: BankReconciliationItem[] = [];
    const reused: BankReconciliationItem[] = [];
    for (const item of items) {
      const k = fingerprint(
        item.statementReference,
        item.statementDescription,
        item.statementDate,
        item.statementAmount,
      );
      const dup = existingByKey.get(k);
      if (dup) {
        reused.push(dup);
        continue;
      }
      const created = this.reconItemRepo.create({
        reconciliationId: recon.id,
        statementReference: item.statementReference,
        statementDescription: item.statementDescription,
        statementAmount: item.statementAmount,
        statementDate: item.statementDate as any,
        status: ReconciliationItemStatus.UNMATCHED,
        notes: item.notes,
        tenantId: tid,
      });
      existingByKey.set(k, created);
      toInsert.push(created);
    }

    const saved = toInsert.length ? await this.reconItemRepo.save(toInsert) : [];
    if (reused.length) {
      this.logger.log(
        `addStatementItems: skipped ${reused.length} duplicate line(s) for reconciliation ${reconId}`,
      );
    }
    return [...saved, ...reused];
  }

  async autoMatch(reconId: string, tenantId?: string): Promise<{ matchedCount: number }> {
    const tid = requireTenant(tenantId);

    return this.dataSource.transaction(async (manager) => {
      // Lock the reconciliation row to serialize concurrent autoMatch calls
      const recon = await manager
        .getRepository(BankReconciliation)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id AND r.tenant_id = :tid', { id: reconId, tid })
        .getOne();

      if (!recon) throw new NotFoundException(`Bank reconciliation ${reconId} not found`);
      if (recon.status !== ReconciliationStatus.IN_PROGRESS) {
        throw new BadRequestException('Reconciliation is not in progress');
      }

      const itemRepo = manager.getRepository(BankReconciliationItem);
      const jeRepo = manager.getRepository(JournalEntry);

      const unmatchedItems = await itemRepo.find({
        where: {
          reconciliationId: recon.id,
          tenantId: tid,
          status: ReconciliationItemStatus.UNMATCHED,
        },
      });

      let matchedCount = 0;

      for (const item of unmatchedItems) {
        const itemDate = new Date(item.statementDate);
        const startDate = new Date(itemDate);
        startDate.setDate(startDate.getDate() - 2);
        const endDate = new Date(itemDate);
        endDate.setDate(endDate.getDate() + 2);

        const amount = Math.abs(Number(item.statementAmount));

        const candidates = await jeRepo
          .createQueryBuilder('je')
          .where('je.journal_date BETWEEN :startDate AND :endDate', {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
          })
          .andWhere('je.status = :status', { status: JournalStatus.POSTED })
          .andWhere('(je.total_debit = :amount OR je.total_credit = :amount)', { amount })
          .andWhere('je.tenant_id = :tid', { tid })
          .getMany();

        if (candidates.length === 1) {
          // Reject if this journal entry has already been matched in ANY reconciliation
          // (across the whole tenant) to prevent cross-period double-counting.
          const alreadyMatched = await itemRepo.findOne({
            where: {
              tenantId: tid,
              journalEntryId: candidates[0].id,
              status: ReconciliationItemStatus.MATCHED,
            },
          });

          if (!alreadyMatched) {
            item.journalEntryId = candidates[0].id;
            item.status = ReconciliationItemStatus.MATCHED;
            await itemRepo.save(item);
            matchedCount++;
          }
        }
      }

      this.logger.log(`Auto-matched ${matchedCount} items for reconciliation ${reconId}`);
      return { matchedCount };
    });
  }

  async manualMatch(
    itemId: string,
    journalEntryId: string,
    tenantId?: string,
  ): Promise<BankReconciliationItem> {
    const tid = requireTenant(tenantId);

    return this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(BankReconciliationItem);

      const item = await itemRepo
        .createQueryBuilder('i')
        .setLock('pessimistic_write')
        .where('i.id = :id AND i.tenant_id = :tid', { id: itemId, tid })
        .getOne();
      if (!item) throw new NotFoundException(`Reconciliation item ${itemId} not found`);

      // Enforce period-close protection: cannot mutate items on a completed reconciliation
      const parent = await manager.getRepository(BankReconciliation).findOne({
        where: { id: item.reconciliationId, tenantId: tid },
      });
      if (!parent) throw new NotFoundException('Parent reconciliation not found');
      if (parent.status !== ReconciliationStatus.IN_PROGRESS) {
        throw new BadRequestException('Cannot modify items on a completed reconciliation');
      }

      const journal = await manager.getRepository(JournalEntry).findOne({
        where: { id: journalEntryId, tenantId: tid },
      });
      if (!journal) throw new NotFoundException(`Journal entry ${journalEntryId} not found`);

      // Reject duplicate match across tenant
      const dup = await itemRepo.findOne({
        where: {
          tenantId: tid,
          journalEntryId,
          status: ReconciliationItemStatus.MATCHED,
        },
      });
      if (dup && dup.id !== item.id) {
        throw new BadRequestException(
          'This journal entry has already been matched to another statement line',
        );
      }

      item.journalEntryId = journalEntryId;
      item.status = ReconciliationItemStatus.MATCHED;
      return itemRepo.save(item);
    });
  }

  async complete(reconId: string, userId: string, tenantId?: string): Promise<BankReconciliation> {
    const tid = requireTenant(tenantId);
    if (!userId) throw new ForbiddenException('Authenticated user required');

    return this.dataSource.transaction(async (manager) => {
      // Lock the parent row WITHOUT joining items: PostgreSQL rejects
      // FOR UPDATE on the nullable side of an outer join. Load items
      // in a separate query after the lock is acquired.
      const recon = await manager
        .getRepository(BankReconciliation)
        .createQueryBuilder('r')
        .setLock('pessimistic_write')
        .where('r.id = :id AND r.tenant_id = :tid', { id: reconId, tid })
        .getOne();

      if (!recon) throw new NotFoundException(`Bank reconciliation ${reconId} not found`);
      if (recon.status !== ReconciliationStatus.IN_PROGRESS) {
        throw new BadRequestException('Reconciliation is not in progress');
      }

      const items = await manager.getRepository(BankReconciliationItem).find({
        where: { reconciliationId: recon.id, tenantId: tid },
      });
      const matchedTotal = items
        .filter((i) => i.status === ReconciliationItemStatus.MATCHED)
        .reduce((sum, i) => sum + Number(i.statementAmount), 0);

      recon.reconciledBalance = matchedTotal;
      recon.status = ReconciliationStatus.COMPLETED;
      recon.reconciledAt = new Date();
      recon.reconciledBy = userId;
      return manager.getRepository(BankReconciliation).save(recon);
    });
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
