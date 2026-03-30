import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Eye,
  Search,
  Save,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
}

interface VisualFieldTest {
  id: string;
  patientId: string;
  facilityId: string;
  eye: 'od' | 'os';
  testType: 'humphrey' | 'goldmann' | 'confrontation' | 'amsler';
  strategy?: 'sita_standard' | 'sita_fast' | 'full_threshold';
  pattern: '24-2' | '30-2' | '10-2';
  meanDeviation: number;
  patternStandardDeviation: number;
  vfi: number;
  falsePositives: number;
  falseNegatives: number;
  fixationLosses: number;
  interpretation: string;
  notes: string;
  createdAt: string;
}

interface ComparisonData {
  previous: VisualFieldTest | null;
  latest: VisualFieldTest | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_TYPES = [
  { value: 'humphrey', label: 'Humphrey' },
  { value: 'goldmann', label: 'Goldmann' },
  { value: 'confrontation', label: 'Confrontation' },
  { value: 'amsler', label: 'Amsler Grid' },
] as const;

const STRATEGIES = [
  { value: 'sita_standard', label: 'SITA Standard' },
  { value: 'sita_fast', label: 'SITA Fast' },
  { value: 'full_threshold', label: 'Full Threshold' },
] as const;

const PATTERNS = [
  { value: '24-2', label: '24-2' },
  { value: '30-2', label: '30-2' },
  { value: '10-2', label: '10-2' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Reliability = 'reliable' | 'borderline' | 'unreliable';

function getReliability(fp: number, fn: number, fl: number): Reliability {
  if (fp > 33 || fn > 33 || fl > 33) return 'unreliable';
  if (fp >= 15 || fn >= 15 || fl >= 15) return 'borderline';
  return 'reliable';
}

const reliabilityConfig: Record<Reliability, { label: string; className: string }> = {
  reliable: { label: 'Reliable', className: 'bg-green-100 text-green-800' },
  borderline: { label: 'Borderline', className: 'bg-yellow-100 text-yellow-800' },
  unreliable: { label: 'Unreliable', className: 'bg-red-100 text-red-800' },
};

function ReliabilityBadge({ fp, fn, fl }: { fp: number; fn: number; fl: number }) {
  const r = getReliability(fp, fn, fl);
  const cfg = reliabilityConfig[r];
  const Icon = r === 'reliable' ? CheckCircle : r === 'borderline' ? AlertTriangle : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VisualFieldPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  // Patient search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Form state
  const [eye, setEye] = useState<'od' | 'os'>('od');
  const [testType, setTestType] = useState<string>('humphrey');
  const [strategy, setStrategy] = useState<string>('sita_standard');
  const [pattern, setPattern] = useState<string>('24-2');
  const [meanDeviation, setMeanDeviation] = useState<string>('');
  const [psd, setPsd] = useState<string>('');
  const [vfi, setVfi] = useState<string>('');
  const [falsePositives, setFalsePositives] = useState<string>('');
  const [falseNegatives, setFalseNegatives] = useState<string>('');
  const [fixationLosses, setFixationLosses] = useState<string>('');
  const [interpretation, setInterpretation] = useState('');
  const [notes, setNotes] = useState('');

  // Comparison
  const [comparisonEye, setComparisonEye] = useState<'od' | 'os'>('od');

  // ---- Queries ----

  const { data: patientsData } = useQuery({
    queryKey: ['patients', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      const response = await api.get(`/patients?${params}`);
      return response.data;
    },
    enabled: searchTerm.length >= 2,
  });

  const patients: Patient[] = asList<Patient>(patientsData);

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['visual-field-history', selectedPatient?.id, facilityId],
    queryFn: async () => {
      const response = await api.get(`/optical/visual-field/patient/${selectedPatient!.id}`);
      return response.data;
    },
    enabled: !!selectedPatient,
  });

  const history: VisualFieldTest[] = asList<VisualFieldTest>(historyData);

  const { data: comparisonRaw } = useQuery({
    queryKey: ['visual-field-compare', selectedPatient?.id, comparisonEye, facilityId],
    queryFn: async () => {
      const response = await api.get(
        `/optical/visual-field/patient/${selectedPatient!.id}/compare?eye=${comparisonEye}`,
      );
      return response.data as ComparisonData;
    },
    enabled: !!selectedPatient,
  });

  const comparison: ComparisonData | null = comparisonRaw ?? null;

  // ---- Mutation ----

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await api.post('/optical/visual-field', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visual-field-history'] });
      queryClient.invalidateQueries({ queryKey: ['visual-field-compare'] });
      toast.success('Visual field test saved successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to save visual field test'));
    },
  });

  // ---- Handlers ----

  function resetForm() {
    setEye('od');
    setTestType('humphrey');
    setStrategy('sita_standard');
    setPattern('24-2');
    setMeanDeviation('');
    setPsd('');
    setVfi('');
    setFalsePositives('');
    setFalseNegatives('');
    setFixationLosses('');
    setInterpretation('');
    setNotes('');
  }

  function handleSave() {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }

    saveMutation.mutate({
      patientId: selectedPatient.id,
      facilityId,
      eye,
      testType,
      strategy: testType === 'humphrey' ? strategy : undefined,
      pattern,
      meanDeviation: parseFloat(meanDeviation) || 0,
      patternStandardDeviation: parseFloat(psd) || 0,
      vfi: parseFloat(vfi) || 0,
      falsePositives: parseFloat(falsePositives) || 0,
      falseNegatives: parseFloat(falseNegatives) || 0,
      fixationLosses: parseFloat(fixationLosses) || 0,
      interpretation,
      notes,
    });
  }

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setSearchTerm(`${p.firstName} ${p.lastName}`);
    setShowDropdown(false);
  }

  // Inline reliability calc
  const fpNum = parseFloat(falsePositives) || 0;
  const fnNum = parseFloat(falseNegatives) || 0;
  const flNum = parseFloat(fixationLosses) || 0;

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Eye className="w-7 h-7 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Visual Field Testing</h1>
      </div>

      {/* Patient Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          <User className="inline w-5 h-5 mr-2 text-gray-500" />
          Select Patient
        </h3>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search patients by name or MRN..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) setSelectedPatient(null);
            }}
            onFocus={() => setShowDropdown(true)}
            className={`${inputClass} pl-10`}
          />
          {showDropdown && patients.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {patients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPatient(p)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                >
                  <span className="font-medium text-gray-900">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">MRN: {p.mrn}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedPatient && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            Selected: {selectedPatient.firstName} {selectedPatient.lastName} (MRN: {selectedPatient.mrn})
          </div>
        )}
      </div>

      {/* Record Test Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
          <Activity className="inline w-5 h-5 mr-2 text-gray-500" />
          Record Visual Field Test
        </h3>

        <div className="mt-4 space-y-5">
          {/* Eye Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Eye</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setEye('od')}
                className={`px-4 py-2 rounded-l-lg font-medium text-sm transition-colors ${
                  eye === 'od' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                OD (Right)
              </button>
              <button
                type="button"
                onClick={() => setEye('os')}
                className={`px-4 py-2 rounded-r-lg font-medium text-sm transition-colors ${
                  eye === 'os' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                OS (Left)
              </button>
            </div>
          </div>

          {/* Test Type & Strategy & Pattern */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
              <select value={testType} onChange={(e) => setTestType(e.target.value)} className={inputClass}>
                {TEST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {testType === 'humphrey' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strategy</label>
                <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className={inputClass}>
                  {STRATEGIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
              <select value={pattern} onChange={(e) => setPattern(e.target.value)} className={inputClass}>
                {PATTERNS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Inputs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Results</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mean Deviation (dB)</label>
                <input
                  type="number"
                  step="0.1"
                  value={meanDeviation}
                  onChange={(e) => setMeanDeviation(e.target.value)}
                  placeholder="-2.5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pattern Standard Deviation (dB)</label>
                <input
                  type="number"
                  step="0.1"
                  value={psd}
                  onChange={(e) => setPsd(e.target.value)}
                  placeholder="1.8"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">VFI (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={vfi}
                  onChange={(e) => setVfi(e.target.value)}
                  placeholder="98"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">False Positives (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={falsePositives}
                  onChange={(e) => setFalsePositives(e.target.value)}
                  placeholder="5"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">False Negatives (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={falseNegatives}
                  onChange={(e) => setFalseNegatives(e.target.value)}
                  placeholder="3"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fixation Losses (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={fixationLosses}
                  onChange={(e) => setFixationLosses(e.target.value)}
                  placeholder="8"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Reliability Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Reliability:</span>
            <ReliabilityBadge fp={fpNum} fn={fnNum} fl={flNum} />
          </div>

          {/* Interpretation & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interpretation</label>
              <textarea
                value={interpretation}
                onChange={(e) => setInterpretation(e.target.value)}
                rows={3}
                placeholder="Clinical interpretation of results..."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Additional notes..."
                className={inputClass}
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || !selectedPatient}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Test'}
            </button>
          </div>
        </div>
      </div>

      {/* Patient Test History */}
      {selectedPatient && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
            <Clock className="inline w-5 h-5 mr-2 text-gray-500" />
            Test History — {selectedPatient.firstName} {selectedPatient.lastName}
          </h3>

          {historyLoading ? (
            <div className="py-8 text-center text-gray-500">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <Eye className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No visual field tests recorded yet.</p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Eye</th>
                    <th className="pb-2 pr-4">Test Type</th>
                    <th className="pb-2 pr-4">Pattern</th>
                    <th className="pb-2 pr-4">MD (dB)</th>
                    <th className="pb-2 pr-4">PSD (dB)</th>
                    <th className="pb-2 pr-4">VFI (%)</th>
                    <th className="pb-2">Reliability</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((test) => (
                    <tr key={test.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {new Date(test.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            test.eye === 'od' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {test.eye.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 pr-4 capitalize">{test.testType}</td>
                      <td className="py-3 pr-4">{test.pattern}</td>
                      <td className="py-3 pr-4 font-mono">{test.meanDeviation.toFixed(1)}</td>
                      <td className="py-3 pr-4 font-mono">{test.patternStandardDeviation.toFixed(1)}</td>
                      <td className="py-3 pr-4 font-mono">{test.vfi.toFixed(0)}</td>
                      <td className="py-3">
                        <ReliabilityBadge
                          fp={test.falsePositives}
                          fn={test.falseNegatives}
                          fl={test.fixationLosses}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Comparison View */}
      {selectedPatient && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
            <TrendingUp className="inline w-5 h-5 mr-2 text-gray-500" />
            Progression Comparison
          </h3>

          {/* Eye toggle for comparison */}
          <div className="mt-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Compare Eye</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setComparisonEye('od')}
                className={`px-4 py-2 rounded-l-lg font-medium text-sm transition-colors ${
                  comparisonEye === 'od' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                OD (Right)
              </button>
              <button
                type="button"
                onClick={() => setComparisonEye('os')}
                className={`px-4 py-2 rounded-r-lg font-medium text-sm transition-colors ${
                  comparisonEye === 'os' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                OS (Left)
              </button>
            </div>
          </div>

          {!comparison || (!comparison.previous && !comparison.latest) ? (
            <div className="py-8 text-center text-gray-500">
              <Minus className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Not enough tests for comparison. At least 2 tests for the selected eye are needed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Previous Test */}
              <ComparisonCard title="Previous Test" test={comparison.previous} />

              {/* Latest Test */}
              <ComparisonCard title="Latest Test" test={comparison.latest} />

              {/* Trend Summary */}
              {comparison.previous && comparison.latest && (
                <div className="md:col-span-2">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Trends</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <TrendItem
                      label="Mean Deviation"
                      previous={comparison.previous.meanDeviation}
                      latest={comparison.latest.meanDeviation}
                      mode="md"
                    />
                    <TrendItem
                      label="Pattern Std Dev"
                      previous={comparison.previous.patternStandardDeviation}
                      latest={comparison.latest.patternStandardDeviation}
                      mode="psd"
                    />
                    <TrendItem
                      label="VFI"
                      previous={comparison.previous.vfi}
                      latest={comparison.latest.vfi}
                      mode="vfi"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ComparisonCard({ title, test }: { title: string; test: VisualFieldTest | null }) {
  if (!test) {
    return (
      <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400">
        No test data
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <span className="text-xs text-gray-500">{new Date(test.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Mean Deviation</span>
          <span className="font-mono font-medium">{test.meanDeviation.toFixed(1)} dB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Pattern Std Dev</span>
          <span className="font-mono font-medium">{test.patternStandardDeviation.toFixed(1)} dB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">VFI</span>
          <span className="font-mono font-medium">{test.vfi.toFixed(0)}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Reliability</span>
          <ReliabilityBadge fp={test.falsePositives} fn={test.falseNegatives} fl={test.fixationLosses} />
        </div>
      </div>
    </div>
  );
}

function TrendItem({
  label,
  previous,
  latest,
  mode,
}: {
  label: string;
  previous: number;
  latest: number;
  mode: 'md' | 'psd' | 'vfi';
}) {
  // MD: lower (more negative) is worse → latest < previous means worsening
  // PSD: higher is worse → latest > previous means worsening
  // VFI: lower is worse → latest < previous means worsening
  let worsening: boolean;
  if (mode === 'md') {
    worsening = latest < previous;
  } else if (mode === 'psd') {
    worsening = latest > previous;
  } else {
    worsening = latest < previous;
  }

  const isEqual = latest === previous;

  if (isEqual) {
    return (
      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
        <Minus className="w-5 h-5 text-gray-400" />
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-medium text-gray-600">Stable</p>
        </div>
      </div>
    );
  }

  const TrendIcon = worsening ? ArrowDownRight : ArrowUpRight;
  const color = worsening ? 'text-red-600' : 'text-green-600';
  const bg = worsening ? 'bg-red-50' : 'bg-green-50';
  const statusLabel = worsening ? 'Worsening' : 'Improving';

  return (
    <div className={`flex items-center gap-3 ${bg} rounded-lg p-3`}>
      <TrendIcon className={`w-5 h-5 ${color}`} />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-sm font-medium ${color}`}>{statusLabel}</p>
        <p className="text-xs text-gray-400">
          {previous.toFixed(1)} → {latest.toFixed(1)}
        </p>
      </div>
    </div>
  );
}
