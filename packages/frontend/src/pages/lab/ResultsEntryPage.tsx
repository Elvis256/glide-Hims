import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Send,
  MessageSquare,
  Search,
  ShieldCheck,
  Flag,
  AlertCircle,
  ThumbsUp,
  Clock,
  Loader2,
  XCircle,
  X,
  Info,
} from 'lucide-react';
import { labService, type LabSample, type LabResult } from '../../services';
import type { EnterResultDto } from '../../services/lab';
import { useFacilityId } from '../../lib/facility';
import { useAuthStore } from '../../store/auth';

interface TestResult {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
}

interface PendingSample {
  id: string;
  sampleNumber: string;
  patientName: string;
  patientId: string;
  patientMrn?: string;
  testName: string;
  testCode?: string;
  testCategory?: string;
  testId?: string;
  sampleType?: string;
  collectedAt: string;
  collectedAtRaw?: string;
  priority?: 'routine' | 'urgent' | 'stat';
  parameters: { name: string; unit: string; referenceRange: string; criticalLow?: number; criticalHigh?: number }[];
  results: TestResult[];
  status: string;
  verified: boolean;
  approved: boolean;
  comments: string;
  referringDoctor?: string;
  usingFallbackParameters?: boolean;
}

const defaultParameters = [
  // Hematology
  { name: 'WBC', unit: 'x10^9/L', referenceRange: '4.5-11.0', criticalLow: 2.0, criticalHigh: 30.0 },
  { name: 'RBC', unit: 'x10^12/L', referenceRange: '4.5-5.5', criticalLow: 2.0, criticalHigh: 7.0 },
  { name: 'Hemoglobin', unit: 'g/dL', referenceRange: '13.5-17.5', criticalLow: 7.0, criticalHigh: 20.0 },
  { name: 'Hematocrit', unit: '%', referenceRange: '38-50' },
  { name: 'Platelets', unit: 'x10^9/L', referenceRange: '150-400', criticalLow: 50, criticalHigh: 1000 },
  { name: 'MCV', unit: 'fL', referenceRange: '80-100' },
  { name: 'MCH', unit: 'pg', referenceRange: '27-33' },
  { name: 'MCHC', unit: 'g/dL', referenceRange: '32-36' },
  // Chemistry
  { name: 'Glucose (Fasting)', unit: 'mg/dL', referenceRange: '70-100', criticalLow: 40, criticalHigh: 500 },
  { name: 'Glucose (Random)', unit: 'mg/dL', referenceRange: '70-140', criticalLow: 40, criticalHigh: 500 },
  { name: 'HbA1c', unit: '%', referenceRange: '4.0-5.6' },
  { name: 'Creatinine', unit: 'mg/dL', referenceRange: '0.7-1.3', criticalHigh: 10.0 },
  { name: 'BUN', unit: 'mg/dL', referenceRange: '7-20', criticalHigh: 100 },
  { name: 'Sodium', unit: 'mEq/L', referenceRange: '136-145', criticalLow: 120, criticalHigh: 160 },
  { name: 'Potassium', unit: 'mEq/L', referenceRange: '3.5-5.0', criticalLow: 2.5, criticalHigh: 6.5 },
  { name: 'Chloride', unit: 'mEq/L', referenceRange: '98-106' },
  { name: 'CO2', unit: 'mEq/L', referenceRange: '23-29' },
  { name: 'Calcium', unit: 'mg/dL', referenceRange: '8.5-10.5', criticalLow: 6.0, criticalHigh: 13.0 },
  { name: 'AST (SGOT)', unit: 'U/L', referenceRange: '10-40' },
  { name: 'ALT (SGPT)', unit: 'U/L', referenceRange: '7-56' },
  { name: 'ALP', unit: 'U/L', referenceRange: '44-147' },
  { name: 'Total Bilirubin', unit: 'mg/dL', referenceRange: '0.1-1.2' },
  { name: 'Albumin', unit: 'g/dL', referenceRange: '3.5-5.0' },
  { name: 'Total Protein', unit: 'g/dL', referenceRange: '6.0-8.3' },
  // Lipid Panel
  { name: 'Total Cholesterol', unit: 'mg/dL', referenceRange: '<200' },
  { name: 'Triglycerides', unit: 'mg/dL', referenceRange: '<150' },
  { name: 'HDL', unit: 'mg/dL', referenceRange: '>40' },
  { name: 'LDL', unit: 'mg/dL', referenceRange: '<100' },
  // Urinalysis
  { name: 'pH', unit: '', referenceRange: '4.5-8.0' },
  { name: 'Specific Gravity', unit: '', referenceRange: '1.005-1.030' },
];

const REJECTION_REASONS = [
  'Hemolyzed',
  'Insufficient volume',
  'Wrong tube',
  'Clotted',
  'Contaminated',
  'Incorrect labeling',
  'Delayed transport',
  'Other',
] as const;

export default function ResultsEntryPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [selectedSample, setSelectedSample] = useState<PendingSample | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [comments, setComments] = useState('');
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);
  const [criticalValues, setCriticalValues] = useState<string[]>([]);

  // Track entered result IDs per sample (needed for validate/release)
  const [enteredResultIds, setEnteredResultIds] = useState<Record<string, string[]>>({});

  // Track critical values per sample
  const [criticalSamples, setCriticalSamples] = useState<Record<string, string[]>>({});

  // QC state per sample
  const [qcState, setQcState] = useState<Record<string, {
    qcSamplePassed: boolean;
    calibVerified: boolean;
    reagentsOk: boolean;
    failureReason: string;
  }>>({});

  // Sent to doctor state
  const [sentToDoctor, setSentToDoctor] = useState<Record<string, boolean>>({});

  // Critical acknowledged per sample (after sending urgent)
  const [criticalAcknowledged, setCriticalAcknowledged] = useState<Record<string, boolean>>({});

  // Post-release critical value alert dialog
  const [releaseCriticalAlert, setReleaseCriticalAlert] = useState<{
    sampleId: string;
    patientName: string;
    referringDoctor: string;
    criticalParams: string[];
  } | null>(null);
  const [releaseCriticalAcked, setReleaseCriticalAcked] = useState(false);

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState<{ sampleId: string; sampleNumber: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');

  if (!hasPermission('lab.read')) {
    return <AccessDenied />;
  }

  // Fetch lab samples with status 'collected' or 'processing' (ready for results)
  const { data: samplesData, isLoading } = useQuery({
    queryKey: ['lab-samples', 'results-entry', facilityId],
    queryFn: () => labService.samples.list({ facilityId, status: 'collected' }),
    staleTime: 20000,
  });

  // Transform API samples to display format
  const samples: PendingSample[] = useMemo(() => {
    const sampleList = samplesData?.data || [];
    if (sampleList.length === 0) return [];
    return sampleList.map((sample: LabSample) => {
      const hasRanges = Array.isArray(sample.labTest?.referenceRanges) && sample.labTest.referenceRanges.length > 0;
      return {
        id: sample.id,
        sampleNumber: sample.sampleNumber || sample.barcode || sample.id,
        patientName: sample.patient?.fullName || (sample.patient ? `${sample.patient.firstName || ''} ${sample.patient.lastName || ''}`.trim() : '') || 'Unknown',
        patientId: sample.patientId,
        patientMrn: sample.patient?.mrn,
        testName: sample.labTest?.name || 'Lab Test',
        testCode: sample.labTest?.code,
        testCategory: sample.labTest?.category,
        testId: sample.labTestId,
        sampleType: sample.sampleType,
        collectedAt: sample.collectionTime ? new Date(sample.collectionTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        collectedAtRaw: sample.collectionTime,
        priority: sample.priority || 'routine',
        parameters: hasRanges
          ? sample.labTest!.referenceRanges.map((rr: any) => ({
              name: rr.parameter,
              unit: rr.unit,
              referenceRange: rr.textNormal
                ? rr.textNormal
                : rr.normalMin !== undefined && rr.normalMax !== undefined
                  ? `${rr.normalMin}-${rr.normalMax}`
                  : rr.normalMin !== undefined
                    ? `>${rr.normalMin}`
                    : rr.normalMax !== undefined
                      ? `<${rr.normalMax}`
                      : '',
              criticalLow: rr.criticalLow,
              criticalHigh: rr.criticalHigh,
            }))
          : defaultParameters,
        usingFallbackParameters: !hasRanges,
        results: [],
        status: sample.status,
        verified: sample.status === 'completed',
        approved: sample.status === 'completed',
        comments: sample.collectionNotes || '',
      };
    });
  }, [samplesData]);

  // Enter result mutation - uses /lab/samples/:sampleId/results
  const enterResultMutation = useMutation({
    mutationFn: async (data: { sampleId: string; results: TestResult[]; comments: string }) => {
      const ids: string[] = [];
      for (const result of data.results) {
        if (!result.value) continue; // skip empty values
        const dto: EnterResultDto = {
          parameter: result.name,
          value: result.value,
          numericValue: parseFloat(result.value) || undefined,
          unit: result.unit,
          referenceRange: result.referenceRange,
          comments: data.comments,
        };
        const entered = await labService.results.enter(data.sampleId, dto);
        ids.push(entered.id);
      }
      return { sampleId: data.sampleId, ids };
    },
    onSuccess: ({ sampleId, ids }) => {
      setEnteredResultIds(prev => ({ ...prev, [sampleId]: ids }));
      queryClient.invalidateQueries({ queryKey: ['lab-samples'] });
      if (selectedSample) {
        setSelectedSample({ ...selectedSample, verified: true });
      }
    },
  });

  // Send to doctor mutation - validates and releases each result to the physician
  const sendToDoctorMutation = useMutation({
    mutationFn: async ({ sampleId, isCritical }: { sampleId: string; isCritical: boolean }) => {
      const ids = enteredResultIds[sampleId] || [];
      for (const resultId of ids) {
        await labService.results.validate(resultId, user?.name ? `Validated by ${user.name}` : undefined);
        await labService.results.release(resultId);
      }
      return { isCritical };
    },
    onSuccess: ({ isCritical }, { sampleId }) => {
      queryClient.invalidateQueries({ queryKey: ['lab-samples'] });
      setSentToDoctor(prev => ({ ...prev, [sampleId]: true }));
      if (isCritical) {
        toast.warning('Critical value notification sent — acknowledge when appropriate staff contacted');
      } else {
        toast.success('Results validated and sent');
      }
    },
    onError: () => {
      toast.error('Failed to validate results');
    },
  });

  // Sample rejection mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ sampleId, reason, notes }: { sampleId: string; reason: string; notes: string }) => {
      const rejectionReason = notes ? `${reason}: ${notes}` : reason;
      return labService.samples.reject(sampleId, rejectionReason);
    },
    onSuccess: (_, { sampleId }) => {
      queryClient.invalidateQueries({ queryKey: ['lab-samples'] });
      if (selectedSample?.id === sampleId) {
        setSelectedSample(null);
        setResults({});
        setComments('');
      }
      setRejectModal(null);
      setRejectReason('');
      setRejectNotes('');
      toast.success('Sample rejected successfully');
    },
    onError: () => {
      toast.error('Failed to reject sample');
    },
  });
  const completeMutation = useMutation({
    mutationFn: async ({ sampleId }: { sampleId: string; criticalParams: string[]; patientName: string; referringDoctor: string }) => {
      // First, receive the sample if it's in collected status
      try {
        await labService.samples.receive(sampleId);
      } catch (e: any) {
        // Ignore if already received
        if (!e.response?.data?.message?.includes('not in collected status')) {
          console.warn('Could not receive sample:', e.message);
        }
      }
      
      // Then start processing
      try {
        await labService.samples.startProcessing(sampleId);
      } catch (e: any) {
        // Ignore if already processing
        console.warn('Could not start processing:', e.message);
      }
      
      return { success: true };
    },
    onSuccess: (_, { sampleId, criticalParams, patientName, referringDoctor }) => {
      queryClient.invalidateQueries({ queryKey: ['lab-samples'] });
      setSelectedSample(null);
      setResults({});
      setComments('');
      if (criticalParams.length > 0) {
        setReleaseCriticalAcked(false);
        setReleaseCriticalAlert({ sampleId, patientName, referringDoctor, criticalParams });
      }
    },
  });

  const pendingSamples = useMemo(() => {
    return samples
      .filter((s) => !s.approved)
      .filter((s) =>
        s.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.testName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.sampleNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [samples, searchTerm]);

  const getResultStatus = (value: string, param: { referenceRange: string; criticalLow?: number; criticalHigh?: number }): 'Normal' | 'Abnormal' | 'Critical' => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'Normal';

    if (param.criticalLow !== undefined && numValue < param.criticalLow) return 'Critical';
    if (param.criticalHigh !== undefined && numValue > param.criticalHigh) return 'Critical';

    const range = param.referenceRange;
    if (range.startsWith('<')) {
      const max = parseFloat(range.slice(1));
      return numValue < max ? 'Normal' : 'Abnormal';
    }
    if (range.startsWith('>')) {
      const min = parseFloat(range.slice(1));
      return numValue > min ? 'Normal' : 'Abnormal';
    }
    const [min, max] = range.split('-').map(parseFloat);
    if (numValue < min || numValue > max) return 'Abnormal';
    return 'Normal';
  };

  const handleResultChange = (paramName: string, value: string) => {
    setResults((prev) => ({ ...prev, [paramName]: value }));
  };

  const handleVerify = () => {
    if (!selectedSample) return;

    const criticals: string[] = [];
    const testResults: TestResult[] = selectedSample.parameters.map((param) => {
      const value = results[param.name] || '';
      const status = getResultStatus(value, param);
      if (status === 'Critical') {
        criticals.push(`${param.name}: ${value} ${param.unit}`);
      }
      return { name: param.name, value, unit: param.unit, referenceRange: param.referenceRange, status };
    });

    if (criticals.length > 0) {
      setCriticalValues(criticals);
      setCriticalSamples(prev => ({ ...prev, [selectedSample.id]: criticals }));
      setShowCriticalAlert(true);
      // Browser notification for critical values
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('Critical Lab Value', {
              body: criticals.join(', '),
              requireInteraction: true,
            });
          }
        });
      }
    }

    enterResultMutation.mutate({
      sampleId: selectedSample.id,
      results: testResults,
      comments,
    });
  };

  const handleApprove = () => {
    if (!selectedSample) return;
    completeMutation.mutate({
      sampleId: selectedSample.id,
      criticalParams: criticalSamples[selectedSample.id] || [],
      patientName: selectedSample.patientName,
      referringDoctor: selectedSample.referringDoctor || 'Not specified',
    });
  };

  const handleSendToDoctor = () => {
    if (!selectedSample) return;
    const isCritical = (criticalSamples[selectedSample.id]?.length ?? 0) > 0;
    sendToDoctorMutation.mutate({ sampleId: selectedSample.id, isCritical });
  };

  const selectSample = (sample: PendingSample) => {
    setSelectedSample(sample);
    const initialResults: Record<string, string> = {};
    sample.results.forEach((r) => {
      initialResults[r.name] = r.value;
    });
    setResults(initialResults);
    setComments(sample.comments);
    // Reset QC state for this sample if not set yet
    if (!qcState[sample.id]) {
      setQcState(prev => ({
        ...prev,
        [sample.id]: { qcSamplePassed: true, calibVerified: true, reagentsOk: true, failureReason: '' },
      }));
    }
  };

  const statusColors = {
    Normal: 'text-green-600 bg-green-50',
    Abnormal: 'text-orange-600 bg-orange-50',
    Critical: 'text-red-600 bg-red-50 font-bold',
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <FileText className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Results Entry</h1>
            <p className="text-sm text-gray-500">Enter and verify test results</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-xl font-bold text-amber-600">{samples.filter((s) => !s.verified).length}</p>
            <p className="text-xs text-amber-500">Pending Entry</p>
          </div>
          <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-xl font-bold text-blue-600">{samples.filter((s) => s.verified && !s.approved).length}</p>
            <p className="text-xs text-blue-500">Awaiting Approval</p>
          </div>
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-xl font-bold text-green-600">{samples.filter((s) => s.approved).length}</p>
            <p className="text-xs text-green-500">Approved</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="w-80 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search samples..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-100">
            {pendingSamples.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No pending samples</p>
              </div>
            )}
            {pendingSamples.map((sample) => {
              const elapsed = sample.collectedAtRaw
                ? Math.round((Date.now() - new Date(sample.collectedAtRaw).getTime()) / 60000)
                : null;
              const elapsedStr = elapsed !== null
                ? elapsed < 60 ? `${elapsed}m` : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m`
                : '';
              const priorityStyle = sample.priority === 'stat'
                ? 'border-l-4 border-red-500'
                : sample.priority === 'urgent'
                  ? 'border-l-4 border-orange-400'
                  : '';
              return (
              <div
                key={sample.id}
                onClick={() => selectSample(sample)}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${priorityStyle} ${
                  selectedSample?.id === sample.id ? 'bg-emerald-50 border-l-4 !border-emerald-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{sample.testName}</p>
                      {sample.priority === 'stat' && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase flex-shrink-0">STAT</span>
                      )}
                      {sample.priority === 'urgent' && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded uppercase flex-shrink-0">URG</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{sample.patientName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-400">{sample.sampleNumber}</p>
                      {elapsed !== null && (
                        <span className={`text-xs ${elapsed > 120 ? 'text-red-500 font-medium' : elapsed > 60 ? 'text-orange-500' : 'text-gray-400'}`}>
                          • {elapsedStr} ago
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                    {sample.verified ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRejectReason('');
                        setRejectNotes('');
                        setRejectModal({ sampleId: sample.id, sampleNumber: sample.sampleNumber });
                      }}
                      className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 text-xs rounded flex items-center gap-1 hover:bg-red-100 mt-1"
                    >
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {selectedSample ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{selectedSample.testName}</h2>
                      {selectedSample.testCode && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded font-mono">{selectedSample.testCode}</span>
                      )}
                      {selectedSample.priority === 'stat' && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">STAT</span>
                      )}
                      {selectedSample.priority === 'urgent' && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">URGENT</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm text-gray-500">
                        {selectedSample.patientName}
                        {selectedSample.patientMrn && <span className="text-gray-400"> • MRN: {selectedSample.patientMrn}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-xs text-gray-400">Sample: {selectedSample.sampleNumber}</p>
                      {selectedSample.sampleType && (
                        <span className="text-xs text-gray-400">• {selectedSample.sampleType}</span>
                      )}
                      {selectedSample.testCategory && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded capitalize">{selectedSample.testCategory}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Collected: {selectedSample.collectedAt}</p>
                    <p className="text-xs text-gray-400">{selectedSample.parameters.length} parameter{selectedSample.parameters.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {/* Progress bar */}
                {!selectedSample.verified && (() => {
                  const filled = selectedSample.parameters.filter(p => results[p.name]).length;
                  const total = selectedSample.parameters.length;
                  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
                  return (
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{filled}/{total} filled</span>
                    </div>
                  );
                })()}
                {/* Critical value banner */}
                {selectedSample.verified && (criticalSamples[selectedSample.id]?.length ?? 0) > 0 && (
                  <div className="mb-4 p-4 bg-red-50 border-2 border-red-500 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-red-700 text-sm">⚠️ CRITICAL VALUE DETECTED</p>
                      {criticalSamples[selectedSample.id].map((val, idx) => (
                        <p key={idx} className="text-red-700 text-sm font-medium">{val}</p>
                      ))}
                      <p className="text-red-600 text-xs mt-1">Notify appropriate clinician immediately.</p>
                    </div>
                  </div>
                )}
                {/* Fallback parameters warning */}
                {selectedSample.usingFallbackParameters && !selectedSample.verified && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-800">Using default reference ranges</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        <strong>{selectedSample.testName}</strong> has no configured reference ranges in the test catalog.
                        Shown ranges are generic defaults and may not be appropriate for this test.
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(selectedSample.testId ? `/admin/lab/tests/${selectedSample.testId}` : '/admin/lab/tests')}
                      className="text-xs text-amber-700 underline hover:text-amber-900 flex-shrink-0 font-medium"
                    >
                      Configure →
                    </button>
                  </div>
                )}
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-sm text-gray-600">
                      <th className="px-4 py-3 font-medium w-[30%]">Parameter</th>
                      <th className="px-4 py-3 font-medium w-[25%]">Result</th>
                      <th className="px-4 py-3 font-medium w-[12%]">Unit</th>
                      <th className="px-4 py-3 font-medium w-[20%]">Reference Range</th>
                      <th className="px-4 py-3 font-medium w-[13%]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedSample.parameters.map((param, idx) => {
                      const value = results[param.name] || '';
                      const status = value ? getResultStatus(value, param) : null;
                      const isQualitative = !param.unit || param.referenceRange === 'Negative' || param.referenceRange === 'Non-Reactive' || param.referenceRange === 'Not Seen' || param.referenceRange === 'No Growth' || param.referenceRange === 'Compatible';
                      const rowBg = status === 'Critical'
                        ? 'bg-red-50'
                        : status === 'Abnormal'
                          ? 'bg-orange-50'
                          : value
                            ? 'bg-green-50/30'
                            : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                      return (
                        <tr key={param.name} className={`${rowBg} transition-colors`}>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${status === 'Critical' ? 'text-red-700' : status === 'Abnormal' ? 'text-orange-700' : 'text-gray-900'}`}>
                              {param.name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => handleResultChange(param.name, e.target.value)}
                              disabled={selectedSample.verified}
                              placeholder={isQualitative ? param.referenceRange : '—'}
                              className={`${isQualitative ? 'w-36' : 'w-24'} px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                                selectedSample.verified ? 'bg-gray-100 text-gray-600' : 'border-gray-300'
                              } ${status === 'Critical' ? 'border-red-500 bg-red-50 text-red-800 font-semibold' : ''} ${status === 'Abnormal' ? 'border-orange-400 bg-orange-50 text-orange-800' : ''}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{param.unit}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">{param.referenceRange}</td>
                          <td className="px-4 py-3">
                            {status && (
                              <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${statusColors[status]}`}>
                                {status === 'Critical' && <AlertTriangle className="w-3 h-3" />}
                                {status === 'Abnormal' && <Flag className="w-3 h-3" />}
                                {status === 'Normal' && <CheckCircle className="w-3 h-3" />}
                                {status}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments / Notes
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    disabled={selectedSample.verified}
                    placeholder="Add any comments or notes about the results..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 resize-none h-20"
                  />
                </div>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    <p className="font-medium text-blue-700">Quality Control</p>
                  </div>
                  {(() => {
                    const qc = qcState[selectedSample.id] ?? { qcSamplePassed: true, calibVerified: true, reagentsOk: true, failureReason: '' };
                    const updateQc = (patch: Partial<typeof qc>) =>
                      setQcState(prev => ({ ...prev, [selectedSample.id]: { ...qc, ...patch } }));
                    const anyFailed = !qc.qcSamplePassed || !qc.calibVerified || !qc.reagentsOk;
                    return (
                      <>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm text-blue-700">
                            <input
                              type="checkbox"
                              checked={qc.qcSamplePassed}
                              onChange={e => updateQc({ qcSamplePassed: e.target.checked })}
                              className="rounded"
                            />
                            QC sample passed
                          </label>
                          <label className="flex items-center gap-2 text-sm text-blue-700">
                            <input
                              type="checkbox"
                              checked={qc.calibVerified}
                              onChange={e => updateQc({ calibVerified: e.target.checked })}
                              className="rounded"
                            />
                            Calibration verified
                          </label>
                          <label className="flex items-center gap-2 text-sm text-blue-700">
                            <input
                              type="checkbox"
                              checked={qc.reagentsOk}
                              onChange={e => updateQc({ reagentsOk: e.target.checked })}
                              className="rounded"
                            />
                            Reagents in date
                          </label>
                        </div>
                        {anyFailed && (
                          <div className="mt-3">
                            <label className="block text-xs font-medium text-red-600 mb-1">
                              QC Failure Reason <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={qc.failureReason}
                              onChange={e => updateQc({ failureReason: e.target.value })}
                              placeholder="Describe the QC failure..."
                              className="w-full px-3 py-1.5 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400"
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedSample.verified && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Results Verified
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  {!selectedSample.verified ? (
                    <button
                      onClick={handleVerify}
                      disabled={enterResultMutation.isPending}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      {enterResultMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      Verify Results
                    </button>
                  ) : !selectedSample.approved ? (
                    <>
                      {sentToDoctor[selectedSample.id] && (criticalSamples[selectedSample.id]?.length ?? 0) > 0 && !criticalAcknowledged[selectedSample.id] && (
                        <button
                          onClick={() => setCriticalAcknowledged(prev => ({ ...prev, [selectedSample.id]: true }))}
                          className="px-4 py-2 bg-orange-100 border border-orange-400 text-orange-700 rounded-lg flex items-center gap-2 text-sm"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Critical value notification sent — acknowledge when contacted
                        </button>
                      )}
                      {(() => {
                        const qc = qcState[selectedSample.id] ?? { qcSamplePassed: true, calibVerified: true, reagentsOk: true, failureReason: '' };
                        const qcFailed = !qc.qcSamplePassed || !qc.calibVerified || !qc.reagentsOk;
                        const isCritical = (criticalSamples[selectedSample.id]?.length ?? 0) > 0;
                        const alreadySent = sentToDoctor[selectedSample.id];
                        const hasDoctor = !!selectedSample.referringDoctor;
                        return (
                          <button
                            onClick={handleSendToDoctor}
                            disabled={alreadySent || qcFailed || sendToDoctorMutation.isPending}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50 ${
                              isCritical
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
                            } ${qcFailed ? 'cursor-not-allowed' : ''}`}
                            title={qcFailed ? 'QC checks must all pass before validating' : !hasDoctor ? 'Walk-in order — send to doctor is optional' : undefined}
                          >
                            {sendToDoctorMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            {alreadySent
                              ? isCritical ? 'Sent URGENT to Doctor' : 'Sent to Doctor'
                              : isCritical ? 'Send URGENT to Doctor' : hasDoctor ? 'Send to Doctor' : 'Send to Doctor (Optional)'}
                          </button>
                        );
                      })()}
                      <button
                        onClick={handleApprove}
                        disabled={completeMutation.isPending}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                        Approve & Release
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2" />
                <p>Select a test to enter results</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCriticalAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-red-700 mb-2">Critical Values Detected!</h3>
              <p className="text-gray-600 mb-4">The following values are critical and require immediate attention:</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                {criticalValues.map((val, idx) => (
                  <p key={idx} className="text-red-700 font-medium">{val}</p>
                ))}
              </div>
              <p className="text-sm text-gray-500 mb-4">Please notify the appropriate clinician immediately.</p>
              <button
                onClick={() => setShowCriticalAlert(false)}
                className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}

      {releaseCriticalAlert && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] shadow-2xl border-2 border-red-500">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-7 h-7 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-700">⚠️ Critical Value Alert</h3>
                <p className="text-sm text-gray-600 mt-0.5">Patient: <span className="font-medium">{releaseCriticalAlert.patientName}</span></p>
                <p className="text-sm text-gray-600">Referring Physician: <span className="font-medium">{releaseCriticalAlert.referringDoctor !== 'Not specified' ? releaseCriticalAlert.referringDoctor : 'Walk-in (none)'}</span></p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-red-700 mb-2">Critical Parameters:</p>
              {releaseCriticalAlert.criticalParams.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2 text-red-800 font-medium py-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {val}
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-600 mb-4">
              These results contain critical values. {releaseCriticalAlert.referringDoctor && releaseCriticalAlert.referringDoctor !== 'Not specified'
                ? 'The attending physician must be notified immediately.'
                : 'The appropriate clinician should be notified if applicable.'}
            </p>

            {!sentToDoctor[releaseCriticalAlert.sampleId] && (
              <button
                onClick={() => {
                  sendToDoctorMutation.mutate({ sampleId: releaseCriticalAlert.sampleId, isCritical: true });
                }}
                disabled={sendToDoctorMutation.isPending}
                className="w-full mb-4 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
              >
                {sendToDoctorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Notify Doctor (Send URGENT)
              </button>
            )}
            {sentToDoctor[releaseCriticalAlert.sampleId] && (
              <div className="w-full mb-4 px-4 py-2.5 bg-green-50 border border-green-300 text-green-700 rounded-lg flex items-center justify-center gap-2 text-sm font-medium">
                <CheckCircle className="w-4 h-4" /> Doctor notified
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <input
                type="checkbox"
                checked={releaseCriticalAcked}
                onChange={e => setReleaseCriticalAcked(e.target.checked)}
                className="w-4 h-4 rounded accent-orange-600"
              />
              <span className="text-sm font-medium text-orange-800">
                I acknowledge these critical values and confirm appropriate action has been taken
              </span>
            </label>

            <button
              onClick={() => {
                setCriticalAcknowledged(prev => ({ ...prev, [releaseCriticalAlert.sampleId]: true }));
                setReleaseCriticalAlert(null);
              }}
              disabled={!releaseCriticalAcked}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[480px] shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                Reject Sample
              </h3>
              <button
                onClick={() => setRejectModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Sample: <span className="font-medium">{rejectModal.sampleNumber}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <select
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400"
              >
                <option value="">Select reason...</option>
                {REJECTION_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="Optional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 resize-none h-20"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason) return;
                  rejectMutation.mutate({ sampleId: rejectModal.sampleId, reason: rejectReason, notes: rejectNotes });
                }}
                disabled={!rejectReason || rejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
              >
                {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
