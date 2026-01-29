import React, { useState, useMemo } from 'react';
import {
  Building,
  Search,
  Plus,
  Filter,
  Laptop,
  Armchair,
  Car,
  Stethoscope,
  MapPin,
  User,
  Calendar,
  DollarSign,
  Wrench,
  Eye,
  MoreVertical,
  Download,
  QrCode,
  Clock,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface Asset {
  id: string;
  assetNo: string;
  name: string;
  category: 'Equipment' | 'Furniture' | 'Vehicle' | 'IT Equipment' | 'Medical Device';
  description: string;
  location: string;
  custodian: string;
  purchaseDate: string;
  purchaseValue: number;
  currentValue: number;
  depreciationRate: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  status: 'active' | 'under-maintenance' | 'disposed' | 'written-off';
  nextMaintenance?: string;
  warrantyExpiry?: string;
}

const assets: Asset[] = [];

const categoryIcons: Record<string, React.ElementType> = {
  'Equipment': Building,
  'Furniture': Armchair,
  'Vehicle': Car,
  'IT Equipment': Laptop,
  'Medical Device': Stethoscope,
};

const categories = ['All', 'Medical Device', 'IT Equipment', 'Furniture', 'Vehicle'];

export default function AssetRegisterPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = 
        asset.assetNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || asset.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchTerm, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    return { total: 0, totalValue: 0, depreciation: 0, maintenanceDue: 0 };
  }, []);

  const getConditionBadge = (condition: string) => {
    const styles: Record<string, string> = {
      excellent: 'bg-green-100 text-green-700',
      good: 'bg-blue-100 text-blue-700',
      fair: 'bg-yellow-100 text-yellow-700',
      poor: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full capitalize ${styles[condition]}`}>
        {condition}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case 'under-maintenance':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
            <Wrench className="w-3 h-3" />
            Under Maintenance
          </span>
        );
      case 'disposed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
            Disposed
          </span>
        );
      case 'written-off':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
            Written Off
          </span>
        );
      default:
        return null;
    }
  };

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
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50">
            <QrCode className="w-4 h-4" />
            Print Labels
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Add Asset
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
              <p className="text-sm text-gray-500">Current Value (KES)</p>
              <p className="text-2xl font-bold text-green-600">{(stats.totalValue / 1000000).toFixed(1)}M</p>
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
              <p className="text-2xl font-bold text-orange-600">{(stats.depreciation / 1000000).toFixed(1)}M</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-orange-600" />
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
              <Wrench className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-4">
        {categories.map((cat) => {
          const Icon = categoryIcons[cat] || Building;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                categoryFilter === cat ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {cat !== 'All' && <Icon className="w-4 h-4" />}
              {cat}
            </button>
          );
        })}
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
          {filteredAssets.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full text-gray-500">
              <div className="text-center py-12">
                <Building className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No Assets</p>
                <p className="text-sm">Add assets to your register to get started</p>
              </div>
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asset</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Custodian</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Value (KES)</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Condition</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAssets.map((asset) => {
                const Icon = categoryIcons[asset.category] || Building;
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{asset.name}</p>
                          <p className="text-sm text-gray-500">{asset.assetNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{asset.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <MapPin className="w-3 h-3" />
                        {asset.location}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <User className="w-3 h-3" />
                        {asset.custodian}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{asset.currentValue.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Cost: {asset.purchaseValue.toLocaleString()}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getConditionBadge(asset.condition)}</td>
                    <td className="px-4 py-3">{getStatusBadge(asset.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {asset.nextMaintenance && (
                          <button className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            Maintenance
                          </button>
                        )}
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
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
