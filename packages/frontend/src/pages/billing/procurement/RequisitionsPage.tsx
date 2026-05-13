import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';
import { CatalogItemPicker, type SelectedItem } from '../../../components/catalog';
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
  Package,
  Loader2,
} from 'lucide-react';
import { asList } from '../../../utils/unwrapResponse';
import { CategoryContextBanner, useProcurementCategory } from '../../../components/procurement/CategoryContextBanner';
import SearchableSelect from '../../../components/SearchableSelect';
import { ApprovalChainPreview } from '../../../components/procurement/ApprovalChainPreview';
import { ApprovalChainTimeline } from '../../../components/procurement/ApprovalChainTimeline';
import { formatCurrency } from '../../../lib/currency';

type RequisitionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'partially_ordered'
  | 'fully_ordered'
  | 'completed'
  | 'cancelled';
type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent';

interface RequisitionItem {
  id: string;
  itemId: string;
  itemCode: string;
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
  justification?: string;
  totalAmount: number;
  totalEstimated?: number;
  requestDate?: string;
  createdAt?: string;
  // Joined relations from backend
  requestedBy?: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string };
  department?: { id: string; name: string } | string;
  // Extended fields for UI display
  title?: string;
  requester?: string;
  submittedDate?: string;
  approvedDate?: string;
  approvalStage?: string;
}

interface RequisitionFormData {
  justification: string;
  departmentId: string;
  priority: RequisitionPriority;
  items: RequisitionItem[];
  notes: string;
}

const emptyFormData: RequisitionFormData = {
  justification: '',
  departmentId: '',
  priority: 'normal',
  items: [{ id: '1', itemId: '', itemCode: '', name: '', quantity: 0, unit: 'pcs', estimatedPrice: 0 }],
  notes: '',
};

const statusConfig: Record<RequisitionStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Edit className="w-3 h-3" />, label: 'Draft' },
  pending_approval: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Clock className="w-3 h-3" />, label: 'Pending Approval' },
  approved: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
  rejected: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
  partially_ordered: { color: 'text-amber-700', bg: 'bg-amber-100', icon: <Clock className="w-3 h-3" />, label: 'Partially Ordered' },
  fully_ordered: { color: 'text-indigo-700', bg: 'bg-indigo-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Fully Ordered' },
  completed: { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
  cancelled: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
};

const priorityConfig: Record<RequisitionPriority, { color: string; bg: string; label: string }> = {
  low: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Low' },
  normal: { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Normal' },
  high: { color: 'text-orange-600', bg: 'bg-orange-100', label: 'High' },
  urgent: { color: 'text-red-600', bg: 'bg-red-100', label: 'Urgent' },
};

export default function RequisitionsPage() {
  const { category: __procCategory } = useProcurementCategory();
  const catalogModule: 'pharmacy' | 'general' | 'all' = __procCategory === 'drugs' ? 'pharmacy' : __procCategory === 'supplies' ? 'general' : 'all';

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'all'>('all');
  const [selectedRequisition, setSelectedRequisition] = useState<PurchaseRequest | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RequisitionFormData>(emptyFormData);

  const facilityId = useFacilityId();

  // Fetch departments for the create modal
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get('/departments');
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return list as Array<{ id: string; name: string; code?: string }>;
    },
  });

  // Helpers to humanize joined fields
  const requesterName = (req: PurchaseRequest): string => {
    const u = req.requestedBy;
    if (u) return u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '—';
    return req.requester || '—';
  };
  const departmentName = (req: PurchaseRequest): string => {
    if (typeof req.department === 'object' && req.department) return req.department.name || '—';
    if (typeof req.department === 'string' && req.department) return req.department;
    return '—';
  };
  const formatDate = (s?: string) => {
    if (!s) return '—';
    try {
      return new Date(s).toLocaleDateString();
    } catch {
      return s;
    }
  };
  const totalOf = (req: PurchaseRequest) => Number(req.totalAmount ?? req.totalEstimated ?? 0);


  // Fetch purchase requests
  const { data: requisitions = [], isLoading, error } = useQuery({
    queryKey: ['purchase-requests', facilityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facilityId) params.set('facilityId', facilityId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await api.get(`/procurement/purchase-requests?${params}`);
      return (asList(response.data)) as PurchaseRequest[];
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: RequisitionFormData & { submit?: boolean }) => {
      const payload = {
        facilityId,
        departmentId: data.departmentId || undefined,
        priority: data.priority,
        justification: data.justification || undefined,
        notes: data.notes,
        items: data.items
          .filter((item) => item.name && item.quantity > 0)
          .map((item) => ({
            itemId: item.itemId || item.name,
            itemCode: item.itemCode || item.name,
            itemName: item.name,
            itemUnit: item.unit,
            quantityRequested: item.quantity,
            unitPriceEstimated: item.estimatedPrice,
          })),
      };
      return api.post('/procurement/purchase-requests', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      setShowCreateModal(false);
      setEditingId(null);
      setFormData(emptyFormData);
    },
  });

  // Update mutation (edit a draft requisition)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RequisitionFormData }) => {
      const payload = {
        departmentId: data.departmentId || undefined,
        priority: data.priority,
        justification: data.justification || undefined,
        notes: data.notes,
        items: data.items
          .filter((item) => item.name && item.quantity > 0)
          .map((item) => ({
            itemId: item.itemId || item.name,
            itemCode: item.itemCode || item.name,
            itemName: item.name,
            itemUnit: item.unit,
            quantityRequested: item.quantity,
            unitPriceEstimated: item.estimatedPrice,
          })),
      };
      return api.put(`/procurement/purchase-requests/${id}`, payload);
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-request', vars.id] });
      setShowCreateModal(false);
      setEditingId(null);
      setFormData(emptyFormData);
    },
  });

  // Full requisition detail (used by View Full Details and Edit)
  const detailId = viewingId || editingId;
  const { data: requisitionDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['purchase-request', detailId],
    queryFn: async () => {
      const { data } = await api.get(`/procurement/purchase-requests/${detailId}`);
      return (data?.data ?? data) as PurchaseRequest;
    },
    enabled: !!detailId,
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
      items: [...prev.items, { id: String(prev.items.length + 1), itemId: '', itemCode: '', name: '', quantity: 0, unit: 'pcs', estimatedPrice: 0 }],
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
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate({ ...formData, submit: false });
    }
  };

  const handleSubmitForApproval = () => {
    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data: formData },
        {
          onSuccess: () => {
            submitMutation.mutate(editingId);
          },
        },
      );
    } else {
      createMutation.mutate({ ...formData, submit: true });
    }
  };

  const startEdit = (req: PurchaseRequest) => {
    setEditingId(req.id);
    setViewingId(null);
    setShowCreateModal(true);
  };

  // Hydrate form when full detail is loaded for editing
  useEffect(() => {
    if (editingId && requisitionDetail && requisitionDetail.id === editingId) {
      const deptId =
        typeof requisitionDetail.department === 'object' && requisitionDetail.department
          ? requisitionDetail.department.id
          : (requisitionDetail.departmentId || '');
      setFormData({
        justification: requisitionDetail.justification || '',
        departmentId: deptId,
        priority: requisitionDetail.priority || 'normal',
        notes: requisitionDetail.notes || '',
        items:
          (requisitionDetail.items || []).length > 0
            ? requisitionDetail.items.map((it: any, idx: number) => ({
                id: String(idx + 1),
                itemId: it.itemId || '',
                itemCode: it.itemCode || '',
                name: it.itemName || it.name || '',
                quantity: Number(it.quantityRequested ?? it.quantity ?? 0),
                unit: it.itemUnit || it.unit || 'pcs',
                estimatedPrice: Number(it.unitPriceEstimated ?? it.estimatedPrice ?? 0),
              }))
            : emptyFormData.items,
      });
    }
  }, [editingId, requisitionDetail]);

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const term = searchTerm.toLowerCase();
      if (!term) return true;
      return (
        req.requestNumber.toLowerCase().includes(term) ||
        (req.justification || '').toLowerCase().includes(term) ||
        departmentName(req).toLowerCase().includes(term) ||
        requesterName(req).toLowerCase().includes(term)
      );
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
        <CategoryContextBanner />
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
            onClick={() => {
              setEditingId(null);
              setFormData(emptyFormData);
              setShowCreateModal(true);
            }}
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
              {(['all', 'draft', 'pending_approval', 'approved', 'partially_ordered', 'fully_ordered', 'completed', 'rejected'] as const).map((status) => (
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
                onClick={() => {
                  setEditingId(null);
                  setFormData(emptyFormData);
                  setShowCreateModal(true);
                }}
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
                    <h3 className="font-medium text-gray-900 mb-1">
                      {req.justification || `Requisition ${req.requestNumber}`}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {departmentName(req)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {requesterName(req)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(req.requestDate || req.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        {req.items?.length || 0} items
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900 tabular-nums">
                      {formatCurrency(totalOf(req))}
                    </div>
                    <p className="text-xs text-gray-500">Estimated Cost</p>
                  </div>
                </div>
                {req.approvalStage && req.status === 'pending_approval' && (
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
              {selectedRequisition.justification && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Justification</p>
                  <p className="text-sm">{selectedRequisition.justification}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Department</p>
                  <p className="text-sm">{departmentName(selectedRequisition)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Requester</p>
                  <p className="text-sm">{requesterName(selectedRequisition)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Date</p>
                  <p className="text-sm">{formatDate(selectedRequisition.requestDate || selectedRequisition.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Priority</p>
                  <p className="text-sm capitalize">{selectedRequisition.priority}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                {(selectedRequisition.items || []).length === 0 ? (
                  <p className="text-sm italic text-gray-400">No items added.</p>
                ) : (
                  <div className="space-y-2">
                    {(selectedRequisition.items || []).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                        <span>{item.name}</span>
                        <span className="text-gray-600 tabular-nums">
                          {item.quantity} {item.unit} × {formatCurrency(item.estimatedPrice || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between mt-2 pt-2 border-t font-medium">
                  <span>Total Estimated</span>
                  <span className="tabular-nums">{formatCurrency(totalOf(selectedRequisition))}</span>
                </div>
              </div>

              {/* Approval Workflow — real chain from policy resolver */}
              {selectedRequisition.status !== 'draft' && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Approval Workflow</p>
                  <ApprovalChainTimeline documentId={selectedRequisition.id} documentType="PR" />
                </div>
              )}

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
                    <button
                      onClick={() => startEdit(selectedRequisition)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Requisition
                    </button>
                  </>
                )}
                {selectedRequisition.status === 'pending_approval' && (
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
                <button
                  onClick={() => setViewingId(selectedRequisition.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
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
              <h2 className="text-lg font-semibold">
                {editingId
                  ? `Edit Requisition${requisitionDetail?.requestNumber ? ` · ${requisitionDetail.requestNumber}` : ''}`
                  : 'Create New Requisition'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingId(null);
                  setFormData(emptyFormData);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Justification / Reason</label>
                <input
                  type="text"
                  value={formData.justification}
                  onChange={(e) => setFormData((prev) => ({ ...prev, justification: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Restock lab reagents for August"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <SearchableSelect
                    value={formData.departmentId}
                    onChange={(v) => setFormData((prev) => ({ ...prev, departmentId: v }))}
                    options={(departments as Array<{ id: string; name: string; code?: string }>).map((d) => ({
                      value: d.id,
                      label: d.name,
                      prefix: d.code,
                    }))}
                    placeholder="Search department..."
                  />
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
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="text-left px-3 py-2">Qty</th>
                        <th className="text-left px-3 py-2">Unit</th>
                        <th className="text-left px-3 py-2">Est. Price</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2 min-w-[200px]">
                            <CatalogItemPicker
                              module={catalogModule}
                              value={item.name ? { id: item.itemId || null, source: item.itemId ? 'inventory' : 'free_text', code: item.itemCode, name: item.name, unit: item.unit } : null}
                              onChange={(picked) => {
                                if (!picked) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    items: prev.items.map((i) =>
                                      i.id === item.id
                                        ? { ...i, itemId: '', itemCode: '', name: '', estimatedPrice: 0 }
                                        : i,
                                    ),
                                  }));
                                  return;
                                }
                                setFormData((prev) => {
                                  // If the picked item is already on another row, bump that row's qty
                                  // and remove the current empty/duplicate row.
                                  const dupKey = picked.id || picked.name;
                                  const existing = prev.items.find(
                                    (i) =>
                                      i.id !== item.id &&
                                      ((picked.id && i.itemId === picked.id) ||
                                        (!picked.id && i.name && i.name.toLowerCase() === picked.name.toLowerCase())),
                                  );
                                  if (existing) {
                                    const incoming = Math.max(item.quantity || 0, 1);
                                    return {
                                      ...prev,
                                      items: prev.items
                                        .filter((i) => i.id !== item.id)
                                        .map((i) =>
                                          i.id === existing.id
                                            ? { ...i, quantity: (i.quantity || 0) + incoming }
                                            : i,
                                        ),
                                    };
                                  }
                                  return {
                                    ...prev,
                                    items: prev.items.map((i) =>
                                      i.id === item.id
                                        ? {
                                            ...i,
                                            itemId: picked.id || '',
                                            itemCode: picked.code || '',
                                            name: picked.name || '',
                                            unit: picked.unit || i.unit,
                                            quantity: i.quantity > 0 ? i.quantity : 1,
                                            estimatedPrice:
                                              picked.lastPrice ?? picked.sellingPrice ?? i.estimatedPrice,
                                          }
                                        : i,
                                    ),
                                  };
                                  void dupKey;
                                });
                              }}
                              placeholder="Search items…"
                              allowFreeText
                              size="sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))}
                              onFocus={(e) => e.currentTarget.select()}
                              className="w-20 px-2 py-1 border rounded tabular-nums"
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
                              min={0}
                              step="0.01"
                              value={item.estimatedPrice || ''}
                              onChange={(e) => handleItemChange(item.id, 'estimatedPrice', Number(e.target.value))}
                              onFocus={(e) => e.currentTarget.select()}
                              className="w-24 px-2 py-1 border rounded tabular-nums"
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
              <ApprovalChainPreview
                documentType="PR"
                amount={formData.items.reduce(
                  (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.estimatedPrice) || 0),
                  0,
                )}
                facilityId={facilityId}
                departmentId={formData.departmentId}
              />
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingId(null);
                  setFormData(emptyFormData);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsDraft}
                disabled={createMutation.isPending || updateMutation.isPending || (editingId ? detailLoading : false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Save Changes' : 'Save as Draft'}
              </button>
              <button
                onClick={handleSubmitForApproval}
                disabled={createMutation.isPending || updateMutation.isPending || submitMutation.isPending || (editingId ? detailLoading : false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending || submitMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Save & Submit for Approval' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Full Details Modal */}
      {viewingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Requisition {requisitionDetail?.requestNumber || ''}
                </h2>
                {requisitionDetail && (
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${statusConfig[requisitionDetail.status].bg} ${statusConfig[requisitionDetail.status].color}`}
                    >
                      {statusConfig[requisitionDetail.status].icon}
                      {statusConfig[requisitionDetail.status].label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig[requisitionDetail.priority].bg} ${priorityConfig[requisitionDetail.priority].color}`}
                    >
                      {priorityConfig[requisitionDetail.priority].label}
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setViewingId(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              {detailLoading || !requisitionDetail ? (
                <div className="flex items-center justify-center py-10 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading details…
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Department</p>
                      <p className="font-medium flex items-center gap-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {departmentName(requisitionDetail)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Requester</p>
                      <p className="font-medium flex items-center gap-1">
                        <User className="w-4 h-4 text-gray-400" />
                        {requesterName(requisitionDetail)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Request Date</p>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(requisitionDetail.requestDate || requisitionDetail.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Required By</p>
                      <p className="font-medium">
                        {formatDate((requisitionDetail as any).requiredDate)}
                      </p>
                    </div>
                  </div>

                  {requisitionDetail.justification && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Justification</p>
                      <p className="text-sm whitespace-pre-wrap">{requisitionDetail.justification}</p>
                    </div>
                  )}

                  {requisitionDetail.notes && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{requisitionDetail.notes}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold mb-2">
                      Items ({(requisitionDetail.items || []).length})
                    </p>
                    {(requisitionDetail.items || []).length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No items added.</p>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="text-left px-3 py-2">Code</th>
                              <th className="text-left px-3 py-2">Item</th>
                              <th className="text-right px-3 py-2">Qty</th>
                              <th className="text-left px-3 py-2">Unit</th>
                              <th className="text-right px-3 py-2">Est. Price</th>
                              <th className="text-right px-3 py-2">Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(requisitionDetail.items as any[]).map((it: any, idx: number) => {
                              const qty = Number(it.quantityRequested ?? it.quantity ?? 0);
                              const price = Number(it.unitPriceEstimated ?? it.estimatedPrice ?? 0);
                              return (
                                <tr key={it.id || idx} className="border-t">
                                  <td className="px-3 py-2 font-mono text-xs">{it.itemCode || '—'}</td>
                                  <td className="px-3 py-2">{it.itemName || it.name}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{qty}</td>
                                  <td className="px-3 py-2">{it.itemUnit || it.unit || '—'}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(price)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(qty * price)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t font-semibold">
                              <td className="px-3 py-2" colSpan={5}>Total Estimated</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatCurrency(totalOf(requisitionDetail))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              {requisitionDetail?.status === 'draft' && (
                <button
                  onClick={() => {
                    if (requisitionDetail) startEdit(requisitionDetail);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              <button
                onClick={() => setViewingId(null)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
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
