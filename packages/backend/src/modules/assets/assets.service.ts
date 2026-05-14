import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, In, DataSource } from 'typeorm';
import {
  FixedAsset,
  AssetDepreciation,
  AssetMaintenance,
  AssetTransfer,
  AssetTransferApproval,
  AssetStatus,
  AssetClass,
  AssetCriticality,
  DepreciationMethod,
  AssetCategory,
  AssetDisposal,
  AssetAllocation,
  AssetLocationHistory,
  TransferApprovalStage,
  DisposalMethod,
  DisposalStatus,
  AllocationStatus,
} from '../../database/entities/fixed-asset.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { FinanceService } from '../finance/finance.service';

interface ActorContext {
  userId?: string;
  tenantId?: string;
  ip?: string;
  ua?: string;
}

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
    @InjectRepository(AssetTransferApproval)
    private transferApprovalRepo: Repository<AssetTransferApproval>,
    @InjectRepository(AssetCategory)
    private categoryRepo: Repository<AssetCategory>,
    @InjectRepository(AssetDisposal)
    private disposalRepo: Repository<AssetDisposal>,
    @InjectRepository(AssetAllocation)
    private allocationRepo: Repository<AssetAllocation>,
    @InjectRepository(AssetLocationHistory)
    private locationHistoryRepo: Repository<AssetLocationHistory>,
    private dataSource: DataSource,
    @Optional() private auditLog?: AuditLogService,
    @Optional() @Inject(forwardRef(() => FinanceService)) private finance?: FinanceService,
  ) {}

  private async audit(
    ctx: ActorContext | undefined,
    action: string,
    entityType: string,
    entityId?: string,
    oldValue?: any,
    newValue?: any,
  ) {
    if (!this.auditLog) return;
    try {
      await this.auditLog.log({
        userId: ctx?.userId,
        action,
        entityType,
        entityId,
        oldValue,
        newValue,
        tenantId: ctx?.tenantId,
        ipAddress: ctx?.ip,
        userAgent: ctx?.ua,
      });
    } catch {
      // never let audit failure break business logic
    }
  }

  private async userHasPermission(userId: string, permissionCode: string): Promise<boolean> {
    try {
      // Super Admin bypass
      const superAdmin = await this.dataSource.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1 AND r.name = 'Super Admin' LIMIT 1`,
        [userId],
      );
      if (superAdmin?.length) return true;

      // Direct user permission
      const direct = await this.dataSource.query(
        `SELECT 1 FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
         WHERE up.user_id = $1 AND p.code = $2 LIMIT 1`,
        [userId, permissionCode],
      );
      if (direct?.length) return true;

      // Permission via role
      const viaRole = await this.dataSource.query(
        `SELECT 1 FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.user_id = $1 AND p.code = $2 LIMIT 1`,
        [userId, permissionCode],
      );
      return viaRole?.length > 0;
    } catch {
      return false;
    }
  }

  private async genSequentialNumber(prefix: string, tenantId: string | undefined, repo: Repository<any>, field: string): Promise<string> {
    const year = new Date().getFullYear();
    const row = await repo
      .createQueryBuilder('e')
      .select(`MAX(e.${field})`, 'max')
      .where(`e.${field} LIKE :p`, { p: `${prefix}-${year}-%` })
      .andWhere(tenantId ? 'e.tenant_id = :t' : '1=1', { t: tenantId })
      .getRawOne();
    let seq = 1;
    if (row?.max) {
      const m = String(row.max).match(/(\d+)$/);
      if (m) seq = Number(m[1]) + 1;
    }
    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  }

  // ==================== ASSET CRUD ====================

  async createAsset(data: Partial<FixedAsset>, ctx?: ActorContext): Promise<FixedAsset> {
    if (!data.assetCode) {
      data.assetCode = await this.genSequentialNumber('AST', ctx?.tenantId, this.assetRepo, 'assetCode');
    }
    const asset = this.assetRepo.create({
      ...data,
      totalCost: (Number(data.acquisitionCost) || 0) + (Number(data.installationCost) || 0),
      bookValue:
        (Number(data.acquisitionCost) || 0) +
        (Number(data.installationCost) || 0) -
        (Number(data.salvageValue) || 0),
      accumulatedDepreciation: 0,
      ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
    });

    // Apply category defaults if categoryId set and asset fields blank
    if (data.categoryId) {
      const cat = await this.categoryRepo.findOne({ where: { id: data.categoryId } });
      if (cat) {
        asset.assetClass = asset.assetClass || cat.assetClass;
        if (!asset.usefulLifeMonths && cat.defaultUsefulLifeMonths) asset.usefulLifeMonths = cat.defaultUsefulLifeMonths;
        if (!asset.depreciationMethod && cat.defaultDepreciationMethod) asset.depreciationMethod = cat.defaultDepreciationMethod;
        if (!asset.depreciationRate && cat.defaultDepreciationRate) asset.depreciationRate = cat.defaultDepreciationRate;
        if (!asset.calibrationIntervalDays && cat.defaultCalibrationIntervalDays) asset.calibrationIntervalDays = cat.defaultCalibrationIntervalDays;
        if (!asset.maintenanceIntervalDays && cat.defaultMaintenanceIntervalDays) asset.maintenanceIntervalDays = cat.defaultMaintenanceIntervalDays;
      }
    }

    // Auto-derive next-calibration-due if interval set but date missing
    if (asset.calibrationIntervalDays && !asset.nextCalibrationDue) {
      const base = asset.lastCalibrationDate || asset.acquisitionDate;
      if (base) {
        const d = new Date(base);
        d.setDate(d.getDate() + asset.calibrationIntervalDays);
        asset.nextCalibrationDue = d;
      }
    }

    const saved = await this.assetRepo.save(asset);

    // record initial location
    await this.locationHistoryRepo.save(
      this.locationHistoryRepo.create({
        assetId: saved.id,
        facilityId: saved.facilityId,
        departmentId: saved.departmentId,
        roomId: saved.roomId,
        locationLabel: saved.location,
        custodianId: saved.custodianId,
        movedAt: new Date(),
        movedBy: ctx?.userId,
        reason: 'manual',
        notes: 'Asset created',
        ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
      }),
    );

    await this.audit(ctx, 'asset.create', 'fixed_asset', saved.id, null, saved);
    return saved;
  }

  async updateAsset(id: string, data: Partial<FixedAsset>, ctx?: ActorContext): Promise<FixedAsset> {
    const asset = await this.assetRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    const before = { ...asset };
    Object.assign(asset, data);
    const saved = await this.assetRepo.save(asset);

    // record location change if any of facility/department/room/custodian changed
    if (
      data.facilityId !== undefined ||
      data.departmentId !== undefined ||
      data.roomId !== undefined ||
      data.custodianId !== undefined ||
      data.location !== undefined
    ) {
      await this.locationHistoryRepo.save(
        this.locationHistoryRepo.create({
          assetId: saved.id,
          facilityId: saved.facilityId,
          departmentId: saved.departmentId,
          roomId: saved.roomId,
          locationLabel: saved.location,
          custodianId: saved.custodianId,
          movedAt: new Date(),
          movedBy: ctx?.userId,
          reason: 'manual',
          ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
        }),
      );
    }

    await this.audit(ctx, 'asset.update', 'fixed_asset', saved.id, before, saved);
    return saved;
  }

  async getAsset(id: string, tenantId?: string): Promise<FixedAsset> {
    const asset = await this.assetRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: [
        'facility',
        'department',
        'custodian',
        'biomedEngineer',
        'depreciationRecords',
        'maintenanceRecords',
      ],
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async listAssets(
    facilityId: string,
    filters?: {
      category?: string;
      categoryId?: string;
      assetClass?: string;
      criticalityLevel?: string;
      status?: AssetStatus;
      departmentId?: string;
      custodianId?: string;
      search?: string;
    },
    tenantId?: string,
  ): Promise<FixedAsset[]> {
    const qb = this.assetRepo
      .createQueryBuilder('asset')
      .leftJoinAndSelect('asset.department', 'department')
      .leftJoinAndSelect('asset.custodian', 'custodian')
      .where('asset.facilityId = :facilityId', { facilityId });

    if (filters?.category) qb.andWhere('asset.category = :category', { category: filters.category });
    if (filters?.categoryId) qb.andWhere('asset.categoryId = :categoryId', { categoryId: filters.categoryId });
    if (filters?.assetClass) qb.andWhere('asset.assetClass = :assetClass', { assetClass: filters.assetClass });
    if (filters?.criticalityLevel)
      qb.andWhere('asset.criticalityLevel = :crit', { crit: filters.criticalityLevel });
    if (filters?.status) qb.andWhere('asset.status = :status', { status: filters.status });
    if (filters?.departmentId)
      qb.andWhere('asset.departmentId = :departmentId', { departmentId: filters.departmentId });
    if (filters?.custodianId)
      qb.andWhere('asset.custodianId = :custodianId', { custodianId: filters.custodianId });
    if (filters?.search) {
      qb.andWhere(
        '(asset.name ILIKE :search OR asset.assetCode ILIKE :search OR asset.serialNumber ILIKE :search OR asset.barcodeQr ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (tenantId) qb.andWhere('asset.tenant_id = :tenantId', { tenantId });

    return qb.orderBy('asset.assetCode', 'ASC').getMany();
  }

  async deleteAsset(id: string, ctx?: ActorContext): Promise<void> {
    const asset = await this.assetRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.status === AssetStatus.ACTIVE) {
      throw new BadRequestException(
        'Cannot delete an active asset. Dispose or mark inactive first.',
      );
    }
    await this.assetRepo.softDelete(id);
    await this.audit(ctx, 'asset.delete', 'fixed_asset', id, asset, null);
  }

  // ==================== DEPRECIATION ====================

  calculateMonthlyDepreciation(asset: FixedAsset): number {
    const depreciableAmount = Number(asset.totalCost) - Number(asset.salvageValue);

    switch (asset.depreciationMethod) {
      case DepreciationMethod.STRAIGHT_LINE:
        return depreciableAmount / asset.usefulLifeMonths;

      case DepreciationMethod.DECLINING_BALANCE: {
        const rate = asset.depreciationRate || (100 / asset.usefulLifeMonths) * 12;
        const currentValue = Number(asset.bookValue);
        return (currentValue * rate) / 100 / 12;
      }

      case DepreciationMethod.DOUBLE_DECLINING: {
        const ddRate = (2 * 100) / (asset.usefulLifeMonths / 12) / 12;
        return (Number(asset.bookValue) * ddRate) / 100;
      }

      default:
        return depreciableAmount / asset.usefulLifeMonths;
    }
  }

  async runDepreciation(
    facilityId: string,
    year: number,
    month: number,
    ctx?: ActorContext,
  ): Promise<AssetDepreciation[]> {
    const assets = await this.assetRepo.find({
      where: {
        facilityId,
        status: AssetStatus.ACTIVE,
        ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
      },
    });

    const results: AssetDepreciation[] = [];

    for (const asset of assets) {
      const existing = await this.depreciationRepo.findOne({
        where: {
          assetId: asset.id,
          periodYear: year,
          periodMonth: month,
          ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
        },
      });
      if (existing) continue;

      const depStartDate = new Date(asset.depreciationStartDate);
      const periodDate = new Date(year, month - 1, 1);
      if (periodDate < depStartDate) continue;
      if (Number(asset.bookValue) <= Number(asset.salvageValue)) continue;

      const monthlyDep = this.calculateMonthlyDepreciation(asset);
      const depAmount = Math.min(monthlyDep, Number(asset.bookValue) - Number(asset.salvageValue));

      const depRecord = this.depreciationRepo.create({
        assetId: asset.id,
        periodYear: year,
        periodMonth: month,
        openingBookValue: asset.bookValue,
        depreciationAmount: depAmount,
        accumulatedDepreciation: Number(asset.accumulatedDepreciation) + depAmount,
        closingBookValue: Number(asset.bookValue) - depAmount,
        isPosted: false,
        ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
      });

      const saved = await this.depreciationRepo.save(depRecord);
      results.push(saved);

      asset.accumulatedDepreciation = Number(asset.accumulatedDepreciation) + depAmount;
      asset.bookValue = Number(asset.bookValue) - depAmount;
      await this.assetRepo.save(asset);
    }

    // Post a single aggregated journal entry to GL (depreciation expense vs accumulated depreciation)
    if (results.length > 0 && this.finance && ctx?.userId) {
      try {
        const total = results.reduce((s, r) => s + Number(r.depreciationAmount), 0);
        const accounts: any[] = await this.dataSource.query(
          `SELECT id, code FROM chart_of_accounts WHERE code = ANY($1) AND ($2::uuid IS NULL OR tenant_id = $2) LIMIT 10`,
          [['6500', '1599'], ctx.tenantId || null],
        );
        const expenseAcc = accounts.find((a: any) => a.code === '6500');
        const accumDepAcc = accounts.find((a: any) => a.code === '1599');
        if (expenseAcc && accumDepAcc) {
          const journal = await this.finance.createJournalEntry(
            {
              facilityId,
              journalDate: new Date(year, month - 1, 28).toISOString(),
              journalType: 'DEPRECIATION' as any,
              description: `Monthly asset depreciation ${year}-${String(month).padStart(2, '0')}`,
              reference: `DEPR-${year}-${String(month).padStart(2, '0')}`,
              lines: [
                { accountId: expenseAcc.id, debit: total, credit: 0, description: 'Depreciation expense' },
                { accountId: accumDepAcc.id, debit: 0, credit: total, description: 'Accumulated depreciation' },
              ],
            } as any,
            ctx.userId,
            ctx.tenantId,
          );
          for (const r of results) {
            r.isPosted = true;
            r.journalEntryId = journal.id;
            r.postedBy = ctx.userId;
            r.postedAt = new Date();
            await this.depreciationRepo.save(r);
          }
        }
      } catch {
        // GL posting is best-effort; depreciation records still created
      }
    }

    await this.audit(ctx, 'asset.depreciation.run', 'asset_depreciation', undefined, null, {
      facilityId,
      year,
      month,
      count: results.length,
    });
    return results;
  }

  async getDepreciationSchedule(assetId: string, tenantId?: string): Promise<AssetDepreciation[]> {
    return this.depreciationRepo.find({
      where: { assetId, ...(tenantId ? { tenantId } : {}) },
      order: { periodYear: 'ASC', periodMonth: 'ASC' },
    });
  }

  async getDepreciationReport(
    facilityId: string,
    year: number,
    month?: number,
    tenantId?: string,
  ): Promise<any> {
    const assets = await this.assetRepo.find({
      where: { facilityId, status: AssetStatus.ACTIVE, ...(tenantId ? { tenantId } : {}) },
    });

    const depQuery: any = { periodYear: year, ...(tenantId ? { tenantId } : {}) };
    if (month) depQuery.periodMonth = month;
    const periodDeps = await this.depreciationRepo.find({ where: depQuery });

    const byCategory: Record<string, any> = {};
    for (const asset of assets) {
      const k = asset.category || 'uncategorized';
      if (!byCategory[k]) byCategory[k] = { count: 0, cost: 0, accumulated: 0, bookValue: 0 };
      byCategory[k].count++;
      byCategory[k].cost += Number(asset.totalCost);
      byCategory[k].accumulated += Number(asset.accumulatedDepreciation);
      byCategory[k].bookValue += Number(asset.bookValue);
    }

    return {
      totalAssets: assets.length,
      totalCost: assets.reduce((s, a) => s + Number(a.totalCost), 0),
      totalAccumulatedDepreciation: assets.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0),
      totalBookValue: assets.reduce((s, a) => s + Number(a.bookValue), 0),
      periodDepreciation: periodDeps.reduce((s, d) => s + Number(d.depreciationAmount), 0),
      periodPostedToGl: periodDeps.filter((d) => d.isPosted).reduce((s, d) => s + Number(d.depreciationAmount), 0),
      byCategory,
    };
  }

  // ==================== MAINTENANCE ====================

  async recordMaintenance(data: Partial<AssetMaintenance>, ctx?: ActorContext): Promise<AssetMaintenance> {
    const asset = await this.assetRepo.findOne({
      where: { id: data.assetId, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    const m = this.maintenanceRepo.create({
      ...data,
      facilityId: data.facilityId || asset.facilityId,
      ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
    });
    const saved = await this.maintenanceRepo.save(m);

    if (data.nextDueDate) {
      asset.nextMaintenanceDate = data.nextDueDate;
    }
    // calibration sub-flow
    if ((data.type || '').toLowerCase() === 'calibration') {
      asset.lastCalibrationDate = data.maintenanceDate || new Date();
      if (asset.calibrationIntervalDays) {
        const next = new Date(asset.lastCalibrationDate);
        next.setDate(next.getDate() + asset.calibrationIntervalDays);
        asset.nextCalibrationDue = next;
      }
    }
    await this.assetRepo.save(asset);

    await this.audit(ctx, 'asset.maintenance.record', 'asset_maintenance', saved.id, null, saved);
    return saved;
  }

  async getMaintenanceHistory(assetId: string, tenantId?: string): Promise<AssetMaintenance[]> {
    return this.maintenanceRepo.find({
      where: { assetId, ...(tenantId ? { tenantId } : {}) },
      order: { maintenanceDate: 'DESC' },
    });
  }

  async getMaintenanceDue(facilityId: string, daysAhead = 30, tenantId?: string): Promise<FixedAsset[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    return this.assetRepo.find({
      where: {
        facilityId,
        status: AssetStatus.ACTIVE,
        nextMaintenanceDate: LessThan(futureDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { nextMaintenanceDate: 'ASC' },
    });
  }

  async getCalibrationDue(facilityId: string, daysAhead = 30, tenantId?: string): Promise<FixedAsset[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    return this.assetRepo.find({
      where: {
        facilityId,
        status: AssetStatus.ACTIVE,
        nextCalibrationDue: LessThan(futureDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { nextCalibrationDue: 'ASC' },
    });
  }

  async getAmcExpiring(facilityId: string, daysAhead = 60, tenantId?: string): Promise<FixedAsset[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    return this.assetRepo.find({
      where: {
        facilityId,
        amcEndDate: LessThan(futureDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { amcEndDate: 'ASC' },
    });
  }

  async getWarrantyExpiring(facilityId: string, daysAhead = 60, tenantId?: string): Promise<FixedAsset[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);
    return this.assetRepo.find({
      where: {
        facilityId,
        warrantyExpiry: LessThan(futureDate),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { warrantyExpiry: 'ASC' },
    });
  }

  // ==================== TRANSFERS (with approval workflow) ====================

  async initiateTransfer(data: Partial<AssetTransfer>, ctx?: ActorContext): Promise<AssetTransfer> {
    const asset = await this.assetRepo.findOne({
      where: { id: data.assetId, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.status !== AssetStatus.ACTIVE) {
      throw new BadRequestException(`Cannot transfer asset in status ${asset.status}`);
    }

    const xferNo = await this.genSequentialNumber('XFR', ctx?.tenantId, this.transferRepo, 'transferNumber');

    const transfer = this.transferRepo.create({
      ...data,
      transferNumber: xferNo,
      transferDate: data.transferDate || new Date(),
      transferredBy: ctx?.userId || data.transferredBy!,
      fromFacilityId: asset.facilityId,
      fromDepartmentId: asset.departmentId,
      status: 'pending',
      ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
    });
    const saved = await this.transferRepo.save(transfer);

    // Pre-create approval rows for the workflow stages
    const stages: TransferApprovalStage[] = [
      TransferApprovalStage.ORIGIN_DEPT_HEAD,
      TransferApprovalStage.RECEIVING_DEPT_HEAD,
      TransferApprovalStage.STORE_KEEPER,
    ];
    for (const stage of stages) {
      await this.transferApprovalRepo.save(
        this.transferApprovalRepo.create({
          transferId: saved.id,
          stage,
          decision: 'pending',
          ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
        }),
      );
    }

    await this.audit(ctx, 'asset.transfer.initiate', 'asset_transfer', saved.id, null, saved);
    return saved;
  }

  async listTransfers(facilityId: string, status?: string, tenantId?: string): Promise<AssetTransfer[]> {
    const qb = this.transferRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.asset', 'asset')
      .leftJoinAndSelect('t.approvals', 'approvals')
      .where('(t.fromFacilityId = :f OR t.toFacilityId = :f)', { f: facilityId });
    if (status && status !== 'All') qb.andWhere('t.status = :s', { s: status });
    if (tenantId) qb.andWhere('t.tenant_id = :t', { t: tenantId });
    return qb.orderBy('t.createdAt', 'DESC').getMany();
  }

  async approveTransferStage(
    transferId: string,
    stage: TransferApprovalStage,
    decision: 'approved' | 'rejected',
    comments: string | undefined,
    ctx?: ActorContext,
  ): Promise<AssetTransfer> {
    if (ctx?.userId) {
      const stagePerm =
        stage === TransferApprovalStage.ORIGIN_DEPT_HEAD
          ? 'assets.transfer.approve.origin'
          : stage === TransferApprovalStage.RECEIVING_DEPT_HEAD
          ? 'assets.transfer.approve.receiving'
          : 'assets.transfer.approve.store';
      const has = await this.userHasPermission(ctx.userId, stagePerm);
      if (!has) {
        throw new BadRequestException(
          `User lacks the required permission for this approval stage (${stagePerm}).`,
        );
      }
    }

    const transfer = await this.transferRepo.findOne({
      where: { id: transferId, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
      relations: ['approvals'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');

    const approval = transfer.approvals?.find((a) => a.stage === stage);
    if (!approval) throw new BadRequestException(`Approval stage ${stage} not found`);
    if (approval.decision !== 'pending') {
      throw new BadRequestException(`Stage ${stage} already decided as ${approval.decision}`);
    }

    approval.decision = decision;
    approval.decidedBy = ctx?.userId;
    approval.decidedAt = new Date();
    approval.comments = comments;
    await this.transferApprovalRepo.save(approval);

    if (decision === 'rejected') {
      transfer.status = 'rejected';
      await this.transferRepo.save(transfer);
      await this.audit(ctx, 'asset.transfer.reject', 'asset_transfer', transferId, null, { stage, comments });
      return transfer;
    }

    // Update overall status based on which stages are approved
    const fresh = await this.transferRepo.findOne({ where: { id: transferId }, relations: ['approvals'] });
    const all = fresh!.approvals;
    if (all.find((a) => a.stage === TransferApprovalStage.STORE_KEEPER)?.decision === 'approved') {
      transfer.status = 'in_transit';
    } else if (
      all.find((a) => a.stage === TransferApprovalStage.RECEIVING_DEPT_HEAD)?.decision === 'approved'
    ) {
      transfer.status = 'receiving_approved';
    } else if (
      all.find((a) => a.stage === TransferApprovalStage.ORIGIN_DEPT_HEAD)?.decision === 'approved'
    ) {
      transfer.status = 'origin_approved';
    }
    await this.transferRepo.save(transfer);

    await this.audit(ctx, 'asset.transfer.approve', 'asset_transfer', transferId, null, { stage });
    return transfer;
  }

  async completeTransfer(
    transferId: string,
    receivedBy: string,
    conditionOnReceipt?: string,
    ctx?: ActorContext,
  ): Promise<AssetTransfer> {
    const transfer = await this.transferRepo.findOne({
      where: { id: transferId, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
      relations: ['approvals'],
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status === 'completed') return transfer;
    if (transfer.status !== 'in_transit' && transfer.status !== 'receiving_approved') {
      throw new BadRequestException(
        `Cannot complete transfer in status ${transfer.status}; must be in_transit or receiving_approved`,
      );
    }

    const asset = await this.assetRepo.findOne({
      where: { id: transfer.assetId, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    asset.facilityId = transfer.toFacilityId;
    asset.departmentId = transfer.toDepartmentId || undefined;
    if (transfer.toCustodianId) asset.custodianId = transfer.toCustodianId;
    asset.condition = (conditionOnReceipt as any) || asset.condition;
    await this.assetRepo.save(asset);

    transfer.status = 'completed';
    transfer.receivedBy = receivedBy;
    transfer.receivedDate = new Date();
    const saved = await this.transferRepo.save(transfer);

    await this.locationHistoryRepo.save(
      this.locationHistoryRepo.create({
        assetId: asset.id,
        facilityId: asset.facilityId,
        departmentId: asset.departmentId,
        roomId: asset.roomId,
        custodianId: asset.custodianId,
        movedAt: new Date(),
        movedBy: ctx?.userId,
        reason: 'transfer',
        referenceId: transferId,
        ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
      }),
    );

    await this.audit(ctx, 'asset.transfer.complete', 'asset_transfer', saved.id, null, saved);
    return saved;
  }

  async getTransferHistory(assetId: string, tenantId?: string): Promise<AssetTransfer[]> {
    return this.transferRepo.find({
      where: { assetId, ...(tenantId ? { tenantId } : {}) },
      relations: ['approvals'],
      order: { transferDate: 'DESC' },
    });
  }

  // ==================== ALLOCATIONS ====================

  async createAllocation(data: any, ctx?: ActorContext): Promise<AssetAllocation> {
    const asset = await this.assetRepo.findOne({
      where: { id: data.assetId, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');

    // Reject if asset has an open allocation
    const open = await this.allocationRepo.findOne({
      where: {
        assetId: data.assetId,
        status: In([AllocationStatus.REQUESTED, AllocationStatus.DEPT_HEAD_APPROVED, AllocationStatus.ALLOCATED]),
        ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
      },
    });
    if (open) throw new BadRequestException('Asset already has an open allocation');

    const no = await this.genSequentialNumber('ALC', ctx?.tenantId, this.allocationRepo, 'allocationNumber');
    const allocation = this.allocationRepo.create({
      ...data,
      allocationNumber: no,
      requestedBy: ctx?.userId || data.requestedBy,
      status: AllocationStatus.REQUESTED,
      ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
    });
    const saved = (await this.allocationRepo.save(allocation)) as unknown as AssetAllocation;
    await this.audit(ctx, 'asset.allocation.request', 'asset_allocation', saved.id, null, saved);
    return saved;
  }

  async listAllocations(
    facilityId: string,
    filters?: { status?: string; custodianId?: string; assetId?: string },
    tenantId?: string,
  ): Promise<AssetAllocation[]> {
    const qb = this.allocationRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.asset', 'asset')
      .leftJoinAndSelect('a.custodian', 'custodian')
      .where('a.facilityId = :f', { f: facilityId });
    if (filters?.status && filters.status !== 'All') qb.andWhere('a.status = :s', { s: filters.status });
    if (filters?.custodianId) qb.andWhere('a.custodianId = :c', { c: filters.custodianId });
    if (filters?.assetId) qb.andWhere('a.assetId = :ai', { ai: filters.assetId });
    if (tenantId) qb.andWhere('a.tenant_id = :t', { t: tenantId });
    return qb.orderBy('a.createdAt', 'DESC').getMany();
  }

  async approveAllocation(
    id: string,
    decision: 'approved' | 'rejected',
    comments: string | undefined,
    ctx?: ActorContext,
  ): Promise<AssetAllocation> {
    const a = await this.allocationRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!a) throw new NotFoundException('Allocation not found');
    if (a.status !== AllocationStatus.REQUESTED) {
      throw new BadRequestException(`Cannot approve allocation in status ${a.status}`);
    }
    if (decision === 'rejected') {
      a.status = AllocationStatus.REJECTED;
      a.notes = [a.notes, comments].filter(Boolean).join(' | ');
    } else {
      a.status = AllocationStatus.DEPT_HEAD_APPROVED;
      a.approvedBy = ctx?.userId;
      a.approvedAt = new Date();
    }
    const saved = await this.allocationRepo.save(a);
    await this.audit(ctx, `asset.allocation.${decision}`, 'asset_allocation', id, null, saved);
    return saved;
  }

  async issueAllocation(id: string, ctx?: ActorContext): Promise<AssetAllocation> {
    const a = await this.allocationRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!a) throw new NotFoundException('Allocation not found');
    if (a.status !== AllocationStatus.DEPT_HEAD_APPROVED) {
      throw new BadRequestException('Allocation must be approved by dept head before issue');
    }

    const asset = await this.assetRepo.findOne({ where: { id: a.assetId } });
    if (!asset) throw new NotFoundException('Asset not found');
    asset.custodianId = a.custodianId;
    if (a.departmentId) asset.departmentId = a.departmentId;
    if (a.roomId) asset.roomId = a.roomId;
    await this.assetRepo.save(asset);

    a.status = AllocationStatus.ALLOCATED;
    const saved = await this.allocationRepo.save(a);

    await this.locationHistoryRepo.save(
      this.locationHistoryRepo.create({
        assetId: asset.id,
        facilityId: asset.facilityId,
        departmentId: asset.departmentId,
        roomId: asset.roomId,
        custodianId: asset.custodianId,
        movedAt: new Date(),
        movedBy: ctx?.userId,
        reason: 'allocation',
        referenceId: id,
        ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
      }),
    );

    await this.audit(ctx, 'asset.allocation.issue', 'asset_allocation', id, null, saved);
    return saved;
  }

  async returnAllocation(
    id: string,
    returnDate: string,
    conditionOnReturn?: string,
    notes?: string,
    ctx?: ActorContext,
  ): Promise<AssetAllocation> {
    const a = await this.allocationRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!a) throw new NotFoundException('Allocation not found');
    if (a.status !== AllocationStatus.ALLOCATED) {
      throw new BadRequestException('Only ALLOCATED can be returned');
    }
    a.status = AllocationStatus.RETURNED;
    a.actualReturnDate = new Date(returnDate);
    a.conditionOnReturn = conditionOnReturn;
    if (notes) a.notes = [a.notes, notes].filter(Boolean).join(' | ');
    const saved = await this.allocationRepo.save(a);
    await this.audit(ctx, 'asset.allocation.return', 'asset_allocation', id, null, saved);
    return saved;
  }

  // ==================== DISPOSAL (full workflow) ====================

  async createDisposalRequest(data: any, ctx?: ActorContext): Promise<AssetDisposal> {
    const asset = await this.assetRepo.findOne({
      where: { id: data.assetId, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.status === AssetStatus.DISPOSED || asset.status === AssetStatus.WRITTEN_OFF) {
      throw new BadRequestException(`Asset already in status ${asset.status}`);
    }

    const open = await this.disposalRepo.findOne({
      where: {
        assetId: data.assetId,
        status: In([
          DisposalStatus.REQUESTED,
          DisposalStatus.BIOMED_REVIEW,
          DisposalStatus.COMMITTEE_APPROVAL,
          DisposalStatus.APPROVED,
        ]),
        ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
      },
    });
    if (open) throw new BadRequestException('Asset already has an open disposal request');

    const no = await this.genSequentialNumber('DSP', ctx?.tenantId, this.disposalRepo, 'disposalNumber');
    const isMedical = asset.assetClass === AssetClass.MEDICAL;
    const disposal = this.disposalRepo.create({
      disposalNumber: no,
      assetId: data.assetId,
      facilityId: data.facilityId || asset.facilityId,
      method: data.method,
      reason: data.reason,
      expectedValue: Number(data.expectedValue) || 0,
      buyer: data.buyer,
      requestedDate: new Date(),
      requestedBy: ctx?.userId!,
      status: isMedical ? DisposalStatus.BIOMED_REVIEW : DisposalStatus.COMMITTEE_APPROVAL,
      attachments: data.attachments,
      notes: data.notes,
      ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
    });
    const saved = await this.disposalRepo.save(disposal);
    await this.audit(ctx, 'asset.disposal.request', 'asset_disposal', saved.id, null, saved);
    return saved;
  }

  async listDisposals(
    facilityId: string,
    filters?: { status?: string; method?: string },
    tenantId?: string,
  ): Promise<AssetDisposal[]> {
    const qb = this.disposalRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.asset', 'asset')
      .where('d.facilityId = :f', { f: facilityId });
    if (filters?.status && filters.status !== 'All') qb.andWhere('d.status = :s', { s: filters.status });
    if (filters?.method && filters.method !== 'All') qb.andWhere('d.method = :m', { m: filters.method });
    if (tenantId) qb.andWhere('d.tenant_id = :t', { t: tenantId });
    return qb.orderBy('d.createdAt', 'DESC').getMany();
  }

  async biomedReview(
    id: string,
    assessment: string,
    recommendation: 'approve' | 'reject',
    ctx?: ActorContext,
  ): Promise<AssetDisposal> {
    const d = await this.disposalRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!d) throw new NotFoundException('Disposal not found');
    if (d.status !== DisposalStatus.BIOMED_REVIEW) {
      throw new BadRequestException('Disposal not awaiting biomed review');
    }
    d.biomedReviewedBy = ctx?.userId;
    d.biomedReviewedAt = new Date();
    d.biomedAssessment = assessment;
    d.status = recommendation === 'approve' ? DisposalStatus.COMMITTEE_APPROVAL : DisposalStatus.REJECTED;
    const saved = await this.disposalRepo.save(d);
    await this.audit(ctx, `asset.disposal.biomed_${recommendation}`, 'asset_disposal', id, null, saved);
    return saved;
  }

  async committeeDecision(
    id: string,
    role: string,
    decision: 'approved' | 'rejected',
    comments: string | undefined,
    ctx?: ActorContext,
  ): Promise<AssetDisposal> {
    const d = await this.disposalRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!d) throw new NotFoundException('Disposal not found');
    if (d.status !== DisposalStatus.COMMITTEE_APPROVAL) {
      throw new BadRequestException('Disposal not awaiting committee approval');
    }
    const approvals = d.committeeApprovals || [];
    if (approvals.find((a) => a.userId === ctx?.userId)) {
      throw new BadRequestException('You have already voted on this disposal');
    }
    approvals.push({
      userId: ctx?.userId!,
      role,
      decision,
      at: new Date().toISOString(),
      comments,
    });
    d.committeeApprovals = approvals;

    if (decision === 'rejected') {
      d.status = DisposalStatus.REJECTED;
    } else {
      // Need at least 2 distinct-role approvals to proceed (Auditor + Admin/FM)
      const approved = approvals.filter((a) => a.decision === 'approved');
      const distinctRoles = new Set(approved.map((a) => a.role));
      if (distinctRoles.size >= 2) {
        d.status = DisposalStatus.APPROVED;
      }
    }
    const saved = await this.disposalRepo.save(d);
    await this.audit(ctx, `asset.disposal.committee_${decision}`, 'asset_disposal', id, null, saved);
    return saved;
  }

  async completeDisposal(
    id: string,
    body: { disposalDate: string; actualValue: number; buyer?: string; notes?: string },
    ctx?: ActorContext,
  ): Promise<AssetDisposal> {
    const d = await this.disposalRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!d) throw new NotFoundException('Disposal not found');
    if (d.status !== DisposalStatus.APPROVED) {
      throw new BadRequestException('Disposal must be APPROVED before completion');
    }

    const asset = await this.assetRepo.findOne({ where: { id: d.assetId } });
    if (!asset) throw new NotFoundException('Asset not found');

    d.disposalDate = new Date(body.disposalDate);
    d.actualValue = Number(body.actualValue) || 0;
    d.buyer = body.buyer || d.buyer;
    d.completedBy = ctx?.userId;
    d.status = DisposalStatus.COMPLETED;
    if (body.notes) d.notes = [d.notes, body.notes].filter(Boolean).join(' | ');

    asset.disposalDate = d.disposalDate;
    asset.disposalValue = d.actualValue;
    asset.disposalReason = d.reason;
    asset.status = d.method === DisposalMethod.WRITE_OFF ? AssetStatus.WRITTEN_OFF : AssetStatus.DISPOSED;
    await this.assetRepo.save(asset);

    // Post gain/loss to GL
    if (this.finance && ctx?.userId) {
      try {
        const bookValue = Number(asset.bookValue);
        const proceeds = d.actualValue;
        const accumDep = Number(asset.accumulatedDepreciation);
        const cost = Number(asset.totalCost);
        const gainLoss = proceeds - bookValue;

        const accounts: any[] = await this.dataSource.query(
          `SELECT id, code FROM chart_of_accounts WHERE code = ANY($1) AND ($2::uuid IS NULL OR tenant_id = $2)`,
          [['1100', '1500', '1599', '7100', '8100'], ctx.tenantId || null],
        );
        const cash = accounts.find((a: any) => a.code === '1100');
        const fixedAssetAcc = accounts.find((a: any) => a.code === '1500');
        const accumDepAcc = accounts.find((a: any) => a.code === '1599');
        const gainAcc = accounts.find((a: any) => a.code === '7100');
        const lossAcc = accounts.find((a: any) => a.code === '8100');

        if (cash && fixedAssetAcc && accumDepAcc && (gainAcc || lossAcc)) {
          const lines: any[] = [
            { accountId: cash.id, debit: proceeds, credit: 0, description: `Disposal proceeds ${asset.assetCode}` },
            { accountId: accumDepAcc.id, debit: accumDep, credit: 0, description: 'Reverse accumulated depreciation' },
            { accountId: fixedAssetAcc.id, debit: 0, credit: cost, description: 'Remove asset cost' },
          ];
          if (gainLoss > 0 && gainAcc) {
            lines.push({ accountId: gainAcc.id, debit: 0, credit: gainLoss, description: 'Gain on disposal' });
          } else if (gainLoss < 0 && lossAcc) {
            lines.push({ accountId: lossAcc.id, debit: -gainLoss, credit: 0, description: 'Loss on disposal' });
          }
          const journal = await this.finance.createJournalEntry(
            {
              facilityId: asset.facilityId,
              journalDate: d.disposalDate.toISOString(),
              journalType: 'DISPOSAL' as any,
              description: `Asset disposal ${asset.assetCode} (${d.disposalNumber})`,
              reference: d.disposalNumber,
              lines,
            } as any,
            ctx.userId,
            ctx.tenantId,
          );
          d.journalEntryId = journal.id;
        }
      } catch {
        // best-effort GL posting
      }
    }

    const saved = await this.disposalRepo.save(d);
    await this.audit(ctx, 'asset.disposal.complete', 'asset_disposal', id, null, saved);
    return saved;
  }

  // Legacy quick-disposal (kept for backward-compatibility)
  async disposeAsset(
    id: string,
    data: { disposalDate: Date; disposalValue: number; disposalReason: string; status: AssetStatus },
    ctx?: ActorContext,
  ): Promise<FixedAsset> {
    const asset = await this.assetRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    asset.disposalDate = data.disposalDate;
    asset.disposalValue = data.disposalValue;
    asset.disposalReason = data.disposalReason;
    asset.status = data.status;
    const saved = await this.assetRepo.save(asset);
    await this.audit(ctx, 'asset.dispose.quick', 'fixed_asset', id, null, saved);
    return saved;
  }

  // ==================== CATEGORIES ====================

  async listCategories(filters: { assetClass?: string; isActive?: boolean }, tenantId?: string): Promise<AssetCategory[]> {
    const qb = this.categoryRepo.createQueryBuilder('c').orderBy('c.code', 'ASC');
    if (filters.assetClass) qb.where('c.assetClass = :ac', { ac: filters.assetClass });
    if (filters.isActive !== undefined) qb.andWhere('c.isActive = :a', { a: filters.isActive });
    if (tenantId) qb.andWhere('c.tenant_id = :t', { t: tenantId });
    return qb.getMany();
  }

  async createCategory(data: any, ctx?: ActorContext): Promise<AssetCategory> {
    const cat = this.categoryRepo.create({ ...data, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) });
    const saved = (await this.categoryRepo.save(cat)) as unknown as AssetCategory;
    await this.audit(ctx, 'asset.category.create', 'asset_category', saved.id, null, saved);
    return saved;
  }

  async updateCategory(id: string, data: any, ctx?: ActorContext): Promise<AssetCategory> {
    const cat = await this.categoryRepo.findOne({
      where: { id, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!cat) throw new NotFoundException('Category not found');
    Object.assign(cat, data);
    const saved = await this.categoryRepo.save(cat);
    await this.audit(ctx, 'asset.category.update', 'asset_category', id, null, saved);
    return saved;
  }

  async deleteCategory(id: string, ctx?: ActorContext): Promise<void> {
    const used = await this.assetRepo.count({ where: { categoryId: id } });
    if (used > 0) throw new BadRequestException(`Category in use by ${used} assets — deactivate instead`);
    await this.categoryRepo.softDelete(id);
    await this.audit(ctx, 'asset.category.delete', 'asset_category', id, null, null);
  }

  // ==================== LOCATION HISTORY ====================

  async getLocationHistory(assetId: string, tenantId?: string): Promise<AssetLocationHistory[]> {
    return this.locationHistoryRepo.find({
      where: { assetId, ...(tenantId ? { tenantId } : {}) },
      order: { movedAt: 'DESC' },
    });
  }

  async recordLocation(assetId: string, data: any, ctx?: ActorContext): Promise<AssetLocationHistory> {
    const asset = await this.assetRepo.findOne({
      where: { id: assetId, ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}) },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    if (data.departmentId !== undefined) asset.departmentId = data.departmentId;
    if (data.roomId !== undefined) asset.roomId = data.roomId;
    if (data.locationLabel !== undefined) asset.location = data.locationLabel;
    if (data.custodianId !== undefined) asset.custodianId = data.custodianId;
    await this.assetRepo.save(asset);

    const hist = this.locationHistoryRepo.create({
      assetId,
      facilityId: asset.facilityId,
      departmentId: asset.departmentId,
      roomId: asset.roomId,
      locationLabel: asset.location,
      custodianId: asset.custodianId,
      movedAt: new Date(),
      movedBy: ctx?.userId,
      reason: data.reason || 'manual',
      notes: data.notes,
      ...(ctx?.tenantId ? { tenantId: ctx.tenantId } : {}),
    });
    const saved = await this.locationHistoryRepo.save(hist);
    await this.audit(ctx, 'asset.location.update', 'fixed_asset', assetId, null, saved);
    return saved;
  }

  // ==================== REPORTS ====================

  async getAssetRegister(facilityId: string, tenantId?: string): Promise<FixedAsset[]> {
    return this.assetRepo.find({
      where: { facilityId, ...(tenantId ? { tenantId } : {}) },
      relations: ['department', 'custodian'],
      order: { assetCode: 'ASC' },
    });
  }

  async getAssetValuation(facilityId: string, tenantId?: string): Promise<any> {
    const assets = await this.assetRepo.find({
      where: { facilityId, status: AssetStatus.ACTIVE, ...(tenantId ? { tenantId } : {}) },
    });

    const byClass: Record<string, any> = {};
    for (const a of assets) {
      const k = a.assetClass || 'unclassified';
      if (!byClass[k]) byClass[k] = { count: 0, cost: 0, accumulated: 0, bookValue: 0, replacement: 0 };
      byClass[k].count++;
      byClass[k].cost += Number(a.totalCost);
      byClass[k].accumulated += Number(a.accumulatedDepreciation);
      byClass[k].bookValue += Number(a.bookValue);
      byClass[k].replacement += Number(a.replacementCost || 0);
    }

    return {
      totalOriginalCost: assets.reduce((s, a) => s + Number(a.totalCost), 0),
      totalAccumulatedDepreciation: assets.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0),
      totalNetBookValue: assets.reduce((s, a) => s + Number(a.bookValue), 0),
      totalMarketValue: assets.reduce((s, a) => s + Number(a.currentMarketValue || a.bookValue), 0),
      totalReplacementCost: assets.reduce((s, a) => s + Number(a.replacementCost || 0), 0),
      assetCount: assets.length,
      byClass,
    };
  }

  async getLossOnDisposalReport(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<any> {
    const assets = await this.assetRepo.find({
      where: {
        facilityId,
        disposalDate: Between(startDate, endDate),
        status: In([AssetStatus.DISPOSED, AssetStatus.WRITTEN_OFF]),
        ...(tenantId ? { tenantId } : {}),
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
      if (diff < 0) totalLoss += Math.abs(diff);
      else totalGain += diff;
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

  async getAgeAnalysisReport(facilityId: string, tenantId?: string): Promise<any> {
    const assets = await this.assetRepo.find({
      where: { facilityId, status: AssetStatus.ACTIVE, ...(tenantId ? { tenantId } : {}) },
    });
    const now = new Date();
    const buckets: Record<string, { count: number; bookValue: number }> = {
      '0-1y': { count: 0, bookValue: 0 },
      '1-3y': { count: 0, bookValue: 0 },
      '3-5y': { count: 0, bookValue: 0 },
      '5-10y': { count: 0, bookValue: 0 },
      '10y+': { count: 0, bookValue: 0 },
    };
    for (const a of assets) {
      const ageYrs = (now.getTime() - new Date(a.acquisitionDate).getTime()) / (365.25 * 24 * 3600 * 1000);
      const bv = Number(a.bookValue);
      const k = ageYrs < 1 ? '0-1y' : ageYrs < 3 ? '1-3y' : ageYrs < 5 ? '3-5y' : ageYrs < 10 ? '5-10y' : '10y+';
      buckets[k].count++;
      buckets[k].bookValue += bv;
    }
    return { buckets, totalAssets: assets.length };
  }

  async getMaintenanceCostReport(
    facilityId: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<any> {
    const records = await this.maintenanceRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.asset', 'a')
      .where('m.facilityId = :f', { f: facilityId })
      .andWhere('m.maintenanceDate BETWEEN :s AND :e', { s: startDate, e: endDate })
      .andWhere(tenantId ? 'm.tenant_id = :t' : '1=1', { t: tenantId })
      .orderBy('m.maintenanceDate', 'DESC')
      .getMany();

    const byType: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;
    for (const r of records) {
      const t = (r.type || 'unknown').toLowerCase();
      if (!byType[t]) byType[t] = { count: 0, cost: 0 };
      byType[t].count++;
      byType[t].cost += Number(r.cost) || 0;
      totalCost += Number(r.cost) || 0;
    }
    return { records, byType, totalCost, count: records.length };
  }
}
