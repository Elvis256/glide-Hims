export interface BulkImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface BulkImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: BulkImportRowError[];
}
