import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  Tag,
  X,
  Loader2,
  Percent,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';

interface PricingTier {
  id: string;
  name: string;
  discountPercent: number;
  minOrderAmount: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface TierFormData {
  name: string;
  discountPercent: string;
  minOrderAmount: string;
  description: string;
}

const emptyForm: TierFormData = {
  name: '',
  discountPercent: '',
  minOrderAmount: '',
  description: '',
};

export default function PricingTiersPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [form, setForm] = useState<TierFormData>(emptyForm);

  const { data: tiersData, isLoading } = useQuery({
    queryKey: ['wholesale-tiers', facilityId],
    queryFn: async () => {
      const res = await api.get('/pos/wholesale/tiers');
      return res.data;
    },
  });

  const tiers = asList<PricingTier>(tiersData);

  // Create tier
  const createMutation = useMutation({
    mutationFn: async (data: TierFormData) => {
      const res = await api.post('/pos/wholesale/tiers', {
        name: data.name,
        discountPercent: parseFloat(data.discountPercent) || 0,
        minOrderAmount: parseFloat(data.minOrderAmount) || 0,
        description: data.description || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-tiers'] });
      closeModal();
      toast.success('Tier created successfully');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create tier')),
  });

  // Update tier
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TierFormData }) => {
      const res = await api.put(`/pos/wholesale/tiers/${id}`, {
        name: data.name,
        discountPercent: parseFloat(data.discountPercent) || 0,
        minOrderAmount: parseFloat(data.minOrderAmount) || 0,
        description: data.description || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-tiers'] });
      closeModal();
      toast.success('Tier updated successfully');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update tier')),
  });

  // Delete tier
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pos/wholesale/tiers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-tiers'] });
      toast.success('Tier deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to delete tier')),
  });

  const openAddModal = () => {
    setEditingTier(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (tier: PricingTier) => {
    setEditingTier(tier);
    setForm({
      name: tier.name,
      discountPercent: String(tier.discountPercent),
      minOrderAmount: String(tier.minOrderAmount),
      description: tier.description || '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTier(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast.error('Tier name is required');
      return;
    }
    if (editingTier) {
      updateMutation.mutate({ id: editingTier.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleDelete = (tier: PricingTier) => {
    if (window.confirm(`Delete tier "${tier.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(tier.id);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Tiers</h1>
          <p className="text-sm text-gray-500">Manage wholesale pricing tiers and discounts</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Tier
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Tag className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium">No pricing tiers</p>
            <p className="text-sm">Create tiers to offer wholesale discounts</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3 text-right">Discount %</th>
                  <th className="px-6 py-3 text-right">Min Order Amount</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{tier.name}</td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-blue-600">
                        <Percent className="h-3.5 w-3.5" />
                        {tier.discountPercent}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">{tier.minOrderAmount}</td>
                    <td className="px-6 py-3 text-gray-600">{tier.description || '—'}</td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          tier.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {tier.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(tier)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tier)}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTier ? 'Edit Tier' : 'Add Tier'}
              </h2>
              <button onClick={closeModal} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="e.g. Premium, VIP"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Discount Percentage
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.discountPercent}
                    onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Minimum Order Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingTier ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
