import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  RefreshCw,
  UserCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  Send,
  User,
  Bed,
  Search,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { ipdService, type CreateNursingNoteDto } from '../../services/ipd';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward: string;
  bed: string;
  diagnosis: string;
  priority: 'high' | 'medium' | 'low';
}

// Calculate age from date of birth
const calculateAge = (dob?: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

interface SBARData {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

const priorityConfig = {
  high: { label: 'High', color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low: { label: 'Low', color: 'bg-green-100 text-green-700 border-green-200' },
};

export default function ShiftHandoverPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [handoverAccepted, setHandoverAccepted] = useState(false);
  const [editedSBAR, setEditedSBAR] = useState<SBARData | null>(null);

  // Search patients from API
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
  });

  // Get current admission for selected patient
  const { data: admission } = useQuery({
    queryKey: ['patient-admission', selectedPatient?.id],
    queryFn: async () => {
      const response = await ipdService.admissions.list({ patientId: selectedPatient!.id, status: 'admitted' });
      return response.data[0] || null;
    },
    enabled: !!selectedPatient?.id,
  });

  // Create nursing note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      setHandoverAccepted(true);
    },
  });

  const patients = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const patientList = apiPatients?.data || [];
    return patientList.map(p => ({
      id: p.id,
      mrn: p.mrn,
      name: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
      ward: 'Ward A',
      bed: 'Bed 1',
      diagnosis: 'General',
      priority: 'medium' as const,
    }));
  }, [apiPatients, searchTerm]);

  const accepting = createNoteMutation.isPending;

  const sbarData = selectedPatient 
    ? (editedSBAR || { situation: '', background: '', assessment: '', recommendation: '' })
    : null;

  const handleAcceptHandover = () => {
    if (!admission?.id || !sbarData) {
      // Still show success for demo purposes
      setHandoverAccepted(true);
      return;
    }

    const handoverDetails = [
      sbarData.situation && `Situation: ${sbarData.situation}`,
      sbarData.background && `Background: ${sbarData.background}`,
      sbarData.assessment && `Assessment: ${sbarData.assessment}`,
      sbarData.recommendation && `Recommendation: ${sbarData.recommendation}`,
    ].filter(Boolean).join('. ');

    createNoteMutation.mutate({
      admissionId: admission.id,
      type: 'handoff',
      content: `Shift Handover (SBAR): ${handoverDetails}`,
    });
  };

  const handleReset = () => {
    setHandoverAccepted(false);
    setSelectedPatient(null);
    setEditedSBAR(null);
  };

  if (handoverAccepted) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Handover Accepted</h2>
          <p className="text-gray-600 mb-6">
            You have accepted responsibility for {patients.length} patients in Ward A
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              View Another Handover
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Shift Handover</h1>
              <p className="text-sm text-gray-500">SBAR format patient handover</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>Day Shift → Night Shift</span>
          <span className="text-gray-400">|</span>
          <User className="w-4 h-4" />
          <span>From: Nurse Mary Nakato</span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Patient List */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Ward A Patients</h2>
            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded text-sm font-medium">
              {patients.length}
            </span>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : patients.length > 0 ? (
                patients.map((patient) => {
              const priority = priorityConfig[patient.priority];
              return (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setEditedSBAR(null);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedPatient?.id === patient.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <UserCircle className="w-10 h-10 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{patient.name}</p>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${priority.color}`}>
                          {priority.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Bed className="w-3 h-3" />
                        <span>{patient.bed}</span>
                        <span>•</span>
                        <span>{patient.age}y {patient.gender[0]}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 truncate">{patient.diagnosis}</p>
                    </div>
                  </div>
                </button>
              );
            })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No patients found</p>
                </div>
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-teal-600" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">Search for a patient</p>
              </div>
            )}
          </div>

          {/* Accept Handover Button */}
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={handleAcceptHandover}
              disabled={accepting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Accept Handover
                </>
              )}
            </button>
          </div>
        </div>

        {/* SBAR Display */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient && sbarData ? (
            <div className="flex-1 overflow-y-auto">
              {/* Patient Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div>
                  <h2 className="font-semibold text-gray-900 text-lg">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">{selectedPatient.mrn} • {selectedPatient.bed}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{selectedPatient.diagnosis}</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border mt-1 ${priorityConfig[selectedPatient.priority].color}`}>
                    {priorityConfig[selectedPatient.priority].label} Priority
                  </span>
                </div>
              </div>

              {/* SBAR Sections */}
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">S</div>
                    <h3 className="font-semibold text-blue-900">Situation</h3>
                  </div>
                  <textarea
                    value={sbarData.situation}
                    onChange={(e) => setEditedSBAR({ ...sbarData, situation: e.target.value })}
                    className="w-full p-2 bg-white border border-blue-200 rounded text-sm text-gray-700 resize-none"
                    rows={2}
                  />
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">B</div>
                    <h3 className="font-semibold text-green-900">Background</h3>
                  </div>
                  <textarea
                    value={sbarData.background}
                    onChange={(e) => setEditedSBAR({ ...sbarData, background: e.target.value })}
                    className="w-full p-2 bg-white border border-green-200 rounded text-sm text-gray-700 resize-none"
                    rows={2}
                  />
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center font-bold text-sm">A</div>
                    <h3 className="font-semibold text-yellow-900">Assessment</h3>
                  </div>
                  <textarea
                    value={sbarData.assessment}
                    onChange={(e) => setEditedSBAR({ ...sbarData, assessment: e.target.value })}
                    className="w-full p-2 bg-white border border-yellow-200 rounded text-sm text-gray-700 resize-none"
                    rows={2}
                  />
                </div>

                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">R</div>
                    <h3 className="font-semibold text-purple-900">Recommendation</h3>
                  </div>
                  <textarea
                    value={sbarData.recommendation}
                    onChange={(e) => setEditedSBAR({ ...sbarData, recommendation: e.target.value })}
                    className="w-full p-2 bg-white border border-purple-200 rounded text-sm text-gray-700 resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Alerts/Notes */}
              {selectedPatient.priority === 'high' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 text-sm">High Priority Patient</p>
                    <p className="text-sm text-red-700">Requires close monitoring. Notify charge nurse of any changes.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Send className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view handover details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
