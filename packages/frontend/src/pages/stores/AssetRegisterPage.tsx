import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building,
  Search,
  Filter,
  Package,
  MapPin,
  User,
  Calendar,
  DollarSign,
  Wrench,
  Eye,
  Download,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import assetsService from '../../services/assets';
import { useFacilityId } from '../../lib/facility';

const categories = ['All', 'medical_equipment', 'furniture', 'vehicles', 'computer_equipment', 'office_equipment'];

export default function AssetRegisterPage() {
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', facilityId, categoryFilter, statusFilter],
    queryFn: () => assetsService.list(facilityId, {
      category: categoryFilter !== 'All' ? categoryFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    enabled: !!facilityId,
  });

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = 
        asset.assetCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.location || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [searchTerm, assets]);

  const stats = useMemo(() => {
    const totalValue = assets.reduce((sum, a) => sum + Number(a.purchaseCost || 0), 0);
    const depreciation = assets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation || 0), 0);
    const maintenanceDue = assets.filter(a => a.nextMaintenanceDate && new Date(a.nextMaintenanceDate) < new Date()).length;
    return { total: assets.length, totalValue, depreciation, maintenanceDue };
  }, [assets]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Register</h1>
          <p className="text-gray-600">Track fixed assets, equipment, and vehicles</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Building className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Purchase Cost</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalValue)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Accumulated Depreciation</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.depreciation)}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Wrench className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Maintenance Due</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.maintenanceDue}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              categoryFilter === cat ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white hover:bg-gray-50'
            }`}
          >
            {cat === 'All' ? cat : cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by asset number, name, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="under-maintenance">Under Maintenance</option>
          <option value="disposed">Disposed</option>
          <option value="written-off">Written Off</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Assets Table */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full text-gray-500">
              <div className="text-center py-12">
                <Building className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No Assets</p>
                <p className="text-sm">Assets will appear here once registered</p>
              </div>
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asset</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Department</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Purchase Cost</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Condition</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAssets.map((asset) => {
                const bookValue = Number(asset.purchaseCost || 0) - Number(asset.accumulatedDepreciation || 0);
                const needsMaintenance = asset.nextMaintenanceDate && new Date(asset.nextMaintenanceDate) < new Date();
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{asset.name}</p>
                          <p className="text-sm text-gray-500">{asset.assetCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 capitalize">{asset.category.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <MapPin className="w-3 h-3" />
                        {asset.location || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <User className="w-3 h-3" />
                        {asset.department || asset.assignedTo || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{formatCurrency(Number(asset.purchaseCost || 0))}</p>
                        <p className="text-xs text-gray-500">Book: {formatCurrency(bookValue)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs rounded-full capitalize bg-blue-100 text-blue-700">{asset.condition || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full capitalize ${asset.status === 'active' ? 'bg-green-100 text-green-700' : asset.status === 'under_maintenance' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                        {(asset.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {needsMaintenance && (
                          <button className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Due
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {filteredAssets.length} of {assets.length} assets
        </div>
      </div>
    </div>
  );
}
