import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  FileText,
  ShoppingCart,
  PackageCheck,
  Receipt,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Loader2,
  Filter,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';

function userName(u: unknown): string {
  if (!u) return '—';
  if (typeof u === 'string') return u || '—';
  if (typeof u === 'object') {
    const o = u as Record<string, unknown>;
    if (typeof o.fullName === 'string' && o.fullName) return o.fullName;
    if (typeof o.username === 'string' && o.username) return o.username;
    const fn = typeof o.firstName === 'string' ? o.firstName : '';
    const ln = typeof o.lastName === 'string' ? o.lastName : '';
    const joined = `${fn} ${ln}`.trim();
    if (joined) return joined;
    if (typeof o.email === 'string' && o.email) return o.email;
  }
  return '—';
}

type DocType = 'pr' | 'po' | 'grn' | 'invoice';

interface SearchHit {
  type: DocType;
  id: string;
  number: string;
  status: string;
  createdAt: string;
}

interface TraceResult {
  pr: any | null;
  pos: any[];
  grns: any[];
  invoices: any[];
}

const TYPE_LABEL: Record<DocType, string> = {
  pr: 'Purchase Request',
  po: 'Purchase Order',
  grn: 'Goods Receipt Note',
  invoice: 'Invoice Match',
};

const TYPE_ICON: Record<DocType, React.ReactNode> = {
  pr: <FileText className="w-4 h-4" />,
  po: <ShoppingCart className="w-4 h-4" />,
  grn: <PackageCheck className="w-4 h-4" />,
  invoice: <Receipt className="w-4 h-4" />,
};

const TYPE_COLOR: Record<DocType, string> = {
  pr: 'bg-blue-100 text-blue-700 border-blue-200',
  po: 'bg-purple-100 text-purple-700 border-purple-200',
  grn: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  invoice: 'bg-amber-100 text-amber-700 border-amber-200',
};

function StatusPill({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  let cls = 'bg-gray-100 text-gray-700';
  let icon: React.ReactNode = <Clock className="w-3 h-3" />;
  if (['approved', 'matched', 'paid', 'posted', 'fully_received', 'completed'].some((k) => s.includes(k))) {
    cls = 'bg-green-100 text-green-700';
    icon = <CheckCircle className="w-3 h-3" />;
  } else if (['flagged', 'mismatch', 'rejected', 'cancelled'].some((k) => s.includes(k))) {
    cls = 'bg-red-100 text-red-700';
    icon = <XCircle className="w-3 h-3" />;
  } else if (['pending', 'draft', 'sent'].some((k) => s.includes(k))) {
    cls = 'bg-amber-100 text-amber-700';
    icon = <Clock className="w-3 h-3" />;
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon}
      {(status || '—').replace(/_/g, ' ')}
    </span>
  );
}

function fmtDate(d: any): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return '—'; }
}

function fmtMoney(n: any): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProcurementTracePage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<{ type: DocType; id: string } | null>(null);

  // Hydrate from URL on mount
  useEffect(() => {
    const t = params.get('type') as DocType | null;
    const id = params.get('id');
    if (t && id) setSelected({ type: t, id });
  }, []);

  const { data: searchData, isFetching: searching } = useQuery<SearchHit[]>({
    queryKey: ['procurement-trace-search', q],
    queryFn: async () => {
      if (q.trim().length < 2) return [];
      const r = await api.get('/procurement/trace/search', { params: { q: q.trim() } });
      return r.data || [];
    },
    enabled: q.trim().length >= 2,
    staleTime: 5000,
  });

  const { data: trace, isLoading: tracing, error } = useQuery<TraceResult>({
    queryKey: ['procurement-trace', selected?.type, selected?.id],
    queryFn: async () => {
      const r = await api.get(`/procurement/trace/${selected!.type}/${selected!.id}`);
      return r.data;
    },
    enabled: !!selected,
  });

  const pickHit = (hit: SearchHit) => {
    setSelected({ type: hit.type, id: hit.id });
    setParams({ type: hit.type, id: hit.id });
    setQ('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Procurement Trace</h1>
        <p className="text-sm text-gray-500 mt-1">
          End-to-end view of any document — Purchase Request → Purchase Orders → Goods Received → Invoice Matches.
          Search by PR / PO / GRN / Invoice number.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search PR / PO / GRN / Invoice number…"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searching && <Loader2 className="absolute right-3 top-3 w-4 h-4 text-gray-400 animate-spin" />}
        </div>
        {q.trim().length >= 2 && searchData && searchData.length > 0 && (
          <div className="mt-2 max-h-72 overflow-y-auto border rounded-lg divide-y">
            {searchData.map((hit) => (
              <button
                key={`${hit.type}-${hit.id}`}
                type="button"
                onClick={() => pickHit(hit)}
                className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-50"
              >
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${TYPE_COLOR[hit.type]}`}>
                  {TYPE_ICON[hit.type]}
                  {hit.type.toUpperCase()}
                </span>
                <span className="font-medium text-gray-900">{hit.number}</span>
                <StatusPill status={hit.status} />
                <span className="ml-auto text-xs text-gray-500">{fmtDate(hit.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
        {q.trim().length >= 2 && !searching && searchData && searchData.length === 0 && (
          <div className="mt-2 text-sm text-gray-500">No documents matched “{q}”.</div>
        )}
      </div>

      {/* Result */}
      {!selected && (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-10 text-center">
          <Filter className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Search and select a document above to view its full procurement trace.</p>
        </div>
      )}

      {selected && tracing && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      )}

      {selected && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-medium">Failed to load trace</p>
            <p className="text-sm">{getApiErrorMessage(error, 'Try again')}</p>
          </div>
        </div>
      )}

      {selected && trace && !tracing && (
        <div className="space-y-4">
          {/* Chain summary */}
          <div className="bg-white border rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ChainNode label="PR" present={!!trace.pr} count={trace.pr ? 1 : 0} type="pr" />
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <ChainNode label="PO" present={trace.pos.length > 0} count={trace.pos.length} type="po" />
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <ChainNode label="GRN" present={trace.grns.length > 0} count={trace.grns.length} type="grn" />
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <ChainNode label="Invoice" present={trace.invoices.length > 0} count={trace.invoices.length} type="invoice" />
            </div>
          </div>

          {/* PR */}
          {trace.pr && (
            <Section
              title={`Purchase Request — ${trace.pr.requestNumber}`}
              type="pr"
              status={trace.pr.status}
              meta={[
                ['Facility', trace.pr.facility?.name],
                ['Department', trace.pr.department?.name],
                ['Requested by', userName(trace.pr.requestedBy)],
                ['Priority', trace.pr.priority],
                ['Created', fmtDate(trace.pr.createdAt)],
                ['Approved by', userName(trace.pr.approvedBy)],
              ]}
              link={`/procurement/requisitions?id=${trace.pr.id}`}
            >
              <ItemsTable
                items={trace.pr.items || []}
                cols={[
                  { key: 'itemName', label: 'Item' },
                  { key: 'quantity', label: 'Qty', align: 'right' },
                  { key: 'estimatedUnitCost', label: 'Est. Cost', align: 'right', money: true },
                ]}
              />
            </Section>
          )}

          {/* POs */}
          {trace.pos.map((po: any) => (
            <Section
              key={po.id}
              title={`Purchase Order — ${po.orderNumber}`}
              type="po"
              status={po.status}
              meta={[
                ['Supplier', po.supplier?.name],
                ['Total', fmtMoney(po.totalAmount)],
                ['Order date', fmtDate(po.orderDate || po.createdAt)],
                ['Expected delivery', fmtDate(po.expectedDeliveryDate)],
                ['Created by', userName(po.createdBy)],
                ['Approved by', userName(po.approvedBy)],
              ]}
              link={`/procurement/orders?id=${po.id}`}
            >
              <ItemsTable
                items={po.items || []}
                cols={[
                  { key: 'itemName', label: 'Item' },
                  { key: 'quantityOrdered', label: 'Ordered', align: 'right' },
                  { key: 'quantityReceived', label: 'Received', align: 'right' },
                  { key: 'unitPrice', label: 'Unit Price', align: 'right', money: true },
                  { key: 'lineTotal', label: 'Line Total', align: 'right', money: true },
                ]}
              />
            </Section>
          ))}

          {/* GRNs */}
          {trace.grns.map((grn: any) => (
            <Section
              key={grn.id}
              title={`Goods Receipt — ${grn.grnNumber}`}
              type="grn"
              status={grn.status}
              meta={[
                ['Supplier', grn.supplier?.name],
                ['Received', fmtDate(grn.receivedAt)],
                ['Delivery note', grn.deliveryNoteNumber || '—'],
                ['Invoice #', grn.invoiceNumber || '—'],
                ['Total qty', grn.totalQuantityReceived],
                ['Total value', fmtMoney(grn.totalValue)],
                ['Posted at', fmtDate(grn.postedAt)],
                ['Posted by', userName(grn.postedBy)],
              ]}
              link={`/procurement/grn?id=${grn.id}`}
            >
              <ItemsTable
                items={grn.items || []}
                cols={[
                  { key: 'itemName', label: 'Item' },
                  { key: 'quantityExpected', label: 'Expected', align: 'right' },
                  { key: 'quantityReceived', label: 'Received', align: 'right' },
                  { key: 'quantityAccepted', label: 'Accepted', align: 'right' },
                  { key: 'quantityRejected', label: 'Rejected', align: 'right' },
                  { key: 'batchNumber', label: 'Batch' },
                  { key: 'expiryDate', label: 'Expiry', date: true },
                  { key: 'unitCost', label: 'Unit Cost', align: 'right', money: true },
                ]}
              />
            </Section>
          ))}

          {/* Invoices */}
          {trace.invoices.map((inv: any) => (
            <Section
              key={inv.id}
              title={`Invoice — ${inv.invoiceNumber}`}
              type="invoice"
              status={inv.status}
              meta={[
                ['Invoice date', fmtDate(inv.invoiceDate)],
                ['Invoice total', fmtMoney(inv.invoiceTotal)],
                ['PO total', fmtMoney(inv.poTotal)],
                ['GRN total', fmtMoney(inv.grnTotal)],
                ['Variance', fmtMoney(inv.totalVariance)],
                ['Variance %', inv.variancePercentage != null ? `${Number(inv.variancePercentage).toFixed(2)}%` : '—'],
                ['Approved at', fmtDate(inv.approvedAt)],
                ['Paid at', fmtDate(inv.paidAt)],
                ...(inv.overrideReason
                  ? [['Override reason', inv.overrideReason] as [string, any]]
                  : []),
              ]}
              link={`/procurement/invoices/match?id=${inv.id}`}
            />
          ))}

          {trace.pos.length === 0 && trace.grns.length === 0 && trace.invoices.length === 0 && !trace.pr && (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-500">
              No linked documents found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChainNode({ label, present, count, type }: { label: string; present: boolean; count: number; type: DocType }) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${present ? TYPE_COLOR[type] : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
      {TYPE_ICON[type]}
      <span className="font-medium">{label}</span>
      <span className={`text-xs px-1.5 rounded-full ${present ? 'bg-white/70' : 'bg-gray-100'}`}>{count}</span>
    </div>
  );
}

interface SectionProps {
  title: string;
  type: DocType;
  status: string;
  meta: Array<[string, any]>;
  link?: string;
  children?: React.ReactNode;
}
function Section({ title, type, status, meta, link, children }: SectionProps) {
  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${TYPE_COLOR[type]}`}>
          {TYPE_ICON[type]}
          {TYPE_LABEL[type]}
        </span>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <StatusPill status={status} />
        {link && (
          <Link to={link} className="ml-auto text-xs text-blue-600 hover:underline">
            Open →
          </Link>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          {meta.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => (
            <div key={k}>
              <div className="text-xs text-gray-500">{k}</div>
              <div className="text-gray-900 truncate">{String(v)}</div>
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

interface Col {
  key: string;
  label: string;
  align?: 'left' | 'right';
  money?: boolean;
  date?: boolean;
}
function ItemsTable({ items, cols }: { items: any[]; cols: Col[] }) {
  if (!items?.length) return null;
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((row, i) => (
            <tr key={row.id || i}>
              {cols.map((c) => {
                const raw = row[c.key];
                let display: any = raw ?? '—';
                if (c.money) display = raw == null ? '—' : fmtMoney(raw);
                else if (c.date) display = fmtDate(raw);
                return (
                  <td key={c.key} className={`px-3 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}>
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
