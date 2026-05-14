import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import {
  TrendingDown,
  Calculator,
  Play,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Building2,
  DollarSign,
} from 'lucide-react';

const statuses = ['All', 'active', 'fully_depreciated', 'disposed', 'maintenance', 'retired'];

export default function AssetDepreciationPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showRunModal, setShowRunModal] = useState(false);
  const [runPeriod, setRunPeriod] = useState('');

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['assets-depreciation', facilityId],
    queryFn: () => assetsService.list(facilityId, { status: 'active' }),
    enabled: !!facilityId,
  });

  const { data: depreciationReport, isLoading: reportLoading } = useQuery({
    queryKey: ['depreciation-report', facilityId, year],
    queryFn: () => assetsService.getDepreciationReport(facilityId, year),
    enabled: !!facilityId,
  });

  const runDepreciationMutation = useMutation({
    mutationFn: async (period: string) => assetsService.runDepreciation(facilityId, period),
    onSuccess: () => {
      toast.success('Depreciation run completed successfully');
      queryClient.invalidateQueries({ queryKey: ['assets-depreciation'] });
      queryClient.invalidateQueries({ queryKey: ['depreciation-report'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowRunModal(false);
      setRunPeriod('');
    },
    onError: () => {
      toast.error('Failed to run depreciation');
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => a.category && set.add(a.category));
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => a.department?.name && set.add(a.department.name));
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const filteredAssets = assets.filter((a) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      a.name.toLowerCase().includes(term) ||
      a.assetCode.toLowerCase().includes(term);
    const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
    const matchesDepartment =
      selectedDepartment === 'All' || a.department?.name === selectedDepartment;
    const matchesStatus = selectedStatus === 'All' || a.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesDepartment && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span>;
      case 'fully_depreciated':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">Fully Depreciated</span>;
      case 'disposed':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Disposed</span>;
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full capitalize">
            {(status || '').replace(/_/g, ' ')}
          </span>
        );
    }
  };

  const totalAcquisitionCost = assets.reduce((sum, a) => sum + Number(a.acquisitionCost || 0), 0);
  const totalAccumulatedDep = assets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation || 0), 0);
  const totalBookValue = assets.reduce(
    (sum, a) =>
      sum +
      (a.bookValue !== undefined && a.bookValue !== null
        ? Number(a.bookValue)
        : Number(a.acquisitionCost || 0) - Number(a.accumulatedDepreciation || 0)),
    0,
  );

  const reportSummary: Record<string, any> | null =
    depreciationReport && !Array.isArray(depreciationReport) && depreciationReport.summary
      ? depreciationReport.summary
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Depreciation</h1>
          <p className="text-gray-600">Manage depreciation schedules and run depreciation</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Year:</label>
            <input
              type="number"
              value={year}
              min={2000}
              max={2100}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
              className="px-3 py-2 border rounded-lg w-28"
            />
          </div>
          <button
            onClick={() => setShowRunModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Play className="w-4 h-4" />
            Run Depreciation
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<Building2 className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Total Assets"
          value={String(assets.length)}
          valueClass="text-gray-900"
        />
        <SummaryCard
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          iconBg="bg-green-100"
          label="Acquisition Cost"
          value={formatCurrency(totalAcquisitionCost)}
          valueClass="text-gray-900"
        />
        <SummaryCard
          icon={<TrendingDown className="w-5 h-5 text-red-600" />}
          iconBg="bg-red-100"
          label="Accumulated Depreciation"
          value={formatCurrency(totalAccumulatedDep)}
          valueClass="text-red-600"
        />
        <SummaryCard
          icon={<Calculator className="w-5 h-5 text-purple-600" />}
          iconBg="bg-purple-100"
          label="Net Book Value"
          value={formatCurrency(totalBookValue)}
          valueClass="text-purple-600"
        />
      </div>

      {/* Depreciation Report Summary (from BE) */}
      {reportLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : reportSummary ? (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Depreciation Report — {year}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(reportSummary).map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 capitalize">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {typeof v === 'number' ? formatCurrency(v) : String(v ?? '-')}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Asset List */}
      <div className="bg-white rounded-xl border shadow-sm">
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
                  {status === 'All' ? 'All Statuses' : status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Table */}
        {assetsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredAssets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Department</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Acquisition Date</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acquisition Cost</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Accum. Dep.</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Book Value</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Method</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Rate</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAssets.map((asset) => {
                  const bookValue =
                    asset.bookValue !== undefined && asset.bookValue !== null
                      ? Number(asset.bookValue)
                      : Number(asset.acquisitionCost || 0) - Number(asset.accumulatedDepreciation || 0);
                  return (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{asset.assetCode}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{asset.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {asset.department?.name || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {asset.acquisitionDate
                          ? format(new Date(asset.acquisitionDate), 'dd/MM/yyyy')
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {formatCurrency(asset.acquisitionCost || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        {formatCurrency(asset.accumulatedDepreciation || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatCurrency(bookValue)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 text-xs bg-gray-100 rounded capitalize">
                          {(asset.depreciationMethod || 'straight_line').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {asset.depreciationRate !== undefined && asset.depreciationRate !== null
                          ? `${asset.depreciationRate}%`
                          : '-'}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(asset.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No assets found</p>
          </div>
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
                  This will calculate and post depreciation for all active assets for the selected period.
                  This action cannot be undone.
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

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-white p-4 rounded-xl border shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 ${iconBg} rounded-lg`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-600">{label}</p>
          <p className={`text-lg font-bold ${valueClass ?? 'text-gray-900'}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
