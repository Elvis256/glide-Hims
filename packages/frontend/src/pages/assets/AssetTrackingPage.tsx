import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  MapPin,
  Search,
  User,
  Building2,
  Package,
  Loader2,
  Filter,
  Eye,
  X,
  History,
  Calendar,
  QrCode,
  Download,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { FixedAsset } from '../../services/assets';

export default function AssetTrackingPage() {
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [viewAsset, setViewAsset] = useState<FixedAsset | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', facilityId],
    queryFn: () => assetsService.list(facilityId, {}),
    enabled: !!facilityId,
  });

  // Get unique departments and assignees
  const departments = [...new Set(assets.map(a => a.department).filter(Boolean))];
  const assignees = [...new Set(assets.map(a => a.assignedTo).filter(Boolean))];

  const filteredAssets = assets.filter(a => {
    const matchesSearch = 
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !filterDepartment || a.department === filterDepartment;
    const matchesAssignee = !filterAssignee || a.assignedTo === filterAssignee;
    return matchesSearch && matchesDept && matchesAssignee;
  });

  // Group by assignee for the tracking view
  const byAssignee: Record<string, FixedAsset[]> = {};
  const unassigned: FixedAsset[] = [];

  filteredAssets.forEach(asset => {
    if (asset.assignedTo) {
      if (!byAssignee[asset.assignedTo]) byAssignee[asset.assignedTo] = [];
      byAssignee[asset.assignedTo].push(asset);
    } else {
      unassigned.push(asset);
    }
  });

  const exportCSV = () => {
    const headers = ['Asset Code', 'Name', 'Serial Number', 'Category', 'Department', 'Assigned To', 'Location', 'Status', 'Value'];
    const rows = filteredAssets.map(a => [
      a.assetCode,
      a.name,
      a.serialNumber || '',
      a.category,
      a.department || '',
      a.assignedTo || '',
      a.location || '',
      a.status,
      String(a.purchaseCost || 0),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'asset_tracking.csv';
    link.click();
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
            <p className="text-sm text-gray-500">Track which department or employee has each asset</p>
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
              <p className="text-sm text-gray-500">Assigned to Staff</p>
              <p className="text-2xl font-bold text-green-600">
                {assets.filter(a => a.assignedTo).length}
              </p>
            </div>
            <User className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Assigned to Departments</p>
              <p className="text-2xl font-bold text-blue-600">
                {assets.filter(a => a.department && !a.assignedTo).length}
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
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, asset code, or serial number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Assignees</option>
          {assignees.map(a => (
            <option key={a} value={a}>{a}</option>
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
          {/* By Assignee */}
          {Object.entries(byAssignee).map(([assignee, assigneeAssets]) => (
            <div key={assignee} className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-green-50 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-green-600" />
                  <h3 className="font-medium text-gray-900">{assignee}</h3>
                  <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                    {assigneeAssets.length} assets
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  Total Value: {formatCurrency(assigneeAssets.reduce((sum, a) => sum + Number(a.purchaseCost || 0), 0))}
                </span>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Serial #</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {assigneeAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        <div className="text-xs text-gray-500">{asset.assetCode}</div>
                      </td>
                      <td className="px-4 py-2 text-sm font-mono text-gray-600">
                        {asset.serialNumber || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {asset.department || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {asset.location || 'Not specified'}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                          asset.status === 'active' ? 'bg-green-100 text-green-800' :
                          asset.status === 'under_maintenance' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {asset.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setViewAsset(asset)}
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
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {unassigned.map(asset => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        <div className="text-xs text-gray-500">{asset.assetCode}</div>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 capitalize">
                        {(asset.category || '').replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {asset.department || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {asset.location || '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setViewAsset(asset)}
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

      {/* Asset Detail Modal */}
      {viewAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
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
                  <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full capitalize ${
                    viewAsset.status === 'active' ? 'bg-green-100 text-green-800' :
                    viewAsset.status === 'under_maintenance' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {viewAsset.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Tracking Info */}
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-blue-800">Current Assignment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-600">Assigned To</p>
                    <p className="font-medium text-gray-900">
                      {viewAsset.assignedTo || 'Not assigned to a person'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Department</p>
                    <p className="font-medium text-gray-900">
                      {viewAsset.department || 'Not assigned to a department'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-600">Location</p>
                    <p className="font-medium text-gray-900">
                      {viewAsset.location || 'Location not specified'}
                    </p>
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
                  <p className="text-gray-500">Purchase Date</p>
                  <p className="font-medium">
                    {viewAsset.purchaseDate ? format(new Date(viewAsset.purchaseDate), 'dd/MM/yyyy') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Purchase Cost</p>
                  <p className="font-medium">{formatCurrency(viewAsset.purchaseCost || 0)}</p>
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
              </div>

              {viewAsset.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700">{viewAsset.notes}</p>
                </div>
              )}
            </div>
            <div className="border-t px-6 py-4 flex justify-end">
              <button
                onClick={() => setViewAsset(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
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
