import { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/api';
import { approveStep, rejectStep } from '../../services/approvals';
import { toast } from 'sonner';

interface InboxRow {
  stepId: string;
  module: string;
  documentType: string;
  documentId: string;
  approvalLevel: number;
  requiredRole: string;
  approverName: string | null;
  groupName: string | null;
  createdAt: string;
}

const moduleHref = (r: InboxRow): string | null => {
  if (r.module === 'procurement' && r.documentType === 'PO') return `/procurement/orders`;
  if (r.module === 'procurement' && r.documentType === 'PR') return `/procurement/requisitions`;
  return null;
};

export default function ApprovalsInboxPage() {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<InboxRow[]>('/approvals/inbox');
      setRows(data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onApprove = async (row: InboxRow) => {
    const comment = window.prompt('Optional comment for approval', '') || undefined;
    setBusy(row.stepId);
    try {
      await approveStep(row.stepId, comment);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Approve failed');
    } finally {
      setBusy(null);
    }
  };

  const onReject = async (row: InboxRow) => {
    const comment = window.prompt('Reason for rejection (required)', '');
    if (!comment || !comment.trim()) return;
    setBusy(row.stepId);
    try {
      await rejectStep(row.stepId, comment.trim());
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Reject failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Approvals Inbox</h1>
          <p className="text-sm text-gray-500">
            Pending approval steps assigned to you across all modules.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="p-10 text-center text-gray-500 border-2 border-dashed border-gray-200 rounded">
          No pending approvals. You're all caught up. ✅
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto bg-white border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="p-3">Module</th>
                <th className="p-3">Document</th>
                <th className="p-3">Level</th>
                <th className="p-3">Role / Group</th>
                <th className="p-3">Submitted</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const href = moduleHref(r);
                return (
                  <tr key={r.stepId} className="border-t hover:bg-gray-50">
                    <td className="p-3 capitalize">{r.module}</td>
                    <td className="p-3">
                      <span className="font-mono text-xs">{r.documentType}</span>{' '}
                      {href ? (
                        <a href={href} className="text-blue-600 hover:underline">
                          {r.documentId.slice(0, 8)}…
                        </a>
                      ) : (
                        <span className="font-mono text-xs">{r.documentId.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="p-3">{r.approvalLevel}</td>
                    <td className="p-3">{r.groupName || r.approverName || r.requiredRole}</td>
                    <td className="p-3 text-gray-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => onApprove(r)}
                        disabled={busy === r.stepId}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => onReject(r)}
                        disabled={busy === r.stepId}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
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
  );
}
