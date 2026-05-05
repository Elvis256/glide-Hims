import React, { useState, useEffect } from 'react';
import {
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/currency';
import api from '../../../services/api';
import ReconciliationStatusWidget from '../../../components/finance/ReconciliationStatusWidget';
import VarianceAnalysisPanel from '../../../components/finance/VarianceAnalysisPanel';

const formatPercent = (value: number, decimals: number = 2): string => `${value.toFixed(decimals)}%`;

interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

interface TrialBalance {
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  imbalanceAmount: number;
  generatedAt: Date;
}

export default function TrialBalancePage() {
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fiscalPeriods, setFiscalPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');

  useEffect(() => {
    loadFiscalPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      loadTrialBalance();
    }
  }, [selectedPeriod]);

  const loadFiscalPeriods = async () => {
    try {
      // In production, this would fetch from API
      // For now, using mock data or would integrate with actual endpoint
      const mockPeriods = [
        { id: 'period-1', name: 'January 2024', startDate: '2024-01-01', endDate: '2024-01-31' },
        { id: 'period-2', name: 'February 2024', startDate: '2024-02-01', endDate: '2024-02-29' },
        { id: 'period-3', name: 'March 2024', startDate: '2024-03-01', endDate: '2024-03-31' },
      ];
      setFiscalPeriods(mockPeriods);
      if (mockPeriods.length > 0) {
        setSelectedPeriod(mockPeriods[0].id);
      }
    } catch (err) {
      console.error('Failed to load fiscal periods:', err);
    }
  };

  const loadTrialBalance = async () => {
    if (!selectedPeriod) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await api.get(`/finance/reports/trial-balance-analysis`, {
        params: { fiscalPeriodId: selectedPeriod },
      });
      
      setTrialBalance(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load trial balance');
      console.error('Error loading trial balance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadTrialBalance();
  };

  const handleExport = async () => {
    if (!trialBalance || !selectedPeriod) return;
    
    try {
      const response = await api.get(`/finance/reports/trial-balance-export`, {
        params: {
          fiscalPeriodId: selectedPeriod,
          format: exportFormat,
        },
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `trial-balance-${selectedPeriod}.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.parentElement?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export trial balance');
    }
  };

  const filteredLines = trialBalance?.lines?.filter((line) => {
    const matchesSearch =
      line.accountCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      line.accountName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !filterType || line.accountType === filterType;
    
    return matchesSearch && matchesType;
  }) || [];

  const period = fiscalPeriods.find((p) => p.id === selectedPeriod);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Trial Balance</h1>
            <p className="text-gray-600 text-sm mt-1">
              Verify accounting equation: Assets = Liabilities + Equity
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Period Selection and Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="md:col-span-1">
            <label className="text-sm font-medium mb-2 block">Fiscal Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded bg-white"
            >
              <option value="">Select a period</option>
              {fiscalPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </div>

          {/* Summary Cards */}
          <div className="rounded-lg p-3 border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <div>
                <p className="text-xs text-blue-600">Total Debits</p>
                <p className="text-lg font-bold">{formatCurrency(trialBalance?.totalDebit || 0)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg p-3 border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <div>
                <p className="text-xs text-green-600">Total Credits</p>
                <p className="text-lg font-bold">{formatCurrency(trialBalance?.totalCredit || 0)}</p>
              </div>
            </div>
          </div>

          <div
            className={`rounded-lg p-3 border ${
              trialBalance?.balanced
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center gap-2 text-sm">
              {trialBalance?.balanced ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-green-600">Status</p>
                    <p className="text-lg font-bold text-green-600">Balanced</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-xs text-red-600">Status</p>
                    <p className="text-lg font-bold text-red-600">Imbalanced</p>
                    {trialBalance && (
                      <p className="text-xs text-red-600">
                        Diff: {formatCurrency(trialBalance.imbalanceAmount)}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Reconciliation Widget */}
        {selectedPeriod && (
          <ReconciliationStatusWidget fiscalPeriodId={selectedPeriod} />
        )}

        {/* Trial Balance Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Trial Balance Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              All GL accounts for {period?.name}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
              <input
                type="text"
                placeholder="Search account code or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded bg-white"
              >
                <option value="">All Account Types</option>
                <option value="asset">Assets</option>
                <option value="liability">Liabilities</option>
                <option value="equity">Equity</option>
                <option value="revenue">Revenue</option>
                <option value="expense">Expenses</option>
              </select>

              <select
                value={exportFormat}
                onChange={(e: any) => setExportFormat(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded bg-white"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>

              <button
                onClick={handleExport}
                disabled={!trialBalance}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Account Code</th>
                    <th className="px-4 py-2 text-left font-semibold">Account Name</th>
                    <th className="px-4 py-2 text-right font-semibold">Type</th>
                    <th className="px-4 py-2 text-right font-semibold">Debit</th>
                    <th className="px-4 py-2 text-right font-semibold">Credit</th>
                    <th className="px-4 py-2 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        Loading trial balance...
                      </td>
                    </tr>
                  ) : filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        No accounts found
                      </td>
                    </tr>
                  ) : (
                    filteredLines.map((line) => (
                      <tr key={line.accountId} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-mono font-medium">{line.accountCode}</td>
                        <td className="px-4 py-2">
                          <p className="font-medium">{line.accountName}</p>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className="inline-block px-2 py-1 text-xs bg-gray-100 rounded capitalize">
                            {line.accountType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-medium">
                          {formatCurrency(line.debit - line.credit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Row */}
            {trialBalance && filteredLines.length > 0 && (
              <div className="border-t pt-4 flex justify-end gap-8 px-4 font-bold">
                <div className="text-right min-w-[120px]">
                  <p className="text-sm text-gray-600 font-normal mb-1">Total Debit</p>
                  <p className="text-lg font-mono">
                    {formatCurrency(
                      filteredLines.reduce((sum, line) => sum + line.debit, 0)
                    )}
                  </p>
                </div>
                <div className="text-right min-w-[120px]">
                  <p className="text-sm text-gray-600 font-normal mb-1">Total Credit</p>
                  <p className="text-lg font-mono">
                    {formatCurrency(
                      filteredLines.reduce((sum, line) => sum + line.credit, 0)
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Variance Analysis */}
        {selectedPeriod && (
          <VarianceAnalysisPanel fiscalPeriodId={selectedPeriod} />
        )}
      </div>
    </div>
  );
}
