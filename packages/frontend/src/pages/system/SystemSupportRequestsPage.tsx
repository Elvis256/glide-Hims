import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  tenant?: { name: string; slug: string };
}

const tierLabels: Record<number, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  1: { label: 'Metadata Only', icon: <Eye className="w-4 h-4" />, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  2: { label: 'Clinical Read', icon: <Stethoscope className="w-4 h-4" />, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  3: { label: 'Full Support', icon: <Wrench className="w-4 h-4" />, color: 'text-red-600', bgColor: 'bg-red-50' },
};

export default function SystemSupportRequestsPage() {
  const [selectedRequest, setSelectedRequest] = useState<SupportAccessRequest | null>(null);
  const [denyNotes, setDenyNotes] = useState('');
  const [showDenyModal, setShowDenyModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['system-support-requests'],
    queryFn: async () => {
      const res = await api.get('/support-access/requests/pending');
      return (res.data?.data || res.data || []) as SupportAccessRequest[];
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await api.post(`/support-access/requests/${requestId}/approve`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Support access request approved. Access grant created.');
      queryClient.invalidateQueries({ queryKey: ['system-support-requests'] });
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

  const pendingRequests = (requests || []).filter(r => r.status === 'pending');

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
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
            <h1 className="text-2xl font-bold text-gray-900">Support Access Requests</h1>
            <p className="text-sm text-gray-500">Review and manage tenant support access requests</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingRequests.length > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
              <AlertTriangle className="w-4 h-4" />
              {pendingRequests.length} pending
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Request List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">All Clear</h3>
          <p className="text-sm text-gray-500 mt-1">No pending support access requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingRequests.map(request => {
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
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDenyModal(true);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      Deny
                    </button>
                    <button
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                    >
                      {approveMutation.isPending ? (
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
      )}

      {/* Deny Modal */}
      {showDenyModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Deny Support Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              Deny the support access request from{' '}
              <strong>
                {userDisplayName(selectedRequest.requestedBy, 'tenant admin')}
              </strong>
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
