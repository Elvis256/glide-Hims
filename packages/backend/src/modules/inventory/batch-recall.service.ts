import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { requireTenantId } from '../../common/utils/tenant.util';
import {
  BatchRecall,
  BatchRecallAction,
  RecallStatus,
  RecallActionType,
} from '../../database/entities/batch-recall.entity';
import { BatchStockBalance } from '../../database/entities/batch-stock.entity';

@Injectable()
export class BatchRecallService {
  private readonly logger = new Logger(BatchRecallService.name);

  constructor(
    @InjectRepository(BatchRecall)
    private recallRepo: Repository<BatchRecall>,
    @InjectRepository(BatchRecallAction)
    private actionRepo: Repository<BatchRecallAction>,
    @InjectRepository(BatchStockBalance)
    private batchStockRepo: Repository<BatchStockBalance>,
    private dataSource: DataSource,
  ) {}

  async initiateRecall(
    dto: {
      batchNumber: string;
      itemId: string;
      itemName: string;
      reason: string;
      severity?: string;
      facilityId?: string;
      notes?: string;
    },
    userId: string,
    tenantId?: string,
  ): Promise<BatchRecall> {
    const tid = requireTenantId(tenantId);
    // Generate recall number
    const count = await this.recallRepo.count({ where: { tenantId: tid } });
    const recallNumber = `RCL-${String(count + 1).padStart(6, '0')}`;

    // Calculate affected quantity from batch stock
    const batchStocks = await this.batchStockRepo.find({
      where: {
        batchNumber: dto.batchNumber,
        itemId: dto.itemId,
        ...(dto.facilityId ? { facilityId: dto.facilityId } : {}),
        tenantId: tid,
      },
    });
    const affectedQuantity = batchStocks.reduce((sum, bs) => sum + Number(bs.quantity), 0);

    const recall = this.recallRepo.create({
      recallNumber,
      batchNumber: dto.batchNumber,
      itemId: dto.itemId,
      itemName: dto.itemName,
      reason: dto.reason,
      severity: (dto.severity as any) || 'class_ii',
      status: RecallStatus.INITIATED,
      affectedQuantity,
      facilityId: dto.facilityId,
      initiatedById: userId,
      notes: dto.notes,
      tenantId: tid,
    });

    const saved = await this.recallRepo.save(recall);

    this.logger.warn(
      `Batch recall initiated: ${recallNumber} for batch ${dto.batchNumber} (${dto.itemName}). Reason: ${dto.reason}`,
    );

    return saved;
  }

  async quarantineBatch(recallId: string, userId: string, tenantId?: string): Promise<BatchRecall> {
    const tid = requireTenantId(tenantId);
    const recall = await this.findOne(recallId, tenantId);

    if (recall.status === RecallStatus.COMPLETED || recall.status === RecallStatus.CANCELLED) {
      throw new BadRequestException('Cannot quarantine batches for a completed/cancelled recall');
    }

    // Set all matching batch stock balances to 'recalled' status
    const result = await this.batchStockRepo
      .createQueryBuilder()
      .update(BatchStockBalance)
      .set({ status: 'recalled' })
      .where('batchNumber = :batchNumber', { batchNumber: recall.batchNumber })
      .andWhere('itemId = :itemId', { itemId: recall.itemId })
      .andWhere("status != 'recalled'")
      .andWhere('tenant_id = :tenantId', { tenantId: tid })
      .execute();

    const quarantinedQty = await this.batchStockRepo
      .createQueryBuilder('bs')
      .select('COALESCE(SUM(bs.quantity), 0)', 'total')
      .where('bs.batchNumber = :batchNumber', { batchNumber: recall.batchNumber })
      .andWhere('bs.itemId = :itemId', { itemId: recall.itemId })
      .andWhere("bs.status = 'recalled'")
      .andWhere('bs.tenant_id = :tenantId', { tenantId: tid })
      .getRawOne();

    recall.quarantinedQuantity = Number(quarantinedQty?.total || 0);
    recall.status = RecallStatus.IN_PROGRESS;
    await this.recallRepo.save(recall);

    // Record action
    const action = this.actionRepo.create({
      recallId,
      actionType: RecallActionType.QUARANTINE,
      description: `Quarantined ${result.affected} batch stock records. Total quantity: ${recall.quarantinedQuantity}`,
      performedAt: new Date(),
      performedById: userId,
      tenantId: tid,
    });
    await this.actionRepo.save(action);

    this.logger.warn(
      `Batch quarantined for recall ${recall.recallNumber}: ${result.affected} records affected`,
    );

    return this.findOne(recallId, tenantId);
  }

  async getAffectedPatients(
    recallId: string,
    tenantId?: string,
  ): Promise<{ patientId: string; patientName: string; saleDate: Date; quantity: number }[]> {
    const recall = await this.findOne(recallId, tenantId);

    // Query pharmacy_sale_items by batchNumber to find affected patients
    const results = await this.dataSource.query(
      `
      SELECT DISTINCT
        ps.patient_id AS "patientId",
        COALESCE(ps.patient_name, 'OTC Customer') AS "patientName",
        ps.completed_at AS "saleDate",
        psi.quantity
      FROM pharmacy_sale_items psi
      JOIN pharmacy_sales ps ON ps.id = psi.sale_id
      WHERE psi.batch_number = $1
        AND psi.item_id = $2
        AND ps.status = 'completed'
        ${tenantId ? 'AND ps.tenant_id = $3' : ''}
      ORDER BY ps.completed_at DESC
      `,
      tenantId
        ? [recall.batchNumber, recall.itemId, tenantId]
        : [recall.batchNumber, recall.itemId],
    );

    // Update affected patients count
    const uniquePatients = new Set(
      results.filter((r: any) => r.patientId).map((r: any) => r.patientId),
    );
    recall.affectedPatientsCount = uniquePatients.size;
    await this.recallRepo.save(recall);

    return results;
  }

  async completeRecall(
    recallId: string,
    userId: string,
    notes?: string,
    tenantId?: string,
  ): Promise<BatchRecall> {
    const recall = await this.findOne(recallId, tenantId);

    if (recall.status === RecallStatus.COMPLETED) {
      throw new BadRequestException('Recall is already completed');
    }
    if (recall.status === RecallStatus.CANCELLED) {
      throw new BadRequestException('Cannot complete a cancelled recall');
    }

    recall.status = RecallStatus.COMPLETED;
    recall.completedAt = new Date();
    recall.completedById = userId;
    if (notes) recall.notes = (recall.notes ? recall.notes + '\n' : '') + notes;

    await this.recallRepo.save(recall);

    this.logger.log(`Batch recall completed: ${recall.recallNumber}`);
    return recall;
  }

  async findOne(id: string, tenantId?: string): Promise<BatchRecall> {
    const recall = await this.recallRepo.findOne({
      where: { id, tenantId: requireTenantId(tenantId) },
      relations: ['actions'],
    });
    if (!recall) throw new NotFoundException('Batch recall not found');
    return recall;
  }

  async findAll(
    query: { status?: string; facilityId?: string; page?: number; limit?: number },
    tenantId?: string,
  ) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.facilityId) where.facilityId = query.facilityId;
    if (tenantId) where.tenantId = tenantId;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.recallRepo.findAndCount({
      where,
      relations: ['actions'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
