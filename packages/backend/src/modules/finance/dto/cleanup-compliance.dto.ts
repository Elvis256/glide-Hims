import { IsOptional, IsNumber, IsString, IsDate } from 'class-validator';

// Cleanup DTOs
export class DetectOrphanedEntriesDto {
  @IsOptional()
  dryRun?: boolean;
}

export class OrphanedEntriesResultDto {
  orphanedCount: number;
  orphanIds: string[];
  deletedCount?: number;
}

export class DuplicateEntriesResultDto {
  duplicateGroups: number;
  affectedEntries: string[];
}

export class CleanupOldAuditLogsDto {
  @IsOptional()
  @IsNumber()
  retentionDays?: number;

  @IsOptional()
  dryRun?: boolean;
}

export class AuditLogsCleanupResultDto {
  auditRecordsToDelete: number;
  deletedCount?: number;
}

export class CleanupReportDto {
  orphanedEntries: number;
  duplicateEntries: number;
  oldAuditLogs: number;
  cancelledBatchEntries: number;
  totalCleanupOpportunity: number;
  estimatedFreedSpace: string;
}

export class FullCleanupResultDto {
  timestamp: Date;
  dryRun: boolean;
  results: {
    orphaned: { orphanedCount: number; deletedCount?: number };
    duplicates: { affectedEntries: string[] };
    auditLogs: { auditRecordsToDelete: number; deletedCount?: number };
    cancelled: { batchesProcessed: number; entriesDeleted?: number };
  };
  summary: {
    totalRecordsAffected: number;
    operationsCompleted: number;
  };
}

// Integrity DTOs
export class GLBalanceValidationDto {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  status: string;
}

export class UnbalancedAccountDto {
  accountCode: string;
  accountName: string;
  totalDebits: number;
  totalCredits: number;
  balance: number;
  variance: number;
}

export class UnbalancedAccountsResultDto {
  unbalancedCount: number;
  accounts: UnbalancedAccountDto[];
}

export class AccountMasterValidationDto {
  isValid: boolean;
  missingAccounts: string[];
  orphanedEntries: number;
  accountsWithoutType: number;
}

export class AnomalyDto {
  accountCode: string;
  description: string;
}

export class LargeTransactionDto {
  accountCode: string;
  amount: number;
  date: Date;
}

export class AnomaliesResultDto {
  anomalyCount: number;
  rapidPostings: Array<{ accountCode: string; count: number }>;
  largeTransactions: LargeTransactionDto[];
  unusualAccounts: AnomalyDto[];
}

export class ReferentialIntegrityDto {
  isValid: boolean;
  brokenReferences: Array<{
    entityType: string;
    fieldName: string;
    invalidCount: number;
  }>;
}

export class IntegrityReportDto {
  timestamp: Date;
  overallStatus: string;
  sections: {
    glBalance: {
      isBalanced: boolean;
      totalDebits: number;
      totalCredits: number;
      difference: number;
    };
    unbalancedAccounts: { unbalancedCount: number };
    masterData: {
      isValid: boolean;
      orphanedEntries: number;
      accountsWithoutType: number;
    };
    anomalies: { anomalyCount: number };
    referentialIntegrity: { isValid: boolean; brokenCount: number };
  };
}

// Compliance DTOs
export class CompliancePolicyDto {
  name: string;
  retentionDays: number;
  archiveAfterDays: number;
  description: string;
}

export class ComplianceStatusDto {
  policyName: string;
  status: string;
  auditRecordsCount: number;
  recordsOverdue: number;
  percentCompliance: number;
  details: {
    retentionDays: number;
    archiveAfterDays: number;
    lastAuditDate?: Date;
    nextReviewDate: Date;
  };
}

export class ComplianceAuditDto {
  periodDays: number;
  totalRecords: number;
  recordsByAction: Record<string, number>;
  recordsByUser: Record<string, number>;
  criticalOperations: Array<{
    id: string;
    action: string;
    userId: string;
    timestamp: Date;
    details: any;
  }>;
  complianceScore: number;
}

export class ArchiveResultDto {
  recordsToArchive: number;
  archiveId?: string;
  estimatedSize?: string;
  archivedCount?: number;
}

export class ComplianceReportDto {
  reportDate: Date;
  reportPeriod: number;
  policyCoverage: Array<{
    policyName: string;
    status: string;
    percentCompliance: number;
  }>;
  auditTrail: {
    totalRecords: number;
    criticalOperations: number;
    complianceScore: number;
  };
  recommendations: string[];
  signOffDate?: Date;
}

export class AuditIntegrityDto {
  isValid: boolean;
  totalRecords: number;
  orphanedRecords: number;
  gapsDetected: number;
  lastVerificationDate: Date;
  nextVerificationDate: Date;
}

export class AuditExportDto {
  exportId: string;
  recordCount: number;
  dateRange: { start: Date; end: Date };
  hash: string;
  exportDate: Date;
}

// Performance DTOs
export class TableSizeDto {
  tableName: string;
  rowCount: number;
  sizeInMB: number;
  indexSizeInMB: number;
}

export class TableSizesResultDto {
  tables: TableSizeDto[];
  totalSizeInMB: number;
}

export class MissingIndexDto {
  name: string;
  table: string;
  columns: string[];
  priority: string;
  estimatedImpact: string;
}

export class UnusedIndexDto {
  name: string;
  table: string;
  lastUsed?: Date;
}

export class IndexHealthDto {
  healthScore: number;
  totalIndexes: number;
  missingIndexes: MissingIndexDto[];
  unusedIndexes: UnusedIndexDto[];
}

export class TableFragmentationDto {
  tableName: string;
  fragmentationPercent: number;
  status: string;
  recommendedAction: string;
}

export class FragmentationResultDto {
  tables: TableFragmentationDto[];
  totalFragmentation: number;
}

export class SlowQueryDto {
  query: string;
  executionTimeMs: number;
  estimatedOptimization: string;
}

export class SlowQueriesResultDto {
  slowQueryCount: number;
  averageQueryTimeMs: number;
  slowestQueries: SlowQueryDto[];
}

export class PerformanceMetricsDto {
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
}

export class OptimizationResultDto {
  indexesToCreate: Array<{ name: string; table: string }>;
  createdCount?: number;
  estimatedImprovementPercent: number;
}

export class OptimizationReportDto {
  reportDate: Date;
  healthScore: number;
  quickWins: string[];
  mediumTermImprovements: string[];
  longTermStrategy: string[];
}
