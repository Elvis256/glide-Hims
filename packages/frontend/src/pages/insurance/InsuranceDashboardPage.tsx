import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Shield,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  XCircle,
  Users,
  Building,
  RefreshCw,
  Loader2,
  ChevronDown,
  Search,
  ArrowUpRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { insuranceService, type AwaitingClaimEncounter } from '../../services/insurance';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';
import { format, subMonths, startOfMonth } from 'date-fns';

type StatusFilter = 'all' | 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280', '#a855f7'];

export default function InsuranceDashboardPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedEncounters, setSelectedEncounters] = useState<Set<string>>(new Set());
  const [showEncounters, setShowEncounters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const today = new Date();
  const startDate = format(subMonths(startOfMonth(today), 11), 'yyyy-MM-dd');
  const endDate = format(today, 'yyyy-MM-dd');

  // Queries
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['insurance-dashboard'],
    queryFn: () => insuranceService.dashboard.get(),
  });

  const { data: denialsRaw, isLoading: denialsLoading } = useQuery({
    queryKey: ['insurance-denials-analysis', startDate, endDate],
    queryFn: () => insuranceService.dashboard.getDenialsAnalysis({ startDate, endDate }),
  });

  const { data: providerPerfRaw } = useQuery({
    queryKey: ['insurance-provider-performance', startDate, endDate],
    queryFn: () => insuranceService.dashboard.getProviderPerformance({ startDate, endDate }),
  });

  const { data: claimsRaw } = useQuery({
    queryKey: ['insurance-claims-list'],
    queryFn: () => insuranceService.claims.list(),
  });

  const { data: encountersRaw, isLoading: encLoading } = useQuery({
    queryKey: ['insurance-awaiting-encounters'],
    queryFn: () => insuranceService.encounters.getAwaitingClaims(),
  });

  const denials = denialsRaw || {};
  const providerPerf = asList(providerPerfRaw);
  const claims = asList(claimsRaw);
  const encounters: AwaitingClaimEncounter[] = asList(encountersRaw);

  // Batch submit mutation
  const batchMutation = useMutation({
    mutationFn: (ids: string[]) => insuranceService.batchSubmitClaims(ids),
    onSuccess: (result) => {
      toast.success(`Batch complete: ${result.submitted} submitted, ${result.failed} failed`);
      if (result.errors.length > 0) {
        result.errors.forEach((e) => toast.error(`Encounter ${e.encounterId.slice(0, 8)}: ${e.error}`));
      }
      setSelectedEncounters(new Set());
      queryClient.invalidateQueries({ queryKey: ['insurance-awaiting-encounters'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-claims-list'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-dashboard'] });
    },
    onError: () => toast.error('Batch submission failed'),
  });

  // Filtered claims
  const filteredClaims = useMemo(() => {
    let result = claims;
    if (statusFilter !== 'all') {
      result = result.filter((c: any) => c.status === statusFilter);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((c: any) =>
        c.claimNumber?.toLowerCase().includes(term) ||
        c.patient?.fullName?.toLowerCase().includes(term) ||
        c.provider?.name?.toLowerCase().includes(term),
      );
    }
    return result.slice(0, 50);
  }, [claims, statusFilter, searchTerm]);

  // Helpers
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      submitted: 'bg-blue-100 text-blue-800',
      in_review: 'bg-purple-100 text-purple-800',
      acknowledged: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      partially_approved: 'bg-yellow-100 text-yellow-800',
      rejected: 'bg-red-100 text-red-800',
      paid: 'bg-emerald-100 text-emerald-800',
      appealed: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-gray-100 text-gray-600',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getRateColor = (rate: number, invert = false) => {
    const good = invert ? rate < 20 : rate > 80;
    const ok = invert ? rate < 40 : rate > 60;
    if (good) return invert ? 'text-green-600' : 'text-green-600';
    if (ok) return 'text-yellow-600';
    return invert ? 'text-red-600' : 'text-red-600';
  };

  const toggleEncounter = (id: string) => {
    setSelectedEncounters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllEncounters = () => {
    if (selectedEncounters.size === encounters.length) {
      setSelectedEncounters(new Set());
    } else {
      setSelectedEncounters(new Set(encounters.map((e) => e.encounterId)));
    }
  };

  if (dashLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  const d = dashboard || {} as any;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Claims overview, analytics, and batch operations</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['insurance-dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['insurance-denials-analysis'] });
            queryClient.invalidateQueries({ queryKey: ['insurance-provider-performance'] });
            queryClient.invalidateQueries({ queryKey: ['insurance-claims-list'] });
          }}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          icon={Shield}
          label="Active Policies"
          value={d.activePolicies ?? 0}
          color="blue"
        />
        <KpiCard
          icon={FileText}
          label="Claims This Month"
          value={d.claimsThisMonth ?? 0}
          sub={formatCurrency(d.totalClaimedThisMonth ?? 0)}
          color="purple"
        />
        <KpiCard
          icon={CheckCircle}
          label="Approval Rate"
          value={`${d.approvalRate ?? 0}%`}
          color="green"
          valueClass={getRateColor(d.approvalRate ?? 0)}
        />
        <KpiCard
          icon={DollarSign}
          label="Outstanding"
          value={formatCurrency(d.outstandingAmount ?? 0)}
          color="yellow"
        />
        <KpiCard
          icon={Clock}
          label="Avg Claim TAT"
          value={`${d.avgClaimTAT ?? 0} days`}
          color="indigo"
        />
        <KpiCard
          icon={XCircle}
          label="Denial Rate"
          value={`${d.denialRate ?? 0}%`}
          color="red"
          valueClass={getRateColor(d.denialRate ?? 0, true)}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Claims Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Claims Trend</h3>
          {(d.monthlyTrend?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={d.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="submitted" stroke="#3b82f6" name="Submitted" strokeWidth={2} />
                <Line type="monotone" dataKey="approved" stroke="#22c55e" name="Approved" strokeWidth={2} />
                <Line type="monotone" dataKey="denied" stroke="#ef4444" name="Denied" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              No trend data available
            </div>
          )}
        </div>

        {/* Denial Reasons */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Denial Reasons Breakdown</h3>
          {denialsLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (denials.topDenialReasons?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={denials.topDenialReasons}
                  dataKey="count"
                  nameKey="reason"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ reason, percentage }: any) =>
                    `${(reason || '').slice(0, 15)}${(reason || '').length > 15 ? '…' : ''} (${percentage}%)`
                  }
                >
                  {denials.topDenialReasons.map((_: any, idx: number) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: string) => [value, name]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              No denials in this period
            </div>
          )}
        </div>
      </div>

      {/* Denial Analysis Summary */}
      {!denialsLoading && denials.totalDenied > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Denial Analysis Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{denials.totalDenied}</p>
              <p className="text-xs text-gray-500">Total Denied</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{formatCurrency(denials.totalDeniedValue || 0)}</p>
              <p className="text-xs text-gray-500">Denied Value</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{denials.resubmissionSuccessRate || 0}%</p>
              <p className="text-xs text-gray-500">Resubmission Success</p>
            </div>
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{denials.avgDaysToResolution || 0} days</p>
              <p className="text-xs text-gray-500">Avg Resolution Time</p>
            </div>
          </div>
        </div>
      )}

      {/* Batch Actions - Encounters Awaiting Claims */}
      <div className="bg-white rounded-lg shadow">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowEncounters(!showEncounters)}
        >
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Encounters Awaiting Claims</h3>
              <p className="text-xs text-gray-500">{encounters.length} encounter(s) ready for claim generation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedEncounters.size > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  batchMutation.mutate(Array.from(selectedEncounters));
                }}
                disabled={batchMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {batchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
                Submit Selected ({selectedEncounters.size})
              </button>
            )}
            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showEncounters ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {showEncounters && (
          <div className="border-t">
            {encLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : encounters.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No encounters awaiting claims</div>
            ) : (
              <div className="overflow-x-auto">
                {batchMutation.isPending && (
                  <div className="px-4 py-2 bg-blue-50 border-b flex items-center gap-2 text-sm text-blue-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing batch submission...
                  </div>
                )}
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedEncounters.size === encounters.length && encounters.length > 0}
                          onChange={toggleAllEncounters}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visit #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {encounters.map((enc) => (
                      <tr key={enc.encounterId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedEncounters.has(enc.encounterId)}
                            onChange={() => toggleEncounter(enc.encounterId)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{enc.visitNumber}</td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{enc.patient.fullName}</div>
                          <div className="text-xs text-gray-500">{enc.patient.mrn}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{enc.provider.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {enc.serviceDate ? format(new Date(enc.serviceDate), 'dd MMM yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(enc.invoice.totalAmount)}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">{enc.invoice.itemCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Claims Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Recent Claims</h3>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search claims..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 py-2 text-sm w-full"
              />
            </div>
            <div className="flex border rounded-lg overflow-hidden">
              {(['all', 'submitted', 'approved', 'rejected', 'paid'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize ${
                    statusFilter === s
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Claim #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No claims found
                  </td>
                </tr>
              ) : (
                filteredClaims.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">{c.claimNumber}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{c.patient?.fullName || c.patient?.firstName || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.provider?.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(c.totalClaimed || c.totalAmount || 0)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(c.status)}`}>
                        {(c.status || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.submittedAt ? format(new Date(c.submittedAt), 'dd MMM yyyy') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider Performance Table */}
      {providerPerf.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Building className="h-4 w-4" />
              Provider Performance
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Claims</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rejected</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Denial Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg TAT (days)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Claimed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Paid</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {providerPerf.map((p: any) => {
                  const total = parseInt(p.totalClaims) || 0;
                  const rejected = parseInt(p.rejectedClaims) || 0;
                  const denialRate = total > 0 ? Math.round((rejected / total) * 100) : 0;
                  return (
                    <tr key={p.providerId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.providerName || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm text-center">{total}</td>
                      <td className="px-4 py-3 text-sm text-center text-green-600">{parseInt(p.paidClaims) || 0}</td>
                      <td className="px-4 py-3 text-sm text-center text-red-600">{rejected}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-medium ${getRateColor(denialRate, true)}`}>
                          {denialRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{Math.round(parseFloat(p.avgDaysToPayment) || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(parseFloat(p.totalClaimed) || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(parseFloat(p.totalPaid) || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// KPI Card Component
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  valueClass,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  valueClass?: string;
}) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    yellow: 'bg-yellow-100',
    red: 'bg-red-100',
    purple: 'bg-purple-100',
    indigo: 'bg-indigo-100',
    orange: 'bg-orange-100',
  };
  const iconMap: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    orange: 'text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p className={`text-lg font-bold mt-1 ${valueClass || 'text-gray-900'}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`${bgMap[color] || 'bg-gray-100'} p-2 rounded-full flex-shrink-0 ml-2`}>
          <Icon className={`h-5 w-5 ${iconMap[color] || 'text-gray-600'}`} />
        </div>
      </div>
    </div>
  );
}
