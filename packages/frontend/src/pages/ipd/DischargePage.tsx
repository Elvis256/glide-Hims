import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LogOut,
  Search,
  Bed,
  Calendar,
  Clock,
  FileText,
  Pill,
  Stethoscope,
  CheckCircle,
  AlertCircle,
  ClipboardList,
  BookOpen,
  Printer,
  Download,
  Edit,
  CheckSquare,
  Square,
  CalendarCheck,
  Receipt,
  Award,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import api from '../../services/api';

type DischargeStatus = 'admitted' | 'discharged';

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
  wardId: string;
  ward?: {
    id: string;
    name: string;
  };
  bedId: string;
  bed?: {
    id: string;
    bedNumber: string;
  };
  type: string;
  status: DischargeStatus;
  admissionDate: string;
  dischargeDate?: string;
  admissionReason?: string;
  admissionDiagnosis?: string;
  dischargeSummary?: string;
  dischargeDiagnosis?: string;
  dischargeInstructions?: string;
  followUpPlan?: string;
  attendingDoctor?: {
    id: string;
    fullName: string;
  };
}

export default function DischargePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'medications' | 'followup' | 'education'>('summary');
  const [statusFilter, setStatusFilter] = useState<'admitted' | 'all'>('admitted');
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({
    dischargeSummary: '',
    dischargeDiagnosis: '',
    dischargeInstructions: '',
    followUpPlan: '',
  });

  // Fetch admissions
  const { data: admissionsData, isLoading } = useQuery({
    queryKey: ['ipd-admissions-discharge', statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter === 'admitted') params.status = 'admitted';
      const res = await api.get('/ipd/admissions', { params });
      return res.data as { data: Admission[]; total: number };
    },
  });

  const admissions = admissionsData?.data || [];

  // Discharge mutation
  const dischargeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof dischargeForm }) => {
      const res = await api.post(`/ipd/admissions/${id}/discharge`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipd-admissions-discharge'] });
      setShowDischargeModal(false);
      setSelectedAdmission(null);
      setDischargeForm({ dischargeSummary: '', dischargeDiagnosis: '', dischargeInstructions: '', followUpPlan: '' });
    },
  });

  const filteredPatients = useMemo(() => {
    return admissions.filter((a) => {
      const patientName = a.patient?.fullName?.toLowerCase() || '';
      const bedNumber = a.bed?.bedNumber?.toLowerCase() || '';
      const matchesSearch =
        patientName.includes(searchTerm.toLowerCase()) ||
        bedNumber.includes(searchTerm.toLowerCase()) ||
        a.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [admissions, searchTerm]);

  const stats = useMemo(() => {
    const admitted = admissions.filter((a) => a.status === 'admitted').length;
    return {
      admitted,
      total: admissions.length,
    };
  }, [admissions]);

  const getStatusBadge = (status: DischargeStatus) => {
    const colors: Record<DischargeStatus, string> = {
      admitted: 'bg-blue-100 text-blue-700',
      discharged: 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleDischarge = () => {
    if (selectedAdmission) {
      dischargeMutation.mutate({ id: selectedAdmission.id, data: dischargeForm });
    }
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <LogOut className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discharge Management</h1>
            <p className="text-sm text-gray-500">Plan and process patient discharges</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.admitted}</p>
              <p className="text-sm text-gray-500">Currently Admitted</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.total - stats.admitted}</p>
              <p className="text-sm text-gray-500">Discharged</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">-</p>
              <p className="text-sm text-gray-500">Avg Stay (days)</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Admissions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Patient List */}
        <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(['admitted', 'all'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'admitted' ? 'Currently Admitted' : 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {filteredPatients.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <LogOut className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-medium">No patients found</p>
                <p className="text-sm">Admitted patients will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPatients.map((admission) => (
                  <div
                    key={admission.id}
                    onClick={() => setSelectedAdmission(admission)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedAdmission?.id === admission.id
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{admission.patient?.fullName || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">
                          {admission.patient?.dateOfBirth ? `${calculateAge(admission.patient.dateOfBirth)}y` : ''}, {admission.patient?.gender}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(admission.status)}`}>
                        {admission.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <Bed className="w-4 h-4" />
                      <span>{admission.bed?.bedNumber} • {admission.ward?.name}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {admission.admissionNumber} • Admitted {new Date(admission.admissionDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Discharge Details */}
        {selectedAdmission ? (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Patient Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedAdmission.patient?.fullName}</h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedAdmission.status)}`}>
                      {selectedAdmission.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {selectedAdmission.patient?.dateOfBirth ? `${calculateAge(selectedAdmission.patient.dateOfBirth)}y` : ''}, {selectedAdmission.patient?.gender} • {selectedAdmission.bed?.bedNumber} • {selectedAdmission.attendingDoctor?.fullName || 'No doctor assigned'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Admitted</p>
                  <p className="font-medium">{new Date(selectedAdmission.admissionDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 p-4 border-b border-gray-200">
              {[
                { key: 'summary', label: 'Summary', icon: <FileText className="w-4 h-4" /> },
                { key: 'medications', label: 'Medications', icon: <Pill className="w-4 h-4" /> },
                { key: 'followup', label: 'Follow-up', icon: <CalendarCheck className="w-4 h-4" /> },
                { key: 'education', label: 'Instructions', icon: <BookOpen className="w-4 h-4" /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-cyan-100 text-cyan-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Admission Reason</h3>
                    <p className="text-gray-700">{selectedAdmission.admissionReason || 'Not specified'}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Admission Diagnosis</h3>
                    <p className="text-gray-700">{selectedAdmission.admissionDiagnosis || 'Not specified'}</p>
                  </div>
                  {selectedAdmission.dischargeSummary && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Discharge Summary</h3>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-gray-700 whitespace-pre-line">{selectedAdmission.dischargeSummary}</p>
                      </div>
                    </div>
                  )}
                  {selectedAdmission.status === 'discharged' && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Discharge Date</h3>
                      <p className="text-gray-700">{selectedAdmission.dischargeDate ? new Date(selectedAdmission.dischargeDate).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'medications' && (
                <div className="text-center py-8 text-gray-500">
                  <Pill className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>Medication information from prescriptions</p>
                  <p className="text-sm">View patient prescriptions for discharge medications</p>
                </div>
              )}

              {activeTab === 'followup' && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Follow-up Plan</h3>
                  {selectedAdmission.followUpPlan ? (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-line">{selectedAdmission.followUpPlan}</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No follow-up plan specified</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'education' && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4">Discharge Instructions</h3>
                  {selectedAdmission.dischargeInstructions ? (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-line">{selectedAdmission.dischargeInstructions}</p>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No discharge instructions provided yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Printer className="w-4 h-4 inline mr-2" />
                    Print Summary
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4 inline mr-2" />
                    Download
                  </button>
                </div>
                {selectedAdmission.status === 'admitted' && (
                  <button
                    onClick={() => setShowDischargeModal(true)}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4 inline mr-2" />
                    Discharge Patient
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-500">
            <LogOut className="w-16 h-16 text-gray-300 mb-4" />
            <p className="font-medium text-lg">Select a patient</p>
            <p className="text-sm">Choose a patient from the list to manage discharge</p>
          </div>
        )}
      </div>

      {/* Discharge Modal */}
      {showDischargeModal && selectedAdmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Discharge Patient</h2>
              <p className="text-sm text-gray-500">Complete discharge information for {selectedAdmission.patient?.fullName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Summary *</label>
                <textarea
                  value={dischargeForm.dischargeSummary}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, dischargeSummary: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Enter discharge summary..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Diagnosis</label>
                <input
                  type="text"
                  value={dischargeForm.dischargeDiagnosis}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, dischargeDiagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Final diagnosis..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Instructions</label>
                <textarea
                  value={dischargeForm.dischargeInstructions}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, dischargeInstructions: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Instructions for the patient..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Plan</label>
                <textarea
                  value={dischargeForm.followUpPlan}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, followUpPlan: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Follow-up appointments and care plan..."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDischargeModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDischarge}
                disabled={dischargeMutation.isPending || !dischargeForm.dischargeSummary}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {dischargeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Complete Discharge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
