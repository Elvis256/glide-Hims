import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  Pill,
  UserCircle,
  CheckCircle,
  AlertTriangle,
  Filter,
  ChevronRight,
  Loader2,
  X,
  Volume2,
  VolumeX,
  Grid3X3,
  User,
  Calendar,
  Play,
  RefreshCw,
  Info,
  Syringe,
  Shield,
  ShieldCheck,
  Activity,
  FileText,
  History,
  Search,
  Building2,
  AlertCircle,
  XCircle,
  PauseCircle,
  Ban,
} from 'lucide-react';
import { ipdService, type MedicationAdministration, type Ward, type Admission, type AdministerMedicationDto } from '../../services/ipd';
import PermissionGate, { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';

// Extended medication interface with additional fields
interface ScheduledMed {
  id: string;
  admissionId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  ward: string;
  wardId: string;
  bed: string;
  medication: string;
  genericName?: string;
  dose: string;
  route: string;
  frequency?: string;
  scheduledTime: string;
  status: 'scheduled' | 'given' | 'missed' | 'held' | 'refused';
  priority: 'routine' | 'urgent' | 'stat';
  prescribedBy?: string;
  startDate?: string;
  duration?: string;
  specialInstructions?: string;
  isControlled?: boolean;
  isIV?: boolean;
  isPRN?: boolean;
  allergies?: string[];
  administrationHistory?: {
    time: string;
    status: string;
    givenBy?: string;
    notes?: string;
  }[];
}

type ViewMode = 'patient' | 'ward' | 'time';
type QuickFilter = 'all' | 'due-now' | 'overdue' | 'iv' | 'controlled' | 'prn';

const TIME_SLOTS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '00:00'];
const TIME_SLOT_LABELS = ['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM', '12AM'];

// Auto-refresh interval in milliseconds
const AUTO_REFRESH_INTERVAL = 60000;

// Helper functions
const formatTime = (timeStr: string) => {
  try {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  } catch {
    return timeStr;
  }
};

const parseScheduledTime = (scheduledTime: string): Date => {
  // scheduledTime might be "HH:MM" or ISO date string
  const now = new Date();
  if (scheduledTime.includes('T')) {
    return new Date(scheduledTime);
  }
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const getTimeSlotForTime = (scheduledTime: string): string => {
  const date = parseScheduledTime(scheduledTime);
  const hours = date.getHours();
  const mins = date.getMinutes();
  const totalMins = hours * 60 + mins;
  
  // Find closest time slot
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    const [slotHours, slotMins] = TIME_SLOTS[i].split(':').map(Number);
    const slotTotalMins = slotHours * 60 + slotMins;
    if (totalMins < slotTotalMins + 60) {
      return TIME_SLOTS[i];
    }
  }
  return TIME_SLOTS[0];
};

export default function MedicationSchedulePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasAnyPermission } = usePermissions();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // View mode and filters
  const [viewMode, setViewMode] = useState<ViewMode>('ward');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI state
  const [selectedMed, setSelectedMed] = useState<ScheduledMed | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Permission check
  const hasAccess = hasAnyPermission(['pharmacy.read', 'nursing.read']);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch wards
  const { data: wards = [] } = useQuery({
    queryKey: ['wards'],
    queryFn: () => ipdService.wards.list(),
  });

  // Fetch current admissions with auto-refresh
  const { data: admissionsData, isLoading: admissionsLoading, refetch: refetchAdmissions } = useQuery({
    queryKey: ['admissions-active'],
    queryFn: () => ipdService.admissions.list({ status: 'admitted', limit: 100 }),
    refetchInterval: AUTO_REFRESH_INTERVAL,
  });

  // Fetch medication schedules for all active admissions
  const today = new Date().toISOString().split('T')[0];
  const { data: medicationsMap = new Map(), isLoading: medsLoading, refetch: refetchMeds } = useQuery({
    queryKey: ['medications-today', today],
    queryFn: async () => {
      const admissions = admissionsData?.data || [];
      const map = new Map<string, MedicationAdministration[]>();
      await Promise.all(
        admissions.map(async (admission) => {
          try {
            const meds = await ipdService.medications.list(admission.id, today);
            map.set(admission.id, meds);
          } catch {
            map.set(admission.id, []);
          }
        })
      );
      return map;
    },
    enabled: !!admissionsData?.data?.length,
    refetchInterval: AUTO_REFRESH_INTERVAL,
  });

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    refetchAdmissions();
    refetchMeds();
    setLastRefresh(new Date());
    toast.success('Schedule refreshed');
  }, [refetchAdmissions, refetchMeds]);

  // Quick administer mutation
  const administerMutation = useMutation({
    mutationFn: (params: { medId: string; admissionId: string; status: 'given' | 'held' | 'refused' }) =>
      ipdService.medications.administer(params.medId, { status: params.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications-today'] });
      toast.success('Medication status updated');
      setShowDetailsModal(false);
    },
    onError: () => {
      toast.error('Failed to update medication status');
    },
  });

  // Transform API data to component format
  const schedule: ScheduledMed[] = useMemo(() => {
    const admissions = admissionsData?.data || [];
    const result: ScheduledMed[] = [];

    admissions.forEach((admission) => {
      const meds = medicationsMap.get(admission.id) || [];
      meds.forEach((med: MedicationAdministration) => {
        // Determine if overdue or IV, etc. based on route/name patterns
        const routeLower = (med.route || '').toLowerCase();
        const isIV = routeLower.includes('iv') || routeLower.includes('intravenous');
        const drugLower = (med.drugName || '').toLowerCase();
        const isControlled = drugLower.includes('morphine') || drugLower.includes('tramadol') || 
                            drugLower.includes('fentanyl') || drugLower.includes('codeine');
        const isPRN = med.notes?.toLowerCase().includes('prn') || false;

        result.push({
          id: med.id,
          admissionId: admission.id,
          patientId: admission.patientId,
          patientName: admission.patient?.fullName || 'Unknown',
          patientMrn: admission.patient?.mrn || 'N/A',
          ward: admission.ward?.name || 'N/A',
          wardId: admission.wardId,
          bed: admission.bed?.bedNumber || 'N/A',
          medication: med.drugName,
          genericName: med.drugName,
          dose: med.dose,
          route: med.route,
          frequency: 'As scheduled',
          scheduledTime: med.scheduledTime,
          status: med.status,
          priority: 'routine',
          prescribedBy: 'Dr. Attending',
          startDate: med.createdAt,
          specialInstructions: med.notes,
          isControlled,
          isIV,
          isPRN,
          allergies: [],
          administrationHistory: med.administeredTime ? [{
            time: med.administeredTime,
            status: med.status,
            givenBy: med.administeredBy?.fullName,
            notes: med.notes,
          }] : [],
        });
      });
    });

    return result;
  }, [admissionsData, medicationsMap]);

  // Check medication timing status
  const getMedTimingStatus = useCallback((med: ScheduledMed): 'due-now' | 'overdue' | 'upcoming' | 'passed' => {
    if (med.status !== 'scheduled') return 'passed';
    
    const scheduledDate = parseScheduledTime(med.scheduledTime);
    const diffMins = (scheduledDate.getTime() - currentTime.getTime()) / (1000 * 60);
    
    if (diffMins < -30) return 'overdue';
    if (diffMins >= -30 && diffMins <= 30) return 'due-now';
    return 'upcoming';
  }, [currentTime]);

  // Apply filters
  const filteredMeds = useMemo(() => {
    let result = schedule;

    // Ward filter
    if (selectedWard !== 'all') {
      result = result.filter(m => m.wardId === selectedWard);
    }

    // Patient filter
    if (selectedPatient) {
      result = result.filter(m => m.patientId === selectedPatient);
    }

    // Time slot filter
    if (selectedTimeSlot) {
      result = result.filter(m => getTimeSlotForTime(m.scheduledTime) === selectedTimeSlot);
    }

    // Quick filters
    switch (quickFilter) {
      case 'due-now':
        result = result.filter(m => getMedTimingStatus(m) === 'due-now');
        break;
      case 'overdue':
        result = result.filter(m => getMedTimingStatus(m) === 'overdue');
        break;
      case 'iv':
        result = result.filter(m => m.isIV);
        break;
      case 'controlled':
        result = result.filter(m => m.isControlled);
        break;
      case 'prn':
        result = result.filter(m => m.isPRN);
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.patientName.toLowerCase().includes(query) ||
        m.medication.toLowerCase().includes(query) ||
        m.patientMrn.toLowerCase().includes(query)
      );
    }

    return result;
  }, [schedule, selectedWard, selectedPatient, selectedTimeSlot, quickFilter, searchQuery, getMedTimingStatus]);

  // Get unique patients for patient view
  const uniquePatients = useMemo(() => {
    const patientMap = new Map<string, { id: string; name: string; mrn: string; ward: string; bed: string }>();
    schedule.forEach(m => {
      if (!patientMap.has(m.patientId)) {
        patientMap.set(m.patientId, { 
          id: m.patientId, 
          name: m.patientName, 
          mrn: m.patientMrn,
          ward: m.ward,
          bed: m.bed
        });
      }
    });
    return Array.from(patientMap.values());
  }, [schedule]);

  // Statistics
  const stats = useMemo(() => {
    const overdue = schedule.filter(m => getMedTimingStatus(m) === 'overdue').length;
    const dueNow = schedule.filter(m => getMedTimingStatus(m) === 'due-now').length;
    const given = schedule.filter(m => m.status === 'given').length;
    const pending = schedule.filter(m => m.status === 'scheduled').length;
    return { overdue, dueNow, given, pending, total: schedule.length };
  }, [schedule, getMedTimingStatus]);

  // Sound alert for overdue meds
  useEffect(() => {
    if (soundEnabled && stats.overdue > 0) {
      // Play alert sound (using Web Audio API beep)
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.1;
        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
      } catch (e) {
        // Audio not supported
      }
    }
  }, [soundEnabled, stats.overdue]);

  const isLoading = admissionsLoading || medsLoading;

  // Status badge component
  const getStatusBadge = (status: string, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
    switch (status) {
      case 'scheduled':
        return <span className={`${sizeClass} font-medium rounded bg-yellow-100 text-yellow-700`}>Pending</span>;
      case 'given':
        return <span className={`${sizeClass} font-medium rounded bg-green-100 text-green-700`}>Given</span>;
      case 'missed':
        return <span className={`${sizeClass} font-medium rounded bg-red-100 text-red-700`}>Missed</span>;
      case 'held':
        return <span className={`${sizeClass} font-medium rounded bg-gray-100 text-gray-700`}>Held</span>;
      case 'refused':
        return <span className={`${sizeClass} font-medium rounded bg-orange-100 text-orange-700`}>Refused</span>;
      default:
        return null;
    }
  };

  const getTimingBadge = (med: ScheduledMed) => {
    const timing = getMedTimingStatus(med);
    switch (timing) {
      case 'overdue':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-500 text-white animate-pulse">OVERDUE</span>;
      case 'due-now':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-500 text-white">DUE NOW</span>;
      default:
        return null;
    }
  };

  // Ward Grid View Component
  const WardGridView = () => {
    // Group meds by patient for grid
    const gridData = useMemo(() => {
      const patientMeds = new Map<string, Map<string, ScheduledMed[]>>();
      
      filteredMeds.forEach(med => {
        if (!patientMeds.has(med.patientId)) {
          patientMeds.set(med.patientId, new Map());
        }
        const timeSlot = getTimeSlotForTime(med.scheduledTime);
        const patientTimeSlots = patientMeds.get(med.patientId)!;
        if (!patientTimeSlots.has(timeSlot)) {
          patientTimeSlots.set(timeSlot, []);
        }
        patientTimeSlots.get(timeSlot)!.push(med);
      });

      return patientMeds;
    }, [filteredMeds]);

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 w-48">
                  Patient / Bed
                </th>
                {TIME_SLOTS.map((slot, idx) => {
                  const isCurrentSlot = getTimeSlotForTime(currentTime.toTimeString().slice(0, 5)) === slot;
                  return (
                    <th 
                      key={slot} 
                      className={`px-2 py-3 text-center text-xs font-semibold w-24 ${
                        isCurrentSlot ? 'bg-teal-100 text-teal-800' : 'text-gray-600'
                      }`}
                    >
                      {TIME_SLOT_LABELS[idx]}
                      {isCurrentSlot && <div className="text-[10px] text-teal-600">NOW</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {uniquePatients
                .filter(p => selectedWard === 'all' || schedule.find(m => m.patientId === p.id && m.wardId === selectedWard))
                .map(patient => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-4 py-3 border-r border-gray-100">
                    <div className="font-medium text-gray-900 text-sm truncate">{patient.name}</div>
                    <div className="text-xs text-gray-500">{patient.ward} - {patient.bed}</div>
                  </td>
                  {TIME_SLOTS.map(slot => {
                    const meds = gridData.get(patient.id)?.get(slot) || [];
                    const isCurrentSlot = getTimeSlotForTime(currentTime.toTimeString().slice(0, 5)) === slot;
                    
                    return (
                      <td 
                        key={slot} 
                        className={`px-1 py-2 text-center align-top ${isCurrentSlot ? 'bg-teal-50' : ''}`}
                      >
                        <div className="flex flex-col gap-1">
                          {meds.map(med => {
                            const timing = getMedTimingStatus(med);
                            let bgColor = 'bg-gray-100';
                            let textColor = 'text-gray-700';
                            if (med.status === 'given') {
                              bgColor = 'bg-green-100';
                              textColor = 'text-green-700';
                            } else if (timing === 'overdue') {
                              bgColor = 'bg-red-100';
                              textColor = 'text-red-700';
                            } else if (timing === 'due-now') {
                              bgColor = 'bg-amber-100';
                              textColor = 'text-amber-700';
                            }
                            
                            return (
                              <button
                                key={med.id}
                                onClick={() => { setSelectedMed(med); setShowDetailsModal(true); }}
                                className={`${bgColor} ${textColor} px-1.5 py-1 rounded text-[10px] font-medium truncate w-full text-left hover:opacity-80 transition-opacity`}
                                title={`${med.medication} - ${med.dose}`}
                              >
                                {med.medication.slice(0, 10)}...
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {uniquePatients.length === 0 && (
                <tr>
                  <td colSpan={TIME_SLOTS.length + 1} className="text-center py-12 text-gray-500">
                    <Pill className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No medications scheduled</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Patient Card View Component
  const PatientScheduleCard = ({ patientId }: { patientId: string }) => {
    const patientMeds = filteredMeds.filter(m => m.patientId === patientId);
    const patient = uniquePatients.find(p => p.id === patientId);

    if (!patient) return null;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{patient.name}</h3>
            <p className="text-sm text-gray-500">{patient.mrn} • {patient.ward} - {patient.bed}</p>
          </div>
        </div>

        <div className="space-y-3">
          {patientMeds.length > 0 ? patientMeds.map(med => {
            const timing = getMedTimingStatus(med);
            let borderColor = 'border-gray-200';
            if (med.status === 'given') borderColor = 'border-green-300';
            else if (timing === 'overdue') borderColor = 'border-red-300';
            else if (timing === 'due-now') borderColor = 'border-amber-300';

            return (
              <div 
                key={med.id} 
                className={`p-3 rounded-lg border-2 ${borderColor} cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => { setSelectedMed(med); setShowDetailsModal(true); }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Pill className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-gray-900">{med.medication}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getTimingBadge(med)}
                    {getStatusBadge(med.status, 'sm')}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                  <div><span className="text-gray-400">Dose:</span> {med.dose}</div>
                  <div><span className="text-gray-400">Route:</span> {med.route}</div>
                  <div><span className="text-gray-400">Freq:</span> {med.frequency}</div>
                  <div><span className="text-gray-400">Due:</span> {formatTime(med.scheduledTime)}</div>
                </div>
                {med.status === 'scheduled' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      administerMutation.mutate({ medId: med.id, admissionId: med.admissionId, status: 'given' });
                    }}
                    disabled={administerMutation.isPending}
                    className="w-full mt-2 px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {administerMutation.isPending ? 'Processing...' : 'Give Now'}
                  </button>
                )}
              </div>
            );
          }) : (
            <p className="text-center text-gray-500 py-4">No medications for this patient</p>
          )}
        </div>
      </div>
    );
  };

  // Time View Component
  const TimeView = () => (
    <div className="space-y-4">
      {TIME_SLOTS.map((slot, idx) => {
        const slotMeds = filteredMeds.filter(m => getTimeSlotForTime(m.scheduledTime) === slot);
        const isCurrentSlot = getTimeSlotForTime(currentTime.toTimeString().slice(0, 5)) === slot;
        
        if (slotMeds.length === 0) return null;

        return (
          <div 
            key={slot} 
            className={`bg-white rounded-xl border-2 ${isCurrentSlot ? 'border-teal-400' : 'border-gray-200'} overflow-hidden`}
          >
            <div className={`px-4 py-2 ${isCurrentSlot ? 'bg-teal-50' : 'bg-gray-50'} border-b`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold ${isCurrentSlot ? 'text-teal-800' : 'text-gray-700'}`}>
                  {TIME_SLOT_LABELS[idx]} ({slot})
                </h3>
                <span className="text-sm text-gray-500">{slotMeds.length} medication(s)</span>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {slotMeds.map(med => (
                <div 
                  key={med.id}
                  onClick={() => { setSelectedMed(med); setShowDetailsModal(true); }}
                  className="p-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4"
                >
                  <div className={`w-2 h-12 rounded-full ${
                    med.status === 'given' ? 'bg-green-500' :
                    getMedTimingStatus(med) === 'overdue' ? 'bg-red-500' :
                    getMedTimingStatus(med) === 'due-now' ? 'bg-amber-500' : 'bg-gray-300'
                  }`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{med.medication}</span>
                      {getTimingBadge(med)}
                      {getStatusBadge(med.status, 'sm')}
                    </div>
                    <p className="text-sm text-gray-500">
                      {med.patientName} • {med.ward} - {med.bed}
                    </p>
                    <p className="text-xs text-gray-400">{med.dose} • {med.route}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Patient List View Component  
  const PatientListView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {uniquePatients.length > 0 ? uniquePatients.map(patient => (
        <PatientScheduleCard key={patient.id} patientId={patient.id} />
      )) : (
        <div className="col-span-2 text-center py-12 text-gray-500">
          <User className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No patients with scheduled medications</p>
        </div>
      )}
    </div>
  );

  // Medication Details Modal
  const MedicationDetailsModal = () => {
    if (!selectedMed || !showDetailsModal) return null;

    const timing = getMedTimingStatus(selectedMed);
    const hasAllergies = selectedMed.allergies && selectedMed.allergies.length > 0;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Pill className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{selectedMed.medication}</h2>
                {selectedMed.genericName && selectedMed.genericName !== selectedMed.medication && (
                  <p className="text-sm text-gray-500">{selectedMed.genericName}</p>
                )}
              </div>
            </div>
            <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Allergy Warning */}
            {hasAllergies && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-semibold">Allergy Alert!</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  Patient allergies: {selectedMed.allergies?.join(', ')}
                </p>
              </div>
            )}

            {/* Timing Status */}
            {timing !== 'passed' && timing !== 'upcoming' && (
              <div className={`p-3 rounded-lg border ${
                timing === 'overdue' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${timing === 'overdue' ? 'text-red-600' : 'text-amber-600'}`} />
                  <span className={`font-medium ${timing === 'overdue' ? 'text-red-700' : 'text-amber-700'}`}>
                    {timing === 'overdue' ? 'This medication is overdue!' : 'This medication is due now'}
                  </span>
                </div>
              </div>
            )}

            {/* Patient Info */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <UserCircle className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">Patient Information</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Name:</span> {selectedMed.patientName}</div>
                <div><span className="text-gray-500">MRN:</span> {selectedMed.patientMrn}</div>
                <div><span className="text-gray-500">Ward:</span> {selectedMed.ward}</div>
                <div><span className="text-gray-500">Bed:</span> {selectedMed.bed}</div>
              </div>
            </div>

            {/* Medication Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Dose</p>
                <p className="font-medium text-gray-900">{selectedMed.dose}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Route</p>
                <p className="font-medium text-gray-900">{selectedMed.route}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Frequency</p>
                <p className="font-medium text-gray-900">{selectedMed.frequency || 'As scheduled'}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Scheduled Time</p>
                <p className="font-medium text-gray-900">{formatTime(selectedMed.scheduledTime)}</p>
              </div>
            </div>

            {/* Prescription Info */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900">Prescription Details</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-blue-600">Prescribed by:</span> {selectedMed.prescribedBy || 'N/A'}</div>
                <div><span className="text-blue-600">Start Date:</span> {selectedMed.startDate ? new Date(selectedMed.startDate).toLocaleDateString() : 'N/A'}</div>
                <div><span className="text-blue-600">Duration:</span> {selectedMed.duration || 'Ongoing'}</div>
                <div><span className="text-blue-600">Status:</span> {getStatusBadge(selectedMed.status)}</div>
              </div>
            </div>

            {/* Special Instructions */}
            {selectedMed.specialInstructions && (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Special Instructions</span>
                </div>
                <p className="text-sm text-yellow-700">{selectedMed.specialInstructions}</p>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {selectedMed.isIV && (
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                  <Syringe className="w-3 h-3" /> IV Medication
                </span>
              )}
              {selectedMed.isControlled && (
                <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Controlled Substance
                </span>
              )}
              {selectedMed.isPRN && (
                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                  PRN
                </span>
              )}
            </div>

            {/* Administration History */}
            {selectedMed.administrationHistory && selectedMed.administrationHistory.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Administration History</span>
                </div>
                <div className="space-y-2">
                  {selectedMed.administrationHistory.map((history, idx) => (
                    <div key={idx} className="text-sm flex items-center justify-between p-2 bg-white rounded">
                      <div>
                        <span className="text-gray-500">{new Date(history.time).toLocaleString()}</span>
                        <span className="mx-2">•</span>
                        <span className="capitalize">{history.status}</span>
                        {history.givenBy && <span className="text-gray-400"> by {history.givenBy}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {selectedMed.status === 'scheduled' && (
            <div className="p-4 border-t border-gray-200 space-y-3">
              {/* 5 Rights Verification Button - Primary Action */}
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  navigate('/nursing/meds/administer', { 
                    state: { 
                      medication: selectedMed,
                      nextMedication: medications.find(m => m.id !== selectedMed.id && m.status === 'scheduled')
                    } 
                  });
                }}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-5 h-5" />
                5 Rights Verification
              </button>
              
              {/* Quick Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => administerMutation.mutate({ medId: selectedMed.id, admissionId: selectedMed.admissionId, status: 'given' })}
                  disabled={administerMutation.isPending}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Quick Give
                </button>
                <button
                  onClick={() => administerMutation.mutate({ medId: selectedMed.id, admissionId: selectedMed.admissionId, status: 'held' })}
                  disabled={administerMutation.isPending}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                >
                  <PauseCircle className="w-4 h-4" />
                  Hold
                </button>
                <button
                  onClick={() => administerMutation.mutate({ medId: selectedMed.id, admissionId: selectedMed.admissionId, status: 'refused' })}
                  disabled={administerMutation.isPending}
                  className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 disabled:opacity-50 flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Refused
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Legend Modal
  const LegendModal = () => {
    if (!showLegend) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="font-semibold text-gray-900">Legend</h2>
            <button onClick={() => setShowLegend(false)} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Status Colors</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span className="text-sm">Given - Medication administered</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-yellow-500" />
                  <span className="text-sm">Pending - Awaiting administration</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-amber-500" />
                  <span className="text-sm">Due Now - Within ±30 minutes</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span className="text-sm">Overdue - Past scheduled time by 30+ min</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-gray-500" />
                  <span className="text-sm">Held - Temporarily on hold</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-orange-500" />
                  <span className="text-sm">Refused - Patient refused</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Medication Tags</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                    <Syringe className="w-3 h-3" /> IV
                  </span>
                  <span className="text-sm">Intravenous medication</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Controlled
                  </span>
                  <span className="text-sm">Controlled substance</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">PRN</span>
                  <span className="text-sm">As needed medication</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // No access fallback
  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <PermissionGate permissions={['pharmacy.read', 'nursing.read']}>
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Clock className="w-6 h-6 text-teal-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Medication Schedule</h1>
                <p className="text-sm text-gray-500">View and manage medication administration</p>
              </div>
            </div>
          </div>
          
          {/* Current Time Display */}
          <div className="flex items-center gap-4">
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-2 text-center">
              <p className="text-2xl font-bold text-teal-700 font-mono">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-xs text-teal-600">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg ${soundEnabled ? 'bg-teal-100 text-teal-700' : 'hover:bg-gray-100'}`}
                title={soundEnabled ? 'Disable sound alerts' : 'Enable sound alerts'}
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowLegend(true)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="View legend"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-3">
            <p className="text-xs text-amber-600">Due Now</p>
            <p className="text-xl font-bold text-amber-700">{stats.dueNow}</p>
          </div>
          <div className="bg-red-50 rounded-xl border border-red-200 p-3">
            <p className="text-xs text-red-600">Overdue</p>
            <p className="text-xl font-bold text-red-700">{stats.overdue}</p>
          </div>
          <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-3">
            <p className="text-xs text-yellow-600">Pending</p>
            <p className="text-xl font-bold text-yellow-700">{stats.pending}</p>
          </div>
          <div className="bg-green-50 rounded-xl border border-green-200 p-3">
            <p className="text-xs text-green-600">Given</p>
            <p className="text-xl font-bold text-green-700">{stats.given}</p>
          </div>
        </div>

        {/* View Mode Tabs & Filters */}
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('ward')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'ward' ? 'bg-white shadow text-teal-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              Ward View
            </button>
            <button
              onClick={() => setViewMode('patient')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'patient' ? 'bg-white shadow text-teal-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-4 h-4" />
              Patient View
            </button>
            <button
              onClick={() => setViewMode('time')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'time' ? 'bg-white shadow text-teal-700' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              Time View
            </button>
          </div>

          {/* Ward Selector */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="all">All Wards</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>{ward.name}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient or medication..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {[
            { key: 'all', label: 'All', icon: null },
            { key: 'due-now', label: 'Due Now (1hr)', icon: Clock },
            { key: 'overdue', label: 'Overdue', icon: AlertCircle },
            { key: 'iv', label: 'IV Meds', icon: Syringe },
            { key: 'controlled', label: 'Controlled', icon: Shield },
            { key: 'prn', label: 'PRN', icon: Activity },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setQuickFilter(key as QuickFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                quickFilter === key
                  ? 'bg-teal-100 text-teal-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {label}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : viewMode === 'ward' ? (
            <WardGridView />
          ) : viewMode === 'patient' ? (
            <PatientListView />
          ) : (
            <TimeView />
          )}
        </div>

        {/* Last refresh indicator */}
        <div className="mt-2 text-xs text-gray-400 text-center">
          Last refreshed: {lastRefresh.toLocaleTimeString()} • Auto-refresh every 60 seconds
        </div>

        {/* Modals */}
        <MedicationDetailsModal />
        <LegendModal />
      </div>
    </PermissionGate>
  );
}
