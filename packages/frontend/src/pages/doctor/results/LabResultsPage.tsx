import { useState, useMemo } from 'react';
import {
  FlaskConical,
  User,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Printer,
  Download,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Filter,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';
import { labService, type LabOrder as ApiLabOrder } from '../../../services/lab';

interface LabTest {
  id: string;
  testName: string;
  result: number | string;
  units: string;
  referenceRange: string;
  flag: 'Normal' | 'High' | 'Low' | 'Critical';
  previousResults?: { date: string; value: number }[];
  acknowledged: boolean;
}

interface LabOrder {
  id: string;
  orderDate: string;
  orderedBy: string;
  status: 'Pending' | 'Complete' | 'Partial';
  tests: LabTest[];
}

interface Patient {
  id: string;
  name: string;
  mrn: string;
  pendingResults: number;
  orders: LabOrder[];
}

// Transform API flag to local format
const transformFlag = (flag?: 'normal' | 'low' | 'high' | 'critical'): 'Normal' | 'High' | 'Low' | 'Critical' => {
  switch (flag) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'High';
    case 'low':
      return 'Low';
    default:
      return 'Normal';
  }
};

// Transform API status to local format
const transformStatus = (status: ApiLabOrder['status']): 'Pending' | 'Complete' | 'Partial' => {
  switch (status) {
    case 'completed':
    case 'verified':
      return 'Complete';
    case 'processing':
    case 'in-progress':
      return 'Partial';
    default:
      return 'Pending';
  }
};

// Transform API lab orders to local format
const transformOrders = (orders: ApiLabOrder[]): LabOrder[] => {
  return orders.map((order) => ({
    id: order.id,
    orderDate: new Date(order.createdAt).toISOString().split('T')[0],
    orderedBy: order.doctor?.fullName || order.orderedBy || 'Unknown',
    status: transformStatus(order.status),
    tests: order.tests
      .filter((test) => test.result || test.status === 'completed')
      .flatMap((test) => {
        if (!test.result?.parameters) return [];
        return test.result.parameters.map((param, idx) => ({
          id: `${test.id}-${idx}`,
          testName: param.name || test.testName,
          result: isNaN(Number(param.value)) ? param.value : Number(param.value),
          units: param.unit,
          referenceRange: param.referenceRange,
          flag: transformFlag(param.flag),
          acknowledged: !!test.result?.verifiedAt,
        }));
      }),
  })).filter((order) => order.tests.length > 0);
};

export default function LabResultsPage() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [acknowledgedTests, setAcknowledgedTests] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);

  // Fetch patients
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', 'lab-results'],
    queryFn: () => patientsService.search({ limit: 100 }),
  });

  // Fetch lab orders for selected patient
  const { data: labOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ['lab-orders', selectedPatientId],
    queryFn: () => labService.orders.list({ patientId: selectedPatientId! }),
    enabled: !!selectedPatientId,
  });

  // Transform API data to local format
  const patients: Patient[] = useMemo(() => {
    if (!patientsData?.data) return [];
    return patientsData.data.map((p) => ({
      id: p.id,
      name: p.fullName,
      mrn: p.mrn,
      pendingResults: 0, // Will be updated when orders are fetched
      orders: [],
    }));
  }, [patientsData]);

  // Auto-select first patient
  useMemo(() => {
    if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  // Transform lab orders to local format
  const orders = useMemo(() => {
    if (!labOrders) return [];
    return transformOrders(labOrders);
  }, [labOrders]);

  // Expand first orders by default when they load
  useMemo(() => {
    if (orders.length > 0 && expandedOrders.size === 0) {
      setExpandedOrders(new Set(orders.slice(0, 2).map((o) => o.id)));
    }
  }, [orders]);

  const selectedPatient = useMemo(() => {
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) return null;
    return {
      ...patient,
      orders,
      pendingResults: orders.reduce(
        (acc, order) => acc + order.tests.filter((t) => !t.acknowledged).length,
        0
      ),
    };
  }, [patients, selectedPatientId, orders]);

  const toggleOrder = (orderId: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleAcknowledge = (testId: string) => {
    setAcknowledgedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const isAcknowledged = (test: LabTest) => test.acknowledged || acknowledgedTests.has(test.id);

  const getFlagColor = (flag: string) => {
    switch (flag) {
      case 'Critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'Low':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-green-100 text-green-700 border-green-300';
    }
  };

  const getResultColor = (flag: string) => {
    switch (flag) {
      case 'Critical':
        return 'text-red-600 font-bold';
      case 'High':
        return 'text-orange-600 font-semibold';
      case 'Low':
        return 'text-yellow-600 font-semibold';
      default:
        return 'text-gray-900';
    }
  };

  const getTrendIcon = (previousResults?: { date: string; value: number }[], currentValue?: number | string) => {
    if (!previousResults || previousResults.length === 0 || typeof currentValue !== 'number') return null;
    const lastValue = previousResults[0].value;
    const diff = currentValue - lastValue;
    const percentChange = Math.abs((diff / lastValue) * 100).toFixed(1);

    if (diff > 0) {
      return (
        <div className="flex items-center gap-1 text-orange-500">
          <ArrowUpRight className="h-4 w-4" />
          <span className="text-xs">+{percentChange}%</span>
        </div>
      );
    } else if (diff < 0) {
      return (
        <div className="flex items-center gap-1 text-blue-500">
          <ArrowDownRight className="h-4 w-4" />
          <span className="text-xs">-{percentChange}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Minus className="h-4 w-4" />
        <span className="text-xs">0%</span>
      </div>
    );
  };

  const renderSparkline = (previousResults: { date: string; value: number }[], currentValue: number) => {
    const allValues = [...previousResults.map((r) => r.value).reverse(), currentValue];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const height = 24;
    const width = 60;
    const points = allValues.map((v, i) => {
      const x = (i / (allValues.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    });

    return (
      <svg width={width} height={height} className="inline-block ml-2">
        <polyline fill="none" stroke="#6366f1" strokeWidth="2" points={points.join(' ')} />
        <circle cx={width} cy={height - ((currentValue - min) / range) * height} r="3" fill="#6366f1" />
      </svg>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FlaskConical className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Lab Results</h1>
              <p className="text-sm text-gray-500">Review and acknowledge laboratory results</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Comparison Toggle */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showComparison ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              {showComparison ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
              <span className="text-sm font-medium">Compare Previous</span>
            </button>

            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              <Download className="h-4 w-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Patient Selector Sidebar */}
        <div className="w-72 bg-white border-r flex-shrink-0 flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              {patientsLoading ? (
                <div className="flex items-center justify-center px-4 py-3 bg-gray-50 border rounded-lg">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading patients...</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border rounded-lg hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-500" />
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{selectedPatient?.name || 'Select Patient'}</p>
                        <p className="text-xs text-gray-500">{selectedPatient?.mrn || ''}</p>
                      </div>
                    </div>
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </button>

                  {patientDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-auto">
                      {patients.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No patients found</div>
                      ) : (
                        patients.map((patient) => (
                          <button
                            key={patient.id}
                            onClick={() => {
                              setSelectedPatientId(patient.id);
                              setPatientDropdownOpen(false);
                              setExpandedOrders(new Set());
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${
                              patient.id === selectedPatientId ? 'bg-indigo-50' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-gray-400" />
                              <div className="text-left">
                                <p className="font-medium text-gray-900">{patient.name}</p>
                                <p className="text-xs text-gray-500">{patient.mrn}</p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Orders List */}
          <div className="flex-1 overflow-auto p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lab Orders</h3>
            {ordersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading orders...</span>
              </div>
            ) : !selectedPatient || selectedPatient.orders.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">No lab orders found</div>
            ) : (
              <div className="space-y-2">
                {selectedPatient.orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => toggleOrder(order.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      expandedOrders.has(order.id)
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{order.orderDate}</span>
                      </div>
                      {expandedOrders.has(order.id) ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{order.tests.length} tests</p>
                    <div className="flex gap-1 mt-2">
                      {order.tests.some((t) => t.flag === 'Critical') && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded">Critical</span>
                      )}
                      {order.tests.some((t) => t.flag === 'High' || t.flag === 'Low') && (
                        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">Abnormal</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="flex-1 overflow-auto p-6">
          {ordersLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Loader2 className="h-12 w-12 animate-spin text-gray-300 mb-3" />
              <p>Loading lab results...</p>
            </div>
          ) : !selectedPatient || selectedPatient.orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <FlaskConical className="h-12 w-12 text-gray-300 mb-3" />
              <p>No results found</p>
            </div>
          ) : (
            <>
              {selectedPatient.orders
                .filter((order) => expandedOrders.has(order.id))
                .map((order) => (
                  <div key={order.id} className="bg-white rounded-xl border shadow-sm mb-6">
                    <div className="px-6 py-4 border-b bg-gray-50 rounded-t-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">Order Date: {order.orderDate}</h3>
                          <p className="text-sm text-gray-500">Ordered by: {order.orderedBy}</p>
                        </div>
                        <span
                          className={`px-3 py-1 text-sm font-medium rounded-full ${
                            order.status === 'Complete'
                              ? 'bg-green-100 text-green-700'
                              : order.status === 'Partial'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y">
                      {order.tests.map((test) => (
                        <div
                          key={test.id}
                          className={`px-6 py-4 ${test.flag === 'Critical' ? 'bg-red-50' : test.flag !== 'Normal' ? 'bg-orange-50/50' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className="font-medium text-gray-900">{test.testName}</h4>
                                <span className={`px-2 py-0.5 text-xs font-medium border rounded ${getFlagColor(test.flag)}`}>
                                  {test.flag}
                                </span>
                                {test.flag === 'Critical' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                              </div>

                              <div className="flex items-center gap-6 mt-2">
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl ${getResultColor(test.flag)}`}>{test.result}</span>
                                  <span className="text-sm text-gray-500">{test.units}</span>
                                  {test.previousResults &&
                                    typeof test.result === 'number' &&
                                    getTrendIcon(test.previousResults, test.result)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Reference: <span className="font-medium">{test.referenceRange}</span>
                                </div>
                              </div>

                              {/* Sparkline for trend */}
                              {showComparison && test.previousResults && typeof test.result === 'number' && (
                                <div className="mt-3 p-3 bg-white rounded-lg border">
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Trend</p>
                                      {renderSparkline(test.previousResults, test.result)}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs text-gray-500 mb-1">Previous Results</p>
                                      <div className="flex gap-4">
                                        {test.previousResults.slice(0, 3).map((prev, idx) => (
                                          <div key={idx} className="text-xs">
                                            <span className="text-gray-400">{prev.date}:</span>{' '}
                                            <span className="font-medium">{prev.value}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Acknowledge Checkbox */}
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleAcknowledge(test.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                  isAcknowledged(test)
                                    ? 'bg-green-100 text-green-700 border border-green-300'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                                }`}
                              >
                                {isAcknowledged(test) ? (
                                  <>
                                    <CheckCheck className="h-4 w-4" />
                                    <span className="text-sm font-medium">Reviewed</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    <span className="text-sm font-medium">Review</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

              {expandedOrders.size === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <FlaskConical className="h-12 w-12 text-gray-300 mb-3" />
                  <p>Select an order to view results</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
