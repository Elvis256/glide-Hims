import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Calendar,
  DollarSign,
  Package,
  Building2,
  FileText,
  Printer,
  Download,
  AlertCircle,
  RefreshCw,
  MoreVertical,
} from 'lucide-react';

type POStatus = 'Draft' | 'Sent' | 'Partial' | 'Received' | 'Closed';

interface POItem {
  id: string;
  name: string;
  quantity: number;
  receivedQty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  rfqNumber: string;
  vendor: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: POItem[];
  totalAmount: number;
  status: POStatus;
  createdDate: string;
  sentDate?: string;
  expectedDelivery: string;
  deliveryAddress: string;
  paymentTerms: string;
  notes?: string;
  amendments: {
    date: string;
    description: string;
    by: string;
  }[];
}

const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: '1',
    poNumber: 'PO-2024-001',
    rfqNumber: 'RFQ-2024-001',
    vendor: {
      id: 'v1',
      name: 'MedSupply Co',
      email: 'orders@medsupply.com',
      phone: '+1 555-0123',
      address: '123 Medical Drive, Healthcare City, HC 12345',
    },
    items: [
      { id: '1', name: 'Surgical Gloves (Box)', quantity: 100, receivedQty: 100, unit: 'boxes', unitPrice: 14.50, totalPrice: 1450 },
      { id: '2', name: 'Syringes 5ml', quantity: 500, receivedQty: 500, unit: 'pcs', unitPrice: 0.45, totalPrice: 225 },
      { id: '3', name: 'Bandages', quantity: 200, receivedQty: 150, unit: 'rolls', unitPrice: 2.80, totalPrice: 560 },
    ],
    totalAmount: 2235,
    status: 'Partial',
    createdDate: '2024-01-20',
    sentDate: '2024-01-21',
    expectedDelivery: '2024-01-28',
    deliveryAddress: 'Central Hospital, Receiving Dock A',
    paymentTerms: 'Net 30',
    amendments: [
      { date: '2024-01-22', description: 'Updated delivery address', by: 'John Smith' },
    ],
  },
  {
    id: '2',
    poNumber: 'PO-2024-002',
    rfqNumber: 'RFQ-2024-004',
    vendor: {
      id: 'v7',
      name: 'Computer World',
      email: 'sales@compworld.com',
      phone: '+1 555-0456',
      address: '456 Tech Avenue, Silicon Valley, SV 67890',
    },
    items: [
      { id: '1', name: 'Laptop', quantity: 5, receivedQty: 0, unit: 'units', unitPrice: 1180, totalPrice: 5900 },
    ],
    totalAmount: 5900,
    status: 'Sent',
    createdDate: '2024-01-22',
    sentDate: '2024-01-23',
    expectedDelivery: '2024-02-02',
    deliveryAddress: 'IT Department, Building B',
    paymentTerms: 'Net 15',
    amendments: [],
  },
  {
    id: '3',
    poNumber: 'PO-2024-003',
    rfqNumber: 'RFQ-2024-005',
    vendor: {
      id: 'v8',
      name: 'Office Pro',
      email: 'orders@officepro.com',
      phone: '+1 555-0789',
      address: '789 Business Park, Commerce City, CC 11223',
    },
    items: [
      { id: '1', name: 'Office Desk', quantity: 10, receivedQty: 0, unit: 'units', unitPrice: 250, totalPrice: 2500 },
      { id: '2', name: 'Office Chair', quantity: 15, receivedQty: 0, unit: 'units', unitPrice: 180, totalPrice: 2700 },
    ],
    totalAmount: 5200,
    status: 'Draft',
    createdDate: '2024-01-24',
    expectedDelivery: '2024-02-10',
    deliveryAddress: 'Admin Building, Floor 3',
    paymentTerms: 'Net 30',
    amendments: [],
  },
  {
    id: '4',
    poNumber: 'PO-2024-004',
    rfqNumber: 'RFQ-2024-002',
    vendor: {
      id: 'v4',
      name: 'Lab Essentials Inc',
      email: 'orders@labessentials.com',
      phone: '+1 555-0321',
      address: '321 Science Blvd, Research Park, RP 44556',
    },
    items: [
      { id: '1', name: 'Microscope Slides', quantity: 1000, receivedQty: 1000, unit: 'pcs', unitPrice: 0.08, totalPrice: 80 },
      { id: '2', name: 'Test Tubes', quantity: 500, receivedQty: 500, unit: 'pcs', unitPrice: 0.22, totalPrice: 110 },
    ],
    totalAmount: 190,
    status: 'Received',
    createdDate: '2024-01-15',
    sentDate: '2024-01-16',
    expectedDelivery: '2024-01-23',
    deliveryAddress: 'Laboratory, Building C',
    paymentTerms: 'Net 45',
    amendments: [],
  },
  {
    id: '5',
    poNumber: 'PO-2024-005',
    rfqNumber: 'RFQ-2024-003',
    vendor: {
      id: 'v9',
      name: 'CleanTech Supplies',
      email: 'sales@cleantech.com',
      phone: '+1 555-0654',
      address: '654 Industrial Way, Cleanville, CV 77889',
    },
    items: [
      { id: '1', name: 'Disinfectant (Gallon)', quantity: 20, receivedQty: 20, unit: 'gallons', unitPrice: 22, totalPrice: 440 },
      { id: '2', name: 'Mops', quantity: 15, receivedQty: 15, unit: 'pcs', unitPrice: 10, totalPrice: 150 },
    ],
    totalAmount: 590,
    status: 'Closed',
    createdDate: '2024-01-10',
    sentDate: '2024-01-11',
    expectedDelivery: '2024-01-18',
    deliveryAddress: 'Housekeeping Dept, Basement',
    paymentTerms: 'Net 30',
    amendments: [],
  },
];

const statusConfig: Record<POStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  Draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Edit className="w-3 h-3" /> },
  Sent: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Send className="w-3 h-3" /> },
  Partial: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Package className="w-3 h-3" /> },
  Received: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  Closed: { color: 'text-purple-600', bg: 'bg-purple-100', icon: <CheckCircle className="w-3 h-3" /> },
};

export default function PurchaseOrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatus | 'All'>('All');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAmendModal, setShowAmendModal] = useState(false);

  const filteredPOs = useMemo(() => {
    return mockPurchaseOrders.filter((po) => {
      const matchesSearch =
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendor.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    return mockPurchaseOrders.reduce(
      (acc, po) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, []);

  const getDeliveryProgress = (po: PurchaseOrder) => {
    const totalQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
    const receivedQty = po.items.reduce((sum, item) => sum + item.receivedQty, 0);
    return Math.round((receivedQty / totalQty) * 100);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
              <p className="text-sm text-gray-500">Manage and track purchase orders</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create PO
          </button>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {(['Draft', 'Sent', 'Partial', 'Received', 'Closed'] as POStatus[]).map((status) => (
            <div
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                statusFilter === status ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`p-1 rounded ${statusConfig[status].bg}`}>
                  {statusConfig[status].icon}
                </span>
                <span className="text-sm text-gray-600">{status}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 mt-1">{statusCounts[status] || 0}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search PO number or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-2 text-sm rounded-lg ${
              statusFilter === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Show All
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PO List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredPOs.map((po) => {
              const progress = getDeliveryProgress(po);
              const isOverdue = new Date(po.expectedDelivery) < new Date() && po.status !== 'Received' && po.status !== 'Closed';
              
              return (
                <div
                  key={po.id}
                  onClick={() => setSelectedPO(po)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedPO?.id === po.id ? 'ring-2 ring-blue-500 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-blue-600">{po.poNumber}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[po.status].bg} ${statusConfig[po.status].color}`}
                        >
                          {statusConfig[po.status].icon}
                          {po.status}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            <AlertCircle className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                        {po.amendments.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                            <RefreshCw className="w-3 h-3" />
                            Amended
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{po.vendor.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {po.rfqNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {po.items.length} items
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Due: {po.expectedDelivery}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                        <DollarSign className="w-4 h-4" />
                        {po.totalAmount.toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-500">{po.paymentTerms}</p>
                    </div>
                  </div>

                  {/* Delivery Progress */}
                  {(po.status === 'Partial' || po.status === 'Sent') && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Delivery Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedPO && (
          <div className="w-[420px] border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">PO Details</h2>
              <button onClick={() => setSelectedPO(null)} className="p-1 hover:bg-gray-200 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">PO Number</p>
                  <p className="font-mono font-bold text-lg text-blue-600">{selectedPO.poNumber}</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 border rounded-lg hover:bg-gray-50">
                    <Printer className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="p-2 border rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Vendor Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Vendor</p>
                <p className="font-medium text-gray-900">{selectedPO.vendor.name}</p>
                <p className="text-sm text-gray-500">{selectedPO.vendor.email}</p>
                <p className="text-sm text-gray-500">{selectedPO.vendor.phone}</p>
                <p className="text-sm text-gray-500 mt-1">{selectedPO.vendor.address}</p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Created</p>
                  <p className="text-sm">{selectedPO.createdDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sent</p>
                  <p className="text-sm">{selectedPO.sentDate || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected Delivery</p>
                  <p className="text-sm font-medium">{selectedPO.expectedDelivery}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment Terms</p>
                  <p className="text-sm">{selectedPO.paymentTerms}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Item</th>
                        <th className="text-right px-3 py-2 font-medium">Qty</th>
                        <th className="text-right px-3 py-2 font-medium">Rcvd</th>
                        <th className="text-right px-3 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={item.receivedQty === item.quantity ? 'text-green-600' : item.receivedQty > 0 ? 'text-yellow-600' : 'text-gray-400'}>
                              {item.receivedQty}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">${item.totalPrice.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-medium">
                      <tr className="border-t">
                        <td className="px-3 py-2" colSpan={3}>Total</td>
                        <td className="px-3 py-2 text-right">${selectedPO.totalAmount.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Delivery Address</p>
                <p className="text-sm text-gray-700">{selectedPO.deliveryAddress}</p>
              </div>

              {/* Amendments */}
              {selectedPO.amendments.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Amendments</p>
                  <div className="space-y-2">
                    {selectedPO.amendments.map((amendment, idx) => (
                      <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-sm">
                        <p className="text-gray-900">{amendment.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{amendment.date} by {amendment.by}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedPO.status === 'Draft' && (
                  <>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      <Send className="w-4 h-4" />
                      Send to Vendor
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Edit className="w-4 h-4" />
                      Edit PO
                    </button>
                  </>
                )}
                {(selectedPO.status === 'Sent' || selectedPO.status === 'Partial') && (
                  <>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      <Package className="w-4 h-4" />
                      Record Delivery
                    </button>
                    <button
                      onClick={() => setShowAmendModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Amend PO
                    </button>
                  </>
                )}
                {selectedPO.status === 'Received' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    <CheckCircle className="w-4 h-4" />
                    Close PO
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Truck className="w-4 h-4" />
                  Track Delivery
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Purchase Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Approved Quotation</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option>Select a quotation</option>
                  <option>RFQ-2024-001 - MedSupply Co - $2,235</option>
                  <option>RFQ-2024-004 - Computer World - $5,900</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Net 15</option>
                    <option>Net 30</option>
                    <option>Net 45</option>
                    <option>Net 60</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Enter delivery address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Any special delivery or handling instructions"
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
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Send className="w-4 h-4" />
                Create & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amend Modal */}
      {showAmendModal && selectedPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Amend Purchase Order</h2>
              <p className="text-sm text-gray-500">{selectedPO.poNumber}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amendment Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option>Quantity Change</option>
                  <option>Delivery Date Change</option>
                  <option>Delivery Address Change</option>
                  <option>Price Adjustment</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                  placeholder="Describe the amendment..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowAmendModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                <RefreshCw className="w-4 h-4" />
                Submit Amendment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}