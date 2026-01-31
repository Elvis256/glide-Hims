import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Search,
  Ambulance,
  Calendar,
  ArrowRightLeft,
  Bed,
  Stethoscope,
  FileText,
  CheckCircle,
  Clock,
  User,
  Building2,
  ClipboardList,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { ipdService, patientsService } from '../../services';
import type { Admission, Ward, Bed as BedType, CreateAdmissionDto } from '../../services/ipd';

type AdmissionType = 'emergency' | 'elective' | 'transfer';

export default function AdmissionsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'requests' | 'newAdmission'>('requests');
  const [admissionType, setAdmissionType] = useState<AdmissionType>('elective');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedBed, setSelectedBed] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Fetch current admissions
  const { data: admissionsData, isLoading: loadingAdmissions } = useQuery({
    queryKey: ['admissions', 'admitted'],
    queryFn: () => ipdService.admissions.list({ status: 'admitted', limit: 50 }),
  });

  // Fetch wards
  const { data: wards, isLoading: loadingWards } = useQuery({
    queryKey: ['wards'],
    queryFn: () => ipdService.wards.list(),
  });

  // Fetch available beds for selected ward
  const { data: availableBeds } = useQuery({
    queryKey: ['available-beds', selectedWard],
    queryFn: () => ipdService.beds.getAvailable(selectedWard || undefined),
    enabled: !!selectedWard || activeTab === 'newAdmission',
  });

  // Search patients
  const { data: patientsData } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: async () => {
      if (!patientSearch) return { data: [] };
      const response = await patientsService.search({ search: patientSearch, limit: 5 });
      return response;
    },
    enabled: patientSearch.length >= 2,
  });

  // Create admission mutation
  const createAdmissionMutation = useMutation({
    mutationFn: (data: CreateAdmissionDto) => ipdService.admissions.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['available-beds'] });
      setShowSuccessModal(true);
      resetForm();
    },
  });

  const admissions = admissionsData?.data || [];
  const patients = patientsData?.data || [];

  const filteredAdmissions = useMemo(() => {
    if (!searchTerm) return admissions;
    return admissions.filter(
      (adm) =>
        adm.patient?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adm.admittingDiagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adm.admissionNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, admissions]);

  const resetForm = () => {
    setSelectedPatientId('');
    setPatientSearch('');
    setSelectedWard('');
    setSelectedBed('');
    setDiagnosis('');
    setAdmissionType('elective');
  };

  const handleAdmit = () => {
    if (!selectedPatientId || !selectedBed || !diagnosis) return;
    createAdmissionMutation.mutate({
      patientId: selectedPatientId,
      bedId: selectedBed,
      type: admissionType,
      admittingDiagnosis: diagnosis,
      priority: admissionType === 'emergency' ? 'high' : 'medium',
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'emergency':
        return <Ambulance className="w-4 h-4 text-red-500" />;
      case 'elective':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'transfer':
        return <ArrowRightLeft className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      admitted: 'bg-green-100 text-green-700',
      discharged: 'bg-gray-100 text-gray-700',
      transferred: 'bg-blue-100 text-blue-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <UserPlus className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IPD Admissions</h1>
            <p className="text-sm text-gray-500">Manage patient admissions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'requests'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ClipboardList className="w-4 h-4 inline mr-2" />
            Current Admissions ({admissions.length})
          </button>
          <button
            onClick={() => setActiveTab('newAdmission')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'newAdmission'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            New Admission
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'requests' ? (
          <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by patient name, diagnosis, or admission #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Admissions List */}
            <div className="flex-1 overflow-auto">
              {loadingAdmissions ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredAdmissions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 p-4">
                  <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="font-medium text-lg">No current admissions</p>
                  <p className="text-sm">Admitted patients will appear here</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-sm text-gray-600">
                      <th className="px-4 py-3 font-medium">Admission #</th>
                      <th className="px-4 py-3 font-medium">Patient</th>
                      <th className="px-4 py-3 font-medium">Ward / Bed</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Diagnosis</th>
                      <th className="px-4 py-3 font-medium">Admitted</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAdmissions.map((admission) => (
                      <tr key={admission.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-blue-600">
                          {admission.admissionNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{admission.patient?.fullName}</p>
                              <p className="text-xs text-gray-500">{admission.patient?.mrn}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Bed className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">
                              {admission.ward?.name} - {admission.bed?.bedNumber}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-sm">
                            {getTypeIcon(admission.type)}
                            <span className="capitalize">{admission.type}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                          {admission.admittingDiagnosis}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(admission.admittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(admission.status)}`}>
                            {admission.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full grid grid-cols-3 gap-6">
            {/* Admission Form */}
            <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">New Admission Form</h2>
              
              {/* Admission Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Admission Type</label>
                <div className="flex gap-3">
                  {(['emergency', 'elective', 'transfer'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setAdmissionType(type)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        admissionType === type
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {getTypeIcon(type)}
                      <span className="capitalize">{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search patient by name or MRN..."
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setSelectedPatientId('');
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {patients.length > 0 && !selectedPatientId && (
                  <div className="mt-2 space-y-2 max-h-48 overflow-auto border rounded-lg p-2">
                    {patients.map((patient) => (
                      <div
                        key={patient.id}
                        onClick={() => {
                          setSelectedPatientId(patient.id);
                          setPatientSearch(patient.fullName);
                        }}
                        className="p-3 rounded-lg border cursor-pointer transition-colors hover:border-blue-300 hover:bg-blue-50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{patient.fullName}</p>
                            <p className="text-sm text-gray-500">
                              {patient.gender}, {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}y • MRN: {patient.mrn}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedPatientId && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="font-medium text-green-700">Patient selected: {patientSearch}</span>
                    </div>
                    <button onClick={() => { setSelectedPatientId(''); setPatientSearch(''); }} className="text-gray-500 hover:text-gray-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Diagnosis */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Admitting Diagnosis *</label>
                <textarea
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Enter the admitting diagnosis..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Ward Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Ward</label>
                <select
                  value={selectedWard}
                  onChange={(e) => {
                    setSelectedWard(e.target.value);
                    setSelectedBed('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a ward...</option>
                  {wards?.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {ward.name} ({ward.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Bed Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Bed</label>
                <select
                  value={selectedBed}
                  onChange={(e) => setSelectedBed(e.target.value)}
                  disabled={!selectedWard}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select a bed...</option>
                  {availableBeds?.filter(b => !selectedWard || b.wardId === selectedWard).map((bed) => (
                    <option key={bed.id} value={bed.id}>
                      Bed {bed.bedNumber} ({bed.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Error Message */}
              {createAdmissionMutation.isError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span>Failed to create admission. Please try again.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAdmit}
                  disabled={!selectedPatientId || !selectedBed || !diagnosis || createAdmissionMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {createAdmissionMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <UserPlus className="w-4 h-4" />
                  Admit Patient
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Ward Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ward Availability</h2>
              {loadingWards ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="space-y-3">
                  {wards?.map((ward) => (
                    <div
                      key={ward.id}
                      onClick={() => setSelectedWard(ward.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedWard === ward.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-gray-900">{ward.name}</span>
                        </div>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded capitalize">
                          {ward.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bed className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-gray-600">
                          {ward.capacity} total beds
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!wards || wards.length === 0) && (
                    <p className="text-center text-gray-500 py-4">No wards configured</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Patient Admitted Successfully</h3>
              <p className="text-gray-500 mb-6">The patient has been admitted to the selected ward and bed.</p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setActiveTab('requests');
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Admissions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
