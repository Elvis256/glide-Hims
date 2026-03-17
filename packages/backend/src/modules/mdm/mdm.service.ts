import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import {
  MasterDataVersion,
  MasterDataApprovalRule,
  MasterDataEntityType,
  VersionAction,
  ApprovalStatus,
} from '../../database/entities/master-data-version.entity';
import { MasterDataVersionQueryDto, ApproveVersionDto, CreateApprovalRuleDto } from './dto/mdm.dto';

@Injectable()
export class MdmService {
  constructor(
    @InjectRepository(MasterDataVersion)
    private versionRepository: Repository<MasterDataVersion>,
    @InjectRepository(MasterDataApprovalRule)
    private ruleRepository: Repository<MasterDataApprovalRule>,
  ) {}

  async recordVersion(params: {
    facilityId?: string;
    entityType: MasterDataEntityType;
    entityId: string;
    action: VersionAction;
    previousData?: Record<string, any>;
    currentData: Record<string, any>;
    changeReason?: string;
    changedBy: string;
    ipAddress?: string;
    userAgent?: string;
  }, tenantId?: string): Promise<MasterDataVersion> {
    // Get current version number
    const lastVersion = await this.versionRepository.findOne({
      where: { entityType: params.entityType, entityId: params.entityId, ...(tenantId ? { tenantId } : {}) },
      order: { versionNumber: 'DESC' },
    });

    const versionNumber = (lastVersion?.versionNumber || 0) + 1;

    // Calculate changed fields
    let changedFields: string[] = [];
    if (params.previousData && params.action === VersionAction.UPDATE) {
      changedFields = this.getChangedFields(params.previousData, params.currentData);
    }

    // Check if approval is required
    const rule = await this.getApprovalRule(params.entityType, params.facilityId, tenantId);
    const approvalStatus = rule?.requiresApproval
      ? ApprovalStatus.PENDING
      : ApprovalStatus.AUTO_APPROVED;

    const version = this.versionRepository.create({
      facilityId: params.facilityId,
      entityType: params.entityType,
      entityId: params.entityId,
      versionNumber,
      action: params.action,
      previousData: params.previousData,
      currentData: params.currentData,
      changedFields,
      changeReason: params.changeReason,
      changedBy: params.changedBy,
      approvalStatus,
      approvedAt: approvalStatus === ApprovalStatus.AUTO_APPROVED ? new Date() : undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.versionRepository.save(version);
  }

  private getChangedFields(previous: Record<string, any>, current: Record<string, any>): string[] {
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

    for (const key of allKeys) {
      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        changed.push(key);
      }
    }

    return changed;
  }

  async getVersionHistory(query: MasterDataVersionQueryDto, tenantId?: string): Promise<MasterDataVersion[]> {
    const qb = this.versionRepository.createQueryBuilder('version')
      .leftJoinAndSelect('version.changedByUser', 'changedBy')
      .leftJoinAndSelect('version.approvedByUser', 'approvedBy');

    if (query.facilityId) {
      qb.andWhere('version.facilityId = :facilityId', { facilityId: query.facilityId });
    }

    if (query.entityType) {
      qb.andWhere('version.entityType = :entityType', { entityType: query.entityType });
    }

    if (query.entityId) {
      qb.andWhere('version.entityId = :entityId', { entityId: query.entityId });
    }

    if (query.approvalStatus) {
      qb.andWhere('version.approvalStatus = :approvalStatus', { approvalStatus: query.approvalStatus });
    }

    if (query.fromDate) {
      qb.andWhere('version.createdAt >= :fromDate', { fromDate: new Date(query.fromDate) });
    }

    if (query.toDate) {
      qb.andWhere('version.createdAt <= :toDate', { toDate: new Date(query.toDate) });
    }

    if (tenantId) {
      qb.andWhere('version.tenant_id = :tenantId', { tenantId });
    }
    return qb.orderBy('version.createdAt', 'DESC').limit(100).getMany();
  }

  async getVersion(id: string, tenantId?: string): Promise<MasterDataVersion> {
    const version = await this.versionRepository.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['changedByUser', 'approvedByUser'],
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  async getEntityVersions(entityType: MasterDataEntityType, entityId: string, tenantId?: string): Promise<MasterDataVersion[]> {
    return this.versionRepository.find({
      where: { entityType, entityId, ...(tenantId ? { tenantId } : {}) },
      relations: ['changedByUser'],
      order: { versionNumber: 'DESC' },
    });
  }

  async getPendingApprovals(facilityId?: string, tenantId?: string): Promise<MasterDataVersion[]> {
    const where: any = { approvalStatus: ApprovalStatus.PENDING };
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;

    return this.versionRepository.find({
      where,
      relations: ['changedByUser'],
      order: { createdAt: 'ASC' },
    });
  }

  async approveVersion(id: string, approvedBy: string, dto: ApproveVersionDto, tenantId?: string): Promise<MasterDataVersion> {
    const version = await this.getVersion(id, tenantId);
    
    if (version.approvalStatus !== ApprovalStatus.PENDING) {
      throw new Error('Version is not pending approval');
    }

    version.approvalStatus = ApprovalStatus.APPROVED;
    version.approvedBy = approvedBy;
    version.approvedAt = new Date();
    version.approvalNotes = dto.approvalNotes;

    return this.versionRepository.save(version);
  }

  async rejectVersion(id: string, rejectedBy: string, reason: string, tenantId?: string): Promise<MasterDataVersion> {
    const version = await this.getVersion(id, tenantId);
    
    if (version.approvalStatus !== ApprovalStatus.PENDING) {
      throw new Error('Version is not pending approval');
    }

    version.approvalStatus = ApprovalStatus.REJECTED;
    version.approvedBy = rejectedBy;
    version.approvedAt = new Date();
    version.approvalNotes = reason;

    return this.versionRepository.save(version);
  }

  async compareVersions(versionId1: string, versionId2: string, tenantId?: string): Promise<{
    version1: MasterDataVersion;
    version2: MasterDataVersion;
    differences: { field: string; value1: any; value2: any }[];
  }> {
    const [version1, version2] = await Promise.all([
      this.getVersion(versionId1, tenantId),
      this.getVersion(versionId2, tenantId),
    ]);

    const differences: { field: string; value1: any; value2: any }[] = [];
    const allKeys = new Set([
      ...Object.keys(version1.currentData),
      ...Object.keys(version2.currentData),
    ]);

    for (const key of allKeys) {
      if (JSON.stringify(version1.currentData[key]) !== JSON.stringify(version2.currentData[key])) {
        differences.push({
          field: key,
          value1: version1.currentData[key],
          value2: version2.currentData[key],
        });
      }
    }

    return { version1, version2, differences };
  }

  async rollbackToVersion(entityType: MasterDataEntityType, entityId: string, versionNumber: number, tenantId?: string): Promise<MasterDataVersion | null> {
    const targetVersion = await this.versionRepository.findOne({
      where: { entityType, entityId, versionNumber, ...(tenantId ? { tenantId } : {}) },
    });

    if (!targetVersion) return null;

    return targetVersion;
  }

  // Approval Rules
  async getApprovalRule(entityType: MasterDataEntityType, facilityId?: string, tenantId?: string): Promise<MasterDataApprovalRule | null> {
    // Try facility-specific rule first
    if (facilityId) {
      const facilityRule = await this.ruleRepository.findOne({
        where: { entityType, facilityId, isActive: true, ...(tenantId ? { tenantId } : {}) },
      });
      if (facilityRule) return facilityRule;
    }

    // Fall back to global rule
    return this.ruleRepository.findOne({
      where: { entityType, facilityId: undefined, isActive: true, ...(tenantId ? { tenantId } : {}) },
    });
  }

  async createApprovalRule(dto: CreateApprovalRuleDto, tenantId?: string): Promise<MasterDataApprovalRule> {
    const rule = this.ruleRepository.create({
      ...dto,
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.ruleRepository.save(rule);
  }

  async getApprovalRules(facilityId?: string, tenantId?: string): Promise<MasterDataApprovalRule[]> {
    const where: any = { isActive: true };
    if (facilityId) where.facilityId = facilityId;
    if (tenantId) where.tenantId = tenantId;

    return this.ruleRepository.find({ where });
  }

  async updateApprovalRule(id: string, dto: Partial<CreateApprovalRuleDto>, tenantId?: string): Promise<MasterDataApprovalRule> {
    const rule = await this.ruleRepository.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!rule) throw new NotFoundException('Approval rule not found');

    Object.assign(rule, dto);
    return this.ruleRepository.save(rule);
  }

  async deleteApprovalRule(id: string, tenantId?: string): Promise<void> {
    const rule = await this.ruleRepository.findOne({ where: { id, ...(tenantId ? { tenantId } : {}) } });
    if (!rule) throw new NotFoundException('Approval rule not found');

    rule.isActive = false;
    await this.ruleRepository.save(rule);
  }

  // Statistics
  async getChangeStatistics(facilityId?: string, days: number = 30, tenantId?: string): Promise<{
    totalChanges: number;
    byEntityType: Record<string, number>;
    byAction: Record<string, number>;
    pendingApprovals: number;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const qb = this.versionRepository.createQueryBuilder('version')
      .where('version.createdAt >= :since', { since });

    if (facilityId) {
      qb.andWhere('version.facilityId = :facilityId', { facilityId });
    }
    if (tenantId) {
      qb.andWhere('version.tenant_id = :tenantId', { tenantId });
    }

    const versions = await qb.getMany();

    const byEntityType: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    let pendingApprovals = 0;

    for (const v of versions) {
      byEntityType[v.entityType] = (byEntityType[v.entityType] || 0) + 1;
      byAction[v.action] = (byAction[v.action] || 0) + 1;
      if (v.approvalStatus === ApprovalStatus.PENDING) pendingApprovals++;
    }

    return {
      totalChanges: versions.length,
      byEntityType,
      byAction,
      pendingApprovals,
    };
  }
}
