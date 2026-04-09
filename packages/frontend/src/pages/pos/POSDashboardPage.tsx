import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Monitor,
  Clock,
  DollarSign,
  ShoppingCart,
  CreditCard,
  Smartphone,
  Banknote,
  AlertTriangle,
  Play,
  Square,
  Plus,
  TrendingUp,
  Package,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

interface Shift {
  id: string;
  cashierName: string;
  registerName: string;
  openedAt: string;
  openingBalance: number;
  salesCount: number;
  totalCash: number;
  totalMobileMoney: number;
  totalCard: number;
  totalAmount: number;
  status: 'open' | 'closed';
}

interface RecentSale {
  id: string;
  saleNumber: string;
  customerName?: string;
  totalAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface LowStockAlert {
  id: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
}

export default function POSDashboardPage() {
  const navigate = useNavigate();
  const facilityId = useFacilityId();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: currentShift, isLoading: shiftLoading } = useQuery<Shift | null>({
    queryKey: ['pos-current-shift', facilityId, refreshKey],
    queryFn: async () => {
      try {
        const res = await api.get('/pos/shifts/current');
        return res.data;
      } catch {
        return null;
      }
    },
  });

  const { data: recentSalesData, isLoading: salesLoading } = useQuery({
    queryKey: ['pos-recent-sales', facilityId, refreshKey],
    queryFn: async () => {
      const res = await api.get('/pharmacy/sales', { params: { limit: 10 } });
      return res.data;
    },
  });

  const { data: lowStockData, isLoading: alertsLoading } = useQuery({
    queryKey: ['pos-low-stock', facilityId],
    queryFn: async () => {
      try {
        const res = await api.get('/pharmacy/alerts/low-stock');
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const recentSales = asList<RecentSale>(recentSalesData);
  const lowStockAlerts = asList<LowStockAlert>(lowStockData).slice(0, 5);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    toast.success('Dashboard refreshed');
  };

  const shiftOpen = currentShift && currentShift.status === 'open';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Dashboard</h1>
          <p className="text-sm text-gray-500">Point of Sale overview and quick actions</p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {!shiftOpen ? (
          <button
            onClick={() => navigate('/pharmacy/pos/shifts')}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
          >
            <Play className="h-4 w-4" />
            Open Shift
          </button>
        ) : (
          <>
            <button
              onClick={() => navigate('/pharmacy/pos/sale')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New Sale
            </button>
            <button
              onClick={() => navigate('/pharmacy/pos/shifts')}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <Square className="h-4 w-4" />
              Close Shift
            </button>
          </>
        )}
        <button
          onClick={() => navigate('/pharmacy/pos/reports')}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <TrendingUp className="h-4 w-4" />
          Reports
        </button>
      </div>

      {/* Current Shift Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Current Shift</h2>
          {shiftOpen && (
            <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Active
            </span>
          )}
        </div>
        {shiftLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : shiftOpen && currentShift ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Cashier</p>
              <p className="font-medium text-gray-900">{currentShift.cashierName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Opened At</p>
              <p className="font-medium text-gray-900">
                {new Date(currentShift.openedAt).toLocaleTimeString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sales Count</p>
              <p className="font-medium text-gray-900">{currentShift.salesCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Register</p>
              <p className="font-medium text-gray-900">{currentShift.registerName}</p>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-gray-500">
            <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p>No active shift. Open a shift to start selling.</p>
          </div>
        )}
      </div>

      {/* Register Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2.5">
              <Banknote className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Cash</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(currentShift?.totalCash ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2.5">
              <Smartphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Mobile Money</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(currentShift?.totalMobileMoney ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2.5">
              <CreditCard className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Card</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(currentShift?.totalCard ?? 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(currentShift?.totalAmount ?? 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
          </div>
          {salesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : recentSales.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p>No recent transactions</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sale.saleNumber}</p>
                    <p className="text-xs text-gray-500">
                      {sale.customerName || 'Walk-in'} &middot;{' '}
                      {new Date(sale.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatCurrency(sale.totalAmount)}
                    </p>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {sale.paymentMethod}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h3 className="font-semibold text-gray-900">Low Stock Alerts</h3>
          </div>
          {alertsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : lowStockAlerts.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p>No low stock alerts</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {lowStockAlerts.map((item) => (
                <div key={item.id} className="px-6 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        Reorder at: {item.reorderLevel} {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="text-sm font-semibold">
                        {item.currentStock} {item.unit}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
