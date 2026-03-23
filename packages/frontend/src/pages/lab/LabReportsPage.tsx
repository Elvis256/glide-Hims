import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFacilityId } from '../../lib/facility';
import { labService, type LabSample, type LabResult } from '../../services/lab';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { generateLabReportPdf, printLabReport, type LabReportFormat, type LabReportData } from '../../lib/labReport';
import { usePrintFormat } from '../../lib/usePrintFormat';
import PrintFormatSelector from '../../components/PrintFormatSelector';
import {
  FileText, Search, Printer, Mail, Download, Eye, CheckCircle, Clock,
  User, ChevronDown, ChevronUp, X, Phone, MessageSquare, Send, Share2,
  Copy, AlertCircle, Activity, Beaker, Shield,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface TestResult {
  parameter: string;
  value: number;
  displayValue: string;
  unit: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
  referenceRange: string;
  referenceMin?: number;
  referenceMax?: number;
  date: string;
}

interface PatientTest {
  id: string;
  testName: string;
  testCode: string;
  category: string;
  results: TestResult[];
  doctorReviewed: boolean;
  sampleType: string;
  sampleNumber: string;
  sampleDate: string;
  collectionTime: string;
  doctorName: string;
}

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: string;
  gender: string;
  dob: string;
  email?: string;
  phone?: string;
  tests: PatientTest[];
}

const reportFormats: { value: LabReportFormat; label: string; desc: string }[] = [
  { value: 'standard', label: 'Standard Report', desc: 'Per-test clinical format (ISO 15189)' },
  { value: 'simplified', label: 'Summary Report', desc: 'All tests combined on one page' },
];

type ShareMethod = 'email' | 'whatsapp' | 'sms';

// ─── Helpers ────────────────────────────────────────────────────────

function calcAge(dob: string | undefined): string {
  if (!dob) return '—';
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return '—';
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  if (years < 1) {
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
    return months <= 0 ? '<1 month' : `${months} month${months > 1 ? 's' : ''}`;
  }
  return `${years} yr${years > 1 ? 's' : ''}`;
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function fmtDateTime(d: string | undefined): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function statusBadge(status: 'Normal' | 'Abnormal' | 'Critical') {
  const styles = {
    Normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Abnormal: 'bg-amber-50 text-amber-700 border-amber-200',
    Critical: 'bg-red-50 text-red-700 border-red-200',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>{status}</span>;
}

function categoryIcon(category: string) {
  const cat = category?.toLowerCase() || '';
  if (cat.includes('hematol')) return <Activity className="w-4 h-4 text-red-500" />;
  if (cat.includes('chem') || cat.includes('biochem')) return <Beaker className="w-4 h-4 text-blue-500" />;
  if (cat.includes('micro') || cat.includes('parasit')) return <Shield className="w-4 h-4 text-purple-500" />;
  return <Beaker className="w-4 h-4 text-blue-500" />;
}

// ─── Component ──────────────────────────────────────────────────────

export default function LabReportsPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const { printFormat, setPrintFormat } = usePrintFormat();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTest, setSelectedTest] = useState<PatientTest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<LabReportFormat>('standard');
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  // Modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [shareMethod, setShareMethod] = useState<ShareMethod>('email');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // ─── Data fetching ────────────────────────────────────────────────

  const { data: patientsData, isLoading } = useQuery({
    queryKey: ['lab-report-patients', facilityId],
    queryFn: async (): Promise<Patient[]> => {
      const samplesResp = await labService.samples.list({ facilityId, status: 'completed' });
      const samples: LabSample[] = Array.isArray(samplesResp) ? samplesResp : (samplesResp as any)?.data || [];
      if (samples.length === 0) return [];

      const sampleResults = await Promise.all(
        samples.map(async (s) => {
          try {
            const results = await labService.results.getForSample(s.id);
            return { sample: s, results: Array.isArray(results) ? results : (results as any)?.data || [] };
          } catch {
            return { sample: s, results: [] as LabResult[] };
          }
        })
      );

      const patientMap = new Map<string, Patient>();

      for (const { sample, results } of sampleResults) {
        const pid = sample.patient?.id || sample.patientId;
        const mrn = sample.patient?.mrn || pid;
        const name = sample.patient?.fullName
          || [sample.patient?.firstName, sample.patient?.lastName].filter(Boolean).join(' ')
          || 'Unknown';
        const dob = sample.patient?.dateOfBirth || '';
        const gender = sample.patient?.gender || '';

        if (!patientMap.has(pid)) {
          patientMap.set(pid, {
            id: pid,
            mrn,
            name,
            age: calcAge(dob),
            gender: gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '—',
            dob: fmtDate(dob),
            email: sample.patient?.email,
            phone: sample.patient?.phone,
            tests: [],
          });
        }

        const patient = patientMap.get(pid)!;
        const testName = sample.labTest?.name || 'Unknown Test';
        const testCode = sample.labTest?.code || '';
        const category = sample.labTest?.category || 'General';

        // Skip samples with no results
        if (results.length === 0) continue;

        const resultEntries: TestResult[] = results.map((r: LabResult) => ({
          parameter: r.parameter || testName,
          value: (r.numericValue ?? parseFloat(r.value)) || 0,
          displayValue: r.value || '0',
          unit: r.unit || '',
          status: (r.abnormalFlag === 'critical' || r.abnormalFlag === 'critical_low' || r.abnormalFlag === 'critical_high')
            ? 'Critical' as const
            : (r.abnormalFlag === 'low' || r.abnormalFlag === 'high') ? 'Abnormal' as const : 'Normal' as const,
          referenceRange: r.referenceRange || '',
          referenceMin: r.referenceMin,
          referenceMax: r.referenceMax,
          date: sample.collectionTime || sample.createdAt,
        }));

        const existing = patient.tests.find(t => t.testName === testName && t.sampleNumber === sample.sampleNumber);
        if (existing) {
          existing.results.push(...resultEntries);
        } else {
          patient.tests.push({
            id: sample.id,
            testName,
            testCode,
            category,
            results: resultEntries,
            doctorReviewed: results.some((r: LabResult) => r.status === 'validated' || r.status === 'released'),
            sampleType: (sample as any).sampleType || sample.labTest?.sampleType || '',
            sampleNumber: sample.sampleNumber,
            sampleDate: fmtDate(sample.collectionTime || sample.createdAt),
            collectionTime: fmtDateTime(sample.collectionTime || sample.createdAt),
            doctorName: '',
          });
        }
      }

      return Array.from(patientMap.values());
    },
  });

  const patients = patientsData || [];
  const filteredPatients = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return patients.filter((p) =>
      p.name.toLowerCase().includes(q) || p.mrn.toLowerCase().includes(q)
    );
  }, [patients, searchTerm]);

  if (!hasPermission('lab.read')) return <AccessDenied />;

  // ─── Handlers ─────────────────────────────────────────────────────

  const toggleTest = (testId: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      next.has(testId) ? next.delete(testId) : next.add(testId);
      return next;
    });
  };

  const buildTestReportData = (patient: Patient, test: PatientTest): LabReportData => ({
    format: selectedFormat,
    paperFormat: printFormat,
    institution: inst,
    patientName: patient.name,
    patientMrn: patient.mrn,
    patientAge: patient.age,
    patientGender: patient.gender,
    patientDob: patient.dob,
    patientPhone: patient.phone,
    testName: test.testName,
    testCode: test.testCode,
    testCategory: test.category,
    sampleType: test.sampleType,
    sampleNumber: test.sampleNumber,
    sampleDate: test.sampleDate,
    testDate: test.sampleDate,
    validatedDate: test.sampleDate,
    referringDoctor: test.doctorName,
    parameters: test.results.map((r) => ({
      name: r.parameter,
      value: r.displayValue,
      unit: r.unit,
      normalMin: r.referenceMin,
      normalMax: r.referenceMax,
      referenceRange: r.referenceRange,
    })),
  });

  const buildSummaryReportData = (patient: Patient): LabReportData => ({
    format: 'simplified',
    paperFormat: printFormat,
    institution: inst,
    patientName: patient.name,
    patientMrn: patient.mrn,
    patientAge: patient.age,
    patientGender: patient.gender,
    patientDob: patient.dob,
    patientPhone: patient.phone,
    testName: `Lab Summary — ${patient.tests.length} test(s)`,
    testCode: '',
    testCategory: '',
    sampleType: '',
    sampleNumber: '',
    testDate: new Date().toLocaleDateString(),
    parameters: patient.tests.flatMap((test) =>
      test.results.map((r) => ({
        name: r.parameter,
        value: r.displayValue,
        unit: r.unit,
        normalMin: r.referenceMin,
        normalMax: r.referenceMax,
        referenceRange: r.referenceRange,
      }))
    ),
  });

  const handlePrint = () => {
    if (!selectedPatient) { toast.error('Select a patient first'); return; }
    try {
      if (selectedFormat === 'standard') {
        for (const test of selectedPatient.tests) printLabReport(buildTestReportData(selectedPatient, test));
      } else {
        printLabReport(buildSummaryReportData(selectedPatient));
      }
    } catch (e) { console.error(e); toast.error('Print failed'); }
  };

  const handleDownload = async () => {
    if (!selectedPatient) { toast.error('Select a patient first'); return; }
    setIsGeneratingPdf(true);
    try {
      if (selectedFormat === 'standard') {
        for (const test of selectedPatient.tests) generateLabReportPdf(buildTestReportData(selectedPatient, test));
        toast.success(`Downloaded ${selectedPatient.tests.length} report(s)`);
      } else {
        generateLabReportPdf(buildSummaryReportData(selectedPatient));
        toast.success('Summary PDF downloaded');
      }
    } catch (e) { console.error(e); toast.error('Download failed'); }
    finally { setIsGeneratingPdf(false); }
  };

  const handleOpenShare = (method: ShareMethod) => {
    if (!selectedPatient) { toast.error('Select a patient first'); return; }
    setShareMethod(method);
    setRecipientEmail(selectedPatient.email || '');
    setRecipientPhone(selectedPatient.phone || '');
    setShareMessage(`Lab results for ${selectedPatient.name} are ready.`);
    setShowShareModal(true);
  };

  const handleShare = async () => {
    if (!selectedPatient) return;
    try {
      if (shareMethod === 'email') {
        if (!recipientEmail) { toast.error('Enter an email address'); return; }
        toast.info('Email requires SMTP configuration. Contact admin.');
      } else if (shareMethod === 'whatsapp') {
        if (!recipientPhone) { toast.error('Enter a phone number'); return; }
        const lines = selectedPatient.tests.map(t => {
          const r = t.results[0];
          if (!r) return null;
          const flag = r.status !== 'Normal' ? ` ⚠️ ${r.status}` : ' ✅';
          return `• ${t.testName}: ${r.displayValue} ${r.unit}${flag}`;
        }).filter(Boolean).join('\n');
        const msg = `*Lab Results — ${selectedPatient.name}*\nMRN: ${selectedPatient.mrn}\nDate: ${new Date().toLocaleDateString()}\n\n${lines}\n\n${shareMessage || ''}`;
        window.open(`https://wa.me/${recipientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
        toast.success('Opening WhatsApp...');
      } else if (shareMethod === 'sms') {
        if (!recipientPhone) { toast.error('Enter a phone number'); return; }
        window.location.href = `sms:${recipientPhone}?body=${encodeURIComponent(`Lab results for ${selectedPatient.name} are ready.`)}`;
        toast.success('Opening SMS...');
      }
      setShowShareModal(false);
    } catch { toast.error('Share failed'); }
  };

  // Stats
  const totalTests = patients.reduce((n, p) => n + p.tests.length, 0);
  const pendingReview = patients.reduce((n, p) => n + p.tests.filter(t => !t.doctorReviewed).length, 0);

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-slate-50">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-sm">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lab Reports</h1>
            <p className="text-sm text-slate-500">Generate and manage patient lab reports</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-700">{patients.length}</p>
            <p className="text-xs text-slate-500 font-medium">Patients</p>
          </div>
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-700">{totalTests}</p>
            <p className="text-xs text-slate-500 font-medium">Tests</p>
          </div>
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{pendingReview}</p>
            <p className="text-xs text-slate-500 font-medium">Pending Review</p>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex-1 flex gap-5 min-h-0">

        {/* ── Patient list ── */}
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoading && (
              <div className="p-8 text-center text-slate-400">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading patients...</p>
              </div>
            )}
            {!isLoading && filteredPatients.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No patients found</p>
              </div>
            )}
            {filteredPatients.map((patient) => {
              const isSelected = selectedPatient?.id === patient.id;
              const abnormalCount = patient.tests.reduce(
                (n, t) => n + t.results.filter(r => r.status !== 'Normal').length, 0
              );
              return (
                <div
                  key={patient.id}
                  onClick={() => { setSelectedPatient(patient); setSelectedTest(null); setExpandedTests(new Set()); }}
                  className={`px-4 py-3 cursor-pointer border-b border-slate-50 transition-all
                    ${isSelected ? 'bg-blue-50 border-l-3 border-l-blue-600' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                      ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {patient.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{patient.name}</p>
                      <p className="text-xs text-slate-500">{patient.mrn}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400">{patient.age} • {patient.gender}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                          {patient.tests.length} test{patient.tests.length !== 1 ? 's' : ''}
                        </span>
                        {abnormalCount > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                            {abnormalCount} abnormal
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main content area ── */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
          {selectedPatient ? (
            <>
              {/* Patient banner */}
              <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold">
                      {selectedPatient.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{selectedPatient.name}</h2>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span>{selectedPatient.mrn}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{selectedPatient.age}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span>{selectedPatient.gender}</span>
                        {selectedPatient.dob !== '—' && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span>DOB: {selectedPatient.dob}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Format selector */}
                  <div className="flex items-center gap-2">
                    {reportFormats.map(f => (
                      <button
                        key={f.value}
                        onClick={() => setSelectedFormat(f.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                          ${selectedFormat === f.value
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Test panels */}
              <div className="flex-1 overflow-auto px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    Test Results ({selectedPatient.tests.length})
                  </h3>
                  {selectedPatient.tests.length > 1 && (
                    <button
                      onClick={() => {
                        const allIds = new Set(selectedPatient.tests.map(t => t.id));
                        setExpandedTests(expandedTests.size === allIds.size ? new Set() : allIds);
                      }}
                      className="text-xs text-blue-700 hover:text-blue-800 font-medium"
                    >
                      {expandedTests.size === selectedPatient.tests.length ? 'Collapse All' : 'Expand All'}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {selectedPatient.tests.map((test) => {
                    const isExpanded = expandedTests.has(test.id);
                    const abnormals = test.results.filter(r => r.status !== 'Normal');
                    const normalCount = test.results.length - abnormals.length;
                    return (
                      <div key={test.id} className="border border-slate-200 rounded-xl overflow-hidden transition-shadow hover:shadow-sm">
                        {/* Test header */}
                        <div
                          onClick={() => { toggleTest(test.id); setSelectedTest(test); }}
                          className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors
                            ${isExpanded ? 'bg-blue-50 border-b border-blue-100' : 'bg-slate-50 hover:bg-slate-100'}`}
                        >
                          <div className="flex items-center gap-3">
                            {categoryIcon(test.category)}
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-slate-900 text-sm">{test.testName}</p>
                                {test.testCode && (
                                  <span className="text-xs text-slate-400 font-mono">{test.testCode}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span>{test.category}</span>
                                <span>•</span>
                                <span>Sample: {test.sampleNumber}</span>
                                <span>•</span>
                                <span>{test.sampleDate}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              {normalCount > 0 && (
                                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  {normalCount} normal
                                </span>
                              )}
                              {abnormals.length > 0 && (
                                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                  {abnormals.length} abnormal
                                </span>
                              )}
                            </div>
                            {test.doctorReviewed ? (
                              <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
                            ) : (
                              <Clock className="w-4.5 h-4.5 text-amber-500" />
                            )}
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-slate-400" />
                              : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>

                        {/* Test results table */}
                        {isExpanded && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-200">
                                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-[30%]">Parameter</th>
                                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-[18%]">Result</th>
                                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-[12%]">Unit</th>
                                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-[22%]">Reference Range</th>
                                  <th className="px-4 py-2.5 text-left font-semibold text-slate-600 w-[18%]">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {test.results.map((r, idx) => (
                                  <tr
                                    key={idx}
                                    className={
                                      r.status === 'Critical' ? 'bg-red-50/60' :
                                      r.status === 'Abnormal' ? 'bg-amber-50/40' :
                                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                                    }
                                  >
                                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.parameter}</td>
                                    <td className={`px-4 py-2.5 font-semibold ${
                                      r.status === 'Critical' ? 'text-red-700' :
                                      r.status === 'Abnormal' ? 'text-amber-700' :
                                      'text-slate-900'
                                    }`}>
                                      {r.displayValue}
                                    </td>
                                    <td className="px-4 py-2.5 text-slate-500">{r.unit}</td>
                                    <td className="px-4 py-2.5 text-slate-500">{r.referenceRange}</td>
                                    <td className="px-4 py-2.5">{statusBadge(r.status)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Action bar ── */}
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    {reportFormats.find(f => f.value === selectedFormat)?.desc}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Paper:</span>
                    <PrintFormatSelector value={printFormat} onChange={setPrintFormat} className="!text-xs !py-1" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    className="px-3 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-white flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-white flex items-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <div className="flex border border-slate-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => handleOpenShare('email')}
                      className="px-2.5 py-2 text-sm text-slate-600 hover:bg-white transition-colors" title="Email"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenShare('whatsapp')}
                      className="px-2.5 py-2 text-sm text-green-600 hover:bg-white transition-colors border-l border-slate-200" title="WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleOpenShare('sms')}
                      className="px-2.5 py-2 text-sm text-blue-600 hover:bg-white transition-colors border-l border-slate-200" title="SMS"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={isGeneratingPdf}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Select a patient to view reports</p>
                <p className="text-xs text-slate-400 mt-1">{patients.length} patient{patients.length !== 1 ? 's' : ''} with completed tests</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Share Modal ── */}
      {showShareModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${shareMethod === 'whatsapp' ? 'bg-green-100' : shareMethod === 'sms' ? 'bg-blue-100' : 'bg-blue-100'}`}>
                  {shareMethod === 'whatsapp' ? <MessageSquare className="w-4 h-4 text-green-700" /> :
                   shareMethod === 'sms' ? <Phone className="w-4 h-4 text-blue-700" /> :
                   <Mail className="w-4 h-4 text-blue-700" />}
                </div>
                <h3 className="font-semibold text-slate-900">
                  Share via {shareMethod === 'email' ? 'Email' : shareMethod === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </h3>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 space-y-1">
                <p><span className="font-medium">Patient:</span> {selectedPatient.name}</p>
                <p><span className="font-medium">MRN:</span> {selectedPatient.mrn}</p>
                <p><span className="font-medium">Tests:</span> {selectedPatient.tests.map(t => t.testName).join(', ')}</p>
              </div>

              {shareMethod === 'email' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Recipient Email</label>
                  <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="patient@email.com"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <input type="tel" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+256700000000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message (optional)</label>
                <textarea value={shareMessage} onChange={(e) => setShareMessage(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  {shareMethod === 'email'
                    ? 'A secure link will be sent. Requires SMTP configuration.'
                    : 'Opens messaging app with summary. Full results require patient portal.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleShare}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview Modal ── */}
      {showPreviewModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Eye className="w-4 h-4 text-blue-700" />
                </div>
                <h3 className="font-semibold text-slate-900">Report Preview</h3>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {/* Simulated report page */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white max-w-[600px] mx-auto">
                {/* Facility header */}
                <div className="bg-gradient-to-b from-blue-700 to-blue-800 text-white p-5 text-center">
                  {inst.logo && (
                    <img src={inst.logo} alt="Logo" className="w-14 h-14 mx-auto mb-2 rounded-lg bg-white/10 p-1" />
                  )}
                  <h2 className="text-lg font-bold tracking-wide">{inst.name || 'Hospital'}</h2>
                  <p className="text-blue-200 text-xs mt-1">
                    {[inst.address, inst.phone, inst.email].filter(Boolean).join('  •  ')}
                  </p>
                  <div className="mt-2 inline-block px-3 py-0.5 bg-white/15 rounded text-xs font-medium">
                    LABORATORY REPORT
                  </div>
                </div>

                {/* Patient info grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 p-4 bg-slate-50 text-sm border-b border-slate-200">
                  <div><span className="text-slate-500">Patient:</span> <span className="font-medium">{selectedPatient.name}</span></div>
                  <div><span className="text-slate-500">MRN:</span> <span className="font-medium">{selectedPatient.mrn}</span></div>
                  <div><span className="text-slate-500">Age/Gender:</span> <span className="font-medium">{selectedPatient.age} / {selectedPatient.gender}</span></div>
                  <div><span className="text-slate-500">Date:</span> <span className="font-medium">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                  {selectedPatient.dob !== '—' && (
                    <div><span className="text-slate-500">DOB:</span> <span className="font-medium">{selectedPatient.dob}</span></div>
                  )}
                  {selectedPatient.phone && (
                    <div><span className="text-slate-500">Phone:</span> <span className="font-medium">{selectedPatient.phone}</span></div>
                  )}
                </div>

                {/* Test sections */}
                {selectedPatient.tests.map((test) => (
                  <div key={test.id}>
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                      {categoryIcon(test.category)}
                      <span className="font-semibold text-blue-800 text-sm">{test.testName}</span>
                      {test.testCode && <span className="text-xs text-blue-600">({test.testCode})</span>}
                      <span className="text-xs text-blue-500 ml-auto">{test.category} • {test.sampleDate}</span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Parameter</th>
                          <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Result</th>
                          <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Unit</th>
                          <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Reference</th>
                          <th className="px-3 py-1.5 text-left font-semibold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {test.results.map((r, idx) => (
                          <tr key={idx} className={r.status === 'Critical' ? 'bg-red-50' : r.status === 'Abnormal' ? 'bg-amber-50/50' : ''}>
                            <td className="px-3 py-1.5 font-medium text-slate-800">{r.parameter}</td>
                            <td className={`px-3 py-1.5 font-bold ${
                              r.status === 'Critical' ? 'text-red-700' :
                              r.status === 'Abnormal' ? 'text-amber-700' : 'text-slate-900'
                            }`}>{r.displayValue}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.unit}</td>
                            <td className="px-3 py-1.5 text-slate-500">{r.referenceRange}</td>
                            <td className="px-3 py-1.5">
                              {r.status !== 'Normal' && (
                                <span className={`text-xs font-medium ${r.status === 'Critical' ? 'text-red-600' : 'text-amber-600'}`}>
                                  {r.status}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {/* Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-center space-y-1">
                  <p className="text-[10px] text-slate-400">
                    * = Low  |  # = High  |  ** = Critical Low  |  ## = Critical High
                  </p>
                  <p className="text-[10px] text-slate-400">
                    This report is confidential and intended for clinical use only.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Generated by {inst.name || 'Hospital'} Laboratory Information System
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
              <button
                onClick={async () => {
                  try {
                    const content = selectedPatient.tests.map(t =>
                      `${t.testName} (${t.testCode})\n${t.results.map(r =>
                        `  ${r.parameter}: ${r.displayValue} ${r.unit} [${r.referenceRange}] ${r.status}`
                      ).join('\n')}`
                    ).join('\n\n');
                    await navigator.clipboard.writeText(`Lab Report — ${selectedPatient.name} (${selectedPatient.mrn})\n\n${content}`);
                    toast.success('Copied to clipboard');
                  } catch { toast.error('Copy failed'); }
                }}
                className="px-4 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button
                onClick={() => { setShowPreviewModal(false); handlePrint(); }}
                className="px-4 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => { setShowPreviewModal(false); handleDownload(); }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
