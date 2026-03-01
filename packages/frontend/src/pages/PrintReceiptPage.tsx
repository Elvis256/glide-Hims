import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Printer,
  Search,
  Download,
  ArrowLeft,
  Receipt,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import { billingService } from '../services/billing';
import { encountersService } from '../services/encounters';
import { clinicalNotesService, type ClinicalNote } from '../services/clinical-notes';
import { vitalsService, type VitalRecord } from '../services/vitals';
import { prescriptionsService, type Prescription } from '../services/prescriptions';
import { ordersService } from '../services/orders';
import { radiologyService, type ImagingOrder, type ImagingResult } from '../services/radiology';
import { patientsService } from '../services/patients';
import { useAuthStore } from '../store/auth';
import { printContent } from '../lib/print';

interface ReceiptEntry {
  id: string;
  receiptNumber: string;
  invoiceNumber: string;
  invoiceId: string;
  encounterId?: string;
  patientId?: string;
  patientName: string;
  patientMrn: string;
  amount: number;
  paymentMethod: string;
  date: string;
  time: string;
  cashier: string;
  invoiceType: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  services: { name: string; qty: number; unitPrice: number; amount: number; chargeType?: string }[];
}

function fmt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDT(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-UG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function age(dob?: string) {
  if (!dob) return '';
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600000))}yrs`;
}

export default function PrintReceiptPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptEntry | null>(null);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  const facilityName = user?.facility?.name || 'Medical Facility';
  const facilityLocation = user?.facility?.location || '';
  const facilityPhone = user?.facility?.contact?.phone || '';

  // Fetch payments
  const { data: paymentsData, isLoading, error } = useQuery({
    queryKey: ['payments', dateFilter],
    queryFn: () => billingService.payments.list({ startDate: dateFilter, endDate: dateFilter }),
  });

  const receipts: ReceiptEntry[] = (paymentsData || []).map((p: any) => ({
    id: p.id,
    receiptNumber: p.receiptNumber || `REC-${p.id.slice(0, 8).toUpperCase()}`,
    invoiceNumber: p.invoiceNumber || p.invoice?.invoiceNumber || 'N/A',
    invoiceId: p.invoiceId || p.invoice?.id || '',
    encounterId: p.invoice?.encounterId,
    patientId: p.invoice?.patientId || p.invoice?.patient?.id,
    patientName: p.patientName || p.invoice?.patient?.fullName || 'Unknown',
    patientMrn: p.invoice?.patient?.mrn || 'N/A',
    amount: p.amount || 0,
    paymentMethod: p.method || p.paymentMethod || 'Cash',
    date: new Date(p.createdAt || p.paidAt).toLocaleDateString(),
    time: new Date(p.createdAt || p.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cashier: typeof p.receivedBy === 'object' ? p.receivedBy?.fullName || p.receivedBy?.username : p.receivedBy || 'System',
    invoiceType: p.invoice?.type || 'opd',
    totalAmount: p.invoice?.totalAmount || p.invoice?.subtotal || p.amount || 0,
    paidAmount: p.invoice?.amountPaid || p.invoice?.paidAmount || p.amount || 0,
    balance: p.invoice?.balanceDue ?? p.invoice?.balance ?? 0,
    services: (p.invoice?.items || []).map((item: any) => ({
      name: item.description || item.serviceName || '—',
      qty: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      amount: item.amount || item.totalPrice || (item.quantity * item.unitPrice) || 0,
      chargeType: item.chargeType,
    })),
  }));

  const filtered = receipts.filter(r =>
    r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.patientMrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ---- Fetch clinical detail for selected receipt ----
  const encId = selectedReceipt?.encounterId;
  const patId = selectedReceipt?.patientId;

  const { data: patient } = useQuery({
    queryKey: ['pat-rcpt', patId],
    queryFn: () => patientsService.getById(patId!),
    enabled: !!patId,
  });

  const { data: encounter } = useQuery({
    queryKey: ['enc-rcpt', encId],
    queryFn: () => encountersService.getById(encId!),
    enabled: !!encId,
  });

  const { data: clinicalNotes } = useQuery({
    queryKey: ['cn-rcpt', encId],
    queryFn: () => clinicalNotesService.getByEncounter(encId!),
    enabled: !!encId,
  });

  const { data: vitals } = useQuery({
    queryKey: ['vt-rcpt', encId],
    queryFn: () => vitalsService.getByEncounter(encId!),
    enabled: !!encId,
  });

  const { data: prescriptions } = useQuery({
    queryKey: ['rx-rcpt', patId, encId],
    queryFn: async () => {
      const all = await prescriptionsService.getPatientPrescriptions(patId!);
      return all.filter((rx: Prescription) => rx.encounterId === encId);
    },
    enabled: !!patId && !!encId,
  });

  const { data: labOrders } = useQuery({
    queryKey: ['lab-rcpt', encId],
    queryFn: () => ordersService.getByEncounter(encId!).then(o => o.filter(x => x.orderType === 'lab')),
    enabled: !!encId,
  });

  const { data: radOrders } = useQuery({
    queryKey: ['rad-rcpt', encId],
    queryFn: async () => {
      if (!user?.facilityId || !patId) return [];
      const all = await radiologyService.orders.list(user.facilityId, { patientId: patId });
      return all.filter((o: ImagingOrder) => o.encounterId === encId);
    },
    enabled: !!encId && !!patId,
  });

  const { data: radResults } = useQuery({
    queryKey: ['rad-res-rcpt', radOrders?.map((o: ImagingOrder) => o.id)],
    queryFn: async () => {
      if (!radOrders?.length) return {};
      const r: Record<string, ImagingResult | null> = {};
      await Promise.all(radOrders.map(async (o: ImagingOrder) => {
        try { r[o.id] = await radiologyService.results.getForOrder(o.id); } catch { r[o.id] = null; }
      }));
      return r;
    },
    enabled: !!radOrders?.length,
  });

  const latestVital = vitals?.length ? vitals[vitals.length - 1] : null;

  // Parse encounter notes JSON for structured data
  const parsedNotes = (() => {
    if (!encounter?.notes) return {};
    try { return JSON.parse(encounter.notes); } catch { return {}; }
  })();

  // Aggregate diagnoses
  const allDx = (() => {
    const dx: { code: string; description: string; type: string }[] = [];
    clinicalNotes?.forEach((n: ClinicalNote) => n.diagnoses?.forEach(d => {
      if (!dx.find(x => x.code === d.code)) dx.push(d);
    }));
    parsedNotes.diagnoses?.forEach((d: any) => {
      if (!dx.find(x => x.code === d.code)) dx.push(d);
    });
    return dx;
  })();

  // Group services by charge type
  const groupedServices = (() => {
    const groups: Record<string, ReceiptEntry['services']> = {};
    selectedReceipt?.services.forEach(s => {
      const key = s.chargeType || 'OTHER';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  })();

  const chargeTypeLabels: Record<string, string> = {
    CONSULTATION: 'Consultation', PROCEDURE: 'Procedures', LAB: 'Laboratory',
    RADIOLOGY: 'Radiology / Imaging', PHARMACY: 'Pharmacy / Medications',
    BED: 'Bed / Accommodation', NURSING: 'Nursing Services', OTHER: 'Other Services',
  };

  const handlePrint = () => {
    const el = document.getElementById('detailed-receipt');
    if (el) printContent(el.innerHTML, `Receipt - ${selectedReceipt?.receiptNumber}`);
  };

  const handleDownloadPDF = () => {
    if (!selectedReceipt) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const w = 210;
    let y = 15;
    const lm = 15;
    const rm = w - 15;
    const cw = rm - lm;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(facilityName.toUpperCase(), w / 2, y, { align: 'center' });
    y += 5;
    if (facilityLocation) { doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(facilityLocation, w / 2, y, { align: 'center' }); y += 4; }
    if (facilityPhone) { doc.text(`Tel: ${facilityPhone}`, w / 2, y, { align: 'center' }); y += 4; }
    y += 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('DETAILED RECEIPT', w / 2, y, { align: 'center' }); y += 6;
    doc.setLineWidth(0.5); doc.line(lm, y, rm, y); y += 5;

    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    const row = (l: string, v: string) => { doc.text(l, lm, y); doc.text(v, rm, y, { align: 'right' }); y += 4; };
    row('Receipt No:', selectedReceipt.receiptNumber);
    row('Invoice No:', selectedReceipt.invoiceNumber);
    row('Date:', `${selectedReceipt.date} ${selectedReceipt.time}`);
    row('Patient:', selectedReceipt.patientName);
    row('MRN:', selectedReceipt.patientMrn);
    y += 2; doc.line(lm, y, rm, y); y += 4;

    doc.setFont('helvetica', 'bold'); doc.text('SERVICES', lm, y); y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text('Description', lm, y); doc.text('Qty', lm + cw * 0.55, y); doc.text('Price', lm + cw * 0.68, y); doc.text('Amount', rm, y, { align: 'right' });
    y += 3; doc.line(lm, y, rm, y); y += 3;

    selectedReceipt.services.forEach(s => {
      if (y > 270) { doc.addPage(); y = 15; }
      const name = s.name.length > 45 ? s.name.substring(0, 42) + '...' : s.name;
      doc.text(name, lm, y);
      doc.text(String(s.qty), lm + cw * 0.55, y);
      doc.text(s.unitPrice.toLocaleString(), lm + cw * 0.68, y);
      doc.text(s.amount.toLocaleString(), rm, y, { align: 'right' });
      y += 4;
    });

    y += 2; doc.line(lm, y, rm, y); y += 4;
    doc.setFont('helvetica', 'bold');
    row('TOTAL:', `UGX ${selectedReceipt.totalAmount.toLocaleString()}`);
    row('PAID:', `UGX ${selectedReceipt.paidAmount.toLocaleString()}`);
    if (selectedReceipt.balance > 0) row('BALANCE:', `UGX ${selectedReceipt.balance.toLocaleString()}`);
    row('Method:', selectedReceipt.paymentMethod.replace('_', ' '));

    y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`Cashier: ${selectedReceipt.cashier}`, w / 2, y, { align: 'center' }); y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Thank you for choosing us!', w / 2, y, { align: 'center' }); y += 3;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text('Computer generated receipt', w / 2, y, { align: 'center' });

    doc.save(`Receipt_${selectedReceipt.receiptNumber}.pdf`);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg print:hidden">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <Printer className="w-6 h-6 text-blue-600 print:hidden" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Detailed Receipt</h1>
            <p className="text-gray-500 text-sm print:hidden">View and print comprehensive patient receipts</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0 overflow-hidden print:block">
        {/* Left: Receipt List */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0 print:hidden">
          <div className="flex gap-3 mb-3 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search receipt, patient..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="input pl-9 py-2 text-sm" />
            </div>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="input py-2 text-sm w-36" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading && <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}
            {error && <div className="flex items-center justify-center h-full text-red-500"><AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Failed to load</p></div>}
            {!isLoading && !error && filtered.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-400 flex-col">
                <Receipt className="w-12 h-12 mb-2 opacity-50" /><p>No receipts found</p>
              </div>
            )}
            {filtered.map(r => (
              <button key={r.id} onClick={() => setSelectedReceipt(r)}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${selectedReceipt?.id === r.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-medium text-green-600">{r.receiptNumber}</span>
                  <span className="font-bold text-gray-900">UGX {r.amount.toLocaleString()}</span>
                </div>
                <p className="font-medium text-gray-900">{r.patientName}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{r.patientMrn}</span><span>•</span><span>{r.date} {r.time}</span><span>•</span><span className="capitalize">{r.paymentMethod.replace('_', ' ')}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detailed Receipt Preview */}
        <div className="lg:col-span-3 card p-4 flex flex-col min-h-0 print:shadow-none print:p-0">
          {!selectedReceipt ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 print:hidden flex-col">
              <Receipt className="w-16 h-16 mb-4 opacity-50" /><p>Select a receipt to preview</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                <div id="detailed-receipt" className="max-w-2xl mx-auto bg-white border border-gray-200 print:border-none print:max-w-none">

                  {/* ===== RECEIPT HEADER ===== */}
                  <div className="border-b-2 border-gray-800 px-8 pt-6 pb-3 text-center">
                    <h1 className="text-lg font-bold uppercase tracking-wider">{facilityName}</h1>
                    {facilityLocation && <p className="text-xs text-gray-500">{facilityLocation}</p>}
                    {facilityPhone && <p className="text-xs text-gray-500">Tel: {facilityPhone}</p>}
                    <div className="mt-2 border-t border-b border-gray-300 py-1">
                      <h2 className="text-sm font-bold uppercase">Detailed Patient Receipt</h2>
                    </div>
                  </div>

                  <div className="px-8 py-5 text-[12px] space-y-5">

                    {/* Receipt & Patient Info */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                      <div>
                        <p><span className="text-gray-500">Receipt No:</span> <span className="font-bold font-mono">{selectedReceipt.receiptNumber}</span></p>
                        <p><span className="text-gray-500">Invoice No:</span> <span className="font-mono">{selectedReceipt.invoiceNumber}</span></p>
                        <p><span className="text-gray-500">Date:</span> {selectedReceipt.date} {selectedReceipt.time}</p>
                        <p><span className="text-gray-500">Cashier:</span> {selectedReceipt.cashier}</p>
                      </div>
                      <div>
                        <p><span className="text-gray-500">Patient:</span> <span className="font-bold">{selectedReceipt.patientName}</span></p>
                        <p><span className="text-gray-500">MRN:</span> {selectedReceipt.patientMrn}</p>
                        {patient && <p><span className="text-gray-500">Age/Sex:</span> {age(patient.dateOfBirth)}, <span className="capitalize">{patient.gender}</span></p>}
                        {patient?.phone && <p><span className="text-gray-500">Phone:</span> {patient.phone}</p>}
                      </div>
                    </div>
                    {encounter && (
                      <div className="bg-gray-50 rounded p-2 text-[11px] grid grid-cols-3 gap-2">
                        <p><span className="text-gray-500">Visit:</span> {encounter.visitNumber}</p>
                        <p><span className="text-gray-500">Type:</span> <span className="uppercase">{encounter.type}</span></p>
                        <p><span className="text-gray-500">Doctor:</span> {encounter.doctor?.fullName || '—'}</p>
                      </div>
                    )}

                    {/* ---- CLINICAL SUMMARY ---- */}
                    {(encounter?.chiefComplaint || clinicalNotes?.length || latestVital) && (
                      <div className="border-t pt-3">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Clinical Summary</h3>

                        {encounter?.chiefComplaint && (
                          <div className="mb-2">
                            <span className="font-semibold text-gray-700">Presenting Complaint: </span>
                            <span>{encounter.chiefComplaint}</span>
                          </div>
                        )}

                        {/* Vital Signs */}
                        {latestVital && (
                          <div className="mb-2">
                            <span className="font-semibold text-gray-700">Vitals: </span>
                            <span>
                              {[
                                latestVital.bloodPressureSystolic != null && `BP ${latestVital.bloodPressureSystolic}/${latestVital.bloodPressureDiastolic} mmHg`,
                                latestVital.pulse != null && `Pulse ${latestVital.pulse} bpm`,
                                latestVital.temperature != null && `Temp ${latestVital.temperature}°C`,
                                latestVital.respiratoryRate != null && `RR ${latestVital.respiratoryRate}/min`,
                                latestVital.oxygenSaturation != null && `SpO₂ ${latestVital.oxygenSaturation}%`,
                                latestVital.weight != null && `Wt ${latestVital.weight}kg`,
                              ].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}

                        {/* History / Subjective */}
                        {(parsedNotes.hpi || clinicalNotes?.some((n: ClinicalNote) => n.subjective)) && (
                          <div className="mb-2">
                            <span className="font-semibold text-gray-700">History: </span>
                            <span className="whitespace-pre-wrap">{parsedNotes.hpi || clinicalNotes?.find((n: ClinicalNote) => n.subjective)?.subjective}</span>
                          </div>
                        )}

                        {/* Examination Findings */}
                        {(parsedNotes.exam?.length || clinicalNotes?.some((n: ClinicalNote) => n.objective)) && (
                          <div className="mb-2">
                            <span className="font-semibold text-gray-700">Examination Findings: </span>
                            {parsedNotes.exam?.length ? (
                              <span>{parsedNotes.exam.map((e: any) => `${e.system}: ${e.findings || (e.isNormal ? 'Normal' : '—')}`).join('; ')}</span>
                            ) : (
                              <span className="whitespace-pre-wrap">{clinicalNotes?.find((n: ClinicalNote) => n.objective)?.objective}</span>
                            )}
                          </div>
                        )}

                        {/* Diagnoses */}
                        {allDx.length > 0 && (
                          <div className="mb-2">
                            <span className="font-semibold text-gray-700">Diagnosis: </span>
                            <span>{allDx.map(d => `${d.description} (${d.code})`).join('; ')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ---- LAB INVESTIGATIONS ---- */}
                    {labOrders && labOrders.length > 0 && (
                      <div className="border-t pt-3">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Laboratory Investigations</h3>
                        {labOrders.map(order => (
                          <div key={order.id} className="mb-2">
                            <p className="text-[11px] text-gray-500">Order #{order.orderNumber} — {fmt(order.createdAt)} — <span className="capitalize">{order.status}</span></p>
                            <ul className="list-disc list-inside ml-2">
                              {(order.testCodes || []).map((tc, i) => (
                                <li key={i}>{tc.name} <span className="text-gray-400">({tc.code})</span></li>
                              ))}
                            </ul>
                            {order.resultData && Object.keys(order.resultData).length > 0 && (
                              <div className="ml-2 mt-1 p-1.5 bg-gray-50 rounded text-[11px]">
                                <span className="font-semibold">Results: </span>
                                <pre className="whitespace-pre-wrap inline">{JSON.stringify(order.resultData, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ---- RADIOLOGY ---- */}
                    {radOrders && radOrders.length > 0 && (
                      <div className="border-t pt-3">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Radiology / Imaging</h3>
                        {radOrders.map((order: ImagingOrder) => {
                          const res = radResults?.[order.id];
                          return (
                            <div key={order.id} className="mb-2">
                              <p className="font-medium">{order.studyType || order.examType}{order.bodyPart ? ` (${order.bodyPart})` : ''}</p>
                              <p className="text-[11px] text-gray-500">Order #{order.orderNumber} — {fmt(order.createdAt)} — <span className="capitalize">{order.status}</span></p>
                              {res && (
                                <div className="ml-2 mt-1 text-[11px]">
                                  <p><span className="font-semibold">Findings:</span> {res.findings}</p>
                                  <p><span className="font-semibold">Impression:</span> {res.impression}</p>
                                  {res.recommendations && <p><span className="font-semibold">Recommendations:</span> {res.recommendations}</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ---- MEDICATIONS ---- */}
                    {prescriptions && prescriptions.length > 0 && (
                      <div className="border-t pt-3">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">Medications Dispensed</h3>
                        {prescriptions.map((rx: Prescription) => (
                          <div key={rx.id} className="mb-2">
                            <p className="text-[11px] text-gray-500">Rx #{rx.prescriptionNumber} — Status: <span className="capitalize font-medium">{rx.status}</span></p>
                            <table className="w-full text-[11px] mt-1">
                              <thead><tr className="border-b">
                                <th className="text-left py-0.5 font-semibold">Drug</th>
                                <th className="text-left py-0.5 font-semibold">Dose</th>
                                <th className="text-left py-0.5 font-semibold">Freq</th>
                                <th className="text-left py-0.5 font-semibold">Duration</th>
                                <th className="text-right py-0.5 font-semibold">Qty</th>
                              </tr></thead>
                              <tbody>
                                {rx.items.map(item => (
                                  <tr key={item.id} className="border-b border-gray-100">
                                    <td className="py-0.5">{item.drugName}</td>
                                    <td className="py-0.5">{item.dose}</td>
                                    <td className="py-0.5">{item.frequency}</td>
                                    <td className="py-0.5">{item.duration}</td>
                                    <td className="py-0.5 text-right">{item.quantity}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ---- BILLING BREAKDOWN ---- */}
                    <div className="border-t-2 border-gray-800 pt-3">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-2">Billing Breakdown</h3>
                      <table className="w-full">
                        <thead><tr className="border-b border-gray-300">
                          <th className="text-left py-1 text-[11px] font-semibold text-gray-600">#</th>
                          <th className="text-left py-1 text-[11px] font-semibold text-gray-600">Description</th>
                          <th className="text-center py-1 text-[11px] font-semibold text-gray-600">Qty</th>
                          <th className="text-right py-1 text-[11px] font-semibold text-gray-600">Unit Price</th>
                          <th className="text-right py-1 text-[11px] font-semibold text-gray-600">Amount (UGX)</th>
                        </tr></thead>
                        <tbody>
                          {Object.entries(groupedServices).map(([type, items]) => (
                            <React.Fragment key={type}>
                              {Object.keys(groupedServices).length > 1 && (
                                <tr><td colSpan={5} className="pt-2 pb-0.5 text-[10px] font-bold text-gray-500 uppercase">{chargeTypeLabels[type] || type}</td></tr>
                              )}
                              {items.map((s, i) => (
                                <tr key={i} className="border-b border-gray-100">
                                  <td className="py-1 text-gray-400">{i + 1}</td>
                                  <td className="py-1">{s.name}</td>
                                  <td className="py-1 text-center">{s.qty}</td>
                                  <td className="py-1 text-right">{s.unitPrice.toLocaleString()}</td>
                                  <td className="py-1 text-right font-medium">{s.amount.toLocaleString()}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-800">
                            <td colSpan={4} className="py-1.5 text-right font-bold">Total:</td>
                            <td className="py-1.5 text-right font-bold">UGX {selectedReceipt.totalAmount.toLocaleString()}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="py-0.5 text-right font-semibold text-green-700">Amount Paid:</td>
                            <td className="py-0.5 text-right font-semibold text-green-700">UGX {selectedReceipt.paidAmount.toLocaleString()}</td>
                          </tr>
                          {selectedReceipt.balance > 0 && (
                            <tr>
                              <td colSpan={4} className="py-0.5 text-right font-semibold text-red-600">Balance Due:</td>
                              <td className="py-0.5 text-right font-semibold text-red-600">UGX {selectedReceipt.balance.toLocaleString()}</td>
                            </tr>
                          )}
                          <tr>
                            <td colSpan={4} className="py-0.5 text-right text-gray-500">Payment Method:</td>
                            <td className="py-0.5 text-right capitalize">{selectedReceipt.paymentMethod.replace('_', ' ')}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* ---- FOOTER ---- */}
                    <div className="border-t pt-4 mt-4 text-center text-[11px] text-gray-500">
                      <p>Served by: {selectedReceipt.cashier}</p>
                      <p className="font-bold mt-2 text-gray-700">Thank you for choosing {facilityName}!</p>
                      <p className="text-[10px] mt-1">Get well soon • This is a computer generated receipt</p>
                    </div>

                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 mt-4 flex-shrink-0 print:hidden">
                <button onClick={handleDownloadPDF} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button onClick={handlePrint} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Printer className="w-4 h-4" /> Print
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
