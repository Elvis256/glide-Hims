import React, { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Printer,
  FileText,
  Loader2,
  AlertCircle,
  Search,
  Shield,
  ClipboardList,
  DollarSign,
} from 'lucide-react';
import { encountersService } from '../../services/encounters';
import { clinicalNotesService } from '../../services/clinical-notes';
import { billingService } from '../../services/billing';
import { patientsService } from '../../services/patients';
import { insuranceService } from '../../services/insurance';
import { prescriptionsService } from '../../services/prescriptions';
import { ordersService } from '../../services/orders';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { printContent } from '../../lib/print';

export default function InsuranceReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const encounterId = searchParams.get('encounter') || '';
  const reportRef = useRef<HTMLDivElement>(null);
  const inst = useInstitutionInfo();
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [doctorRemarks, setDoctorRemarks] = useState('');

  // ── Data fetching ──
  const { data: encounter, isLoading: loadingEnc } = useQuery({
    queryKey: ['encounter-ins', encounterId],
    queryFn: () => encountersService.getById(encounterId),
    enabled: !!encounterId,
  });

  const { data: clinicalNotes = [] } = useQuery({
    queryKey: ['clinical-notes-ins', encounterId],
    queryFn: () => clinicalNotesService.getByEncounter(encounterId),
    enabled: !!encounterId,
  });

  const { data: invoiceData } = useQuery({
    queryKey: ['invoice-enc', encounterId],
    queryFn: () => billingService.invoices.list({ encounterId } as any),
    enabled: !!encounterId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-ins', encounterId],
    queryFn: () => ordersService.getByEncounter(encounterId),
    enabled: !!encounterId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['rx-ins', encounterId],
    queryFn: () => prescriptionsService.list({ encounterId }),
    enabled: !!encounterId,
  });

  // Insurance policy for the encounter
  const insurancePolicyId = (encounter as any)?.insurancePolicyId;
  const { data: insurancePolicy } = useQuery({
    queryKey: ['ins-policy', insurancePolicyId],
    queryFn: () => insuranceService.policies.getById(insurancePolicyId),
    enabled: !!insurancePolicyId,
  });

  // Patient insurance policies (fallback)
  const { data: patientPolicies = [] } = useQuery({
    queryKey: ['patient-policies', encounter?.patientId],
    queryFn: () => insuranceService.policies.getByPatient(encounter!.patientId),
    enabled: !!encounter?.patientId && !insurancePolicyId,
  });

  // Patient search
  const { data: patientResults } = useQuery({
    queryKey: ['patient-search-ins', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length >= 2 && !encounterId && !selectedPatientId,
  });
  const patients = patientResults?.data || [];

  // Encounters for selected patient
  const { data: encounterResults } = useQuery({
    queryKey: ['patient-enc-ins', selectedPatientId],
    queryFn: () => encountersService.list({ patientId: selectedPatientId!, limit: 50 }),
    enabled: !!selectedPatientId && !encounterId,
  });
  const patientEncounters = encounterResults?.data || [];

  // Derived data
  const invoices = invoiceData?.data || invoiceData || [];
  const invoice = Array.isArray(invoices) ? invoices[0] : invoices;
  const invoiceItems = (invoice as any)?.items || [];
  const policy = insurancePolicy || patientPolicies[0] || null;

  const allDiagnoses: { code: string; description: string; type: string }[] = [];
  const seen = new Set<string>();
  (clinicalNotes as any[]).forEach((note: any) => {
    (note.diagnoses || []).forEach((d: any) => {
      const key = `${d.code}-${d.description}`;
      if (!seen.has(key)) { seen.add(key); allDiagnoses.push(d); }
    });
  });

  const patient = encounter?.patient;
  const age = patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const doctorName = (encounter as any)?.attendingProvider?.fullName || (encounter as any)?.doctor?.fullName || 'N/A';

  // Cost calculations
  const subtotal = invoiceItems.reduce((sum: number, item: any) => sum + (Number(item.totalPrice || item.amount || 0)), 0);
  const totalAmount = Number((invoice as any)?.totalAmount || subtotal);
  const paidAmount = Number((invoice as any)?.paidAmount || 0);
  const balance = Number((invoice as any)?.balance || (invoice as any)?.balanceDue || totalAmount - paidAmount);

  const handlePrint = () => {
    if (reportRef.current) {
      printContent(reportRef.current.innerHTML, 'Insurance Reimbursement Report');
    }
  };

  // ── Encounter selector ──
  if (!encounterId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <Shield className="w-5 h-5" />
          Insurance Reimbursement Report
        </h1>
        <div className="bg-white rounded-xl shadow p-6 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search Patient</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => { setPatientSearch(e.target.value); setSelectedPatientId(null); }}
              placeholder="Type patient name or MRN..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {patientSearch.length >= 2 && patients.length > 0 && !selectedPatientId && (
            <ul className="mt-2 border rounded-lg divide-y max-h-48 overflow-y-auto">
              {patients.slice(0, 10).map((p: any) => (
                <li
                  key={p.id}
                  onClick={() => { setSelectedPatientId(p.id); setPatientSearch(p.fullName || p.name || ''); }}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                >
                  <span className="font-medium">{p.fullName || p.name}</span>
                  <span className="text-gray-500 ml-2">MRN: {p.mrn}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedPatientId && (
          <div className="bg-white rounded-xl shadow p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Visit / Encounter</label>
            {patientEncounters.length === 0 ? (
              <p className="text-gray-500 text-sm">No encounters found for this patient.</p>
            ) : (
              <ul className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {patientEncounters.map((enc: any) => (
                  <li
                    key={enc.id}
                    onClick={() => setSearchParams({ encounter: enc.id })}
                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-sm flex justify-between items-center"
                  >
                    <div>
                      <span className="font-medium">{enc.visitNumber}</span>
                      <span className="text-gray-500 ml-2">{new Date(enc.visitDate || enc.createdAt).toLocaleDateString()}</span>
                      <span className="text-gray-500 ml-2 capitalize">({enc.type})</span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      enc.status === 'completed' ? 'bg-green-100 text-green-700' :
                      enc.status === 'in_consultation' ? 'bg-blue-100 text-blue-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {enc.status?.replace(/_/g, ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  }

  if (loadingEnc) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-red-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3" />
          <p className="text-lg font-medium">Encounter not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Insurance Reimbursement Report
        </h1>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Report
        </button>
      </div>

      {/* ══ Printable Report ══ */}
      <div ref={reportRef} className="bg-white rounded-xl shadow-lg border p-8">
        {/* Header */}
        <div className="text-center border-b pb-4 mb-6">
          {inst.logo && (
            <img src={inst.logo} alt="logo" className="mx-auto mb-2" style={{ maxHeight: 120, objectFit: 'contain' }} />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{inst.name || 'Hospital'}</h1>
          {inst.address && <p className="text-sm text-gray-600">{inst.address}</p>}
          {(inst.phone || inst.email) && (
            <p className="text-sm text-gray-600">{inst.phone}{inst.phone && inst.email ? ' | ' : ''}{inst.email}</p>
          )}
          {inst.taxId && <p className="text-sm text-gray-600">TIN: {inst.taxId}</p>}
          <h2 className="text-lg font-bold mt-3 text-gray-800 border-t pt-3">DETAILED VISIT REPORT — INSURANCE REIMBURSEMENT</h2>
        </div>

        {/* Patient & Insurance Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="space-y-1">
            <p className="font-bold text-gray-800 mb-1">Patient Information</p>
            <p><span className="font-semibold">Name:</span> {patient?.fullName || 'N/A'}</p>
            <p><span className="font-semibold">MRN:</span> {patient?.mrn || 'N/A'}</p>
            <p><span className="font-semibold">Gender:</span> {patient?.gender || 'N/A'}</p>
            <p><span className="font-semibold">Age:</span> {age !== null ? `${age} years` : 'N/A'}</p>
            {patient?.phone && <p><span className="font-semibold">Phone:</span> {patient.phone}</p>}
          </div>
          <div className="space-y-1">
            <p className="font-bold text-gray-800 mb-1">Insurance Information</p>
            {policy ? (
              <>
                <p><span className="font-semibold">Provider:</span> {(policy as any).provider?.name || 'N/A'}</p>
                <p><span className="font-semibold">Policy No:</span> {policy.policyNumber}</p>
                {policy.memberNumber && <p><span className="font-semibold">Member No:</span> {policy.memberNumber}</p>}
                {policy.principalName && <p><span className="font-semibold">Principal:</span> {policy.principalName}</p>}
                <p><span className="font-semibold">Coverage:</span> {policy.coverageType?.replace(/_/g, ' ')}</p>
                <p><span className="font-semibold">Status:</span> <span className="capitalize">{policy.status}</span></p>
              </>
            ) : (
              <p className="text-gray-500">
                {(encounter as any)?.payerType === 'insurance' ? 'Insurance policy details not available' : `Payer: ${((encounter as any)?.payerType || 'cash').toUpperCase()}`}
              </p>
            )}
          </div>
        </div>

        {/* Visit Details */}
        <Section title="Visit Details">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <p><span className="font-semibold">Visit No:</span> {encounter.visitNumber}</p>
            <p><span className="font-semibold">Visit Date:</span> {new Date(encounter.visitDate || encounter.createdAt).toLocaleDateString()}</p>
            <p><span className="font-semibold">Visit Type:</span> {(encounter.type || '').toUpperCase()}</p>
            <p><span className="font-semibold">Department:</span> {(encounter as any)?.department?.name || encounter.department || 'N/A'}</p>
            <p><span className="font-semibold">Attending Doctor:</span> Dr. {doctorName}</p>
            <p><span className="font-semibold">Status:</span> <span className="capitalize">{encounter.status?.replace(/_/g, ' ')}</span></p>
          </div>
          {encounter.chiefComplaint && (
            <div className="mt-3">
              <p className="font-semibold text-sm">Chief Complaint:</p>
              <p className="text-sm text-gray-700">{encounter.chiefComplaint}</p>
            </div>
          )}
        </Section>

        {/* Diagnoses */}
        {allDiagnoses.length > 0 && (
          <Section title="Diagnoses (ICD-10)">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 border font-semibold">#</th>
                  <th className="text-left p-2 border font-semibold">ICD Code</th>
                  <th className="text-left p-2 border font-semibold">Description</th>
                  <th className="text-left p-2 border font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {allDiagnoses.map((d, i) => (
                  <tr key={i}>
                    <td className="p-2 border">{i + 1}</td>
                    <td className="p-2 border font-mono">{d.code || '—'}</td>
                    <td className="p-2 border">{d.description}</td>
                    <td className="p-2 border capitalize">{d.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Services Rendered & Itemized Costs */}
        <Section title="Itemized Services & Costs">
          {invoiceItems.length > 0 ? (
            <>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-2 border font-semibold">#</th>
                    <th className="text-left p-2 border font-semibold">Service Code</th>
                    <th className="text-left p-2 border font-semibold">Description</th>
                    <th className="text-right p-2 border font-semibold">Qty</th>
                    <th className="text-right p-2 border font-semibold">Unit Price</th>
                    <th className="text-right p-2 border font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item: any, i: number) => (
                    <tr key={item.id || i}>
                      <td className="p-2 border">{i + 1}</td>
                      <td className="p-2 border font-mono">{item.serviceCode || '—'}</td>
                      <td className="p-2 border">{item.description}</td>
                      <td className="p-2 border text-right">{item.quantity}</td>
                      <td className="p-2 border text-right">{fmtCurrency(item.unitPrice)}</td>
                      <td className="p-2 border text-right font-medium">{fmtCurrency(item.totalPrice || item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="p-2 border" colSpan={5} align="right">Subtotal</td>
                    <td className="p-2 border text-right">{fmtCurrency(subtotal)}</td>
                  </tr>
                  {Number((invoice as any)?.discount || 0) > 0 && (
                    <tr>
                      <td className="p-2 border" colSpan={5} align="right">Discount</td>
                      <td className="p-2 border text-right text-red-600">-{fmtCurrency((invoice as any).discount)}</td>
                    </tr>
                  )}
                  {Number((invoice as any)?.tax || 0) > 0 && (
                    <tr>
                      <td className="p-2 border" colSpan={5} align="right">Tax</td>
                      <td className="p-2 border text-right">{fmtCurrency((invoice as any).tax)}</td>
                    </tr>
                  )}
                  <tr className="bg-blue-50 font-bold">
                    <td className="p-2 border" colSpan={5} align="right">Total Amount</td>
                    <td className="p-2 border text-right">{fmtCurrency(totalAmount)}</td>
                  </tr>
                  {paidAmount > 0 && (
                    <tr className="bg-green-50">
                      <td className="p-2 border font-semibold" colSpan={5} align="right">Amount Paid</td>
                      <td className="p-2 border text-right font-semibold text-green-700">{fmtCurrency(paidAmount)}</td>
                    </tr>
                  )}
                  {balance > 0 && (
                    <tr className="bg-yellow-50">
                      <td className="p-2 border font-semibold" colSpan={5} align="right">Balance Due</td>
                      <td className="p-2 border text-right font-semibold text-red-600">{fmtCurrency(balance)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
              {(invoice as any)?.invoiceNumber && (
                <p className="text-xs text-gray-500 mt-1">Invoice #: {(invoice as any).invoiceNumber}</p>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500">
              {/* Fallback: show orders and prescriptions as services */}
              {(orders.length > 0 || prescriptions.length > 0) ? (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2 border font-semibold">#</th>
                      <th className="text-left p-2 border font-semibold">Service</th>
                      <th className="text-left p-2 border font-semibold">Type</th>
                      <th className="text-left p-2 border font-semibold">Status / Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o: any, i: number) => (
                      <tr key={o.id}>
                        <td className="p-2 border">{i + 1}</td>
                        <td className="p-2 border">{(o.testCodes || []).map((t: any) => t.name).join(', ') || o.orderNumber}</td>
                        <td className="p-2 border capitalize">{o.orderType}</td>
                        <td className="p-2 border capitalize">{o.status}</td>
                      </tr>
                    ))}
                    {prescriptions.flatMap((rx: any) => rx.items || []).map((item: any, i: number) => (
                      <tr key={item.id || i}>
                        <td className="p-2 border">{orders.length + i + 1}</td>
                        <td className="p-2 border">
                          {item.drugName}
                          {(item.dose || item.frequency || item.duration) && (
                            <span className="text-gray-500 text-xs ml-1">
                              ({[item.dose, item.frequency, item.duration].filter(Boolean).join(' · ')})
                            </span>
                          )}
                        </td>
                        <td className="p-2 border">Pharmacy</td>
                        <td className="p-2 border">{item.quantity || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="italic">No invoice items found for this encounter.</p>
              )}
            </div>
          )}
        </Section>

        {/* Doctor Remarks */}
        {doctorRemarks.trim() && (
          <Section title="Doctor's Remarks / Justification">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{doctorRemarks}</p>
          </Section>
        )}

        {/* Declaration */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-600">
          <p className="font-semibold mb-1">Declaration:</p>
          <p>I hereby certify that the above information is true and correct. The services listed were medically necessary and were rendered to the named patient on the stated date(s).</p>
        </div>

        {/* Signature */}
        <div className="mt-8 pt-6 border-t flex justify-between items-end text-sm">
          <div>
            <p className="text-gray-600">Report Date: {new Date().toLocaleDateString()}</p>
            <p className="text-gray-600">Visit No: {encounter.visitNumber}</p>
            {(invoice as any)?.invoiceNumber && (
              <p className="text-gray-600">Invoice: {(invoice as any).invoiceNumber}</p>
            )}
          </div>
          <div className="text-right">
            <div className="w-48 border-b border-gray-400 mb-2" />
            <p className="font-medium text-gray-900">Dr. {doctorName}</p>
            <p className="text-gray-500 text-xs">Attending Physician</p>
            <p className="text-gray-500 text-xs">Signature & Stamp</p>
          </div>
        </div>

        {/* Facility stamp area */}
        <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          <p>{inst.name} — {inst.address}</p>
          {inst.phone && <p>Tel: {inst.phone}</p>}
          {inst.taxId && <p>TIN: {inst.taxId}</p>}
        </div>
      </div>

      {/* ── Editable remarks (NOT printed) ── */}
      <div className="mt-6 bg-white rounded-xl shadow-lg border p-6 no-print">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          <ClipboardList className="w-4 h-4 inline mr-1" />
          Doctor's Remarks / Justification (will appear on printed report)
        </label>
        <textarea
          value={doctorRemarks}
          onChange={(e) => setDoctorRemarks(e.target.value)}
          rows={4}
          placeholder="Add medical justification, treatment rationale, or remarks for the insurance provider..."
          className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

// ── Helpers ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold text-gray-800 border-b pb-1 mb-2 uppercase tracking-wide">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function fmtCurrency(amount: number | string | undefined): string {
  const num = Number(amount || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
