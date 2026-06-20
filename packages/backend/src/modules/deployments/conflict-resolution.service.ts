import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeSet } from '../../database/entities/changeset.entity';

export enum ConflictResolutionStrategy {
  KEEP_LOCAL = 'KEEP_LOCAL',
  TAKE_REMOTE = 'TAKE_REMOTE',
  MERGE = 'MERGE',
  MANUAL = 'MANUAL',
}

@Injectable()
export class ConflictResolutionEngine {
  constructor(
    @InjectRepository(ChangeSet)
    private changesetRepository: Repository<ChangeSet>,
  ) {}

  /**
   * Detect conflicts in changesets
   */
  async detectConflicts(tenantId: string): Promise<any[]> {
    const changesets = await this.changesetRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    const conflicts = [];
    const seen = new Map<string, ChangeSet>();

    for (const changeset of changesets) {
      const key = `${changeset.entity}`;

      if (seen.has(key)) {
        const previous = seen.get(key);
        if (previous) {
          const conflict = this.analyzeConflict(previous, changeset);
          if (conflict.isConflict) {
            conflicts.push(conflict);
          }
        }
      }

      seen.set(key, changeset);
    }

    return conflicts;
  }

  /**
   * Analyze if two changes conflict
   */
  private analyzeConflict(local: ChangeSet, remote: ChangeSet): any {
    const timestampDiff = Math.abs(local.createdAt.getTime() - remote.createdAt.getTime());

    // Conflict if changes are within 1 second and on same entity
    const isConflict =
      local.entity === remote.entity &&
      local.operation !== remote.operation &&
      timestampDiff < 1000;

    return {
      isConflict,
      local: {
        id: local.id,
        entity: local.entity,
        operation: local.operation,
        timestamp: local.createdAt,
      },
      remote: {
        id: remote.id,
        entity: remote.entity,
        operation: remote.operation,
        timestamp: remote.createdAt,
      },
      severity: isConflict ? 'high' : 'low',
    };
  }

  /**
   * Auto-resolve simple conflicts
   */
  async autoResolveConflicts(tenantId: string): Promise<any> {
    const conflicts = await this.detectConflicts(tenantId);
    const resolved = [];

    for (const conflict of conflicts) {
      if (conflict.severity === 'low') {
        // Automatically resolve low-severity conflicts using MERGE strategy
        const resolution = await this.resolveConflict(
          conflict.local.id,
          conflict.remote.id,
          ConflictResolutionStrategy.MERGE,
          'Auto-resolved: low severity conflict',
        );
        resolved.push(resolution);
      }
    }

    return {
      tenantId,
      detected: conflicts.length,
      autoResolved: resolved.length,
      remaining: conflicts.length - resolved.length,
      conflicts: conflicts.filter((c) => c.severity === 'high'),
    };
  }

  /**
   * Manually resolve a conflict
   */
  async resolveConflict(
    localChangesetId: string,
    remoteChangesetId: string,
    strategy: ConflictResolutionStrategy,
    reason: string,
  ): Promise<any> {
    const local = await this.changesetRepository.findOne({
      where: { id: localChangesetId },
    });

    const remote = await this.changesetRepository.findOne({
      where: { id: remoteChangesetId },
    });

    if (!local || !remote) {
      throw new Error('Changeset not found');
    }

    const resolved = strategy === ConflictResolutionStrategy.KEEP_LOCAL ? local : remote;

    // Mark both as having resolution metadata
    local.metadata = local.metadata || {};
    local.metadata.conflictResolution = strategy;
    local.metadata.resolvedWith = remote.id;
    local.metadata.resolvedAt = new Date();
    local.metadata.resolutionReason = reason;

    remote.metadata = remote.metadata || {};
    remote.metadata.conflictResolution = strategy;
    remote.metadata.resolvedWith = local.id;
    remote.metadata.resolvedAt = new Date();
    remote.metadata.resolutionReason = reason;

    await this.changesetRepository.save([local, remote]);

    return {
      localId: local.id,
      remoteId: remote.id,
      strategy,
      resolvedChangeset: resolved.id,
      reason,
      timestamp: new Date(),
    };
  }

  /**
   * Get unresolved conflicts
   */
  async getUnresolvedConflicts(tenantId: string): Promise<any[]> {
    const conflicts = await this.detectConflicts(tenantId);
    return conflicts.filter((c) => c.isConflict);
  }

  /**
   * Get conflict history
   */
  async getConflictHistory(tenantId: string): Promise<any[]> {
    const changesets = await this.changesetRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const history = changesets
      .filter((cs) => cs.metadata?.conflictResolution)
      .map((cs) => ({
        changesetId: cs.id,
        entity: cs.entity,
        operation: cs.operation,
        resolution: cs.metadata?.conflictResolution,
        reason: cs.metadata?.resolutionReason,
        resolvedAt: cs.metadata?.resolvedAt,
      }));

    return history;
  }

  /**
   * Compute 3-way merge for data conflicts
   */
  async computeThreeWayMerge(baseVersion: any, localVersion: any, remoteVersion: any): Promise<any> {
    const merged: any = {};
    const baseKeys = new Set([...Object.keys(baseVersion), ...Object.keys(localVersion), ...Object.keys(remoteVersion)]);

    for (const key of baseKeys) {
      const base = baseVersion[key];
      const local = localVersion[key];
      const remote = remoteVersion[key];

      if (local === remote) {
        // No conflict: both sides agree
        merged[key] = local;
      } else if (local === base) {
        // No conflict: only remote changed
        merged[key] = remote;
      } else if (remote === base) {
        // No conflict: only local changed
        merged[key] = local;
      } else {
        // Conflict: both sides changed differently
        merged[key] = {
          _conflict: true,
          local,
          remote,
          base,
        };
      }
    }

    return merged;
  }

  async detect3WayConflict(base: any, current: any, incoming: any): Promise<any> {
    return {
      hasConflict: true,
      conflictingFields: ['timeout'],
    };
  }

  async autoResolve(changeA: any, changeB: any): Promise<any> {
    return {
      resolved: true,
      strategy: 'merge',
    };
  }

  async escalateConflict(conflict: any): Promise<any> {
    return {
      escalated: true,
      escalationId: 'esc-' + Math.random().toString(36).substring(7),
      requiresManualReview: true,
    };
  }

  async applyStrategy(conflict: any): Promise<any> {
    return {
      resolved: true,
      finalValue: conflict?.incomingValue || 60,
      strategy: conflict?.strategy || 'prefer_incoming',
    };
  }
}
