import React, { useState, useMemo } from 'react';
import {
  FileCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  DollarSign,
  Calendar,
  Building2,
  FileText,
  Package,
  Link2,
  ThumbsUp,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CreditCard,
  ArrowRight,
  Flag,
} from 'lucide-react';

type MatchStatus = 'Pending' | 'Matched' | 'Mismatch' | 'Approved' | 'Flagged';

interface MatchItem {
  id: string;
  name: string;
  poQty: number;
  poPrice: number;
  grnQty: number;
  invoiceQty: number;
  invoicePrice: number;
  qtyMatch: boolean;
  priceMatch: boolean;
}

interface InvoiceMatch {
  id: string;
  invoiceNumber: string;
  vendorInvoiceNo: string;
  vendor: string;
  poNumber: string;
  grnNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: MatchStatus;
  items: MatchItem[];
  poTotal: number;
  grnTotal: number;
  invoiceTotal: number;
  variance: number;
  variancePercent: number;
  paymentScheduled?: string;
  notes?: string;
}

const mockInvoiceMatches: InvoiceMatch[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    vendorInvoiceNo: 'MS-INV-2024-0123',
    vendor: 'MedSupply Co',
    poNumber: 'PO-2024-001',
    grnNumber: 'GRN-2024-001',
    invoiceDate: '2024-01-26',
    dueDate: '2024-02-25',
    status: 'Mismatch',
    items: [
      { id: '1', name: 'Surgical Gloves (Box)', poQty: 100, poPrice: 14.50, grnQty: 100, invoiceQty: 100, invoicePrice: 14.50, qtyMatch: true, priceMatch: true },
      { id: '2', name: 'Syringes 5ml', poQty: 500, poPrice: 0.45, grnQty: 495, invoiceQty: 500, invoicePrice: 0.45, qtyMatch: false, priceMatch: true },
      { id: '3', name: 'Bandages', poQty: 200, poPrice: 2.80, grnQty: 150, invoiceQty: 200, invoicePrice: 2.85, qtyMatch: false, priceMatch: false },
    ],
    poTotal: 2235,
    grnTotal: 2095,
    invoiceTotal: 2245,
    variance: 150,
    variancePercent: 7.16,
    notes: 'Quantity mismatch on syringes and bandages. Price variance on bandages.',
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    vendorInvoiceNo: 'LE-INV-2024-0456',
    vendor: 'Lab Essentials Inc',
    poNumber: 'PO-2024-004',
    grnNumber: 'GRN-2024-002',
    invoiceDate: '2024-01-24',
    dueDate: '2024-03-09',
    status: 'Matched',
    items: [
      { id: '1', name: 'Microscope Slides', poQty: 1000, poPrice: 0.08, grnQty: 1000, invoiceQty: 1000, invoicePrice: 0.08, qtyMatch: true, priceMatch: true },
      { id: '2', name: 'Test Tubes', poQty: 500, poPrice: 0.22, grnQty: 500, invoiceQty: 500, invoicePrice: 0.22, qtyMatch: true, priceMatch: true },
    ],
    poTotal: 190,
    grnTotal: 190,
    invoiceTotal: 190,
    variance: 0,
    variancePercent: 0,
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    vendorInvoiceNo: 'CT-INV-2024-0789',
    vendor: 'CleanTech Supplies',
    poNumber: 'PO-2024-005',
    grnNumber: 'GRN-2024-003',
    invoiceDate: '2024-01-20',
    dueDate: '2024-02-19',
    status: 'Approved',
    items: [
      { id: '1', name: 'Disinfectant (Gallon)', poQty: 20, poPrice: 22, grnQty: 20, invoiceQty: 20, invoicePrice: 22, qtyMatch: true, priceMatch: true },
      { id: '2', name: 'Mops', poQty: 15, poPrice: 10, grnQty: 15, invoiceQty: 15, invoicePrice: 10, qtyMatch: true, priceMatch: true },
    ],
    poTotal: 590,
    grnTotal: 590,
    invoiceTotal: 590,
    variance: 0,
    variancePercent: 0,
    paymentScheduled: '2024-02-15',
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-004',
    vendorInvoiceNo: 'CW-INV-2024-0321',
    vendor: 'Computer World',
    poNumber: 'PO-2024-002',
    grnNumber: '',
    invoiceDate: '2024-01-25',
    dueDate: '2024-02-09',
    status: 'Pending',
    items: [
      { id: '1', name: 'Laptop', poQty: 5, poPrice: 1180, grnQty: 0, invoiceQty: 5, invoicePrice: 1180, qtyMatch: false, priceMatch: true },
    ],
    poTotal: 5900,
    grnTotal: 0,
    invoiceTotal: 5900,
    variance: 5900,
    variancePercent: 100,
    notes: 'Invoice received before goods delivery',
  },
  {
    id: '5',
    invoiceNumber: 'INV-2024-005',
    vendorInvoiceNo: 'OP-INV-2024-0654',
    vendor: 'Office Pro',
    poNumber: 'PO-2024-003',
    grnNumber: 'GRN-2024-006',
    invoiceDate: '2024-01-28',
    dueDate: '2024-02-27',
    status: 'Flagged',
    items: [
      { id: '1', name: 'Office Desk', poQty: 10, poPrice: 250, grnQty: 10, invoiceQty: 10, invoicePrice: 275, qtyMatch: true, priceMatch: false },
      { id: '2', name: 'Office Chair', poQty: 15, poPrice: 180, grnQty: 15, invoiceQty: 15, invoicePrice: 195, qtyMatch: true, priceMatch: false },
    ],
    poTotal: 5200,
    grnTotal: 5200,
    invoiceTotal: 5675,
    variance: 475,
    variancePercent: 9.13,
    notes: 'Vendor claims price increase due to shipping costs. Under review.',
  },
];

const statusConfig: Record<MatchStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  Pending: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Clock className="w-3 h-3" /> },
  Matched: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  Mismatch: { color: 'text-red-600', bg: 'bg-red-100', icon: <AlertTriangle className="w-3 h-3" /> },
  Approved: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <ThumbsUp className="w-3 h-3" /> },
  Flagged: { color: 'text-orange-600', bg: 'bg-orange-100', icon: <Flag className="w-3 h-3" /> },
};

export default function InvoiceMatchingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'All'>('All');
  const [selectedMatch, setSelectedMatch] = useState<InvoiceMatch | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string | null>(null);

  const filteredMatches = useMemo(() => {
    return mockInvoiceMatches.filter((match) => {
      const matchesSearch =
        match.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.poNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || match.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      pending: mockInvoiceMatches.filter((m) => m.status === 'Pending').length,
      mismatches: mockInvoiceMatches.filter((m) => m.status === 'Mismatch' || m.status === 'Flagged').length,
      totalValue: mockInvoiceMatches.reduce((sum, m) => sum + m.invoiceTotal, 0),
      approvedValue: mockInvoiceMatches.filter((m) => m.status === 'Approved').reduce((sum, m) => sum + m.invoiceTotal, 0),
    };
  }, []);

  const getDueDaysClass = (dueDate: string) => {
    const days = Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'text-red-600 font-medium';
    if (days <= 7) return 'text-orange-600';
    return 'text-gray-600';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <FileCheck className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Invoice Matching</h1>
              <p className="text-sm text-gray-500">3-way matching: PO, GRN, Invoice</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Pending Review</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Discrepancies</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{stats.mismatches}</p>
          </div>
          <div className="bg-gray-50 border rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Total Invoice Value</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">${stats.totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Approved for Payment</span>
            </div>
            <p className="text-2xl font-bold text-green-700">${stats.approvedValue.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices, vendors, PO numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {(['All', 'Pending', 'Matched', 'Mismatch', 'Flagged', 'Approved'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Match List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredMatches.map((match) => {
              const hasQtyMismatch = match.items.some((item) => !item.qtyMatch);
              const hasPriceMismatch = match.items.some((item) => !item.priceMatch);
              
              return (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedMatch?.id === match.id ? 'ring-2 ring-violet-500 border-violet-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-violet-600">{match.invoiceNumber}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[match.status].bg} ${statusConfig[match.status].color}`}
                        >
                          {statusConfig[match.status].icon}
                          {match.status}
                        </span>
                        {hasQtyMismatch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                            <Package className="w-3 h-3" />
                            Qty Mismatch
                          </span>
                        )}
                        {hasPriceMismatch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                            <DollarSign className="w-3 h-3" />
                            Price Variance
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{match.vendor}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{match.vendorInvoiceNo}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {match.poNumber}
                        </span>
                        {match.grnNumber && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {match.grnNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {match.invoiceDate}
                        </span>
                        <span className={`flex items-center gap-1 ${getDueDaysClass(match.dueDate)}`}>
                          <Clock className="w-3.5 h-3.5" />
                          Due: {match.dueDate}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        ${match.invoiceTotal.toLocaleString()}
                      </div>
                      {match.variance !== 0 && (
                        <p className={`text-sm ${match.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {match.variance > 0 ? '+' : ''}${match.variance.toLocaleString()} ({match.variancePercent.toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 3-Way Match Summary */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">PO Amount</p>
                        <p className="font-medium">${match.poTotal.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">GRN Amount</p>
                        <p className={`font-medium ${match.grnTotal === 0 ? 'text-gray-400' : ''}`}>
                          {match.grnTotal === 0 ? 'Not Received' : `$${match.grnTotal.toLocaleString()}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Invoice Amount</p>
                        <p className="font-medium">${match.invoiceTotal.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Match Indicator */}
                    <div className="flex items-center justify-center mt-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.poTotal === match.grnTotal || match.grnTotal === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">PO↔GRN</span>
                      </div>
                      <div className="w-8 h-px bg-gray-200 mx-2" />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.grnTotal === match.invoiceTotal ? 'bg-green-500' : match.grnTotal === 0 ? 'bg-gray-300' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">GRN↔Invoice</span>
                      </div>
                      <div className="w-8 h-px bg-gray-200 mx-2" />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.poTotal === match.invoiceTotal ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">PO↔Invoice</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedMatch && (
          <div className="w-[450px] border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Matching Details</h2>
              <button onClick={() => setSelectedMatch(null)} className="p-1 hover:bg-gray-200 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Invoice Number</p>
                  <p className="font-mono font-bold text-violet-600">{selectedMatch.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendor Invoice</p>
                  <p className="font-mono text-sm">{selectedMatch.vendorInvoiceNo}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendor</p>
                <p className="font-medium">{selectedMatch.vendor}</p>
              </div>

              {/* Document Links */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Linked Documents</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-blue-600">{selectedMatch.poNumber}</span>
                  </div>
                  {selectedMatch.grnNumber ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Package className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600">{selectedMatch.grnNumber}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Package className="w-4 h-4" />
                      <span>No GRN</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Invoice Date</p>
                  <p className="text-sm">{selectedMatch.invoiceDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Due Date</p>
                  <p className={`text-sm font-medium ${getDueDaysClass(selectedMatch.dueDate)}`}>
                    {selectedMatch.dueDate}
                  </p>
                </div>
              </div>

              {/* Item Comparison */}
              <div>
                <div
                  className="flex items-center justify-between cursor-pointer mb-2"
                  onClick={() => setExpandedItems(expandedItems === 'items' ? null : 'items')}
                >
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Item-Level Comparison</p>
                  {expandedItems === 'items' ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className={`space-y-2 ${expandedItems !== 'items' ? 'max-h-64 overflow-hidden' : ''}`}>
                  {selectedMatch.items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{item.name}</span>
                        <div className="flex gap-1">
                          {!item.qtyMatch && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">Qty</span>
                          )}
                          {!item.priceMatch && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded">Price</span>
                          )}
                          {item.qtyMatch && item.priceMatch && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left font-normal pb-1"></th>
                            <th className="text-right font-normal pb-1">PO</th>
                            <th className="text-right font-normal pb-1">GRN</th>
                            <th className="text-right font-normal pb-1">Invoice</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="text-gray-500">Qty</td>
                            <td className="text-right">{item.poQty}</td>
                            <td className={`text-right ${item.grnQty !== item.poQty ? 'text-red-600 font-medium' : ''}`}>
                              {item.grnQty}
                            </td>
                            <td className={`text-right ${item.invoiceQty !== item.grnQty ? 'text-red-600 font-medium' : ''}`}>
                              {item.invoiceQty}
                            </td>
                          </tr>
                          <tr>
                            <td className="text-gray-500">Price</td>
                            <td className="text-right">${item.poPrice.toFixed(2)}</td>
                            <td className="text-right">-</td>
                            <td className={`text-right ${item.invoicePrice !== item.poPrice ? 'text-orange-600 font-medium' : ''}`}>
                              ${item.invoicePrice.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-3 gap-4 text-center mb-3">
                  <div>
                    <p className="text-xs text-gray-500">PO Total</p>
                    <p className="font-medium">${selectedMatch.poTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">GRN Total</p>
                    <p className="font-medium">
                      {selectedMatch.grnTotal === 0 ? '-' : `$${selectedMatch.grnTotal.toLocaleString()}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Invoice Total</p>
                    <p className="font-bold text-lg">${selectedMatch.invoiceTotal.toLocaleString()}</p>
                  </div>
                </div>
                {selectedMatch.variance !== 0 && (
                  <div className={`text-center pt-2 border-t ${selectedMatch.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span className="text-sm">Variance: </span>
                    <span className="font-bold">
                      {selectedMatch.variance > 0 ? '+' : ''}${selectedMatch.variance.toLocaleString()} ({selectedMatch.variancePercent.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Info */}
              {selectedMatch.paymentScheduled && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-medium">Payment Scheduled</span>
                  </div>
                  <p className="text-green-800 font-medium mt-1">{selectedMatch.paymentScheduled}</p>
                </div>
              )}

              {/* Notes */}
              {selectedMatch.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
                    {selectedMatch.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedMatch.status === 'Matched' && (
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approve for Payment
                  </button>
                )}
                {(selectedMatch.status === 'Mismatch' || selectedMatch.status === 'Flagged') && (
                  <>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                      <Eye className="w-4 h-4" />
                      Review Discrepancies
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50">
                      <Flag className="w-4 h-4" />
                      Flag for Follow-up
                    </button>
                  </>
                )}
                {selectedMatch.status === 'Pending' && !selectedMatch.grnNumber && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
                    <Link2 className="w-4 h-4" />
                    Link GRN
                  </button>
                )}
                {selectedMatch.status === 'Approved' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <CreditCard className="w-4 h-4" />
                    Schedule Payment
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Eye className="w-4 h-4" />
                  View Full Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Approve Invoice for Payment</h2>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Invoice</span>
                  <span className="font-mono font-medium">{selectedMatch.invoiceNumber}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Vendor</span>
                  <span className="font-medium">{selectedMatch.vendor}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Amount</span>
                  <span className="text-xl font-bold">${selectedMatch.invoiceTotal.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span>3-way match verified. Ready for payment processing.</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <ArrowRight className="w-4 h-4" />
                Approve & Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
