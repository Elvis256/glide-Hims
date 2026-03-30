import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Activity,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface Adjustment {
  id: string;
  notes: string;
  currentAligner: number | null;
  nextAppointmentDate: string | null;
  createdAt: string;
}

interface OrthoCase {
  id: string;
  patientId: string;
  patientName: string;
  applianceType: string;
  malocclusion: string;
  startDate: string;
  estimatedEndDate: string | null;
  status: string;
  currentAligner: number | null;
  totalAligners: number | null;
  notes: string;
  adjustments: Adjustment[];
}

const STATUS_TABS = ['All', 'Planning', 'Active', 'Retention', 'Completed'];
const STATUS_MAP: Record<string, string> = {
  All: '',
  Planning: 'planning',
  Active: 'active',
  Retention: 'retention',
  Completed: 'completed',
};

const APPLIANCE_TYPES = [
  'metal_braces',
  'ceramic_braces',
  'lingual_braces',
  'clear_aligners',
  'retainer',
  'palatal_expander',
  'headgear',
  'other',
];

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  retention: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
};

export default function OrthodonticCasesPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('All');
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // New case form
  const [applianceType, setApplianceType] = useState('clear_aligners');
  const [malocclusion, setMalocclusion] = useState('');
  const [startDate, setStartDate] = useState('');
  const [estimatedEndDate, setEstimatedEndDate] = useState('');
  const [totalAligners, setTotalAligners] = useState(0);
  const [caseNotes, setCaseNotes] = useState('');

  // Adjustment form
  const [adjNotes, setAdjNotes] = useState('');
  const [adjNextDate, setAdjNextDate] = useState('');
  const [adjCurrentAligner, setAdjCurrentAligner] = useState(0);

  // Cases query
  const { data: casesData, isLoading } = useQuery({
    queryKey: ['ortho-cases', activeTab, facilityId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      const status = STATUS_MAP[activeTab];
      if (status) params.status = status;
      const res = await api.get('/dental/ortho/cases', { params });
      return res.data;
    },
  });

  // Patient search
  const { data: patientResults } = useQuery<Patient[]>({
    queryKey: ['patient-search-ortho', patientSearch, facilityId],
    queryFn: async () => {
      if (patientSearch.length < 2) return [];
      const res = await api.get('/patients/search', { params: { query: patientSearch } });
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
    enabled: patientSearch.length >= 2 && !selectedPatient,
  });

  // Case detail
  const { data: caseDetailData } = useQuery({
    queryKey: ['ortho-case-detail', expandedCase, facilityId],
    queryFn: async () => {
      const res = await api.get(`/dental/ortho/cases/${expandedCase}`);
      return res.data;
    },
    enabled: !!expandedCase,
  });

  const cases = asList<OrthoCase>(casesData);
  const caseDetail = caseDetailData as OrthoCase | undefined;

  // Create case
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/dental/ortho/cases', {
        patientId: selectedPatient!.id,
        applianceType,
        malocclusion,
        startDate: startDate || null,
        estimatedEndDate: estimatedEndDate || null,
        totalAligners: totalAligners || null,
        notes: caseNotes,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Orthodontic case created');
      queryClient.invalidateQueries({ queryKey: ['ortho-cases'] });
      closeCreate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // Record adjustment
  const adjustmentMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const res = await api.post(`/dental/ortho/cases/${caseId}/adjustment`, {
        notes: adjNotes,
        currentAligner: adjCurrentAligner || null,
        nextAppointmentDate: adjNextDate || null,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Adjustment recorded');
      queryClient.invalidateQueries({ queryKey: ['ortho-case-detail', showAdjustment] });
      queryClient.invalidateQueries({ queryKey: ['ortho-cases'] });
      setShowAdjustment(null);
      setAdjNotes('');
      setAdjNextDate('');
      setAdjCurrentAligner(0);
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const closeCreate = () => {
    setShowCreate(false);
    setSelectedPatient(null);
    setPatientSearch('');
    setApplianceType('clear_aligners');
    setMalocclusion('');
    setStartDate('');
    setEstimatedEndDate('');
    setTotalAligners(0);
    setCaseNotes('');
  };

  const getAlignerProgress = (c: OrthoCase) => {
    if (!c.totalAligners || !c.currentAligner) return 0;
    return Math.round((c.currentAligner / c.totalAligners) * 100);
  };

  const getDurationProgress = (c: OrthoCase) => {
    if (!c.startDate || !c.estimatedEndDate) return 0;
    const start = new Date(c.startDate).getTime();
    const end = new Date(c.estimatedEndDate).getTime();
    const now = Date.now();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return Math.round(((now - start) / (end - start)) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orthodontic Cases</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Case
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-white p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Cases List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center text-gray-500">
          <Activity className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p>No orthodontic cases found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => {
            const isExpanded = expandedCase === c.id;
            const detail = isExpanded ? caseDetail : c;
            const alignerProgress = getAlignerProgress(c);
            const durationProgress = getDurationProgress(c);

            return (
              <div key={c.id} className="rounded-xl border bg-white">
                {/* Row Header */}
                <button
                  onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-semibold">{c.patientName}</p>
                      <p className="text-xs text-gray-500">
                        {c.applianceType.replace(/_/g, ' ')} · {c.malocclusion}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {c.totalAligners && c.currentAligner != null && (
                      <span className="text-xs text-gray-500">
                        Aligner {c.currentAligner}/{c.totalAligners}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Started {new Date(c.startDate).toLocaleDateString()}
                    </span>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && detail && (
                  <div className="border-t px-6 py-4">
                    {/* Case Info */}
                    <div className="mb-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-gray-500">Appliance Type</p>
                        <p className="font-medium capitalize">{detail.applianceType.replace(/_/g, ' ')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Malocclusion</p>
                        <p className="font-medium">{detail.malocclusion || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Start Date</p>
                        <p className="font-medium">{new Date(detail.startDate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Est. End Date</p>
                        <p className="font-medium">
                          {detail.estimatedEndDate
                            ? new Date(detail.estimatedEndDate).toLocaleDateString()
                            : '-'}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bars */}
                    {detail.totalAligners != null && detail.totalAligners > 0 && (
                      <div className="mb-4">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            Aligner Progress ({detail.currentAligner ?? 0}/{detail.totalAligners})
                          </span>
                          <span className="font-medium">{alignerProgress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${alignerProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {detail.estimatedEndDate && (
                      <div className="mb-4">
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-gray-500">Treatment Duration</span>
                          <span className="font-medium">{durationProgress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${durationProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {detail.notes && (
                      <p className="mb-4 text-sm text-gray-600">
                        <span className="font-medium">Notes:</span> {detail.notes}
                      </p>
                    )}

                    {/* Adjustment History */}
                    <div className="mb-4">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Adjustment History</h4>
                        <button
                          onClick={() => {
                            setShowAdjustment(c.id);
                            setAdjCurrentAligner(detail.currentAligner ?? 0);
                          }}
                          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                        >
                          <Plus className="h-3 w-3" />
                          Record Adjustment
                        </button>
                      </div>

                      {(detail.adjustments ?? []).length === 0 ? (
                        <p className="text-center text-xs text-gray-400">No adjustments recorded</p>
                      ) : (
                        <div className="space-y-2">
                          {(detail.adjustments ?? []).map((adj) => (
                            <div key={adj.id} className="rounded-lg border bg-gray-50 p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                  {new Date(adj.createdAt).toLocaleDateString()}
                                </span>
                                {adj.currentAligner != null && (
                                  <span className="text-xs text-blue-600">Aligner #{adj.currentAligner}</span>
                                )}
                              </div>
                              <p className="mt-1 text-gray-600">{adj.notes}</p>
                              {adj.nextAppointmentDate && (
                                <p className="mt-1 text-xs text-gray-400">
                                  Next: {new Date(adj.nextAppointmentDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="m-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Orthodontic Case</h3>
              <button onClick={closeCreate} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Patient */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Patient</label>
                {selectedPatient ? (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span>{selectedPatient.firstName} {selectedPatient.lastName}</span>
                    <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="ml-auto">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search patient..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                    {patientResults && patientResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                        {patientResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            {p.firstName} {p.lastName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Appliance Type</label>
                <select
                  value={applianceType}
                  onChange={(e) => setApplianceType(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {APPLIANCE_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Malocclusion</label>
                <input
                  type="text"
                  value={malocclusion}
                  onChange={(e) => setMalocclusion(e.target.value)}
                  placeholder="e.g., Class II Division 1"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Est. End Date</label>
                  <input
                    type="date"
                    value={estimatedEndDate}
                    onChange={(e) => setEstimatedEndDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {(applianceType === 'clear_aligners' || applianceType === 'retainer') && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Total Aligners</label>
                  <input
                    type="number"
                    value={totalAligners}
                    onChange={(e) => setTotalAligners(Number(e.target.value))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={caseNotes}
                  onChange={(e) => setCaseNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={closeCreate}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !selectedPatient}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {showAdjustment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Record Adjustment</h3>
              <button onClick={() => setShowAdjustment(null)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Current Aligner #</label>
                <input
                  type="number"
                  value={adjCurrentAligner}
                  onChange={(e) => setAdjCurrentAligner(Number(e.target.value))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Next Appointment</label>
                <input
                  type="date"
                  value={adjNextDate}
                  onChange={(e) => setAdjNextDate(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe the adjustment..."
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowAdjustment(null)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => adjustmentMutation.mutate(showAdjustment)}
                disabled={adjustmentMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {adjustmentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
