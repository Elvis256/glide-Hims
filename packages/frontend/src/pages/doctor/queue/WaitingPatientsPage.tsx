import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Users,
  Phone,
  FileText,
  Clock,
  AlertTriangle,
  Filter,
  Loader2,
  PlayCircle,
  RotateCcw,
  RefreshCw,
  Volume2,
  VolumeX,
  ChevronRight,
  X,
  Activity,
  Pill,
  Heart,
  AlertCircle,
  Star,
  Building2,
  Crown,
  UserX,
  ArrowRightLeft,
  ChevronUp,
  Eye,
  Stethoscope,
  Calendar,
  ClipboardList,
  Thermometer,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../../services/queue';
import { vitalsService, type VitalRecord } from '../../../services/vitals';
import { chronicCareService, type ChronicPatient } from '../../../services/chronic-care';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { useAuthStore } from '../../../store/auth';
import api from '../../../services/api';

// ===================== TYPES =====================
interface ExtendedPatientInfo {
  age?: number;
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: string;
  paymentType?: 'cash' | 'insurance' | 'membership' | 'corporate';
  insuranceProvider?: string;
  allergies?: string[];
  previousVisits?: number;
  isVip?: boolean;
}

interface WaitingPatient {
  id: string;
  ticketNumber: string;
  name: string;
  mrn: string;
  patientId: string;
  waitTime: number;
  priority: 'emergency' | 'urgent' | 'high' | 'normal' | 'low';
  chiefComplaint: string;
  encounterId?: string;
  status: 'waiting' | 'called' | 'in_service' | 'return_to_doctor';
  returnReason?: string;
  appointmentType?: 'walk-in' | 'scheduled' | 'emergency';
  patientInfo?: ExtendedPatientInfo;
}

interface PatientPreview {
  patientId: string;
  lastVisit?: {
    date: string;
    complaint: string;
    diagnosis?: string;
  };
  activeMedications?: Array<{ name: string; dose: string }>;
  chronicConditions?: string[];
  recentVitals?: VitalRecord;
  pendingResults?: Array<{ type: string; orderedAt: string }>;
}

interface DashboardStats {
  waitingNow: number;
  inConsultation: number;
  seenToday: number;
  avgWaitTime: number;
  avgConsultTime: number;
}

type FilterType = 'all' | 'returned' | 'emergency' | 'urgent' | 'high' | 'normal';
type AppointmentFilter = 'all' | 'walk-in' | 'scheduled' | 'emergency';

// ===================== UTILITIES =====================
const mapPriority = (priority: number): WaitingPatient['priority'] => {
  if (priority === 1) return 'emergency';
  if (priority === 2) return 'urgent';
  if (priority <= 4) return 'high';
  if (priority <= 7) return 'normal';
  return 'low';
};

const calculateWaitTime = (createdAt: string): number => {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.round((now.getTime() - created.getTime()) / 60000);
};

const calculateAge = (dob: string): number => {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  if (isNaN(birth.getTime()) || birth > today) return 0; // Invalid or future date
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
};

const formatWaitTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

const getWaitTimeColor = (minutes: number): string => {
  if (minutes < 15) return 'border-l-green-500 bg-green-50/30';
  if (minutes < 30) return 'border-l-yellow-500 bg-yellow-50/30';
  return 'border-l-red-500 bg-red-50/30';
};

const getWaitTimeBadgeColor = (minutes: number): string => {
  if (minutes < 15) return 'bg-green-100 text-green-700';
  if (minutes < 30) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

const priorityConfig = {
  emergency: { bg: 'bg-red-600', text: 'text-white', border: 'border-red-600', label: 'Emergency', icon: AlertTriangle },
  urgent: { bg: 'bg-orange-500', text: 'text-white', border: 'border-orange-500', label: 'Urgent', icon: AlertCircle },
  high: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'High', icon: ChevronUp },
  normal: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Normal', icon: null },
  low: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', label: 'Low', icon: null },
};

// ===================== COMPONENTS =====================
function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  subtitle 
}: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType; 
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-700', '-100')}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function PatientPreviewModal({ 
  patient, 
  preview, 
  isLoading, 
  onClose 
}: { 
  patient: WaitingPatient; 
  preview: PatientPreview | null; 
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{patient.name}</h3>
            <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : preview ? (
            <>
              {/* Last Visit */}
              {preview.lastVisit && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4" />
                    Last Visit
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    <p className="text-gray-600">
                      <span className="font-medium">{new Date(preview.lastVisit.date).toLocaleDateString()}</span>
                      {' - '}{preview.lastVisit.complaint}
                    </p>
                    {preview.lastVisit.diagnosis && (
                      <p className="text-gray-500 mt-1">Dx: {preview.lastVisit.diagnosis}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Active Medications */}
              {preview.activeMedications && preview.activeMedications.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <Pill className="w-4 h-4" />
                    Active Medications
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {preview.activeMedications.map((med, i) => (
                      <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-lg">
                        {med.name} {med.dose}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Chronic Conditions */}
              {preview.chronicConditions && preview.chronicConditions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4" />
                    Chronic Conditions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {preview.chronicConditions.map((cond, i) => (
                      <span key={i} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-lg">
                        {cond}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Vitals */}
              {preview.recentVitals && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <Thermometer className="w-4 h-4" />
                    Recent Vitals
                  </h4>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {preview.recentVitals.bloodPressureSystolic && (
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">BP</p>
                        <p className="font-medium text-blue-700">
                          {preview.recentVitals.bloodPressureSystolic}/{preview.recentVitals.bloodPressureDiastolic}
                        </p>
                      </div>
                    )}
                    {preview.recentVitals.pulse && (
                      <div className="bg-red-50 rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Pulse</p>
                        <p className="font-medium text-red-700">{preview.recentVitals.pulse} bpm</p>
                      </div>
                    )}
                    {preview.recentVitals.temperature && (
                      <div className="bg-orange-50 rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Temp</p>
                        <p className="font-medium text-orange-700">{preview.recentVitals.temperature}°C</p>
                      </div>
                    )}
                    {preview.recentVitals.oxygenSaturation && (
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">SpO2</p>
                        <p className="font-medium text-green-700">{preview.recentVitals.oxygenSaturation}%</p>
                      </div>
                    )}
                    {preview.recentVitals.weight && (
                      <div className="bg-purple-50 rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Weight</p>
                        <p className="font-medium text-purple-700">{preview.recentVitals.weight} kg</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Pending Results */}
              {preview.pendingResults && preview.pendingResults.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <ClipboardList className="w-4 h-4" />
                    Pending Results
                  </h4>
                  <div className="space-y-2">
                    {preview.pendingResults.map((result, i) => (
                      <div key={i} className="flex items-center justify-between bg-yellow-50 rounded-lg px-3 py-2 text-sm">
                        <span className="text-yellow-800">{result.type}</span>
                        <span className="text-yellow-600 text-xs">
                          {new Date(result.orderedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!preview.lastVisit && !preview.activeMedications?.length && !preview.chronicConditions?.length && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No previous medical history available</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Unable to load patient preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TransferModal({ 
  patient, 
  onClose, 
  onTransfer 
}: { 
  patient: WaitingPatient; 
  onClose: () => void;
  onTransfer: (doctorId: string) => void;
}) {
  const [selectedDoctor, setSelectedDoctor] = useState('');
  
  const { data: doctors, isLoading } = useQuery({
    queryKey: ['available-doctors'],
    queryFn: async () => {
      const response = await api.get('/users', { params: { role: 'Doctor', status: 'active' } });
      return response.data?.data || [];
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Transfer Patient</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Transfer <span className="font-medium">{patient.name}</span> to another doctor
          </p>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <select
              value={selectedDoctor}
              onChange={(e) => setSelectedDoctor(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a doctor...</option>
              {doctors?.map((doc: any) => (
                <option key={doc.id} value={doc.id}>{doc.fullName}</option>
              ))}
            </select>
          )}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onTransfer(selectedDoctor)}
              disabled={!selectedDoctor}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== MAIN COMPONENT =====================
export default function WaitingPatientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { user } = useAuthStore();
  
  // State
  const [filter, setFilter] = useState<FilterType>('all');
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>('all');
  const [myPatientsOnly, setMyPatientsOnly] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<WaitingPatient | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [patientForTransfer, setPatientForTransfer] = useState<WaitingPatient | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const prevQueueLengthRef = useRef<number>(0);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  // Permission check
  const canViewQueue = hasPermission('queue.read') || hasPermission('encounters.read');
  const canManageQueue = hasPermission('queue.manage') || hasPermission('encounters.write');

  // Initialize notification sound
  useEffect(() => {
    notificationSoundRef.current = new Audio('/sounds/notification.mp3');
    notificationSoundRef.current.volume = 0.5;
  }, []);

  // Play notification sound for new patients
  const playNotificationSound = useCallback(() => {
    if (soundEnabled && notificationSoundRef.current) {
      notificationSoundRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  // Fetch dashboard stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['doctor-queue-stats'],
    queryFn: async () => {
      try {
        // Get stats for consultation service point specifically
        const queueStats = await queueService.getStats('consultation');
        
        return {
          waitingNow: queueStats.waiting || 0,
          inConsultation: queueStats.inService || 0,
          seenToday: queueStats.completed || 0,
          avgWaitTime: queueStats.averageWaitMinutes || 0,
          avgConsultTime: queueStats.averageServiceMinutes || 0,
        };
      } catch {
        return { waitingNow: 0, inConsultation: 0, seenToday: 0, avgWaitTime: 0, avgConsultTime: 0 };
      }
    },
    refetchInterval: 30000,
  });

  // Fetch consultation queue
  const { data: queueData, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['doctor-waiting-queue'],
    queryFn: async () => {
      const all = await queueService.getQueue({ servicePoint: 'consultation' });
      return all.filter(entry => entry.status === 'waiting' || entry.status === 'called');
    },
    refetchInterval: 30000,
  });

  // Fetch returned patients
  const { data: returnedData } = useQuery({
    queryKey: ['doctor-returned-patients'],
    queryFn: async () => {
      const response = await api.get('/encounters', {
        params: { status: 'return_to_doctor', limit: 50 },
      });
      return response.data?.data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch in-progress patients
  const { data: inProgressData } = useQuery({
    queryKey: ['doctor-inprogress-queue'],
    queryFn: async () => {
      const all = await queueService.getQueue({ servicePoint: 'consultation' });
      return all.filter(entry => entry.status === 'in_service');
    },
    refetchInterval: 30000,
  });

  // Update last refresh time
  useEffect(() => {
    setLastRefresh(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  // Check for new patients and play sound
  useEffect(() => {
    const currentLength = (queueData?.length || 0) + (returnedData?.length || 0);
    if (prevQueueLengthRef.current > 0 && currentLength > prevQueueLengthRef.current) {
      playNotificationSound();
      toast.info('New patient added to queue');
    }
    prevQueueLengthRef.current = currentLength;
  }, [queueData, returnedData, playNotificationSound]);

  // Fetch patient preview data
  const { data: previewData, isLoading: previewLoading } = useQuery<PatientPreview | null>({
    queryKey: ['patient-preview', selectedPatient?.patientId],
    queryFn: async () => {
      if (!selectedPatient?.patientId) return null;
      
      const [encounters, vitals, chronic] = await Promise.allSettled([
        api.get('/encounters', { params: { patientId: selectedPatient.patientId, limit: 5 } }),
        vitalsService.getPatientHistory(selectedPatient.patientId, 1),
        chronicCareService.getPatientConditions(selectedPatient.patientId),
      ]);

      const encountersData = encounters.status === 'fulfilled' ? encounters.value.data?.data || [] : [];
      const vitalsData = vitals.status === 'fulfilled' ? vitals.value : [];
      const chronicData = chronic.status === 'fulfilled' ? chronic.value : [];

      const lastEnc = encountersData[0];
      
      return {
        patientId: selectedPatient.patientId,
        lastVisit: lastEnc ? {
          date: lastEnc.createdAt,
          complaint: lastEnc.chiefComplaint || 'N/A',
          diagnosis: lastEnc.diagnoses?.[0]?.description,
        } : undefined,
        activeMedications: [],
        chronicConditions: chronicData.map((c: ChronicPatient) => c.diagnosis?.name).filter(Boolean),
        recentVitals: vitalsData[0] || undefined,
        pendingResults: [],
      };
    },
    enabled: !!selectedPatient?.patientId && showPreview,
  });

  // Transform queue entries
  const transformQueueEntry = (entry: QueueEntry & { 
    patient?: { fullName: string; mrn: string; id: string; dateOfBirth?: string; gender?: string; paymentType?: string; allergies?: string[] }; 
    encounter?: { chiefComplaint?: string; id: string; type?: string };
  }): WaitingPatient => {
    // Parse notes to extract meaningful info (filter out UUID-based preferred doctor notes)
    let displayNotes = entry.notes || '';
    const preferredDoctorMatch = displayNotes.match(/^Preferred doctor: (.+)$/);
    if (preferredDoctorMatch) {
      // If notes only contain preferred doctor info, show it nicely or use default
      const doctorInfo = preferredDoctorMatch[1];
      // Check if it's a UUID (old format) - if so, show generic message
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doctorInfo);
      displayNotes = isUUID ? 'OPD Consultation' : `Dr. ${doctorInfo}`;
    }
    
    // Prioritize actual chief complaint over notes
    const chiefComplaint = entry.encounter?.chiefComplaint || 
                           (displayNotes && !displayNotes.startsWith('Preferred') ? displayNotes : '') ||
                           'OPD Consultation';
    
    return {
      id: entry.id,
      ticketNumber: entry.ticketNumber,
      name: entry.patient?.fullName || 'Unknown Patient',
      mrn: entry.patient?.mrn || 'N/A',
      patientId: entry.patient?.id || entry.patientId,
      waitTime: calculateWaitTime(entry.createdAt),
      priority: mapPriority(entry.priority),
      chiefComplaint,
      encounterId: entry.encounter?.id || entry.encounterId,
      status: (entry.status as WaitingPatient['status']) || 'waiting',
      appointmentType: entry.encounter?.type === 'emergency' ? 'emergency' : 'walk-in',
      patientInfo: entry.patient ? {
        age: entry.patient.dateOfBirth ? calculateAge(entry.patient.dateOfBirth) : undefined,
        gender: entry.patient.gender as 'male' | 'female' | 'other',
        paymentType: entry.patient.paymentType as 'cash' | 'insurance' | 'membership' | 'corporate',
        allergies: entry.patient.allergies,
      } : undefined,
    };
  };

  // Transform returned encounters
  const returnedPatients: WaitingPatient[] = (returnedData || []).map((enc: any) => ({
    id: enc.id,
    ticketNumber: enc.queueNumber?.toString() || enc.visitNumber || 'R',
    name: enc.patient?.fullName || 'Unknown Patient',
    mrn: enc.patient?.mrn || 'N/A',
    patientId: enc.patient?.id || enc.patientId,
    waitTime: calculateWaitTime(enc.metadata?.returnedAt || enc.createdAt),
    priority: 'urgent' as const,
    chiefComplaint: enc.metadata?.returnReason || enc.chiefComplaint || 'Returned from billing',
    encounterId: enc.id,
    status: 'return_to_doctor' as const,
    returnReason: enc.metadata?.returnReason,
    appointmentType: 'walk-in' as const,
    patientInfo: enc.patient ? {
      age: enc.patient.dateOfBirth ? calculateAge(enc.patient.dateOfBirth) : undefined,
      gender: enc.patient.gender,
      paymentType: enc.patient.paymentType,
      allergies: enc.patient.allergies,
    } : undefined,
  }));

  // Transform regular queue
  const patients: WaitingPatient[] = (queueData || []).map(entry => ({
    ...transformQueueEntry(entry),
    status: entry.status as 'waiting' | 'called' | 'in_service',
  }));

  // In-progress patients
  const inProgressPatients: WaitingPatient[] = (inProgressData || []).map(entry => ({
    ...transformQueueEntry(entry),
    status: 'in_service' as const,
  }));

  // Mutations
  const callPatientMutation = useMutation({
    mutationFn: (data: { id: string; status: string }) => {
      return data.status === 'called' ? queueService.recall(data.id) : queueService.call(data.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
      toast.success('Patient called');
    },
  });

  const callNextMutation = useMutation({
    mutationFn: () => queueService.callNext('consultation'),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
      if (patient) {
        announcePatient({ ticketNumber: patient.ticketNumber, name: patient.patient?.fullName || 'Patient' } as WaitingPatient);
        toast.success(`Called ${patient.patient?.fullName || 'next patient'}`);
      }
    },
  });

  const startServiceMutation = useMutation({
    mutationFn: (id: string) => queueService.startService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-inprogress-queue'] });
    },
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => queueService.noShow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
      toast.success('Patient marked as no-show');
    },
  });

  const priorityBumpMutation = useMutation({
    mutationFn: async ({ id, newPriority }: { id: string; newPriority: number }) => {
      const response = await api.patch(`/queue/${id}`, { priority: newPriority });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
      toast.success('Priority updated');
    },
  });

  const transferMutation = useMutation({
    mutationFn: async ({ queueId, doctorId }: { queueId: string; doctorId: string }) => {
      const response = await api.post(`/queue/${queueId}/transfer-doctor`, { doctorId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
      setShowTransferModal(false);
      setPatientForTransfer(null);
      toast.success('Patient transferred');
    },
  });

  const acceptReturnedMutation = useMutation({
    mutationFn: async (encounterId: string) => {
      const response = await api.patch(`/encounters/${encounterId}/status`, { status: 'in_consultation' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-returned-patients'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
    },
  });

  // Combine and filter patients
  const allPatients = useMemo(() => [...returnedPatients, ...patients], [returnedPatients, patients]);

  const filteredPatients = useMemo(() => {
    let result = allPatients;

    // Filter by priority/status
    if (filter === 'returned') result = returnedPatients;
    else if (filter === 'emergency') result = result.filter(p => p.priority === 'emergency');
    else if (filter === 'urgent') result = result.filter(p => p.priority === 'urgent');
    else if (filter === 'high') result = result.filter(p => p.priority === 'high');
    else if (filter === 'normal') result = result.filter(p => p.priority === 'normal' || p.priority === 'low');

    // Filter by appointment type
    if (appointmentFilter !== 'all') {
      result = result.filter(p => p.appointmentType === appointmentFilter);
    }

    return result;
  }, [allPatients, returnedPatients, filter, appointmentFilter]);

  // Get next patient
  const nextPatient = useMemo(() => {
    const waiting = patients.filter(p => p.status === 'waiting');
    if (waiting.length === 0) return null;
    return waiting.sort((a, b) => {
      const priorityOrder = { emergency: 0, urgent: 1, high: 2, normal: 3, low: 4 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.waitTime - a.waitTime;
    })[0];
  }, [patients]);

  // Announce patient
  const announcePatient = (patient: WaitingPatient) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const announcement = `Token number ${patient.ticketNumber}. ${patient.name}, please proceed to the consultation room.`;
      const utterance = new SpeechSynthesisUtterance(announcement);
      utterance.rate = 0.9;
      utterance.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Handlers
  const handleCallPatient = (patient: WaitingPatient) => {
    callPatientMutation.mutate({ id: patient.id, status: patient.status });
    announcePatient(patient);
  };

  const handleCallNext = () => {
    callNextMutation.mutate();
  };

  const handleStartConsultation = async (patient: WaitingPatient) => {
    try {
      // For patients already in service, just navigate
      if (patient.status === 'in_service') {
        if (patient.encounterId) {
          navigate(`/doctor/consult?encounterId=${patient.encounterId}&patientId=${patient.patientId}`);
        } else {
          navigate(`/doctor/consult?patientId=${patient.patientId}`);
        }
        return;
      }
      
      // If patient is in waiting status, need to call first before starting service
      if (patient.status === 'waiting') {
        await queueService.call(patient.id);
      }
      // Now start the service (patient should be in 'called' status)
      await startServiceMutation.mutateAsync(patient.id);
      
      // Navigate to the consultation page with encounter context
      if (patient.encounterId) {
        navigate(`/doctor/consult?encounterId=${patient.encounterId}&patientId=${patient.patientId}`);
      } else {
        navigate(`/doctor/consult?patientId=${patient.patientId}`);
      }
    } catch (err) {
      console.error('Failed to start consultation:', err);
      toast.error('Failed to start consultation');
    }
  };

  const handleViewHistory = (patient: WaitingPatient) => {
    navigate(`/patients/history?patientId=${patient.patientId}`);
  };

  const handleMarkNoShow = (patient: WaitingPatient) => {
    noShowMutation.mutate(patient.id);
  };

  const handlePriorityBump = (patient: WaitingPatient) => {
    const newPriority = patient.priority === 'normal' ? 3 : patient.priority === 'high' ? 2 : 1;
    priorityBumpMutation.mutate({ id: patient.id, newPriority });
  };

  const handleTransfer = (doctorId: string) => {
    if (patientForTransfer) {
      transferMutation.mutate({ queueId: patientForTransfer.id, doctorId });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['doctor-waiting-queue'] });
    queryClient.invalidateQueries({ queryKey: ['doctor-returned-patients'] });
    queryClient.invalidateQueries({ queryKey: ['doctor-inprogress-queue'] });
    queryClient.invalidateQueries({ queryKey: ['doctor-queue-stats'] });
    setLastRefresh(new Date());
    toast.success('Queue refreshed');
  };

  // Permission denied state
  if (!canViewQueue) {
    return <AccessDenied />;
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Waiting Patients</h1>
            <p className="text-gray-500 flex items-center gap-2">
              {filteredPatients.length} patients in queue
              <span className="text-xs text-gray-400">
                • Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border ${soundEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-400'}`}
            title={soundEnabled ? 'Sound enabled' : 'Sound disabled'}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg border bg-white hover:bg-gray-50 text-gray-600"
            title="Refresh queue"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Call Next Button */}
          <button
            onClick={handleCallNext}
            disabled={!nextPatient || callNextMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl shadow-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <PlayCircle className="w-5 h-5" />
            Call Next
            {nextPatient && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-sm">
                #{nextPatient.ticketNumber}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard
          title="Waiting Now"
          value={stats?.waitingNow || 0}
          icon={Clock}
          color="text-blue-600"
        />
        <StatCard
          title="In Consultation"
          value={stats?.inConsultation || 0}
          icon={Stethoscope}
          color="text-green-600"
        />
        <StatCard
          title="Seen Today"
          value={stats?.seenToday || 0}
          icon={Users}
          color="text-purple-600"
        />
        <StatCard
          title="Avg Wait Time"
          value={formatWaitTime(stats?.avgWaitTime || 0)}
          icon={Clock}
          color="text-orange-600"
        />
        <StatCard
          title="Avg Consult Time"
          value={formatWaitTime(stats?.avgConsultTime || 0)}
          icon={Activity}
          color="text-teal-600"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-3 shadow-sm border">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500 mr-2">Priority:</span>
          {(['all', 'returned', 'emergency', 'urgent', 'high', 'normal'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? f === 'returned' ? 'bg-orange-500 text-white'
                  : f === 'emergency' ? 'bg-red-600 text-white'
                  : f === 'urgent' ? 'bg-orange-500 text-white'
                  : 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'returned' && returnedPatients.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {returnedPatients.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {/* Appointment Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Type:</span>
            <select
              value={appointmentFilter}
              onChange={(e) => setAppointmentFilter(e.target.value as AppointmentFilter)}
              className="px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="walk-in">Walk-in</option>
              <option value="scheduled">Scheduled</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          {/* My Patients Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={myPatientsOnly}
              onChange={(e) => setMyPatientsOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">My patients only</span>
          </label>
        </div>
      </div>

      {/* Returned Patients Section */}
      {returnedPatients.length > 0 && filter !== 'returned' && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Returned from Billing ({returnedPatients.length})
            </h2>
          </div>
          <div className="bg-orange-50 rounded-xl shadow-sm border border-orange-200">
            {returnedPatients.slice(0, 3).map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between px-4 py-3 border-b border-orange-200 last:border-b-0 hover:bg-orange-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-orange-600 w-12">
                    {patient.ticketNumber}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{patient.name}</p>
                    <p className="text-sm text-orange-700">{patient.returnReason || patient.chiefComplaint}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    acceptReturnedMutation.mutate(patient.encounterId!);
                    navigate(`/doctor/consult?encounterId=${patient.encounterId}&patientId=${patient.patientId}`);
                  }}
                  disabled={acceptReturnedMutation.isPending}
                  className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                >
                  See Patient
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In Progress Section */}
      {inProgressPatients.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <PlayCircle className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">In Consultation ({inProgressPatients.length})</h2>
          </div>
          <div className="bg-green-50 rounded-xl shadow-sm border border-green-200">
            {inProgressPatients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between px-4 py-3 border-b border-green-200 last:border-b-0 hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                    <span className="font-mono font-bold text-green-600">
                      {patient.ticketNumber}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{patient.name}</p>
                    <p className="text-sm text-gray-500">
                      {patient.mrn}
                      {patient.patientInfo?.age && patient.patientInfo?.gender && (
                        <> • {patient.patientInfo.age}y / {patient.patientInfo.gender.charAt(0).toUpperCase()}</>
                      )}
                    </p>
                    <p className="text-xs text-green-700">{patient.chiefComplaint}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleStartConsultation(patient)}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" />
                  Continue
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patient Queue List */}
      <div className="flex-1 overflow-auto">
        <div className="grid gap-3">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-12 text-center text-gray-500 bg-white rounded-xl border">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No patients in queue</p>
            </div>
          ) : (
            filteredPatients.map((patient) => {
              const priority = priorityConfig[patient.priority];
              const PriorityIcon = priority.icon;
              
              return (
                <div
                  key={patient.id}
                  className={`bg-white rounded-xl shadow-sm border border-l-4 ${getWaitTimeColor(patient.waitTime)} hover:shadow-md transition-all`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      {/* Left: Patient Info */}
                      <div className="flex items-start gap-4">
                        {/* Token */}
                        <div className="text-center">
                          <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                            <span className="font-mono font-bold text-xl text-blue-600">
                              {patient.ticketNumber}
                            </span>
                          </div>
                          {patient.status === 'called' && (
                            <span className="mt-1 inline-block px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                              Called
                            </span>
                          )}
                        </div>

                        {/* Patient Details */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                            
                            {/* Badges */}
                            {patient.patientInfo?.paymentType === 'insurance' && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Insurance
                              </span>
                            )}
                            {patient.patientInfo?.paymentType === 'corporate' && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                Corporate
                              </span>
                            )}
                            {patient.patientInfo?.isVip && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full flex items-center gap-1">
                                <Crown className="w-3 h-3" />
                                VIP
                              </span>
                            )}
                            {patient.patientInfo?.allergies && patient.patientInfo.allergies.length > 0 && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Allergies
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                            <span className="font-mono">{patient.mrn}</span>
                            {patient.patientInfo?.age && patient.patientInfo?.gender && (
                              <>
                                <span>•</span>
                                <span>{patient.patientInfo.age}y / {patient.patientInfo.gender.charAt(0).toUpperCase()}</span>
                              </>
                            )}
                            {patient.patientInfo?.previousVisits && patient.patientInfo.previousVisits > 0 && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Star className="w-3 h-3" />
                                  {patient.patientInfo.previousVisits} visits
                                </span>
                              </>
                            )}
                          </div>

                          <p className="text-gray-700">{patient.chiefComplaint}</p>
                        </div>
                      </div>

                      {/* Right: Wait Time + Priority + Actions */}
                      <div className="flex items-center gap-4">
                        {/* Wait Time */}
                        <div className="text-right">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${getWaitTimeBadgeColor(patient.waitTime)}`}>
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">{formatWaitTime(patient.waitTime)}</span>
                          </div>
                        </div>

                        {/* Priority Badge */}
                        <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ${priority.bg} ${priority.text}`}>
                          {PriorityIcon && <PriorityIcon className="w-4 h-4" />}
                          {priority.label}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {/* Preview */}
                          <button
                            onClick={() => {
                              setSelectedPatient(patient);
                              setShowPreview(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Quick Preview"
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          {/* Call */}
                          <button
                            onClick={() => handleCallPatient(patient)}
                            disabled={callPatientMutation.isPending}
                            className={`p-2 rounded-lg transition-colors ${
                              patient.status === 'called'
                                ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                                : 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
                            }`}
                            title={patient.status === 'called' ? 'Recall' : 'Call'}
                          >
                            <Phone className="w-5 h-5" />
                          </button>

                          {/* Start */}
                          <button
                            onClick={() => handleStartConsultation(patient)}
                            disabled={startServiceMutation.isPending}
                            className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                            title="Start Consultation"
                          >
                            <PlayCircle className="w-5 h-5" />
                          </button>

                          {/* History */}
                          <button
                            onClick={() => handleViewHistory(patient)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View History"
                          >
                            <FileText className="w-5 h-5" />
                          </button>

                          {/* More Actions Dropdown */}
                          <div className="relative group">
                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              <ChevronRight className="w-5 h-5" />
                            </button>
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                              <button
                                onClick={() => handleMarkNoShow(patient)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <UserX className="w-4 h-4" />
                                Mark No-Show
                              </button>
                              <button
                                onClick={() => {
                                  setPatientForTransfer(patient);
                                  setShowTransferModal(true);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                                Transfer to Doctor
                              </button>
                              <button
                                onClick={() => handlePriorityBump(patient)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <ChevronUp className="w-4 h-4" />
                                Priority Bump
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Patient Preview Modal */}
      {showPreview && selectedPatient && (
        <PatientPreviewModal
          patient={selectedPatient}
          preview={previewData || null}
          isLoading={previewLoading}
          onClose={() => {
            setShowPreview(false);
            setSelectedPatient(null);
          }}
        />
      )}

      {/* Transfer Modal */}
      {showTransferModal && patientForTransfer && (
        <TransferModal
          patient={patientForTransfer}
          onClose={() => {
            setShowTransferModal(false);
            setPatientForTransfer(null);
          }}
          onTransfer={handleTransfer}
        />
      )}
    </div>
  );
}
