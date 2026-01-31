import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Syringe,
  Calendar,
  Clock,
  User,
  Plus,
  CheckCircle,
  AlertCircle,
  FileText,
  ClipboardList,
  Activity,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Timer,
  Play,
  Pause,
  CheckSquare,
  Square,
  Edit,
  Eye,
  Loader2,
  X,
} from 'lucide-react';
import api from '../../services/api';

interface SurgeryCase {
  id: string;
  caseNumber: string;
  procedureName: string;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDurationMinutes: number;
  status: string;
  priority: string;
  surgeryType: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
  };
  theatre: {
    id: string;
    name: string;
    code: string;
  };
  leadSurgeon?: {
    firstName: string;
    lastName: string;
  };
}

interface Theatre {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
}

interface SurgeryDashboard {
  todayScheduledCount: number;
  inProgressCount: number;
  inProgressCases: SurgeryCase[];
  postOpCount: number;
  postOpCases: SurgeryCase[];
  theatres: Theatre[];
  theatreAvailable: number;
  theatreInUse: number;
}

interface Admission {
  id: string;
  admissionNumber: string;
  status: string;
  admissionDate: string;
  primaryDiagnosis?: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
  };
  bed?: {
    id: string;
    bedNumber: string;
    ward?: {
      id: string;
      name: string;
    };
  };
  attendingDoctor?: {
    firstName: string;
    lastName: string;
  };
}

// Get facilityId from localStorage or use default
const getFacilityId = () => localStorage.getItem('facilityId') || '';

export default function TheatrePage() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'list'>('schedule');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<SurgeryCase | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Admission | null>(null);
  const [bookingForm, setBookingForm] = useState({
    theatreId: '',
    priority: 'elective',
    procedureName: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '08:00',
    estimatedDurationMinutes: 60,
    diagnosis: '',
  });
  const queryClient = useQueryClient();
  const facilityId = getFacilityId();

  // Schedule surgery mutation
  const scheduleSurgeryMutation = useMutation({
    mutationFn: async (data: typeof bookingForm & { patientId: string }) => {
      const res = await api.post('/surgery/cases', {
        ...data,
        facilityId,
        surgeryType: 'major',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgery-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['surgery-dashboard'] });
      setShowBookingModal(false);
      setSelectedPatient(null);
      setBookingForm({
        theatreId: '',
        priority: 'elective',
        procedureName: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledTime: '08:00',
        estimatedDurationMinutes: 60,
        diagnosis: '',
      });
    },
  });

  // Start surgery mutation
  const startSurgeryMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const res = await api.put(`/surgery/cases/${caseId}/start`, {
        actualStartTime: new Date().toISOString(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgery-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['surgery-dashboard'] });
      setShowDetailsModal(false);
      setSelectedSurgery(null);
    },
  });

  // Complete surgery mutation
  const completeSurgeryMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const res = await api.put(`/surgery/cases/${caseId}/complete`, {
        actualEndTime: new Date().toISOString(),
        outcome: 'successful',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgery-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['surgery-dashboard'] });
      setShowDetailsModal(false);
      setSelectedSurgery(null);
    },
  });

  // Cancel surgery mutation
  const cancelSurgeryMutation = useMutation({
    mutationFn: async ({ caseId, reason }: { caseId: string; reason: string }) => {
      const res = await api.put(`/surgery/cases/${caseId}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgery-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['surgery-dashboard'] });
      setShowDetailsModal(false);
      setSelectedSurgery(null);
    },
  });

  const handleScheduleSurgery = () => {
    if (!selectedPatient || !bookingForm.theatreId || !bookingForm.procedureName) return;
    scheduleSurgeryMutation.mutate({
      ...bookingForm,
      patientId: selectedPatient.patient.id,
    });
  };

  // Fetch surgery dashboard stats
  const { data: dashboard } = useQuery({
    queryKey: ['surgery-dashboard', facilityId],
    queryFn: async () => {
      if (!facilityId) return null;
      const res = await api.get('/surgery/dashboard', { params: { facilityId } });
      return res.data as SurgeryDashboard;
    },
    enabled: !!facilityId,
  });

  // Fetch schedule for selected date
  const { data: schedule = [], isLoading: scheduleLoading } = useQuery({
    queryKey: ['surgery-schedule', facilityId, selectedDate],
    queryFn: async () => {
      if (!facilityId) return [];
      const res = await api.get('/surgery/schedule/date', { params: { facilityId, date: selectedDate } });
      return res.data as SurgeryCase[];
    },
    enabled: !!facilityId,
  });

  // Fetch theatres
  const { data: theatres = [] } = useQuery({
    queryKey: ['theatres', facilityId],
    queryFn: async () => {
      if (!facilityId) return [];
      const res = await api.get('/surgery/theatres', { params: { facilityId } });
      return res.data as Theatre[];
    },
    enabled: !!facilityId,
  });

  // Fetch active admissions for booking
  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['theatre-admissions'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'active' } });
      return res.data as Admission[];
    },
  });

  const filteredAdmissions = useMemo(() => {
    return admissions.filter(
      (a) =>
        `${a.patient.firstName} ${a.patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.primaryDiagnosis && a.primaryDiagnosis.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, admissions]);

  const getAge = (dob?: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-700',
      pre_op: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-green-100 text-green-700',
      post_op: 'bg-purple-100 text-purple-700',
      completed: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      elective: 'bg-blue-50 text-blue-600 border-blue-200',
      urgent: 'bg-orange-50 text-orange-600 border-orange-200',
      emergency: 'bg-red-50 text-red-600 border-red-200',
    };
    return colors[priority] || 'bg-gray-50 text-gray-600 border-gray-200';
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Syringe className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Theatre Management</h1>
            <p className="text-sm text-gray-500">Schedule and manage surgical procedures</p>
          </div>
        </div>
        <button 
          onClick={() => setShowBookingModal(true)}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Book Surgery
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.todayScheduledCount || 0}</p>
              <p className="text-sm text-gray-500">Today's Surgeries</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{theatres.length}</p>
              <p className="text-sm text-gray-500">Theatres ({dashboard?.theatreAvailable || 0} available)</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{dashboard?.inProgressCount || 0}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{dashboard?.postOpCount || 0}</p>
              <p className="text-sm text-gray-500">Post-Op Recovery</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'schedule' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Schedule
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'list' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ClipboardList className="w-4 h-4 inline mr-2" />
          Eligible Patients
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {activeTab === 'schedule' ? (
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigateDate('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  <p className="text-sm text-gray-500">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                </div>
                <button 
                  onClick={() => navigateDate('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <button 
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-4 py-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {scheduleLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : schedule.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                  <Syringe className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="font-medium text-lg">No surgeries scheduled</p>
                  <p className="text-sm">No surgeries scheduled for this date</p>
                  <button 
                    onClick={() => setShowBookingModal(true)}
                    className="mt-4 px-4 py-2 text-teal-600 border border-teal-300 rounded-lg hover:bg-teal-50"
                  >
                    <Plus className="w-4 h-4 inline mr-2" />
                    Book a Surgery
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedule.map((surgery) => (
                    <div
                      key={surgery.id}
                      className={`p-4 rounded-lg border ${getPriorityColor(surgery.priority)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="text-center min-w-[60px]">
                            <p className="text-lg font-bold text-gray-900">{surgery.scheduledTime}</p>
                            <p className="text-xs text-gray-500">{surgery.estimatedDurationMinutes}min</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{surgery.procedureName}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(surgery.status)}`}>
                                {surgery.status.replace('_', ' ')}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              {surgery.patient.firstName} {surgery.patient.lastName} • {getAge(surgery.patient.dateOfBirth)}y
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>Theatre: {surgery.theatre.name}</span>
                              <span>Case: {surgery.caseNumber}</span>
                              {surgery.leadSurgeon && (
                                <span>Surgeon: Dr. {surgery.leadSurgeon.lastName}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {surgery.status === 'scheduled' && (
                            <button 
                              onClick={() => startSurgeryMutation.mutate(surgery.id)}
                              disabled={startSurgeryMutation.isPending}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              <Play className="w-3 h-3 inline mr-1" />
                              Start
                            </button>
                          )}
                          {surgery.status === 'in_progress' && (
                            <button 
                              onClick={() => completeSurgeryMutation.mutate(surgery.id)}
                              disabled={completeSurgeryMutation.isPending}
                              className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                              <CheckSquare className="w-3 h-3 inline mr-1" />
                              Complete
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedSurgery(surgery);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Eligible Patients List View */
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="flex items-center gap-4 p-4 border-b border-gray-200">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search inpatients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <span className="text-sm text-gray-500">
                {filteredAdmissions.length} eligible patients
              </span>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4">
              {filteredAdmissions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <User className="w-12 h-12 text-gray-300 mb-3" />
                  <p className="font-medium">No eligible patients</p>
                  <p className="text-sm">Active inpatients will appear here for surgery booking</p>
                </div>
              ) : (
              <div className="space-y-3">
                {filteredAdmissions.map((admission) => (
                  <div
                    key={admission.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-lg border border-gray-200">
                          <User className="w-6 h-6 text-teal-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">
                              {admission.patient.firstName} {admission.patient.lastName}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 capitalize">
                              {admission.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {getAge(admission.patient.dateOfBirth)}y, {admission.patient.gender || 'N/A'} • #{admission.admissionNumber}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-4 h-4" />
                              {admission.primaryDiagnosis || 'No diagnosis'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Admitted: {new Date(admission.admissionDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedPatient(admission);
                            setShowBookingModal(true);
                          }}
                          className="px-4 py-2 text-teal-600 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors"
                        >
                          <Plus className="w-4 h-4 inline mr-2" />
                          Book Surgery
                        </button>
                        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Book Surgery</h2>
                <button
                  onClick={() => {
                    setShowBookingModal(false);
                    setSelectedPatient(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {selectedPatient && (
                <div className="mb-6 p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <p className="text-sm text-teal-600 font-medium mb-1">Selected Patient</p>
                  <p className="font-semibold text-gray-900">
                    {selectedPatient.patient.firstName} {selectedPatient.patient.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    #{selectedPatient.admissionNumber} • {selectedPatient.primaryDiagnosis || 'No diagnosis'}
                  </p>
                </div>
              )}
              
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Theatre</label>
                    <select 
                      value={bookingForm.theatreId}
                      onChange={(e) => setBookingForm({ ...bookingForm, theatreId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select theatre...</option>
                      {theatres.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select 
                      value={bookingForm.priority}
                      onChange={(e) => setBookingForm({ ...bookingForm, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="elective">Elective</option>
                      <option value="urgent">Urgent</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name</label>
                  <input
                    type="text"
                    value={bookingForm.procedureName}
                    onChange={(e) => setBookingForm({ ...bookingForm, procedureName: e.target.value })}
                    placeholder="e.g., Appendectomy"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={bookingForm.scheduledDate}
                      onChange={(e) => setBookingForm({ ...bookingForm, scheduledDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                    <input
                      type="time"
                      value={bookingForm.scheduledTime}
                      onChange={(e) => setBookingForm({ ...bookingForm, scheduledTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                    <input
                      type="number"
                      value={bookingForm.estimatedDurationMinutes}
                      onChange={(e) => setBookingForm({ ...bookingForm, estimatedDurationMinutes: parseInt(e.target.value) || 60 })}
                      placeholder="60"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                  <textarea
                    rows={2}
                    value={bookingForm.diagnosis}
                    onChange={(e) => setBookingForm({ ...bookingForm, diagnosis: e.target.value })}
                    placeholder="Pre-operative diagnosis..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </form>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowBookingModal(false);
                    setSelectedPatient(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleScheduleSurgery}
                  disabled={scheduleSurgeryMutation.isPending || !bookingForm.theatreId || !bookingForm.procedureName}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scheduleSurgeryMutation.isPending ? (
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 inline mr-2" />
                  )}
                  Schedule Surgery
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Surgery Details Modal */}
      {showDetailsModal && selectedSurgery && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Surgery Details</h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedSurgery(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Case Number</span>
                <span className="font-medium">{selectedSurgery.caseNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedSurgery.status)}`}>
                  {selectedSurgery.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Patient</span>
                <span className="font-medium">{selectedSurgery.patient.firstName} {selectedSurgery.patient.lastName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Procedure</span>
                <span className="font-medium">{selectedSurgery.procedureName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Theatre</span>
                <span className="font-medium">{selectedSurgery.theatre.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Scheduled</span>
                <span className="font-medium">{selectedSurgery.scheduledDate} at {selectedSurgery.scheduledTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Duration</span>
                <span className="font-medium">{selectedSurgery.estimatedDurationMinutes} minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Priority</span>
                <span className={`px-2 py-1 rounded text-xs font-medium border ${getPriorityColor(selectedSurgery.priority)}`}>
                  {selectedSurgery.priority}
                </span>
              </div>
              {selectedSurgery.leadSurgeon && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Lead Surgeon</span>
                  <span className="font-medium">Dr. {selectedSurgery.leadSurgeon.firstName} {selectedSurgery.leadSurgeon.lastName}</span>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 flex flex-wrap gap-2">
                {selectedSurgery.status === 'scheduled' && (
                  <>
                    <button 
                      onClick={() => startSurgeryMutation.mutate(selectedSurgery.id)}
                      disabled={startSurgeryMutation.isPending}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 inline mr-2" />
                      Start Surgery
                    </button>
                    <button 
                      onClick={() => {
                        const reason = prompt('Reason for cancellation:');
                        if (reason) cancelSurgeryMutation.mutate({ caseId: selectedSurgery.id, reason });
                      }}
                      disabled={cancelSurgeryMutation.isPending}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {selectedSurgery.status === 'in_progress' && (
                  <button 
                    onClick={() => completeSurgeryMutation.mutate(selectedSurgery.id)}
                    disabled={completeSurgeryMutation.isPending}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    <CheckSquare className="w-4 h-4 inline mr-2" />
                    Complete Surgery
                  </button>
                )}
                {selectedSurgery.status === 'post_op' && (
                  <button 
                    onClick={async () => {
                      await api.put(`/surgery/cases/${selectedSurgery.id}/discharge-recovery`);
                      queryClient.invalidateQueries({ queryKey: ['surgery-schedule'] });
                      queryClient.invalidateQueries({ queryKey: ['surgery-dashboard'] });
                      setShowDetailsModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Discharge from Recovery
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
