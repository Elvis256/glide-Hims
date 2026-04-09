import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Loader2,
  RefreshCw,
  ClipboardList,
  Package,
  Activity,
  FileText,
  Plus,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';

interface LabOrderStats {
  total: number;
  draft: number;
  sent: number;
  inFabrication: number;
  ready: number;
  received: number;
  overdue: number;
}

interface OrthoCase {
  id: string;
  patientName: string;
  applianceType: string;
  status: string;
  startDate: string;
}

interface LabOrder {
  id: string;
  patientName: string;
  orderType: string;
  status: string;
  labName: string;
  expectedDate: string;
  createdAt: string;
}

export default function DentalDashboardPage() {
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

  const { data: labStats, isLoading: statsLoading } = useQuery<LabOrderStats>({
    queryKey: ['dental-lab-stats', facilityId, refreshKey],
    queryFn: async () => {
      try {
        const res = await api.get('/dental/lab-orders/stats');
        return res.data;
      } catch {
        return { total: 0, draft: 0, sent: 0, inFabrication: 0, ready: 0, received: 0, overdue: 0 };
      }
    },
  });

  const { data: orthoCasesData, isLoading: orthoLoading } = useQuery({
    queryKey: ['dental-ortho-active', facilityId, refreshKey],
    queryFn: async () => {
      try {
        const res = await api.get('/dental/ortho/cases', { params: { status: 'active' } });
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const { data: pendingOrdersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['dental-pending-orders', facilityId, refreshKey],
    queryFn: async () => {
      try {
        const res = await api.get('/dental/lab-orders', { params: { status: 'sent,in_fabrication' } });
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const orthoCases = asList<OrthoCase>(orthoCasesData);
  const pendingOrders = asList<LabOrder>(pendingOrdersData);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
    toast.success('Dashboard refreshed');
  };

  const stats = [
    {
      label: 'Pending Lab Orders',
      value: labStats ? labStats.sent + labStats.inFabrication : 0,
      icon: Package,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Active Ortho Cases',
      value: orthoCases.length,
      icon: Activity,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      label: 'Orders In Fabrication',
      value: labStats?.inFabrication ?? 0,
      icon: ClipboardList,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Overdue Orders',
      value: labStats?.overdue ?? 0,
      icon: Calendar,
      color: 'text-red-600 bg-red-50',
    },
  ];

  const isLoading = statsLoading || orthoLoading || ordersLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {hospitalName ? `${hospitalName}` : 'Dental Dashboard'}
          </h1>
          <p className="text-sm text-gray-500">{bizConfig.tagline} — Lab orders, orthodontics &amp; overview</p>
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
        <button
          onClick={() => navigate('/dental/chart')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Chart
        </button>
        <button
          onClick={() => navigate('/dental/treatment-plans')}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
        >
          <FileText className="h-4 w-4" />
          New Treatment Plan
        </button>
        <button
          onClick={() => navigate('/dental/lab-orders')}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Package className="h-4 w-4" />
          New Lab Order
        </button>
      </div>

      {/* Stats Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-white p-5">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pending Lab Orders */}
          <div className="rounded-xl border bg-white">
            <div className="border-b px-6 py-4">
              <h3 className="font-semibold">Pending Lab Orders</h3>
            </div>
            {pendingOrders.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p>No pending lab orders</p>
              </div>
            ) : (
              <div className="divide-y">
                {pendingOrders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium">{order.patientName}</p>
                      <p className="text-xs text-gray-500">
                        {order.orderType} · {order.labName}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          order.status === 'sent'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </span>
                      {order.expectedDate && (
                        <p className="mt-0.5 text-xs text-gray-400">
                          Expected: {new Date(order.expectedDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Ortho Cases */}
          <div className="rounded-xl border bg-white">
            <div className="border-b px-6 py-4">
              <h3 className="font-semibold">Active Orthodontic Cases</h3>
            </div>
            {orthoCases.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Activity className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p>No active orthodontic cases</p>
              </div>
            ) : (
              <div className="divide-y">
                {orthoCases.slice(0, 10).map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium">{c.patientName}</p>
                      <p className="text-xs text-gray-500">
                        {c.applianceType} · Started {new Date(c.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
