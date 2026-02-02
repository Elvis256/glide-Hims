import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  Download,
  Loader2,
  Building2,
  Calendar,
  DollarSign,
  Wrench,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  X,
  Save,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { FixedAsset } from '../../services/assets';

const categories = [
  { value: 'medical_equipment', label: 'Medical Equipment' },
  { value: 'laboratory_equipment', label: 'Laboratory Equipment' },
  { value: 'imaging_equipment', label: 'Imaging Equipment' },
  { value: 'surgical_equipment', label: 'Surgical Equipment' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'it_equipment', label: 'IT Equipment' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'buildings', label: 'Buildings' },
  { value: 'office_equipment', label: 'Office Equipment' },
  { value: 'electrical_equipment', label: 'Electrical Equipment' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'other', label: 'Other' },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  under_maintenance: 'bg-yellow-100 text-yellow-800',
  disposed: 'bg-gray-100 text-gray-800',
  written_off: 'bg-red-100 text-red-800',
  transferred: 'bg-blue-100 text-blue-800',
  damaged: 'bg-orange-100 text-orange-800',
};

const conditionColors: Record<string, string> = {
  excellent: 'text-green-600',
  good: 'text-blue-600',
  fair: 'text-yellow-600',
  poor: 'text-orange-600',
  non_functional: 'text-red-600',
};

const depreciationMethods = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'double_declining', label: 'Double Declining' },
];

export default function AssetRegisterPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<FixedAsset | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', facilityId, categoryFilter, statusFilter, searchTerm],
    queryFn: () => assetsService.list(facilityId, { 
      category: categoryFilter || undefined,
      status: statusFilter || undefined,
      search: searchTerm || undefined,
    }),
    enabled: !!facilityId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<FixedAsset>) => assetsService.create({ ...data, facilityId }),
    onSuccess: () => {
      toast.success('Asset created successfully');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowModal(false);
      setEditingAsset(null);
    },
    onError: () => toast.error('Failed to create asset'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FixedAsset> }) => assetsService.update(id, data),
    onSuccess: () => {
      toast.success('Asset updated successfully');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowModal(false);
      setEditingAsset(null);
    },
    onError: () => toast.error('Failed to update asset'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assetsService.delete(id),
    onSuccess: () => {
      toast.success('Asset deleted');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: () => toast.error('Failed to delete asset'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Partial<FixedAsset> = {
      assetCode: formData.get('assetCode') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      serialNumber: formData.get('serialNumber') as string,
      model: formData.get('model') as string,
      manufacturer: formData.get('manufacturer') as string,
      acquisitionDate: formData.get('acquisitionDate') as string,
      acquisitionCost: Number(formData.get('acquisitionCost')),
      installationCost: Number(formData.get('installationCost') || 0),
      salvageValue: Number(formData.get('salvageValue') || 0),
      usefulLifeMonths: Number(formData.get('usefulLifeMonths')),
      depreciationMethod: formData.get('depreciationMethod') as string,
      depreciationStartDate: formData.get('depreciationStartDate') as string,
      location: formData.get('location') as string,
      condition: formData.get('condition') as string,
      notes: formData.get('notes') as string,
    };

    if (editingAsset) {
      updateMutation.mutate({ id: editingAsset.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const exportCSV = () => {
    const headers = ['Asset Code', 'Name', 'Category', 'Serial Number', 'Acquisition Date', 'Cost', 'Book Value', 'Status', 'Location'];
    const rows = assets.map(a => [
      a.assetCode,
      a.name,
      a.category,
      a.serialNumber || '',
      a.acquisitionDate,
      a.totalCost,
      a.bookValue,
      a.status,
      a.location || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asset-register-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  // Calculate summary stats
  const stats = {
    totalAssets: assets.length,
    totalCost: assets.reduce((sum, a) => sum + Number(a.totalCost || 0), 0),
    totalBookValue: assets.reduce((sum, a) => sum + Number(a.bookValue || 0), 0),
    activeAssets: assets.filter(a => a.status === 'active').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Package className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Asset Register</h1>
            <p className="text-sm text-gray-500">Manage fixed assets and equipment</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => { setEditingAsset(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Asset
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalAssets}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Active Assets</p>
          <p className="text-2xl font-bold text-green-600">{stats.activeAssets}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalCost)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Net Book Value</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(stats.totalBookValue)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, code, or serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="under_maintenance">Under Maintenance</option>
            <option value="disposed">Disposed</option>
            <option value="written_off">Written Off</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial/Model</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Book Value</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No assets found. Click "Add Asset" to create one.
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{asset.name}</div>
                    <div className="text-xs text-gray-500">{asset.assetCode}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                    {asset.category.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{asset.serialNumber || '-'}</div>
                    <div className="text-xs text-gray-500">{asset.model || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {formatCurrency(asset.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-indigo-600">
                    {formatCurrency(asset.bookValue)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[asset.status] || 'bg-gray-100'}`}>
                      {asset.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {asset.location || '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setViewingAsset(asset)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => { setEditingAsset(asset); setShowModal(true); }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this asset?')) {
                            deleteMutation.mutate(asset.id);
                          }
                        }}
                        className="p-1 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingAsset ? 'Edit Asset' : 'Add New Asset'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingAsset(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Code *</label>
                  <input
                    type="text"
                    name="assetCode"
                    defaultValue={editingAsset?.assetCode}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="AST-001"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name *</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingAsset?.name}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="X-Ray Machine"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    name="category"
                    defaultValue={editingAsset?.category}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {categories.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select
                    name="condition"
                    defaultValue={editingAsset?.condition || 'good'}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="non_functional">Non-Functional</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input type="text" name="serialNumber" defaultValue={editingAsset?.serialNumber} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input type="text" name="model" defaultValue={editingAsset?.model} className="w-full px-3 py-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                  <input type="text" name="manufacturer" defaultValue={editingAsset?.manufacturer} className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Date *</label>
                  <input
                    type="date"
                    name="acquisitionDate"
                    defaultValue={editingAsset?.acquisitionDate?.split('T')[0]}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Cost *</label>
                  <input
                    type="number"
                    name="acquisitionCost"
                    defaultValue={editingAsset?.acquisitionCost}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Installation Cost</label>
                  <input
                    type="number"
                    name="installationCost"
                    defaultValue={editingAsset?.installationCost || 0}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salvage Value</label>
                  <input
                    type="number"
                    name="salvageValue"
                    defaultValue={editingAsset?.salvageValue || 0}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Useful Life (Months) *</label>
                  <input
                    type="number"
                    name="usefulLifeMonths"
                    defaultValue={editingAsset?.usefulLifeMonths || 60}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Method</label>
                  <select
                    name="depreciationMethod"
                    defaultValue={editingAsset?.depreciationMethod || 'straight_line'}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {depreciationMethods.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Depreciation Start Date *</label>
                  <input
                    type="date"
                    name="depreciationStartDate"
                    defaultValue={editingAsset?.depreciationStartDate?.split('T')[0] || editingAsset?.acquisitionDate?.split('T')[0]}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input
                    type="text"
                    name="location"
                    defaultValue={editingAsset?.location}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Building A, Room 101"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingAsset?.description}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  name="notes"
                  defaultValue={editingAsset?.notes}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingAsset(null); }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingAsset ? 'Update' : 'Create'} Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewingAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Asset Details</h2>
              <button onClick={() => setViewingAsset(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Asset Code</p>
                  <p className="font-medium">{viewingAsset.assetCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">{viewingAsset.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <p className="font-medium capitalize">{viewingAsset.category.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[viewingAsset.status]}`}>
                    {viewingAsset.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Serial Number</p>
                  <p className="font-medium">{viewingAsset.serialNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Model</p>
                  <p className="font-medium">{viewingAsset.model || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Acquisition Date</p>
                  <p className="font-medium">{viewingAsset.acquisitionDate ? format(new Date(viewingAsset.acquisitionDate), 'dd/MM/yyyy') : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Cost</p>
                  <p className="font-medium">{formatCurrency(viewingAsset.totalCost)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Accumulated Depreciation</p>
                  <p className="font-medium text-red-600">{formatCurrency(viewingAsset.accumulatedDepreciation)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Net Book Value</p>
                  <p className="font-medium text-indigo-600">{formatCurrency(viewingAsset.bookValue)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">{viewingAsset.location || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Condition</p>
                  <p className={`font-medium capitalize ${conditionColors[viewingAsset.condition]}`}>
                    {viewingAsset.condition.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
              {viewingAsset.description && (
                <div>
                  <p className="text-sm text-gray-500">Description</p>
                  <p className="font-medium">{viewingAsset.description}</p>
                </div>
              )}
              {viewingAsset.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium">{viewingAsset.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
