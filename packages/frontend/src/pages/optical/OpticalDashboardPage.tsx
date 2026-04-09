import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  Glasses,
  ShoppingCart,
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  ArrowRight,
  Activity,
  Clock,
  CheckCircle,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineCounts {
  ordered: number;
  in_lab: number;
  lens_cutting: number;
  fitting: number;
  quality_check: number;
  ready: number;
  delivered: number;
}

interface OpticalStats {
  todayExams: number;
  activePrescriptions: number;
  pendingOrders: number;
  lowStockFrames: number;
  pipeline: PipelineCounts;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  patientName: string;
  frameName: string;
  lensType: string;
  total: number;
  status: string;
  createdAt: string;
}

interface LowStockFrame {
  id: string;
  brand: string;
  model: string;
  currentStock: number;
  reorderLevel: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_STEPS: { key: keyof PipelineCounts; label: string; color: string; icon: React.ReactNode }[] = [
  { key: 'ordered',       label: 'Ordered',       color: 'bg-yellow-500', icon: <ShoppingCart className="h-3.5 w-3.5" /> },
  { key: 'in_lab',        label: 'In Lab',        color: 'bg-blue-500',   icon: <Activity className="h-3.5 w-3.5" /> },
  { key: 'lens_cutting',  label: 'Lens Cutting',  color: 'bg-indigo-500', icon: <Glasses className="h-3.5 w-3.5" /> },
  { key: 'fitting',       label: 'Fitting',       color: 'bg-purple-500', icon: <Eye className="h-3.5 w-3.5" /> },
  { key: 'quality_check', label: 'QC',            color: 'bg-orange-500', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  { key: 'ready',         label: 'Ready',         color: 'bg-emerald-500',icon: <Package className="h-3.5 w-3.5" /> },
  { key: 'delivered',     label: 'Delivered',     color: 'bg-green-600',  icon: <Truck className="h-3.5 w-3.5" /> },
];

const STATUS_BADGE: Record<string, string> = {
  ordered:       'bg-yellow-100 text-yellow-800',
  in_lab:        'bg-blue-100 text-blue-800',
  lens_cutting:  'bg-indigo-100 text-indigo-800',
  fitting:       'bg-purple-100 text-purple-800',
  quality_check: 'bg-orange-100 text-orange-800',
  ready:         'bg-emerald-100 text-emerald-800',
  delivered:     'bg-green-100 text-green-800',
  cancelled:     'bg-red-100 text-red-800',
};

const DEFAULT_PIPELINE: PipelineCounts = {
  ordered: 0,
  in_lab: 0,
  lens_cutting: 0,
  fitting: 0,
  quality_check: 0,
  ready: 0,
  delivered: 0,
};

const DEFAULT_STATS: OpticalStats = {
  todayExams: 0,
  activePrescriptions: 0,
  pendingOrders: 0,
  lowStockFrames: 0,
  pipeline: DEFAULT_PIPELINE,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OpticalDashboardPage() {
  const navigate = useNavigate();
  const facilityId = useFacilityId();
  const [refreshKey, setRefreshKey] = useState(0);
  const bizConfig = useBusinessConfig();

  const hospitalName = (() => {
    try {
      const stored = localStorage.getItem('glide_hospital_settings');
      if (stored) return JSON.parse(stored).name || '';
    } catch { /* use default */ }
    return '';
  })();

  // ---- Queries ------------------------------------------------------------

  const { data: stats = DEFAULT_STATS, isLoading: statsLoading } = useQuery<OpticalStats>({
    queryKey: ['optical-stats', facilityId, refreshKey],
    queryFn: async () => {
      try {
        const res = await api.get(`/optical/orders/stats?facilityId=${facilityId}`);
        const d = res.data ?? {};
        return {
          todayExams: d.todayExams ?? 0,
          activePrescriptions: d.activePrescriptions ?? 0,
          pendingOrders: d.pendingOrders ?? 0,
          lowStockFrames: d.lowStockFrames ?? 0,
          pipeline: { ...DEFAULT_PIPELINE, ...(d.pipeline ?? {}) },
        };
      } catch {
        return DEFAULT_STATS;
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: recentOrders = [], isLoading: ordersLoading } = useQuery<RecentOrder[]>({
    queryKey: ['optical-recent-orders', facilityId, refreshKey],
    queryFn: async () => {
      try {
        const res = await api.get(`/optical/orders?facilityId=${facilityId}&limit=10`);
        return asList<RecentOrder>(res.data);
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });

  const { data: lowStockFrames = [], isLoading: framesLoading } = useQuery<LowStockFrame[]>({
    queryKey: ['optical-low-stock', facilityId, refreshKey],
    queryFn: async () => {
      try {
        const res = await api.get(`/optical/frames?facilityId=${facilityId}&belowReorder=true`);
        return asList<LowStockFrame>(res.data);
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  // ---- Handlers -----------------------------------------------------------

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    toast.success('Dashboard refreshed');
  };

  // ---- Derived values -----------------------------------------------------

  const pipelineTotal = Object.values(stats.pipeline).reduce((a, b) => a + b, 0);

  // ---- Render -------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hospitalName ? `${hospitalName}` : 'Optical Dashboard'}
          </h1>
          <p className="text-gray-600">{bizConfig.tagline} — Exams, prescriptions, orders &amp; inventory</p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          icon={<Eye className="h-6 w-6 text-blue-600" />}
          label="Today's Exams"
          value={stats.todayExams}
          loading={statsLoading}
          bgColor="bg-blue-50"
        />
        <StatsCard
          icon={<Glasses className="h-6 w-6 text-purple-600" />}
          label="Active Prescriptions"
          value={stats.activePrescriptions}
          loading={statsLoading}
          bgColor="bg-purple-50"
        />
        <StatsCard
          icon={<ShoppingCart className="h-6 w-6 text-amber-600" />}
          label="Pending Orders"
          value={stats.pendingOrders}
          loading={statsLoading}
          bgColor="bg-amber-50"
        />
        <StatsCard
          icon={<AlertTriangle className="h-6 w-6 text-red-600" />}
          label="Low Stock Frames"
          value={stats.lowStockFrames}
          loading={statsLoading}
          bgColor="bg-red-50"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <QuickAction label="New Exam" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/optical/exams')} />
        <QuickAction label="New Prescription" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/optical/prescriptions')} />
        <QuickAction label="New Order" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/optical/orders')} />
      </div>

      {/* Order Pipeline */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Pipeline</h2>
        {pipelineTotal === 0 ? (
          <p className="text-sm text-gray-500">No orders in the pipeline.</p>
        ) : (
          <>
            {/* Pipeline bar */}
            <div className="flex h-10 rounded-lg overflow-hidden mb-4">
              {PIPELINE_STEPS.map((step) => {
                const count = stats.pipeline[step.key];
                if (count === 0) return null;
                const pct = (count / pipelineTotal) * 100;
                return (
                  <div
                    key={step.key}
                    className={`${step.color} flex items-center justify-center text-white text-xs font-medium transition-all`}
                    style={{ width: `${pct}%`, minWidth: count > 0 ? '2rem' : 0 }}
                    title={`${step.label}: ${count}`}
                  >
                    {pct > 6 ? count : ''}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {PIPELINE_STEPS.map((step) => (
                <div key={step.key} className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-full ${step.color}`} />
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    {step.icon}
                    <span>{step.label}</span>
                  </div>
                  <span className="ml-auto text-sm font-semibold text-gray-900">
                    {stats.pipeline[step.key]}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Recent Orders + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <button
              onClick={() => navigate('/optical/orders')}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {ordersLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">No recent orders found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Order #</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Patient</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Frame</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Lens</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">Total</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/optical/orders/${order.id}`)}>
                      <td className="px-3 py-2 font-medium text-gray-900">{order.orderNumber}</td>
                      <td className="px-3 py-2 text-gray-700">{order.patientName}</td>
                      <td className="px-3 py-2 text-gray-700">{order.frameName}</td>
                      <td className="px-3 py-2 text-gray-700">{order.lensType}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(order.total)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Frames */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Frames
            </h2>
            <button
              onClick={() => navigate('/optical/frames')}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {framesLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : lowStockFrames.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">All frames are sufficiently stocked.</p>
          ) : (
            <ul className="space-y-3">
              {lowStockFrames.map((frame) => (
                <li key={frame.id} className="flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{frame.brand}</p>
                    <p className="text-xs text-gray-600">{frame.model}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">{frame.currentStock} in stock</p>
                    <p className="text-xs text-gray-500">Reorder: {frame.reorderLevel}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatsCard({
  icon,
  label,
  value,
  loading,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
      <div className={`${bgColor} rounded-lg p-3`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        {loading ? (
          <div className="h-7 w-12 animate-pulse rounded bg-gray-200 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
    >
      {icon}
      {label}
    </button>
  );
}
