import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
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
  Send,
  AlertCircle,
  Loader2,
  Plus,
  Receipt,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { procurementService } from '../../services/procurement';
import { useFacilityId } from '../../lib/facility';

export default function StoresProcurementPage() {
  const facilityId = useFacilityId();
  const [activeTab, setActiveTab] = useState<'requisitions' | 'orders'>('requisitions');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: requisitions = [], isLoading: reqLoading } = useQuery({
    queryKey: ['purchase-requests', facilityId],
    queryFn: () => procurementService.purchaseRequests.list({ facilityId }),
    staleTime: 30000,
  });

  const { data: purchaseOrders = [], isLoading: poLoading } = useQuery({
    queryKey: ['purchase-orders', facilityId],
    queryFn: () => procurementService.purchaseOrders.list({ facilityId }),
    staleTime: 30000,
  });

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchesSearch = 
        req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.requestedBy?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.supplier?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter, purchaseOrders]);

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
        <div className="flex items-center gap-2">
          <Link to="/billing/procurement/purchase-orders" className="flex items-center gap-2 px-3 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
            <Receipt className="w-4 h-4" />
            Finance POs
          </Link>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            New Requisition
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Requisitions</p>
              <p className="text-2xl font-bold text-yellow-600">{requisitions.filter(r => r.status === 'pending').length}</p>
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
              <p className="text-2xl font-bold text-blue-600">{purchaseOrders.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Delivery</p>
              <p className="text-2xl font-bold text-purple-600">{purchaseOrders.filter(o => o.status === 'sent').length}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total PO Value</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(purchaseOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0))}</p>
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
            reqLoading ? (
              <div className="flex items-center justify-center h-full py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Requisition No</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Requested By</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Priority</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRequisitions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium">No requisitions found</p>
                      <p className="text-sm">Create a new requisition to get started</p>
                    </td>
                  </tr>
                ) : (
                  filteredRequisitions.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-blue-600">{req.requestNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{req.requestedBy?.fullName || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar className="w-3 h-3" />
                          {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">{req.items.length}</td>
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
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )
          ) : (
            poLoading ? (
              <div className="flex items-center justify-center h-full py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">PO Number</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Supplier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Order Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Expected</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium">No purchase orders found</p>
                      <p className="text-sm">Create a PO from an approved requisition</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-blue-600">{order.orderNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span>{order.supplier?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-gray-600">{order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3">{order.items.length}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-4 py-3">{getOrderStatusBadge(order.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          {order.status === 'sent' && (
                            <button className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                              Receive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )
          )}
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {activeTab === 'requisitions' ? filteredRequisitions.length : filteredOrders.length} items
        </div>
      </div>
    </div>
  );
}