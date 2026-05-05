import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcurementApprovalChain, ApprovalChainStatus } from '../../database/entities/procurement-approval-chain.entity';
import { PurchaseRequest } from '../../database/entities/purchase-request.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';

@Injectable()
export class ApprovalDashboardService {
  constructor(
    @InjectRepository(ProcurementApprovalChain)
    private readonly chainRepository: Repository<ProcurementApprovalChain>,
    @InjectRepository(PurchaseRequest)
    private readonly prRepository: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepository: Repository<PurchaseOrder>,
  ) {}

  /**
   * Get all pending approvals for a specific role
   */
  async getPendingApprovalsForRole(
    role: string,
    facilityId?: string,
    tenantId?: string,
  ): Promise<any[]> {
    const chains = await this.chainRepository
      .createQueryBuilder('chain')
      .leftJoinAndSelect('chain.approver', 'approver')
      .where('chain.status = :status', { status: ApprovalChainStatus.PENDING })
      .andWhere('LOWER(chain.requiredRole) = LOWER(:role)', { role })
      .andWhere('chain.tenantId = :tenantId', { tenantId })
      .orderBy('chain.createdAt', 'ASC')
      .getMany();

    const result = [];
    for (const chain of chains) {
      const doc = chain.documentType === 'PR'
        ? await this.prRepository.findOne({ where: { id: chain.documentId } })
        : await this.poRepository.findOne({ where: { id: chain.documentId } });

      if (!doc || (facilityId && doc.facilityId !== facilityId)) {
        continue;
      }

      result.push({
        documentId: chain.documentId,
        documentType: chain.documentType,
        documentNumber: chain.documentType === 'PR' ? (doc as PurchaseRequest).requestNumber : (doc as PurchaseOrder).orderNumber,
        amount: chain.documentType === 'PR' ? (doc as PurchaseRequest).totalEstimated : (doc as PurchaseOrder).totalAmount,
        createdAt: doc.createdAt,
        level: chain.approvalLevel,
        requiredRole: chain.requiredRole,
        daysPending: Math.floor(
          (Date.now() - new Date(chain.createdAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
      });
    }

    return result;
  }

  /**
   * Get approval history for a specific document
   */
  async getApprovalHistory(
    documentId: string,
    documentType: 'PR' | 'PO',
    tenantId: string,
  ): Promise<any[]> {
    const chains = await this.chainRepository
      .createQueryBuilder('chain')
      .leftJoinAndSelect('chain.approver', 'approver')
      .leftJoinAndSelect('chain.approvedBy', 'approvedBy')
      .where('chain.documentId = :documentId', { documentId })
      .andWhere('chain.documentType = :documentType', { documentType })
      .andWhere('chain.tenantId = :tenantId', { tenantId })
      .orderBy('chain.approvalLevel', 'ASC')
      .addOrderBy('chain.createdAt', 'ASC')
      .getMany();

    return chains.map((chain) => ({
      level: chain.approvalLevel,
      requiredRole: chain.requiredRole,
      status: chain.status,
      approver: chain.approver ? { id: chain.approver.id, fullName: chain.approver.fullName } : null,
      approvedBy: chain.approvedBy
        ? { id: chain.approvedBy.id, fullName: chain.approvedBy.fullName }
        : null,
      approvedAt: chain.approvedAt,
      comments: chain.comments,
    }));
  }

  /**
   * Get approval bottlenecks (levels taking >5 days on average)
   */
  async getApprovalBottlenecks(facilityId: string, tenantId: string): Promise<any[]> {
    // Query all approved chains with timestamps
    const chains = await this.chainRepository
      .createQueryBuilder('chain')
      .where('chain.status = :status', { status: ApprovalChainStatus.APPROVED })
      .andWhere('chain.tenantId = :tenantId', { tenantId })
      .andWhere('chain.approvedAt IS NOT NULL')
      .getMany();

    // Group by level and calculate average approval time
    const levelStats = new Map<number, { totalDays: number; count: number }>();

    for (const chain of chains) {
      const doc = chain.documentType === 'PR'
        ? await this.prRepository.findOne({ where: { id: chain.documentId } })
        : await this.poRepository.findOne({ where: { id: chain.documentId } });

      if (!doc || doc.facilityId !== facilityId) {
        continue;
      }

      const days = Math.floor(
        (new Date(chain.approvedAt!).getTime() - new Date(chain.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (!levelStats.has(chain.approvalLevel)) {
        levelStats.set(chain.approvalLevel, { totalDays: 0, count: 0 });
      }

      const stats = levelStats.get(chain.approvalLevel)!;
      stats.totalDays += days;
      stats.count += 1;
    }

    const bottlenecks = [];
    for (const [level, stats] of levelStats) {
      const avgDays = stats.totalDays / stats.count;
      if (avgDays > 5) {
        bottlenecks.push({
          level,
          avgDays: Math.round(avgDays * 10) / 10,
          completedCount: stats.count,
        });
      }
    }

    return bottlenecks.sort((a, b) => b.avgDays - a.avgDays);
  }

  /**
   * Get escalation candidates (pending >N days)
   */
  async getEscalationCandidates(
    facilityId: string,
    daysPending: number = 5,
    tenantId: string,
  ): Promise<any[]> {
    const chains = await this.chainRepository
      .createQueryBuilder('chain')
      .leftJoinAndSelect('chain.approver', 'approver')
      .where('chain.status = :status', { status: ApprovalChainStatus.PENDING })
      .andWhere('chain.tenantId = :tenantId', { tenantId })
      .getMany();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysPending);

    const escalations = [];
    for (const chain of chains) {
      if (new Date(chain.createdAt) < cutoffDate) {
        const doc = chain.documentType === 'PR'
          ? await this.prRepository.findOne({ where: { id: chain.documentId } })
          : await this.poRepository.findOne({ where: { id: chain.documentId } });

        if (!doc || doc.facilityId !== facilityId) {
          continue;
        }

        escalations.push({
          documentId: chain.documentId,
          documentType: chain.documentType,
          documentNumber: chain.documentType === 'PR' ? (doc as PurchaseRequest).requestNumber : (doc as PurchaseOrder).orderNumber,
          amount: chain.documentType === 'PR' ? (doc as PurchaseRequest).totalEstimated : (doc as PurchaseOrder).totalAmount,
          level: chain.approvalLevel,
          requiredRole: chain.requiredRole,
          daysPending: Math.floor(
            (Date.now() - new Date(chain.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          ),
          approver: chain.approver ? { id: chain.approver.id, fullName: chain.approver.fullName } : null,
        });
      }
    }

    return escalations.sort((a, b) => b.daysPending - a.daysPending);
  }

  /**
   * Get high-level dashboard summary
   */
  async getDashboardSummary(facilityId: string, tenantId: string): Promise<any> {
    // Count by status
    const chainStats = await this.chainRepository
      .createQueryBuilder('chain')
      .select('chain.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('chain.tenantId = :tenantId', { tenantId })
      .groupBy('chain.status')
      .getRawMany();

    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const stat of chainStats) {
      if (stat.status === ApprovalChainStatus.PENDING) pending = parseInt(stat.count);
      else if (stat.status === ApprovalChainStatus.APPROVED) approved = parseInt(stat.count);
      else if (stat.status === ApprovalChainStatus.REJECTED) rejected = parseInt(stat.count);
    }

    // Get bottlenecks and escalations
    const bottlenecks = await this.getApprovalBottlenecks(facilityId, tenantId);
    const escalations = await this.getEscalationCandidates(facilityId, 5, tenantId);

    // Calculate average approval time for approved items
    const approvedChains = await this.chainRepository
      .createQueryBuilder('chain')
      .where('chain.status = :status', { status: ApprovalChainStatus.APPROVED })
      .andWhere('chain.tenantId = :tenantId', { tenantId })
      .andWhere('chain.approvedAt IS NOT NULL')
      .getMany();

    let totalApprovalDays = 0;
    let approvedCount = 0;

    for (const chain of approvedChains) {
      const doc = chain.documentType === 'PR'
        ? await this.prRepository.findOne({ where: { id: chain.documentId } })
        : await this.poRepository.findOne({ where: { id: chain.documentId } });

      if (doc && doc.facilityId === facilityId) {
        const days = Math.floor(
          (new Date(chain.approvedAt!).getTime() - new Date(chain.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        totalApprovalDays += days;
        approvedCount += 1;
      }
    }

    const avgApprovalDays =
      approvedCount > 0 ? Math.round((totalApprovalDays / approvedCount) * 10) / 10 : 0;

    return {
      pending,
      approved,
      rejected,
      avgApprovalDays,
      bottlenecks: bottlenecks.length,
      escalations: escalations.length,
      escalationList: escalations,
    };
  }
}
