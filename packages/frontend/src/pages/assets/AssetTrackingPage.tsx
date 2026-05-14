import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  MapPin,
  Search,
  User,
  Building2,
  Package,
  Loader2,
  Eye,
  X,
  Download,
  Save,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { AssetClass, AssetCriticality, FixedAsset } from '../../services/assets';
import facilitiesService from '../../services/facilities';
import type { Department } from '../../services/facilities';
import api from '../../services/api';
import type { User as DirectoryUser } from '../../services/users';

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

const STATUSES = ['active', 'inactive', 'in_repair', 'disposed', 'in_transit'];

function criticalityBadgeClass(c?: AssetCriticality | null): string {
  switch (c) {
    case 'life_support':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800';
    case 'low':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function custodianDisplay(asset: Pick<FixedAsset, 'custodian'>): string {
  const c = asset.custodian;
  if (!c) return '';
  return (
    c.fullName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
  );
}

function userDisplay(u: Pick<DirectoryUser, 'fullName' | 'username'> | undefined): string {
  if (!u) return '';
  return u.fullName || u.username || '';
}

export default function AssetTrackingPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [filterCustodianId, setFilterCustodianId] = useState('');
  const [filterAssetClass, setFilterAssetClass] = useState('');
  const [filterCriticality, setFilterCriticality] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  const [viewAsset, setViewAsset] = useState<FixedAsset | null>(null);

  const serverFilters = useMemo(
    () => ({
      status: filterStatus || undefined,
      departmentId: filterDepartmentId || undefined,
      custodianId: filterCustodianId || undefined,
      assetClass: filterAssetClass || undefined,
      criticalityLevel: filterCriticality || undefined,
      categoryId: filterCategoryId || undefined,
    }),
    [filterStatus, filterDepartmentId, filterCustodianId, filterAssetClass, filterCriticality, filterCategoryId],
  );

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', facilityId, serverFilters],
    queryFn: () => assetsService.list(facilityId, serverFilters),
    enabled: !!facilityId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', facilityId],
    queryFn: () => facilitiesService.departments.list(facilityId),
    enabled: !!facilityId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users', facilityId],
    queryFn: async () => {
      const { data } = await api.get<{ data: DirectoryUser[]; total: number }>('/users', {
        params: { facilityId },
      });
      return data.data;
    },
    enabled: !!facilityId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories', { isActive: true }],
    queryFn: () => assetsService.listCategories({ isActive: true }),
  });

  const departmentMap = useMemo(() => {
    const m = new Map<string, Department>();
    departments.forEach((d) => m.set(d.id, d));
    return m;
  }, [departments]);

  const userMap = useMemo(() => {
    const m = new Map<string, DirectoryUser>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const filteredAssets = assets.filter((a) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      a.name.toLowerCase().includes(term) ||
      a.assetCode.toLowerCase().includes(term) ||
      (a.serialNumber || '').toLowerCase().includes(term)
    );
  });

  // Group by custodian for the tracking view
  const byCustodian: Record<string, { name: string; assets: FixedAsset[] }> = {};
  const unassigned: FixedAsset[] = [];
  filteredAssets.forEach((asset) => {
    if (asset.custodianId) {
      const name = custodianDisplay(asset) || userDisplay(userMap.get(asset.custodianId)) || asset.custodianId;
      if (!byCustodian[asset.custodianId]) byCustodian[asset.custodianId] = { name, assets: [] };
      byCustodian[asset.custodianId].assets.push(asset);
    } else {
      unassigned.push(asset);
    }
  });

  const exportCSV = () => {
    const headers = [
      'Asset Code',
      'Name',
      'Serial Number',
      'Category',
      'Asset Class',
      'Criticality',
      'Department',
      'Custodian',
      'Location',
      'Status',
      'Acquisition Cost',
    ];
    const rows = filteredAssets.map((a) => [
      a.assetCode,
      a.name,
      a.serialNumber || '',
      a.category || '',
      a.assetClass || '',
      a.criticalityLevel || '',
      a.department?.name || '',
      custodianDisplay(a),
      a.location || '',
      a.status,
      String(a.acquisitionCost || 0),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'asset_tracking.csv';
    link.click();
  };

  // Location history for selected asset
  const { data: locationHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['asset-location-history', viewAsset?.id],
    queryFn: () => assetsService.getLocationHistory(viewAsset!.id),
    enabled: !!viewAsset?.id,
  });

  const recordLocationMutation = useMutation({
    mutationFn: (payload: {
      assetId: string;
      data: {
        departmentId?: string;
        roomId?: string;
        locationLabel?: string;
        custodianId?: string;
        reason?: string;
        notes?: string;
      };
    }) => assetsService.recordLocation(payload.assetId, payload.data),
    onSuccess: (_data, variables) => {
      toast.success('Location recorded');
      queryClient.invalidateQueries({ queryKey: ['asset-location-history', variables.assetId] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: () => toast.error('Failed to record location'),
  });

  const handleRecordLocation = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!viewAsset) return;
    const fd = new FormData(e.currentTarget);
    recordLocationMutation.mutate(
      {
        assetId: viewAsset.id,
        data: {
          departmentId: (fd.get('departmentId') as string) || undefined,
          roomId: (fd.get('roomId') as string) || undefined,
          locationLabel: (fd.get('locationLabel') as string) || undefined,
          custodianId: (fd.get('custodianId') as string) || undefined,
          reason: (fd.get('reason') as string) || undefined,
          notes: (fd.get('notes') as string) || undefined,
        },
      },
      {
        onSuccess: () => {
          (e.target as HTMLFormElement).reset();
        },
      },
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <MapPin className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Asset Tracking</h1>
            <p className="text-sm text-gray-500">Track which department or custodian has each asset</p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
            </div>
            <Package className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Assigned to Custodians</p>
              <p className="text-2xl font-bold text-green-600">
                {assets.filter((a) => a.custodianId).length}
              </p>
            </div>
            <User className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Department Only</p>
              <p className="text-2xl font-bold text-blue-600">
                {assets.filter((a) => a.departmentId && !a.custodianId).length}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unassigned</p>
              <p className="text-2xl font-bold text-yellow-600">{unassigned.length}</p>
            </div>
            <Package className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, asset code, or serial number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select value={filterDepartmentId} onChange={(e) => setFilterDepartmentId(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select value={filterCustodianId} onChange={(e) => setFilterCustodianId(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Custodians</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {userDisplay(u)}
            </option>
          ))}
        </select>
        <select value={filterAssetClass} onChange={(e) => setFilterAssetClass(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Classes</option>
          {ASSET_CLASSES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={filterCriticality} onChange={(e) => setFilterCriticality(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Criticalities</option>
          {CRITICALITIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* By Custodian */}
          {Object.entries(byCustodian).map(([custodianId, group]) => (
            <div key={custodianId} className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-green-50 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-green-600" />
                  <h3 className="font-medium text-gray-900">{group.name}</h3>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                    {group.assets.length} assets
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  Total Value:{' '}
                  {formatCurrency(group.assets.reduce((sum, a) => sum + Number(a.acquisitionCost || 0), 0))}
                </span>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Serial #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Criticality</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {group.assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewAsset(asset)}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        <div className="text-xs text-gray-500">{asset.assetCode}</div>
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-gray-600">{asset.serialNumber || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{asset.department?.name || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600 capitalize">{asset.assetClass || '-'}</td>
                      <td className="px-4 py-2">
                        {asset.criticalityLevel ? (
                          <span className={`px-2 py-1 text-xs rounded-full capitalize ${criticalityBadgeClass(asset.criticalityLevel)}`}>
                            {asset.criticalityLevel.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {asset.location || 'Not specified'}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 text-xs rounded-full capitalize ${
                            asset.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : asset.status === 'in_repair'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {asset.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewAsset(asset);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Unassigned Assets */}
          {unassigned.length > 0 && (
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-yellow-50 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-medium text-gray-900">Unassigned Assets</h3>
                  <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                    {unassigned.length} assets
                  </span>
                </div>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Criticality</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {unassigned.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewAsset(asset)}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        <div className="text-xs text-gray-500">{asset.assetCode}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 capitalize">{asset.assetClass || '-'}</td>
                      <td className="px-4 py-2">
                        {asset.criticalityLevel ? (
                          <span className={`px-2 py-1 text-xs rounded-full capitalize ${criticalityBadgeClass(asset.criticalityLevel)}`}>
                            {asset.criticalityLevel.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{asset.department?.name || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{asset.location || '-'}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewAsset(asset);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredAssets.length === 0 && (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No assets found matching your filters</p>
            </div>
          )}
        </div>
      )}

      {/* Asset Detail Side Panel */}
      {viewAsset && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
          <div className="bg-white shadow-xl w-full max-w-2xl h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">{viewAsset.name}</h2>
              <button onClick={() => setViewAsset(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Asset Header */}
              <div className="flex items-start gap-4">
                <div className="p-3 bg-teal-100 rounded-lg">
                  <Package className="w-8 h-8 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900">{viewAsset.name}</h3>
                  <p className="text-gray-500">{viewAsset.assetCode}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full capitalize ${
                        viewAsset.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : viewAsset.status === 'in_repair'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {viewAsset.status.replace(/_/g, ' ')}
                    </span>
                    {viewAsset.assetClass && (
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 capitalize">
                        {viewAsset.assetClass}
                      </span>
                    )}
                    {viewAsset.criticalityLevel && (
                      <span className={`inline-block px-2 py-1 text-xs rounded-full capitalize ${criticalityBadgeClass(viewAsset.criticalityLevel)}`}>
                        {viewAsset.criticalityLevel.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Current Assignment */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-blue-800">Current Assignment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-600">Custodian</p>
                    <p className="font-medium text-gray-900">
                      {custodianDisplay(viewAsset) ||
                        userDisplay(viewAsset.custodianId ? userMap.get(viewAsset.custodianId) : undefined) ||
                        'Not assigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Department</p>
                    <p className="font-medium text-gray-900">
                      {viewAsset.department?.name ||
                        (viewAsset.departmentId ? departmentMap.get(viewAsset.departmentId)?.name : '') ||
                        'Not assigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Location</p>
                    <p className="font-medium text-gray-900">{viewAsset.location || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Condition</p>
                    <p className="font-medium text-gray-900 capitalize">
                      {(viewAsset.condition || 'Unknown').replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Asset Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium capitalize">{(viewAsset.category || '').replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500">Serial Number</p>
                  <p className="font-medium font-mono">{viewAsset.serialNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Model</p>
                  <p className="font-medium">{viewAsset.model || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Manufacturer</p>
                  <p className="font-medium">{viewAsset.manufacturer || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Acquisition Date</p>
                  <p className="font-medium">
                    {viewAsset.acquisitionDate ? format(new Date(viewAsset.acquisitionDate), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Acquisition Cost</p>
                  <p className="font-medium">{formatCurrency(viewAsset.acquisitionCost || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Useful Life</p>
                  <p className="font-medium">
                    {viewAsset.usefulLifeMonths ? `${Math.round(viewAsset.usefulLifeMonths / 12)} years` : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Salvage Value</p>
                  <p className="font-medium">{formatCurrency(viewAsset.salvageValue || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Book Value</p>
                  <p className="font-medium">{formatCurrency(viewAsset.bookValue || 0)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Warranty Expiry</p>
                  <p className="font-medium">
                    {viewAsset.warrantyExpiry ? format(new Date(viewAsset.warrantyExpiry), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Next Maintenance</p>
                  <p className="font-medium">
                    {viewAsset.nextMaintenanceDate ? format(new Date(viewAsset.nextMaintenanceDate), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Next Calibration</p>
                  <p className="font-medium">
                    {viewAsset.nextCalibrationDue ? format(new Date(viewAsset.nextCalibrationDue), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">AMC Vendor</p>
                  <p className="font-medium">{viewAsset.amcVendor || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">AMC End</p>
                  <p className="font-medium">
                    {viewAsset.amcEndDate ? format(new Date(viewAsset.amcEndDate), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Asset Tag</p>
                  <p className="font-medium font-mono">{viewAsset.assetTag || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Barcode / QR</p>
                  <p className="font-medium font-mono">{viewAsset.barcodeQr || '-'}</p>
                </div>
              </div>

              {viewAsset.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700">{viewAsset.notes}</p>
                </div>
              )}

              {/* Location History */}
              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-3">Location History</h4>
                {historyLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : locationHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">No location history recorded.</p>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Custodian</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {locationHistory.map((h) => (
                          <tr key={h.id}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {h.movedAt ? format(new Date(h.movedAt), 'dd/MM/yyyy HH:mm') : '-'}
                            </td>
                            <td className="px-3 py-2">
                              {(h.departmentId && departmentMap.get(h.departmentId)?.name) || '-'}
                            </td>
                            <td className="px-3 py-2">{h.roomId || '-'}</td>
                            <td className="px-3 py-2">{h.locationLabel || '-'}</td>
                            <td className="px-3 py-2">
                              {(h.custodianId && userDisplay(userMap.get(h.custodianId))) || '-'}
                            </td>
                            <td className="px-3 py-2">{h.reason || '-'}</td>
                            <td className="px-3 py-2">{h.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Record current location */}
              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-3">Record Current Location</h4>
                <form onSubmit={handleRecordLocation} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                      <select name="departmentId" className="w-full px-3 py-2 border rounded-lg text-sm">
                        <option value="">-- Select --</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Custodian</label>
                      <select name="custodianId" className="w-full px-3 py-2 border rounded-lg text-sm">
                        <option value="">-- Select --</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {userDisplay(u)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Room ID</label>
                      <input name="roomId" type="text" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Location Label</label>
                      <input name="locationLabel" type="text" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                      <input name="reason" type="text" className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea name="notes" rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={recordLocationMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                    >
                      {recordLocationMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Record Location
                    </button>
                  </div>
                </form>
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <button onClick={() => setViewAsset(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
