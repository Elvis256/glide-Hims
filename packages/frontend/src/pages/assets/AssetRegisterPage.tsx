import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Download,
  Loader2,
  X,
  Save,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { FixedAsset, AssetCategory, AssetClass, AssetCriticality } from '../../services/assets';
import facilitiesService from '../../services/facilities';
import type { Department } from '../../services/facilities';
import api from '../../services/api';

interface FacilityUser {
  id: string;
  fullName: string;
  departmentId?: string;
}

const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: 'medical', label: 'Medical' },
  { value: 'it', label: 'IT' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'utility', label: 'Utility' },
  { value: 'building', label: 'Building' },
  { value: 'other', label: 'Other' },
];

const CRITICALITIES: { value: AssetCriticality; label: string }[] = [
  { value: 'life_support', label: 'Life Support' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const DEPRECIATION_METHODS = [
  { value: 'straight_line', label: 'Straight Line' },
  { value: 'declining_balance', label: 'Declining Balance' },
  { value: 'units_of_production', label: 'Units of Production' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'disposed', label: 'Disposed' },
  { value: 'written_off', label: 'Written Off' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'damaged', label: 'Damaged' },
];

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  under_maintenance: 'bg-yellow-100 text-yellow-800',
  disposed: 'bg-gray-100 text-gray-800',
  written_off: 'bg-red-100 text-red-800',
  transferred: 'bg-blue-100 text-blue-800',
  damaged: 'bg-orange-100 text-orange-800',
};

const assetClassColors: Record<string, string> = {
  medical: 'bg-red-100 text-red-700',
  it: 'bg-blue-100 text-blue-700',
  furniture: 'bg-amber-100 text-amber-700',
  vehicle: 'bg-purple-100 text-purple-700',
  utility: 'bg-teal-100 text-teal-700',
  building: 'bg-stone-100 text-stone-700',
  other: 'bg-gray-100 text-gray-700',
};

const criticalityColors: Record<string, string> = {
  life_support: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

type TabKey = 'identification' | 'acquisition' | 'depreciation' | 'calibration' | 'amc' | 'tags';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'identification', label: 'Identification' },
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'depreciation', label: 'Depreciation' },
  { key: 'calibration', label: 'Calibration' },
  { key: 'amc', label: 'AMC & Warranty' },
  { key: 'tags', label: 'Tags' },
];

type AssetForm = Partial<FixedAsset>;

function emptyForm(): AssetForm {
  return {
    status: 'active',
    condition: 'good',
    depreciationMethod: 'straight_line',
  };
}

function isoDateInput(v?: string): string {
  if (!v) return '';
  return v.split('T')[0] ?? '';
}

function custodianLabel(c?: { firstName?: string; lastName?: string; fullName?: string }): string {
  if (!c) return '—';
  if (c.fullName) return c.fullName;
  const joined = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return joined || '—';
}

export default function AssetRegisterPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [assetClassFilter, setAssetClassFilter] = useState('');
  const [criticalityFilter, setCriticalityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [viewingAsset, setViewingAsset] = useState<FixedAsset | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('identification');
  const [form, setForm] = useState<AssetForm>(emptyForm());

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', facilityId, assetClassFilter, criticalityFilter, categoryFilter, departmentFilter, statusFilter, searchTerm],
    queryFn: () => assetsService.list(facilityId, {
      assetClass: assetClassFilter || undefined,
      criticalityLevel: criticalityFilter || undefined,
      categoryId: categoryFilter || undefined,
      departmentId: departmentFilter || undefined,
      status: statusFilter || undefined,
      search: searchTerm || undefined,
    }),
    enabled: !!facilityId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => assetsService.listCategories({ isActive: true }),
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments', facilityId],
    queryFn: () => facilitiesService.departments.list(facilityId),
    enabled: !!facilityId,
  });

  const { data: usersResp } = useQuery({
    queryKey: ['users', facilityId],
    queryFn: async () => {
      const r = await api.get('/users', { params: { facilityId } });
      return r.data as { data: FacilityUser[]; total: number };
    },
    enabled: !!facilityId,
  });
  const users: FacilityUser[] = usersResp?.data ?? [];

  const categoryById = useMemo(() => {
    const m = new Map<string, AssetCategory>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const filteredCategoriesForForm = useMemo(() => {
    if (!form.assetClass) return categories;
    return categories.filter(c => c.assetClass === form.assetClass);
  }, [categories, form.assetClass]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<FixedAsset>) => assetsService.create({ ...data, facilityId }),
    onSuccess: () => {
      toast.success('Asset created successfully');
      queryClient.invalidateQueries({ queryKey: ['assets', facilityId] });
      closeModal();
    },
    onError: () => toast.error('Failed to create asset'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FixedAsset> }) => assetsService.update(id, data),
    onSuccess: () => {
      toast.success('Asset updated successfully');
      queryClient.invalidateQueries({ queryKey: ['assets', facilityId] });
      closeModal();
    },
    onError: () => toast.error('Failed to update asset'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assetsService.delete(id),
    onSuccess: () => {
      toast.success('Asset deleted');
      queryClient.invalidateQueries({ queryKey: ['assets', facilityId] });
    },
    onError: () => toast.error('Failed to delete asset'),
  });

  function openCreate() {
    setEditingAsset(null);
    setForm(emptyForm());
    setActiveTab('identification');
    setShowModal(true);
  }

  function openEdit(a: FixedAsset) {
    setEditingAsset(a);
    setForm({
      ...a,
      acquisitionDate: isoDateInput(a.acquisitionDate) || undefined,
      depreciationStartDate: isoDateInput(a.depreciationStartDate) || undefined,
      warrantyExpiry: isoDateInput(a.warrantyExpiry) || undefined,
      nextMaintenanceDate: isoDateInput(a.nextMaintenanceDate) || undefined,
      lastCalibrationDate: isoDateInput(a.lastCalibrationDate) || undefined,
      nextCalibrationDue: isoDateInput(a.nextCalibrationDue) || undefined,
      amcStartDate: isoDateInput(a.amcStartDate) || undefined,
      amcEndDate: isoDateInput(a.amcEndDate) || undefined,
      insuranceExpiry: isoDateInput(a.insuranceExpiry) || undefined,
    });
    setActiveTab('identification');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingAsset(null);
    setForm(emptyForm());
    setActiveTab('identification');
  }

  function setField<K extends keyof AssetForm>(key: K, value: AssetForm[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function handleNumber(key: keyof AssetForm, raw: string) {
    setField(key, (raw === '' ? undefined : Number(raw)) as AssetForm[typeof key]);
  }

  // Prefill blank fields from selected category defaults
  useEffect(() => {
    if (!form.categoryId) return;
    const cat = categoryById.get(form.categoryId);
    if (!cat) return;
    setForm(prev => {
      const next = { ...prev };
      if (next.usefulLifeMonths == null && cat.defaultUsefulLifeMonths != null) {
        next.usefulLifeMonths = cat.defaultUsefulLifeMonths;
      }
      if (!next.depreciationMethod && cat.defaultDepreciationMethod) {
        next.depreciationMethod = cat.defaultDepreciationMethod;
      }
      if (next.depreciationRate == null && cat.defaultDepreciationRate != null) {
        next.depreciationRate = cat.defaultDepreciationRate;
      }
      if (next.calibrationIntervalDays == null && cat.defaultCalibrationIntervalDays != null) {
        next.calibrationIntervalDays = cat.defaultCalibrationIntervalDays;
      }
      if (next.maintenanceIntervalDays == null && cat.defaultMaintenanceIntervalDays != null) {
        next.maintenanceIntervalDays = cat.defaultMaintenanceIntervalDays;
      }
      return next;
    });
  }, [form.categoryId, categoryById]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.assetCode || !form.name) {
      toast.error('Asset code and name are required');
      setActiveTab('identification');
      return;
    }
    const payload: Partial<FixedAsset> = { ...form };
    if (editingAsset) {
      updateMutation.mutate({ id: editingAsset.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function exportCSV() {
    const headers = ['Asset Code', 'Name', 'Asset Class', 'Criticality', 'Category', 'Department', 'Custodian', 'Acquisition Cost', 'Status'];
    const rows = assets.map(a => [
      a.assetCode,
      a.name,
      a.assetClass ?? '',
      a.criticalityLevel ?? '',
      (a.categoryId ? categoryById.get(a.categoryId)?.name : '') || a.category || '',
      a.department?.name ?? '',
      custodianLabel(a.custodian),
      a.acquisitionCost ?? '',
      a.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asset-register-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const stats = {
    totalAssets: assets.length,
    totalCost: assets.reduce((sum, a) => sum + Number(a.totalCost || 0), 0),
    totalBookValue: assets.reduce((sum, a) => sum + Number(a.bookValue || 0), 0),
    activeAssets: assets.filter(a => a.status === 'active').length,
  };

  const computedTotal = (Number(form.acquisitionCost || 0) + Number(form.installationCost || 0)) || 0;

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
            onClick={openCreate}
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
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name, code, or serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select value={assetClassFilter} onChange={(e) => setAssetClassFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All Classes</option>
            {ASSET_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={criticalityFilter} onChange={(e) => setCriticalityFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All Criticality</option>
            {CRITICALITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg md:col-start-6">
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criticality</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custodian</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acquisition Cost</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No assets found. Click "Add Asset" to create one.
                </td>
              </tr>
            ) : (
              assets.map((asset) => {
                const catName = (asset.categoryId ? categoryById.get(asset.categoryId)?.name : undefined) || asset.category || '—';
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{asset.assetCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{asset.name}</td>
                    <td className="px-4 py-3">
                      {asset.assetClass ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${assetClassColors[asset.assetClass] || 'bg-gray-100 text-gray-700'}`}>
                          {asset.assetClass}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {asset.criticalityLevel ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${criticalityColors[asset.criticalityLevel] || 'bg-gray-100 text-gray-700'}`}>
                          {asset.criticalityLevel.replace(/_/g, ' ')}
                        </span>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{catName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{asset.department?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{custodianLabel(asset.custodian)}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium">{formatCurrency(asset.acquisitionCost ?? 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[asset.status] || 'bg-gray-100'}`}>
                        {asset.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewingAsset(asset)} className="p-1 hover:bg-gray-100 rounded" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button onClick={() => openEdit(asset)} className="p-1 hover:bg-gray-100 rounded" title="Edit">
                          <Edit2 className="w-4 h-4 text-blue-500" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this asset?')) deleteMutation.mutate(asset.id);
                          }}
                          className="p-1 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingAsset ? 'Edit Asset' : 'Add New Asset'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab strip */}
            <div className="border-b bg-white sticky top-[57px] z-10">
              <div className="px-6 flex gap-1 overflow-x-auto">
                {TABS.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                      activeTab === t.key
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {activeTab === 'identification' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Asset Code *">
                      <input type="text" required value={form.assetCode ?? ''} onChange={e => setField('assetCode', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="AST-001" />
                    </Field>
                    <Field label="Asset Name *" className="col-span-2">
                      <input type="text" required value={form.name ?? ''} onChange={e => setField('name', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="X-Ray Machine" />
                    </Field>
                  </div>

                  <Field label="Description">
                    <textarea rows={2} value={form.description ?? ''} onChange={e => setField('description', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                  </Field>

                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Asset Class">
                      <select
                        value={form.assetClass ?? ''}
                        onChange={e => setField('assetClass', (e.target.value || undefined) as AssetClass | undefined)}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">—</option>
                        {ASSET_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Criticality">
                      <select
                        value={form.criticalityLevel ?? ''}
                        onChange={e => setField('criticalityLevel', (e.target.value || undefined) as AssetCriticality | undefined)}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">—</option>
                        {CRITICALITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Category">
                      <select
                        value={form.categoryId ?? ''}
                        onChange={e => setField('categoryId', e.target.value || undefined)}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">—</option>
                        {filteredCategoriesForForm.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Category (free-text fallback)">
                      <input type="text" value={form.category ?? ''} onChange={e => setField('category', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Sub-Category">
                      <input type="text" value={form.subCategory ?? ''} onChange={e => setField('subCategory', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Serial Number">
                      <input type="text" value={form.serialNumber ?? ''} onChange={e => setField('serialNumber', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Model">
                      <input type="text" value={form.model ?? ''} onChange={e => setField('model', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Manufacturer">
                      <input type="text" value={form.manufacturer ?? ''} onChange={e => setField('manufacturer', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Department">
                      <select value={form.departmentId ?? ''} onChange={e => setField('departmentId', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg">
                        <option value="">—</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Custodian">
                      <select value={form.custodianId ?? ''} onChange={e => setField('custodianId', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg">
                        <option value="">—</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                      </select>
                    </Field>
                    <Field label="Location">
                      <input type="text" value={form.location ?? ''} onChange={e => setField('location', e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="Building A, Room 101" />
                    </Field>
                    <Field label="Building ID">
                      <input type="text" value={form.buildingId ?? ''} onChange={e => setField('buildingId', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Floor ID">
                      <input type="text" value={form.floorId ?? ''} onChange={e => setField('floorId', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Room ID">
                      <input type="text" value={form.roomId ?? ''} onChange={e => setField('roomId', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === 'acquisition' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Supplier">
                      <input type="text" value={form.supplier ?? ''} onChange={e => setField('supplier', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Purchase Order Number">
                      <input type="text" value={form.purchaseOrderNumber ?? ''} onChange={e => setField('purchaseOrderNumber', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Acquisition Date">
                      <input type="date" value={form.acquisitionDate ?? ''} onChange={e => setField('acquisitionDate', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Acquisition Cost">
                      <input type="number" step="0.01" value={form.acquisitionCost ?? ''} onChange={e => handleNumber('acquisitionCost', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Installation Cost">
                      <input type="number" step="0.01" value={form.installationCost ?? ''} onChange={e => handleNumber('installationCost', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Total Cost (override optional)">
                      <input
                        type="number"
                        step="0.01"
                        value={form.totalCost ?? ''}
                        placeholder={String(computedTotal)}
                        onChange={e => handleNumber('totalCost', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">Computed: {formatCurrency(computedTotal)}</p>
                    </Field>
                    <Field label="Replacement Cost">
                      <input type="number" step="0.01" value={form.replacementCost ?? ''} onChange={e => handleNumber('replacementCost', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="CAPEX">
                      <label className="flex items-center gap-2 mt-2">
                        <input type="checkbox" checked={!!form.isCapex} onChange={e => setField('isCapex', e.target.checked)} className="rounded" />
                        <span className="text-sm">Capitalized expense</span>
                      </label>
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === 'depreciation' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Depreciation Method">
                      <select value={form.depreciationMethod ?? ''} onChange={e => setField('depreciationMethod', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg">
                        <option value="">—</option>
                        {DEPRECIATION_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Depreciation Rate (%)">
                      <input type="number" step="0.01" value={form.depreciationRate ?? ''} onChange={e => handleNumber('depreciationRate', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Depreciation Start Date">
                      <input type="date" value={form.depreciationStartDate ?? ''} onChange={e => setField('depreciationStartDate', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Useful Life (Months)">
                      <input type="number" value={form.usefulLifeMonths ?? ''} onChange={e => handleNumber('usefulLifeMonths', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Salvage Value">
                      <input type="number" step="0.01" value={form.salvageValue ?? ''} onChange={e => handleNumber('salvageValue', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                </div>
              )}

              {activeTab === 'calibration' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Calibration Interval (Days)">
                      <input type="number" value={form.calibrationIntervalDays ?? ''} onChange={e => handleNumber('calibrationIntervalDays', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Last Calibration Date">
                      <input type="date" value={form.lastCalibrationDate ?? ''} onChange={e => setField('lastCalibrationDate', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Next Calibration Due">
                      <input type="date" value={form.nextCalibrationDue ?? ''} onChange={e => setField('nextCalibrationDue', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                  <Field label={`Biomedical Engineer${form.assetClass === 'medical' ? ' *' : ''}`}>
                    <select value={form.biomedEngineerId ?? ''} onChange={e => setField('biomedEngineerId', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg">
                      <option value="">—</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                    </select>
                    {form.assetClass !== 'medical' && (
                      <p className="text-xs text-gray-400 mt-1">Typically required only for medical assets.</p>
                    )}
                  </Field>
                </div>
              )}

              {activeTab === 'amc' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Warranty Expiry">
                      <input type="date" value={form.warrantyExpiry ?? ''} onChange={e => setField('warrantyExpiry', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Next Maintenance Date">
                      <input type="date" value={form.nextMaintenanceDate ?? ''} onChange={e => setField('nextMaintenanceDate', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Maintenance Interval (Days)">
                      <input type="number" value={form.maintenanceIntervalDays ?? ''} onChange={e => handleNumber('maintenanceIntervalDays', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="AMC Vendor">
                      <input type="text" value={form.amcVendor ?? ''} onChange={e => setField('amcVendor', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="AMC Contract Reference">
                      <input type="text" value={form.amcContractRef ?? ''} onChange={e => setField('amcContractRef', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="AMC Start Date">
                      <input type="date" value={form.amcStartDate ?? ''} onChange={e => setField('amcStartDate', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="AMC End Date">
                      <input type="date" value={form.amcEndDate ?? ''} onChange={e => setField('amcEndDate', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                  <div className="border-t pt-4">
                    <label className="flex items-center gap-2 mb-3">
                      <input type="checkbox" checked={!!form.isInsured} onChange={e => setField('isInsured', e.target.checked)} className="rounded" />
                      <span className="text-sm font-medium">Insured</span>
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="Insurance Policy Number">
                        <input type="text" value={form.insurancePolicyNumber ?? ''} onChange={e => setField('insurancePolicyNumber', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                      </Field>
                      <Field label="Insured Value">
                        <input type="number" step="0.01" value={form.insuredValue ?? ''} onChange={e => handleNumber('insuredValue', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                      </Field>
                      <Field label="Insurance Expiry">
                        <input type="date" value={form.insuranceExpiry ?? ''} onChange={e => setField('insuranceExpiry', e.target.value || undefined)} className="w-full px-3 py-2 border rounded-lg" />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tags' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Barcode / QR">
                      <input type="text" value={form.barcodeQr ?? ''} onChange={e => setField('barcodeQr', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="RFID Tag">
                      <input type="text" value={form.rfidTag ?? ''} onChange={e => setField('rfidTag', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                    <Field label="Asset Tag">
                      <input type="text" value={form.assetTag ?? ''} onChange={e => setField('assetTag', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </Field>
                  </div>
                  <Field label="Image URL">
                    <input type="text" value={form.imageUrl ?? ''} onChange={e => setField('imageUrl', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                  </Field>
                  <Field label="Notes">
                    <textarea rows={3} value={form.notes ?? ''} onChange={e => setField('notes', e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                  </Field>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Asset Details</h2>
              <button onClick={() => setViewingAsset(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <Section title="Identification">
                <Detail label="Asset Code" value={viewingAsset.assetCode} />
                <Detail label="Name" value={viewingAsset.name} />
                <Detail label="Asset Class" value={viewingAsset.assetClass}>
                  {viewingAsset.assetClass && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${assetClassColors[viewingAsset.assetClass] || 'bg-gray-100 text-gray-700'}`}>
                      {viewingAsset.assetClass}
                    </span>
                  )}
                </Detail>
                <Detail label="Criticality" value={viewingAsset.criticalityLevel}>
                  {viewingAsset.criticalityLevel && (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${criticalityColors[viewingAsset.criticalityLevel] || 'bg-gray-100 text-gray-700'}`}>
                      {viewingAsset.criticalityLevel.replace(/_/g, ' ')}
                    </span>
                  )}
                </Detail>
                <Detail label="Category" value={(viewingAsset.categoryId ? categoryById.get(viewingAsset.categoryId)?.name : undefined) || viewingAsset.category} />
                <Detail label="Sub-Category" value={viewingAsset.subCategory} />
                <Detail label="Serial Number" value={viewingAsset.serialNumber} />
                <Detail label="Model" value={viewingAsset.model} />
                <Detail label="Manufacturer" value={viewingAsset.manufacturer} />
                <Detail label="Department" value={viewingAsset.department?.name} />
                <Detail label="Custodian" value={custodianLabel(viewingAsset.custodian)} />
                <Detail label="Location" value={viewingAsset.location} />
                <Detail label="Status">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[viewingAsset.status] || 'bg-gray-100'}`}>
                    {viewingAsset.status.replace(/_/g, ' ')}
                  </span>
                </Detail>
              </Section>

              <Section title="Acquisition & Value">
                <Detail label="Supplier" value={viewingAsset.supplier} />
                <Detail label="PO Number" value={viewingAsset.purchaseOrderNumber} />
                <Detail label="Acquisition Date" value={viewingAsset.acquisitionDate ? format(new Date(viewingAsset.acquisitionDate), 'dd/MM/yyyy') : undefined} />
                <Detail label="Acquisition Cost" value={formatCurrency(viewingAsset.acquisitionCost ?? 0)} />
                <Detail label="Installation Cost" value={formatCurrency(viewingAsset.installationCost ?? 0)} />
                <Detail label="Total Cost" value={formatCurrency(viewingAsset.totalCost ?? 0)} />
                <Detail label="Replacement Cost" value={formatCurrency(viewingAsset.replacementCost ?? 0)} />
                <Detail label="CAPEX" value={viewingAsset.isCapex ? 'Yes' : 'No'} />
                <Detail label="Accumulated Depreciation" value={formatCurrency(viewingAsset.accumulatedDepreciation ?? 0)} />
                <Detail label="Net Book Value" value={formatCurrency(viewingAsset.bookValue ?? 0)} />
              </Section>

              <Section title="Calibration">
                <Detail label="Interval (days)" value={viewingAsset.calibrationIntervalDays} />
                <Detail label="Last Calibration" value={viewingAsset.lastCalibrationDate ? format(new Date(viewingAsset.lastCalibrationDate), 'dd/MM/yyyy') : undefined} />
                <Detail label="Next Due" value={viewingAsset.nextCalibrationDue ? format(new Date(viewingAsset.nextCalibrationDue), 'dd/MM/yyyy') : undefined} />
                <Detail label="Biomed Engineer" value={users.find(u => u.id === viewingAsset.biomedEngineerId)?.fullName} />
              </Section>

              <Section title="AMC & Warranty">
                <Detail label="Warranty Expiry" value={viewingAsset.warrantyExpiry ? format(new Date(viewingAsset.warrantyExpiry), 'dd/MM/yyyy') : undefined} />
                <Detail label="AMC Vendor" value={viewingAsset.amcVendor} />
                <Detail label="AMC Start" value={viewingAsset.amcStartDate ? format(new Date(viewingAsset.amcStartDate), 'dd/MM/yyyy') : undefined} />
                <Detail label="AMC End" value={viewingAsset.amcEndDate ? format(new Date(viewingAsset.amcEndDate), 'dd/MM/yyyy') : undefined} />
                <Detail label="Contract Ref" value={viewingAsset.amcContractRef} />
                <Detail label="Insured" value={viewingAsset.isInsured ? 'Yes' : 'No'} />
                <Detail label="Insurance Policy" value={viewingAsset.insurancePolicyNumber} />
                <Detail label="Insured Value" value={viewingAsset.insuredValue != null ? formatCurrency(viewingAsset.insuredValue) : undefined} />
              </Section>

              <Section title="Tags">
                <Detail label="Barcode / QR" value={viewingAsset.barcodeQr} />
                <Detail label="RFID" value={viewingAsset.rfidTag} />
                <Detail label="Asset Tag" value={viewingAsset.assetTag} />
              </Section>

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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Detail({ label, value, children }: { label: string; value?: string | number | null; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      {children ?? <p className="font-medium">{value != null && value !== '' ? value : '—'}</p>}
    </div>
  );
}
