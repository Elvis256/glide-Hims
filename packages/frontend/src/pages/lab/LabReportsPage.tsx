import { useState, useMemo } from 'react';
import { toast } from 'sonner';
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



const reportTemplates = ['Standard Report', 'Detailed Report', 'Summary Only', 'Trend Analysis'];

export default function LabReportsPage() {
  const [patients] = useState<Patient[]>([]);
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
  const handleEmail = () => toast.success('Report sent via email');
  const handleDownload = () => toast.success('Report downloaded as PDF');

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
            <p className="text-xl font-bold text-violet-600">0</p>
            <p className="text-xs text-violet-500">Patients</p>
          </div>
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-xl font-bold text-amber-600">0</p>
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