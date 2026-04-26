import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReplicationLog } from '../../database/entities/replication-log.entity';
import { ChangeSet } from '../../database/entities/changeset.entity';
import { Deployment } from '../../database/entities/deployment.entity';

@Injectable()
export class ReplicationService {
  constructor(
    @InjectRepository(ReplicationLog)
    private replicationLogRepository: Repository<ReplicationLog>,
    @InjectRepository(ChangeSet)
    private changesetRepository: Repository<ChangeSet>,
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
  ) {}

  async getReplicationStatus(tenantId: string, deploymentId: string): Promise<any> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const lastSync = await this.replicationLogRepository.findOne({
      where: { tenantId, deploymentId },
      order: { createdAt: 'DESC' },
    });

    const pendingChangesets = await this.changesetRepository.count({
      where: { tenantId, deploymentId },
    });

    return {
      deploymentId,
      lastSyncAt: lastSync?.createdAt,
      lastSyncStatus: lastSync?.status,
      pendingChanges: pendingChangesets,
      isSynced: pendingChangesets === 0,
    };
  }

  async getPendingChanges(tenantId: string, deploymentId?: string): Promise<ChangeSet[]> {
    const query = this.changesetRepository.createQueryBuilder('c').where('c.tenantId = :tenantId', { tenantId });

    if (deploymentId) {
      query.andWhere('c.deploymentId = :deploymentId', { deploymentId });
    }

    return query.orderBy('c.createdAt', 'ASC').getMany();
  }

  async getReplicationHistory(tenantId: string, deploymentId?: string, limit = 50): Promise<ReplicationLog[]> {
    const query = this.replicationLogRepository.createQueryBuilder('r').where('r.tenantId = :tenantId', { tenantId });

    if (deploymentId) {
      query.andWhere('r.deploymentId = :deploymentId', { deploymentId });
    }

    return query.orderBy('r.createdAt', 'DESC').limit(limit).getMany();
  }
}
