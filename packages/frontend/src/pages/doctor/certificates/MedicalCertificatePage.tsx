import React, { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/auth';
import {
  FileText,
  User,
  Printer,
  Loader2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';
import { encountersService } from '../../../services/encounters';
import { clinicalNotesService, type ClinicalNote } from '../../../services/clinical-notes';
import { vitalsService, type VitalRecord } from '../../../services/vitals';
import { prescriptionsService, type Prescription } from '../../../services/prescriptions';
import { ordersService } from '../../../services/orders';
import { radiologyService, type ImagingOrder, type ImagingResult } from '../../../services/radiology';
import { problemsService } from '../../../services/problems';
import { printContent } from '../../../lib/print';

function fmt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-UG', { year: 'numeric', month: 'long', day: 'numeric' });
}
function fmtShort(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDT(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-UG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function age(dob?: string) {
  if (!dob) return '—';
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600000));
  return `${y} years`;
}

/** Parse the JSON notes stored on the encounter */
function parseEncounterNotes(notes?: string): {
  hpi?: string;
  ros?: { system: string; findings: string[]; notes?: string }[];
  exam?: { system: string; findings: string; isNormal?: boolean }[];
  assessment?: string;
  diagnoses?: { code: string; description: string; type: string }[];
  plan?: { type: string; description: string; details?: any }[];
} {
  if (!notes) return {};
  try { return JSON.parse(notes); } catch { return {}; }
}

export default function MedicalCertificatePage() {
  const { user } = useAuthStore();
  const reportRef = useRef<HTMLDivElement>(null);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedEncounterId, setSelectedEncounterId] = useState('');
  const [doctorOpinion, setDoctorOpinion] = useState('');
  const [doctorRecommendations, setDoctorRecommendations] = useState('');

  // ---- DATA FETCHING ----
  const { data: patientsResp, isLoading: loadingPat } = useQuery({
    queryKey: ['patients', 'report'],
    queryFn: () => patientsService.search({ limit: 200 }),
  });
  const patientList = useMemo(() => patientsResp?.data || [], [patientsResp]);

  // Full patient details (allergies, blood group, etc.)
  const { data: patient } = useQuery({
    queryKey: ['patient-detail', selectedPatientId],
    queryFn: () => patientsService.getById(selectedPatientId),
    enabled: !!selectedPatientId,
  });

  // Patient encounters
  const { data: encResp } = useQuery({
    queryKey: ['enc-list', selectedPatientId],
    queryFn: () => encountersService.list({ patientId: selectedPatientId, limit: 50 }),
    enabled: !!selectedPatientId,
  });
  const encounters = encResp?.data || [];

  // Problem list / chronic conditions
  const { data: problems } = useQuery({
    queryKey: ['problems', selectedPatientId],
    queryFn: () => problemsService.getByPatient(selectedPatientId),
    enabled: !!selectedPatientId,
  });

  // Selected encounter
  const encounter = encounters.find((e: any) => e.id === selectedEncounterId);
  const parsedNotes = useMemo(() => parseEncounterNotes(encounter?.notes), [encounter?.notes]);

  // Clinical notes (SOAP)
  const { data: clinicalNotes, isLoading: l1 } = useQuery({
    queryKey: ['cn', selectedEncounterId],
    queryFn: () => clinicalNotesService.getByEncounter(selectedEncounterId),
    enabled: !!selectedEncounterId,
  });

  // Vitals
  const { data: vitals, isLoading: l2 } = useQuery({
    queryKey: ['vt', selectedEncounterId],
    queryFn: () => vitalsService.getByEncounter(selectedEncounterId),
    enabled: !!selectedEncounterId,
  });

  // Prescriptions
  const { data: prescriptions, isLoading: l3 } = useQuery({
    queryKey: ['rx-rpt', selectedPatientId, selectedEncounterId],
    queryFn: async () => {
      const all = await prescriptionsService.getPatientPrescriptions(selectedPatientId);
      return all.filter((rx: Prescription) => rx.encounterId === selectedEncounterId);
    },
    enabled: !!selectedPatientId && !!selectedEncounterId,
  });

  // Lab orders
  const { data: labOrders, isLoading: l4 } = useQuery({
    queryKey: ['lab-rpt', selectedEncounterId],
    queryFn: () => ordersService.getByEncounter(selectedEncounterId).then(o => o.filter(x => x.orderType === 'lab')),
    enabled: !!selectedEncounterId,
  });

  // Radiology orders
  const { data: radOrders, isLoading: l5 } = useQuery({
    queryKey: ['rad-rpt', selectedEncounterId],
    queryFn: async () => {
      if (!user?.facilityId) return [];
      const all = await radiologyService.orders.list(user.facilityId, { patientId: selectedPatientId });
      return all.filter((o: ImagingOrder) => o.encounterId === selectedEncounterId);
    },
    enabled: !!selectedEncounterId && !!selectedPatientId,
  });

  // Radiology results
  const { data: radResults } = useQuery({
    queryKey: ['rad-res-rpt', radOrders?.map((o: ImagingOrder) => o.id)],
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

  const isLoading = l1 || l2 || l3 || l4 || l5;
  const latestVital = vitals?.length ? vitals[vitals.length - 1] : null;
  const facilityName = user?.facility?.name || 'Medical Facility';
  const facilityLocation = user?.facility?.location || '';

  // Aggregate diagnoses
  const allDx = useMemo(() => {
    const dx: { code: string; description: string; type: string }[] = [];
    clinicalNotes?.forEach((n: ClinicalNote) => n.diagnoses?.forEach(d => {
      if (!dx.find(x => x.code === d.code)) dx.push(d);
    }));
    parsedNotes.diagnoses?.forEach(d => {
      if (!dx.find(x => x.code === d.code)) dx.push(d);
    });
    return dx;
  }, [clinicalNotes, parsedNotes]);

  // Auto-populate doctor opinion & recommendations from saved data
  useEffect(() => {
    if (!selectedEncounterId) return;
    // Build opinion from assessment
    const parts: string[] = [];
    if (parsedNotes.assessment) parts.push(parsedNotes.assessment);
    clinicalNotes?.forEach((n: ClinicalNote) => {
      if (n.assessment && !parts.includes(n.assessment)) parts.push(n.assessment);
    });
    if (parts.length) setDoctorOpinion(parts.join('\n\n'));

    // Build recommendations from plan
    const planParts: string[] = [];
    clinicalNotes?.forEach((n: ClinicalNote) => {
      if (n.plan) planParts.push(n.plan);
      if (n.followUpDate) planParts.push(`Follow-up: ${fmt(n.followUpDate)}${n.followUpNotes ? ' — ' + n.followUpNotes : ''}`);
    });
    if (parsedNotes.plan?.length) {
      parsedNotes.plan.forEach(p => planParts.push(`• ${p.description}`));
    }
    if (planParts.length) setDoctorRecommendations(planParts.join('\n'));
  }, [selectedEncounterId, clinicalNotes, parsedNotes]);

  const handlePatientChange = (id: string) => {
    setSelectedPatientId(id);
    setSelectedEncounterId('');
    setDoctorOpinion('');
    setDoctorRecommendations('');
  };

  const handlePrint = () => {
    if (reportRef.current) {
      printContent(reportRef.current.innerHTML, 'Medical Report');
    }
    if (selectedPatientId && selectedEncounterId) {
      const serial = `RPT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      patientsService
        .createNote(selectedPatientId, { type: 'administrative', content: `[Medical Report] ${serial} | Visit: ${encounter?.visitNumber} | Opinion: ${doctorOpinion} | Recommendations: ${doctorRecommendations}` })
        .then(() => toast.success(`Report saved (${serial})`))
        .catch(() => {});
    }
  };

  // ---- RENDER ----
  const sectionNum = (() => { let n = 0; return () => ++n; })();

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Medical Report</h1>
        </div>
        <button
          onClick={handlePrint}
          disabled={!selectedEncounterId}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Printer className="w-4 h-4" /> Print Report
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* ---- Selectors ---- */}
        <div className="max-w-[900px] mx-auto mb-5 bg-white rounded-xl p-4 shadow-sm border grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1"><User className="w-3.5 h-3.5 inline mr-1" />Patient</label>
            <div className="relative">
              <select value={selectedPatientId} onChange={e => handlePatientChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none" disabled={loadingPat}>
                <option value="">{loadingPat ? 'Loading...' : 'Select patient...'}</option>
                {patientList.map((p: any) => <option key={p.id} value={p.id}>{p.fullName} — {p.mrn}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Visit / Encounter</label>
            <div className="relative">
              <select value={selectedEncounterId} onChange={e => setSelectedEncounterId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none" disabled={!encounters.length}>
                <option value="">{!selectedPatientId ? 'Select patient first' : encounters.length ? 'Select visit...' : 'No visits found'}</option>
                {encounters.map((e: any) => <option key={e.id} value={e.id}>{e.visitNumber} — {fmtShort(e.visitDate)} — {e.type?.toUpperCase()}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {isLoading && selectedEncounterId && (
          <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading clinical data...</div>
        )}

        {!selectedEncounterId && (
          <div className="text-center py-20 text-gray-300">
            <FileText className="w-20 h-20 mx-auto mb-4 opacity-20" />
            <p className="text-lg">Select a patient and visit to generate the medical report</p>
          </div>
        )}

        {selectedEncounterId && !isLoading && (
          <div className="max-w-[900px] mx-auto space-y-5">
            {/* Editable opinion box */}
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Doctor's Opinion & Recommendations <span className="text-gray-400 font-normal">(editable — will appear at the end of the report)</span></p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <textarea value={doctorOpinion} onChange={e => setDoctorOpinion(e.target.value)}
                  placeholder="Clinical opinion / conclusion..." rows={4}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
                <textarea value={doctorRecommendations} onChange={e => setDoctorRecommendations(e.target.value)}
                  placeholder="Recommendations / follow-up..." rows={4}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
            </div>

            {/* ===== PRINTABLE REPORT ===== */}
            <div ref={reportRef} className="bg-white shadow-lg border text-[13px] leading-relaxed text-gray-800">

              {/* ---- Header ---- */}
              <div className="border-b-2 border-gray-800 px-10 pt-8 pb-4 text-center">
                <h1 className="text-xl font-bold uppercase tracking-wider">{facilityName}</h1>
                {facilityLocation && <p className="text-xs text-gray-500">{facilityLocation}</p>}
                <div className="mt-3 border-t border-b border-gray-300 py-2">
                  <h2 className="text-base font-bold uppercase tracking-wide">Medical Report</h2>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Date of Report: {fmt(new Date().toISOString())}</p>
              </div>

              <div className="px-10 py-6 space-y-6">

                {/* ---- 1. Patient Particulars ---- */}
                <Section n={sectionNum()} title="Patient Particulars">
                  <div className="grid grid-cols-3 gap-y-1 gap-x-6">
                    <Field label="Full Name" value={patient?.fullName} />
                    <Field label="MRN" value={patient?.mrn} />
                    <Field label="Date of Birth" value={`${fmt(patient?.dateOfBirth)} (${age(patient?.dateOfBirth)})`} />
                    <Field label="Sex" value={patient?.gender} capitalize />
                    <Field label="Blood Group" value={patient?.bloodGroup || 'Not recorded'} />
                    <Field label="Contact" value={patient?.phone || patient?.email || '—'} />
                    {patient?.address && <Field label="Address" value={patient.address} />}
                    {patient?.nationalId && <Field label="National ID" value={patient.nationalId} />}
                    {patient?.nextOfKin?.name && <Field label="Next of Kin" value={`${patient.nextOfKin.name} (${patient.nextOfKin.relationship || '—'}) — ${patient.nextOfKin.phone || ''}`} />}
                  </div>
                </Section>

                {/* ---- 2. Visit Details ---- */}
                <Section n={sectionNum()} title="Visit Details">
                  <div className="grid grid-cols-3 gap-y-1 gap-x-6">
                    <Field label="Visit Number" value={encounter?.visitNumber} />
                    <Field label="Visit Date" value={fmt(encounter?.visitDate)} />
                    <Field label="Visit Type" value={encounter?.type?.toUpperCase()} />
                    <Field label="Department" value={encounter?.department || '—'} />
                    <Field label="Attending Doctor" value={encounter?.doctor?.fullName || user?.fullName || '—'} />
                    <Field label="Status" value={encounter?.status} capitalize />
                  </div>
                </Section>

                {/* ---- 3. Allergies ---- */}
                {patient?.allergies && (
                  <Section n={sectionNum()} title="Known Allergies">
                    <p className="text-red-700 font-medium">{patient.allergies}</p>
                  </Section>
                )}

                {/* ---- Known Medical Conditions / Problem List ---- */}
                {problems && problems.length > 0 && (
                  <Section n={sectionNum()} title="Known Medical Conditions">
                    <table className="w-full"><thead><tr className="border-b">
                      <TH>Condition</TH><TH>ICD Code</TH><TH>Status</TH><TH>Severity</TH><TH>Since</TH>
                    </tr></thead><tbody>
                      {problems.map((p: any) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <TD>{p.diagnosis}</TD><TD mono>{p.icdCode}</TD><TD capitalize>{p.status}</TD><TD capitalize>{p.severity || '—'}</TD><TD>{fmtShort(p.onsetDate)}</TD>
                        </tr>
                      ))}
                    </tbody></table>
                  </Section>
                )}

                {/* ---- Presenting Complaints ---- */}
                {encounter?.chiefComplaint && (
                  <Section n={sectionNum()} title="Presenting Complaints">
                    <p>{encounter.chiefComplaint}</p>
                  </Section>
                )}

                {/* ---- History of Present Illness ---- */}
                {(parsedNotes.hpi || clinicalNotes?.some((n: ClinicalNote) => n.subjective)) && (
                  <Section n={sectionNum()} title="History of Present Illness">
                    {parsedNotes.hpi && <p className="whitespace-pre-wrap">{parsedNotes.hpi}</p>}
                    {clinicalNotes?.filter((n: ClinicalNote) => n.subjective).map((n: ClinicalNote, i: number) => (
                      <p key={n.id} className={`whitespace-pre-wrap ${i > 0 || parsedNotes.hpi ? 'mt-2' : ''}`}>{n.subjective}</p>
                    ))}
                  </Section>
                )}

                {/* ---- Review of Systems ---- */}
                {parsedNotes.ros && parsedNotes.ros.length > 0 && (
                  <Section n={sectionNum()} title="Review of Systems">
                    <table className="w-full"><thead><tr className="border-b">
                      <TH>System</TH><TH>Findings</TH><TH>Notes</TH>
                    </tr></thead><tbody>
                      {parsedNotes.ros.map((r, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <TD bold>{r.system}</TD>
                          <TD>{r.findings?.join(', ') || 'No significant findings'}</TD>
                          <TD>{r.notes || '—'}</TD>
                        </tr>
                      ))}
                    </tbody></table>
                  </Section>
                )}

                {/* ---- Physical Examination ---- */}
                <Section n={sectionNum()} title="Physical Examination">
                  {/* Vital Signs */}
                  {latestVital && (
                    <div className="mb-4">
                      <p className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-2">Vital Signs</p>
                      <div className="grid grid-cols-5 gap-2">
                        {latestVital.bloodPressureSystolic != null && <VitalBox label="Blood Pressure" value={`${latestVital.bloodPressureSystolic}/${latestVital.bloodPressureDiastolic}`} unit="mmHg" />}
                        {latestVital.pulse != null && <VitalBox label="Pulse Rate" value={latestVital.pulse} unit="bpm" />}
                        {latestVital.temperature != null && <VitalBox label="Temperature" value={latestVital.temperature} unit="°C" />}
                        {latestVital.respiratoryRate != null && <VitalBox label="Resp. Rate" value={latestVital.respiratoryRate} unit="/min" />}
                        {latestVital.oxygenSaturation != null && <VitalBox label="SpO₂" value={`${latestVital.oxygenSaturation}%`} />}
                        {latestVital.weight != null && <VitalBox label="Weight" value={latestVital.weight} unit="kg" />}
                        {latestVital.height != null && <VitalBox label="Height" value={latestVital.height} unit="cm" />}
                        {latestVital.bloodGlucose != null && <VitalBox label="Blood Glucose" value={latestVital.bloodGlucose} unit="mmol/L" />}
                        {latestVital.painScale != null && <VitalBox label="Pain Scale" value={`${latestVital.painScale}/10`} />}
                      </div>
                      {latestVital.weight && latestVital.height && (
                        <p className="text-xs text-gray-500 mt-1">BMI: {(latestVital.weight / Math.pow(latestVital.height / 100, 2)).toFixed(1)} kg/m²</p>
                      )}
                    </div>
                  )}

                  {/* System examination from structured notes */}
                  {parsedNotes.exam && parsedNotes.exam.length > 0 && (
                    <div>
                      <p className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-2">Systemic Examination</p>
                      <table className="w-full"><thead><tr className="border-b">
                        <TH>System</TH><TH>Findings</TH><TH></TH>
                      </tr></thead><tbody>
                        {parsedNotes.exam.map((ex, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <TD bold>{ex.system}</TD>
                            <TD>{ex.findings || (ex.isNormal ? 'Normal' : '—')}</TD>
                            <td className="py-1 px-2">{ex.isNormal && <span className="text-green-600 text-xs font-medium">Normal</span>}</td>
                          </tr>
                        ))}
                      </tbody></table>
                    </div>
                  )}

                  {/* Objective from clinical notes (free text) */}
                  {clinicalNotes?.some((n: ClinicalNote) => n.objective) && (!parsedNotes.exam?.length) && (
                    <div>
                      <p className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-2">Examination Findings</p>
                      {clinicalNotes.filter((n: ClinicalNote) => n.objective).map((n: ClinicalNote) => (
                        <p key={n.id} className="whitespace-pre-wrap">{n.objective}</p>
                      ))}
                    </div>
                  )}

                  {!latestVital && !parsedNotes.exam?.length && !clinicalNotes?.some((n: ClinicalNote) => n.objective) && (
                    <p className="text-gray-400 italic">No examination findings recorded for this visit.</p>
                  )}
                </Section>

                {/* ---- Investigations ---- */}
                {((labOrders && labOrders.length > 0) || (radOrders && radOrders.length > 0)) && (
                  <Section n={sectionNum()} title="Investigations">

                    {/* Lab */}
                    {labOrders && labOrders.length > 0 && (
                      <div className="mb-4">
                        <p className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-2">A. Laboratory</p>
                        {labOrders.map(order => (
                          <div key={order.id} className="mb-3">
                            <p className="text-xs text-gray-500">Order #{order.orderNumber} — {fmtShort(order.createdAt)} — Priority: {order.priority || 'Routine'} — Status: <span className="capitalize font-medium">{order.status}</span></p>
                            <table className="w-full mt-1"><thead><tr className="border-b">
                              <TH>Test</TH><TH>Code</TH><TH>Status</TH>
                            </tr></thead><tbody>
                              {(order.testCodes || []).map((tc, i) => (
                                <tr key={i} className="border-b border-gray-100">
                                  <TD>{tc.name}</TD><TD mono>{tc.code}</TD><TD capitalize>{order.status}</TD>
                                </tr>
                              ))}
                            </tbody></table>
                            {order.resultData && Object.keys(order.resultData).length > 0 && (
                              <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                                <p className="font-semibold mb-1">Results:</p>
                                <pre className="whitespace-pre-wrap">{JSON.stringify(order.resultData, null, 2)}</pre>
                              </div>
                            )}
                            {order.clinicalNotes && <p className="text-xs text-gray-500 mt-1 italic">Clinical notes: {order.clinicalNotes}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Radiology */}
                    {radOrders && radOrders.length > 0 && (
                      <div>
                        <p className="font-semibold text-xs uppercase tracking-wide text-gray-600 mb-2">B. Radiology / Imaging</p>
                        {radOrders.map((order: ImagingOrder) => {
                          const res = radResults?.[order.id];
                          return (
                            <div key={order.id} className="mb-3">
                              <p className="font-medium">{order.studyType || order.examType}{order.bodyPart ? ` (${order.bodyPart})` : ''}</p>
                              <p className="text-xs text-gray-500">Order #{order.orderNumber} — {fmtShort(order.createdAt)} — Status: <span className="capitalize">{order.status}</span></p>
                              {order.clinicalHistory && <p className="text-xs mt-1"><span className="text-gray-500">Clinical History:</span> {order.clinicalHistory}</p>}
                              {order.clinicalIndication && <p className="text-xs"><span className="text-gray-500">Indication:</span> {order.clinicalIndication}</p>}
                              {res && (
                                <div className={`mt-2 p-3 rounded ${res.findingCategory === 'critical' ? 'bg-red-50 border border-red-200' : res.findingCategory === 'abnormal' ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'}`}>
                                  {res.findingCategory === 'critical' && <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> CRITICAL FINDING</p>}
                                  <p className="text-xs"><span className="font-semibold">Findings:</span> {res.findings}</p>
                                  <p className="text-xs mt-1"><span className="font-semibold">Impression:</span> {res.impression}</p>
                                  {res.recommendations && <p className="text-xs mt-1"><span className="font-semibold">Recommendations:</span> {res.recommendations}</p>}
                                  <p className="text-[11px] text-gray-400 mt-1">Reported by radiologist on {fmtDT(res.reportedAt)}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Section>
                )}

                {/* ---- Diagnosis ---- */}
                {allDx.length > 0 && (
                  <Section n={sectionNum()} title="Diagnosis">
                    <table className="w-full"><thead><tr className="border-b">
                      <TH>ICD-10 Code</TH><TH>Description</TH><TH>Type</TH>
                    </tr></thead><tbody>
                      {allDx.map((d, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <TD mono>{d.code}</TD>
                          <TD>{d.description}</TD>
                          <td className="py-1.5 px-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              d.type === 'primary' ? 'bg-blue-100 text-blue-800' : d.type === 'secondary' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-800'
                            }`}>{d.type}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody></table>
                  </Section>
                )}

                {/* ---- Treatment ---- */}
                {prescriptions && prescriptions.length > 0 && (
                  <Section n={sectionNum()} title="Treatment / Medications Prescribed">
                    {prescriptions.map((rx: Prescription) => (
                      <div key={rx.id} className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Rx #{rx.prescriptionNumber} — {fmtShort(rx.createdAt)} — Status: <span className="font-medium capitalize">{rx.status}</span></p>
                        <table className="w-full"><thead><tr className="border-b">
                          <TH>Medication</TH><TH>Dose</TH><TH>Frequency</TH><TH>Duration</TH><TH>Qty</TH><TH>Instructions</TH>
                        </tr></thead><tbody>
                          {rx.items.map(item => (
                            <tr key={item.id} className="border-b border-gray-100">
                              <TD bold>{item.drugName}</TD><TD>{item.dose}</TD><TD>{item.frequency}</TD><TD>{item.duration}</TD><TD>{item.quantity}</TD><TD>{item.instructions || '—'}</TD>
                            </tr>
                          ))}
                        </tbody></table>
                        {rx.notes && <p className="text-xs text-gray-500 mt-1 italic">Notes: {rx.notes}</p>}
                      </div>
                    ))}
                  </Section>
                )}

                {/* ---- Doctor's Opinion ---- */}
                <Section n={sectionNum()} title="Doctor's Opinion">
                  <p className="whitespace-pre-wrap">{doctorOpinion || 'No opinion recorded.'}</p>
                </Section>

                {/* ---- Recommendations & Follow-up ---- */}
                <Section n={sectionNum()} title="Recommendations & Follow-up">
                  <p className="whitespace-pre-wrap">{doctorRecommendations || 'No recommendations recorded.'}</p>
                  {clinicalNotes?.filter((n: ClinicalNote) => n.followUpDate).map((n: ClinicalNote) => (
                    <p key={n.id} className="mt-2 font-medium">Next Follow-up: {fmt(n.followUpDate)}{n.followUpNotes ? ` — ${n.followUpNotes}` : ''}</p>
                  ))}
                </Section>

                {/* ---- Signature ---- */}
                <div className="pt-12 mt-8 border-t-2 border-gray-300">
                  <div className="flex justify-between items-end">
                    <div className="text-xs text-gray-500">
                      <p>Date: {fmt(new Date().toISOString())}</p>
                    </div>
                    <div className="text-right">
                      <div className="w-56 border-b-2 border-gray-800 mb-1"></div>
                      <p className="font-bold">{encounter?.doctor?.fullName || user?.fullName || 'Attending Physician'}</p>
                      <p className="text-xs text-gray-500">{encounter?.doctor?.specialization || 'Medical Doctor'}</p>
                      <p className="text-xs text-gray-500">{facilityName}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Reusable sub-components ---- */

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800 border-b border-gray-300 pb-1 mb-2">
        {n}. {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value, capitalize: cap }: { label: string; value?: string | null; capitalize?: boolean }) {
  return (
    <p className="py-0.5">
      <span className="text-gray-500 text-xs">{label}: </span>
      <span className={`font-medium ${cap ? 'capitalize' : ''}`}>{value || '—'}</span>
    </p>
  );
}

function VitalBox({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="border rounded p-2 text-center">
      <p className="text-[10px] text-gray-500 leading-tight">{label}</p>
      <p className="text-base font-bold">{value}</p>
      {unit && <p className="text-[10px] text-gray-400">{unit}</p>}
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return <th className="text-left py-1.5 px-2 text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{children}</th>;
}

function TD({ children, mono, bold, capitalize: cap }: { children: React.ReactNode; mono?: boolean; bold?: boolean; capitalize?: boolean }) {
  return <td className={`py-1.5 px-2 ${mono ? 'font-mono text-xs' : ''} ${bold ? 'font-medium' : ''} ${cap ? 'capitalize' : ''}`}>{children}</td>;
}
