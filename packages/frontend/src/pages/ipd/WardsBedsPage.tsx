import { useState, useMemo, useId } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  X,
  Bed,
  Building2,
  User,
  Wrench,
  Clock,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  Calendar,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { ipdService } from '../../services/ipd';
import { printElement } from '../../lib/print';
import { asList } from '../../utils/unwrapResponse';

interface HandoverPatient {
  admissionId: string;
  admissionNumber: string;
  admittedAt: string;
  patient: { id: string; name: string; mrn?: string; allergies: string[] };
  bed?: string;
  attendingDoctor?: string;
  diagnosis?: string;
  latestVitals: {
    recordedAt: string;
    temperature?: number;
    pulse?: number;
    bp?: string | null;
    respiratoryRate?: number;
    spo2?: number;
    newsScore?: number;
  } | null;
  medications: {
    overdue: { drug: string; dose: string; scheduledTime: string }[];
    dueSoon: { drug: string; dose: string; scheduledTime: string }[];
  };
  latestNursingNote: { note: string; type: string; shift: string; at: string } | null;
}

interface HandoverSheet {
  ward: { id: string; name: string };
  generatedAt: string;
  patients: HandoverPatient[];
}

const TRANSFER_REASONS = [
  { value: 'clinical', label: 'Clinical need' },
  { value: 'patient_request', label: 'Patient request' },
  { value: 'bed_management', label: 'Bed management' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'step_down', label: 'Step down' },
  { value: 'step_up', label: 'Step up' },
] as const;

type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'cleaning';
type WardType = 'All' | 'general' | 'icu' | 'private' | 'maternity' | 'pediatric';

interface BedInfo {
  id: string;
  bedNumber: string;
  type: string;
  status: BedStatus;
  dailyRate: number;
  notes?: string;
  wardId: string;
}

interface Ward {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  totalBeds: number;
  occupiedBeds: number;
  floor?: string;
  building?: string;
  beds?: BedInfo[];
}

interface Admission {
  id: string;
  admissionNumber: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
    gender: string;
    dateOfBirth: string;
  };
  bedId: string;
  wardId: string;
  admissionDate: string;
  admissionDiagnosis?: string;
  attendingDoctor?: {
    id: string;
    fullName: string;
  };
}

export default function WardsBedsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWardType, setSelectedWardType] = useState<WardType>('All');
  const [selectedBed, setSelectedBed] = useState<BedInfo | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const [handoverWardId, setHandoverWardId] = useState<string | null>(null);

  // Escape closes both of these, Tab stays inside, and focus goes back to the
  // bed that opened them. The handover sheet in particular is read on a shared
  // ward terminal, where tabbing off into the bed grid behind is easy to do and
  // hard to notice.
  const fid = useId();
  const handoverDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!handoverWardId,
    onClose: () => setHandoverWardId(null),
  });
  const transferDialogRef = useDialogA11y<HTMLDivElement>({
    open: showTransferModal,
    onClose: () => setShowTransferModal(false),
  });
  const [transferForm, setTransferForm] = useState({ toWardId: '', toBedId: '', reason: 'clinical', notes: '' });

  // Ward shift-handover sheet
  const { data: handover, isLoading: handoverLoading } = useQuery({
    queryKey: ['ward-handover', handoverWardId],
    queryFn: async () => {
      const res = await api.get(`/ipd/wards/${handoverWardId}/handover`);
      return res.data as HandoverSheet;
    },
    enabled: !!handoverWardId,
  });

  const refreshBeds = () => {
    queryClient.invalidateQueries({ queryKey: ['ipd-wards'] });
    queryClient.invalidateQueries({ queryKey: ['ipd-beds'] });
    queryClient.invalidateQueries({ queryKey: ['ipd-admissions-current'] });
  };

  // Available beds in the transfer target ward
  const { data: transferBeds = [] } = useQuery({
    queryKey: ['transfer-beds', transferForm.toWardId],
    queryFn: () => ipdService.beds.getAvailable(transferForm.toWardId),
    enabled: showTransferModal && !!transferForm.toWardId,
  });

  const transferMutation = useMutation({
    mutationFn: (admissionId: string) =>
      ipdService.admissions.transfer(admissionId, {
        toWardId: transferForm.toWardId,
        toBedId: transferForm.toBedId,
        reason: transferForm.reason,
      }),
    onSuccess: () => {
      refreshBeds();
      setShowTransferModal(false);
      setSelectedBed(null);
      setTransferForm({ toWardId: '', toBedId: '', reason: 'clinical', notes: '' });
      toast.success('Patient transferred');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to transfer patient')),
  });

  const reserveMutation = useMutation({
    mutationFn: async (bedId: string) => {
      const reason = window.prompt('Reservation reason (e.g. elective admission)?');
      if (!reason) throw Object.assign(new Error('cancelled'), { silent: true });
      return ipdService.reserveBed(bedId, 4, reason);
    },
    onSuccess: () => {
      refreshBeds();
      setSelectedBed(null);
      toast.success('Bed reserved (4-hour hold)');
    },
    onError: (err: any) => {
      if (!err?.silent) toast.error(getApiErrorMessage(err, 'Could not reserve bed'));
    },
  });

  const bedStatusMutation = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      api.patch(`/ipd/beds/${bedId}`, { status }),
    onSuccess: () => {
      refreshBeds();
      setSelectedBed(null);
      toast.success('Bed marked available');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Could not update bed')),
  });

  // Fetch wards
  const { data: wards = [], isLoading: wardsLoading } = useQuery({
    queryKey: ['ipd-wards'],
    queryFn: async () => {
      const res = await api.get('/ipd/wards');
      return res.data as Ward[];
    },
  });

  // Fetch beds for selected ward
  const { data: beds = [] } = useQuery({
    queryKey: ['ipd-beds', selectedWardId],
    queryFn: async () => {
      if (!selectedWardId) return [];
      const res = await api.get('/ipd/beds', { params: { wardId: selectedWardId } });
      return res.data as BedInfo[];
    },
    enabled: !!selectedWardId,
  });

  // Fetch current admissions to show patient info
  const { data: admissionsData } = useQuery({
    queryKey: ['ipd-admissions-current'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'admitted' } });
      return res.data as { data: Admission[]; total: number };
    },
  });

  const admissions = asList(admissionsData);
  const admissionsByBed = useMemo(() => {
    const map: Record<string, Admission> = {};
    admissions.forEach((a) => {
      if (a.bedId) map[a.bedId] = a;
    });
    return map;
  }, [admissions]);

  const filteredWards = useMemo(() => {
    return wards.filter((ward) => {
      if (selectedWardType !== 'All' && ward.type !== selectedWardType) return false;
      if (searchTerm) {
        return ward.name.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });
  }, [wards, searchTerm, selectedWardType]);

  const stats = useMemo(() => {
    const totalBeds = wards.reduce((sum, w) => sum + (w.totalBeds || 0), 0);
    const occupiedBeds = wards.reduce((sum, w) => sum + (w.occupiedBeds || 0), 0);
    return {
      total: totalBeds,
      available: totalBeds - occupiedBeds,
      occupied: occupiedBeds,
    };
  }, [wards]);

  const getBedStatusColor = (status: BedStatus) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 border-green-300 text-green-700';
      case 'occupied':
        return 'bg-red-100 border-red-300 text-red-700';
      case 'reserved':
        return 'bg-yellow-100 border-yellow-300 text-yellow-700';
      case 'maintenance':
      case 'cleaning':
        return 'bg-gray-100 border-gray-300 text-gray-700';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  const getBedIcon = (status: BedStatus) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'occupied':
        return <User className="w-4 h-4 text-red-600" />;
      case 'reserved':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'maintenance':
      case 'cleaning':
        return <Wrench className="w-4 h-4 text-gray-600" />;
      default:
        return <Bed className="w-4 h-4 text-gray-600" />;
    }
  };

  const wardTypes: WardType[] = ['All', 'general', 'icu', 'private', 'maternity', 'pediatric'];

  if (wardsLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Building2 className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wards & Beds</h1>
            <p className="text-sm text-gray-500">Manage bed occupancy and availability</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bed className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Beds</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.available}</p>
              <p className="text-sm text-gray-500">Available</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.occupied}</p>
              <p className="text-sm text-gray-500">Occupied</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search wards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          {wardTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedWardType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                selectedWardType === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Ward List */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
          {filteredWards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Building2 className="w-16 h-16 text-gray-300 mb-4" />
              <p className="font-medium text-lg">No wards found</p>
              <p className="text-sm">Create wards from Ward Management page</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredWards.map((ward) => (
                <div
                  key={ward.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedWardId === ward.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedWardId(ward.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">{ward.name}</h3>
                      <span className="text-sm text-gray-500">{ward.floor ? `Floor ${ward.floor}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium capitalize">
                        {ward.type}
                      </span>
                      <span className="text-sm text-gray-500">
                        {ward.occupiedBeds}/{ward.totalBeds} beds
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setHandoverWardId(ward.id);
                        }}
                        className="px-3 py-1 text-xs font-medium border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
                        title="Shift handover sheet for this ward"
                      >
                        Handover Sheet
                      </button>
                    </div>
                  </div>
                  {selectedWardId === ward.id && beds.length > 0 && (
                    <div className="grid grid-cols-6 gap-3 mt-4">
                      {beds.map((bed) => {
                        const admission = admissionsByBed[bed.id];
                        return (
                          <div
                            key={bed.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBed(bed);
                            }}
                            className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${getBedStatusColor(bed.status)} ${
                              selectedBed?.id === bed.id ? 'ring-2 ring-purple-500' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{bed.bedNumber}</span>
                              {getBedIcon(bed.status)}
                            </div>
                            <p className="text-xs truncate">
                              {bed.status === 'occupied' && admission?.patient?.fullName}
                              {bed.status === 'available' && 'Available'}
                              {bed.status === 'cleaning' && 'Cleaning'}
                              {bed.status === 'maintenance' && 'Maintenance'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bed Details Panel */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
          {selectedBed ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Bed {selectedBed.bedNumber}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getBedStatusColor(selectedBed.status)}`}>
                  {selectedBed.status}
                </span>
              </div>

              {selectedBed.status === 'occupied' && admissionsByBed[selectedBed.id] && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-white rounded-full border border-gray-200">
                        <User className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{admissionsByBed[selectedBed.id].patient?.fullName}</p>
                        <p className="text-sm text-gray-500">MRN: {admissionsByBed[selectedBed.id].patient?.mrn}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Diagnosis</p>
                    <p className="font-medium text-gray-900">{admissionsByBed[selectedBed.id].admissionDiagnosis || 'Not specified'}</p>
                  </div>

                  {admissionsByBed[selectedBed.id].attendingDoctor && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Attending Doctor</p>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-gray-500" />
                        <p className="font-medium text-gray-900">{admissionsByBed[selectedBed.id].attendingDoctor?.fullName}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Admitted On</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <p className="font-medium text-gray-900">
                        {new Date(admissionsByBed[selectedBed.id].admissionDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 space-y-2">
                    <button
                      onClick={() => {
                        const pid = admissionsByBed[selectedBed.id]?.patient?.id;
                        if (pid) navigate(`/patients/${pid}`);
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Patient Record
                    </button>
                    <button
                      onClick={() => {
                        setTransferForm({ toWardId: '', toBedId: '', reason: 'clinical', notes: '' });
                        setShowTransferModal(true);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Transfer Patient
                    </button>
                  </div>
                </div>
              )}

              {selectedBed.status === 'available' && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                    <p className="font-medium text-green-700">Bed is Available</p>
                  </div>
                  <button
                    onClick={() => navigate('/ipd/admissions')}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Admit Patient
                  </button>
                  <button
                    onClick={() => reserveMutation.mutate(selectedBed.id)}
                    disabled={reserveMutation.isPending}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Reserve Bed
                  </button>
                </div>
              )}

              {(selectedBed.status === 'maintenance' || selectedBed.status === 'cleaning') && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <Wrench className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="font-medium text-gray-900 capitalize">{selectedBed.status}</p>
                    {selectedBed.notes && <p className="text-sm text-gray-600 mt-1">{selectedBed.notes}</p>}
                  </div>
                  <button
                    onClick={() => bedStatusMutation.mutate({ bedId: selectedBed.id, status: 'available' })}
                    disabled={bedStatusMutation.isPending}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    Mark as Available
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Bed className="w-12 h-12 mb-3 text-gray-300" />
              <p className="font-medium">Select a bed</p>
              <p className="text-sm">Click on a bed to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Ward Handover Sheet */}
      {handoverWardId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fid}-handover-title`}
          ref={handoverDialogRef}
        >
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 id={`${fid}-handover-title`} className="text-lg font-semibold">
                  Shift Handover — {handover?.ward?.name || '…'}
                </h2>
                {handover && (
                  <p className="text-sm text-gray-500">
                    {handover.patients.length} patient{handover.patients.length === 1 ? '' : 's'} · generated{' '}
                    {new Date(handover.generatedAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => printElement('handover-print', `Handover — ${handover?.ward?.name || ''}`)}
                  disabled={!handover || handover.patients.length === 0}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Print
                </button>
                <button onClick={() => setHandoverWardId(null)} className="text-gray-400 hover:text-gray-600 px-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4" id="handover-print">
              {handoverLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : !handover || handover.patients.length === 0 ? (
                <p className="text-center text-gray-500 py-10">No admitted patients in this ward.</p>
              ) : (
                <div className="space-y-4">
                  {handover.patients.map((p) => (
                    <div key={p.admissionId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            Bed {p.bed || '—'} · {p.patient.name}
                            {p.patient.mrn && <span className="text-gray-500 font-normal"> · {p.patient.mrn}</span>}
                          </p>
                          <p className="text-sm text-gray-600">
                            {p.diagnosis || 'No diagnosis recorded'} · Dr {p.attendingDoctor || 'unassigned'} ·
                            admitted {new Date(p.admittedAt).toLocaleDateString()}
                          </p>
                          {p.patient.allergies?.length > 0 && (
                            <p className="text-sm font-medium text-red-700 mt-1">
                              ⚠ Allergies: {p.patient.allergies.join(', ')}
                            </p>
                          )}
                        </div>
                        {p.latestVitals?.newsScore != null && (
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              p.latestVitals.newsScore >= 5
                                ? 'bg-red-100 text-red-700'
                                : p.latestVitals.newsScore >= 3
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                            }`}
                          >
                            NEWS {p.latestVitals.newsScore}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-500 mb-1">Latest vitals</p>
                          {p.latestVitals ? (
                            <p className="text-gray-800">
                              {[
                                p.latestVitals.temperature != null && `T ${p.latestVitals.temperature}°C`,
                                p.latestVitals.pulse != null && `HR ${p.latestVitals.pulse}`,
                                p.latestVitals.bp && `BP ${p.latestVitals.bp}`,
                                p.latestVitals.respiratoryRate != null && `RR ${p.latestVitals.respiratoryRate}`,
                                p.latestVitals.spo2 != null && `SpO₂ ${p.latestVitals.spo2}%`,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Recorded, no values'}
                              <span className="text-gray-400">
                                {' '}({new Date(p.latestVitals.recordedAt).toLocaleTimeString()})
                              </span>
                            </p>
                          ) : (
                            <p className="text-gray-400">None recorded</p>
                          )}
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs text-gray-500 mb-1">Medications</p>
                          {p.medications.overdue.length === 0 && p.medications.dueSoon.length === 0 ? (
                            <p className="text-gray-400">Nothing due in the next 4h</p>
                          ) : (
                            <>
                              {p.medications.overdue.map((m, i) => (
                                <p key={`o${i}`} className="text-red-700 font-medium">
                                  OVERDUE: {m.drug} {m.dose} ({new Date(m.scheduledTime).toLocaleTimeString()})
                                </p>
                              ))}
                              {p.medications.dueSoon.map((m, i) => (
                                <p key={`d${i}`} className="text-gray-800">
                                  Due {new Date(m.scheduledTime).toLocaleTimeString()}: {m.drug} {m.dose}
                                </p>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                      {p.latestNursingNote && (
                        <p className="mt-2 text-sm text-gray-700 bg-blue-50 border-l-4 border-blue-300 p-2 rounded">
                          Last note ({p.latestNursingNote.shift || '—'} shift,{' '}
                          {new Date(p.latestNursingNote.at).toLocaleString()}): {p.latestNursingNote.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedBed && admissionsByBed[selectedBed.id] && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${fid}-transfer-title`}
          ref={transferDialogRef}
        >
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 id={`${fid}-transfer-title`} className="text-lg font-semibold">Transfer Patient</h2>
                <p className="text-sm text-gray-500">
                  {admissionsByBed[selectedBed.id].patient?.fullName} — from bed {selectedBed.bedNumber}
                </p>
              </div>
              <button aria-label="Close" onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Ward *</label>
                <select
                  value={transferForm.toWardId}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, toWardId: e.target.value, toBedId: '' }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select ward...</option>
                  {wards.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Bed *</label>
                <select
                  value={transferForm.toBedId}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, toBedId: e.target.value }))}
                  disabled={!transferForm.toWardId}
                  className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
                >
                  <option value="">{transferForm.toWardId ? 'Select bed...' : 'Select a ward first'}</option>
                  {transferBeds.filter(b => b.id !== selectedBed.id).map(b => (
                    <option key={b.id} value={b.id}>Bed {b.bedNumber}</option>
                  ))}
                </select>
                {transferForm.toWardId && transferBeds.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">No available beds in that ward.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <select
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  {TRANSFER_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => transferMutation.mutate(admissionsByBed[selectedBed.id].id)}
                disabled={!transferForm.toWardId || !transferForm.toBedId || transferMutation.isPending}
                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {transferMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
