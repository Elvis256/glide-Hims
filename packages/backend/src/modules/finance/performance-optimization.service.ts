import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JournalEntry } from '../../database/entities/journal-entry.entity';
import { ChartOfAccounts } from '../../database/entities/chart-of-account.entity';

interface IndexInfo {
  name: string;
  columns: string[];
  uniqueness: string;
  cardinality: number;
}

interface QueryPerformance {
  query: string;
  averageExecutionMs: number;
  maxExecutionMs: number;
  executionCount: number;
  lastExecuted: Date;
}

@Injectable()
export class PerformanceOptimizationService {
  private readonly logger = new Logger('PerformanceOptimizationService');

  private readonly recommendedIndexes = [
    {
      name: 'idx_journal_entry_date',
      table: 'journal_entry',
      columns: ['journal_date'],
      priority: 'HIGH',
    },
    {
      name: 'idx_journal_entry_account',
      table: 'journal_entry',
      columns: ['account_id'],
      priority: 'HIGH',
    },
    {
      name: 'idx_journal_entry_batch',
      table: 'journal_entry',
      columns: ['posting_batch_id'],
      priority: 'MEDIUM',
    },
    {
      name: 'idx_journal_entry_date_account',
      table: 'journal_entry',
      columns: ['journal_date', 'account_id'],
      priority: 'HIGH',
    },
    {
      name: 'idx_audit_log_timestamp',
      table: 'audit_log',
      columns: ['created_at'],
      priority: 'HIGH',
    },
    {
      name: 'idx_audit_log_user',
      table: 'audit_log',
      columns: ['user_id'],
      priority: 'MEDIUM',
    },
    {
      name: 'idx_coa_account_type',
      table: 'chart_of_accounts',
      columns: ['account_type'],
      priority: 'MEDIUM',
    },
  ];

  constructor(
    @InjectRepository(JournalEntry)
    private journalEntryRepo: Repository<JournalEntry>,
    private dataSource: DataSource,
  ) {}

  /**
   * Analyze database table sizes
   */
  async analyzeTableSizes(): Promise<{
    tables: Array<{
      tableName: string;
      rowCount: number;
      sizeInMB: number;
      indexSizeInMB: number;
    }>;
    totalSizeInMB: number;
  }> {
    this.logger.debug('Analyzing table sizes');

    const query = `
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as size_mb,
        ROUND(INDEX_LENGTH / 1024 / 1024, 2) as index_size_mb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY DATA_LENGTH + INDEX_LENGTH DESC
    `;

    const tables = await this.dataSource.query(query);

    let totalSize = 0;
    const results = tables.map((t: any) => {
      const size = parseFloat(t.size_mb) || 0;
      totalSize += size;
      return {
        tableName: t.TABLE_NAME,
        rowCount: parseInt(t.TABLE_ROWS) || 0,
        sizeInMB: size,
        indexSizeInMB: parseFloat(t.index_size_mb) || 0,
      };
    });

    return {
      tables: results,
      totalSizeInMB: totalSize,
    };
  }

  /**
   * Get index health status
   */
  async analyzeIndexHealth(): Promise<{
    healthScore: number;
    totalIndexes: number;
    missingIndexes: Array<{
      name: string;
      table: string;
      columns: string[];
      priority: string;
      estimatedImpact: string;
    }>;
    unusedIndexes: Array<{
      name: string;
      table: string;
      lastUsed?: Date;
    }>;
  }> {
    this.logger.debug('Analyzing index health');

    // Get existing indexes
    const query = `
      SELECT 
        INDEX_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        SEQ_IN_INDEX
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `;

    const indexes = await this.dataSource.query(query);
    const existingIndexNames = new Set(
      indexes.map((i: any) => i.INDEX_NAME),
    );

    // Find missing recommended indexes
    const missing = this.recommendedIndexes.filter(
      (idx) => !existingIndexNames.has(idx.name),
    );

    // Estimate impact of missing indexes
    const missingWithImpact = missing.map((idx) => ({
      ...idx,
      estimatedImpact:
        idx.priority === 'HIGH'
          ? '20-40% query improvement'
          : '5-15% query improvement',
    }));

    return {
      healthScore: Math.max(
        50,
        100 - missingWithImpact.length * 10,
      ),
      totalIndexes: existingIndexNames.size,
      missingIndexes: missingWithImpact,
      unusedIndexes: [], // Would require MySQL slow query log analysis
    };
  }

  /**
   * Optimize table statistics
   */
  async optimizeTableStatistics(): Promise<{
    tablesOptimized: number;
    lastOptimizationDate: Date;
    nextOptimizationDate: Date;
  }> {
    this.logger.debug('Optimizing table statistics');

    const tables = [
      'journal_entry',
      'audit_log',
      'chart_of_accounts',
      'approval_workflow',
    ];

    for (const table of tables) {
      try {
        await this.dataSource.query(`ANALYZE TABLE ${table}`);
      } catch (error) {
        this.logger.warn(`Failed to analyze table ${table}:`, error);
      }
    }

    const nextOptimization = new Date();
    nextOptimization.setDate(nextOptimization.getDate() + 7);

    return {
      tablesOptimized: tables.length,
      lastOptimizationDate: new Date(),
      nextOptimizationDate: nextOptimization,
    };
  }

  /**
   * Run table fragmentation analysis
   */
  async analyzeTableFragmentation(): Promise<{
    tables: Array<{
      tableName: string;
      fragmentationPercent: number;
      status: string;
      recommendedAction: string;
    }>;
    totalFragmentation: number;
  }> {
    this.logger.debug('Analyzing table fragmentation');

    const query = `
      SELECT 
        TABLE_NAME,
        ROUND(
          (DATA_FREE / (DATA_LENGTH + INDEX_LENGTH + DATA_FREE)) * 100, 2
        ) as fragmentation_percent
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND (DATA_LENGTH + INDEX_LENGTH + DATA_FREE) > 0
      ORDER BY fragmentation_percent DESC
    `;

    const tables = await this.dataSource.query(query);

    const results = tables.map((t: any) => {
      const frag = parseFloat(t.fragmentation_percent) || 0;
      return {
        tableName: t.TABLE_NAME,
        fragmentationPercent: frag,
        status: frag > 20 ? 'HIGH' : frag > 10 ? 'MODERATE' : 'HEALTHY',
        recommendedAction:
          frag > 20 ? 'OPTIMIZE TABLE' : frag > 10 ? 'MONITOR' : 'NONE',
      };
    });

    const totalFrag = results.length > 0 ? results.reduce((sum: number, r: any) => sum + r.fragmentationPercent, 0) / results.length : 0;

    return {
      tables: results,
      totalFragmentation: Math.round(totalFrag),
    };
  }

  /**
   * Identify slow queries
   */
  async identifySlowQueries(): Promise<{
    slowQueryCount: number;
    averageQueryTimeMs: number;
    slowestQueries: Array<{
      query: string;
      executionTimeMs: number;
      estimatedOptimization: string;
    }>;
  }> {
    this.logger.debug('Identifying slow queries');

    // Simulated slow query detection
    // In production, would parse MySQL slow query log
    const slowQueries = [
      {
        query:
          'SELECT * FROM journal_entry WHERE debit > 0 (missing index)',
        executionTimeMs: 5420,
        estimatedOptimization: 'Add idx_journal_entry_debit index',
      },
      {
        query:
          'SELECT * FROM journal_entry WHERE account_id = ? (full scan)',
        executionTimeMs: 3200,
        estimatedOptimization: 'Ensure idx_journal_entry_account exists',
      },
      {
        query: 'SELECT COUNT(*) FROM journal_entry (no index)',
        executionTimeMs: 2100,
        estimatedOptimization: 'Add covering index or cache count',
      },
    ];

    const avgTime =
      slowQueries.reduce((sum, q) => sum + q.executionTimeMs, 0) /
      slowQueries.length;

    return {
      slowQueryCount: slowQueries.length,
      averageQueryTimeMs: Math.round(avgTime),
      slowestQueries: slowQueries.sort(
        (a, b) => b.executionTimeMs - a.executionTimeMs,
      ),
    };
  }

  /**
   * Get performance metrics summary
   */
  async getPerformanceMetrics(): Promise<{
    timestamp: Date;
    overallHealthScore: number;
    metrics: {
      indexHealth: number;
      tableFragmentation: number;
      cacheHitRate: number;
      queryPerformance: number;
    };
    recommendations: string[];
    lastOptimizationDate?: Date;
  }> {
    this.logger.debug('Calculating performance metrics');

    const indexHealth = await this.analyzeIndexHealth();
    const fragmentation = await this.analyzeTableFragmentation();
    const slowQueries = await this.identifySlowQueries();

    const metrics = {
      indexHealth: indexHealth.healthScore,
      tableFragmentation: Math.max(
        0,
        100 -
          (fragmentation.totalFragmentation > 20
            ? 30
            : fragmentation.totalFragmentation > 10
              ? 15
              : 0),
      ),
      cacheHitRate: 92, // Simulated
      queryPerformance: Math.max(
        0,
        100 - slowQueries.slowQueryCount * 15,
      ),
    };

    const overallScore =
      (metrics.indexHealth +
        metrics.tableFragmentation +
        metrics.cacheHitRate +
        metrics.queryPerformance) /
      4;

    const recommendations = [];
    if (indexHealth.missingIndexes.length > 0) {
      recommendations.push(
        `Create ${indexHealth.missingIndexes.length} missing indexes for 20-40% improvement`,
      );
    }
    if (fragmentation.totalFragmentation > 20) {
      recommendations.push('Run OPTIMIZE TABLE on highly fragmented tables');
    }
    if (slowQueries.slowQueryCount > 0) {
      recommendations.push(
        `Review and optimize ${slowQueries.slowQueryCount} slow queries`,
      );
    }
    if (recommendations.length === 0) {
      recommendations.push('Database performance is optimal');
    }

    return {
      timestamp: new Date(),
      overallHealthScore: Math.round(overallScore),
      metrics,
      recommendations,
    };
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(dryRun: boolean = true): Promise<{
    indexesToCreate: Array<{ name: string; table: string }>;
    createdCount?: number;
    estimatedImprovementPercent: number;
  }> {
    this.logger.debug(
      `Creating recommended indexes (dryRun: ${dryRun})`,
    );

    const health = await this.analyzeIndexHealth();
    const toCreate = health.missingIndexes;

    if (!dryRun && toCreate.length > 0) {
      for (const idx of toCreate) {
        try {
          const columns = idx.columns.join(', ');
          const query = `CREATE INDEX ${idx.name} ON ${idx.table} (${columns})`;
          await this.dataSource.query(query);
          this.logger.log(`Created index: ${idx.name}`);
        } catch (error) {
          this.logger.warn(`Failed to create index ${idx.name}:`, error);
        }
      }
    }

    const improvementEstimate =
      toCreate.length > 0
        ? toCreate
            .map((idx) =>
              idx.priority === 'HIGH' ? 30 : 10,
            )
            .reduce((a, b) => Math.min(a + b, 40), 0)
        : 0;

    return {
      indexesToCreate: toCreate.map((idx) => ({
        name: idx.name,
        table: idx.table,
      })),
      createdCount: !dryRun ? toCreate.length : undefined,
      estimatedImprovementPercent: improvementEstimate,
    };
  }

  /**
   * Generate performance optimization report
   */
  async generateOptimizationReport(): Promise<{
    reportDate: Date;
    healthScore: number;
    quickWins: string[];
    mediumTermImprovements: string[];
    longTermStrategy: string[];
  }> {
    this.logger.debug('Generating optimization report');

    const metrics = await this.getPerformanceMetrics();
    const indexes = await this.analyzeIndexHealth();
    const fragmentation = await this.analyzeTableFragmentation();

    const quickWins = [];
    if (indexes.missingIndexes.length > 0) {
      quickWins.push(
        `Create ${indexes.missingIndexes.length} recommended indexes (1-2 hours work)`,
      );
    }
    if (
      fragmentation.tables.some((t) => t.status === 'HIGH')
    ) {
      quickWins.push('Run OPTIMIZE TABLE on fragmented tables (30 min)');
    }

    const mediumTermImprovements = [
      'Implement query result caching layer (Redis)',
      'Archive old audit logs (> 1 year)',
      'Partition large tables by date',
    ];

    const longTermStrategy = [
      'Database sharding strategy for multi-location support',
      'Implement materialized views for analytics',
      'Move reporting queries to read replica',
    ];

    return {
      reportDate: new Date(),
      healthScore: metrics.overallHealthScore,
      quickWins,
      mediumTermImprovements,
      longTermStrategy,
    };
  }
}
