import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, PackageCheck, AlertTriangle, Play, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';

interface ReorderItem {
  itemId: string;
  itemName: string;
  available: number;
  reorderLevel: number;
  suggestedQty: number;
}

interface ReorderDraft {
  facilityId: string;
  tenantId?: string;
  itemCount: number;
  prNumber?: string;
  prId?: string;
  items: ReorderItem[];
}

interface ReorderResult {
  facilitiesProcessed: number;
  prsCreated: number;
  itemsSkipped: number;
  drafts: ReorderDraft[];
}

export default function ReorderSuggestionsPage() {
  const facilityId = useFacilityId();
  const [running, setRunning] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reorder-preview', facilityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facilityId) params.append('facilityId', facilityId);
      const res = await api.get<ReorderResult>(`/procurement/reorder/preview?${params}`);
      return res.data;
    },
  });

  const runNow = async () => {
    if (!confirm('Generate draft PRs for all items below reorder level? They will appear in Purchase Requests as DRAFT and require manual submission.')) return;
    setRunning(true);
    try {
      const res = await api.post<ReorderResult>('/procurement/reorder/run', { facilityId });
      toast.success(`Created ${res.data.prsCreated} draft PR(s) covering ${res.data.facilitiesProcessed} facility group(s)`);
      refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to run reorder job');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageCheck className="w-6 h-6" /> Reorder Suggestions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Items at or below their reorder level. The system runs this scan automatically every night at 2:00 AM and creates DRAFT purchase requests.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="px-3 py-2 text-sm border rounded hover:bg-gray-50 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={runNow}
            disabled={running}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            <Play className="w-4 h-4" /> {running ? 'Running…' : 'Generate Draft PRs Now'}
          </button>
        </div>
      </div>

      {isLoading && <div className="bg-white p-8 text-center text-gray-500 rounded-lg shadow">Scanning…</div>}

      {!isLoading && data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Facility groups" value={data.facilitiesProcessed} />
            <Stat label="Items below reorder" value={data.drafts.reduce((s, d) => s + d.itemCount, 0)} />
            <Stat label="Items skipped (already on open PR)" value={data.itemsSkipped} muted />
          </div>

          {data.drafts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center text-green-800">
              <PackageCheck className="w-10 h-10 mx-auto mb-2" />
              <p className="font-medium">All stocks are above their reorder levels.</p>
              <p className="text-sm">No new draft PRs need to be created.</p>
            </div>
          ) : (
            data.drafts.map((draft, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-4 py-3 bg-yellow-50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="font-medium">Facility {draft.facilityId.slice(0, 8)}…</span>
                    <span className="text-sm text-gray-600">— {draft.itemCount} item(s) need reordering</span>
                  </div>
                  {draft.prNumber && (
                    <Link
                      to={`/procurement/trace?type=pr&id=${draft.prId}`}
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" /> {draft.prNumber}
                    </Link>
                  )}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2">Item</th>
                      <th className="text-right px-4 py-2">Available</th>
                      <th className="text-right px-4 py-2">Reorder Level</th>
                      <th className="text-right px-4 py-2">Suggested Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {draft.items.map((it) => (
                      <tr key={it.itemId}>
                        <td className="px-4 py-2">{it.itemName}</td>
                        <td className="px-4 py-2 text-right text-red-600 font-medium">{it.available}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{it.reorderLevel}</td>
                        <td className="px-4 py-2 text-right font-medium">{it.suggestedQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${muted ? 'opacity-70' : ''}`}>
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
