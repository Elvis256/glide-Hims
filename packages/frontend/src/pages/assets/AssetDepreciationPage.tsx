import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingDown,
  Calculator,
  Play,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Calendar,
  Building2,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  Download,
} from 'lucide-react';

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  department: string;
  purchaseDate: string;
  purchaseCost: number;
  usefulLife: number; // years
  depreciationMethod: 'STRAIGHT_LINE' | 'REDUCING_BALANCE';
  salvageValue: number;
  accumulatedDepreciation: number;
  currentValue: number;
  lastDepreciationDate?: string;
  status: 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED';
}

interface DepreciationRun {
  id: string;
  runDate: string;
  period: string;
  totalAssets: number;
  totalDepreciation: number;
  runBy: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

// Empty data - to be populated from API
const mockAssets: Asset[] = [];

const mockDepreciationRuns: DepreciationRun[] = [];

const categories = ['All', 'Medical Equipment', 'Lab Equipment', 'Furniture', 'Vehicles', 'IT Equipment', 'Building'];
const departments = ['All', 'Radiology', 'Laboratory', 'Ward A', 'Ward B', 'Transport', 'IT', 'Administration'];
const statuses = ['All', 'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED'];

export default function AssetDepreciationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'schedule' | 'history'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runPeriod, setRunPeriod] = useState('');

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets-depreciation', selectedCategory, selectedDepartment],
    queryFn: async () => mockAssets,
  });

  const { data: depreciationRuns, isLoading: runsLoading } = useQuery({
    queryKey: ['depreciation-runs'],
    queryFn: async () => mockDepreciationRuns,
  });

  const runDepreciationMutation = useMutation({
    mutationFn: async (period: string) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { period, success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets-depreciation'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-runs'] });
      setShowRunModal(false);
      setRunPeriod('');
    },
  });

  const filteredAssets = assets?.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
    const matchesDepartment = selectedDepartment === 'All' || a.department === selectedDepartment;
    const matchesStatus = selectedStatus === 'All' || a.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesDepartment && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span>;
      case 'FULLY_DEPRECIATED':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Fully Depreciated</span>;
      case 'DISPOSED':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Disposed</span>;
      default:
        return null;
    }
  };

  const totalPurchaseCost = assets?.reduce((sum, a) => sum + a.purchaseCost, 0) || 0;
  const totalAccumulatedDep = assets?.reduce((sum, a) => sum + a.accumulatedDepreciation, 0) || 0;
  const totalCurrentValue = assets?.reduce((sum, a) => sum + a.currentValue, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Depreciation</h1>
          <p className="text-gray-600">Manage depreciation schedules and run depreciation</p>
        </div>
        <button
          onClick={() => setShowRunModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Play className="w-4 h-4" />
          Run Depreciation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Assets</p>
              <p className="text-xl font-bold text-gray-900">{assets?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Purchase Cost</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(totalPurchaseCost)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Accumulated Depreciation</p>
              <p className="text-lg font-bold text-red-600">{formatCurrency(totalAccumulatedDep)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calculator className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Net Book Value</p>
              <p className="text-lg font-bold text-purple-600">{formatCurrency(totalCurrentValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'schedule'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Depreciation Schedule
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Run History
            </button>
          </div>
        </div>

        {activeTab === 'schedule' && (
          <>
            {/* Filters */}
            <div className="p-4 border-b flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>

            {showFilters && (
              <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'All' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept === 'All' ? 'All Departments' : dept}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status === 'All' ? 'All Statuses' : status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Assets Table */}
            {assetsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : filteredAssets && filteredAssets.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Asset</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Purchase Cost</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Method</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Accum. Dep.</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Net Book Value</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAssets.map((asset) => (
                      <tr key={asset.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{asset.name}</p>
                            <p className="text-sm text-gray-500">{asset.assetCode} • {asset.department}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{asset.category}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.purchaseCost)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                            {asset.depreciationMethod === 'STRAIGHT_LINE' ? 'SL' : 'RB'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          {formatCurrency(asset.accumulatedDepreciation)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          {formatCurrency(asset.currentValue)}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(asset.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No assets found</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <>
            {runsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : depreciationRuns && depreciationRuns.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Period</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Run Date</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Assets</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Total Depreciation</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Run By</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {depreciationRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{run.period}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(run.runDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{run.totalAssets}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                        {formatCurrency(run.totalDepreciation)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{run.runBy}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          <CheckCircle className="w-3 h-3" /> {run.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No depreciation runs found</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Run Depreciation Modal */}
      {showRunModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Run Depreciation</h2>
              <p className="text-gray-600">Calculate depreciation for the selected period</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Period <span className="text-red-500">*</span>
                </label>
                <input
                  type="month"
                  value={runPeriod}
                  onChange={(e) => setRunPeriod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  This will calculate and post depreciation for all active assets for the selected period. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRunModal(false);
                  setRunPeriod('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => runDepreciationMutation.mutate(runPeriod)}
                disabled={!runPeriod || runDepreciationMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {runDepreciationMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Run Depreciation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
