import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { labService, type LabSample, type LabResult, type EnterResultDto } from '../../services';
import { useFacilityId } from '../../lib/facility';

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
  testName: string;
  collectedAt: string;
  parameters: { name: string; unit: string; referenceRange: string; criticalLow?: number; criticalHigh?: number }[];
  results: TestResult[];
  status: string;
  verified: boolean;
  approved: boolean;
  comments: string;
}

const defaultParameters = [
  { name: 'WBC', unit: 'x10^9/L', referenceRange: '4.5-11.0', criticalLow: 2.0, criticalHigh: 30.0 },
  { name: 'RBC', unit: 'x10^12/L', referenceRange: '4.5-5.5', criticalLow: 2.0, criticalHigh: 7.0 },
  { name: 'Hemoglobin', unit: 'g/dL', referenceRange: '13.5-17.5', criticalLow: 7.0, criticalHigh: 20.0 },
  { name: 'Hematocrit', unit: '%', referenceRange: '38-50' },
  { name: 'Platelets', unit: 'x10^9/L', referenceRange: '150-400', criticalLow: 50, criticalHigh: 1000 },
];

export default function ResultsEntryPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [selectedSample, setSelectedSample] = useState<PendingSample | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [comments, setComments] = useState('');
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);
  const [criticalValues, setCriticalValues] = useState<string[]>([]);

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
    return sampleList.map((sample: LabSample) => ({
      id: sample.id,
      sampleNumber: sample.sampleNumber || sample.barcode || sample.id,
      patientName: sample.patient?.fullName || (sample.patient ? `${sample.patient.firstName || ''} ${sample.patient.lastName || ''}`.trim() : '') || 'Unknown',
      patientId: sample.patientId,
      testName: sample.labTest?.name || 'Lab Test',
      collectedAt: sample.collectionTime ? new Date(sample.collectionTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      parameters: defaultParameters, // TODO: Get from labTest.referenceRanges
      results: [],
      status: sample.status,
      verified: sample.status === 'completed',
      approved: sample.status === 'completed',
      comments: sample.collectionNotes || '',
    }));
  }, [samplesData]);

  // Enter result mutation - uses /lab/samples/:sampleId/results
  const enterResultMutation = useMutation({
    mutationFn: async (data: { sampleId: string; results: TestResult[]; comments: string }) => {
      // Enter each result parameter
      for (const result of data.results) {
        const dto: EnterResultDto = {
          parameter: result.name,
          value: result.value,
          numericValue: parseFloat(result.value) || undefined,
          unit: result.unit,
          referenceRange: result.referenceRange,
          comments: data.comments,
        };
        await labService.results.enter(data.sampleId, dto);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-samples'] });
      // Mark the sample as verified locally
      if (selectedSample) {
        setSelectedSample({ ...selectedSample, verified: true });
      }
    },
  });

  // Complete/release mutation - receives sample (if needed), then enters results
  const completeMutation = useMutation({
    mutationFn: async (sampleId: string) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-samples'] });
      setSelectedSample(null);
      setResults({});
      setComments('');
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
      setShowCriticalAlert(true);
    }

    enterResultMutation.mutate({
      sampleId: selectedSample.id,
      results: testResults,
      comments,
    });
  };

  const handleApprove = () => {
    if (!selectedSample) return;
    completeMutation.mutate(selectedSample.id);
  };

  const [sentToDoctor, setSentToDoctor] = useState<Record<string, boolean>>({});

  const handleSendToDoctor = () => {
    if (!selectedSample) return;
    setSentToDoctor(prev => ({ ...prev, [selectedSample.id]: true }));
    toast.success('Results sent to attending physician');
  };

  const selectSample = (sample: PendingSample) => {
    setSelectedSample(sample);
    const initialResults: Record<string, string> = {};
    sample.results.forEach((r) => {
      initialResults[r.name] = r.value;
    });
    setResults(initialResults);
    setComments(sample.comments);
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
            {pendingSamples.map((sample) => (
              <div
                key={sample.id}
                onClick={() => selectSample(sample)}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedSample?.id === sample.id ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{sample.testName}</p>
                    <p className="text-sm text-gray-500">{sample.patientName}</p>
                    <p className="text-xs text-gray-400 mt-1">{sample.sampleNumber}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {sample.verified ? (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {selectedSample ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedSample.testName}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedSample.patientName} ({selectedSample.patientId}) • Sample: {selectedSample.sampleNumber}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    Collected: {selectedSample.collectedAt}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-sm text-gray-600">
                      <th className="px-4 py-3 font-medium">Parameter</th>
                      <th className="px-4 py-3 font-medium">Result</th>
                      <th className="px-4 py-3 font-medium">Unit</th>
                      <th className="px-4 py-3 font-medium">Reference Range</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedSample.parameters.map((param) => {
                      const value = results[param.name] || '';
                      const status = value ? getResultStatus(value, param) : null;
                      return (
                        <tr key={param.name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{param.name}</td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => handleResultChange(param.name, e.target.value)}
                              disabled={selectedSample.verified}
                              className={`w-24 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                                selectedSample.verified ? 'bg-gray-100' : 'border-gray-300'
                              } ${status === 'Critical' ? 'border-red-500 bg-red-50' : ''}`}
                            />
                          </td>
                          <td className="px-4 py-3 text-gray-600">{param.unit}</td>
                          <td className="px-4 py-3 text-gray-600">{param.referenceRange}</td>
                          <td className="px-4 py-3">
                            {status && (
                              <span className={`px-2 py-1 rounded text-xs ${statusColors[status]}`}>
                                {status === 'Critical' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                                {status === 'Abnormal' && <Flag className="w-3 h-3 inline mr-1" />}
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
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-blue-700">
                      <input type="checkbox" defaultChecked className="rounded" />
                      QC sample passed
                    </label>
                    <label className="flex items-center gap-2 text-sm text-blue-700">
                      <input type="checkbox" defaultChecked className="rounded" />
                      Calibration verified
                    </label>
                    <label className="flex items-center gap-2 text-sm text-blue-700">
                      <input type="checkbox" defaultChecked className="rounded" />
                      Reagents in date
                    </label>
                  </div>
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
                      <button
                        onClick={handleSendToDoctor}
                        disabled={sentToDoctor[selectedSample.id]}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        {sentToDoctor[selectedSample.id] ? 'Sent to Doctor' : 'Send to Doctor'}
                      </button>
                      <button
                        onClick={handleApprove}
                        disabled={completeMutation.isPending}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
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
              <p className="text-sm text-gray-500 mb-4">Please notify the attending physician immediately.</p>
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
    </div>
  );
}
