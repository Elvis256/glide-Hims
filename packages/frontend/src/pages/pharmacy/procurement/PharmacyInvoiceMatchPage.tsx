import React, { useState, useMemo } from 'react';
import {
  Search,
  FileText,
  CheckCircle,
  AlertTriangle,
  Building2,
  Filter,
  Eye,
  ChevronRight,
  XCircle,
  Link,
  DollarSign,
  Package,
  Truck,
  Calculator,
  AlertCircle,
  Check,
} from 'lucide-react';

type MatchStatus = 'Pending' | 'Matched' | 'Discrepancy' | 'Approved' | 'Rejected';

interface MatchItem {
  id: string;
  medication: string;
  poQty: number;
  poPrice: number;
  grnQty: number;
  invoiceQty: number;
  invoicePrice: number;
  variance: number;
  priceVariance: number;
  status: 'Match' | 'Qty Mismatch' | 'Price Mismatch' | 'Both';
}

interface InvoiceMatch {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  grnNumber: string;
  supplier: string;
  invoiceDate: string;
  invoiceAmount: number;
  matchedAmount: number;
  status: MatchStatus;
  items: MatchItem[];
  discrepancyNotes?: string;
}

const invoiceMatches: InvoiceMatch[] = [];

export default function PharmacyInvoiceMatchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'All'>('All');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceMatch | null>(null);

  const filteredMatches = useMemo(() => {
    return invoiceMatches.filter((inv) => {
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: 0,
      pending: 0,
      discrepancies: 0,
      approved: 0,
      totalInvoiced: 0,
      totalMatched: 0,
    };
  }, []);

  const getStatusColor = (status: MatchStatus) => {
    switch (status) {
      case 'Pending': return 'bg-gray-100 text-gray-700';
      case 'Matched': return 'bg-blue-100 text-blue-700';
      case 'Discrepancy': return 'bg-orange-100 text-orange-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: MatchStatus) => {
    switch (status) {
      case 'Pending': return <FileText className="w-4 h-4" />;
      case 'Matched': return <Link className="w-4 h-4" />;
      case 'Discrepancy': return <AlertTriangle className="w-4 h-4" />;
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
    }
  };

  const getItemStatusColor = (status: string) => {
    switch (status) {
      case 'Match': return 'bg-green-100 text-green-700';
      case 'Qty Mismatch': return 'bg-orange-100 text-orange-700';
      case 'Price Mismatch': return 'bg-yellow-100 text-yellow-700';
      case 'Both': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Matching</h1>
          <p className="text-gray-600">Match PO, GRN, and supplier invoices for payment approval</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Calculator className="w-4 h-4" />
            Auto-Match All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-gray-700">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Discrepancies</p>
              <p className="text-2xl font-bold text-orange-600">{stats.discrepancies}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Matched Value</p>
              <p className="text-2xl font-bold text-purple-600">
                KES {stats.totalMatched.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Invoice List */}
        <div className="flex-1 flex flex-col">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by invoice, PO, or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as MatchStatus | 'All')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Matched">Matched</option>
                  <option value="Discrepancy">Discrepancy</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Documents</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice Amt</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Matched</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No invoices to match</p>
                        <p className="text-gray-400 text-sm mt-1">Invoice matching will appear here when invoices are received</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMatches.map((inv) => (
                      <tr
                        key={inv.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedInvoice?.id === inv.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{inv.invoiceNumber}</p>
                            <p className="text-xs text-gray-500">{inv.invoiceDate}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {inv.poNumber}
                            </span>
                            <Link className="w-3 h-3 text-gray-400" />
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                              {inv.grnNumber}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-900">{inv.supplier}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          KES {inv.invoiceAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${
                            inv.matchedAmount === inv.invoiceAmount 
                              ? 'text-green-600' 
                              : inv.matchedAmount > 0 
                              ? 'text-orange-600' 
                              : 'text-gray-500'
                          }`}>
                            KES {inv.matchedAmount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(inv.status)}`}>
                            {getStatusIcon(inv.status)}
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                              <Eye className="w-4 h-4" />
                            </button>
                            {inv.status === 'Matched' && (
                              <button className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                                Approve
                              </button>
                            )}
                            {inv.status === 'Pending' && (
                              <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                                Match
                              </button>
                            )}
                            <button className="p-1.5 hover:bg-gray-100 rounded">
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedInvoice && (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedInvoice.status)}`}>
                  {selectedInvoice.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{selectedInvoice.supplier}</p>
            </div>

            {/* Three-way match visual */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Three-Way Match</h3>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 text-center p-3 bg-blue-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-blue-900">{selectedInvoice.poNumber}</p>
                  <p className="text-xs text-blue-600">Purchase Order</p>
                </div>
                <div className="flex flex-col items-center">
                  <Check className="w-4 h-4 text-green-500" />
                  <div className="w-6 h-0.5 bg-gray-300" />
                </div>
                <div className="flex-1 text-center p-3 bg-green-50 rounded-lg">
                  <Package className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-green-900">{selectedInvoice.grnNumber}</p>
                  <p className="text-xs text-green-600">Goods Received</p>
                </div>
                <div className="flex flex-col items-center">
                  <Check className="w-4 h-4 text-green-500" />
                  <div className="w-6 h-0.5 bg-gray-300" />
                </div>
                <div className="flex-1 text-center p-3 bg-purple-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-purple-900">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-xs text-purple-600">Invoice</p>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="flex-1 overflow-auto p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Line Items</h3>
              <div className="space-y-3">
                {selectedInvoice.items.map((item) => (
                  <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">{item.medication}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getItemStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">PO</p>
                        <p className="font-medium">{item.poQty} × KES {item.poPrice}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">GRN</p>
                        <p className={`font-medium ${item.grnQty !== item.poQty ? 'text-orange-600' : ''}`}>
                          {item.grnQty}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Invoice</p>
                        <p className={`font-medium ${item.invoicePrice !== item.poPrice ? 'text-orange-600' : ''}`}>
                          {item.invoiceQty} × KES {item.invoicePrice}
                        </p>
                      </div>
                    </div>
                    {(item.variance !== 0 || item.priceVariance !== 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        {item.variance !== 0 && (
                          <p className="text-xs text-orange-600">
                            Qty variance: {item.variance > 0 ? '+' : ''}{item.variance}
                          </p>
                        )}
                        {item.priceVariance !== 0 && (
                          <p className="text-xs text-orange-600">
                            Price variance: KES {item.priceVariance > 0 ? '+' : ''}{item.priceVariance.toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedInvoice.discrepancyNotes && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs font-medium text-orange-800 mb-1">Discrepancy Notes</p>
                  <p className="text-xs text-orange-700">{selectedInvoice.discrepancyNotes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                {selectedInvoice.status === 'Matched' && (
                  <>
                    <button className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                      Approve for Payment
                    </button>
                    <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm">
                      Reject
                    </button>
                  </>
                )}
                {selectedInvoice.status === 'Discrepancy' && (
                  <>
                    <button className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium">
                      Resolve Discrepancy
                    </button>
                  </>
                )}
                {selectedInvoice.status === 'Pending' && (
                  <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                    Start Matching
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
