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
  generatedCredentials?: { username: string; password: string }[];
}
