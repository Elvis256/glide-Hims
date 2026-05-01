import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { formatCurrency } from '../../lib/currency';

interface Props {
  shiftId: string;
  shiftStatus: 'open' | 'closed' | 'z_finalized';
}

export function POSComplianceTools({ shiftId, shiftStatus }: Props) {
  const qc = useQueryClient();
  const [eventType, setEventType] = useState<'paid_in' | 'paid_out' | 'cash_drop' | 'no_sale'>(
    'paid_in',
  );
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [showXReport, setShowXReport] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const finalized = shiftStatus === 'z_finalized';

  const drawerEvents = useQuery({
    queryKey: ['pos-drawer-events', shiftId],
    queryFn: async () => {
      const res = await api.get(`/pos/shifts/${shiftId}/drawer-events`);
      return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
    },
  });

  const xReport = useQuery({
    queryKey: ['pos-x-report', shiftId],
    queryFn: async () => {
      const res = await api.get(`/pos/shifts/${shiftId}/x-report`);
      return res.data;
    },
    enabled: showXReport,
  });

  const zReport = useQuery({
    queryKey: ['pos-z-report', shiftId],
    queryFn: async () => {
      try {
        const res = await api.get(`/pos/shifts/${shiftId}/z-report`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: finalized,
  });

  const drawerMut = useMutation({
    mutationFn: async () => {
      const res = await api.post('/pos/drawer-events', {
        shiftId,
        eventType,
        amount: eventType === 'no_sale' ? 0 : parseFloat(amount) || 0,
        reason: reason || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-drawer-events', shiftId] });
      qc.invalidateQueries({ queryKey: ['pos-x-report', shiftId] });
      qc.invalidateQueries({ queryKey: ['pos-current-shift'] });
      setAmount('');
      setReason('');
      toast.success('Drawer event recorded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record event')),
  });

  const zMut = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/pos/shifts/${shiftId}/z-report`, {
        countedCash: parseFloat(countedCash) || 0,
      });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-z-report', shiftId] });
      qc.invalidateQueries({ queryKey: ['pos-current-shift'] });
      qc.invalidateQueries({ queryKey: ['pos-shifts'] });
      setCountedCash('');
      toast.success('Z report generated — shift finalized');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Z report generation failed')),
  });

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Compliance Tools</h3>
          <p className="text-xs text-gray-500">
            Cash drawer events, X-report (live), Z-report (immutable end-of-shift)
          </p>
        </div>
        {finalized && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">
            <Lock className="h-3 w-3" /> Z-Finalized
          </span>
        )}
      </div>

      {!finalized && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-gray-800">Record Drawer Event</h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
            >
              <option value="paid_in">Paid In (+)</option>
              <option value="paid_out">Paid Out (−)</option>
              <option value="cash_drop">Cash Drop (−)</option>
              <option value="no_sale">No Sale (drawer open)</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={eventType === 'no_sale'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => drawerMut.mutate()}
              disabled={drawerMut.isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {drawerMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="h-4 w-4" />
              )}
              Record
            </button>
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-2 text-sm font-semibold text-gray-800">Drawer Events</h4>
        {drawerEvents.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : drawerEvents.data?.length === 0 ? (
          <p className="text-sm text-gray-500">No drawer events recorded</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(drawerEvents.data ?? []).map((ev: any) => (
                  <tr key={ev.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                      {new Date(ev.createdAt || ev.eventAt).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-2">
                      <EventTypeIcon type={ev.eventType} />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(Number(ev.amount) || 0)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{ev.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">X Report (live snapshot)</h4>
          <button
            onClick={() => setShowXReport((s) => !s)}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-3 w-3" /> {showXReport ? 'Refresh' : 'Show'}
          </button>
        </div>
        {showXReport && xReport.data && <ReportTable data={xReport.data} />}
      </div>

      <div className="border-t border-gray-100 pt-6">
        <h4 className="mb-2 text-sm font-semibold text-gray-800">Z Report (end-of-shift)</h4>
        {finalized ? (
          zReport.data ? (
            <ReportTable data={zReport.data} z />
          ) : (
            <p className="text-sm text-gray-500">Loading Z report…</p>
          )
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="mb-3 text-sm text-amber-800">
              Generating a Z report finalizes this shift — no further sales or drawer events can be
              recorded against it.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Counted Cash in Drawer
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => zMut.mutate()}
                disabled={zMut.isPending || !countedCash}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {zMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Generate Z Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EventTypeIcon({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    paid_in: { label: 'Paid In', cls: 'text-green-700 bg-green-100', icon: ArrowDownToLine },
    paid_out: { label: 'Paid Out', cls: 'text-red-700 bg-red-100', icon: ArrowUpFromLine },
    cash_drop: { label: 'Cash Drop', cls: 'text-purple-700 bg-purple-100', icon: ArrowUpFromLine },
    no_sale: { label: 'No Sale', cls: 'text-gray-700 bg-gray-100', icon: Banknote },
  };
  const m = map[type] || { label: type, cls: 'bg-gray-100 text-gray-700', icon: Banknote };
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}
    >
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}

function ReportTable({ data, z }: { data: any; z?: boolean }) {
  const rows: Array<[string, any]> = [
    ['Report number', data.reportNumber || (z ? '—' : 'X (live)')],
    ['Generated at', new Date(data.generatedAt || Date.now()).toLocaleString()],
    ['Opening cash', formatCurrency(Number(data.openingCash) || 0)],
    ['Cash sales', formatCurrency(Number(data.cashSales) || 0)],
    ['Paid in total', formatCurrency(Number(data.paidInTotal) || 0)],
    ['Paid out total', formatCurrency(Number(data.paidOutTotal) || 0)],
    ['Cash drops', formatCurrency(Number(data.cashDropTotal) || 0)],
    ['Expected cash', formatCurrency(Number(data.expectedCash) || 0)],
    ...(z
      ? ([
          ['Counted cash', formatCurrency(Number(data.countedCash) || 0)],
          [
            'Variance',
            <span
              key="var"
              className={
                Number(data.cashVariance) === 0
                  ? 'text-gray-700'
                  : Number(data.cashVariance) > 0
                  ? 'text-green-700'
                  : 'text-red-700'
              }
            >
              {formatCurrency(Number(data.cashVariance) || 0)}
            </span>,
          ],
        ] as Array<[string, any]>)
      : []),
    ['Gross sales', formatCurrency(Number(data.grossSales) || 0)],
    ['Net sales', formatCurrency(Number(data.netSales) || 0)],
    ['Tax total', formatCurrency(Number(data.taxTotal) || 0)],
    ['Discounts', formatCurrency(Number(data.discountTotal) || 0)],
    ['Transactions', data.transactionCount ?? 0],
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="bg-gray-50 px-4 py-2 text-xs font-medium uppercase text-gray-600">
                {k}
              </td>
              <td className="px-4 py-2 text-right font-medium text-gray-900">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {z && data.payloadHash && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
          <span className="font-mono">SHA-256: {String(data.payloadHash).slice(0, 32)}…</span>
        </div>
      )}
    </div>
  );
}
