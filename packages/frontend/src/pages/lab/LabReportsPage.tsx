import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFacilityId } from '../../lib/facility';
import { labService, type LabSample, type LabResult } from '../../services/lab';
import { useInstitutionInfo } from '../../lib/useInstitutionInfo';
import { generateLabReportPdf, printLabReport, type LabReportFormat, type LabReportData } from '../../lib/labReport';
import {
  FileText,
  Search,
  Printer,
  Mail,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  CheckCircle,
  Clock,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  BarChart3,
  X,
  Phone,
  MessageSquare,
  Send,
  Share2,
  Copy,
  ExternalLink,
  FileCheck,
  AlertCircle,
} from 'lucide-react';

interface TestResult {
  date: string;
  value: number;
  unit: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
  parameter?: string;
  referenceRange?: string;
  referenceMin?: number;
  referenceMax?: number;
}

interface PatientTest {
  id: string;
  testName: string;
  testCode: string;
  category: string;
  results: TestResult[];
  referenceRange: string;
  doctorReviewed: boolean;
  lastReportDate: string;
  sampleType: string;
  sampleNumber: string;
  sampleDate: string;
  doctorName: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  email?: string;
  phone?: string;
  dob?: string;
  tests: PatientTest[];
}

const reportFormats: { value: LabReportFormat; label: string }[] = [
  { value: 'standard', label: 'Standard Report (per test)' },
  { value: 'simplified', label: 'Summary Report (all tests)' },
];

// Share method types
type ShareMethod = 'email' | 'whatsapp' | 'sms' | 'copy';

export default function LabReportsPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const inst = useInstitutionInfo();
  const queryClient = useQueryClient();
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTest, setSelectedTest] = useState<PatientTest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<LabReportFormat>('standard');
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [showTrendChart, setShowTrendChart] = useState(false);
  
  // Modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [shareMethod, setShareMethod] = useState<ShareMethod>('email');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Fetch patients with completed lab samples and their results
  const { data: patientsData, isLoading: loadingPatients } = useQuery({
    queryKey: ['lab-report-patients', facilityId],
    queryFn: async (): Promise<Patient[]> => {
      // Get completed samples
      const samplesResp = await labService.samples.list({ facilityId, status: 'completed' });
      const samples: LabSample[] = Array.isArray(samplesResp) ? samplesResp : (samplesResp as any)?.data || [];
      
      if (samples.length === 0) return [];

      // Fetch results for each sample in parallel
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

      // Group by patient
      const patientMap = new Map<string, Patient>();

      for (const { sample, results } of sampleResults) {
        const patientId = sample.patient?.id || sample.patientId;
        const patientMrn = sample.patient?.mrn || patientId;
        const patientName = sample.patient?.fullName || 
          [sample.patient?.firstName, sample.patient?.lastName].filter(Boolean).join(' ') || 'Unknown';

        if (!patientMap.has(patientId)) {
          patientMap.set(patientId, {
            id: patientMrn,
            name: patientName,
            age: 0,
            gender: 'Unknown',
            tests: [],
          });
        }

        const patient = patientMap.get(patientId)!;
        const testName = sample.labTest?.name || 'Unknown Test';
        const testCode = sample.labTest?.code || '';
        const category = sample.labTest?.category || 'General';

        // Build result entries from lab_results
        const resultEntries: TestResult[] = results.map((r: LabResult) => ({
          date: sample.collectionTime || sample.createdAt,
          value: (r.numericValue ?? parseFloat(r.value)) || 0,
          unit: r.unit || '',
          status: (r.abnormalFlag === 'critical' || r.abnormalFlag === 'critical_low' || r.abnormalFlag === 'critical_high')
            ? 'Critical' as const
            : (r.abnormalFlag === 'low' || r.abnormalFlag === 'high') ? 'Abnormal' as const : 'Normal' as const,
          parameter: r.parameter,
          referenceRange: r.referenceRange || '',
          referenceMin: r.referenceMin,
          referenceMax: r.referenceMax,
        }));

        // Check if this test already exists for this patient (e.g. re-run)
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
            referenceRange: results[0]?.referenceRange || '',
            doctorReviewed: results.some((r: LabResult) => r.status === 'validated' || r.status === 'released'),
            lastReportDate: new Date(sample.createdAt).toLocaleDateString(),
            sampleType: (sample as any).sampleType || sample.labTest?.sampleType || '',
            sampleNumber: sample.sampleNumber,
            sampleDate: sample.collectionTime
              ? new Date(sample.collectionTime).toLocaleDateString()
              : new Date(sample.createdAt).toLocaleDateString(),
            doctorName: '',
          });
        }
      }

      return Array.from(patientMap.values());
    },
  });

  const patients = patientsData || [];
  const filteredPatients = useMemo(() => {
    return patients.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [patients, searchTerm]);

  if (!hasPermission('lab.read')) {
    return <AccessDenied />;
  }

  const toggleTestExpand = (testId: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const getTrend = (results: TestResult[]): 'up' | 'down' | 'stable' => {
    if (results.length < 2) return 'stable';
    const latest = results[0].value;
    const previous = results[1].value;
    if (latest > previous * 1.05) return 'up';
    if (latest < previous * 0.95) return 'down';
    return 'stable';
  };

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-green-500" />;
      default: return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const statusColors = {
    Normal: 'bg-green-100 text-green-700',
    Abnormal: 'bg-orange-100 text-orange-700',
    Critical: 'bg-red-100 text-red-700',
  };

  // Calculate stats
  const patientCount = patients.length;
  const pendingReviewCount = patients.reduce(
    (count, p) => count + p.tests.filter(t => !t.doctorReviewed).length, 
    0
  );

  // Generate report content
  const generateReportContent = (): string => {
    if (!selectedPatient) return '';
    
    let content = `LAB REPORT\n${'='.repeat(50)}\n\n`;
    content += `Patient: ${selectedPatient.name}\n`;
    content += `MRN: ${selectedPatient.id}\n`;
    content += `Age/Gender: ${selectedPatient.age} years / ${selectedPatient.gender}\n`;
    content += `Report Date: ${new Date().toLocaleDateString()}\n`;
    content += `Format: ${reportFormats.find(f => f.value === selectedFormat)?.label}\n\n`;
    content += `${'='.repeat(50)}\nTEST RESULTS\n${'='.repeat(50)}\n\n`;
    
    for (const test of selectedPatient.tests) {
      content += `${test.testName} (${test.category})\n`;
      content += `Reference: ${test.referenceRange}\n`;
      content += `-`.repeat(40) + '\n';
      
      for (const result of test.results) {
        content += `  ${result.date}: ${result.value} ${result.unit} - ${result.status}\n`;
      }
      content += '\n';
    }
    
    content += `${'='.repeat(50)}\n`;
    content += `Generated by HIMS Lab System\n`;
    
    return content;
  };

  // Build LabReportData for a single test
  const buildTestReportData = (patient: Patient, test: PatientTest): LabReportData => {
    const params = test.results.map((r) => ({
      name: r.parameter || test.testName,
      value: r.value === 0 && r.parameter ? String(r.value) : String(r.value),
      unit: r.unit,
      normalMin: r.referenceMin,
      normalMax: r.referenceMax,
      referenceRange: r.referenceRange || test.referenceRange,
    }));
    return {
      format: selectedFormat,
      institution: inst,
      patientName: patient.name,
      patientMrn: patient.id,
      patientAge: patient.age ? `${patient.age} years` : undefined,
      patientGender: patient.gender,
      patientDob: patient.dob,
      patientPhone: patient.phone,
      testName: test.testName,
      testCode: test.testCode,
      testCategory: test.category,
      sampleType: test.sampleType,
      sampleNumber: test.sampleNumber,
      sampleDate: test.sampleDate,
      testDate: test.lastReportDate,
      validatedDate: test.lastReportDate,
      referringDoctor: test.doctorName,
      parameters: params,
    };
  };

  // Build LabReportData for combined summary
  const buildSummaryReportData = (patient: Patient): LabReportData => {
    const allParams = patient.tests.flatMap((test) =>
      test.results.map((r) => ({
        name: r.parameter || test.testName,
        value: String(r.value),
        unit: r.unit,
        normalMin: r.referenceMin,
        normalMax: r.referenceMax,
        referenceRange: r.referenceRange || test.referenceRange,
      }))
    );
    return {
      format: 'simplified',
      institution: inst,
      patientName: patient.name,
      patientMrn: patient.id,
      patientAge: patient.age ? `${patient.age} years` : undefined,
      patientGender: patient.gender,
      patientDob: patient.dob,
      patientPhone: patient.phone,
      testName: `Lab Summary — ${patient.tests.length} test(s)`,
      testCode: '',
      testCategory: '',
      sampleType: '',
      sampleNumber: '',
      testDate: new Date().toLocaleDateString(),
      parameters: allParams,
    };
  };

  // Handle print — generates proper PDF and opens print dialog
  const handlePrint = () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    try {
      if (selectedFormat === 'standard') {
        for (const test of selectedPatient.tests) {
          printLabReport(buildTestReportData(selectedPatient, test));
        }
      } else {
        printLabReport(buildSummaryReportData(selectedPatient));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate print report');
    }
  };

  // Handle PDF download
  const handleDownload = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      if (selectedFormat === 'standard') {
        for (const test of selectedPatient.tests) {
          generateLabReportPdf(buildTestReportData(selectedPatient, test));
        }
        toast.success(`Downloaded ${selectedPatient.tests.length} standard report(s)`);
      } else {
        generateLabReportPdf(buildSummaryReportData(selectedPatient));
        toast.success('PDF report downloaded successfully');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate PDF report');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Open share modal
  const handleOpenShare = (method: ShareMethod) => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    setShareMethod(method);
    setRecipientEmail(selectedPatient.email || '');
    setRecipientPhone(selectedPatient.phone || '');
    setShareMessage(`Lab results for ${selectedPatient.name} are ready.`);
    setShowShareModal(true);
  };

  // Handle share submission
  const handleShare = async () => {
    if (!selectedPatient) return;
    
    try {
      switch (shareMethod) {
        case 'email':
          if (!recipientEmail) {
            toast.error('Please enter an email address');
            return;
          }
          toast.info('Email feature requires SMTP configuration. Contact your administrator to enable email delivery.');
          break;
          
        case 'whatsapp':
          if (!recipientPhone) {
            toast.error('Please enter a phone number');
            return;
          }
          // Build formatted message with key results
          const resultLines = selectedPatient.tests.map(t => {
            const latest = t.results[0];
            if (!latest) return null;
            const flag = latest.status !== 'Normal' ? ` ⚠️ ${latest.status}` : ' ✅';
            return `• ${t.testName}: ${latest.value} ${latest.unit}${flag}`;
          }).filter(Boolean).join('\n');
          const whatsappMsg = `*Lab Results — ${selectedPatient.name}*\nMRN: ${selectedPatient.id}\nDate: ${new Date().toLocaleDateString()}\n\n${resultLines}\n\n${shareMessage ? shareMessage + '\n' : ''}Report generated by ${inst.name || 'Hospital'}`;
          const whatsappUrl = `https://wa.me/${recipientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`;
          window.open(whatsappUrl, '_blank');
          toast.success('Opening WhatsApp...');
          break;
          
        case 'sms':
          if (!recipientPhone) {
            toast.error('Please enter a phone number');
            return;
          }
          // Open SMS app
          const smsUrl = `sms:${recipientPhone}?body=${encodeURIComponent(
            `Lab results for ${selectedPatient.name} are ready. Please visit the facility or log in to view.`
          )}`;
          window.location.href = smsUrl;
          toast.success('Opening SMS app...');
          break;
          
        case 'copy':
          const content = generateReportContent();
          await navigator.clipboard.writeText(content);
          toast.success('Report copied to clipboard');
          break;
      }
      
      setShowShareModal(false);
    } catch (error) {
      toast.error('Failed to share report');
    }
  };

  // Handle preview
  const handlePreview = () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }
    setShowPreviewModal(true);
  };

  const maxChartValue = selectedTest ? Math.max(...selectedTest.results.map(r => r.value)) * 1.2 : 0;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50" id="lab-reports-content">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <FileText className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Reports</h1>
            <p className="text-sm text-gray-500">Generate and view patient test reports</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-teal-50 border border-teal-200 rounded-lg text-center">
            <p className="text-xl font-bold text-teal-700">{patientCount}</p>
            <p className="text-xs text-teal-600">Patients</p>
          </div>
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-xl font-bold text-amber-600">{pendingReviewCount}</p>
            <p className="text-xs text-amber-500">Pending Review</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="w-72 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-100">
            {filteredPatients.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No patients found</p>
              </div>
            )}
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => { setSelectedPatient(patient); setSelectedTest(null); }}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedPatient?.id === patient.id ? 'bg-teal-50 border-l-4 border-teal-600' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{patient.name}</p>
                    <p className="text-sm text-gray-500">{patient.id} • {patient.age}y {patient.gender}</p>
                    <p className="text-xs text-gray-400">{patient.tests.length} tests on file</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {selectedPatient ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedPatient.id} • {selectedPatient.age} years • {selectedPatient.gender}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={selectedFormat}
                      onChange={(e) => setSelectedFormat(e.target.value as LabReportFormat)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                    >
                      {reportFormats.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Test History</h3>
                <div className="space-y-3">
                  {selectedPatient.tests.map((test) => (
                    <div key={test.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div
                        onClick={() => { toggleTestExpand(test.id); setSelectedTest(test); }}
                        className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-gray-900">{test.testName}</p>
                            <p className="text-sm text-gray-500">{test.category} • Ref: {test.referenceRange}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {test.results[0]?.value} {test.results[0]?.unit}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${statusColors[test.results[0]?.status || 'Normal']}`}>
                                {test.results[0]?.status}
                              </span>
                              <TrendIcon trend={getTrend(test.results)} />
                            </div>
                          </div>
                          {test.doctorReviewed ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-500" />
                          )}
                          {expandedTests.has(test.id) ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      {expandedTests.has(test.id) && (
                        <div className="p-4 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-gray-700">Previous Results</p>
                            <button
                              onClick={() => setShowTrendChart(!showTrendChart)}
                              className="text-sm text-teal-700 hover:text-teal-800 flex items-center gap-1"
                            >
                              <BarChart3 className="w-4 h-4" />
                              {showTrendChart ? 'Hide Chart' : 'Show Trend'}
                            </button>
                          </div>

                          {showTrendChart && selectedTest?.id === test.id && (
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                              <div className="h-32 flex items-end gap-2">
                                {[...test.results].reverse().map((result, idx) => (
                                  <div key={idx} className="flex-1 flex flex-col items-center">
                                    <div
                                      className={`w-full rounded-t ${
                                        result.status === 'Normal' ? 'bg-green-400' :
                                        result.status === 'Abnormal' ? 'bg-orange-400' : 'bg-red-400'
                                      }`}
                                      style={{ height: `${(result.value / maxChartValue) * 100}%` }}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{result.date.slice(5)}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <table className="w-full text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Value</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-600">Change</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {test.results.map((result, idx) => (
                                <tr key={idx}>
                                  <td className="px-3 py-2 flex items-center gap-1">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {result.date}
                                  </td>
                                  <td className="px-3 py-2">{result.value} {result.unit}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs ${statusColors[result.status]}`}>
                                      {result.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    {idx < test.results.length - 1 && (
                                      <span className={`text-xs ${
                                        result.value > test.results[idx + 1].value ? 'text-red-500' : 'text-green-500'
                                      }`}>
                                        {result.value > test.results[idx + 1].value ? '↑' : '↓'}
                                        {Math.abs(((result.value - test.results[idx + 1].value) / test.results[idx + 1].value) * 100).toFixed(1)}%
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Eye className="w-4 h-4" />
                    Format: {reportFormats.find(f => f.value === selectedFormat)?.label}
                  </div>
                  <button
                    onClick={handlePreview}
                    className="text-sm text-teal-700 hover:text-teal-800 flex items-center gap-1"
                  >
                    <FileCheck className="w-4 h-4" />
                    Preview
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrint}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                    title="Print Report"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={() => handleOpenShare('email')}
                    className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                    title="Send via Email"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <button
                    onClick={() => handleOpenShare('whatsapp')}
                    className="px-3 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 flex items-center gap-2"
                    title="Share via WhatsApp"
                  >
                    <MessageSquare className="w-4 h-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => handleOpenShare('sms')}
                    className="px-3 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 flex items-center gap-2"
                    title="Send SMS Notification"
                  >
                    <Phone className="w-4 h-4" />
                    SMS
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={isGeneratingPdf}
                    className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {isGeneratingPdf ? 'Generating...' : 'Download'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2" />
                <p>Select a patient to view reports</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-teal-700" />
                <h3 className="font-semibold text-gray-900">
                  Share Report via {shareMethod === 'email' ? 'Email' : shareMethod === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </h3>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Patient:</span> {selectedPatient.name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">MRN:</span> {selectedPatient.id}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Tests:</span> {selectedPatient.tests.length} test(s)
                </p>
              </div>
              
              {shareMethod === 'email' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="patient@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+256700000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message (optional)
                </label>
                <textarea
                  value={shareMessage}
                  onChange={(e) => setShareMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  {shareMethod === 'email' 
                    ? 'A secure link to view the report will be sent to this email address.'
                    : shareMethod === 'whatsapp'
                    ? 'This will open WhatsApp with a notification message. Full results require patient portal access.'
                    : 'An SMS notification will be sent. Full results require patient portal access.'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-700" />
                <h3 className="font-semibold text-gray-900">Report Preview</h3>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {/* Structured preview */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-teal-700 text-white p-4 text-center">
                  {inst.logo && (
                    <img src={inst.logo} alt="Logo" className="w-12 h-12 mx-auto mb-2 rounded" />
                  )}
                  <h2 className="text-lg font-bold">{inst.name || 'Hospital'}</h2>
                  <p className="text-xs text-teal-200">
                    {[inst.address, inst.phone, inst.email].filter(Boolean).join(' | ')}
                  </p>
                  <p className="text-sm mt-1 font-medium">Laboratory Report</p>
                </div>
                <div className="p-4 bg-gray-50 grid grid-cols-2 gap-x-6 gap-y-1 text-sm border-b">
                  <div><span className="font-medium text-gray-600">Patient:</span> {selectedPatient.name}</div>
                  <div><span className="font-medium text-gray-600">MRN:</span> {selectedPatient.id}</div>
                  <div><span className="font-medium text-gray-600">Gender:</span> {selectedPatient.gender}</div>
                  <div><span className="font-medium text-gray-600">Date:</span> {new Date().toLocaleDateString()}</div>
                  {selectedPatient.phone && (
                    <div><span className="font-medium text-gray-600">Phone:</span> {selectedPatient.phone}</div>
                  )}
                </div>
                {selectedPatient.tests.map((test) => (
                  <div key={test.id} className="border-b last:border-b-0">
                    <div className="px-4 py-2 bg-teal-50 font-medium text-teal-800 text-sm">
                      {test.testName} {test.testCode ? `(${test.testCode})` : ''} — {test.category}
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium text-gray-600">Parameter</th>
                          <th className="px-3 py-1.5 text-left font-medium text-gray-600">Result</th>
                          <th className="px-3 py-1.5 text-left font-medium text-gray-600">Unit</th>
                          <th className="px-3 py-1.5 text-left font-medium text-gray-600">Reference</th>
                          <th className="px-3 py-1.5 text-left font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {test.results.map((r, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5">{r.parameter || test.testName}</td>
                            <td className={`px-3 py-1.5 font-medium ${r.status === 'Critical' ? 'text-red-600' : r.status === 'Abnormal' ? 'text-orange-600' : ''}`}>
                              {r.value} 
                            </td>
                            <td className="px-3 py-1.5 text-gray-500">{r.unit}</td>
                            <td className="px-3 py-1.5 text-gray-500">{r.referenceRange || test.referenceRange}</td>
                            <td className="px-3 py-1.5">
                              {r.status !== 'Normal' && (
                                <span className={`px-1.5 py-0.5 rounded text-xs ${statusColors[r.status]}`}>{r.status}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
                <div className="p-3 text-center text-xs text-gray-400 border-t">
                  Generated by {inst.name || 'Hospital'} Lab System
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => handleOpenShare('copy')}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
              <button
                onClick={() => { setShowPreviewModal(false); handlePrint(); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => { setShowPreviewModal(false); handleDownload(); }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}