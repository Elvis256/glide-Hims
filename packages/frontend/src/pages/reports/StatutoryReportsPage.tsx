import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { downloadBlob, toCsv } from './_reportUtils';

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
  const inst = useInstitutionInfo();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as StatutoryKind) || 'hmis108';
  const [tab, setTab] = useState<StatutoryKind>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'hmis108',
  );
  const [periodMonth, setPeriodMonth] = useState<string>(defaultMonth());
  const [periodWeek, setPeriodWeek] = useState<string>(defaultWeek());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const onClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showExportMenu]);

  const activeTab = TABS.find((t) => t.id === tab)!;
  const period = activeTab.periodKind === 'month' ? periodMonth : periodWeek;
  // Backend param naming is asymmetric: HmisMonthlyDto expects `period`
  // (YYYY-MM), HmisWeeklyDto expects `week` (YYYY-WW). The previous code sent
  // `period` for both, which 400'd on eIDSR/mTrac.
  const periodParamKey = activeTab.periodKind === 'month' ? 'period' : 'week';

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['statutory', tab, period, facilityId],
    enabled: !!facilityId && !!period,
    queryFn: async () => {
      const res = await api.get(`/reports/statutory/${tab}`, {
        params: { facilityId, [periodParamKey]: period, format: 'json' },
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

  const handleExportServer = async (format: 'csv' | 'xlsx') => {
    if (!facilityId || !period) return;
    const res = await api.get(`/reports/statutory/${tab}`, {
      params: { facilityId, [periodParamKey]: period, format },
      responseType: 'blob',
    });
    const blob = new Blob([res.data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tab}-${period}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    if (!data) return;
    const payload = {
      report: activeTab.label,
      facility: inst?.name ?? null,
      period,
      generatedAt: new Date().toISOString(),
      data,
    };
    downloadBlob(`${tab}-${period}.json`, 'application/json', JSON.stringify(payload, null, 2));
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    if (!rows.length) return;
    const header = printService.buildHeader(inst, 'document');
    const footer = printService.buildFooter(inst, 'document');
    const tableHtml = `
      <h2 style="font-size:16px;margin:16px 0 4px;color:#1e293b;">${activeTab.label}</h2>
      <p style="font-size:11px;color:#64748b;margin:0 0 12px;">Period: ${period}</p>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead><tr style="background:#f1f5f9;">
          ${columns.map((c) => `<th style="border:1px solid #e2e8f0;padding:5px;text-align:left;">${c}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>${columns.map((c) => {
            const v = r[c];
            const display = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
            return `<td style="border:1px solid #e2e8f0;padding:5px;">${display}</td>`;
          }).join('')}</tr>`).join('')}
        </tbody>
      </table>`;
    printService.printDocument(header + tableHtml + footer, {
      title: `${activeTab.label} – ${period}`,
    });
  };

  // Build CSV client-side as a fallback / preview-aligned export
  const handleExportCsvClient = () => {
    if (!rows.length) return;
    const out: Array<Array<unknown>> = [];
    out.push([activeTab.label]);
    out.push(['Facility', inst?.name ?? '']);
    out.push(['Period', period]);
    out.push(['Generated', new Date().toLocaleString()]);
    out.push([]);
    out.push(columns);
    rows.forEach((r) => out.push(columns.map((c) => {
      const v = r[c];
      return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v;
    })));
    downloadBlob(`${tab}-${period}.csv`, 'text/csv;charset=utf-8', '\ufeff' + toCsv(out));
    setShowExportMenu(false);
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
      <Link to="/reports" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
        <ArrowLeft className="h-4 w-4" />
        Reports Dashboard
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statutory Reports</h1>
          <p className="text-sm text-gray-600 mt-1">
            Uganda statutory submissions: HMIS 108, HMIS 122, eIDSR and mTrac.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => refetch()}
            disabled={isFetching || !period}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handlePrint}
            disabled={!rows.length}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={!rows.length}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button onClick={() => handleExportServer('csv')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Export as CSV (server)
                </button>
                <button onClick={() => handleExportServer('xlsx')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Export as XLSX
                </button>
                <button onClick={handleExportCsvClient} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Export displayed CSV
                </button>
                <button onClick={handleExportJson} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                  <FileJson className="h-4 w-4" /> Export as JSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
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
        <div className="text-xs text-gray-500 sm:ml-auto">
          {rows.length > 0 && `${rows.length} row${rows.length === 1 ? '' : 's'}`}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {isLoading && (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-4 w-1/3 bg-gray-200 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 rounded" />
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-4 w-2/5 bg-gray-200 rounded" />
          </div>
        )}
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
                  <tr key={i} className="hover:bg-gray-50">
                    {columns.map((c) => {
                      const v = r[c];
                      const display =
                        v == null
                          ? ''
                          : typeof v === 'object'
                            ? JSON.stringify(v)
                            : String(v);
                      return (
                        <td key={c} className="px-3 py-2 text-gray-900 whitespace-nowrap tabular-nums">
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
