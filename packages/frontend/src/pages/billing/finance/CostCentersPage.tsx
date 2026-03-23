import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFacilityId } from '../../../lib/facility';
import api from '../../../services/api';
import {
  Plus,
  Search,
  Edit2,
  XCircle,
  X,
  Loader2,
  Building2,
  Hash,
  CheckCircle,
  Layers,
} from 'lucide-react';

interface CostCenter {
  id: string;
  name: string;
  code: string;
  description: string | null;
  facilityId: string;
  facilityName?: string;
  isActive: boolean;
  createdAt: string;
}

interface CostCenterPayload {
  name: string;
  code: string;
  description?: string;
  facilityId: string;
}

export default function CostCentersPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CostCenter | null>(null);

  const { data: costCenters = [], isLoading } = useQuery<CostCenter[]>({
    queryKey: ['cost-centers', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/cost-centers', { params: { facilityId } });
      const data = response.data?.data || response.data || [];
      return (Array.isArray(data) ? data : []).map((cc: any) => ({
        ...cc,
        facilityName: cc.facilityName || cc.facility?.name || '',
      }));
    },
    enabled: !!facilityId,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CostCenterPayload) => {
      const response = await api.post('/finance/cost-centers', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers', facilityId] });
      toast.success('Cost center created successfully');
      closeModal();
    },
    onError: () => toast.error('Failed to create cost center'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CostCenterPayload> }) => {
      const response = await api.patch(`/finance/cost-centers/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers', facilityId] });
      toast.success('Cost center updated successfully');
      closeModal();
    },
    onError: () => toast.error('Failed to update cost center'),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.patch(`/finance/cost-centers/${id}`, { isActive: false });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers', facilityId] });
      toast.success('Cost center deactivated');
    },
    onError: () => toast.error('Failed to deactivate cost center'),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload: CostCenterPayload = {
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      description: (formData.get('description') as string) || undefined,
      facilityId,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = costCenters.filter((cc) => {
    const matchesSearch =
      !searchQuery ||
      cc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cc.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && cc.isActive) ||
      (statusFilter === 'inactive' && !cc.isActive);
    return matchesSearch && matchesStatus;
  });

  const activeCount = costCenters.filter((c) => c.isActive).length;
  const inactiveCount = costCenters.filter((c) => !c.isActive).length;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cost Centers</h1>
            <p className="text-sm text-gray-500 mt-1">Manage cost centers for expense allocation and tracking</p>
          </div>
          <button
            onClick={() => { setEditingItem(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Cost Center
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg p-3 border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Layers className="w-4 h-4" />
              Total
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{costCenters.length}</p>
          </div>
          <div className="rounded-lg p-3 border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              Active
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{activeCount}</p>
          </div>
          <div className="rounded-lg p-3 border border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <XCircle className="w-4 h-4" />
              Inactive
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{inactiveCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="grid grid-cols-6 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <div>Code</div>
            <div>Name</div>
            <div>Description</div>
            <div>Facility</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
              <p>Loading cost centers...</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((cc) => (
              <div key={cc.id} className="grid grid-cols-6 py-3 px-4 border-b hover:bg-gray-50 items-center text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-gray-400" />
                  <span className="font-mono text-gray-700">{cc.code}</span>
                </div>
                <div className="font-medium text-gray-900">{cc.name}</div>
                <div className="text-gray-500 truncate">{cc.description || '—'}</div>
                <div className="flex items-center gap-1 text-gray-600">
                  <Building2 className="w-3 h-3" />
                  {cc.facilityName || '—'}
                </div>
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {cc.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => { setEditingItem(cc); setShowModal(true); }}
                    className="p-1.5 hover:bg-gray-200 rounded text-gray-500"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {cc.isActive && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Deactivate "${cc.name}"?`)) {
                          deactivateMutation.mutate(cc.id);
                        }
                      }}
                      disabled={deactivateMutation.isPending}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500"
                      title="Deactivate"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No cost centers found</p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {editingItem ? 'Edit Cost Center' : 'Add Cost Center'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                    <input
                      type="text"
                      name="code"
                      defaultValue={editingItem?.code}
                      required
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., CC-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingItem?.name}
                      required
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Cost center name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    name="description"
                    defaultValue={editingItem?.description || ''}
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional description"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
