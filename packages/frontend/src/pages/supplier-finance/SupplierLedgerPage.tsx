import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../lib/currency';
import { supplierFinanceService } from '../../services/supplier-finance';
import { supplierService } from '../../services/suppliers';
import { useFacilityId } from '../../lib/facility';
import {
  BookOpen,
  ChevronDown,
  Loader2,
  Building2,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

const EMPTY_TOTALS = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };

export default function SupplierLedgerPage() {
  const facilityId = useFacilityId();
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'ledger' | 'aging'>('ledger');

  const { data: supplierList = [] } = useQuery({
    queryKey: ['suppliers-active', facilityId],
    queryFn: async () => {
      const res = await supplierService.list(facilityId, { status: 'active', limit: 200 });
      return res.data ?? [];
    },
  });

  const selectedSupplier = supplierList.find((s) => s.id === selectedSupplierId);

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['supplier-ledger', selectedSupplierId, startDate, endDate],
    queryFn: () => supplierFinanceService.reports.getLedger(selectedSupplierId, startDate, endDate),
    enabled: !!selectedSupplierId,
  });

  const { data: agingReport, isLoading: agingLoading } = useQuery({
    queryKey: ['supplier-aging', facilityId],
    queryFn: () => supplierFinanceService.reports.getAging(facilityId),
    enabled: !!facilityId,
  });

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case 'GRN': return 'text-red-600';
      case 'Payment': return 'text-green-600';
      case 'Credit Note': return 'text-green-600';
      case 'Debit Note': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const agingRows = agingReport?.suppliers ?? [];
  const agingTotals = agingReport?.totals ?? EMPTY_TOTALS;
  const overdue = agingTotals.days60 + agingTotals.days90 + agingTotals.over90;

  // The backend supplies no debit/credit totals — derive them from the rows it returned.
  const totalDebits = ledger?.transactions.reduce((sum, t) => sum + t.debit, 0) ?? 0;
  const totalCredits = ledger?.transactions.reduce((sum, t) => sum + t.credit, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Supplier Ledger & Aging</h1>
        <p className="text-gray-600">View supplier account history and payables aging</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Suppliers with Balances</p>
              <p className="text-xl font-bold text-gray-900">{agingRows.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Payables</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(agingTotals.total)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Overdue (60+ days)</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(overdue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Current (0-30 days)</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(agingTotals.current)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'ledger'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Supplier Ledger
              </div>
            </button>
            <button
              onClick={() => setActiveTab('aging')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'aging'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Aging Report
              </div>
            </button>
          </div>
        </div>

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          <div>
            {/* Filters */}
            <div className="p-4 border-b flex flex-wrap items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  <Building2 className="w-4 h-4" />
                  {selectedSupplier?.name ?? 'Select supplier'}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showSupplierDropdown && (
                  <div className="absolute top-full mt-1 w-64 bg-white border rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto">
                    {supplierList.length === 0 ? (
                      <p className="px-4 py-2 text-sm text-gray-500">No active suppliers</p>
                    ) : (
                      supplierList.map((supplier) => (
                        <button
                          key={supplier.id}
                          onClick={() => {
                            setSelectedSupplierId(supplier.id);
                            setShowSupplierDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50"
                        >
                          {supplier.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Ledger Summary */}
            {ledger && (
              <div className="p-4 bg-gray-50 border-b grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Opening Balance</p>
                  <p className="font-medium text-gray-900">{formatCurrency(ledger.openingBalance)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Debits (Payments & Credit Notes)</p>
                  <p className="font-medium text-green-600">{formatCurrency(totalDebits)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Credits (GRNs & Debit Notes)</p>
                  <p className="font-medium text-red-600">{formatCurrency(totalCredits)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Closing Balance</p>
                  <p className="font-medium text-blue-600">{formatCurrency(ledger.closingBalance)}</p>
                </div>
              </div>
            )}

            {/* Ledger Entries */}
            {ledgerLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : ledger ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Reference</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Debit</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Credit</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledger.transactions.map((entry, index) => (
                    <tr key={`${entry.type}-${entry.reference}-${index}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${getEntryTypeColor(entry.type)}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{entry.reference}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                  {ledger.transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No transactions in this date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a supplier to view ledger</p>
              </div>
            )}
          </div>
        )}

        {/* Aging Tab */}
        {activeTab === 'aging' && (
          <div>
            {agingLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : agingRows.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Supplier</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Current (0-30)</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">31-60 Days</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">61-90 Days</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">91-120 Days</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">120+ Days</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agingRows.map((supplier) => (
                    <tr key={supplier.supplierId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{supplier.supplierName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">
                        {supplier.current > 0 ? formatCurrency(supplier.current) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-blue-600">
                        {supplier.days30 > 0 ? formatCurrency(supplier.days30) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-yellow-600">
                        {supplier.days60 > 0 ? formatCurrency(supplier.days60) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600">
                        {supplier.days90 > 0 ? formatCurrency(supplier.days90) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        {supplier.over90 > 0 ? formatCurrency(supplier.over90) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                        {formatCurrency(supplier.total)}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-4 py-3 text-gray-900">Total</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(agingTotals.current)}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(agingTotals.days30)}</td>
                    <td className="px-4 py-3 text-right text-yellow-600">{formatCurrency(agingTotals.days60)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(agingTotals.days90)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(agingTotals.over90)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(agingTotals.total)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No aging data available</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
