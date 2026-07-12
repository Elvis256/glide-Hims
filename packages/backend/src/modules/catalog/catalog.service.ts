import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Item } from '../../database/entities/inventory.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

export interface CatalogItemResult {
  id: string;
  source: 'inventory';
  code: string;
  name: string;
  unit: string;
  lastPurchasePrice: number;
  sellingPrice: number;
  currentStock?: number;
  isControlled?: boolean;
  isDrug?: boolean;
  genericName?: string;
  category?: string;
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
  ) {}

  async searchItems(params: {
    q?: string;
    module?: string;
    limit?: number;
    storeId?: string;
    tenantId?: string;
  }): Promise<CatalogItemResult[]> {
    const { q = '', module = 'all', limit = 20 } = params;
    const tid = requireTenantId(params.tenantId);

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .select([
        'item.id',
        'item.code',
        'item.name',
        'item.genericName',
        'item.unit',
        'item.unitCost',
        'item.sellingPrice',
        'item.isDrug',
        'item.isControlled',
        'item.category',
        'item.status',
      ])
      .where('item.status != :inactive', { inactive: 'inactive' })
      .andWhere('item.tenant_id = :tenantId', { tenantId: tid })
      .take(limit);

    // Module filter
    if (module === 'pharmacy') {
      qb.andWhere('item.is_drug = true');
    } else if (module === 'general') {
      qb.andWhere('item.is_drug = false');
    }
    // 'all', 'lab', 'asset' — no extra filter for now (lab/asset distinction TBD)

    if (q.trim()) {
      // Exact code match first; then ILIKE on name, code, generic_name, barcode
      qb.andWhere(
        '(item.name ILIKE :search OR item.code ILIKE :search OR item.generic_name ILIKE :search OR item.barcode ILIKE :search)',
        { search: `%${q.trim()}%` },
      );

      // Sort: exact name match first, then exact code match, then ILIKE
      qb.orderBy(
        `CASE WHEN LOWER(item.name) = LOWER(:exact) THEN 0
              WHEN LOWER(item.code) = LOWER(:exact) THEN 1
              ELSE 2
         END`,
        'ASC',
      )
        .addOrderBy('item.name', 'ASC')
        .setParameter('exact', q.trim());
    } else {
      qb.orderBy('item.name', 'ASC');
    }

    const items = await qb.getMany();

    return items.map((item) => ({
      id: item.id,
      source: 'inventory' as const,
      code: item.code,
      name: item.name,
      unit: item.unit || 'unit',
      lastPurchasePrice: Number(item.unitCost) || 0,
      sellingPrice: Number(item.sellingPrice) || 0,
      isControlled: item.isControlled,
      isDrug: item.isDrug,
      genericName: item.genericName,
      category: item.category,
    }));
  }

  async getItemsByIds(ids: string[], tenantId?: string): Promise<CatalogItemResult[]> {
    if (!ids || ids.length === 0) return [];
    const tid = requireTenantId(tenantId);

    const where: Record<string, unknown> = { id: In(ids), tenantId: tid };

    const items = await this.itemRepo.find({ where: where as any });

    return items.map((item) => ({
      id: item.id,
      source: 'inventory' as const,
      code: item.code,
      name: item.name,
      unit: item.unit || 'unit',
      lastPurchasePrice: Number(item.unitCost) || 0,
      sellingPrice: Number(item.sellingPrice) || 0,
      isControlled: item.isControlled,
      isDrug: item.isDrug,
      genericName: item.genericName,
      category: item.category,
    }));
  }
}
