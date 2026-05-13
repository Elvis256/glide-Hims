import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Eye,
  Stethoscope,
  Wrench,
  Building,
  User,
  MessageSquare,
  History,
  KeyRound,
  ScrollText,
} from 'lucide-react';
import api from '../../services/api';
import { userDisplayName } from '../../utils/userName';

interface SupportAccessRequest {
  id: string;
  tenantId: string;
  requestedById: string;
  requestedBy?: { firstName: string; lastName: string; username: string };
  requestedTier: number;
  requestedDurationHours: number;
  reason: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  reviewedById?: string;
  reviewedBy?: { firstName: string; lastName: string; username?: string };
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  tenant?: { name: string; slug: string };
}

interface SupportAccessGrant {
  id: string;
  tenantId: string;
  grantedToId: string;
  grantedTo?: { firstName: string; lastName: string; username?: string };
  grantedById: string;
  grantedBy?: { firstName: string; lastName: string; username?: string };
  accessTier: number;
  expiresAt: string;
  reason?: string;
  revokedAt?: string | null;
  revokedById?: string | null;
  createdAt: string;
  tenant?: { name: string; slug: string };
}

const tierLabels: Record<number, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  1: { label: 'Metadata Only', icon: <Eye className="w-4 h-4" />, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  2: { label: 'Clinical Read', icon: <Stethoscope className="w-4 h-4" />, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  3: { label: 'Full Support', icon: <Wrench className="w-4 h-4" />, color: 'text-red-600', bgColor: 'bg-red-50' },
};

const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-700',
};

type Tab = 'pending' | 'history' | 'grants';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(ms: number) {
  if (ms <= 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days}d ${remHours}h` : `${days}d`;
}

export default function SystemSupportRequestsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [selectedRequest, setSelectedRequest] = useState<SupportAccessRequest | null>(null);
  const [denyNotes, setDenyNotes] = useState('');
  const [showDenyModal, setShowDenyModal] = useState(false);
  const queryClient = useQueryClient();

  const pendingQ = useQuery({
    queryKey: ['system-support-requests', 'pending'],
    queryFn: async () => {
      const res = await api.get('/support-access/requests/pending');
      return (res.data?.data || res.data || []) as SupportAccessRequest[];
    },
    refetchInterval: 30000,
  });

  const historyQ = useQuery({
    queryKey: ['system-support-requests', 'all'],
    queryFn: async () => {
      const res = await api.get('/support-access/requests/all');
      return (res.data?.data || res.data || []) as SupportAccessRequest[];
    },
    enabled: tab === 'history',
  });

  const grantsQ = useQuery({
    queryKey: ['system-support-grants', 'all'],
    queryFn: async () => {
      const res = await api.get('/support-access/grants/all');
      return (res.data?.data || res.data || []) as SupportAccessGrant[];
    },
    enabled: tab === 'grants',
    refetchInterval: tab === 'grants' ? 60000 : undefined,
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await api.post(`/support-access/requests/${requestId}/approve`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Support access request approved. Access grant created.');
      queryClient.invalidateQueries({ queryKey: ['system-support-requests'] });
      queryClient.invalidateQueries({ queryKey: ['system-support-grants'] });
      setSelectedRequest(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve request');
    },
  });

  const denyMutation = useMutation({
    mutationFn: async ({ requestId, reviewNotes }: { requestId: string; reviewNotes?: string }) => {
      const res = await api.post(`/support-access/requests/${requestId}/deny`, { reviewNotes });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Support access request denied.');
      queryClient.invalidateQueries({ queryKey: ['system-support-requests'] });
      setShowDenyModal(false);
      setSelectedRequest(null);
      setDenyNotes('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to deny request');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (grantId: string) => {
      const res = await api.delete(`/support-access/revoke/${grantId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Access grant revoked.');
      queryClient.invalidateQueries({ queryKey: ['system-support-grants'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to revoke grant');
    },
  });

  const pendingRequests = useMemo(
    () => (pendingQ.data || []).filter(r => r.status === 'pending'),
    [pendingQ.data],
  );

  const isLoading =
    (tab === 'pending' && pendingQ.isLoading) ||
    (tab === 'history' && historyQ.isLoading) ||
    (tab === 'grants' && grantsQ.isLoading);

  const refresh = () => {
    if (tab === 'pending') pendingQ.refetch();
    if (tab === 'history') historyQ.refetch();
    if (tab === 'grants') grantsQ.refetch();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Shield className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Access</h1>
            <p className="text-sm text-gray-500">Review tenant requests, history, and active grants</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingRequests.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {pendingRequests.length} pending
            </span>
          )}
          <Link
            to="/system/audit-logs"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-sm"
          >
            <ScrollText className="w-4 h-4" />
            Audit logs
          </Link>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-6">
          {[
            { id: 'pending' as Tab, label: 'Pending', icon: <AlertTriangle className="w-4 h-4" />, count: pendingRequests.length },
            { id: 'history' as Tab, label: 'Request History', icon: <History className="w-4 h-4" /> },
            { id: 'grants' as Tab, label: 'Access Grants', icon: <KeyRound className="w-4 h-4" /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-1 py-3 border-b-2 text-sm font-medium ${
                tab === t.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon}
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : tab === 'pending' ? (
        <PendingTab
          requests={pendingRequests}
          onApprove={id => approveMutation.mutate(id)}
          onDeny={r => {
            setSelectedRequest(r);
            setShowDenyModal(true);
          }}
          approving={approveMutation.isPending}
        />
      ) : tab === 'history' ? (
        <HistoryTab requests={historyQ.data || []} />
      ) : (
        <GrantsTab
          grants={grantsQ.data || []}
          onRevoke={id => {
            if (window.confirm('Revoke this access grant immediately?')) revokeMutation.mutate(id);
          }}
          revoking={revokeMutation.isPending}
        />
      )}

      {/* Deny Modal */}
      {showDenyModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Deny Support Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              Deny the support access request from{' '}
              <strong>{userDisplayName(selectedRequest.requestedBy, 'tenant admin')}</strong>
              {selectedRequest.tenant?.name ? ` at ${selectedRequest.tenant.name}` : ''}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={denyNotes}
                onChange={e => setDenyNotes(e.target.value)}
                placeholder="Reason for denial..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDenyModal(false);
                  setDenyNotes('');
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  denyMutation.mutate({
                    requestId: selectedRequest.id,
                    reviewNotes: denyNotes || undefined,
                  })
                }
                disabled={denyMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {denyMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Deny Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pending Tab ──────────────────────────────────────────────

function PendingTab({
  requests,
  onApprove,
  onDeny,
  approving,
}: {
  requests: SupportAccessRequest[];
  onApprove: (id: string) => void;
  onDeny: (r: SupportAccessRequest) => void;
  approving: boolean;
}) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">All Clear</h3>
        <p className="text-sm text-gray-500 mt-1">No pending support access requests</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {requests.map(request => {
        const tier = tierLabels[request.requestedTier] || tierLabels[1];
        return (
          <div key={request.id} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-lg ${tier.bgColor}`}>
                  <Shield className={`w-5 h-5 ${tier.color}`} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-gray-900">
                      {request.tenant?.name || `Tenant ${request.tenantId.slice(0, 8)}`}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {userDisplayName(request.requestedBy, 'Unknown')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {timeAgo(request.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" />
                      {request.tenant?.slug || '—'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tier.bgColor} ${tier.color}`}>
                      {tier.icon}
                      {tier.label}
                    </span>
                    <span className="text-sm text-gray-600">
                      {request.requestedDurationHours}h duration requested
                    </span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-sm text-gray-700">{request.reason}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() => onDeny(request)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                >
                  <XCircle className="w-4 h-4" />
                  Deny
                </button>
                <button
                  onClick={() => onApprove(request.id)}
                  disabled={approving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                >
                  {approving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Approve
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────

function HistoryTab({ requests }: { requests: SupportAccessRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No requests yet</h3>
        <p className="text-sm text-gray-500 mt-1">Tenant support access requests will appear here.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Requested</th>
            <th className="px-4 py-3 text-left">Tenant</th>
            <th className="px-4 py-3 text-left">Requested by</th>
            <th className="px-4 py-3 text-left">Tier / Duration</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Reviewed by</th>
            <th className="px-4 py-3 text-left">Reason / Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.map(r => {
            const tier = tierLabels[r.requestedTier] || tierLabels[1];
            return (
              <tr key={r.id} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  <div>{new Date(r.createdAt).toLocaleString()}</div>
                  <div className="text-xs text-gray-400">{timeAgo(r.createdAt)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {r.tenant?.name || r.tenantId.slice(0, 8)}
                  </div>
                  <div className="text-xs text-gray-400">{r.tenant?.slug || '—'}</div>
                </td>
                <td className="px-4 py-3">{userDisplayName(r.requestedBy, '—')}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${tier.bgColor} ${tier.color}`}>
                    {tier.icon}
                    {tier.label}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">{r.requestedDurationHours}h requested</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.status] || statusBadge.pending}`}>
                    {r.status}
                  </span>
                  {r.reviewedAt && (
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(r.reviewedAt).toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{r.reviewedBy ? userDisplayName(r.reviewedBy, '—') : '—'}</td>
                <td className="px-4 py-3 max-w-md">
                  <div className="text-gray-700">{r.reason}</div>
                  {r.reviewNotes && (
                    <div className="text-xs text-gray-500 mt-1 italic">Review: {r.reviewNotes}</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Grants Tab ──────────────────────────────────────────────

function GrantsTab({
  grants,
  onRevoke,
  revoking,
}: {
  grants: SupportAccessGrant[];
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  if (grants.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <KeyRound className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No access grants yet</h3>
        <p className="text-sm text-gray-500 mt-1">
          Approving a request creates an access grant. They appear here.
        </p>
      </div>
    );
  }
  const now = Date.now();
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Started</th>
            <th className="px-4 py-3 text-left">Tenant</th>
            <th className="px-4 py-3 text-left">Admin (granted to)</th>
            <th className="px-4 py-3 text-left">Tier</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Lasted / Ends</th>
            <th className="px-4 py-3 text-left">Granted by</th>
            <th className="px-4 py-3 text-left">Reason</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {grants.map(g => {
            const tier = tierLabels[g.accessTier] || tierLabels[1];
            const startMs = new Date(g.createdAt).getTime();
            const expiresMs = new Date(g.expiresAt).getTime();
            const revokedMs = g.revokedAt ? new Date(g.revokedAt).getTime() : null;
            const endMs = revokedMs ?? expiresMs;
            const isActive = !revokedMs && expiresMs > now;
            const status = revokedMs ? 'revoked' : expiresMs <= now ? 'expired' : 'active';
            const statusColor =
              status === 'active'
                ? 'bg-green-100 text-green-800'
                : status === 'revoked'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-700';
            const lastedMs = endMs - startMs;
            return (
              <tr key={g.id} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  <div>{new Date(g.createdAt).toLocaleString()}</div>
                  <div className="text-xs text-gray-400">{timeAgo(g.createdAt)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {g.tenant?.name || g.tenantId.slice(0, 8)}
                  </div>
                  <div className="text-xs text-gray-400">{g.tenant?.slug || '—'}</div>
                </td>
                <td className="px-4 py-3">{userDisplayName(g.grantedTo, '—')}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${tier.bgColor} ${tier.color}`}>
                    {tier.icon}
                    {tier.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                    {status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-gray-700">{formatDuration(lastedMs)}</div>
                  <div className="text-xs text-gray-400">
                    {isActive
                      ? `expires ${new Date(expiresMs).toLocaleString()}`
                      : revokedMs
                        ? `revoked ${new Date(revokedMs).toLocaleString()}`
                        : `expired ${new Date(expiresMs).toLocaleString()}`}
                  </div>
                </td>
                <td className="px-4 py-3">{userDisplayName(g.grantedBy, '—')}</td>
                <td className="px-4 py-3 max-w-xs text-gray-700">{g.reason || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {isActive && (
                    <button
                      onClick={() => onRevoke(g.id)}
                      disabled={revoking}
                      className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-xs disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
