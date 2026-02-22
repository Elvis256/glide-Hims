import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { labSuppliesService, labService } from '../../services';
import { useFacilityId } from '../../lib/facility';
import { useAuthStore } from '../../store/auth';
import {
  FlaskConical,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
  Loader2,
  BarChart2,
  Target,
  Activity,
  Download,
  Plus,
  X,
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



const statuses = ['All', 'PASS', 'WARNING', 'FAIL'];

interface NewQCRunForm {
  testName: string;
  analyte: string;
  controlLevel: 'L1' | 'L2' | 'L3';
  measuredValue: string;
  expectedMean: string;
  standardDeviation: string;
  lotNumber: string;
  equipment: string;
  runDate: string;
  runBy: string;
}

const EMPTY_FORM: NewQCRunForm = {
  testName: '',
  analyte: '',
  controlLevel: 'L1',
  measuredValue: '',
  expectedMean: '',
  standardDeviation: '',
  lotNumber: '',
  equipment: '',
  runDate: new Date().toISOString().split('T')[0],
  runBy: '',
};

function calcZScore(value: string, mean: string, sd: string): number | null {
  const v = parseFloat(value), m = parseFloat(mean), s = parseFloat(sd);
  if (isNaN(v) || isNaN(m) || isNaN(s) || s === 0) return null;
  return (v - m) / s;
}

function zScoreStatus(z: number): 'PASS' | 'WARNING' | 'FAIL' {
  const abs = Math.abs(z);
  if (abs <= 2) return 'PASS';
  if (abs <= 3) return 'WARNING';
  return 'FAIL';
}

interface NewQCRunModalProps {
  open: boolean;
  onClose: () => void;
  testOptions: string[];
  defaultRunBy: string;
  onSuccess: () => void;
}

function NewQCRunModal({ open, onClose, testOptions, defaultRunBy, onSuccess }: NewQCRunModalProps) {
  const [form, setForm] = useState<NewQCRunForm>({ ...EMPTY_FORM, runBy: defaultRunBy });
  const [submitting, setSubmitting] = useState(false);

  const zscore = useMemo(
    () => calcZScore(form.measuredValue, form.expectedMean, form.standardDeviation),
    [form.measuredValue, form.expectedMean, form.standardDeviation]
  );
  const status = zscore !== null ? zScoreStatus(zscore) : null;

  const set = (field: keyof NewQCRunForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (zscore === null) { toast.error('Please fill in valid numeric values for Value, Mean, and SD'); return; }
    setSubmitting(true);
    try {
      const payload = {
        testName: form.testName,
        analyte: form.analyte,
        controlLevel: form.controlLevel,
        measuredValue: parseFloat(form.measuredValue),
        expectedMean: parseFloat(form.expectedMean),
        standardDeviation: parseFloat(form.standardDeviation),
        zscore,
        status,
        lotNumber: form.lotNumber,
        equipment: form.equipment,
        runDate: form.runDate,
        runBy: form.runBy,
      };
      const svc = labService as any;
      if (svc.qc?.addRun) {
        await svc.qc.addRun(payload);
      }
      toast.success('QC run recorded successfully');
      setForm({ ...EMPTY_FORM, runBy: defaultRunBy });
      onSuccess();
      onClose();
    } catch {
      toast.error('Failed to record QC run');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const statusColors = {
    PASS: 'bg-green-100 text-green-700 border-green-200',
    WARNING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    FAIL: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-blue-600" />
            New QC Run
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Test Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Name <span className="text-red-500">*</span></label>
              {testOptions.filter(t => t !== 'All').length > 0 ? (
                <select
                  value={form.testName}
                  onChange={(e) => set('testName', e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Select test...</option>
                  {testOptions.filter(t => t !== 'All').map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.testName}
                  onChange={(e) => set('testName', e.target.value)}
                  required
                  placeholder="e.g. Glucose"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Analyte <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.analyte}
                onChange={(e) => set('analyte', e.target.value)}
                required
                placeholder="e.g. GLU"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Control Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Control Level <span className="text-red-500">*</span></label>
            <select
              value={form.controlLevel}
              onChange={(e) => set('controlLevel', e.target.value as 'L1' | 'L2' | 'L3')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="L1">L1 – Low</option>
              <option value="L2">L2 – Normal</option>
              <option value="L3">L3 – High</option>
            </select>
          </div>

          {/* Measured Value / Mean / SD */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Measured Value <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="any"
                value={form.measuredValue}
                onChange={(e) => set('measuredValue', e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Mean <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="any"
                value={form.expectedMean}
                onChange={(e) => set('expectedMean', e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Std. Deviation <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="any"
                value={form.standardDeviation}
                onChange={(e) => set('standardDeviation', e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Z-Score Preview */}
          {zscore !== null && status !== null && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium ${statusColors[status]}`}>
              <span>Z-Score: <strong>{zscore > 0 ? '+' : ''}{zscore.toFixed(3)}</strong></span>
              <span className="mx-2">·</span>
              <span>Status: <strong>{status}</strong></span>
              {status === 'PASS' && <CheckCircle className="w-4 h-4 ml-auto" />}
              {status === 'WARNING' && <AlertTriangle className="w-4 h-4 ml-auto" />}
              {status === 'FAIL' && <XCircle className="w-4 h-4 ml-auto" />}
            </div>
          )}

          {/* Lot Number / Equipment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
              <input
                type="text"
                value={form.lotNumber}
                onChange={(e) => set('lotNumber', e.target.value)}
                placeholder="Reagent lot #"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Equipment / Analyzer</label>
              <input
                type="text"
                value={form.equipment}
                onChange={(e) => set('equipment', e.target.value)}
                placeholder="Analyzer name/ID"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Run Date / Run By */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Run Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.runDate}
                onChange={(e) => set('runDate', e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Run By</label>
              <input
                type="text"
                value={form.runBy}
                onChange={(e) => set('runBy', e.target.value)}
                placeholder="Operator name"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Record QC Run
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Returns array of violated Westgard rules
function detectWestgardViolations(dataPoints: { zScore: number }[]): string[] {
  const violations: string[] = [];
  const z = dataPoints.map(d => d.zScore);
  const n = z.length;

  // 1-3s: any single point beyond ±3SD — rejection rule
  if (z.some(v => Math.abs(v) > 3)) violations.push('1-3s: Point beyond ±3SD (REJECT)');

  // 2-2s: two consecutive points beyond same 2SD — warning
  for (let i = 1; i < n; i++) {
    if (z[i] > 2 && z[i - 1] > 2) violations.push('2-2s: Two consecutive >+2SD');
    if (z[i] < -2 && z[i - 1] < -2) violations.push('2-2s: Two consecutive <-2SD');
  }

  // R-4s: range between two consecutive points > 4SD
  for (let i = 1; i < n; i++) {
    if (Math.abs(z[i] - z[i - 1]) > 4) violations.push('R-4s: Range between consecutive points >4SD');
  }

  // 4-1s: four consecutive points beyond ±1SD on same side
  for (let i = 3; i < n; i++) {
    if (z[i] > 1 && z[i - 1] > 1 && z[i - 2] > 1 && z[i - 3] > 1) violations.push('4-1s: Four consecutive >+1SD');
    if (z[i] < -1 && z[i - 1] < -1 && z[i - 2] < -1 && z[i - 3] < -1) violations.push('4-1s: Four consecutive <-1SD');
  }

  // 10x: ten consecutive points on same side of mean
  if (n >= 10) {
    const last10 = z.slice(-10);
    if (last10.every(v => v > 0)) violations.push('10x: Ten consecutive points above mean');
    if (last10.every(v => v < 0)) violations.push('10x: Ten consecutive points below mean');
  }

  return violations;
}

export default function LabQCDashboardPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [selectedTest, setSelectedTest] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [dateRange, setDateRange] = useState('today');
  const [showFilters, setShowFilters] = useState(false);
  const [showNewRunModal, setShowNewRunModal] = useState(false);

  if (!hasPermission('labqc.view')) {
    return <AccessDenied />;
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

  // Fetch tests from API
  const { data: testsData = [] } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: async () => {
      try { return await labService.tests.list({ status: 'active' }); } catch { return []; }
    },
  });

  // Fetch equipment from API
  const { data: equipmentData = [] } = useQuery({
    queryKey: ['lab-equipment', facilityId],
    queryFn: async () => {
      try { return await labSuppliesService.equipment.list(facilityId); } catch { return []; }
    },
  });

  const testOptions = ['All', ...testsData.map((t: any) => t.name || t.code).filter(Boolean)];
  const equipmentOptions = ['All', ...equipmentData.map((e: any) => e.name).filter(Boolean)];

  const { data: qcResults, isLoading } = useQuery({
    queryKey: ['qc-results', facilityId, selectedTest, dateRange],
    queryFn: async (): Promise<QCResult[]> => {
      try {
        const { startDate, endDate } = getDateRange();
        const testCode = selectedTest === 'All' ? 'all' : selectedTest;
        const apiResults = await labSuppliesService.qcResults.list(facilityId, testCode, startDate, endDate);
        if (apiResults && apiResults.length > 0) {
          return apiResults.map((r: any): QCResult => ({
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
        console.error('Failed to load QC results:', error);
      }
      return [];
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
        console.error('Failed to load QC stats:', error);
      }
      return { totalRuns: 0, passRate: 0, warnings: 0, failures: 0, meanBias: 0 };
    },
  });

  const filteredResults = qcResults?.filter((r) => {
    const matchesTest = selectedTest === 'All' || r.testName === selectedTest;
    const matchesEquipment = selectedEquipment === 'All' || r.equipment === selectedEquipment;
    const matchesStatus = selectedStatus === 'All' || r.status === selectedStatus;
    return matchesTest && matchesEquipment && matchesStatus;
  });

  // Unique test names from QC results for LJ charts (up to 8)
  const ljTestNames = Array.from(new Set(qcResults?.map(r => r.testName) || [])).slice(0, 8);

  // Westgard summary: count tests passing all rules
  const westgardSummary = ljTestNames.reduce(
    (acc, testName) => {
      const testData = qcResults?.filter(r => r.testName === testName) || [];
      const violations = detectWestgardViolations(testData.map(d => ({ zScore: d.zscore })));
      violations.length === 0 ? acc.passed++ : acc.failed++;
      return acc;
    },
    { passed: 0, failed: 0 }
  );

  const handleExportCSV = () => {
    const results = filteredResults || [];
    if (results.length === 0) return;
    const header = ['Test Name', 'Analyte', 'Level', 'Value', 'Mean', 'SD', 'Z-Score', 'Status', 'Equipment', 'Run Date', 'Run By'];
    const rows = results.map(r => [
      r.testName, r.analyte, r.controlLevel, r.value.toFixed(2), r.mean.toFixed(2),
      r.sd.toFixed(2), r.zscore.toFixed(2), r.status, r.equipment,
      new Date(r.runDate).toLocaleString(), r.runBy,
    ]);
    const csv = [header, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qc-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  // Levey-Jennings mini chart with Westgard violations display
  const LeveyJenningsChart = ({ data }: { data: QCResult[] }) => {
    const chartHeight = 80;
    const chartWidth = 200;
    const padding = 10;

    const last10 = data.slice(-10);
    const points = last10.map((d, i) => {
      const x = padding + (i * (chartWidth - padding * 2)) / Math.max(last10.length - 1, 1);
      const clampedZ = Math.max(-3, Math.min(3, d.zscore));
      const y = padding + ((3 - clampedZ) * (chartHeight - padding * 2)) / 6;
      return { x, y, status: d.status };
    });

    const violations = detectWestgardViolations(last10.map(d => ({ zScore: d.zscore })));

    return (
      <div>
        <svg width={chartWidth} height={chartHeight} className="bg-gray-50 rounded">
          <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4" />
          <line x1={padding} y1={padding + (chartHeight - padding * 2) / 6} x2={chartWidth - padding} y2={padding + (chartHeight - padding * 2) / 6} stroke="#ef4444" strokeWidth="1" strokeDasharray="2" />
          <line x1={padding} y1={chartHeight - padding - (chartHeight - padding * 2) / 6} x2={chartWidth - padding} y2={chartHeight - padding - (chartHeight - padding * 2) / 6} stroke="#ef4444" strokeWidth="1" strokeDasharray="2" />
          <line x1={padding} y1={padding + (chartHeight - padding * 2) / 3} x2={chartWidth - padding} y2={padding + (chartHeight - padding * 2) / 3} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2" />
          <line x1={padding} y1={chartHeight - padding - (chartHeight - padding * 2) / 3} x2={chartWidth - padding} y2={chartHeight - padding - (chartHeight - padding * 2) / 3} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2" />
          <polyline points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="2" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill={p.status === 'PASS' ? '#22c55e' : p.status === 'WARNING' ? '#f59e0b' : '#ef4444'} />
          ))}
        </svg>
        {/* Westgard violation badges */}
        <div className="mt-2 flex flex-wrap gap-1">
          {violations.length === 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
              <CheckCircle className="w-3 h-3" /> All rules passed ✓
            </span>
          ) : (
            violations.map((v, i) => {
              const isRejection = v.startsWith('1-3s') || v.startsWith('R-4s');
              return (
                <span key={i} className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${isRejection ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  {v}
                </span>
              );
            })
          )}
        </div>
      </div>
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewRunModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            New QC Run
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700"
          >
            <Download className="w-4 h-4" />
            Export QC Data
          </button>
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

      {/* Westgard Summary Card */}
      {ljTestNames.length > 0 && (
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Westgard Rules Summary (Today)</p>
            <p className="text-lg font-bold text-gray-900">
              {westgardSummary.passed} of {ljTestNames.length} tests passed all Westgard rules
            </p>
          </div>
          {westgardSummary.failed > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              <AlertTriangle className="w-4 h-4" /> {westgardSummary.failed} test{westgardSummary.failed > 1 ? 's' : ''} with violations
            </span>
          )}
        </div>
      )}

      {/* Levey-Jennings Charts Grid */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-blue-600" />
          Levey-Jennings Charts
        </h2>
        {ljTestNames.length === 0 ? (
          <p className="text-gray-500 text-sm">No QC data available. Run QC tests to see charts.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ljTestNames.map((test) => {
              const testData = qcResults?.filter((r) => r.testName === test) || [];
              return (
                <div key={test} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{test}</span>
                    {testData.length > 0 && getStatusBadge(testData[testData.length - 1].status)}
                  </div>
                  <LeveyJenningsChart data={testData} />
                  <div className="mt-1 text-xs text-gray-500 flex justify-between">
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
        )}
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
              {testOptions.map((test) => (
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
              {equipmentOptions.map((eq) => (
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

      <NewQCRunModal
        open={showNewRunModal}
        onClose={() => setShowNewRunModal(false)}
        testOptions={testOptions}
        defaultRunBy={user?.fullName || user?.username || ''}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['qc-results'] });
          queryClient.invalidateQueries({ queryKey: ['qc-stats'] });
        }}
      />
    </div>
  );
}
