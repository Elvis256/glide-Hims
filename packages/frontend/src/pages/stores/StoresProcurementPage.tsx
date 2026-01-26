import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Filter,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  Building2,
  Calendar,
  DollarSign,
  Eye,
  MoreVertical,
  Send,
  AlertCircle,
} from 'lucide-react';

interface Requisition {
  id: string;
  requisitionNo: string;
  department: string;
  requestedBy: string;
  date: string;
  items: number;
  estimatedCost: number;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'rejected';
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  requisitionNo: string;
  orderDate: string;
  expectedDelivery: string;
  items: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'partial';
}

const mockRequisitions: Requisition[] = [
  { id: '1', requisitionNo: 'REQ-2025-0234', department: 'Main Store', requestedBy: 'John Kamau', date: '2025-01-23', items: 8, estimatedCost: 125000, status: 'pending', priority: 'high' },
  { id: '2', requisitionNo: 'REQ-2025-0233', department: 'Surgical Store', requestedBy: 'Grace Akinyi', date: '2025-01-22', items: 5, estimatedCost: 85000, status: 'approved', priority: 'normal' },
  { id: '3', requisitionNo: 'REQ-2025-0232', department: 'Lab Store', requestedBy: 'Peter Ochieng', date: '2025-01-22', items: 12, estimatedCost: 210000, status: 'ordered', priority: 'urgent' },
  { id: '4', requisitionNo: 'REQ-2025-0231', department: 'Pharmacy Store', requestedBy: 'Faith Njeri', date: '2025-01-21', items: 6, estimatedCost: 45000, status: 'draft', priority: 'low' },
  { id: '5', requisitionNo: 'REQ-2025-0230', department: 'Main Store', requestedBy: 'David Kiprop', date: '2025-01-20', items: 10, estimatedCost: 175000, status: 'received', priority: 'normal' },
];

const mockPurchaseOrders: PurchaseOrder[] = [
  { id: '1', poNumber: 'PO-2025-0156', supplier: 'Medex Supplies Ltd', requisitionNo: 'REQ-2025-0232', orderDate: '2025-01-22', expectedDelivery: '2025-01-29', items: 12, totalAmount: 205000, status: 'shipped' },
  { id: '2', poNumber: 'PO-2025-0155', supplier: 'Kenya Medical Store', requisitionNo: 'REQ-2025-0230', orderDate: '2025-01-21', expectedDelivery: '2025-01-25', items: 10, totalAmount: 168000, status: 'delivered' },
  { id: '3', poNumber: 'PO-2025-0154', supplier: 'Surgical Instruments EA', requisitionNo: 'REQ-2025-0228', orderDate: '2025-01-20', expectedDelivery: '2025-01-27', items: 8, totalAmount: 320000, status: 'confirmed' },
  { id: '4', poNumber: 'PO-2025-0153', supplier: 'Lab Equipment Africa', requisitionNo: 'REQ-2025-0225', orderDate: '2025-01-19', expectedDelivery: '2025-02-02', items: 4, totalAmount: 540000, status: 'pending' },
];

export default function StoresProcurementPage() {
  const [activeTab, setActiveTab] = useState<'requisitions' | 'orders'>('requisitions');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRequisitions = useMemo(() => {
    return mockRequisitions.filter((req) => {
      const matchesSearch = 
        req.requisitionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const filteredOrders = useMemo(() => {
    return mockPurchaseOrders.filter((order) => {
      const matchesSearch = 
        order.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const getReqStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      ordered: 'bg-purple-100 text-purple-700',
      received: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full capitalize ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-gray-100 text-gray-600',
      normal: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      urgent: 'bg-red-100 text-red-600',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full capitalize ${styles[priority]}`}>
        {priority}
      </span>
    );
  };

  const getOrderStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
      confirmed: { bg: 'bg-blue-100 text-blue-700', icon: <CheckCircle className="w-3 h-3" /> },
      shipped: { bg: 'bg-purple-100 text-purple-700', icon: <Truck className="w-3 h-3" /> },
      delivered: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      partial: { bg: 'bg-orange-100 text-orange-700', icon: <AlertCircle className="w-3 h-3" /> },
    };
    const { bg, icon } = config[status] || config.pending;
    return (
      <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full capitalize ${bg}`}>
        {icon}
        {status}
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procurement</h1>
          <p className="text-gray-600">Manage purchase requisitions and orders</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          New Requisition
        </button>
      </div>

      {/* Summary Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Requisitions</p>
              <p className="text-2xl font-bold text-yellow-600">3</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <FileText className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Orders</p>
              <p className="text-2xl font-bold text-blue-600">4</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Expected Deliveries</p>
              <p className="text-2xl font-bold text-purple-600">2</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">MTD Spend (KES)</p>
              <p className="text-2xl font-bold text-green-600">1.2M</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => { setActiveTab('requisitions'); setStatusFilter('all'); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'requisitions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Requisitions
        </button>
        <button
          onClick={() => { setActiveTab('orders'); setStatusFilter('all'); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'orders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4 inline mr-2" />
          Purchase Orders
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'requisitions' ? 'Search requisitions...' : 'Search orders...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          {activeTab === 'requisitions' ? (
            <>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
            </>
          ) : (
            <>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </>
          )}
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          {activeTab === 'requisitions' ? (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Requisition No</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Requested By</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Est. Cost</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Priority</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRequisitions.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600">{req.requisitionNo}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span>{req.department}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.requestedBy}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {req.date}
                      </div>
                    </td>
                    <td className="px-4 py-3">{req.items}</td>
                    <td className="px-4 py-3 font-medium">KES {req.estimatedCost.toLocaleString()}</td>
                    <td className="px-4 py-3">{getPriorityBadge(req.priority)}</td>
                    <td className="px-4 py-3">{getReqStatusBadge(req.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {req.status === 'pending' && (
                          <button className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                            Approve
                          </button>
                        )}
                        {req.status === 'approved' && (
                          <button className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1">
                            <Send className="w-3 h-3" />
                            Create PO
                          </button>
                        )}
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">PO Number</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Supplier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Requisition</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Order Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Expected</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600">{order.poNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span>{order.supplier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500">{order.requisitionNo}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{order.orderDate}</td>
                    <td className="px-4 py-3 text-gray-600">{order.expectedDelivery}</td>
                    <td className="px-4 py-3">{order.items}</td>
                    <td className="px-4 py-3 font-medium">KES {order.totalAmount.toLocaleString()}</td>
                    <td className="px-4 py-3">{getOrderStatusBadge(order.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {order.status === 'shipped' && (
                          <button className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                            Receive
                          </button>
                        )}
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {activeTab === 'requisitions' ? filteredRequisitions.length : filteredOrders.length} items
        </div>
      </div>
    </div>
  );
}