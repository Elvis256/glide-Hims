import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  RefreshCw,
  Loader2,
  Eye,
  Pencil,
  Stethoscope,
  Wrench,
  Info,
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
  reviewedBy?: { firstName: string; lastName: string };
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

interface SupportAccessGrant {
  id: string;
  grantedToId: string;
  grantedTo?: { firstName: string; lastName: string; username: string };
  accessTier: number;
  expiresAt: string;
  reason: string;
  revokedAt?: string;
  createdAt: string;
}

const tierLabels: Record<number, { label: string; icon: React.ReactNode; color: string }> = {
  1: { label: 'Metadata Only', icon: <Eye className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
  2: { label: 'Clinical Read', icon: <Stethoscope className="w-4 h-4" />, color: 'text-yellow-600 bg-yellow-50' },
  3: { label: 'Full Support', icon: <Wrench className="w-4 h-4" />, color: 'text-red-600 bg-red-50' },
};

const statusStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  approved: <CheckCircle className="w-3.5 h-3.5" />,
  denied: <XCircle className="w-3.5 h-3.5" />,
  expired: <AlertTriangle className="w-3.5 h-3.5" />,
};

export default function SupportAccessPage() {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestTier, setRequestTier] = useState(2);
  const [requestDuration, setRequestDuration] = useState(4);
  const [requestReason, setRequestReason] = useState('');
  const queryClient = useQueryClient();

  // Fetch existing requests for this tenant
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['support-access-requests'],
    queryFn: async () => {
      const res = await api.get('/support-access/requests');
      return (res.data?.data || res.data || []) as SupportAccessRequest[];
    },
  });

  // Fetch active grants for this tenant
  const { data: grants, isLoading: grantsLoading } = useQuery({
    queryKey: ['support-access-grants'],
    queryFn: async () => {
      const res = await api.get('/support-access/tenant-grants');
      return (res.data?.data || res.data || []) as SupportAccessGrant[];
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async (data: { requestedTier: number; requestedDurationHours: number; reason: string }) => {
      const res = await api.post('/support-access/request', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Support access request submitted. System administrators will be notified.');
      queryClient.invalidateQueries({ queryKey: ['support-access-requests'] });
      setShowRequestForm(false);
      setRequestReason('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to submit request');
    },
  });

  const revokeGrantMutation = useMutation({
    mutationFn: async (grantId: string) => {
      await api.delete(`/support-access/revoke/${grantId}`);
    },
    onSuccess: () => {
      toast.success('Support access revoked');
      queryClient.invalidateQueries({ queryKey: ['support-access-grants'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to revoke access');
    },
  });

  const handleSubmitRequest = () => {
    if (requestReason.length < 10) {
      toast.error('Please provide a detailed reason (at least 10 characters)');
      return;
    }
    createRequestMutation.mutate({
      requestedTier: requestTier,
      requestedDurationHours: requestDuration,
      reason: requestReason,
    });
  };

  const activeGrants = (grants || []).filter(g => !g.revokedAt && new Date(g.expiresAt) > new Date());
  const hasPendingRequest = (requests || []).some(r => r.status === 'pending');

  return (
    <div className="p-6 bg-gray-50 min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Shield className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Support Access</h1>
            <p className="text-sm text-gray-500">Manage system administrator support access to your organization</p>
          </div>
        </div>
        <button
          onClick={() => setShowRequestForm(true)}
          disabled={hasPendingRequest}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          Request Support Access
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">How Support Access Works</p>
          <p className="mt-1">When you need technical support, request access for a system administrator. They&apos;ll receive a notification and can approve time-limited, tiered access to help resolve your issue. You can revoke access at any time.</p>
        </div>
      </div>

      {/* Active Grants */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Support Access</h2>
          <span className="text-sm text-gray-500">{activeGrants.length} active</span>
        </div>
        <div className="p-6">
          {grantsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : activeGrants.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No active support access grants</p>
          ) : (
            <div className="space-y-3">
              {activeGrants.map(grant => {
                const tier = tierLabels[grant.accessTier] || tierLabels[1];
                const expiresIn = Math.max(0, Math.round((new Date(grant.expiresAt).getTime() - Date.now()) / 3600000));
                return (
                  <div key={grant.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${tier.color}`}>
                        {tier.icon}
                        {tier.label}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {grant.grantedTo ? `${grant.grantedTo.firstName} ${grant.grantedTo.lastName}` : 'System Admin'}
                        </p>
                        <p className="text-xs text-gray-500">{grant.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">
                        <Clock className="w-3.5 h-3.5 inline mr-1" />
                        {expiresIn}h remaining
                      </span>
                      <button
                        onClick={() => revokeGrantMutation.mutate(grant.id)}
                        className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Request History */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Request History</h2>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['support-access-requests'] })}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (requests || []).length === 0 ? (
            <p className="text-center text-gray-500 py-8">No support access requests yet</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reviewed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(requests || []).map(req => {
                  const tier = tierLabels[req.requestedTier] || tierLabels[1];
                  return (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${tier.color}`}>
                          {tier.icon}
                          {tier.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{req.requestedDurationHours}h</td>
                      <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{req.reason}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyles[req.status]}`}>
                          {statusIcons[req.status]}
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {userDisplayName(req.reviewedBy)}
                        {req.reviewNotes && (
                          <p className="text-xs text-gray-400 mt-0.5">{req.reviewNotes}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Request Form Modal */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Request Support Access</h3>
            <p className="text-sm text-gray-500 mb-6">
              Submit a request for a system administrator to access your organization for technical support.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Access Tier</label>
                <div className="space-y-2">
                  {[1, 2, 3].map(t => {
                    const tier = tierLabels[t];
                    const descriptions: Record<number, string> = {
                      1: 'View system configuration and user metadata only',
                      2: 'Read access to clinical data for debugging issues',
                      3: 'Full access to modify settings and resolve issues',
                    };
                    return (
                      <label
                        key={t}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          requestTier === t ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tier"
                          checked={requestTier === t}
                          onChange={() => setRequestTier(t)}
                          className="text-indigo-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {tier.icon}
                            <span className="text-sm font-medium">{tier.label}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{descriptions[t]}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                <select
                  value={requestDuration}
                  onChange={e => setRequestDuration(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={4}>4 hours</option>
                  <option value={8}>8 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={requestReason}
                  onChange={e => setRequestReason(e.target.value)}
                  placeholder="Describe the issue you need help with..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum 10 characters</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRequestForm(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={createRequestMutation.isPending || requestReason.length < 10}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {createRequestMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
