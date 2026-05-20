import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Trash2,
  Plus,
  Search,
  Filter,
  Loader2,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  X,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import { useAuthStore } from '../../store/auth';
import assetsService from '../../services/assets';
import type {
  FixedAsset,
  AssetDisposal,
  DisposalMethod,
  DisposalStatus,
} from '../../services/assets';

const DISPOSAL_STATUSES: DisposalStatus[] = [
  'requested',
  'biomed_review',
  'committee_approval',
  'approved',
  'rejected',
  'completed',
  'cancelled',
];

const DISPOSAL_METHODS: DisposalMethod[] = [
  'sale',
  'scrap',
  'donation',
  'trade_in',
  'write_off',
];

const STATUS_BADGE: Record<DisposalStatus, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  biomed_review: 'bg-indigo-100 text-indigo-800',
  committee_approval: 'bg-purple-100 text-purple-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const METHOD_BADGE: Record<DisposalMethod, string> = {
  sale: 'bg-green-100 text-green-800',
  scrap: 'bg-gray-100 text-gray-800',
  donation: 'bg-blue-100 text-blue-800',
  trade_in: 'bg-indigo-100 text-indigo-800',
  write_off: 'bg-red-100 text-red-800',
};

function fmtDate(d?: string) {
  if (!d) return '—';
  try {
    return format(new Date(d), 'PP');
  } catch {
    return d;
  }
}

function decisionBadge(decision: string) {
  if (decision === 'approved') return 'bg-green-100 text-green-800';
  if (decision === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

export default function AssetDisposalPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const user = useAuthStore((s) => s.user);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'All' | DisposalMethod>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | DisposalStatus>('All');
  const [showFilters, setShowFilters] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [viewing, setViewing] = useState<AssetDisposal | null>(null);

  const disposalsQuery = useQuery({
    queryKey: ['asset-disposals', facilityId, selectedStatus, selectedMethod],
    queryFn: () =>
      assetsService.listDisposals(facilityId, {
        status: selectedStatus === 'All' ? undefined : selectedStatus,
        method: selectedMethod === 'All' ? undefined : selectedMethod,
      }),
    enabled: !!facilityId,
  });

  const assetsQuery = useQuery({
    queryKey: ['assets', facilityId],
    queryFn: () => assetsService.list(facilityId),
    enabled: !!facilityId,
  });

  const disposals = disposalsQuery.data ?? [];
  const assets = assetsQuery.data ?? [];
  const assetById = useMemo(() => {
    const m = new Map<string, FixedAsset>();
    for (const a of assets) m.set(a.id, a);
    return m;
  }, [assets]);

  const activeAssets = useMemo(
    () => assets.filter((a) => a.status !== 'disposed'),
    [assets],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['asset-disposals', facilityId] });

  // Stats
  const stats = useMemo(() => {
    const total = disposals.length;
    const pendingReview = disposals.filter((d) =>
      ['requested', 'biomed_review', 'committee_approval'].includes(d.status),
    ).length;
    const approved = disposals.filter((d) => d.status === 'approved').length;
    const completed = disposals.filter((d) => d.status === 'completed').length;
    return { total, pendingReview, approved, completed };
  }, [disposals]);

  // Client-side search
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return disposals;
    return disposals.filter((d) => {
      const asset = d.asset ?? assetById.get(d.assetId);
      const haystack = [
        d.disposalNumber,
        asset?.name ?? '',
        asset?.assetCode ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [disposals, assetById, searchTerm]);

  // Refresh "viewing" disposal from latest data so panels update after mutation
  const viewingFresh = useMemo(() => {
    if (!viewing) return null;
    return disposals.find((d) => d.id === viewing.id) ?? viewing;
  }, [viewing, disposals]);

  // ===== Mutations =====
  const createMutation = useMutation({
    mutationFn: (body: {
      assetId: string;
      method: DisposalMethod;
      reason: string;
      expectedValue?: number;
      attachments?: string[];
    }) =>
      assetsService.createDisposalRequest({
        ...body,
        facilityId,
      }),
    onSuccess: () => {
      toast.success('Disposal request created');
      invalidate();
      setShowRequestModal(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create request'),
  });

  const biomedMutation = useMutation({
    mutationFn: (body: {
      id: string;
      assessment: string;
      recommendation: 'approve' | 'reject';
    }) =>
      assetsService.biomedReview(body.id, {
        assessment: body.assessment,
        recommendation: body.recommendation,
      }),
    onSuccess: () => {
      toast.success('Biomed review submitted');
      invalidate();
      setViewing(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to submit review'),
  });

  const committeeMutation = useMutation({
    mutationFn: (body: {
      id: string;
      role: string;
      decision: 'approved' | 'rejected';
      comments?: string;
    }) =>
      assetsService.committeeDecision(body.id, {
        role: body.role,
        decision: body.decision,
        comments: body.comments,
      }),
    onSuccess: () => {
      toast.success('Committee decision recorded');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to record decision'),
  });

  const completeMutation = useMutation({
    mutationFn: (body: {
      id: string;
      disposalDate: string;
      actualValue: number;
      buyer?: string;
      notes?: string;
    }) =>
      assetsService.completeDisposal(body.id, {
        disposalDate: body.disposalDate,
        actualValue: body.actualValue,
        buyer: body.buyer,
        notes: body.notes,
      }),
    onSuccess: () => {
      toast.success('Disposal completed');
      invalidate();
      setViewing(null);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to complete disposal'),
  });

  const isLoading = disposalsQuery.isLoading || assetsQuery.isLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-600" />
            Asset Disposal
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage asset disposal requests and approval workflow
          </p>
        </div>
        <button
          onClick={() => setShowRequestModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<Trash2 className="w-5 h-5 text-gray-600" />}
        />
        <StatCard
          label="Pending Review"
          value={stats.pendingReview}
          icon={<Clock className="w-5 h-5 text-yellow-600" />}
        />
        <StatCard
          label="Awaiting Completion"
          value={stats.approved}
          icon={<CheckCircle className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          icon={<CheckCircle className="w-5 h-5 text-green-600" />}
        />
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by asset name, code or disposal #"
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm"
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) =>
                  setSelectedStatus(e.target.value as 'All' | DisposalStatus)
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="All">All</option>
                {DISPOSAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Method
              </label>
              <select
                value={selectedMethod}
                onChange={(e) =>
                  setSelectedMethod(e.target.value as 'All' | DisposalMethod)
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="All">All</option>
                {DISPOSAL_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">
            No disposal records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Disposal #</th>
                  <th className="px-4 py-3 text-left">Asset</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-right">Expected</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Requested</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((d) => {
                  const asset = d.asset ?? assetById.get(d.assetId);
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">
                        {d.disposalNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {asset?.name ?? '—'}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {asset?.assetCode ?? d.assetId}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${METHOD_BADGE[d.method]}`}
                        >
                          {d.method}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 max-w-xs truncate"
                        title={d.reason}
                      >
                        {d.reason}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(d.expectedValue || 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatCurrency(d.actualValue || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[d.status]}`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {fmtDate(d.requestedDate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setViewing(d)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request modal */}
      {showRequestModal && (
        <RequestDisposalModal
          assets={activeAssets}
          onClose={() => setShowRequestModal(false)}
          onSubmit={(body) => createMutation.mutate(body)}
          submitting={createMutation.isPending}
        />
      )}

      {/* View / actions modal */}
      {viewingFresh && (
        <DisposalDetailModal
          disposal={viewingFresh}
          asset={viewingFresh.asset ?? assetById.get(viewingFresh.assetId)}
          currentUserId={user?.id}
          onClose={() => setViewing(null)}
          biomedSubmit={(b) =>
            biomedMutation.mutate({ id: viewingFresh.id, ...b })
          }
          biomedSubmitting={biomedMutation.isPending}
          committeeSubmit={(b) =>
            committeeMutation.mutate({ id: viewingFresh.id, ...b })
          }
          committeeSubmitting={committeeMutation.isPending}
          completeSubmit={(b) =>
            completeMutation.mutate({ id: viewingFresh.id, ...b })
          }
          completeSubmitting={completeMutation.isPending}
        />
      )}
    </div>
  );
}

// ============= Sub-components =============

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 uppercase">{label}</div>
          <div className="text-2xl font-semibold text-gray-900 mt-1">
            {value}
          </div>
        </div>
        {icon}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function RequestDisposalModal({
  assets,
  onClose,
  onSubmit,
  submitting,
}: {
  assets: FixedAsset[];
  onClose: () => void;
  onSubmit: (body: {
    assetId: string;
    method: DisposalMethod;
    reason: string;
    expectedValue?: number;
    attachments?: string[];
  }) => void;
  submitting: boolean;
}) {
  const [assetId, setAssetId] = useState('');
  const [method, setMethod] = useState<DisposalMethod>('sale');
  const [reason, setReason] = useState('');
  const [expectedValue, setExpectedValue] = useState<string>('');
  const [attachmentsText, setAttachmentsText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId || !reason.trim()) {
      toast.error('Asset and reason are required');
      return;
    }
    const attachments = attachmentsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onSubmit({
      assetId,
      method,
      reason: reason.trim(),
      expectedValue: expectedValue ? Number(expectedValue) : undefined,
      attachments: attachments.length ? attachments : undefined,
    });
  };

  return (
    <ModalShell title="Request Disposal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Asset" required>
          <select
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          >
            <option value="">Select asset…</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.assetCode} — {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Method" required>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as DisposalMethod)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            {DISPOSAL_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reason" required>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />
        </Field>
        <Field label="Expected Value">
          <input
            type="number"
            value={expectedValue}
            onChange={(e) => setExpectedValue(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            min={0}
          />
        </Field>
        <Field label="Attachments (comma or newline-separated URLs)">
          <textarea
            value={attachmentsText}
            onChange={(e) => setAttachmentsText(e.target.value)}
            rows={2}
            placeholder="https://… , https://…"
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Request
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function DisposalDetailModal({
  disposal,
  asset,
  onClose,
  biomedSubmit,
  biomedSubmitting,
  committeeSubmit,
  committeeSubmitting,
  completeSubmit,
  completeSubmitting,
}: {
  disposal: AssetDisposal;
  asset?: FixedAsset;
  currentUserId?: string;
  onClose: () => void;
  biomedSubmit: (b: { assessment: string; recommendation: 'approve' | 'reject' }) => void;
  biomedSubmitting: boolean;
  committeeSubmit: (b: {
    role: string;
    decision: 'approved' | 'rejected';
    comments?: string;
  }) => void;
  committeeSubmitting: boolean;
  completeSubmit: (b: {
    disposalDate: string;
    actualValue: number;
    buyer?: string;
    notes?: string;
  }) => void;
  completeSubmitting: boolean;
}) {
  return (
    <ModalShell
      title={`Disposal ${disposal.disposalNumber}`}
      onClose={onClose}
    >
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Asset" value={asset ? `${asset.name} (${asset.assetCode})` : disposal.assetId} />
        <Info label="Asset Class" value={asset?.assetClass ?? '—'} />
        <Info
          label="Method"
          value={
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${METHOD_BADGE[disposal.method]}`}
            >
              {disposal.method}
            </span>
          }
        />
        <Info
          label="Status"
          value={
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[disposal.status]}`}
            >
              {disposal.status}
            </span>
          }
        />
        <Info label="Expected Value" value={formatCurrency(disposal.expectedValue || 0)} />
        <Info label="Actual Value" value={formatCurrency(disposal.actualValue || 0)} />
        <Info label="Requested" value={fmtDate(disposal.requestedDate)} />
        <Info label="Requested By" value={disposal.requestedBy} />
        <Info label="Buyer" value={disposal.buyer ?? '—'} />
        <Info label="Disposal Date" value={fmtDate(disposal.disposalDate)} />
        <Info label="Biomed Reviewed By" value={disposal.biomedReviewedBy ?? '—'} />
        <Info label="Biomed Reviewed At" value={fmtDate(disposal.biomedReviewedAt)} />
        <Info label="Completed By" value={disposal.completedBy ?? '—'} />
        <Info label="Journal Entry" value={disposal.journalEntryId ?? '—'} />
      </div>

      <div>
        <div className="text-xs font-medium text-gray-700">Reason</div>
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{disposal.reason}</p>
      </div>

      {disposal.biomedAssessment && (
        <div>
          <div className="text-xs font-medium text-gray-700">Biomed Assessment</div>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">
            {disposal.biomedAssessment}
          </p>
        </div>
      )}

      {disposal.notes && (
        <div>
          <div className="text-xs font-medium text-gray-700">Notes</div>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{disposal.notes}</p>
        </div>
      )}

      {/* Committee approvals list */}
      {disposal.committeeApprovals && disposal.committeeApprovals.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-2">
            Committee Approvals
          </div>
          <ul className="space-y-2">
            {disposal.committeeApprovals.map((c, i) => (
              <li
                key={`${c.userId}-${i}`}
                className="border rounded-lg p-3 text-sm flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-medium">{c.role}</div>
                  {c.comments && (
                    <div className="text-gray-600 mt-1">{c.comments}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {fmtDate(c.at)} · {c.userId}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${decisionBadge(c.decision)}`}
                >
                  {c.decision}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attachments */}
      {disposal.attachments && disposal.attachments.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">Attachments</div>
          <ul className="space-y-1 text-sm">
            {disposal.attachments.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action panels */}
      {disposal.status === 'biomed_review' && (
        <BiomedReviewPanel
          submit={biomedSubmit}
          submitting={biomedSubmitting}
        />
      )}

      {disposal.status === 'committee_approval' && (
        <CommitteeDecisionPanel
          submit={committeeSubmit}
          submitting={committeeSubmitting}
        />
      )}

      {disposal.status === 'approved' && (
        <CompleteDisposalPanel
          defaultActualValue={disposal.expectedValue || 0}
          submit={completeSubmit}
          submitting={completeSubmitting}
        />
      )}

      {disposal.status === 'rejected' && (
        <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg p-3 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" /> This disposal request was rejected.
        </div>
      )}

      {disposal.status === 'completed' && (
        <div className="border border-green-200 bg-green-50 text-green-800 rounded-lg p-3 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Disposal completed.
        </div>
      )}
    </ModalShell>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

function BiomedReviewPanel({
  submit,
  submitting,
}: {
  submit: (b: { assessment: string; recommendation: 'approve' | 'reject' }) => void;
  submitting: boolean;
}) {
  const [assessment, setAssessment] = useState('');
  const [recommendation, setRecommendation] = useState<'approve' | 'reject'>('approve');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessment.trim()) {
      toast.error('Assessment is required');
      return;
    }
    submit({ assessment: assessment.trim(), recommendation });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border rounded-lg p-4 bg-indigo-50 border-indigo-200 space-y-3"
    >
      <div className="font-medium text-indigo-900">Biomed Review</div>
      <Field label="Assessment" required>
        <textarea
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          required
        />
      </Field>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={recommendation === 'approve'}
            onChange={() => setRecommendation('approve')}
          />
          Approve
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={recommendation === 'reject'}
            onChange={() => setRecommendation('reject')}
          />
          Reject
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Submit Review
      </button>
    </form>
  );
}

function CommitteeDecisionPanel({
  submit,
  submitting,
}: {
  submit: (b: { role: string; decision: 'approved' | 'rejected'; comments?: string }) => void;
  submitting: boolean;
}) {
  const [role, setRole] = useState('');
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [comments, setComments] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim()) {
      toast.error('Role is required');
      return;
    }
    submit({
      role: role.trim(),
      decision,
      comments: comments.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border rounded-lg p-4 bg-purple-50 border-purple-200 space-y-3"
    >
      <div className="font-medium text-purple-900">Add Committee Decision</div>
      <Field label="Role" required>
        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. cfo, ceo, biomed_director"
          className="w-full border rounded-lg px-3 py-2 text-sm"
          required
        />
      </Field>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={decision === 'approved'}
            onChange={() => setDecision('approved')}
          />
          Approved
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={decision === 'rejected'}
            onChange={() => setDecision('rejected')}
          />
          Rejected
        </label>
      </div>
      <Field label="Comments">
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Record Decision
      </button>
    </form>
  );
}

function CompleteDisposalPanel({
  defaultActualValue,
  submit,
  submitting,
}: {
  defaultActualValue: number;
  submit: (b: {
    disposalDate: string;
    actualValue: number;
    buyer?: string;
    notes?: string;
  }) => void;
  submitting: boolean;
}) {
  const [disposalDate, setDisposalDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [actualValue, setActualValue] = useState<string>(
    String(defaultActualValue ?? 0),
  );
  const [buyer, setBuyer] = useState('');
  const [notes, setNotes] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalDate) {
      toast.error('Disposal date is required');
      return;
    }
    submit({
      disposalDate,
      actualValue: Number(actualValue) || 0,
      buyer: buyer.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border rounded-lg p-4 bg-blue-50 border-blue-200 space-y-3"
    >
      <div className="font-medium text-blue-900">Complete Disposal</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Disposal Date" required>
          <input
            type="date"
            value={disposalDate}
            onChange={(e) => setDisposalDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            required
          />
        </Field>
        <Field label="Actual Value" required>
          <input
            type="number"
            value={actualValue}
            onChange={(e) => setActualValue(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            min={0}
            required
          />
        </Field>
      </div>
      <Field label="Buyer">
        <input
          value={buyer}
          onChange={(e) => setBuyer(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        Complete Disposal
      </button>
    </form>
  );
}
