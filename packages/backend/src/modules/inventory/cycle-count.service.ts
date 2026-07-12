import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { requireTenantId } from '../../common/utils/tenant.util';
import {
  CycleCount,
  CycleCountItem,
  CycleCountStatus,
  VarianceStatus,
} from '../../database/entities/cycle-count.entity';
import { StockBalance } from '../../database/entities/inventory.entity';
import { InventoryService } from './inventory.service';

@Injectable()
export class CycleCountService {
  private readonly logger = new Logger(CycleCountService.name);

  constructor(
    @InjectRepository(CycleCount)
    private cycleCountRepo: Repository<CycleCount>,
    @InjectRepository(CycleCountItem)
    private itemRepo: Repository<CycleCountItem>,
    @InjectRepository(StockBalance)
    private stockBalanceRepo: Repository<StockBalance>,
    private inventoryService: InventoryService,
  ) {}

  async createCycleCount(
    dto: { facilityId: string; countDate?: string; notes?: string },
    userId: string,
    tenantId?: string,
  ): Promise<CycleCount> {
    const tid = requireTenantId(tenantId);
    // Generate count number
    const count = await this.cycleCountRepo.count({ where: { tenantId: tid } });
    const countNumber = `CC-${String(count + 1).padStart(6, '0')}`;

    const cycleCount = this.cycleCountRepo.create({
      countNumber,
      facilityId: dto.facilityId,
      countDate: dto.countDate || new Date().toISOString().split('T')[0],
      notes: dto.notes,
      createdById: userId,
      status: CycleCountStatus.DRAFT,
      tenantId: tid,
    });

    const saved = await this.cycleCountRepo.save(cycleCount);

    // Auto-populate items from current stock balances at the facility
    const stockBalances = await this.stockBalanceRepo.find({
      where: { facilityId: dto.facilityId, tenantId: tid },
      relations: ['item'],
    });

    const items: Partial<CycleCountItem>[] = stockBalances.map((sb) => ({
      cycleCountId: saved.id,
      itemId: sb.itemId,
      itemName: sb.item?.name || 'Unknown',
      itemCode: (sb as any).item?.itemCode || null,
      systemQuantity: Number(sb.totalQuantity),
      unitCost: Number((sb as any).item?.costPrice || 0),
      varianceStatus: VarianceStatus.NONE,
      tenantId: tid,
    }));

    if (items.length > 0) {
      await this.itemRepo.save(items as CycleCountItem[]);
    }

    saved.totalItems = items.length;
    await this.cycleCountRepo.save(saved);

    this.logger.log(`Cycle count ${countNumber} created with ${items.length} items`);
    return this.findOne(saved.id, tenantId);
  }

  async recordCount(
    cycleCountId: string,
    itemId: string,
    countedQuantity: number,
    userId: string,
    tenantId?: string,
  ): Promise<CycleCountItem> {
    const cycleCount = await this.findOne(cycleCountId, tenantId);

    if (
      cycleCount.status === CycleCountStatus.COMPLETED ||
      cycleCount.status === CycleCountStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot record counts on a completed/cancelled cycle count');
    }

    // Move to in_progress if still draft
    if (cycleCount.status === CycleCountStatus.DRAFT) {
      cycleCount.status = CycleCountStatus.IN_PROGRESS;
      await this.cycleCountRepo.save(cycleCount);
    }

    const tid = requireTenantId(tenantId);
    const item = await this.itemRepo.findOne({
      where: { cycleCountId, id: itemId, tenantId: tid },
    });
    if (!item) throw new NotFoundException('Cycle count item not found');

    // Compute variance
    item.countedQuantity = countedQuantity;
    item.variance = countedQuantity - Number(item.systemQuantity);
    item.varianceValue = item.variance * Number(item.unitCost || 0);
    item.countedById = userId;
    item.countedAt = new Date();

    // Determine variance status (5% tolerance threshold)
    const tolerancePercent = 5;
    const absVariancePercent =
      Number(item.systemQuantity) > 0
        ? (Math.abs(item.variance) / Number(item.systemQuantity)) * 100
        : item.variance !== 0
          ? 100
          : 0;

    if (item.variance === 0) {
      item.varianceStatus = VarianceStatus.NONE;
    } else if (absVariancePercent <= tolerancePercent) {
      item.varianceStatus = VarianceStatus.WITHIN_TOLERANCE;
    } else {
      item.varianceStatus = VarianceStatus.EXCEEDS_TOLERANCE;
    }

    await this.itemRepo.save(item);

    // Update cycle count summary
    await this.updateCycleCountSummary(cycleCountId, tenantId);

    return item;
  }

  async investigateVariance(
    cycleCountId: string,
    itemId: string,
    notes: string,
    tenantId?: string,
  ): Promise<CycleCountItem> {
    const tid = requireTenantId(tenantId);
    const item = await this.itemRepo.findOne({
      where: { cycleCountId, id: itemId, tenantId: tid },
    });
    if (!item) throw new NotFoundException('Cycle count item not found');

    if (item.varianceStatus === VarianceStatus.NONE) {
      throw new BadRequestException('No variance to investigate');
    }

    item.investigationNotes = notes;
    item.varianceStatus = VarianceStatus.INVESTIGATED;
    return this.itemRepo.save(item);
  }

  async applyAdjustments(
    cycleCountId: string,
    userId: string,
    tenantId?: string,
  ): Promise<CycleCount> {
    const cycleCount = await this.findOne(cycleCountId, tenantId);

    if (cycleCount.status !== CycleCountStatus.APPROVED) {
      throw new BadRequestException('Cycle count must be approved before applying adjustments');
    }

    const tid = requireTenantId(tenantId);
    const items = await this.itemRepo.find({
      where: { cycleCountId, tenantId: tid },
    });

    // Apply adjustments via inventoryService for items with variance
    for (const item of items) {
      if (item.variance && item.variance !== 0 && item.countedQuantity !== null) {
        try {
          await this.inventoryService.adjustStock(
            {
              itemId: item.itemId,
              facilityId: cycleCount.facilityId,
              newQuantity: Number(item.countedQuantity),
              reason: `Cycle count adjustment (${cycleCount.countNumber})`,
              notes: item.investigationNotes || undefined,
            },
            userId,
            tenantId,
          );
          item.varianceStatus = VarianceStatus.ADJUSTED;
        } catch (err) {
          this.logger.error(`Failed to adjust stock for item ${item.itemId}: ${err.message}`);
        }
      }
    }

    await this.itemRepo.save(items);

    cycleCount.status = CycleCountStatus.COMPLETED;
    cycleCount.completedAt = new Date();
    await this.cycleCountRepo.save(cycleCount);

    this.logger.log(`Cycle count ${cycleCount.countNumber} adjustments applied and completed`);
    return this.findOne(cycleCountId, tenantId);
  }

  async completeCycleCount(
    cycleCountId: string,
    userId: string,
    tenantId?: string,
  ): Promise<CycleCount> {
    const cycleCount = await this.findOne(cycleCountId, tenantId);

    if (cycleCount.status === CycleCountStatus.COMPLETED) {
      throw new BadRequestException('Cycle count is already completed');
    }

    // Check all items have been counted
    const tid = requireTenantId(tenantId);
    const uncounted = await this.itemRepo.count({
      where: { cycleCountId, countedQuantity: null as any, tenantId: tid },
    });
    if (uncounted > 0) {
      throw new BadRequestException(`${uncounted} items have not been counted yet`);
    }

    // Move to pending review for approval
    cycleCount.status = CycleCountStatus.PENDING_REVIEW;
    await this.cycleCountRepo.save(cycleCount);

    return cycleCount;
  }

  async approveCycleCount(
    cycleCountId: string,
    userId: string,
    tenantId?: string,
  ): Promise<CycleCount> {
    const cycleCount = await this.findOne(cycleCountId, tenantId);

    if (cycleCount.status !== CycleCountStatus.PENDING_REVIEW) {
      throw new BadRequestException('Cycle count must be pending review to approve');
    }

    // Segregation of duties
    if (cycleCount.createdById === userId) {
      throw new BadRequestException('The creator cannot approve their own cycle count');
    }

    cycleCount.status = CycleCountStatus.APPROVED;
    cycleCount.approvedById = userId;
    await this.cycleCountRepo.save(cycleCount);

    return cycleCount;
  }

  async findOne(id: string, tenantId?: string): Promise<CycleCount> {
    const tid = requireTenantId(tenantId);
    const cycleCount = await this.cycleCountRepo.findOne({
      where: { id, tenantId: tid },
      relations: ['items'],
    });
    if (!cycleCount) throw new NotFoundException('Cycle count not found');
    return cycleCount;
  }

  async findAll(
    query: { status?: string; facilityId?: string; page?: number; limit?: number },
    tenantId?: string,
  ) {
    const tid = requireTenantId(tenantId);
    const where: any = { tenantId: tid };
    if (query.status) where.status = query.status;
    if (query.facilityId) where.facilityId = query.facilityId;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.cycleCountRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private async updateCycleCountSummary(cycleCountId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const items = await this.itemRepo.find({
      where: { cycleCountId, tenantId: tid },
    });

    const itemsCounted = items.filter((i) => i.countedQuantity !== null).length;
    const varianceCount = items.filter((i) => i.variance && i.variance !== 0).length;
    const totalVarianceValue = items.reduce(
      (sum, i) => sum + Math.abs(Number(i.varianceValue || 0)),
      0,
    );

    await this.cycleCountRepo.update(cycleCountId, {
      itemsCounted,
      varianceCount,
      totalVarianceValue,
    });
  }
}
