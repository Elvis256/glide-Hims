import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';
import { api } from '../../../services/api';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  BarChart3,
  FileText,
  Users,
  RefreshCw,
  Calendar,
  Zap,
  DollarSign,
  AlertOctagon,
} from 'lucide-react';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';

interface PendingApproval {
  documentId: string;
  documentType: 'PR' | 'PO';
  documentNumber: string;
  amount: number;
  createdAt: string;
  level: number;
  requiredRole: string;
  daysPending: number;
}

interface ApprovalHistoryItem {
  level: number;
  requiredRole: string;
  status: 'pending' | 'approved' | 'rejected';
  approver: { id: string; fullName: string } | null;
  approvedBy: { id: string; fullName: string } | null;
  approvedAt: string | null;
  comments: string | null;
}

interface Bottleneck {
  level: number;
  avgDays: number;
  completedCount: number;
}

interface Escalation {
  documentId: string;
  documentType: 'PR' | 'PO';
  documentNumber: string;
  amount: number;
  level: number;
  requiredRole: string;
  daysPending: number;
  approver: { id: string; fullName: string } | null;
}

interface DashboardSummary {
  pending: number;
  approved: number;
  rejected: number;
  avgApprovalDays: number;
  bottlenecks: number;
  escalations: number;
  escalationList: Escalation[];
}

export default function ApprovalDashboardPage() {
  const { user } = useAuthStore();
  const [selectedDocType, setSelectedDocType] = useState<'PR' | 'PO' | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>(user?.roles?.[0]?.name || 'manager');
  const facilityId = user?.facilityId || '';

  // Fetch pending approvals
  const { data: pendingData = [], isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['approvals:pending', roleFilter, facilityId],
    queryFn: async () => {
      const res = await api.get(`/procurement/approvals/pending`, {
        params: { facilityId, role: roleFilter },
      });
      return res.data.data || [];
    },
    enabled: !!facilityId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch dashboard summary
  const { data: summary = null, isLoading: summaryLoading } = useQuery({
    queryKey: ['approvals:summary', facilityId],
    queryFn: async () => {
      const res = await api.get(`/procurement/approvals/summary`, {
        params: { facilityId },
      });
      return res.data.data || null;
    },
    enabled: !!facilityId,
    staleTime: 30000,
  });

  // Fetch bottlenecks
  const { data: bottlenecks = [], isLoading: bottleneckLoading } = useQuery({
    queryKey: ['approvals:bottlenecks', facilityId],
    queryFn: async () => {
      const res = await api.get(`/procurement/approvals/bottlenecks`, {
        params: { facilityId },
      });
      return res.data.data || [];
    },
    enabled: !!facilityId,
    staleTime: 60000,
  });

  // Fetch escalations
  const { data: escalations = [], isLoading: escalationLoading } = useQuery({
    queryKey: ['approvals:escalations', facilityId],
    queryFn: async () => {
      const res = await api.get(`/procurement/approvals/escalations`, {
        params: { facilityId, days: 5 },
      });
      return res.data.data || [];
    },
    enabled: !!facilityId,
    staleTime: 30000,
  });

  // Fetch budget information
  const { data: budget = null, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget:status', facilityId],
    queryFn: async () => {
      try {
        const res = await api.get(`/finance/budget`, {
          params: { facilityId },
        });
        return res.data.data || null;
      } catch {
        return null;
      }
    },
    enabled: !!facilityId,
    staleTime: 60000,
  });

  // Fetch supplier risk alerts (items flagged for risk)
  const { data: supplierRisks = [], isLoading: riskLoading } = useQuery({
    queryKey: ['procurement:supplier-risks', facilityId],
    queryFn: async () => {
      try {
        const res = await api.get(`/procurement/approvals/supplier-risks`, {
          params: { facilityId },
        });
        return res.data.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!facilityId,
    staleTime: 30000,
  });

  const filteredPending = useMemo(() => {
    if (!pendingData) return [];
    if (selectedDocType === 'ALL') return pendingData;
    return pendingData.filter((p: PendingApproval) => p.documentType === selectedDocType);
  }, [pendingData, selectedDocType]);

  const daysToMinutes = (days: number): string => {
    if (days < 1) {
      const hours = Math.floor(days * 24);
      return `${hours}h`;
    }
    return `${Math.floor(days)}d`;
  };

  const isLoading = pendingLoading || summaryLoading || bottleneckLoading || escalationLoading || budgetLoading || riskLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Approval Dashboard</h1>
              <p className="mt-1 text-sm text-gray-600">Monitor purchase requests and order approvals</p>
            </div>
            <button
              onClick={() => refetchPending()}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* Pending Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="mt-2 text-3xl font-bold text-yellow-600">{summary?.pending || 0}</p>
              </div>
              <Clock className="h-12 w-12 text-yellow-200" />
            </div>
          </div>

          {/* Approved Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="mt-2 text-3xl font-bold text-green-600">{summary?.approved || 0}</p>
              </div>
              <CheckCircle2 className="h-12 w-12 text-green-200" />
            </div>
          </div>

          {/* Rejected Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="mt-2 text-3xl font-bold text-red-600">{summary?.rejected || 0}</p>
              </div>
              <XCircle className="h-12 w-12 text-red-200" />
            </div>
          </div>

          {/* Avg Approval Time Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Time</p>
                <p className="mt-2 text-3xl font-bold text-blue-600">{summary?.avgApprovalDays || 0}d</p>
              </div>
              <Calendar className="h-12 w-12 text-blue-200" />
            </div>
          </div>

          {/* Escalations Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Escalations</p>
                <p className="mt-2 text-3xl font-bold text-red-600">{summary?.escalations || 0}</p>
              </div>
              <AlertTriangle className="h-12 w-12 text-red-200" />
            </div>
          </div>
        </div>

        {/* Budget & Risk Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {/* Budget Card */}
          {budget && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Budget Status</h3>
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Allocated</span>
                  <span className="font-medium text-gray-900">{formatCurrency(budget.budgetAllocated || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Used (GL)</span>
                  <span className="font-medium text-gray-900">{formatCurrency(budget.budgetUsed || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Available</span>
                  <span className={`font-medium ${(budget.budgetAvailable || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(budget.budgetAvailable || 0)}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (budget.percentageUsed || 0) < 10 ? 'bg-green-500' : 
                        (budget.percentageUsed || 0) < 30 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(budget.percentageUsed || 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{(budget.percentageUsed || 0).toFixed(1)}% used</p>
                </div>
              </div>
            </div>
          )}

          {/* Supplier Risk Alerts */}
          {supplierRisks.length > 0 ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Supplier Risk Alerts</h3>
                <AlertOctagon className="h-6 w-6 text-red-600" />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {supplierRisks.slice(0, 5).map((risk: any) => (
                  <div key={risk.documentId} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-red-900 truncate">
                          {risk.riskType}: {risk.supplierName}
                        </p>
                        <p className="text-xs text-red-700 truncate">{risk.documentType} {risk.documentNumber}</p>
                        <p className="text-xs text-red-600 mt-1">{risk.riskReason}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {supplierRisks.length > 5 && (
                  <p className="text-xs text-gray-600 text-center py-2">+{supplierRisks.length - 5} more alerts</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Supplier Risk Alerts</h3>
                <AlertOctagon className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">✓ No supplier risk alerts at this time</p>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pending Approvals */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Pending Approvals</h2>
              </div>

              {/* Filters */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value as 'PR' | 'PO' | 'ALL')}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="ALL">All</option>
                      <option value="PR">Purchase Requests</option>
                      <option value="PO">Purchase Orders</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="manager">Manager</option>
                      <option value="finance_officer">Finance Officer</option>
                      <option value="director">Director</option>
                      <option value="cfo">CFO</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Approvals List */}
              <div className="divide-y divide-gray-200">
                {pendingLoading ? (
                  <div className="px-6 py-8 text-center">
                    <div className="inline-flex items-center text-gray-500">
                      <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                      Loading approvals...
                    </div>
                  </div>
                ) : filteredPending.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No pending approvals for this role
                  </div>
                ) : (
                  filteredPending.map((approval: PendingApproval) => (
                    <div key={`${approval.documentType}-${approval.documentId}`} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${approval.documentType === 'PR' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                {approval.documentType}
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{approval.documentNumber}</p>
                              <p className="text-sm text-gray-600">Level {approval.level} • {approval.requiredRole}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{CURRENCY_SYMBOL}{formatCurrency(approval.amount)}</p>
                          <p className={`text-sm font-medium ${approval.daysPending > 5 ? 'text-red-600' : 'text-gray-600'}`}>
                            {daysToMinutes(approval.daysPending)} pending
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-8">
            {/* Escalations Alert */}
            {(summary?.escalations || 0) > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold text-red-900">Escalations</h3>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {escalationLoading ? (
                    <div className="px-6 py-4 text-center text-sm text-gray-500">Loading...</div>
                  ) : escalations.length === 0 ? (
                    <div className="px-6 py-4 text-center text-sm text-gray-500">No escalations</div>
                  ) : (
                    escalations.map((esc: Escalation) => (
                      <div key={`${esc.documentType}-${esc.documentId}`} className="px-6 py-4 text-sm">
                        <p className="font-semibold text-gray-900">{esc.documentNumber}</p>
                        <p className="text-xs text-gray-600 mt-1">{CURRENCY_SYMBOL}{formatCurrency(esc.amount)}</p>
                        <p className="text-xs text-red-600 font-medium mt-1">{esc.daysPending}d pending</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Bottlenecks */}
            {bottlenecks.length > 0 && (
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Slow Levels</h3>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {bottlenecks.map((bn: Bottleneck) => (
                    <div key={bn.level} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">Level {bn.level}</p>
                          <p className="text-xs text-gray-600">{bn.completedCount} completed</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-orange-600">{bn.avgDays}d avg</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
