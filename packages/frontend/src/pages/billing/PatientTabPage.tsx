import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Loader2, Printer, Search, FileText, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';
import { printService } from '../../lib/print';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';

interface TabItem {
  id: string;
  serviceCode: string;
  description: string;
  chargeType: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}
interface TabInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  createdAt: string;
  subtotal: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentType: string | null;
  items: TabItem[];
}
interface PatientTab {
  patientId: string;
  encounterId?: string;
  generatedAt: string;
  invoices: TabInvoice[];
  summary: {
    itemsByChargeType: Record<string, { count: number; total: number }>;
    grandTotal: number;
    grandPaid: number;
    grandBalance: number;
  };
}
interface PatientLite {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber: string;
}

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    partially_paid: 'bg-blue-100 text-blue-800',
    paid: 'bg-emerald-100 text-emerald-800',
    overdue: 'bg-red-100 text-red-800',
  };
  return map[s] || 'bg-gray-100 text-gray-800';
};

export default function PatientTabPage() {
  const { patientId: routeId } = useParams<{ patientId?: string }>();
  const [searchParams] = useSearchParams();
  const encounterIdQ = searchParams.get('encounterId') || undefined;

  const [searchTerm, setSearchTerm] = useState('');
  const [activePatientId, setActivePatientId] = useState<string | undefined>(routeId);

  // Patient search (only when no patient is loaded yet)
  const { data: searchResults } = useQuery({
    queryKey: ['patient-search-tab', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [] as PatientLite[];
      const res = await api.get('/patients', { params: { search: searchTerm, limit: 10 } });
      return (res.data?.data ?? res.data ?? []) as PatientLite[];
    },
    enabled: !activePatientId && searchTerm.length >= 2,
  });

  const { data: patient } = useQuery({
    queryKey: ['patient-detail-tab', activePatientId],
    queryFn: async () => {
      if (!activePatientId) return null;
      const res = await api.get(`/patients/${activePatientId}`);
      return (res.data?.data ?? res.data) as PatientLite;
    },
    enabled: !!activePatientId,
  });

  const { data: tab, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['patient-tab', activePatientId, encounterIdQ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (encounterIdQ) params.encounterId = encounterIdQ;
      const res = await api.get(`/billing/patient-tab/${activePatientId}`, { params });
      return res.data as PatientTab;
    },
    enabled: !!activePatientId,
  });

  const grouped = useMemo(() => {
    if (!tab) return [] as Array<{ chargeType: string; items: TabItem[]; total: number }>;
    const map = new Map<string, TabItem[]>();
    for (const inv of tab.invoices) {
      for (const it of inv.items) {
        const arr = map.get(it.chargeType) || [];
        arr.push(it);
        map.set(it.chargeType, arr);
      }
    }
    return Array.from(map.entries()).map(([chargeType, items]) => ({
      chargeType,
      items,
      total: items.reduce((s, i) => s + Number(i.amount || 0), 0),
    }));
  }, [tab]);

  const printRef = useRef<HTMLDivElement>(null);
  const inst = useInstitutionInfo();
  const handlePrint = () => {
    if (printRef.current) {
      printService.printElement(printRef.current, {
        title: 'Interim Bill',
        inst: inst ?? undefined,
        preset: 'a4',
      });
    }
  };

  if (!activePatientId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Patient Running Tab</h1>
        <p className="text-sm text-gray-600 mb-6">
          Search a patient to view all accumulated charges across consultation, lab, pharmacy,
          procedures, and inpatient services. Generate an interim bill at any stage.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or patient number…"
            className="w-full pl-10 pr-3 py-2 border rounded-lg"
            autoFocus
          />
        </div>
        {searchResults && searchResults.length > 0 && (
          <div className="mt-3 border rounded-lg divide-y">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePatientId(p.id)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between"
              >
                <span className="font-medium">
                  {p.firstName} {p.lastName}
                </span>
                <span className="text-sm text-gray-500">{p.patientNumber}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto print:p-0">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <Link to="/billing/patient-tab" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900" onClick={() => setActivePatientId(undefined)}>
          <ArrowLeft className="w-4 h-4" /> Search another patient
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Printer className="w-4 h-4" /> Print Interim Bill
          </button>
        </div>
      </div>

      <div ref={printRef}>
      <div className="bg-white border rounded-lg p-6 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">Interim Bill — Patient Running Tab</h1>
            {patient && (
              <p className="text-gray-700 mt-1">
                <span className="font-medium">
                  {patient.firstName} {patient.lastName}
                </span>{' '}
                <span className="text-gray-500">({patient.patientNumber})</span>
              </p>
            )}
            {encounterIdQ && (
              <p className="text-xs text-gray-500 mt-1">
                Scoped to encounter <code>{encounterIdQ}</code>
              </p>
            )}
          </div>
          {tab && (
            <div className="text-right text-xs text-gray-500">
              Generated {new Date(tab.generatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {tab && tab.invoices.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-800">
          <FileText className="w-8 h-8 mx-auto mb-2" />
          No outstanding charges for this patient.
        </div>
      )}

      {tab && tab.invoices.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border rounded-lg p-4">
              <div className="text-xs text-gray-500 uppercase">Total Charges</div>
              <div className="text-2xl font-bold mt-1">{formatCurrency(tab.summary.grandTotal)}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="text-xs text-emerald-700 uppercase">Paid</div>
              <div className="text-2xl font-bold mt-1 text-emerald-700">
                {formatCurrency(tab.summary.grandPaid)}
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-xs text-red-700 uppercase">Outstanding Balance</div>
              <div className="text-2xl font-bold mt-1 text-red-700">
                {formatCurrency(tab.summary.grandBalance)}
              </div>
            </div>
          </div>

          {/* Items grouped by charge type */}
          <div className="bg-white border rounded-lg overflow-hidden mb-6">
            <div className="px-4 py-3 border-b font-semibold">Charges by Service Area</div>
            {grouped.map((g) => (
              <div key={g.chargeType} className="border-b last:border-b-0">
                <div className="px-4 py-2 bg-gray-50 flex justify-between text-sm font-medium">
                  <span className="capitalize">{g.chargeType.replace(/_/g, ' ')}</span>
                  <span>{formatCurrency(g.total)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {g.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="px-4 py-2 text-gray-500 w-32">{it.serviceCode}</td>
                        <td className="px-4 py-2">{it.description}</td>
                        <td className="px-4 py-2 text-right text-gray-600 w-16">×{it.quantity}</td>
                        <td className="px-4 py-2 text-right w-24">{formatCurrency(it.unitPrice)}</td>
                        <td className="px-4 py-2 text-right font-medium w-28">
                          {formatCurrency(it.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          {/* Invoice-level breakdown */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">Invoices</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Invoice #</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Paid</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {tab.invoices.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">
                      <Link to={`/billing/invoices/${inv.id}`} className="text-blue-600 hover:underline print:text-black print:no-underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-2 text-right text-emerald-700">
                      {formatCurrency(inv.amountPaid)}
                    </td>
                    <td className="px-4 py-2 text-right text-red-700 font-medium">
                      {formatCurrency(inv.balanceDue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-gray-500 print:mt-12 print:text-center">
            This is an interim bill — amounts may change as additional services are rendered. Final
            bill will be issued at checkout.
          </p>
        </>
      )}
      </div>
    </div>
  );
}
