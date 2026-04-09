import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
}

type ToothStatus = 'healthy' | 'decayed' | 'filled' | 'missing' | 'crowned' | 'implant' | 'root_canal';

interface SurfaceCondition {
  surface: string;
  condition: string;
}

interface Tooth {
  toothNumber: number;
  status: ToothStatus;
  surfaces: SurfaceCondition[];
  mobilityScore: number;
  notes: string;
}

interface DentalChart {
  id: string;
  patientId: string;
  teeth: Tooth[];
}

const UPPER_TEETH = Array.from({ length: 16 }, (_, i) => i + 1);
const LOWER_TEETH = Array.from({ length: 16 }, (_, i) => 32 - i);

const STATUS_COLORS: Record<ToothStatus, string> = {
  healthy: 'bg-green-100 border-green-400 text-green-800',
  decayed: 'bg-red-100 border-red-400 text-red-800',
  filled: 'bg-blue-100 border-blue-400 text-blue-800',
  missing: 'bg-gray-200 border-gray-400 text-gray-500',
  crowned: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  implant: 'bg-purple-100 border-purple-400 text-purple-800',
  root_canal: 'bg-orange-100 border-orange-400 text-orange-800',
};

const STATUS_OPTIONS: ToothStatus[] = ['healthy', 'decayed', 'filled', 'missing', 'crowned', 'implant', 'root_canal'];
const SURFACES = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual'];
const SURFACE_CONDITIONS = ['normal', 'caries', 'filling', 'fracture', 'erosion'];

export default function DentalChartPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [editTooth, setEditTooth] = useState<Partial<Tooth>>({});

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

  // Fetch chart
  const { data: chart, isLoading: chartLoading } = useQuery<DentalChart | null>({
    queryKey: ['dental-chart', selectedPatient?.id, facilityId],
    queryFn: async () => {
      try {
        const res = await api.get(`/dental/chart/${selectedPatient!.id}`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!selectedPatient,
  });

  const getToothData = useCallback(
    (num: number): Tooth => {
      const found = chart?.teeth?.find((t) => t.toothNumber === num);
      return found ?? { toothNumber: num, status: 'healthy', surfaces: [], mobilityScore: 0, notes: '' };
    },
    [chart],
  );

  // Update tooth
  const updateMutation = useMutation({
    mutationFn: async (data: { chartId: string; toothNumber: number; payload: Partial<Tooth> }) => {
      const res = await api.patch(`/dental/chart/${data.chartId}/tooth/${data.toothNumber}`, data.payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Tooth updated');
      queryClient.invalidateQueries({ queryKey: ['dental-chart', selectedPatient?.id] });
      setSelectedTooth(null);
      setEditTooth({});
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const handleSelectTooth = (num: number) => {
    const data = getToothData(num);
    setSelectedTooth(num);
    setEditTooth({ ...data });
  };

  const handleSurfaceToggle = (surface: string) => {
    const surfaces = editTooth.surfaces ?? [];
    const exists = surfaces.find((s) => s.surface === surface);
    if (exists) {
      setEditTooth({ ...editTooth, surfaces: surfaces.filter((s) => s.surface !== surface) });
    } else {
      setEditTooth({ ...editTooth, surfaces: [...surfaces, { surface, condition: 'normal' }] });
    }
  };

  const handleSurfaceCondition = (surface: string, condition: string) => {
    const surfaces = (editTooth.surfaces ?? []).map((s) =>
      s.surface === surface ? { ...s, condition } : s,
    );
    setEditTooth({ ...editTooth, surfaces });
  };

  const handleSave = () => {
    if (!chart?.id || selectedTooth === null) return;
    updateMutation.mutate({
      chartId: chart.id,
      toothNumber: selectedTooth,
      payload: {
        status: editTooth.status,
        surfaces: editTooth.surfaces,
        mobilityScore: editTooth.mobilityScore,
        notes: editTooth.notes,
      },
    });
  };

  const renderTooth = (num: number) => {
    const data = getToothData(num);
    const isSelected = selectedTooth === num;
    return (
      <button
        key={num}
        onClick={() => handleSelectTooth(num)}
        className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg border-2 text-xs font-medium transition-all hover:scale-105 ${
          STATUS_COLORS[data.status]
        } ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      >
        <span className="text-sm font-bold">{num}</span>
        <span className="truncate text-[9px]">{data.status}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dental Chart</h1>

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
                setSelectedTooth(null);
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
                    {p.dateOfBirth && (
                      <span className="ml-2 text-xs text-gray-400">
                        DOB: {new Date(p.dateOfBirth).toLocaleDateString()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      {selectedPatient && (
        <div className="flex gap-6">
          {/* Tooth Chart */}
          <div className="flex-1">
            {chartLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="rounded-xl border bg-white p-6">
                {/* Legend */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <span
                      key={s}
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${STATUS_COLORS[s]}`}
                    >
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                {/* Upper Arch */}
                <div className="mb-2 text-center text-xs font-semibold text-gray-500">
                  Upper Arch (Right → Left)
                </div>
                <div className="mb-6 flex justify-center gap-1">
                  {UPPER_TEETH.map(renderTooth)}
                </div>

                {/* Divider */}
                <div className="mb-6 border-t-2 border-dashed border-gray-300" />

                {/* Lower Arch */}
                <div className="mb-2 text-center text-xs font-semibold text-gray-500">
                  Lower Arch (Left → Right)
                </div>
                <div className="flex justify-center gap-1">
                  {LOWER_TEETH.map(renderTooth)}
                </div>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          {selectedTooth !== null && (
            <div className="w-80 shrink-0 rounded-xl border bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Tooth #{selectedTooth}</h3>
                <button onClick={() => setSelectedTooth(null)} className="rounded p-1 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Status */}
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={editTooth.status ?? 'healthy'}
                  onChange={(e) => setEditTooth({ ...editTooth, status: e.target.value as ToothStatus })}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Surface Conditions */}
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">Surface Conditions</label>
                <div className="space-y-2">
                  {SURFACES.map((surface) => {
                    const sc = (editTooth.surfaces ?? []).find((s) => s.surface === surface);
                    return (
                      <div key={surface} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!sc}
                          onChange={() => handleSurfaceToggle(surface)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="w-16 text-xs capitalize">{surface}</span>
                        {sc && (
                          <select
                            value={sc.condition}
                            onChange={(e) => handleSurfaceCondition(surface, e.target.value)}
                            className="flex-1 rounded border px-2 py-1 text-xs"
                          >
                            {SURFACE_CONDITIONS.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobility */}
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Mobility Score: {editTooth.mobilityScore ?? 0}
                </label>
                <select
                  value={editTooth.mobilityScore ?? 0}
                  onChange={(e) => setEditTooth({ ...editTooth, mobilityScore: Number(e.target.value) })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value={0}>0 - No mobility</option>
                  <option value={1}>1 - Slight</option>
                  <option value={2}>2 - Moderate</option>
                  <option value={3}>3 - Severe</option>
                </select>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={editTooth.notes ?? ''}
                  onChange={(e) => setEditTooth({ ...editTooth, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Additional notes..."
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending || !chart?.id}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </button>
            </div>
          )}
        </div>
      )}

      {!selectedPatient && (
        <div className="rounded-xl border bg-white py-16 text-center text-gray-500">
          <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-medium">Select a Patient</p>
          <p className="text-sm">Search for a patient above to view their dental chart</p>
        </div>
      )}
    </div>
  );
}
