import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usePatientStore, type PatientRecord } from '../store/patients';
import { queueService, type QueueEntry, type CreateQueueEntryDto } from '../services/queue';
import { patientsService } from '../services/patients';
import { usersService } from '../services/users';
import {
  Search,
  Loader2,
  UserCircle,
  Receipt,
  Printer,
  CheckCircle,
  Clock,
  Calendar,
  Stethoscope,
  Users,
  Shield,
  CreditCard,
  Banknote,
  ExternalLink,
  X,
} from 'lucide-react';

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  department: string;
  available: boolean;
  currentQueue: number;
}

export default function OPDTokenPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const localSearchPatients = usePatientStore((state) => state.searchPatients);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState('general');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('any'); // 'any' or doctor id
  const [issuedToken, setIssuedToken] = useState<QueueEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const CONSULTATION_FEE = 50000; // UGX

  // Search patients from API with fallback to local store
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Combine API results with local store
  const localPatients = localSearchPatients(searchTerm);
  const patients = searchTerm.length >= 2 
    ? [...(apiPatients?.data || []).map(p => ({
        ...p,
        paymentType: 'cash' as const,
      })), ...localPatients.filter(lp => !apiPatients?.data?.some(ap => ap.id === lp.id))]
    : localPatients;

  // Fetch queue statistics
  const { data: queueStats } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => queueService.getStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch today's queue
  const { data: todayQueue } = useQuery({
    queryKey: ['queue-today'],
    queryFn: () => queueService.getQueue({ date: new Date().toISOString().split('T')[0] }),
    refetchInterval: 30000,
  });

  // Fetch doctors (users with Doctor role)
  const { data: usersData } = useQuery({
    queryKey: ['users-doctors'],
    queryFn: () => usersService.list({ limit: 100 }),
    staleTime: 60000,
  });

  // Map users to doctors format - filter by role containing "doctor"
  const availableDoctors: Doctor[] = useMemo(() => {
    const users = usersData?.data || [];
    return users
      .filter(u => {
        const roles = u.roles?.map(r => r.name.toLowerCase()) || [];
        return roles.some(r => r.includes('doctor') || r.includes('physician') || r.includes('consultant'));
      })
      .map(u => ({
        id: u.id,
        name: u.fullName,
        specialization: u.roles?.[0]?.name || 'General Medicine',
        department: selectedDepartment,
        available: u.status === 'active',
        currentQueue: 0, // Would need queue stats per doctor
      }));
  }, [usersData, selectedDepartment]);

  // Issue token mutation using real API
  const issueTokenMutation = useMutation({
    mutationFn: async (data: CreateQueueEntryDto) => {
      return queueService.addToQueue(data);
    },
    onSuccess: (token) => {
      setIssuedToken(token);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['queue-today'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
    onError: (err: Error & { response?: { data?: { message?: string | string[]; error?: string; statusCode?: number } } }) => {
      console.error('Queue error:', err.response?.data || err.message);
      const data = err.response?.data;
      let errorMessage = 'Failed to issue token. Please try again.';
      
      if (data?.message) {
        errorMessage = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      } else if (data?.error) {
        errorMessage = data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // Handle specific error cases
      if (data?.statusCode === 401 || err.message?.includes('401')) {
        errorMessage = 'Session expired. Please login again.';
      }
      
      setError(errorMessage);
    },
  });

  // Cancel/remove from queue mutation
  const cancelQueueMutation = useMutation({
    mutationFn: async (id: string) => {
      return queueService.cancel(id, 'Removed by reception');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-today'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  const handleRemoveFromQueue = (id: string, patientName: string) => {
    if (confirm(`Remove ${patientName} from queue?`)) {
      cancelQueueMutation.mutate(id);
    }
  };

  const handleIssueToken = () => {
    if (selectedPatient) {
      setError(null); // Clear any previous error
      // Map UI department to backend service point
      const servicePointMap: Record<string, 'consultation' | 'triage' | 'vitals' | 'laboratory' | 'radiology' | 'pharmacy'> = {
        general: 'consultation',
        consultation: 'consultation',
        pediatrics: 'consultation',
        gynecology: 'consultation',
        orthopedics: 'consultation',
        dental: 'consultation',
        ent: 'consultation',
        ophthalmology: 'consultation',
        dermatology: 'consultation',
        cardiology: 'consultation',
        triage: 'triage',
        vitals: 'vitals',
      };
      
      const queueData: CreateQueueEntryDto = {
        patientId: selectedPatient.id,
        servicePoint: servicePointMap[selectedDepartment] || 'consultation',
        priority: 3, // Normal priority (1=highest, 10=lowest)
        notes: selectedDoctor !== 'any' ? `Preferred doctor: ${selectedDoctor}` : undefined,
      };
      issueTokenMutation.mutate(queueData);
    }
  };

  const handlePrintToken = () => {
    window.print();
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setSearchTerm('');
    setSelectedDoctor('any');
    setIssuedToken(null);
  };

  // Success screen after token issued
  if (issuedToken && selectedPatient) {
    return (
      <div className="max-w-lg mx-auto">
        {/* Screen View */}
        <div className="card text-center py-6 print:hidden">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Token Issued!</h2>
          
          {/* Queue Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium mb-4">
            <Users className="w-4 h-4" />
            Patient is now in queue
          </div>
          
          <div className="bg-blue-50 rounded-lg p-6 my-4">
            <p className="text-sm text-gray-600 mb-1">Token Number</p>
            <p className="text-4xl font-mono font-bold text-blue-700 mb-4">
              {issuedToken.ticketNumber}
            </p>
            
            <div className="border-t border-blue-200 pt-4 mt-4">
              <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
                <UserCircle className="w-5 h-5" />
                <span className="font-medium">{selectedPatient.fullName}</span>
              </div>
              <p className="text-sm text-gray-500">MRN: {selectedPatient.mrn}</p>
            </div>
            
            <div className="border-t border-blue-200 pt-4 mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Department</p>
                <p className="font-medium capitalize">{selectedDepartment}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Options Section */}
          {selectedPatient.paymentType === 'cash' && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-gray-700 mb-3">Payment Options:</p>
              <div className="space-y-2">
                <button 
                  onClick={() => navigate('/billing/reception/new', { 
                    state: { 
                      patientId: selectedPatient.id,
                      patientName: selectedPatient.fullName,
                      mrn: selectedPatient.mrn,
                      serviceType: 'consultation'
                    }
                  })}
                  className="w-full py-3 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Banknote className="w-5 h-5" />
                  Pay Consultation Fee Now (UGX {CONSULTATION_FEE.toLocaleString()})
                </button>
                <button 
                  onClick={handleReset}
                  className="w-full py-3 px-4 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Clock className="w-5 h-5" />
                  Pay All at Checkout (After Visit)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Patient can proceed to doctor and pay total bill at the end
              </p>
            </div>
          )}

          {/* Insurance patient */}
          {selectedPatient.paymentType === 'insurance' && (
            <div className="bg-blue-50 rounded-lg p-4 mb-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">{selectedPatient.insurance?.provider}</span>
              </div>
              {selectedPatient.insurance?.requiresPreAuth ? (
                <button 
                  onClick={() => navigate('/insurance/preauth')}
                  className="w-full py-3 px-4 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Shield className="w-5 h-5" />
                  Proceed to Pre-Authorization
                </button>
              ) : (
                <p className="text-sm text-blue-700">
                  ✓ Patient can proceed - billing will be sent to insurance
                </p>
              )}
            </div>
          )}

          {/* Membership patient */}
          {selectedPatient.paymentType === 'membership' && selectedPatient.membership && (
            <div className="bg-purple-50 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-purple-700">
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">{selectedPatient.membership.type} Member</span>
                <span className="bg-purple-200 px-2 py-0.5 rounded text-xs">
                  {selectedPatient.membership.discountPercent}% discount
                </span>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            Please wait for your number to be called
          </p>

          <div className="flex gap-3">
            <button onClick={handleReset} className="btn-secondary flex-1">
              Issue Another
            </button>
            <button
              onClick={handlePrintToken}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Print Token
            </button>
          </div>
        </div>

        {/* Print Receipt - Clean thermal printer format */}
        <div className="hidden print:block bg-white p-4 text-center" style={{ width: '80mm', margin: '0 auto' }}>
          <div className="border-b-2 border-dashed border-gray-400 pb-3 mb-3">
            <h1 className="text-lg font-bold">GLIDE HIMS</h1>
            <p className="text-xs text-gray-600">Healthcare Management System</p>
          </div>
          
          <div className="py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Queue Token</p>
            <p className="text-5xl font-mono font-black my-2">
              {issuedToken.ticketNumber}
            </p>
          </div>
          
          <div className="border-t border-b border-dashed border-gray-300 py-3 my-3 text-left text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">Patient:</span>
              <span className="font-medium">{selectedPatient.fullName}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">MRN:</span>
              <span className="font-mono">{selectedPatient.mrn}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">Department:</span>
              <span className="font-medium capitalize">{selectedDepartment}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date/Time:</span>
              <span>{new Date().toLocaleString()}</span>
            </div>
          </div>
          
          <p className="text-sm font-medium my-4">
            Please wait for your number to be called
          </p>
          
          <div className="text-xs text-gray-400 border-t border-dashed border-gray-300 pt-3">
            <p>Thank you for visiting</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">OPD Token</h1>
          <p className="text-gray-500 text-sm">Issue queue tokens for outpatient visits</p>
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Calendar className="w-4 h-4" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {/* Main Content - 3 columns */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        {/* Column 1: Patient & Department */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Patient Search */}
          <div className="card p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-2">1. Select Patient</h2>
            {selectedPatient ? (
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{selectedPatient.fullName}</p>
                      <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPatient(null)} className="text-xs text-blue-600 hover:underline">
                    Change
                  </button>
                </div>
                {/* Payment Status */}
                <div className="border-t border-blue-200 pt-2 mt-1">
                  {selectedPatient.paymentType === 'insurance' && selectedPatient.insurance && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-blue-600" />
                        <span className="text-gray-700">{selectedPatient.insurance.provider}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        selectedPatient.insurance.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {selectedPatient.insurance.status === 'active' ? 'Active' : 'Expired'}
                      </span>
                    </div>
                  )}
                  {selectedPatient.paymentType === 'insurance' && selectedPatient.insurance && (
                    <p className="text-xs text-gray-500 mt-1">Policy: {selectedPatient.insurance.policyNumber}</p>
                  )}
                  {selectedPatient.paymentType === 'membership' && selectedPatient.membership && (
                    <div className="flex items-center gap-1 text-xs">
                      <CreditCard className="w-3 h-3 text-purple-600" />
                      <span className="text-gray-700">Membership: {selectedPatient.membership.type}</span>
                    </div>
                  )}
                  {selectedPatient.paymentType === 'cash' && (
                    <div className="flex items-center gap-1 text-xs">
                      <Banknote className="w-3 h-3 text-green-600" />
                      <span className="text-gray-700">Cash Patient</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search patient..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-8 py-1.5 text-sm"
                    autoFocus
                  />
                </div>
                {searchLoading && (
                  <div className="flex justify-center py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  </div>
                )}
                {patients && patients.length > 0 && (
                  <div className="border rounded divide-y max-h-32 overflow-y-auto">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => setSelectedPatient(patient)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left"
                      >
                        <UserCircle className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{patient.fullName}</p>
                          <p className="text-xs text-gray-500">{patient.mrn}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Department Selection */}
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-2 flex-shrink-0">2. Select Department</h2>
            <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-y-auto content-start">
              {[
                { id: 'general', name: 'General' },
                { id: 'pediatrics', name: 'Pediatrics' },
                { id: 'gynecology', name: 'Gynecology' },
                { id: 'orthopedics', name: 'Orthopedics' },
                { id: 'dental', name: 'Dental' },
                { id: 'ent', name: 'ENT' },
                { id: 'ophthalmology', name: 'Eye' },
                { id: 'dermatology', name: 'Skin' },
                { id: 'cardiology', name: 'Cardiology' },
              ].map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => { setSelectedDepartment(dept.id); setSelectedDoctor('any'); }}
                  className={`p-2 rounded border text-left transition-colors text-xs ${
                    selectedDepartment === dept.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {dept.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Doctor Selection */}
        <div className="card p-4 flex flex-col min-h-0 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-2 flex-shrink-0">3. Select Doctor (Optional)</h2>
          
          {/* Any Doctor Option */}
          <button
            onClick={() => setSelectedDoctor('any')}
            className={`w-full p-2 rounded border-2 text-left mb-2 flex-shrink-0 ${
              selectedDoctor === 'any' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className={`w-5 h-5 ${selectedDoctor === 'any' ? 'text-blue-600' : 'text-gray-500'}`} />
              <div>
                <p className={`text-sm font-medium ${selectedDoctor === 'any' ? 'text-blue-700' : 'text-gray-900'}`}>
                  Any Available Doctor
                </p>
                <p className="text-xs text-gray-500">Auto-assigned • Shortest wait</p>
              </div>
            </div>
          </button>

          {/* Doctor List */}
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {availableDoctors.map((doctor) => (
              <button
                key={doctor.id}
                onClick={() => doctor.available && setSelectedDoctor(doctor.id)}
                disabled={!doctor.available}
                className={`w-full p-2 rounded border text-left transition-colors ${
                  selectedDoctor === doctor.id
                    ? 'border-blue-500 bg-blue-50'
                    : doctor.available
                      ? 'border-gray-200 hover:border-gray-300'
                      : 'border-gray-100 bg-gray-50 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className={`w-4 h-4 ${selectedDoctor === doctor.id ? 'text-blue-600' : 'text-gray-500'}`} />
                    <div>
                      <p className={`text-sm font-medium ${selectedDoctor === doctor.id ? 'text-blue-700' : 'text-gray-900'}`}>
                        {doctor.name}
                      </p>
                      <p className="text-xs text-gray-500">{doctor.specialization}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {doctor.available ? (
                      <>
                        <p className="text-xs font-medium">{doctor.currentQueue} waiting</p>
                        <p className="text-xs text-green-600">Available</p>
                      </>
                    ) : (
                      <p className="text-xs text-red-500">Unavailable</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Column 3: Queue Summary & Issue Button */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Today's Queue</h2>
            <div className="space-y-2 flex-shrink-0">
              <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">Waiting</span>
                </div>
                <span className="text-lg font-bold text-yellow-700">
                  {queueStats?.waiting || todayQueue?.filter((t) => t.status === 'waiting').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-blue-700">Serving</span>
                </div>
                <span className="text-lg font-bold text-blue-700">
                  {queueStats?.inService || todayQueue?.filter((t) => t.status === 'in_service').length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-700">Done</span>
                </div>
                <span className="text-lg font-bold text-green-700">
                  {queueStats?.completed || todayQueue?.filter((t) => t.status === 'completed').length || 0}
                </span>
              </div>
            </div>
            
            {/* Queue List */}
            <div className="mt-3 pt-3 border-t flex-1 min-h-0 overflow-hidden flex flex-col">
              <p className="text-xs text-gray-500 mb-2 flex-shrink-0">Patients in Queue:</p>
              <div className="flex-1 overflow-y-auto space-y-1">
                {todayQueue && todayQueue.filter(t => t.status === 'waiting' || t.status === 'called').length > 0 ? (
                  todayQueue
                    .filter(t => t.status === 'waiting' || t.status === 'called')
                    .slice(0, 10)
                    .map((entry) => (
                      <div 
                        key={entry.id} 
                        className={`flex items-center justify-between p-1.5 rounded text-xs group ${
                          entry.status === 'called' ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`font-mono font-bold ${entry.status === 'called' ? 'text-blue-700' : 'text-gray-700'}`}>
                            {entry.ticketNumber}
                          </span>
                          <span className="truncate text-gray-600">
                            {entry.patient?.fullName || 'Patient'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {entry.status === 'called' && (
                            <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                              Now
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveFromQueue(entry.id, entry.patient?.fullName || 'Patient')}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
                            title="Remove from queue"
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">No patients waiting</p>
                )}
                {todayQueue && todayQueue.filter(t => t.status === 'waiting').length > 10 && (
                  <p className="text-xs text-gray-400 text-center">
                    +{todayQueue.filter(t => t.status === 'waiting').length - 10} more...
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 flex-shrink-0">
            <h2 className="text-sm font-semibold mb-3">Quick Stats</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Today</span>
                <span className="font-medium">{todayQueue?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Avg. Wait</span>
                <span className="font-medium">{queueStats?.avgWaitTime ? `~${Math.round(queueStats.avgWaitTime)} min` : '~15 min'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Now Serving</span>
                <span className="font-mono font-medium text-blue-600">
                  {todayQueue?.find(t => t.status === 'called')?.ticketNumber || '---'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Type Confirmation */}
          {selectedPatient && (
            <div className="card p-4 flex-shrink-0">
              <h2 className="text-sm font-semibold mb-2">4. Payment Confirmation</h2>
              {selectedPatient.paymentType === 'insurance' && selectedPatient.insurance && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Provider</span>
                    <span className="font-medium">{selectedPatient.insurance.provider}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Co-pay</span>
                    <span className="font-medium">{selectedPatient.insurance.coPay ? `UGX ${selectedPatient.insurance.coPay.toLocaleString()}` : `${selectedPatient.insurance.coPay || 10}%`}</span>
                  </div>
                  <a href="#" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Verify Coverage
                  </a>
                  {selectedPatient.insurance.requiresPreAuth && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-1.5 rounded">
                      ⚠️ Pre-authorization required
                    </p>
                  )}
                </div>
              )}
              {selectedPatient.paymentType === 'membership' && selectedPatient.membership && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Plan</span>
                    <span className="font-medium">{selectedPatient.membership.type}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-green-600">{selectedPatient.membership.discountPercent}% off</span>
                  </div>
                  <p className="text-xs text-green-600 bg-green-50 p-1.5 rounded">
                    ✓ {selectedPatient.membership.discountPercent}% discount applies
                  </p>
                </div>
              )}
              {selectedPatient.paymentType === 'cash' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Consultation Fee</span>
                    <span className="font-medium">UGX {CONSULTATION_FEE.toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500">Payment due before consultation</p>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Issue Button */}
          <button
            onClick={handleIssueToken}
            disabled={!selectedPatient || issueTokenMutation.isPending}
            className="btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
          >
            {issueTokenMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Receipt className="w-5 h-5" />
                Issue Token
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
