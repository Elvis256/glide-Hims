import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import {
  FixedAsset,
  AssetDepreciation,
  AssetMaintenance,
  AssetTransfer,
  AssetStatus,
  DepreciationMethod,
} from '../../database/entities/fixed-asset.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(FixedAsset)
    private assetRepo: Repository<FixedAsset>,
    @InjectRepository(AssetDepreciation)
    private depreciationRepo: Repository<AssetDepreciation>,
    @InjectRepository(AssetMaintenance)
    private maintenanceRepo: Repository<AssetMaintenance>,
    @InjectRepository(AssetTransfer)
    private transferRepo: Repository<AssetTransfer>,
  ) {}

  // ==================== ASSET CRUD ====================

  async createAsset(data: Partial<FixedAsset>): Promise<FixedAsset> {
    const asset = this.assetRepo.create({
      ...data,
      totalCost: (Number(data.acquisitionCost) || 0) + (Number(data.installationCost) || 0),
      bookValue: (Number(data.acquisitionCost) || 0) + (Number(data.installationCost) || 0) - (Number(data.salvageValue) || 0),
      accumulatedDepreciation: 0,
    });
    return this.assetRepo.save(asset);
  }

  async updateAsset(id: string, data: Partial<FixedAsset>): Promise<FixedAsset> {
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    Object.assign(asset, data);
    return this.assetRepo.save(asset);
  }

  async getAsset(id: string): Promise<FixedAsset> {
    const asset = await this.assetRepo.findOne({
      where: { id },
      relations: ['facility', 'department', 'custodian', 'depreciationRecords', 'maintenanceRecords'],
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async listAssets(facilityId: string, filters?: {
    category?: string;
    status?: AssetStatus;
    departmentId?: string;
    search?: string;
  }): Promise<FixedAsset[]> {
    const qb = this.assetRepo.createQueryBuilder('asset')
      .leftJoinAndSelect('asset.department', 'department')
      .leftJoinAndSelect('asset.custodian', 'custodian')
      .where('asset.facilityId = :facilityId', { facilityId });

    if (filters?.category) {
      qb.andWhere('asset.category = :category', { category: filters.category });
    }
    if (filters?.status) {
      qb.andWhere('asset.status = :status', { status: filters.status });
    }
    if (filters?.departmentId) {
      qb.andWhere('asset.departmentId = :departmentId', { departmentId: filters.departmentId });
    }
    if (filters?.search) {
      qb.andWhere('(asset.name ILIKE :search OR asset.assetCode ILIKE :search OR asset.serialNumber ILIKE :search)',
        { search: `%${filters.search}%` });
    }

    return qb.orderBy('asset.assetCode', 'ASC').getMany();
  }

  async deleteAsset(id: string): Promise<void> {
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    await this.assetRepo.softDelete(id);
  }

  // ==================== DEPRECIATION ====================

  calculateMonthlyDepreciation(asset: FixedAsset): number {
    const depreciableAmount = Number(asset.totalCost) - Number(asset.salvageValue);
    
    switch (asset.depreciationMethod) {
      case DepreciationMethod.STRAIGHT_LINE:
        return depreciableAmount / asset.usefulLifeMonths;

      case DepreciationMethod.DECLINING_BALANCE:
        const rate = asset.depreciationRate || (100 / asset.usefulLifeMonths * 12);
        const currentValue = Number(asset.bookValue);
        return (currentValue * rate / 100) / 12;

      case DepreciationMethod.DOUBLE_DECLINING:
        const ddRate = (2 * 100 / (asset.usefulLifeMonths / 12)) / 12;
        return (Number(asset.bookValue) * ddRate / 100);

      default:
        return depreciableAmount / asset.usefulLifeMonths;
    }
  }

  async runDepreciation(facilityId: string, year: number, month: number): Promise<AssetDepreciation[]> {
    const assets = await this.assetRepo.find({
      where: {
        facilityId,
        status: AssetStatus.ACTIVE,
      },
    });

    const results: AssetDepreciation[] = [];

    for (const asset of assets) {
      // Check if already depreciated for this period
      const existing = await this.depreciationRepo.findOne({
        where: {
          assetId: asset.id,
          periodYear: year,
          periodMonth: month,
        },
      });

      if (existing) continue;

      // Check if depreciation should start
      const depStartDate = new Date(asset.depreciationStartDate);
      const periodDate = new Date(year, month - 1, 1);
      if (periodDate < depStartDate) continue;

      // Check if fully depreciated
      if (Number(asset.bookValue) <= Number(asset.salvageValue)) continue;

      const monthlyDep = this.calculateMonthlyDepreciation(asset);
      let depAmount = Math.min(monthlyDep, Number(asset.bookValue) - Number(asset.salvageValue));

      const depRecord = this.depreciationRepo.create({
        assetId: asset.id,
        periodYear: year,
        periodMonth: month,
        openingBookValue: asset.bookValue,
        depreciationAmount: depAmount,
        accumulatedDepreciation: Number(asset.accumulatedDepreciation) + depAmount,
        closingBookValue: Number(asset.bookValue) - depAmount,
        isPosted: false,
      });

      const saved = await this.depreciationRepo.save(depRecord);
      results.push(saved);

      // Update asset
      asset.accumulatedDepreciation = Number(asset.accumulatedDepreciation) + depAmount;
      asset.bookValue = Number(asset.bookValue) - depAmount;
      await this.assetRepo.save(asset);
    }

    return results;
  }

  async getDepreciationSchedule(assetId: string): Promise<AssetDepreciation[]> {
    return this.depreciationRepo.find({
      where: { assetId },
      order: { periodYear: 'ASC', periodMonth: 'ASC' },
    });
  }

  async getDepreciationReport(facilityId: string, year: number, month?: number): Promise<{
    totalAssets: number;
    totalCost: number;
    totalAccumulatedDepreciation: number;
    totalBookValue: number;
    periodDepreciation: number;
    byCategory: Record<string, { count: number; cost: number; accumulated: number; bookValue: number }>;
  }> {
    const assets = await this.assetRepo.find({
      where: { facilityId, status: AssetStatus.ACTIVE },
    });

    const depQuery: any = { periodYear: year };
    if (month) depQuery.periodMonth = month;

    const periodDeps = await this.depreciationRepo.find({ where: depQuery });

    const byCategory: Record<string, { count: number; cost: number; accumulated: number; bookValue: number }> = {};

    for (const asset of assets) {
      if (!byCategory[asset.category]) {
        byCategory[asset.category] = { count: 0, cost: 0, accumulated: 0, bookValue: 0 };
      }
      byCategory[asset.category].count++;
      byCategory[asset.category].cost += Number(asset.totalCost);
      byCategory[asset.category].accumulated += Number(asset.accumulatedDepreciation);
      byCategory[asset.category].bookValue += Number(asset.bookValue);
    }

    return {
      totalAssets: assets.length,
      totalCost: assets.reduce((sum, a) => sum + Number(a.totalCost), 0),
      totalAccumulatedDepreciation: assets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation), 0),
      totalBookValue: assets.reduce((sum, a) => sum + Number(a.bookValue), 0),
      periodDepreciation: periodDeps.reduce((sum, d) => sum + Number(d.depreciationAmount), 0),
      byCategory,
    };
  }

  // ==================== MAINTENANCE ====================

  async recordMaintenance(data: Partial<AssetMaintenance>): Promise<AssetMaintenance> {
    const asset = await this.assetRepo.findOne({ where: { id: data.assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const maintenance = this.maintenanceRepo.create(data);
    const saved = await this.maintenanceRepo.save(maintenance);

    // Update asset next maintenance date
    if (data.nextDueDate) {
      asset.nextMaintenanceDate = data.nextDueDate;
      await this.assetRepo.save(asset);
    }

    return saved;
  }

  async getMaintenanceHistory(assetId: string): Promise<AssetMaintenance[]> {
    return this.maintenanceRepo.find({
      where: { assetId },
      order: { maintenanceDate: 'DESC' },
    });
  }

  async getMaintenanceDue(facilityId: string, daysAhead = 30): Promise<FixedAsset[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.assetRepo.find({
      where: {
        facilityId,
        status: AssetStatus.ACTIVE,
        nextMaintenanceDate: LessThan(futureDate),
      },
      order: { nextMaintenanceDate: 'ASC' },
    });
  }

  // ==================== TRANSFERS ====================

  async initiateTransfer(data: Partial<AssetTransfer>): Promise<AssetTransfer> {
    const asset = await this.assetRepo.findOne({ where: { id: data.assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    const transfer = this.transferRepo.create({
      ...data,
      fromFacilityId: asset.facilityId,
      fromDepartmentId: asset.departmentId,
      status: 'pending',
    });

    return this.transferRepo.save(transfer);
  }

  async completeTransfer(transferId: string, receivedBy: string): Promise<AssetTransfer> {
    const transfer = await this.transferRepo.findOne({ where: { id: transferId } });
    if (!transfer) throw new NotFoundException('Transfer not found');

    const asset = await this.assetRepo.findOne({ where: { id: transfer.assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    // Update asset location
    asset.facilityId = transfer.toFacilityId;
    asset.departmentId = transfer.toDepartmentId || undefined;
    await this.assetRepo.save(asset);

    // Complete transfer
    transfer.status = 'completed';
    transfer.receivedBy = receivedBy;
    transfer.receivedDate = new Date();
    return this.transferRepo.save(transfer);
  }

  async getTransferHistory(assetId: string): Promise<AssetTransfer[]> {
    return this.transferRepo.find({
      where: { assetId },
      order: { transferDate: 'DESC' },
    });
  }

  // ==================== DISPOSAL ====================

  async disposeAsset(id: string, data: {
    disposalDate: Date;
    disposalValue: number;
    disposalReason: string;
    status: AssetStatus;
  }): Promise<FixedAsset> {
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');

    asset.disposalDate = data.disposalDate;
    asset.disposalValue = data.disposalValue;
    asset.disposalReason = data.disposalReason;
    asset.status = data.status;

    return this.assetRepo.save(asset);
  }

  // ==================== REPORTS ====================

  async getAssetRegister(facilityId: string): Promise<FixedAsset[]> {
    return this.assetRepo.find({
      where: { facilityId },
      relations: ['department', 'custodian'],
      order: { assetCode: 'ASC' },
    });
  }

  async getAssetValuation(facilityId: string): Promise<{
    totalOriginalCost: number;
    totalAccumulatedDepreciation: number;
    totalNetBookValue: number;
    totalMarketValue: number;
    assetCount: number;
  }> {
    const assets = await this.assetRepo.find({
      where: { facilityId, status: AssetStatus.ACTIVE },
    });

    return {
      totalOriginalCost: assets.reduce((sum, a) => sum + Number(a.totalCost), 0),
      totalAccumulatedDepreciation: assets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation), 0),
      totalNetBookValue: assets.reduce((sum, a) => sum + Number(a.bookValue), 0),
      totalMarketValue: assets.reduce((sum, a) => sum + Number(a.currentMarketValue || a.bookValue), 0),
      assetCount: assets.length,
    };
  }

  async getLossOnDisposalReport(facilityId: string, startDate: Date, endDate: Date): Promise<{
    disposedAssets: FixedAsset[];
    totalBookValueAtDisposal: number;
    totalDisposalValue: number;
    totalLoss: number;
    totalGain: number;
    netLossGain: number;
  }> {
    const assets = await this.assetRepo.find({
      where: {
        facilityId,
        disposalDate: Between(startDate, endDate),
        status: AssetStatus.DISPOSED,
      },
    });

    let totalBookValue = 0;
    let totalDisposalValue = 0;
    let totalLoss = 0;
    let totalGain = 0;

    for (const asset of assets) {
      const bookValue = Number(asset.bookValue);
      const disposalValue = Number(asset.disposalValue) || 0;
      totalBookValue += bookValue;
      totalDisposalValue += disposalValue;

      const diff = disposalValue - bookValue;
      if (diff < 0) {
        totalLoss += Math.abs(diff);
      } else {
        totalGain += diff;
      }
    }

    return {
      disposedAssets: assets,
      totalBookValueAtDisposal: totalBookValue,
      totalDisposalValue,
      totalLoss,
      totalGain,
      netLossGain: totalGain - totalLoss,
    };
  }
}
