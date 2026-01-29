import React, { useState, useMemo } from 'react';
import {
  PackageCheck,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  Truck,
  Calendar,
  Building2,
  FileText,
  Printer,
  Download,
  ClipboardCheck,
  Camera,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Link,
} from 'lucide-react';

type GRNStatus = 'Pending' | 'Partial' | 'Complete' | 'Inspection' | 'Rejected';

interface GRNItem {
  id: string;
  name: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  unit: string;
  condition: 'Good' | 'Damaged' | 'Partial Damage' | 'Pending Inspection';
  notes?: string;
}

interface InspectionItem {
  id: string;
  criteria: string;
  passed: boolean | null;
  notes?: string;
}

interface GRN {
  id: string;
  grnNumber: string;
  poNumber: string;
  vendor: string;
  status: GRNStatus;
  items: GRNItem[];
  receivedDate: string;
  receivedBy: string;
  inspectedBy?: string;
  inspectionDate?: string;
  invoiceNumber?: string;
  deliveryNote?: string;
  inspectionChecklist: InspectionItem[];
  totalOrdered: number;
  totalReceived: number;
  notes?: string;
}

const grns: GRN[] = [];

const statusConfig: Record<GRNStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  Pending: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Clock className="w-3 h-3" /> },
  Partial: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Package className="w-3 h-3" /> },
  Complete: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  Inspection: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <ClipboardCheck className="w-3 h-3" /> },
  Rejected: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" /> },
};

const conditionConfig: Record<string, { color: string; bg: string }> = {
  Good: { color: 'text-green-600', bg: 'bg-green-100' },
  Damaged: { color: 'text-red-600', bg: 'bg-red-100' },
  'Partial Damage': { color: 'text-orange-600', bg: 'bg-orange-100' },
  'Pending Inspection': { color: 'text-blue-600', bg: 'bg-blue-100' },
};

export default function GoodsReceivedPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<GRNStatus | 'All'>('All');
  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string | null>(null);

  const filteredGRNs = useMemo(() => {
    return grns.filter((grn) => {
      const matchesSearch =
        grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.vendor.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || grn.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const pendingDeliveries = useMemo(() => {
    return grns.filter((grn) => grn.status === 'Pending').length;
  }, []);

  const getReceiptPercentage = (grn: GRN) => {
    if (grn.totalOrdered === 0) return 0;
    return Math.round((grn.totalReceived / grn.totalOrdered) * 100);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <PackageCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Goods Received Notes</h1>
              <p className="text-sm text-gray-500">Record and manage incoming deliveries</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingDeliveries > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Truck className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  {pendingDeliveries} pending {pendingDeliveries === 1 ? 'delivery' : 'deliveries'}
                </span>
              </div>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create GRN
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search GRN, PO number, or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {(['All', 'Pending', 'Inspection', 'Partial', 'Complete', 'Rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-emerald-600 text-white'
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
        {/* GRN List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredGRNs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <PackageCheck className="w-16 h-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Goods Received Notes</h3>
              <p className="text-sm text-gray-500 mb-4">Record deliveries when goods arrive</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4" />
                Create GRN
              </button>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredGRNs.map((grn) => {
              const receiptPct = getReceiptPercentage(grn);
              
              return (
                <div
                  key={grn.id}
                  onClick={() => setSelectedGRN(grn)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedGRN?.id === grn.id ? 'ring-2 ring-emerald-500 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-emerald-600">{grn.grnNumber}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[grn.status].bg} ${statusConfig[grn.status].color}`}
                        >
                          {statusConfig[grn.status].icon}
                          {grn.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{grn.vendor}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {grn.poNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {grn.items.length} items
                        </span>
                        {grn.receivedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {grn.receivedDate}
                          </span>
                        )}
                        {grn.invoiceNumber && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Link className="w-3.5 h-3.5" />
                            {grn.invoiceNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {grn.totalReceived}/{grn.totalOrdered}
                      </div>
                      <p className="text-xs text-gray-500">Items Received</p>
                    </div>
                  </div>

                  {/* Receipt Progress */}
                  {grn.status !== 'Pending' && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Receipt Progress</span>
                        <span className={`font-medium ${receiptPct === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {receiptPct}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            receiptPct === 100 ? 'bg-green-500' : receiptPct > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${receiptPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Inspection Issues */}
                  {grn.inspectionChecklist.some((item) => item.passed === false) && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                          {grn.inspectionChecklist.filter((item) => item.passed === false).length} inspection issue(s) found
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedGRN && (
          <div className="w-[450px] border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">GRN Details</h2>
              <div className="flex items-center gap-2">
                <button className="p-1.5 border rounded hover:bg-gray-100">
                  <Printer className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-1.5 border rounded hover:bg-gray-100">
                  <Download className="w-4 h-4 text-gray-600" />
                </button>
                <button onClick={() => setSelectedGRN(null)} className="p-1 hover:bg-gray-200 rounded">
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">GRN Number</p>
                  <p className="font-mono font-bold text-emerald-600">{selectedGRN.grnNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">PO Number</p>
                  <p className="font-mono text-sm">{selectedGRN.poNumber}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendor</p>
                <p className="font-medium">{selectedGRN.vendor}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Received Date</p>
                  <p className="text-sm">{selectedGRN.receivedDate || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Received By</p>
                  <p className="text-sm">{selectedGRN.receivedBy || '-'}</p>
                </div>
              </div>

              {selectedGRN.invoiceNumber && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Linked Invoice</p>
                  <p className="font-medium text-blue-700">{selectedGRN.invoiceNumber}</p>
                </div>
              )}

              {/* Items Received */}
              <div>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedItems(expandedItems === 'items' ? null : 'items')}
                >
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Items Received</p>
                  {expandedItems === 'items' ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className={`mt-2 space-y-2 ${expandedItems === 'items' ? '' : 'max-h-48 overflow-hidden'}`}>
                  {selectedGRN.items.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{item.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${conditionConfig[item.condition].bg} ${conditionConfig[item.condition].color}`}>
                          {item.condition}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Ordered</span>
                          <p className="font-medium">{item.orderedQty}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Received</span>
                          <p className="font-medium">{item.receivedQty}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Accepted</span>
                          <p className="font-medium text-green-600">{item.acceptedQty}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Rejected</span>
                          <p className={`font-medium ${item.rejectedQty > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {item.rejectedQty}
                          </p>
                        </div>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-2 pt-2 border-t">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Inspection */}
              {selectedGRN.inspectionChecklist.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Quality Inspection</p>
                  <div className="border rounded-lg overflow-hidden">
                    {selectedGRN.inspectionChecklist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                        <span className="text-sm">{item.criteria}</span>
                        <div className="flex items-center gap-2">
                          {item.passed === true && (
                            <span className="flex items-center gap-1 text-green-600 text-xs">
                              <CheckCircle className="w-4 h-4" />
                              Pass
                            </span>
                          )}
                          {item.passed === false && (
                            <span className="flex items-center gap-1 text-red-600 text-xs">
                              <XCircle className="w-4 h-4" />
                              Fail
                            </span>
                          )}
                          {item.passed === null && (
                            <span className="flex items-center gap-1 text-gray-400 text-xs">
                              <Clock className="w-4 h-4" />
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedGRN.inspectedBy && (
                    <p className="text-xs text-gray-500 mt-2">
                      Inspected by {selectedGRN.inspectedBy} on {selectedGRN.inspectionDate}
                    </p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedGRN.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{selectedGRN.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedGRN.status === 'Pending' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                    <PackageCheck className="w-4 h-4" />
                    Record Receipt
                  </button>
                )}
                {selectedGRN.status === 'Inspection' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <ClipboardCheck className="w-4 h-4" />
                    Complete Inspection
                  </button>
                )}
                {selectedGRN.status === 'Partial' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                    <Package className="w-4 h-4" />
                    Record Additional Items
                  </button>
                )}
                {(selectedGRN.status === 'Complete' || selectedGRN.status === 'Partial') && !selectedGRN.invoiceNumber && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50">
                    <Link className="w-4 h-4" />
                    Link to Invoice
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Goods Received Note</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase Order</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option>Select a PO with pending delivery</option>
                  <option>PO-2024-002 - Computer World - 5 items</option>
                  <option>PO-2024-001 - MedSupply Co - Partial (50 remaining)</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Note Number</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="DN-2024-XXX"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items Received</label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="text-center px-3 py-2">Ordered</th>
                        <th className="text-center px-3 py-2">Received</th>
                        <th className="text-center px-3 py-2">Accepted</th>
                        <th className="text-center px-3 py-2">Rejected</th>
                        <th className="text-left px-3 py-2">Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-3 py-2">Sample Item</td>
                        <td className="px-3 py-2 text-center text-gray-500">100</td>
                        <td className="px-3 py-2">
                          <input type="number" className="w-16 px-2 py-1 border rounded text-center" defaultValue="100" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" className="w-16 px-2 py-1 border rounded text-center" defaultValue="100" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" className="w-16 px-2 py-1 border rounded text-center" defaultValue="0" />
                        </td>
                        <td className="px-3 py-2">
                          <select className="px-2 py-1 border rounded text-sm">
                            <option>Good</option>
                            <option>Damaged</option>
                            <option>Partial Damage</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quality Inspection Checklist</label>
                <div className="space-y-2">
                  {['Packaging intact', 'Quantity matches delivery note', 'Product labels correct', 'Expiry dates valid'].map((criteria, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm">{criteria}</span>
                      <div className="flex items-center gap-2">
                        <button className="p-1 rounded hover:bg-green-100 text-gray-400 hover:text-green-600">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder="Any observations or notes about the delivery..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Save as Draft
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                <PackageCheck className="w-4 h-4" />
                Create GRN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}