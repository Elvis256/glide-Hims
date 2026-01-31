import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  User,
  Building2,
  Calendar,
  DollarSign,
  Package,
  Loader2,
} from 'lucide-react';

type RequisitionStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled';
type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent';

interface RequisitionItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
}

interface PurchaseRequest {
  id: string;
  requestNumber: string;
  status: RequisitionStatus;
  priority: RequisitionPriority;
  requestedById: string;
  departmentId: string;
  items: RequisitionItem[];
  notes?: string;
  totalAmount: number;
  requestDate: string;
  // Extended fields for UI display
  title?: string;
  department?: string;
  requester?: string;
  submittedDate?: string;
  approvedDate?: string;
  approvalStage?: string;
}

interface RequisitionFormData {
  title: string;
  departmentId: string;
  priority: RequisitionPriority;
  items: RequisitionItem[];
  notes: string;
}

const emptyFormData: RequisitionFormData = {
  title: '',
  departmentId: '',
  priority: 'normal',
  items: [{ id: '1', name: '', quantity: 0, unit: 'pcs', estimatedPrice: 0 }],
  notes: '',
};

const statusConfig: Record<RequisitionStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Edit className="w-3 h-3" />, label: 'Draft' },
  submitted: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Clock className="w-3 h-3" />, label: 'Submitted' },
  approved: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
  rejected: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
  cancelled: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
};

const priorityConfig: Record<RequisitionPriority, { color: string; bg: string; label: string }> = {
  low: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Low' },
  normal: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Normal' },
  high: { color: 'text-orange-600', bg: 'bg-orange-100', label: 'High' },
  urgent: { color: 'text-red-600', bg: 'bg-red-100', label: 'Urgent' },
};

export default function RequisitionsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'all'>('all');
  const [selectedRequisition, setSelectedRequisition] = useState<PurchaseRequest | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<RequisitionFormData>(emptyFormData);

  // Get facilityId from localStorage
  const facilityId = localStorage.getItem('facilityId') || '';

  // Fetch purchase requests
  const { data: requisitions = [], isLoading, error } = useQuery({
    queryKey: ['purchase-requests', facilityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facilityId) params.set('facilityId', facilityId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await api.get(`/procurement/purchase-requests?${params}`);
      return (response.data?.data || response.data || []) as PurchaseRequest[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: RequisitionFormData & { submit?: boolean }) =>
      api.post('/procurement/purchase-requests', { ...data, facilityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setShowCreateModal(false);
      setFormData(emptyFormData);
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (id: string) => api.put(`/procurement/purchase-requests/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setSelectedRequisition(null);
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/procurement/purchase-requests/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setSelectedRequisition(null);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.put(`/procurement/purchase-requests/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setSelectedRequisition(null);
    },
  });

  // Form handlers
  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { id: String(prev.items.length + 1), name: '', quantity: 0, unit: 'pcs', estimatedPrice: 0 }],
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleItemChange = (itemId: string, field: keyof RequisitionItem, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSaveAsDraft = () => {
    createMutation.mutate({ ...formData, submit: false });
  };

  const handleSubmitForApproval = () => {
    createMutation.mutate({ ...formData, submit: true });
  };

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchesSearch =
        req.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.department || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [requisitions, searchTerm]);

  const statusCounts = useMemo(() => {
    return requisitions.reduce(
      (acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [requisitions]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-gray-500">Loading requisitions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-red-600">
          <XCircle className="w-8 h-8" />
          <p>Failed to load requisitions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Purchase Requisitions</h1>
              <p className="text-sm text-gray-500">Manage and track purchase requests</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Requisition
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requisitions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {(['all', 'draft', 'submitted', 'approved', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'All' : statusConfig[status].label}
                  {status !== 'all' && statusCounts[status] && (
                    <span className="ml-1.5 text-xs">({statusCounts[status]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Requisition List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredRequisitions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileText className="w-16 h-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Requisitions</h3>
              <p className="text-sm text-gray-500 mb-4">Get started by creating a new requisition</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" />
                New Requisition
              </button>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredRequisitions.map((req) => (
              <div
                key={req.id}
                onClick={() => setSelectedRequisition(req)}
                className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedRequisition?.id === req.id ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-gray-500">{req.requestNumber}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[req.status].bg} ${statusConfig[req.status].color}`}
                      >
                        {statusConfig[req.status].icon}
                        {statusConfig[req.status].label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig[req.priority].bg} ${priorityConfig[req.priority].color}`}
                      >
                        {priorityConfig[req.priority].label}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">{req.title || req.requestNumber}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {req.department || req.departmentId}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {req.requester || req.requestedById}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {req.requestDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        {req.items?.length || 0} items
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-lg font-semibold text-gray-900">
                      <DollarSign className="w-4 h-4" />
                      {(req.totalAmount || 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-500">Estimated Cost</p>
                  </div>
                </div>
                {req.approvalStage && req.status === 'submitted' && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-600">Current Stage:</span>
                      <span className="font-medium text-blue-600">{req.approvalStage}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedRequisition && (
          <div className="w-96 border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Requisition Details</h2>
                <button
                  onClick={() => setSelectedRequisition(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Requisition Number</p>
                <p className="font-mono font-medium">{selectedRequisition.requestNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Title</p>
                <p className="font-medium">{selectedRequisition.title || selectedRequisition.requestNumber}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Department</p>
                  <p className="text-sm">{selectedRequisition.department || selectedRequisition.departmentId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Requester</p>
                  <p className="text-sm">{selectedRequisition.requester || selectedRequisition.requestedById}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-2">
                  {(selectedRequisition.items || []).map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                      <span>{item.name}</span>
                      <span className="text-gray-600">
                        {item.quantity} {item.unit} × ${item.estimatedPrice}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t font-medium">
                  <span>Total Estimated</span>
                  <span>${(selectedRequisition.totalAmount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Approval Workflow */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Approval Workflow</p>
                <div className="space-y-2">
                  {['Submitted', 'Manager Review', 'Finance Review', 'Director Approval', 'Completed'].map(
                    (stage, idx) => {
                      const isCompleted =
                        selectedRequisition.status === 'approved' ||
                        (selectedRequisition.approvalStage &&
                          ['Submitted', 'Manager Review', 'Finance Review', 'Director Approval', 'Completed'].indexOf(
                            selectedRequisition.approvalStage
                          ) > idx);
                      const isCurrent = selectedRequisition.approvalStage === stage;
                      return (
                        <div key={stage} className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? 'bg-green-100 text-green-600'
                                : isCurrent
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <span className="text-xs">{idx + 1}</span>
                            )}
                          </div>
                          <span
                            className={`text-sm ${isCurrent ? 'font-medium text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}
                          >
                            {stage}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedRequisition.status === 'draft' && (
                  <>
                    <button
                      onClick={() => submitMutation.mutate(selectedRequisition.id)}
                      disabled={submitMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Submit for Approval
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Edit className="w-4 h-4" />
                      Edit Requisition
                    </button>
                  </>
                )}
                {selectedRequisition.status === 'submitted' && (
                  <>
                    <button
                      onClick={() => approveMutation.mutate(selectedRequisition.id)}
                      disabled={approveMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(selectedRequisition.id)}
                      disabled={rejectMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </>
                )}
                {selectedRequisition.status === 'approved' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <ArrowRight className="w-4 h-4" />
                    Convert to RFQ
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create New Requisition</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter requisition title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select department</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="laboratory">Laboratory</option>
                    <option value="administration">Administration</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value as RequisitionPriority }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Item Name</th>
                        <th className="text-left px-3 py-2">Qty</th>
                        <th className="text-left px-3 py-2">Unit</th>
                        <th className="text-left px-3 py-2">Est. Price</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                              placeholder="Item name"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))}
                              className="w-16 px-2 py-1 border rounded"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                              className="w-16 px-2 py-1 border rounded"
                              placeholder="pcs"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.estimatedPrice || ''}
                              onChange={(e) => handleItemChange(item.id, 'estimatedPrice', Number(e.target.value))}
                              className="w-20 px-2 py-1 border rounded"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="mt-2 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Additional notes or justification"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData(emptyFormData);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsDraft}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save as Draft
              </button>
              <button
                onClick={handleSubmitForApproval}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
