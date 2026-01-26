import { useState, useMemo } from 'react';
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
} from 'lucide-react';

interface TestResult {
  date: string;
  value: number;
  unit: string;
  status: 'Normal' | 'Abnormal' | 'Critical';
}

interface PatientTest {
  id: string;
  testName: string;
  category: string;
  results: TestResult[];
  referenceRange: string;
  doctorReviewed: boolean;
  lastReportDate: string;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  tests: PatientTest[];
}

const mockPatients: Patient[] = [
  {
    id: 'P001', name: 'John Smith', age: 45, gender: 'Male',
    tests: [
      { id: 'T1', testName: 'HbA1c', category: 'Diabetes', referenceRange: '<5.7%', doctorReviewed: true, lastReportDate: '2024-01-15',
        results: [
          { date: '2024-01-15', value: 6.2, unit: '%', status: 'Abnormal' },
          { date: '2023-10-10', value: 6.5, unit: '%', status: 'Abnormal' },
          { date: '2023-07-05', value: 6.8, unit: '%', status: 'Abnormal' },
          { date: '2023-04-01', value: 7.1, unit: '%', status: 'Critical' },
        ]
      },
      { id: 'T2', testName: 'Fasting Glucose', category: 'Diabetes', referenceRange: '70-100 mg/dL', doctorReviewed: true, lastReportDate: '2024-01-15',
        results: [
          { date: '2024-01-15', value: 118, unit: 'mg/dL', status: 'Abnormal' },
          { date: '2023-10-10', value: 125, unit: 'mg/dL', status: 'Abnormal' },
          { date: '2023-07-05', value: 132, unit: 'mg/dL', status: 'Abnormal' },
        ]
      },
      { id: 'T3', testName: 'Total Cholesterol', category: 'Lipid', referenceRange: '<200 mg/dL', doctorReviewed: false, lastReportDate: '2024-01-15',
        results: [
          { date: '2024-01-15', value: 195, unit: 'mg/dL', status: 'Normal' },
          { date: '2023-07-05', value: 210, unit: 'mg/dL', status: 'Abnormal' },
        ]
      },
    ]
  },
  {
    id: 'P002', name: 'Mary Johnson', age: 62, gender: 'Female',
    tests: [
      { id: 'T4', testName: 'TSH', category: 'Thyroid', referenceRange: '0.4-4.0 mIU/L', doctorReviewed: true, lastReportDate: '2024-01-14',
        results: [
          { date: '2024-01-14', value: 2.5, unit: 'mIU/L', status: 'Normal' },
          { date: '2023-08-20', value: 3.2, unit: 'mIU/L', status: 'Normal' },
        ]
      },
      { id: 'T5', testName: 'Creatinine', category: 'Kidney', referenceRange: '0.6-1.1 mg/dL', doctorReviewed: false, lastReportDate: '2024-01-14',
        results: [
          { date: '2024-01-14', value: 1.3, unit: 'mg/dL', status: 'Abnormal' },
          { date: '2023-11-10', value: 1.1, unit: 'mg/dL', status: 'Normal' },
          { date: '2023-08-20', value: 0.9, unit: 'mg/dL', status: 'Normal' },
        ]
      },
    ]
  },
  {
    id: 'P003', name: 'Robert Brown', age: 55, gender: 'Male',
    tests: [
      { id: 'T6', testName: 'PSA', category: 'Cancer Markers', referenceRange: '<4.0 ng/mL', doctorReviewed: true, lastReportDate: '2024-01-13',
        results: [
          { date: '2024-01-13', value: 2.8, unit: 'ng/mL', status: 'Normal' },
          { date: '2023-07-15', value: 2.5, unit: 'ng/mL', status: 'Normal' },
          { date: '2023-01-10', value: 2.2, unit: 'ng/mL', status: 'Normal' },
        ]
      },
    ]
  },
];

const reportTemplates = ['Standard Report', 'Detailed Report', 'Summary Only', 'Trend Analysis'];

export default function LabReportsPage() {
  const [patients] = useState<Patient[]>(mockPatients);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTest, setSelectedTest] = useState<PatientTest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('Standard Report');
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [showTrendChart, setShowTrendChart] = useState(false);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [patients, searchTerm]);

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

  const handlePrint = () => window.print();
  const handleEmail = () => alert('Report sent via email');
  const handleDownload = () => alert('Report downloaded as PDF');

  const maxChartValue = selectedTest ? Math.max(...selectedTest.results.map(r => r.value)) * 1.2 : 0;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <FileText className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Reports</h1>
            <p className="text-sm text-gray-500">Generate and view patient test reports</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-violet-50 border border-violet-200 rounded-lg text-center">
            <p className="text-xl font-bold text-violet-600">{patients.length}</p>
            <p className="text-xs text-violet-500">Patients</p>
          </div>
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-xl font-bold text-amber-600">
              {patients.reduce((acc, p) => acc + p.tests.filter(t => !t.doctorReviewed).length, 0)}
            </p>
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto divide-y divide-gray-100">
            {filteredPatients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => { setSelectedPatient(patient); setSelectedTest(null); }}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedPatient?.id === patient.id ? 'bg-violet-50 border-l-4 border-violet-500' : ''
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
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500"
                    >
                      {reportTemplates.map((t) => (
                        <option key={t} value={t}>{t}</option>
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
                              className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
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
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Eye className="w-4 h-4" />
                  Template: {selectedTemplate}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handlePrint}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                  <button
                    onClick={handleEmail}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Generate PDF
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
    </div>
  );
}