import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  RotateCcw,
  Package,
  Building2,
  FileText,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Filter,
  Download,
  Send,
  Eye,
  ChevronRight,
  Truck,
  CreditCard,
  Loader2,
  X,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import supplierReturnsService from '../../../services/supplier-returns';
import type { SupplierReturn, SupplierReturnStats, ReturnStatus, ReturnReason } from '../../../services/supplier-returns';
import { useFacilityId } from '../../../lib/facility';
import { getApiErrorMessage } from '../../../services/api';

const reasonLabels: Record<ReturnReason, string> = {
  expired: 'Expired',
  near_expiry: 'Near Expiry',
  damaged: 'Damaged',
  recalled: 'Recalled',
  overstock: 'Overstock',
  quality_issue: 'Quality Issue',
};

const statusConfig: Record<ReturnStatus, { label: string; color: string; icon: any }> = {
  pending: { label: 'Pending', color: 'bg-purple-100 text-purple-700', icon: Send },
  authorized: { label: 'Authorized', color: 'bg-cyan-100 text-cyan-700', icon: CheckCircle2 },
  shipped: { label: 'Shipped', color: 'bg-amber-100 text-amber-700', icon: Truck },
  received_by_supplier: { label: 'Received', color: 'bg-blue-100 text-blue-700', icon: Package },
  credit_issued: { label: 'Credit Issued', color: 'bg-green-100 text-green-700', icon: CreditCard },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const defaultStats: SupplierReturnStats = {
  total: 0,
  pending: 0,
  authorized: 0,
  shipped: 0,
  completed: 0,
  totalValue: 0,
};

export default function ReturnToSupplierPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('inventory.read')) {
    return <AccessDenied />;
  }

  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<SupplierReturn | null>(null);
  const [createForm, setCreateForm] = useState({
    supplierId: '',
    reason: 'expired' as ReturnReason,
    notes: '',
    items: [{ itemId: '', batchNumber: '', expiryDate: '', quantity: 1, unitValue: 0, notes: '' }],
  });

  // Fetch supplier returns list
  const { data: returnsData = [], isLoading } = useQuery({
    queryKey: ['supplier-returns', facilityId, selectedStatus !== 'all' ? selectedStatus : undefined],
    queryFn: () =>
      supplierReturnsService.list({
        facilityId,
        status: selectedStatus !== 'all' ? (selectedStatus as ReturnStatus) : undefined,
      }),
    staleTime: 30000,
  });

  // Fetch stats from backend
  const { data: stats = defaultStats } = useQuery({
    queryKey: ['supplier-returns-stats', facilityId],
    queryFn: () => supplierReturnsService.getStats(facilityId),
    staleTime: 30000,
  });

  // Create return mutation
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof supplierReturnsService.create>[0]) =>
      supplierReturnsService.create(data),
    onSuccess: () => {
      toast.success('Return request created successfully');
      queryClient.invalidateQueries({ queryKey: ['supplier-returns'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-returns-stats'] });
      setShowCreateModal(false);
      setCreateForm({
        supplierId: '',
        reason: 'expired',
        notes: '',
        items: [{ itemId: '', batchNumber: '', expiryDate: '', quantity: 1, unitValue: 0, notes: '' }],
      });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to create return request'));
    },
  });

  // Update status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReturnStatus }) =>
      supplierReturnsService.updateStatus(id, status),
    onSuccess: (_data, variables) => {
      toast.success(`Return ${statusConfig[variables.status]?.label?.toLowerCase() || 'updated'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['supplier-returns'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-returns-stats'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update return status'));
    },
  });

  // Get unique suppliers from returns
  const suppliers = useMemo(() => {
    const names = returnsData
      .map((r) => r.supplier?.name)
      .filter(Boolean) as string[];
    return [...new Set(names)];
  }, [returnsData]);

  // Filter returns based on selected filters
  const filteredItems = useMemo(() => {
    return returnsData.filter((item) => {
      const matchesSupplier =
        selectedSupplier === 'all' || item.supplier?.name === selectedSupplier;
      return matchesSupplier;
    });
  }, [selectedSupplier, returnsData]);

  // Compute total items value for a return
  const getReturnValue = (ret: SupplierReturn) => {
    if (ret.actualCredit != null) return ret.actualCredit;
    return (ret.items || []).reduce((sum, item) => sum + (item.unitValue || 0) * item.quantity, 0);
  };

  // Compute total item quantity for a return
  const getTotalQty = (ret: SupplierReturn) => {
    return (ret.items || []).reduce((sum, item) => sum + item.quantity, 0);
  };

  // Days until an expiry date (from earliest item in return)
  const getDaysToExpiry = (ret: SupplierReturn) => {
    const dates = (ret.items || [])
      .map((i) => i.expiryDate)
      .filter(Boolean)
      .map((d) => new Date(d!).getTime());
    if (dates.length === 0) return null;
    const earliest = Math.min(...dates);
    return Math.ceil((earliest - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const handleCreateSubmit = () => {
    if (!createForm.supplierId) {
      toast.error('Please enter a Supplier ID');
      return;
    }
    const validItems = createForm.items.filter((i) => i.itemId && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item with a valid ID and quantity');
      return;
    }
    createMutation.mutate({
      supplierId: createForm.supplierId,
      facilityId,
      reason: createForm.reason,
      notes: createForm.notes || undefined,
      items: validItems.map((i) => ({
        itemId: i.itemId,
        batchNumber: i.batchNumber || undefined,
        expiryDate: i.expiryDate || undefined,
        quantity: i.quantity,
        unitValue: i.unitValue || undefined,
        notes: i.notes || undefined,
      })),
    });
  };

  const addItemRow = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: '', batchNumber: '', expiryDate: '', quantity: 1, unitValue: 0, notes: '' }],
    }));
  };

  const removeItemRow = (index: number) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItemRow = (index: number, field: string, value: any) => {
    setCreateForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-blue-500" />
            Return to Supplier
          </h1>
          <p className="text-gray-600 mt-1">Manage medication returns and track credits</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Return Request
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-xl font-bold text-gray-900">${(stats.totalValue || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Returns</p>
              <p className="text-xl font-bold text-amber-600">{stats.pending + stats.authorized + stats.shipped}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-xl font-bold text-green-600">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Returns</p>
              <p className="text-xl font-bold text-red-600">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Supplier:</span>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Suppliers</option>
            {suppliers.map((supplier) => (
              <option key={supplier} value={supplier}>{supplier}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="authorized">Authorized</option>
            <option value="shipped">Shipped</option>
            <option value="received_by_supplier">Received</option>
            <option value="credit_issued">Credit Issued</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Return #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Reason</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Items</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Credit Note</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <Loader2 className="w-12 h-12 mb-3 text-blue-500 animate-spin" />
                      <p className="text-sm font-medium">Loading returnable items...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <RotateCcw className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-sm font-medium">No returnable items</p>
                      <p className="text-xs text-gray-400 mt-1">Items eligible for return will appear here</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {filteredItems.map((item) => {
                const itemStatusConfig = statusConfig[item.status] || statusConfig.pending;
                const StatusIcon = itemStatusConfig.icon;
                const value = getReturnValue(item);
                const qty = getTotalQty(item);
                const daysToExpiry = getDaysToExpiry(item);
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 font-mono">{item.returnNumber}</p>
                        {daysToExpiry != null && (
                          <p className={`text-xs ${daysToExpiry <= 30 ? 'text-red-600' : 'text-gray-500'}`}>
                            {daysToExpiry > 0 ? `${daysToExpiry}d to expiry` : 'Expired'}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{item.supplier?.name || item.supplierId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-700">{reasonLabels[item.reason] || item.reason}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{qty}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">${value.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${itemStatusConfig.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {itemStatusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.creditNoteNumber ? (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-green-500" />
                          <div>
                            <p className="text-sm text-green-600 font-mono">{item.creditNoteNumber}</p>
                            {item.actualCredit != null && (
                              <p className="text-xs text-gray-500">${item.actualCredit.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      ) : item.authorizationNumber ? (
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-blue-600 font-mono">{item.authorizationNumber}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {item.status === 'pending' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: item.id, status: 'authorized' })}
                            disabled={statusMutation.isPending}
                            className="px-2 py-1 text-xs bg-cyan-50 text-cyan-700 rounded hover:bg-cyan-100 transition-colors disabled:opacity-50"
                          >
                            Authorize
                          </button>
                        )}
                        {item.status === 'authorized' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: item.id, status: 'shipped' })}
                            disabled={statusMutation.isPending}
                            className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            Mark Shipped
                          </button>
                        )}
                        {item.status === 'shipped' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: item.id, status: 'completed' })}
                            disabled={statusMutation.isPending}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => setShowDetailModal(item)}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Return Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Create Return Request</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
                  <input
                    type="text"
                    value={createForm.supplierId}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, supplierId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter supplier ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select
                    value={createForm.reason}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, reason: e.target.value as ReturnReason }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {Object.entries(reasonLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Optional notes..."
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Items</label>
                  <button
                    onClick={addItemRow}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {createForm.items.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Item ID</label>
                          <input
                            type="text"
                            value={item.itemId}
                            onChange={(e) => updateItemRow(index, 'itemId', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            placeholder="Item ID"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Batch #</label>
                          <input
                            type="text"
                            value={item.batchNumber}
                            onChange={(e) => updateItemRow(index, 'batchNumber', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                            placeholder="Batch number"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Expiry Date</label>
                          <input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) => updateItemRow(index, 'expiryDate', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Unit Value</label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitValue}
                            onChange={(e) => updateItemRow(index, 'unitValue', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div className="flex items-end">
                          {createForm.items.length > 1 && (
                            <button
                              onClick={() => removeItemRow(index)}
                              className="px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubmit}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Return Details</h2>
              <button onClick={() => setShowDetailModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Return Number</p>
                  <p className="font-medium font-mono">{showDetailModal.returnNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${(statusConfig[showDetailModal.status] || statusConfig.pending).color}`}>
                    {(statusConfig[showDetailModal.status] || statusConfig.pending).label}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500">Supplier</p>
                  <p className="font-medium">{showDetailModal.supplier?.name || showDetailModal.supplierId}</p>
                </div>
                <div>
                  <p className="text-gray-500">Reason</p>
                  <p className="font-medium">{reasonLabels[showDetailModal.reason] || showDetailModal.reason}</p>
                </div>
                {showDetailModal.authorizationNumber && (
                  <div>
                    <p className="text-gray-500">Authorization #</p>
                    <p className="font-medium font-mono">{showDetailModal.authorizationNumber}</p>
                  </div>
                )}
                {showDetailModal.creditNoteNumber && (
                  <div>
                    <p className="text-gray-500">Credit Note</p>
                    <p className="font-medium font-mono">{showDetailModal.creditNoteNumber}</p>
                  </div>
                )}
                {showDetailModal.actualCredit != null && (
                  <div>
                    <p className="text-gray-500">Credit Amount</p>
                    <p className="font-medium text-green-600">${showDetailModal.actualCredit.toFixed(2)}</p>
                  </div>
                )}
                {showDetailModal.shippingDate && (
                  <div>
                    <p className="text-gray-500">Shipping Date</p>
                    <p className="font-medium">{new Date(showDetailModal.shippingDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              {showDetailModal.notes && (
                <div className="text-sm">
                  <p className="text-gray-500">Notes</p>
                  <p className="mt-1 text-gray-700">{showDetailModal.notes}</p>
                </div>
              )}
              {showDetailModal.items && showDetailModal.items.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Items ({showDetailModal.items.length})</p>
                  <div className="space-y-2">
                    {showDetailModal.items.map((itm, idx) => (
                      <div key={itm.id || idx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div>
                          <p className="font-medium">{itm.item?.name || itm.itemId}</p>
                          {itm.batchNumber && <p className="text-xs text-gray-500 font-mono">{itm.batchNumber}</p>}
                        </div>
                        <div className="text-right">
                          <p>Qty: {itm.quantity}</p>
                          {itm.unitValue != null && (
                            <p className="text-xs text-gray-500">${(itm.unitValue * itm.quantity).toFixed(2)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              {showDetailModal.status === 'pending' && (
                <button
                  onClick={() => {
                    statusMutation.mutate({ id: showDetailModal.id, status: 'authorized' });
                    setShowDetailModal(null);
                  }}
                  className="px-4 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
                >
                  Authorize
                </button>
              )}
              {showDetailModal.status === 'authorized' && (
                <button
                  onClick={() => {
                    statusMutation.mutate({ id: showDetailModal.id, status: 'shipped' });
                    setShowDetailModal(null);
                  }}
                  className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Mark Shipped
                </button>
              )}
              {showDetailModal.status === 'shipped' && (
                <button
                  onClick={() => {
                    statusMutation.mutate({ id: showDetailModal.id, status: 'completed' });
                    setShowDetailModal(null);
                  }}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Complete
                </button>
              )}
              <button
                onClick={() => setShowDetailModal(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
