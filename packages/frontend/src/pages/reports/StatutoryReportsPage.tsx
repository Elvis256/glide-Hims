import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';

type StatutoryKind = 'hmis108' | 'hmis122' | 'eidsr' | 'mtrac';

const TABS: { id: StatutoryKind; label: string; periodKind: 'month' | 'week' }[] = [
  { id: 'hmis108', label: 'HMIS 108 (OPD)', periodKind: 'month' },
  { id: 'hmis122', label: 'HMIS 122 (Lab)', periodKind: 'month' },
  { id: 'eidsr', label: 'eIDSR (Weekly)', periodKind: 'week' },
  { id: 'mtrac', label: 'mTrac (Weekly)', periodKind: 'week' },
];

function defaultMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function defaultWeek() {
  const d = new Date();
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7,
    );
  return `${target.getUTCFullYear()}-${String(week).padStart(2, '0')}`;
}

export default function StatutoryReportsPage() {
  const facilityId = useFacilityId();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as StatutoryKind) || 'hmis108';
  const [tab, setTab] = useState<StatutoryKind>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'hmis108',
  );
  const [periodMonth, setPeriodMonth] = useState<string>(defaultMonth());
  const [periodWeek, setPeriodWeek] = useState<string>(defaultWeek());

  const activeTab = TABS.find((t) => t.id === tab)!;
  const period = activeTab.periodKind === 'month' ? periodMonth : periodWeek;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['statutory', tab, period, facilityId],
    enabled: !!facilityId && !!period,
    queryFn: async () => {
      const res = await api.get(`/reports/statutory/${tab}`, {
        params: { facilityId, period, format: 'json' },
      });
      return res.data;
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data as Record<string, unknown>[];
    if (Array.isArray((data as { rows?: unknown[] }).rows)) {
      return (data as { rows: Record<string, unknown>[] }).rows;
    }
    if (typeof data === 'object') {
      return [data as Record<string, unknown>];
    }
    return [];
  }, [data]);

  const columns = useMemo(() => {
    const cols = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => cols.add(k)));
    return Array.from(cols);
  }, [rows]);

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!facilityId || !period) return;
    const res = await api.get(`/reports/statutory/${tab}`, {
      params: { facilityId, period, format },
      responseType: 'blob',
    });
    const blob = new Blob([res.data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab}-${period}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const switchTab = (next: StatutoryKind) => {
    setTab(next);
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  if (!facilityId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-lg font-medium text-gray-900">Select a facility</p>
          <p className="mt-2 text-sm text-gray-500">Pick a facility from the top bar to view statutory reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statutory Reports</h1>
        <p className="text-sm text-gray-600 mt-1">
          Uganda statutory submissions: HMIS 108, HMIS 122, eIDSR and mTrac.
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 text-sm font-medium ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        {activeTab.periodKind === 'month' ? (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Period (month)</label>
            <input
              type="month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Period (ISO week, YYYY-WW)</label>
            <input
              type="text"
              pattern="\d{4}-\d{2}"
              value={periodWeek}
              onChange={(e) => setPeriodWeek(e.target.value)}
              placeholder="2025-04"
              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-32"
            />
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            <FileSpreadsheet className="h-4 w-4" /> XLSX
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading && <div className="p-8 text-center text-gray-500">Loading…</div>}
        {isError && (
          <div className="p-8 text-center text-red-600 flex items-center justify-center gap-2">
            <FileText className="h-4 w-4" />
            <span>{(error as Error)?.message || 'Failed to load report'}</span>
          </div>
        )}
        {!isLoading && !isError && rows.length === 0 && (
          <div className="p-8 text-center text-gray-500">No data for this period.</div>
        )}
        {!isLoading && !isError && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i}>
                    {columns.map((c) => {
                      const v = r[c];
                      const display =
                        v == null
                          ? ''
                          : typeof v === 'object'
                            ? JSON.stringify(v)
                            : String(v);
                      return (
                        <td key={c} className="px-3 py-2 text-gray-900 whitespace-nowrap">
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
