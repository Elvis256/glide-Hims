import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import {
  criticalResultsService,
  CriticalResultAlert,
  AcknowledgeCriticalResultPayload,
} from '../../services/critical-results';
import CriticalResultAckModal from '../../components/CriticalResultAckModal';

export default function CriticalResultsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'pending' | 'mine' | 'all'>('pending');
  const [selected, setSelected] = useState<CriticalResultAlert | null>(null);

  const params = useMemo(() => {
    if (filter === 'pending') return { status: 'pending' };
    if (filter === 'mine') return { status: 'pending', assignedToMe: true };
    return {};
  }, [filter]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['critical-results', params],
    queryFn: () => criticalResultsService.list(params),
    refetchInterval: 30_000,
  });

  const ackMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AcknowledgeCriticalResultPayload }) =>
      criticalResultsService.acknowledge(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['critical-results'] });
      qc.invalidateQueries({ queryKey: ['critical-results-count'] });
      setSelected(null);
    },
  });

  const rows = data ?? [];

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <AlertTriangle className="h-7 w-7 text-red-600" />
            Critical Results — Acknowledgement Worklist
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Closed-loop sign-off for critical / abnormal lab and radiology findings.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {([
          ['pending', 'Pending (all)'],
          ['mine', 'Assigned to me'],
          ['all', 'All (incl. acknowledged)'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === k
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <th className="px-4 py-2">Severity</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Patient</th>
              <th className="px-4 py-2">Summary</th>
              <th className="px-4 py-2">Flagged</th>
              <th className="px-4 py-2">SLA</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No critical-result alerts in this view.
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const overdue =
                a.status === 'pending' && new Date(a.slaDeadline).getTime() < Date.now();
              const sevColor =
                a.severity === 'abnormal'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800';
              return (
                <tr key={a.id} className={overdue ? 'bg-red-50/60' : ''}>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${sevColor}`}>
                      {a.severity.replace('_', ' ')}
                    </span>
                    {a.escalationLevel > 0 && (
                      <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ESC×{a.escalationLevel}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 capitalize">{a.resourceType}</td>
                  <td className="px-4 py-2">
                    {a.patient?.fullName || a.patientId.slice(0, 8)}
                    {a.patient?.mrn && (
                      <div className="text-xs text-gray-500">{a.patient.mrn}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="line-clamp-2 max-w-md">{a.summary || '—'}</div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {new Date(a.flaggedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className={overdue ? 'font-semibold text-red-700' : 'text-gray-600'}>
                      <Clock className="mr-1 inline h-3 w-3" />
                      {new Date(a.slaDeadline).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {a.status === 'acknowledged' ? (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <CheckCircle2 className="h-4 w-4" /> Acked
                      </span>
                    ) : (
                      <span className="capitalize text-gray-700">{a.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.status === 'pending' && (
                      <button
                        onClick={() => setSelected(a)}
                        className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <CriticalResultAckModal
          alert={selected}
          onCancel={() => setSelected(null)}
          onConfirm={(payload) =>
            ackMutation.mutateAsync({ id: selected.id, payload })
          }
        />
      )}
    </div>
  );
}
