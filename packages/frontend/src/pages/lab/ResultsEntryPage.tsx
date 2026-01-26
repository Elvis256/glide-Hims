import { useState, useMemo } from 'react';
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
import { labService, type LabOrder, type LabResult } from '../../services';

interface TestResult {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
}

interface PendingTest {
  id: string;
  patientName: string;
  patientId: string;
  testName: string;
  sampleId: string;
  collectedAt: string;
  parameters: { name: string; unit: string; referenceRange: string; criticalLow?: number; criticalHigh?: number }[];
  results: TestResult[];
  verified: boolean;
  approved: boolean;
  comments: string;
  sentToDoctor: boolean;
}

const mockPendingTests: PendingTest[] = [
  {
    id: 'T001', patientName: 'John Smith', patientId: 'P001', testName: 'Complete Blood Count', sampleId: 'LAB-2024-0101',
    collectedAt: '08:15 AM',
    parameters: [
      { name: 'WBC', unit: 'x10^9/L', referenceRange: '4.5-11.0', criticalLow: 2.0, criticalHigh: 30.0 },
      { name: 'RBC', unit: 'x10^12/L', referenceRange: '4.5-5.5', criticalLow: 2.0, criticalHigh: 7.0 },
      { name: 'Hemoglobin', unit: 'g/dL', referenceRange: '13.5-17.5', criticalLow: 7.0, criticalHigh: 20.0 },
      { name: 'Hematocrit', unit: '%', referenceRange: '38-50' },
      { name: 'Platelets', unit: 'x10^9/L', referenceRange: '150-400', criticalLow: 50, criticalHigh: 1000 },
    ],
    results: [], verified: false, approved: false, comments: '', sentToDoctor: false
  },
  {
    id: 'T002', patientName: 'Mary Johnson', patientId: 'P002', testName: 'Basic Metabolic Panel', sampleId: 'LAB-2024-0102',
    collectedAt: '07:45 AM',
    parameters: [
      { name: 'Glucose', unit: 'mg/dL', referenceRange: '70-100', criticalLow: 40, criticalHigh: 500 },
      { name: 'BUN', unit: 'mg/dL', referenceRange: '7-20' },
      { name: 'Creatinine', unit: 'mg/dL', referenceRange: '0.7-1.3', criticalHigh: 10.0 },
      { name: 'Sodium', unit: 'mEq/L', referenceRange: '136-145', criticalLow: 120, criticalHigh: 160 },
      { name: 'Potassium', unit: 'mEq/L', referenceRange: '3.5-5.0', criticalLow: 2.5, criticalHigh: 6.5 },
    ],
    results: [], verified: false, approved: false, comments: '', sentToDoctor: false
  },
  {
    id: 'T003', patientName: 'Robert Brown', patientId: 'P003', testName: 'Lipid Panel', sampleId: 'LAB-2024-0103',
    collectedAt: '08:00 AM',
    parameters: [
      { name: 'Total Cholesterol', unit: 'mg/dL', referenceRange: '<200' },
      { name: 'LDL Cholesterol', unit: 'mg/dL', referenceRange: '<100' },
      { name: 'HDL Cholesterol', unit: 'mg/dL', referenceRange: '>40' },
      { name: 'Triglycerides', unit: 'mg/dL', referenceRange: '<150' },
    ],
    results: [], verified: false, approved: false, comments: '', sentToDoctor: false
  },
  {
    id: 'T004', patientName: 'Emily Davis', patientId: 'P004', testName: 'Thyroid Panel', sampleId: 'LAB-2024-0104',
    collectedAt: '06:30 AM',
    parameters: [
      { name: 'TSH', unit: 'mIU/L', referenceRange: '0.4-4.0' },
      { name: 'Free T4', unit: 'ng/dL', referenceRange: '0.8-1.8' },
      { name: 'Free T3', unit: 'pg/mL', referenceRange: '2.3-4.2' },
    ],
    results: [], verified: false, approved: false, comments: '', sentToDoctor: false
  },
];

export default function ResultsEntryPage() {
  const queryClient = useQueryClient();
  const [selectedTest, setSelectedTest] = useState<PendingTest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [comments, setComments] = useState('');
  const [showCriticalAlert, setShowCriticalAlert] = useState(false);
  const [criticalValues, setCriticalValues] = useState<string[]>([]);

  // Fetch pending lab orders from API
  const { data: apiOrders, isLoading } = useQuery({
    queryKey: ['lab-orders', 'results-entry'],
    queryFn: () => labService.orders.list({ status: 'collected' }),
    staleTime: 20000,
  });

  // Transform API orders to test format
  const tests: PendingTest[] = useMemo(() => {
    const orders = apiOrders || [];
    if (orders.length === 0) return [];
    return orders.map((order: LabOrder) => ({
      id: order.id,
      patientName: order.patient?.fullName || 'Unknown',
      patientId: order.patientId,
      testName: order.tests?.[0]?.name || order.tests?.[0]?.testName || 'Lab Test',
      sampleId: order.sampleId || order.orderNumber || order.id,
      collectedAt: order.collectedAt ? new Date(order.collectedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      parameters: order.tests?.[0]?.parameters || mockPendingTests[0].parameters,
      results: [],
      verified: order.status === 'verified' || order.status === 'completed',
      approved: order.status === 'completed',
      comments: order.clinicalNotes || '',
      sentToDoctor: false,
    }));
  }, [apiOrders]);

  // Mutations
  const verifyMutation = useMutation({
    mutationFn: (data: { orderId: string; results: TestResult[]; comments: string }) =>
      labService.results.create({
        orderId: data.orderId,
        values: data.results.map(r => ({ parameter: r.name, value: r.value, unit: r.unit, status: r.status })),
        notes: data.comments,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (orderId: string) => labService.orders.updateStatus(orderId, 'completed'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      setSelectedTest(null);
      setResults({});
      setComments('');
    },
  });

  const pendingTests = useMemo(() => {
    return tests
      .filter((t) => !t.approved)
      .filter((t) =>
        t.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.testName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.sampleId.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [tests, searchTerm]);

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
    if (!selectedTest) return;

    const criticals: string[] = [];
    const testResults: TestResult[] = selectedTest.parameters.map((param) => {
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

    verifyMutation.mutate({
      orderId: selectedTest.id,
      results: testResults,
      comments,
    });
  };

  const handleApprove = () => {
    if (!selectedTest) return;
    approveMutation.mutate(selectedTest.id);
  };

  const [sentToDoctor, setSentToDoctor] = useState<Record<string, boolean>>({});

  const handleSendToDoctor = () => {
    if (!selectedTest) return;
    setSentToDoctor(prev => ({ ...prev, [selectedTest.id]: true }));
    alert('Results sent to attending physician');
  };

  const selectTest = (test: PendingTest) => {
    setSelectedTest(test);
    const initialResults: Record<string, string> = {};
    test.results.forEach((r) => {
      initialResults[r.name] = r.value;
    });
    setResults(initialResults);
    setComments(test.comments);
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
            <p className="text-xl font-bold text-amber-600">{tests.filter((t) => !t.verified).length}</p>
            <p className="text-xs text-amber-500">Pending Entry</p>
          </div>
          <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-xl font-bold text-blue-600">{tests.filter((t) => t.verified && !t.approved).length}</p>
            <p className="text-xs text-blue-500">Awaiting Approval</p>
          </div>
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-xl font-bold text-green-600">{tests.filter((t) => t.approved).length}</p>
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
                placeholder="Search tests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-100">
            {pendingTests.map((test) => (
              <div
                key={test.id}
                onClick={() => selectTest(test)}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedTest?.id === test.id ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{test.testName}</p>
                    <p className="text-sm text-gray-500">{test.patientName}</p>
                    <p className="text-xs text-gray-400 mt-1">{test.sampleId}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {test.verified ? (
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
          {selectedTest ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedTest.testName}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedTest.patientName} ({selectedTest.patientId}) • Sample: {selectedTest.sampleId}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    Collected: {selectedTest.collectedAt}
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
                    {selectedTest.parameters.map((param) => {
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
                              disabled={selectedTest.verified}
                              className={`w-24 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
                                selectedTest.verified ? 'bg-gray-100' : 'border-gray-300'
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
                    disabled={selectedTest.verified}
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
                  {selectedTest.verified && (
                    <span className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" /> Results Verified
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  {!selectedTest.verified ? (
                    <button
                      onClick={handleVerify}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Verify Results
                    </button>
                  ) : !selectedTest.approved ? (
                    <>
                      <button
                        onClick={handleSendToDoctor}
                        disabled={sentToDoctor[selectedTest.id]}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                        {sentToDoctor[selectedTest.id] ? 'Sent to Doctor' : 'Send to Doctor'}
                      </button>
                      <button
                        onClick={handleApprove}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                      >
                        <ThumbsUp className="w-4 h-4" />
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
