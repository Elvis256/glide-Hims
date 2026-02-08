import { useState, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  Tag,
  RotateCcw,
  FileText,
  ShoppingCart,
  Filter,
  Download,
  Calendar,
  Package,
  DollarSign,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';

interface ExpiringMedication {
  id: string;
  name: string;
  batch: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quantity: number;
  unitPrice: number;
  value: number;
  category: string;
  supplier: string;
  recommendedAction: 'sell-first' | 'discount' | 'return';
}

const timeframeOptions = [
  { label: '30 Days', value: 30 },
  { label: '60 Days', value: 60 },
  { label: '90 Days', value: 90 },
];

export default function ExpiringSoonPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.expiry')) {
    return <AccessDenied />;
  }

  const [selectedTimeframe, setSelectedTimeframe] = useState(90);
  const [selectedAction, setSelectedAction] = useState<string>('all');

  // Note: Backend inventory doesn't have expiry date fields yet
  // This page will show empty until expiry tracking is implemented
  const isLoading = false;

  // Empty until backend expiry tracking is available
  const medications: ExpiringMedication[] = [];

  const filteredMedications = useMemo(() => {
    return medications.filter((med) => {
      const matchesAction = selectedAction === 'all' || med.recommendedAction === selectedAction;
      return matchesAction;
    });
  }, [selectedAction, medications]);

  const stats = useMemo(() => {
    const totalValue = filteredMedications.reduce((sum, med) => sum + med.value, 0);
    const totalItems = filteredMedications.length;
    const criticalCount = filteredMedications.filter((m) => m.daysUntilExpiry <= 30).length;
    return { totalValue, totalItems, criticalCount };
  }, [filteredMedications]);

  const getUrgencyColor = (days: number) => {
    if (days <= 30) return 'text-red-600 bg-red-50';
    if (days <= 60) return 'text-amber-600 bg-amber-50';
    return 'text-blue-600 bg-blue-50';
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'sell-first':
        return { icon: ShoppingCart, label: 'Sell First', color: 'bg-green-100 text-green-700' };
      case 'discount':
        return { icon: Tag, label: 'Apply Discount', color: 'bg-amber-100 text-amber-700' };
      case 'return':
        return { icon: RotateCcw, label: 'Return to Supplier', color: 'bg-blue-100 text-blue-700' };
      default:
        return { icon: Package, label: 'Review', color: 'bg-gray-100 text-gray-700' };
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-7 h-7 text-amber-500" />
            Expiring Soon
          </h1>
          <p className="text-gray-600 mt-1">Medications approaching expiry date</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Generate Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
            <ShoppingCart className="w-4 h-4" />
            Prioritize for Sale
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Critical (&lt;30 days)</p>
              <p className="text-xl font-bold text-red-600">{stats.criticalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value at Risk</p>
              <p className="text-xl font-bold text-gray-900">${stats.totalValue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Timeframe</p>
              <p className="text-xl font-bold text-gray-900">{selectedTimeframe} Days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Timeframe:</span>
          <div className="flex gap-1">
            {timeframeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedTimeframe(option.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedTimeframe === option.value
                    ? 'bg-amber-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Action:</span>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="all">All Actions</option>
            <option value="sell-first">Sell First</option>
            <option value="discount">Apply Discount</option>
            <option value="return">Return to Supplier</option>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Expiry Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Days Left</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Recommended Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <Loader2 className="w-12 h-12 mb-3 text-amber-500 animate-spin" />
                      <p className="text-sm font-medium">Loading expiring medications...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredMedications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <Clock className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-sm font-medium">No medications expiring soon</p>
                      <p className="text-xs text-gray-400 mt-1">All inventory is within safe expiry range</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {filteredMedications.map((med) => {
                const actionBadge = getActionBadge(med.recommendedAction);
                const ActionIcon = actionBadge.icon;
                return (
                  <tr key={med.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{med.name}</p>
                        <p className="text-sm text-gray-500">{med.category}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">{med.batch}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{med.expiryDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getUrgencyColor(med.daysUntilExpiry)}`}>
                        {med.daysUntilExpiry} days
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{med.quantity} units</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">${med.value.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${actionBadge.color}`}>
                        <ActionIcon className="w-3.5 h-3.5" />
                        {actionBadge.label}
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
  );
}
