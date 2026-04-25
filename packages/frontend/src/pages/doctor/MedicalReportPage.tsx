import React, { useRef, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Encounter, Prescription, LabResult } from '../../types/clinical';
import {
  Printer,
  FileText,
  Loader2,
  AlertCircle,
  Heart,
  Thermometer,
  Activity,
  Stethoscope,
  Pill,
  FlaskConical,
  ScanLine,
  ClipboardList,
  Search,
} from 'lucide-react';
import { encountersService } from '../../services/encounters';
import { clinicalNotesService } from '../../services/clinical-notes';
import { vitalsService } from '../../services/vitals';
import { ordersService } from '../../services/orders';
import { prescriptionsService } from '../../services/prescriptions';
import { radiologyService } from '../../services/radiology';
import { labService } from '../../services/lab';
import { problemsService } from '../../services/problems';
import { patientsService } from '../../services/patients';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { printContent } from '../../lib/print';

export default function MedicalReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const encounterId = searchParams.get('encounter') || '';
  const reportRef = useRef<HTMLDivElement>(null);
  const inst = useInstitutionInfo();
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [additionalRecommendations, setAdditionalRecommendations] = useState('');

  // --- Data fetching ---
  const { data: encounter, isLoading: loadingEnc } = useQuery<Encounter>({
    queryKey: ['encounter', encounterId],
    queryFn: () => encountersService.getById(encounterId),
    enabled: !!encounterId,
  });

  const { data: clinicalNotes = [] } = useQuery<Array<{ id: string; content: string; createdAt: string }>>({
    queryKey: ['clinical-notes', encounterId],
    queryFn: () => clinicalNotesService.getByEncounter(encounterId),
    enabled: !!encounterId,
  });

  const { data: vitals = [] } = useQuery<Array<{ id: string; temp: number; bp: string }>>({
    queryKey: ['vitals-enc', encounterId],
    queryFn: () => vitalsService.getByEncounter(encounterId),
    enabled: !!encounterId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-enc', encounterId],
    queryFn: () => ordersService.getByEncounter(encounterId),
    enabled: !!encounterId,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['rx-enc', encounterId],
    queryFn: () => prescriptionsService.list({ encounterId }),
    enabled: !!encounterId,
  });

  const { data: problems = [] } = useQuery({
    queryKey: ['problems', encounter?.patientId],
    queryFn: () => problemsService.getByPatient(encounter!.patientId),
    enabled: !!encounter?.patientId,
  });

  // Separate lab and radiology orders
  const labOrders = useMemo(() => orders.filter((o: any) => o.orderType === 'lab'), [orders]);
  const radiologyOrders = useMemo(() => orders.filter((o: any) => o.orderType === 'radiology'), [orders]);

  // Fetch lab samples for each lab order
  const { data: labSamplesMap = {} } = useQuery({
    queryKey: ['lab-samples-for-orders', labOrders.map((o: any) => o.id)],
    queryFn: async () => {
      const result: Record<string, any[]> = {};
      // Fetch all samples, then filter by orderId
      try {
        const resp = await labService.samples.list({});
        const allSamples = resp?.data || resp || [];
        for (const order of labOrders) {
          result[order.id] = (allSamples as any[]).filter((s: any) => s.orderId === order.id);
        }
      } catch {
        // fallback: no samples
      }
      return result;
    },
    enabled: labOrders.length > 0,
  });

  // Fetch lab results for each sample
  const allSampleIds = useMemo(() => {
    const ids: string[] = [];
    Object.values(labSamplesMap).forEach((samples: any) => {
      samples.forEach((s: any) => ids.push(s.id));
    });
    return ids;
  }, [labSamplesMap]);

  const { data: labResultsMap = {} } = useQuery({
    queryKey: ['lab-results-for-samples', allSampleIds],
    queryFn: async () => {
      const result: Record<string, any[]> = {};
      for (const sampleId of allSampleIds) {
        try {
          const results = await labService.results.getForSample(sampleId);
          result[sampleId] = results || [];
        } catch {
          result[sampleId] = [];
        }
      }
      return result;
    },
    enabled: allSampleIds.length > 0,
  });

  // Fetch imaging results for each radiology order
  const { data: imagingResults = {} } = useQuery({
    queryKey: ['imaging-results', radiologyOrders.map((o: any) => o.id)],
    queryFn: async () => {
      const result: Record<string, any> = {};
      for (const order of radiologyOrders) {
        try {
          const res = await radiologyService.results.getForOrder(order.id);
          if (res) result[order.id] = res;
        } catch { /* no result yet */ }
      }
      return result;
    },
    enabled: radiologyOrders.length > 0,
  });

  // Aggregate diagnoses from clinical notes and problems
  const allDiagnoses = useMemo(() => {
    const diags: { code: string; description: string; type: string; source: string }[] = [];
    clinicalNotes.forEach((note: any) => {
      (note.diagnoses || []).forEach((d: any) => {
        diags.push({ ...d, source: 'clinical_note' });
      });
    });
    problems.forEach((p: any) => {
      diags.push({
        code: p.icdCode || '',
        description: p.diagnosis || p.customDiagnosis || '',
        type: p.status === 'active' ? 'primary' : 'secondary',
        source: 'problem_list',
      });
    });
    // Deduplicate by code+description
    const seen = new Set<string>();
    return diags.filter((d) => {
      const key = `${d.code}-${d.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [clinicalNotes, problems]);

  const latestVitals = vitals[0] || null;
  const latestNote = clinicalNotes[0] || null;
  const doctorName = (encounter as any)?.attendingProvider?.fullName || (encounter as any)?.doctor?.fullName || 'N/A';

  // Patient search
  const { data: patientResults } = useQuery({
    queryKey: ['patient-search-report', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length >= 2 && !encounterId && !selectedPatientId,
  });
  const patients = patientResults?.data || [];

  // Encounters for selected patient
  const { data: encounterResults } = useQuery({
    queryKey: ['patient-encounters-report', selectedPatientId],
    queryFn: () => encountersService.list({ patientId: selectedPatientId!, limit: 50 }),
    enabled: !!selectedPatientId && !encounterId,
  });
  const patientEncounters = encounterResults?.data || [];

  const handlePrint = () => {
    if (reportRef.current) {
      printContent(reportRef.current.innerHTML, 'Medical Report');
    }
  };

  if (!encounterId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
          <FileText className="w-5 h-5" />
          Medical Report
        </h1>

        {/* Step 1: Search patient */}
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

        {/* Step 2: Pick encounter */}
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

  const patient = encounter.patient;
  const age = patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Action bar */}
      <div className="flex items-center justify-between mb-4 no-print">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Medical Report
        </h1>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Report
        </button>
      </div>

      {/* Printable report */}
      <div ref={reportRef} className="bg-white rounded-xl shadow-lg border p-8">
        {/* ─── Header ─── */}
        <div className="text-center border-b pb-4 mb-6">
          {inst.logo && (
            <img src={inst.logo} alt="logo" className="mx-auto mb-2" style={{ maxHeight: 120, objectFit: 'contain' }} />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{inst.name || 'Hospital'}</h1>
          {inst.address && <p className="text-sm text-gray-600">{inst.address}</p>}
          {(inst.phone || inst.email) && (
            <p className="text-sm text-gray-600">
              {inst.phone}{inst.phone && inst.email ? ' | ' : ''}{inst.email}
            </p>
          )}
          <h2 className="text-lg font-bold mt-3 text-gray-800 border-t pt-3">COMPREHENSIVE MEDICAL REPORT</h2>
        </div>

        {/* ─── Patient & Visit Info ─── */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="space-y-1">
            <p><span className="font-semibold">Patient:</span> {patient?.fullName || 'N/A'}</p>
            <p><span className="font-semibold">MRN:</span> {patient?.mrn || 'N/A'}</p>
            <p><span className="font-semibold">Gender:</span> {patient?.gender || 'N/A'}</p>
            <p><span className="font-semibold">Age:</span> {age !== null ? `${age} years` : 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <p><span className="font-semibold">Visit No:</span> {encounter.visitNumber}</p>
            <p><span className="font-semibold">Visit Date:</span> {new Date(encounter.visitDate || encounter.createdAt).toLocaleDateString()}</p>
            <p><span className="font-semibold">Visit Type:</span> {(encounter.type || '').toUpperCase()}</p>
            <p><span className="font-semibold">Attending Doctor:</span> Dr. {doctorName}</p>
          </div>
        </div>

        {/* ─── Section: Chief Complaint ─── */}
        {(encounter.chiefComplaint || latestNote?.subjective) && (
          <Section icon={<Stethoscope className="w-4 h-4" />} title="Chief Complaint / Presenting Complaints">
            <p className="text-gray-700 whitespace-pre-wrap">
              {encounter.chiefComplaint || latestNote?.subjective || 'Not recorded'}
            </p>
            {encounter.chiefComplaint && latestNote?.subjective && latestNote.subjective !== encounter.chiefComplaint && (
              <div className="mt-2">
                <p className="font-medium text-gray-700 text-sm">History of Presenting Illness:</p>
                <p className="text-gray-700 whitespace-pre-wrap">{latestNote.subjective}</p>
              </div>
            )}
          </Section>
        )}

        {/* ─── Section: Vitals ─── */}
        {latestVitals && (
          <Section icon={<Heart className="w-4 h-4" />} title="Vital Signs">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {latestVitals.temperature != null && (
                <VitalItem icon={<Thermometer className="w-3 h-3" />} label="Temperature" value={`${latestVitals.temperature} °C`} />
              )}
              {(latestVitals.bloodPressureSystolic != null || (latestVitals as any).bpSystolic != null) && (
                <VitalItem icon={<Activity className="w-3 h-3" />} label="Blood Pressure" value={`${latestVitals.bloodPressureSystolic || (latestVitals as any).bpSystolic}/${latestVitals.bloodPressureDiastolic || (latestVitals as any).bpDiastolic} mmHg`} />
              )}
              {latestVitals.pulse != null && (
                <VitalItem label="Pulse" value={`${latestVitals.pulse} bpm`} />
              )}
              {latestVitals.respiratoryRate != null && (
                <VitalItem label="Respiratory Rate" value={`${latestVitals.respiratoryRate} /min`} />
              )}
              {latestVitals.oxygenSaturation != null && (
                <VitalItem label="SpO₂" value={`${latestVitals.oxygenSaturation}%`} />
              )}
              {latestVitals.weight != null && (
                <VitalItem label="Weight" value={`${latestVitals.weight} kg`} />
              )}
              {latestVitals.height != null && (
                <VitalItem label="Height" value={`${latestVitals.height} cm`} />
              )}
              {latestVitals.bloodGlucose != null && (
                <VitalItem label="Blood Glucose" value={`${latestVitals.bloodGlucose} mg/dL`} />
              )}
              {latestVitals.painScale != null && (
                <VitalItem label="Pain Scale" value={`${latestVitals.painScale}/10`} />
              )}
            </div>
          </Section>
        )}

        {/* ─── Section: Examination Findings ─── */}
        {latestNote?.objective && (
          <Section icon={<Stethoscope className="w-4 h-4" />} title="Examination Findings">
            <p className="text-gray-700 whitespace-pre-wrap">{latestNote.objective}</p>
          </Section>
        )}

        {/* ─── Section: Diagnoses ─── */}
        {allDiagnoses.length > 0 && (
          <Section icon={<ClipboardList className="w-4 h-4" />} title="Diagnoses">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2 border font-semibold">#</th>
                  <th className="text-left p-2 border font-semibold">ICD Code</th>
                  <th className="text-left p-2 border font-semibold">Diagnosis</th>
                  <th className="text-left p-2 border font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {allDiagnoses.map((d, i) => (
                  <tr key={i}>
                    <td className="p-2 border">{i + 1}</td>
                    <td className="p-2 border">{d.code || '—'}</td>
                    <td className="p-2 border">{d.description}</td>
                    <td className="p-2 border capitalize">{d.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* ─── Section: Laboratory Investigations ─── */}
        {labOrders.length > 0 && (
          <Section icon={<FlaskConical className="w-4 h-4" />} title="Laboratory Investigations">
            {labOrders.map((order: any) => {
              const samples = labSamplesMap[order.id] || [];
              const hasResults = samples.some((s: any) => (labResultsMap[s.id] || []).length > 0);
              return (
                <div key={order.id} className="mb-4">
                  <p className="font-medium text-sm text-gray-800 mb-1">
                    {order.orderNumber} — {(order.testCodes || []).map((t: any) => t.name).join(', ') || 'Lab Test'}
                    <span className="ml-2 text-gray-500 font-normal">({order.status})</span>
                  </p>
                  {order.clinicalNotes && (
                    <p className="text-xs text-gray-600 mb-1">Clinical Notes: {order.clinicalNotes}</p>
                  )}
                  {hasResults ? (
                    <table className="w-full text-sm border-collapse mt-1">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left p-2 border font-semibold">Parameter</th>
                          <th className="text-left p-2 border font-semibold">Result</th>
                          <th className="text-left p-2 border font-semibold">Unit</th>
                          <th className="text-left p-2 border font-semibold">Reference Range</th>
                          <th className="text-left p-2 border font-semibold">Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        {samples.flatMap((s: any) =>
                          (labResultsMap[s.id] || []).map((r: any) => (
                            <tr key={r.id} className={r.abnormalFlag && r.abnormalFlag !== 'normal' ? 'bg-red-50' : ''}>
                              <td className="p-2 border">{r.parameter}</td>
                              <td className="p-2 border font-medium">{r.value}</td>
                              <td className="p-2 border">{r.unit || ''}</td>
                              <td className="p-2 border">{r.referenceRange || (r.referenceMin != null ? `${r.referenceMin} - ${r.referenceMax}` : '—')}</td>
                              <td className="p-2 border">
                                {r.abnormalFlag && r.abnormalFlag !== 'normal' ? (
                                  <span className="font-bold text-red-600">{r.abnormalFlag.toUpperCase()}</span>
                                ) : (
                                  <span className="text-green-600">Normal</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Results pending</p>
                  )}
                </div>
              );
            })}
          </Section>
        )}

        {/* ─── Section: Radiology / Imaging ─── */}
        {radiologyOrders.length > 0 && (
          <Section icon={<ScanLine className="w-4 h-4" />} title="Radiology / Imaging Investigations">
            {radiologyOrders.map((order: any) => {
              const result = imagingResults[order.id];
              return (
                <div key={order.id} className="mb-4 pb-3 border-b last:border-b-0">
                  <p className="font-medium text-sm text-gray-800">
                    {order.orderNumber} — {order.studyType || 'Imaging Study'}
                    {order.bodyPart && ` (${order.bodyPart})`}
                    <span className="ml-2 text-gray-500 font-normal">({order.status})</span>
                  </p>
                  {result ? (
                    <div className="mt-1 text-sm space-y-1">
                      <div>
                        <span className="font-medium">Findings: </span>
                        <span className="text-gray-700">{result.findings}</span>
                      </div>
                      <div>
                        <span className="font-medium">Impression: </span>
                        <span className="text-gray-700">{result.impression}</span>
                      </div>
                      {result.recommendations && (
                        <div>
                          <span className="font-medium">Recommendations: </span>
                          <span className="text-gray-700">{result.recommendations}</span>
                        </div>
                      )}
                      {result.findingCategory && result.findingCategory !== 'normal' && (
                        <p className="text-red-600 font-medium text-xs">Category: {result.findingCategory.toUpperCase()}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic mt-1">Report pending</p>
                  )}
                </div>
              );
            })}
          </Section>
        )}

        {/* ─── Section: Prescriptions / Medications ─── */}
        {prescriptions.length > 0 && (
          <Section icon={<Pill className="w-4 h-4" />} title="Medications / Prescriptions">
            {prescriptions.map((rx: any) => (
              <div key={rx.id} className="mb-3">
                <p className="font-medium text-sm text-gray-800 mb-1">
                  Rx #{rx.prescriptionNumber}
                  <span className="ml-2 text-gray-500 font-normal capitalize">({rx.status})</span>
                </p>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left p-2 border font-semibold">#</th>
                      <th className="text-left p-2 border font-semibold">Medication</th>
                      <th className="text-left p-2 border font-semibold">Dose</th>
                      <th className="text-left p-2 border font-semibold">Frequency</th>
                      <th className="text-left p-2 border font-semibold">Duration</th>
                      <th className="text-left p-2 border font-semibold">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rx.items || []).map((item: any, idx: number) => (
                      <tr key={item.id}>
                        <td className="p-2 border">{idx + 1}</td>
                        <td className="p-2 border">{item.drugName}</td>
                        <td className="p-2 border">{item.dose || '—'}</td>
                        <td className="p-2 border">{item.frequency || '—'}</td>
                        <td className="p-2 border">{item.duration || '—'}</td>
                        <td className="p-2 border">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rx.notes && <p className="text-xs text-gray-600 mt-1">Notes: {rx.notes}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* ─── Section: Assessment & Plan / Recommendations ─── */}
        {(latestNote?.assessment || latestNote?.plan) && (
          <Section icon={<ClipboardList className="w-4 h-4" />} title="Doctor's Assessment & Recommendations">
            {latestNote.assessment && (
              <div className="mb-3">
                <p className="font-medium text-sm text-gray-700">Assessment:</p>
                <p className="text-gray-700 whitespace-pre-wrap">{latestNote.assessment}</p>
              </div>
            )}
            {latestNote.plan && (
              <div>
                <p className="font-medium text-sm text-gray-700">Plan / Recommendations:</p>
                <p className="text-gray-700 whitespace-pre-wrap">{latestNote.plan}</p>
              </div>
            )}
            {latestNote.followUpDate && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
                <p className="font-medium">Follow-up: {new Date(latestNote.followUpDate).toLocaleDateString()}</p>
                {latestNote.followUpNotes && <p className="text-gray-600">{latestNote.followUpNotes}</p>}
              </div>
            )}
          </Section>
        )}

        {/* ─── Additional Recommendations (printed) ─── */}
        {additionalRecommendations.trim() && (
          <Section icon={<ClipboardList className="w-4 h-4" />} title={latestNote?.plan ? 'Additional Recommendations' : "Doctor's Recommendations"}>
            <p className="text-gray-700 whitespace-pre-wrap">{additionalRecommendations}</p>
          </Section>
        )}

        {/* ─── Footer / Signature ─── */}
        <div className="mt-10 pt-6 border-t flex justify-between items-end text-sm">
          <div>
            <p className="text-gray-600">Report Date: {new Date().toLocaleDateString()}</p>
            <p className="text-gray-600">Visit No: {encounter.visitNumber}</p>
          </div>
          <div className="text-right">
            <div className="w-48 border-b border-gray-400 mb-2" />
            <p className="font-medium text-gray-900">Dr. {doctorName}</p>
            <p className="text-gray-500 text-xs">Signature & Stamp</p>
          </div>
        </div>
      </div>

      {/* ─── Editable recommendations (NOT printed) ─── */}
      <div className="mt-6 bg-white rounded-xl shadow-lg border p-6 no-print">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          <ClipboardList className="w-4 h-4 inline mr-1" />
          Add Recommendations (will appear on printed report)
        </label>
        <textarea
          value={additionalRecommendations}
          onChange={(e) => setAdditionalRecommendations(e.target.value)}
          rows={4}
          placeholder="Type any additional recommendations, follow-up instructions, or notes for the patient here..."
          className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
    </div>
  );
}

// ─── Reusable section wrapper ────────────────────────────────────────────────

function Section({ icon, title, children }: { icon?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 border-b pb-1 mb-2 uppercase tracking-wide">
        {icon}
        {title}
      </h3>
      <div className="pl-1">{children}</div>
    </div>
  );
}

function VitalItem({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
