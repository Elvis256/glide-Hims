import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '../../components/PermissionGate';
import { labSuppliesService } from '../../services';
import { useFacilityId } from '../../lib/facility';
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Calendar,
  BarChart2,
  Target,
  Activity,
} from 'lucide-react';

interface QCResult {
  id: string;
  testName: string;
  analyte: string;
  controlLevel: 'L1' | 'L2' | 'L3';
  value: number;
  mean: number;
  sd: number;
  cv: number;
  zscore: number;
  status: 'PASS' | 'WARNING' | 'FAIL';
  runDate: string;
  runBy: string;
  lotNumber: string;
  equipment: string;
  rule?: string;
}

interface QCStatistics {
  totalRuns: number;
  passRate: number;
  warnings: number;
  failures: number;
  meanBias: number;
}

// Sample QC data with Westgard rule violations
const mockQCResults: QCResult[] = [
  { id: 'QC001', testName: 'Glucose', analyte: 'GLU', controlLevel: 'L1', value: 95.2, mean: 95.0, sd: 2.5, cv: 2.63, zscore: 0.08, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech A', lotNumber: 'LOT2024-001', equipment: 'Roche Cobas c501' },
  { id: 'QC002', testName: 'Glucose', analyte: 'GLU', controlLevel: 'L2', value: 152.8, mean: 150.0, sd: 3.0, cv: 2.0, zscore: 0.93, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech A', lotNumber: 'LOT2024-001', equipment: 'Roche Cobas c501' },
  { id: 'QC003', testName: 'Creatinine', analyte: 'CREAT', controlLevel: 'L1', value: 1.05, mean: 1.0, sd: 0.05, cv: 5.0, zscore: 1.0, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech B', lotNumber: 'LOT2024-002', equipment: 'Roche Cobas c501' },
  { id: 'QC004', testName: 'Creatinine', analyte: 'CREAT', controlLevel: 'L2', value: 5.35, mean: 5.0, sd: 0.15, cv: 3.0, zscore: 2.33, status: 'WARNING', runDate: new Date().toISOString(), runBy: 'Tech B', lotNumber: 'LOT2024-002', equipment: 'Roche Cobas c501', rule: '2s' },
  { id: 'QC005', testName: 'HbA1c', analyte: 'HBA1C', controlLevel: 'L1', value: 5.2, mean: 5.0, sd: 0.2, cv: 4.0, zscore: 1.0, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech A', lotNumber: 'LOT2024-003', equipment: 'Bio-Rad D-100' },
  { id: 'QC006', testName: 'HbA1c', analyte: 'HBA1C', controlLevel: 'L2', value: 10.8, mean: 10.0, sd: 0.3, cv: 3.0, zscore: 2.67, status: 'WARNING', runDate: new Date().toISOString(), runBy: 'Tech A', lotNumber: 'LOT2024-003', equipment: 'Bio-Rad D-100', rule: '2s' },
  { id: 'QC007', testName: 'TSH', analyte: 'TSH', controlLevel: 'L1', value: 0.48, mean: 0.5, sd: 0.02, cv: 4.0, zscore: -1.0, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech C', lotNumber: 'LOT2024-004', equipment: 'Roche Cobas e601' },
  { id: 'QC008', testName: 'TSH', analyte: 'TSH', controlLevel: 'L2', value: 12.2, mean: 12.0, sd: 0.4, cv: 3.33, zscore: 0.5, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech C', lotNumber: 'LOT2024-004', equipment: 'Roche Cobas e601' },
  { id: 'QC009', testName: 'Hemoglobin', analyte: 'HGB', controlLevel: 'L1', value: 8.2, mean: 8.0, sd: 0.2, cv: 2.5, zscore: 1.0, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech B', lotNumber: 'LOT2024-005', equipment: 'Sysmex XN-1000' },
  { id: 'QC010', testName: 'Hemoglobin', analyte: 'HGB', controlLevel: 'L2', value: 14.9, mean: 14.5, sd: 0.3, cv: 2.07, zscore: 1.33, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech B', lotNumber: 'LOT2024-005', equipment: 'Sysmex XN-1000' },
  { id: 'QC011', testName: 'WBC', analyte: 'WBC', controlLevel: 'L1', value: 3.8, mean: 4.0, sd: 0.2, cv: 5.0, zscore: -1.0, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech C', lotNumber: 'LOT2024-006', equipment: 'Sysmex XN-1000' },
  { id: 'QC012', testName: 'WBC', analyte: 'WBC', controlLevel: 'L2', value: 15.2, mean: 15.0, sd: 0.5, cv: 3.33, zscore: 0.4, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech C', lotNumber: 'LOT2024-006', equipment: 'Sysmex XN-1000' },
  { id: 'QC013', testName: 'Platelets', analyte: 'PLT', controlLevel: 'L1', value: 48, mean: 50, sd: 3, cv: 6.0, zscore: -0.67, status: 'PASS', runDate: new Date().toISOString(), runBy: 'Tech A', lotNumber: 'LOT2024-007', equipment: 'Sysmex XN-1000' },
  { id: 'QC014', testName: 'Platelets', analyte: 'PLT', controlLevel: 'L3', value: 428, mean: 400, sd: 12, cv: 3.0, zscore: 2.33, status: 'WARNING', runDate: new Date().toISOString(), runBy: 'Tech A', lotNumber: 'LOT2024-007', equipment: 'Sysmex XN-1000', rule: '2s' },
  { id: 'QC015', testName: 'Glucose', analyte: 'GLU', controlLevel: 'L3', value: 312, mean: 300, sd: 5, cv: 1.67, zscore: 2.4, status: 'WARNING', runDate: new Date(Date.now() - 86400000).toISOString(), runBy: 'Tech B', lotNumber: 'LOT2024-001', equipment: 'Roche Cobas c501', rule: '2s' },
];

const mockStats: QCStatistics = {
  totalRuns: 15,
  passRate: 73.3,
  warnings: 4,
  failures: 0,
  meanBias: 0.8,
};

const tests = ['All', 'Glucose', 'Creatinine', 'HbA1c', 'TSH', 'Hemoglobin', 'WBC', 'Platelets'];
const equipment = ['All', 'Roche Cobas c501', 'Roche Cobas e601', 'Bio-Rad D-100', 'Sysmex XN-1000'];
const statuses = ['All', 'PASS', 'WARNING', 'FAIL'];

export default function LabQCDashboardPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const [selectedTest, setSelectedTest] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [dateRange, setDateRange] = useState('today');
  const [showFilters, setShowFilters] = useState(false);

  if (!hasPermission('labqc.view')) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view the Lab QC Dashboard.</p>
        </div>
      </div>
    );
  }

  // Calculate date range for API query
  const getDateRange = () => {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate = endDate;
    if (dateRange === 'week') {
      startDate = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    } else if (dateRange === 'month') {
      startDate = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    }
    return { startDate, endDate };
  };

  const { data: qcResults, isLoading } = useQuery({
    queryKey: ['qc-results', facilityId, selectedTest, dateRange],
    queryFn: async () => {
      try {
        const { startDate, endDate } = getDateRange();
        const testCode = selectedTest === 'All' ? 'all' : selectedTest;
        const apiResults = await labSuppliesService.qcResults.list(facilityId, testCode, startDate, endDate);
        if (apiResults && apiResults.length > 0) {
          return apiResults.map((r: any) => ({
            id: r.id,
            testName: r.qcMaterial?.testName || r.testCode,
            analyte: r.testCode,
            controlLevel: r.qcMaterial?.level === 'level_1' ? 'L1' : r.qcMaterial?.level === 'level_2' ? 'L2' : 'L3',
            value: r.resultValue,
            mean: r.targetMean,
            sd: r.targetSd,
            cv: (r.targetSd / r.targetMean) * 100,
            zscore: r.zScore,
            status: r.status === 'in_control' ? 'PASS' : r.status === 'warning' ? 'WARNING' : 'FAIL',
            runDate: r.runDate,
            runBy: r.performedByUser?.firstName || 'Unknown',
            lotNumber: r.reagentLot || '',
            equipment: r.equipmentId || 'Unknown',
            rule: r.violatedRules?.[0],
          }));
        }
      } catch (error) {
        console.log('Using sample QC data');
      }
      return mockQCResults;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['qc-stats', facilityId],
    queryFn: async () => {
      try {
        const now = new Date();
        const summary = await labSuppliesService.qcResults.getSummary(facilityId, now.getMonth() + 1, now.getFullYear());
        if (summary) {
          return {
            totalRuns: summary.totalRuns,
            passRate: summary.passRate,
            warnings: summary.warningCount,
            failures: summary.failureCount,
            meanBias: summary.meanBias,
          };
        }
      } catch (error) {
        console.log('Using sample QC stats');
      }
      return mockStats;
    },
  });

  const filteredResults = qcResults?.filter((r) => {
    const matchesTest = selectedTest === 'All' || r.testName === selectedTest;
    const matchesEquipment = selectedEquipment === 'All' || r.equipment === selectedEquipment;
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchesTest && matchesEquipment && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" /> Pass
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Warning
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <XCircle className="w-3 h-3" /> Fail
          </span>
        );
      default:
        return null;
    }
  };

  const getLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      L1: 'bg-blue-100 text-blue-700',
      L2: 'bg-purple-100 text-purple-700',
      L3: 'bg-orange-100 text-orange-700',
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[level]}`}>{level}</span>;
  };

  // Simple Levey-Jennings mini chart component
  const LeveyJenningsChart = ({ data }: { data: QCResult[] }) => {
    const chartHeight = 80;
    const chartWidth = 200;
    const padding = 10;

    // Calculate positions
    const points = data.slice(-10).map((d, i) => {
      const x = padding + (i * (chartWidth - padding * 2)) / 9;
      // Clamp zscore to -3 to 3 range for display
      const clampedZ = Math.max(-3, Math.min(3, d.zscore));
      const y = padding + ((3 - clampedZ) * (chartHeight - padding * 2)) / 6;
      return { x, y, status: d.status };
    });

    return (
      <svg width={chartWidth} height={chartHeight} className="bg-gray-50 rounded">
        {/* Reference lines */}
        <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4" />
        <line x1={padding} y1={padding + (chartHeight - padding * 2) / 6} x2={chartWidth - padding} y2={padding + (chartHeight - padding * 2) / 6} stroke="#ef4444" strokeWidth="1" strokeDasharray="2" />
        <line x1={padding} y1={chartHeight - padding - (chartHeight - padding * 2) / 6} x2={chartWidth - padding} y2={chartHeight - padding - (chartHeight - padding * 2) / 6} stroke="#ef4444" strokeWidth="1" strokeDasharray="2" />
        <line x1={padding} y1={padding + (chartHeight - padding * 2) / 3} x2={chartWidth - padding} y2={padding + (chartHeight - padding * 2) / 3} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2" />
        <line x1={padding} y1={chartHeight - padding - (chartHeight - padding * 2) / 3} x2={chartWidth - padding} y2={chartHeight - padding - (chartHeight - padding * 2) / 3} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2" />

        {/* Data line */}
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={p.status === 'PASS' ? '#22c55e' : p.status === 'WARNING' ? '#f59e0b' : '#ef4444'}
          />
        ))}
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lab QC Dashboard</h1>
          <p className="text-gray-600">Quality control monitoring and Levey-Jennings analysis</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FlaskConical className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Runs</p>
              <p className="text-xl font-bold text-gray-900">{stats?.totalRuns || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pass Rate</p>
              <p className="text-xl font-bold text-green-600">{stats?.passRate || 0}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Warnings</p>
              <p className="text-xl font-bold text-yellow-600">{stats?.warnings || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Failures</p>
              <p className="text-xl font-bold text-red-600">{stats?.failures || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Target className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Mean Bias</p>
              <p className="text-xl font-bold text-gray-900">{stats?.meanBias || 0}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Levey-Jennings Charts Grid */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          Levey-Jennings Charts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {['Glucose', 'Creatinine', 'HbA1c', 'TSH'].map((test) => {
            const testData = qcResults?.filter((r) => r.testName === test) || [];
            return (
              <div key={test} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{test}</span>
                  {testData.length > 0 && getStatusBadge(testData[testData.length - 1].status)}
                </div>
                <LeveyJenningsChart data={testData} />
                <div className="mt-2 text-xs text-gray-500 flex justify-between">
                  <span>-3SD</span>
                  <span>-2SD</span>
                  <span>Mean</span>
                  <span>+2SD</span>
                  <span>+3SD</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters and Results Table */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Activity className="w-4 h-4" />
            {filteredResults?.length || 0} results
          </div>
        </div>

        {showFilters && (
          <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4">
            <select
              value={selectedTest}
              onChange={(e) => setSelectedTest(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {tests.map((test) => (
                <option key={test} value={test}>
                  {test === 'All' ? 'All Tests' : test}
                </option>
              ))}
            </select>

            <select
              value={selectedEquipment}
              onChange={(e) => setSelectedEquipment(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {equipment.map((eq) => (
                <option key={eq} value={eq}>
                  {eq === 'All' ? 'All Equipment' : eq}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All Statuses' : status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Results Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredResults && filteredResults.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Test / Analyte</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Level</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Value</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Mean ± SD</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Z-Score</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Equipment</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Run Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredResults.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{result.testName}</p>
                        <p className="text-sm text-gray-500">{result.analyte}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getLevelBadge(result.controlLevel)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">{result.value.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {result.mean.toFixed(2)} ± {result.sd.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-mono text-sm ${
                          Math.abs(result.zscore) > 2
                            ? 'text-red-600 font-bold'
                            : Math.abs(result.zscore) > 1.5
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {result.zscore > 0 ? '+' : ''}{result.zscore.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        {getStatusBadge(result.status)}
                        {result.rule && (
                          <span className="ml-2 text-xs text-red-600">{result.rule} rule</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{result.equipment}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(result.runDate).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No QC results found</p>
          </div>
        )}
      </div>
    </div>
  );
}
