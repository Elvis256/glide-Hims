import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Search,
  X,
  Save,
  BarChart3,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

interface ToothPerioData {
  toothNumber: number;
  buccalProbeDepths: [number, number, number];
  lingualProbeDepths: [number, number, number];
  buccalRecession: [number, number, number];
  lingualRecession: [number, number, number];
  buccalBleeding: [boolean, boolean, boolean];
  lingualBleeding: [boolean, boolean, boolean];
  buccalSuppuration: [boolean, boolean, boolean];
  lingualSuppuration: [boolean, boolean, boolean];
}

interface PerioChart {
  id: string;
  patientId: string;
  teeth: ToothPerioData[];
  plaqueScore: number;
  bleedingOnProbing: number;
  notes: string;
  createdAt: string;
}

interface CompareResult {
  current: PerioChart;
  previous: PerioChart;
  improved: number;
  worsened: number;
  unchanged: number;
}

const TEETH = Array.from({ length: 32 }, (_, i) => i + 1);

function emptyToothData(num: number): ToothPerioData {
  return {
    toothNumber: num,
    buccalProbeDepths: [0, 0, 0],
    lingualProbeDepths: [0, 0, 0],
    buccalRecession: [0, 0, 0],
    lingualRecession: [0, 0, 0],
    buccalBleeding: [false, false, false],
    lingualBleeding: [false, false, false],
    buccalSuppuration: [false, false, false],
    lingualSuppuration: [false, false, false],
  };
}

function probeColor(depth: number): string {
  if (depth <= 3) return 'bg-green-50 text-green-700 border-green-200';
  if (depth <= 5) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

type ViewMode = 'entry' | 'compare';

export default function PeriodontalChartPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('entry');
  const [chartData, setChartData] = useState<ToothPerioData[]>(TEETH.map(emptyToothData));
  const [chartNotes, setChartNotes] = useState('');

  // Patient search
  const { data: searchResults, isLoading: searching } = useQuery<Patient[]>({
    queryKey: ['patient-search', patientSearch, facilityId],
    queryFn: async () => {
      if (patientSearch.length < 2) return [];
      const res = await api.get('/patients/search', { params: { query: patientSearch } });
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
    enabled: patientSearch.length >= 2 && !selectedPatient,
  });

  // Chart history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['perio-history', selectedPatient?.id, facilityId],
    queryFn: async () => {
      const res = await api.get(`/dental/perio/charts/patient/${selectedPatient!.id}`);
      return res.data;
    },
    enabled: !!selectedPatient,
  });

  // Compare
  const { data: compareData, isLoading: compareLoading } = useQuery<CompareResult | null>({
    queryKey: ['perio-compare', selectedPatient?.id, facilityId],
    queryFn: async () => {
      try {
        const res = await api.get(`/dental/perio/charts/patient/${selectedPatient!.id}/compare`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!selectedPatient && viewMode === 'compare',
  });

  const history = asList<PerioChart>(historyData);

  // Save chart
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/dental/perio/charts', {
        patientId: selectedPatient!.id,
        teeth: chartData,
        notes: chartNotes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Periodontal chart saved');
      queryClient.invalidateQueries({ queryKey: ['perio-history', selectedPatient?.id] });
      setChartData(TEETH.map(emptyToothData));
      setChartNotes('');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateToothField = (
    toothIdx: number,
    field: keyof ToothPerioData,
    siteIdx: number,
    value: number | boolean,
  ) => {
    setChartData((prev) => {
      const updated = [...prev];
      const tooth = { ...updated[toothIdx] };
      const arr = [...(tooth[field] as (number | boolean)[])];
      arr[siteIdx] = value;
      (tooth[field] as (number | boolean)[]) = arr as never;
      updated[toothIdx] = tooth;
      return updated;
    });
  };

  // Compute scores
  const scores = useMemo(() => {
    let totalSites = 0;
    let bleedingSites = 0;
    chartData.forEach((t) => {
      for (let i = 0; i < 3; i++) {
        totalSites += 2; // buccal + lingual
        if (t.buccalBleeding[i]) bleedingSites++;
        if (t.lingualBleeding[i]) bleedingSites++;
      }
    });
    const bop = totalSites > 0 ? Math.round((bleedingSites / totalSites) * 100) : 0;
    return { bop, totalSites, bleedingSites };
  }, [chartData]);

  const loadChart = (chart: PerioChart) => {
    setChartData(
      TEETH.map((num) => {
        const found = chart.teeth.find((t) => t.toothNumber === num);
        return found ?? emptyToothData(num);
      }),
    );
    setChartNotes(chart.notes);
    setViewMode('entry');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Periodontal Chart</h1>
        {selectedPatient && (
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('entry')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                viewMode === 'entry'
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Data Entry
            </button>
            <button
              onClick={() => setViewMode('compare')}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                viewMode === 'compare'
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Comparison
            </button>
          </div>
        )}
      </div>

      {/* Patient Selector */}
      <div className="relative max-w-md">
        {selectedPatient ? (
          <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2">
            <span className="font-medium">
              {selectedPatient.firstName} {selectedPatient.lastName}
            </span>
            <button
              onClick={() => {
                setSelectedPatient(null);
                setPatientSearch('');
                setChartData(TEETH.map(emptyToothData));
                setViewMode('entry');
              }}
              className="ml-auto rounded p-1 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full rounded-lg border bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-gray-400" />}
            {searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatient(p);
                      setPatientSearch('');
                    }}
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {p.firstName} {p.lastName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!selectedPatient && (
        <div className="rounded-xl border bg-white py-16 text-center text-gray-500">
          <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-medium">Select a Patient</p>
          <p className="text-sm">Search for a patient to chart periodontal data</p>
        </div>
      )}

      {/* Data Entry Mode */}
      {selectedPatient && viewMode === 'entry' && (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-500">
                  <th className="sticky left-0 bg-gray-50 px-2 py-2 text-left">Tooth</th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center">Buccal PD</th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center">Lingual PD</th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center">Buccal Rec</th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center">Lingual Rec</th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center">BOP (B)</th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center">BOP (L)</th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center">Supp (B)</th>
                  <th colSpan={3} className="border-l px-2 py-1 text-center">Supp (L)</th>
                </tr>
              </thead>
              <tbody>
                {chartData.map((tooth, idx) => (
                  <tr key={tooth.toothNumber} className="border-b hover:bg-gray-50/50">
                    <td className="sticky left-0 bg-white px-2 py-1 font-medium">
                      {tooth.toothNumber}
                    </td>
                    {/* Buccal Probe Depths */}
                    {[0, 1, 2].map((s) => (
                      <td key={`bpd-${s}`} className={`border-l px-0.5 py-0.5 ${s === 0 ? 'border-l' : ''}`}>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={tooth.buccalProbeDepths[s]}
                          onChange={(e) => updateToothField(idx, 'buccalProbeDepths', s, Number(e.target.value))}
                          className={`w-10 rounded border px-1 py-0.5 text-center ${probeColor(tooth.buccalProbeDepths[s])}`}
                        />
                      </td>
                    ))}
                    {/* Lingual Probe Depths */}
                    {[0, 1, 2].map((s) => (
                      <td key={`lpd-${s}`} className={`px-0.5 py-0.5 ${s === 0 ? 'border-l' : ''}`}>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={tooth.lingualProbeDepths[s]}
                          onChange={(e) => updateToothField(idx, 'lingualProbeDepths', s, Number(e.target.value))}
                          className={`w-10 rounded border px-1 py-0.5 text-center ${probeColor(tooth.lingualProbeDepths[s])}`}
                        />
                      </td>
                    ))}
                    {/* Buccal Recession */}
                    {[0, 1, 2].map((s) => (
                      <td key={`brec-${s}`} className={`px-0.5 py-0.5 ${s === 0 ? 'border-l' : ''}`}>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={tooth.buccalRecession[s]}
                          onChange={(e) => updateToothField(idx, 'buccalRecession', s, Number(e.target.value))}
                          className="w-10 rounded border px-1 py-0.5 text-center"
                        />
                      </td>
                    ))}
                    {/* Lingual Recession */}
                    {[0, 1, 2].map((s) => (
                      <td key={`lrec-${s}`} className={`px-0.5 py-0.5 ${s === 0 ? 'border-l' : ''}`}>
                        <input
                          type="number"
                          min={0}
                          max={15}
                          value={tooth.lingualRecession[s]}
                          onChange={(e) => updateToothField(idx, 'lingualRecession', s, Number(e.target.value))}
                          className="w-10 rounded border px-1 py-0.5 text-center"
                        />
                      </td>
                    ))}
                    {/* Buccal Bleeding */}
                    {[0, 1, 2].map((s) => (
                      <td key={`bb-${s}`} className={`px-0.5 py-0.5 text-center ${s === 0 ? 'border-l' : ''}`}>
                        <input
                          type="checkbox"
                          checked={tooth.buccalBleeding[s]}
                          onChange={(e) => updateToothField(idx, 'buccalBleeding', s, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-red-600"
                        />
                      </td>
                    ))}
                    {/* Lingual Bleeding */}
                    {[0, 1, 2].map((s) => (
                      <td key={`lb-${s}`} className={`px-0.5 py-0.5 text-center ${s === 0 ? 'border-l' : ''}`}>
                        <input
                          type="checkbox"
                          checked={tooth.lingualBleeding[s]}
                          onChange={(e) => updateToothField(idx, 'lingualBleeding', s, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-red-600"
                        />
                      </td>
                    ))}
                    {/* Buccal Suppuration */}
                    {[0, 1, 2].map((s) => (
                      <td key={`bs-${s}`} className={`px-0.5 py-0.5 text-center ${s === 0 ? 'border-l' : ''}`}>
                        <input
                          type="checkbox"
                          checked={tooth.buccalSuppuration[s]}
                          onChange={(e) => updateToothField(idx, 'buccalSuppuration', s, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-amber-600"
                        />
                      </td>
                    ))}
                    {/* Lingual Suppuration */}
                    {[0, 1, 2].map((s) => (
                      <td key={`ls-${s}`} className={`px-0.5 py-0.5 text-center ${s === 0 ? 'border-l' : ''}`}>
                        <input
                          type="checkbox"
                          checked={tooth.lingualSuppuration[s]}
                          onChange={(e) => updateToothField(idx, 'lingualSuppuration', s, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-amber-600"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Scores */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-xs text-gray-500">Bleeding on Probing</p>
              <p className={`text-2xl font-bold ${scores.bop > 30 ? 'text-red-600' : scores.bop > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                {scores.bop}%
              </p>
              <p className="text-xs text-gray-400">{scores.bleedingSites} / {scores.totalSites} sites</p>
            </div>
          </div>

          {/* Notes & Save */}
          <div className="rounded-xl border bg-white p-6">
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={chartNotes}
              onChange={(e) => setChartNotes(e.target.value)}
              rows={2}
              className="mb-4 w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Clinical notes..."
            />
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Chart
            </button>
          </div>
        </>
      )}

      {/* Comparison Mode */}
      {selectedPatient && viewMode === 'compare' && (
        <div className="rounded-xl border bg-white p-6">
          {compareLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !compareData ? (
            <div className="py-16 text-center text-gray-500">
              <BarChart3 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p>Need at least 2 charts to compare</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-green-50 p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{compareData.improved}</p>
                  <p className="text-xs text-green-600">Improved Sites</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{compareData.worsened}</p>
                  <p className="text-xs text-red-600">Worsened Sites</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-700">{compareData.unchanged}</p>
                  <p className="text-xs text-gray-600">Unchanged Sites</p>
                </div>
              </div>

              {/* Side by side dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 text-sm font-semibold">
                    Previous ({new Date(compareData.previous.createdAt).toLocaleDateString()})
                  </h4>
                  <div className="text-sm text-gray-600">
                    BOP: {compareData.previous.bleedingOnProbing}%
                    {compareData.previous.plaqueScore > 0 && ` · Plaque: ${compareData.previous.plaqueScore}%`}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="mb-2 text-sm font-semibold">
                    Current ({new Date(compareData.current.createdAt).toLocaleDateString()})
                  </h4>
                  <div className="text-sm text-gray-600">
                    BOP: {compareData.current.bleedingOnProbing}%
                    {compareData.current.plaqueScore > 0 && ` · Plaque: ${compareData.current.plaqueScore}%`}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Chart History */}
      {selectedPatient && (
        <div className="rounded-xl border bg-white">
          <div className="border-b px-6 py-4">
            <h3 className="font-semibold">Chart History</h3>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">No previous charts</div>
          ) : (
            <div className="divide-y">
              {history.map((chart) => (
                <div key={chart.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(chart.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      BOP: {chart.bleedingOnProbing}%
                      {chart.plaqueScore > 0 && ` · Plaque: ${chart.plaqueScore}%`}
                    </p>
                  </div>
                  <button
                    onClick={() => loadChart(chart)}
                    className="rounded-lg border px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
