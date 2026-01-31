import { useState, useMemo } from 'react';
import {
  XCircle,
  AlertOctagon,
  Trash2,
  ShieldAlert,
  TrendingDown,
  Package,
  DollarSign,
  BarChart3,
  Filter,
  Download,
  Clock,
  ChevronRight,
  CheckCircle,
  Loader2,
} from 'lucide-react';

interface ExpiredMedication {
  id: string;
  name: string;
  batch: string;
  expiryDate: string;
  daysExpired: number;
  quantity: number;
  value: number;
  category: string;
  supplier: string;
  quarantineStatus: 'quarantined' | 'pending' | 'disposal-ready';
  rootCause: 'overstock' | 'poor-rotation' | 'low-demand' | 'seasonal';
}

const quarantineStatusConfig = {
  quarantined: { label: 'Quarantined', color: 'bg-amber-100 text-amber-700', icon: ShieldAlert },
  pending: { label: 'Pending Review', color: 'bg-blue-100 text-blue-700', icon: Clock },
  'disposal-ready': { label: 'Disposal Ready', color: 'bg-red-100 text-red-700', icon: Trash2 },
};

const rootCauseConfig = {
  overstock: { label: 'Overstock', color: 'text-red-600' },
  'poor-rotation': { label: 'Poor Rotation', color: 'text-amber-600' },
  'low-demand': { label: 'Low Demand', color: 'text-blue-600' },
  seasonal: { label: 'Seasonal', color: 'text-purple-600' },
};

export default function ExpiredItemsPage() {
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCause, setSelectedCause] = useState<string>('all');

  // Note: Backend inventory doesn't have expiry date fields yet
  // This page will show empty until expiry tracking is implemented
  const isLoading = false;

  // Empty until backend expiry tracking is available
  const expiredMedications: ExpiredMedication[] = [];

  const filteredMedications = useMemo(() => {
    return expiredMedications.filter((med) => {
      const matchesStatus = selectedStatus === 'all' || med.quarantineStatus === selectedStatus;
      const matchesCause = selectedCause === 'all' || med.rootCause === selectedCause;
      return matchesStatus && matchesCause;
    });
  }, [selectedStatus, selectedCause, expiredMedications]);

  const stats = useMemo(() => {
    const totalValue = expiredMedications.reduce((sum, med) => sum + med.value, 0);
    const totalItems = expiredMedications.length;
    const quarantinedCount = expiredMedications.filter((m) => m.quarantineStatus === 'quarantined').length;
    const disposalReadyCount = expiredMedications.filter((m) => m.quarantineStatus === 'disposal-ready').length;
    return { totalValue, totalItems, quarantinedCount, disposalReadyCount };
  }, [expiredMedications]);

  const rootCauseAnalysis = useMemo(() => {
    const causes = expiredMedications.reduce((acc, med) => {
      acc[med.rootCause] = (acc[med.rootCause] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(causes).sort((a, b) => b[1] - a[1]);
  }, [expiredMedications]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <XCircle className="w-7 h-7 text-red-500" />
            Expired Items
          </h1>
          <p className="text-gray-600 mt-1">Manage expired medications and track disposal</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            <Trash2 className="w-4 h-4" />
            Process Disposal
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertOctagon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Expired</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Quarantined</p>
              <p className="text-xl font-bold text-amber-600">{stats.quarantinedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Disposal Pending</p>
              <p className="text-xl font-bold text-red-600">{stats.disposalReadyCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value Lost</p>
              <p className="text-xl font-bold text-gray-900">${stats.totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Table */}
        <div className="flex-1 flex flex-col">
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="all">All Status</option>
                <option value="quarantined">Quarantined</option>
                <option value="pending">Pending Review</option>
                <option value="disposal-ready">Disposal Ready</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Root Cause:</span>
              <select
                value={selectedCause}
                onChange={(e) => setSelectedCause(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="all">All Causes</option>
                <option value="overstock">Overstock</option>
                <option value="poor-rotation">Poor Rotation</option>
                <option value="low-demand">Low Demand</option>
                <option value="seasonal">Seasonal</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Medication</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Batch</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Expired</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Root Cause</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center text-gray-500">
                          <Loader2 className="w-12 h-12 mb-3 text-red-500 animate-spin" />
                          <p className="text-sm font-medium">Loading expired items...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredMedications.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center text-gray-500">
                          <CheckCircle className="w-12 h-12 mb-3 text-gray-300" />
                          <p className="text-sm font-medium">No expired items</p>
                          <p className="text-xs text-gray-400 mt-1">All inventory is within expiry date</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {filteredMedications.map((med) => {
                    const statusConfig = quarantineStatusConfig[med.quarantineStatus];
                    const StatusIcon = statusConfig.icon;
                    const causeConfig = rootCauseConfig[med.rootCause];
                    return (
                      <tr key={med.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{med.name}</p>
                            <p className="text-sm text-gray-500">{med.category}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono">{med.batch}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm text-gray-900">{med.expiryDate}</p>
                            <p className="text-xs text-red-600">{med.daysExpired} days ago</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{med.quantity}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">${med.value.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-medium ${causeConfig.color}`}>
                            {causeConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Root Cause Analysis Sidebar */}
        <div className="w-72 flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Root Cause Analysis</h3>
            </div>
            <div className="space-y-3">
              {rootCauseAnalysis.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No data available</p>
              ) : null}
              {rootCauseAnalysis.map(([cause, count]) => {
                const config = rootCauseConfig[cause as keyof typeof rootCauseConfig];
                const percentage = expiredMedications.length > 0 ? Math.round((count / expiredMedications.length) * 100) : 0;
                return (
                  <div key={cause}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`font-medium ${config.color}`}>{config.label}</span>
                      <span className="text-gray-600">{count} items</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cause === 'overstock'
                            ? 'bg-red-500'
                            : cause === 'poor-rotation'
                            ? 'bg-amber-500'
                            : cause === 'low-demand'
                            ? 'bg-blue-500'
                            : 'bg-purple-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Recommendations</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Implement FEFO (First Expiry, First Out) system</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Review reorder quantities for slow-moving items</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Set up seasonal demand forecasting</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
