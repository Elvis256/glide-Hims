import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import api from '../../../services/api';
import { toast } from 'sonner';

interface ImportResult {
  imported?: number;
  failed?: number;
  total?: number;
  errors?: Array<{ row?: number; message: string }>;
}

export default function BulkUserImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setParseError(null);

    (async () => {
      try {
        let json: any[][];
        if (f.name.toLowerCase().endsWith('.csv')) {
          const text = await f.text();
          json = text
            .split(/\r?\n/)
            .filter((line) => line.trim())
            .map((line) => line.split(',').map((v) => v.trim()));
        } else {
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(await f.arrayBuffer());
          const ws = wb.worksheets[0];
          json = [];
          ws?.eachRow((row) => {
            json.push((row.values as any[]).slice(1).map(excelCellToString));
          });
        }
        if (json.length > 0) {
          setHeaders(json[0].map(String));
          setPreviewData(json.slice(1, 11));
        } else {
          setParseError('The file appears to be empty.');
        }
      } catch {
        setParseError('Failed to parse file. Please upload a valid CSV or .xlsx file.');
      }
    })();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/export/templates/user-import', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'user-import-template.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/users/bulk-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data?.data || res.data);
    } catch (err: any) {
      setResult({
        failed: 1,
        errors: [
          {
            row: 0,
            message:
              err.response?.data?.message || 'Import failed. Please check your file and try again.',
          },
        ],
      });
    } finally {
      setImporting(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreviewData([]);
    setHeaders([]);
    setResult(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalRows = previewData.length;
  const hasErrors = result?.errors && result.errors.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/admin/users" className="hover:text-blue-600 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              User List
            </Link>
            <span>/</span>
            <span className="text-gray-700">Bulk Import</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk User Import</h1>
          <p className="text-gray-500 mt-1">
            Import multiple users at once from a CSV or Excel file
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="btn-secondary flex items-center gap-2 self-start"
        >
          <Download className="w-5 h-5" />
          Download Template
        </button>
      </div>

      {/* Upload Area */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload File</h2>

        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-700 font-medium mb-1">
              Drag & drop your file here, or click to browse
            </p>
            <p className="text-sm text-gray-500">Accepts .csv and .xlsx files</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                  {totalRows > 0 && ` • ${totalRows} data row${totalRows !== 1 ? 's' : ''} previewed`}
                </p>
              </div>
            </div>
            <button
              onClick={clearFile}
              className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              title="Remove file"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}

        {parseError && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {parseError}
          </div>
        )}
      </div>

      {/* Preview Table */}
      {headers.length > 0 && previewData.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <p className="text-sm text-gray-500">
              Showing first {previewData.length} row{previewData.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 w-12">#</th>
                  {headers.map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewData.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-sm text-gray-400">{ri + 1}</td>
                    {headers.map((_, ci) => (
                      <td key={ci} className="px-4 py-2 text-sm text-gray-700">
                        {row[ci] !== undefined && row[ci] !== null ? String(row[ci]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Button */}
      {file && !parseError && (
        <div className="flex justify-end">
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-primary flex items-center gap-2 px-6 py-2.5"
          >
            {importing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Import Users
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Import Results</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {result.total !== undefined && (
              <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-blue-700">{result.total}</p>
                  <p className="text-sm text-blue-600">Total Rows</p>
                </div>
              </div>
            )}
            {result.imported !== undefined && (
              <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                  <p className="text-sm text-green-600">Imported Successfully</p>
                </div>
              </div>
            )}
            {result.failed !== undefined && result.failed > 0 && (
              <div className="bg-red-50 rounded-lg p-4 flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-700">{result.failed}</p>
                  <p className="text-sm text-red-600">Failed</p>
                </div>
              </div>
            )}
          </div>

          {hasErrors && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Error Details</h3>
              <div className="bg-red-50 border border-red-200 rounded-lg divide-y divide-red-200">
                {result.errors!.map((err, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-red-700">
                      {err.row !== undefined && err.row > 0 && (
                        <span className="font-medium">Row {err.row}: </span>
                      )}
                      {err.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasErrors && result.imported !== undefined && result.imported > 0 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              All users imported successfully!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Normalize an ExcelJS cell value (rich text, formulas, dates) to a plain value. */
function excelCellToString(value: any): any {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((t: any) => t.text).join('');
    if (value.text != null) return String(value.text);
    if (value.result != null) return excelCellToString(value.result);
    return '';
  }
  return value;
}
