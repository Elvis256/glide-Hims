import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Search,
  RotateCcw,
  User,
  Package,
  Trash2,
  DollarSign,
  AlertTriangle,
  Pill,
  Filter,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Loader2,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { storesService } from '../../services/stores';
import type { StockMovement, StockAdjustmentDto, Drug } from '../../services/stores';
import { formatCurrency } from '../../lib/currency';

type ReturnReason = 'Wrong medication' | 'Adverse reaction' | 'Expired' | 'Damaged' | 'Other';
type ReturnStatus = 'Pending' | 'Approved' | 'Rejected' | 'Processed';
type ReturnAction = 'Return to Stock' | 'Dispose';

interface ReturnItem {
  id: string;
  returnNumber: string;
  patientName: string;
  patientId: string;
  medication: string;
  quantity: number;
  batchNumber: string;
  reason: ReturnReason;
  status: ReturnStatus;
  action: ReturnAction;
  refundAmount: number;
  returnDate: string;
  processedBy: string | null;
  notes: string;
}

const reasons: ReturnReason[] = ['Wrong medication', 'Adverse reaction', 'Expired', 'Damaged', 'Other'];

export default function ReturnsPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.returns')) {
    return <AccessDenied />;
  }

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ReturnStatus | 'All'>('All');
  const [selectedReason, setSelectedReason] = useState<ReturnReason | 'All'>('All');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<ReturnItem | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [newReturn, setNewReturn] = useState({
    itemId: '',
    itemName: '',
    patientName: '',
    quantity: 0,
    reason: 'Other' as ReturnReason,
    action: 'Return to Stock' as ReturnAction,
    notes: '',
  });

  // Search items for the new return modal
  const { data: searchedItems = [] } = useQuery({
    queryKey: ['items-search-ret', itemSearch],
    queryFn: () => storesService.items.search(itemSearch, undefined, 20),
    enabled: itemSearch.length > 1,
  });

  // Fetch stock movements for returns tracking
  const { data: movementsData, isLoading } = useQuery({
    queryKey: ['stock-returns'],
    queryFn: () => storesService.movements.list(),
  });

  // Create return (adjustment) mutation
  const createReturnMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: StockAdjustmentDto }) =>
      storesService.movements.adjust(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-returns'] });
      setShowNewModal(false);
      setNewReturn({ itemId: '', itemName: '', patientName: '', quantity: 0, reason: 'Other', action: 'Return to Stock', notes: '' });
      setItemSearch('');
      toast.success('Return processed successfully');
    },
    onError: () => toast.error('Failed to process return'),
  });

  const handleSubmitReturn = useCallback(() => {
    if (!newReturn.itemId || newReturn.quantity <= 0) return;
    createReturnMutation.mutate({
      itemId: newReturn.itemId,
      data: {
        quantity: newReturn.action === 'Return to Stock' ? newReturn.quantity : -newReturn.quantity,
        type: newReturn.action === 'Return to Stock' ? 'in' : 'adjustment',
        reason: `Return: ${newReturn.reason} - Patient: ${newReturn.patientName || 'Unknown'}${newReturn.notes ? ' - ' + newReturn.notes : ''}`,
      },
    });
  }, [newReturn, createReturnMutation]);

  // Transform movements to returns (movements with 'in' type could be returns)
  const returns: ReturnItem[] = useMemo(() => {
    if (!movementsData) return [];
    return movementsData
      .filter((m: StockMovement) => m.type === 'in' || m.reason?.toLowerCase().includes('return'))
      .map((m: StockMovement) => ({
        id: m.id,
        returnNumber: `RET-${m.id.slice(0, 6).toUpperCase()}`,
        patientName: m.performedBy || 'Unknown',
        patientId: '',
        medication: m.itemId,
        quantity: Math.abs(m.quantity),
        batchNumber: m.reference || '',
        reason: 'Other' as ReturnReason,
        status: 'Processed' as ReturnStatus,
        action: m.type === 'in' ? 'Return to Stock' as ReturnAction : 'Dispose' as ReturnAction,
        refundAmount: 0,
        returnDate: new Date(m.createdAt).toLocaleDateString(),
        processedBy: m.performedBy,
        notes: m.reason || '',
      }));
  }, [movementsData]);

  const filteredReturns = useMemo(() => {
    return returns.filter((item) => {
      const matchesSearch =
        item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.returnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.medication.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;
      const matchesReason = selectedReason === 'All' || item.reason === selectedReason;
      return matchesSearch && matchesStatus && matchesReason;
    });
  }, [searchTerm, selectedStatus, selectedReason, returns]);

  const returnStats = useMemo(() => ({
    total: returns.length,
    pending: returns.filter((r) => r.status === 'Pending').length,
    totalRefunds: returns.filter((r) => r.status === 'Processed').reduce((acc, r) => acc + r.refundAmount, 0),
    returnedToStock: returns.filter((r) => r.action === 'Return to Stock' && r.status === 'Processed').length,
    disposed: returns.filter((r) => r.action === 'Dispose' && r.status === 'Processed').length,
  }), [returns]);

  const getStatusIcon = (status: ReturnStatus) => {
    switch (status) {
      case 'Pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'Approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'Processed':
        return <Package className="w-4 h-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: ReturnStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Processed':
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getReasonColor = (reason: ReturnReason) => {
    switch (reason) {
      case 'Wrong medication':
        return 'bg-purple-100 text-purple-800';
      case 'Adverse reaction':
        return 'bg-red-100 text-red-800';
      case 'Expired':
        return 'bg-orange-100 text-orange-800';
      case 'Damaged':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Returns</h1>
          <p className="text-gray-600">Process customer returns and refunds</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/pharmacy/expiry/return" className="flex items-center gap-2 px-3 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
            <ArrowUpRight className="w-4 h-4" />
            Return to Supplier
          </Link>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Return
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <RotateCcw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Returns</p>
              <p className="text-2xl font-bold text-gray-900">{returnStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{returnStats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Refunds</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(returnStats.totalRefunds)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Restocked</p>
              <p className="text-2xl font-bold text-purple-600">{returnStats.returnedToStock}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Disposed</p>
              <p className="text-2xl font-bold text-red-600">{returnStats.disposed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, return number, or medication..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ReturnStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Processed">Processed</option>
            </select>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as ReturnReason | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Reasons</option>
              {reasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Return #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Medication</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Refund</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <Loader2 className="w-12 h-12 mb-4 text-gray-300 animate-spin" />
                      <p className="text-lg font-medium">Loading returns...</p>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && filteredReturns.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <RotateCcw className="w-12 h-12 mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No returns found</p>
                      <p className="text-sm">Returns will appear here when processed</p>
                    </div>
                  </td>
                </tr>
              )}
              {filteredReturns.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-blue-600">{item.returnNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.patientName}</p>
                        <p className="text-sm text-gray-500">{item.patientId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-900">{item.medication}</p>
                        <p className="text-xs text-gray-500">{item.batchNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{item.quantity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReasonColor(item.reason)}`}>
                      {item.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.action === 'Return to Stock' ? (
                        <Package className="w-4 h-4 text-green-600" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm text-gray-700">{item.action}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${item.refundAmount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      {formatCurrency(item.refundAmount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.returnDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => toast.success(`Return ${item.returnNumber} approved`)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => toast.error(`Return ${item.returnNumber} rejected`)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {item.status === 'Approved' && (
                        <button
                          onClick={() => toast.success(`Return ${item.returnNumber} processed`)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Process
                        </button>
                      )}
                      <button
                        onClick={() => setShowDetailModal(item)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <FileText className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Return Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Process New Return</h3>
              <button onClick={() => setShowNewModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Patient Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                <input
                  type="text"
                  value={newReturn.patientName}
                  onChange={(e) => setNewReturn({ ...newReturn, patientName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Patient name"
                />
              </div>
              {/* Item Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medication</label>
                {newReturn.itemId ? (
                  <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">{newReturn.itemName}</span>
                    </div>
                    <button onClick={() => setNewReturn({ ...newReturn, itemId: '', itemName: '' })} className="text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Search medications..."
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {searchedItems.length > 0 && itemSearch.length > 1 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-auto">
                        {searchedItems.map((item: Drug) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setNewReturn({ ...newReturn, itemId: item.id, itemName: item.name });
                              setItemSearch('');
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                          >
                            <span className="font-medium">{item.name}</span>
                            {item.strength && <span className="text-gray-500 ml-1">{item.strength}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={newReturn.quantity || ''}
                  onChange={(e) => setNewReturn({ ...newReturn, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Quantity returned"
                />
              </div>
              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={newReturn.reason}
                  onChange={(e) => setNewReturn({ ...newReturn, reason: e.target.value as ReturnReason })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {reasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <div className="flex gap-2">
                  {(['Return to Stock', 'Dispose'] as ReturnAction[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setNewReturn({ ...newReturn, action: a })}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        newReturn.action === a
                          ? a === 'Return to Stock' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {a === 'Return to Stock' ? <Package className="w-4 h-4 inline mr-1" /> : <Trash2 className="w-4 h-4 inline mr-1" />}
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newReturn.notes}
                  onChange={(e) => setNewReturn({ ...newReturn, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowNewModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSubmitReturn}
                disabled={!newReturn.itemId || newReturn.quantity <= 0 || createReturnMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {createReturnMutation.isPending ? 'Processing...' : 'Process Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Return Details</h3>
              <button onClick={() => setShowDetailModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Return #</p>
                  <p className="font-mono font-medium text-blue-600">{showDetailModal.returnNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(showDetailModal.status)}`}>
                    {showDetailModal.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Patient</p>
                  <p className="font-medium">{showDetailModal.patientName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Medication</p>
                  <p className="font-medium">{showDetailModal.medication}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Quantity</p>
                  <p className="font-medium">{showDetailModal.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Reason</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReasonColor(showDetailModal.reason)}`}>
                    {showDetailModal.reason}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Action</p>
                  <p className="font-medium">{showDetailModal.action}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Refund</p>
                  <p className="font-medium">{formatCurrency(showDetailModal.refundAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">{showDetailModal.returnDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Processed By</p>
                  <p className="font-medium">{showDetailModal.processedBy || '—'}</p>
                </div>
              </div>
              {showDetailModal.notes && (
                <div>
                  <p className="text-xs text-gray-500">Notes</p>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded">{showDetailModal.notes}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t">
              <button onClick={() => setShowDetailModal(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
