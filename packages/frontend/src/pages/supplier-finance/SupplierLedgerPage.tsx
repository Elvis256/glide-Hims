import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Building2,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
} from 'lucide-react';

interface LedgerEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'OPENING_BALANCE';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface SupplierLedger {
  supplierId: string;
  supplierName: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  entries: LedgerEntry[];
}

interface AgingBucket {
  supplierId: string;
  supplierName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

// Data - will be populated from API
const mockLedger: SupplierLedger | null = null;

const mockAgingReport: AgingBucket[] = [];

const suppliers = ['All', 'MedPharm Supplies Ltd', 'Uganda Lab Equipment Co', 'AfriMed Pharmaceuticals', 'East Africa Medical'];

export default function SupplierLedgerPage() {
  const [selectedSupplier, setSelectedSupplier] = useState('MedPharm Supplies Ltd');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-01-31');
  const [activeTab, setActiveTab] = useState<'ledger' | 'aging'>('ledger');

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ['supplier-ledger', selectedSupplier, startDate, endDate],
    queryFn: async () => mockLedger,
    enabled: selectedSupplier !== 'All',
  });

  const { data: agingReport, isLoading: agingLoading } = useQuery({
    queryKey: ['supplier-aging'],
    queryFn: async () => mockAgingReport,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX' }).format(amount);
  };

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case 'INVOICE': return 'text-red-600';
      case 'PAYMENT': return 'text-green-600';
      case 'CREDIT_NOTE': return 'text-green-600';
      case 'DEBIT_NOTE': return 'text-red-600';
      case 'OPENING_BALANCE': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getEntryTypeLabel = (type: string) => {
    switch (type) {
      case 'INVOICE': return 'Invoice';
      case 'PAYMENT': return 'Payment';
      case 'CREDIT_NOTE': return 'Credit Note';
      case 'DEBIT_NOTE': return 'Debit Note';
      case 'OPENING_BALANCE': return 'Opening';
      default: return type;
    }
  };

  const agingData = agingReport || [];
  
  const totalPayables = agingData.reduce((sum, s) => sum + s.total, 0);
  const overdue = agingData.reduce((sum, s) => sum + s.days60 + s.days90 + s.over90, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Ledger & Aging</h1>
          <p className="text-gray-600">View supplier account history and payables aging</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Suppliers</p>
              <p className="text-xl font-bold text-gray-900">{agingData.length}</p>
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
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalPayables)}</p>
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
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(agingData.reduce((sum, s) => sum + s.current, 0))}
              </p>
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
                  {selectedSupplier}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showSupplierDropdown && (
                  <div className="absolute top-full mt-1 w-64 bg-white border rounded-lg shadow-lg z-10">
                    {suppliers.filter(s => s !== 'All').map((supplier) => (
                      <button
                        key={supplier}
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setShowSupplierDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50"
                      >
                        {supplier}
                      </button>
                    ))}
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
                  <p className="text-xs text-gray-500">Total Debits (Invoices)</p>
                  <p className="font-medium text-red-600">{formatCurrency(ledger.totalDebits)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Credits (Payments)</p>
                  <p className="font-medium text-green-600">{formatCurrency(ledger.totalCredits)}</p>
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Description</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Debit</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Credit</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ledger.entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${getEntryTypeColor(entry.type)}`}>
                          {getEntryTypeLabel(entry.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{entry.reference}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{entry.description}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
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
            ) : agingReport && agingReport.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Supplier</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Current</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">1-30 Days</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">31-60 Days</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">61-90 Days</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">90+ Days</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agingReport?.map((supplier) => (
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
                    <td className="px-4 py-3 text-right text-green-600">
                      {formatCurrency(agingReport?.reduce((sum, s) => sum + s.current, 0) || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      {formatCurrency(agingReport?.reduce((sum, s) => sum + s.days30, 0) || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-600">
                      {formatCurrency(agingReport?.reduce((sum, s) => sum + s.days60, 0) || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600">
                      {formatCurrency(agingReport?.reduce((sum, s) => sum + s.days90, 0) || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatCurrency(agingReport?.reduce((sum, s) => sum + s.over90, 0) || 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(agingReport?.reduce((sum, s) => sum + s.total, 0) || 0)}
                    </td>
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
