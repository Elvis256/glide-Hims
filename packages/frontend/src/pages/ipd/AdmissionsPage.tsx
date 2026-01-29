import { useState, useMemo } from 'react';
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
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  idNumber: string;
}

interface AdmissionRequest {
  id: string;
  patient: Patient;
  type: 'Emergency' | 'Elective' | 'Transfer';
  diagnosis: string;
  requestedBy: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Admitted';
  priority: 'High' | 'Medium' | 'Low';
}

interface Ward {
  id: string;
  name: string;
  type: string;
  availableBeds: number;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
}

const mockPatients: Patient[] = [];

const mockAdmissionRequests: AdmissionRequest[] = [];

const mockWards: Ward[] = [];

const mockDoctors: Doctor[] = [];

export default function AdmissionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'requests' | 'newAdmission'>('requests');
  const [admissionType, setAdmissionType] = useState<'Emergency' | 'Elective' | 'Transfer'>('Elective');
  const [selectedWard, setSelectedWard] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [diagnosis, setDiagnosis] = useState('');

  const filteredRequests = useMemo(() => {
    return mockAdmissionRequests.filter(
      (req) =>
        req.patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Emergency':
        return <Ambulance className="w-4 h-4 text-red-500" />;
      case 'Elective':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'Transfer':
        return <ArrowRightLeft className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      High: 'bg-red-100 text-red-700',
      Medium: 'bg-yellow-100 text-yellow-700',
      Low: 'bg-green-100 text-green-700',
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      Pending: 'bg-yellow-100 text-yellow-700',
      Approved: 'bg-blue-100 text-blue-700',
      Admitted: 'bg-green-100 text-green-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
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
            Admission Requests
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
                  placeholder="Search by patient name or diagnosis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Requests List */}
            <div className="flex-1 overflow-auto p-4">
              {filteredRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                  <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="font-medium text-lg">No admission requests</p>
                  <p className="text-sm">Pending admission requests will appear here</p>
                </div>
              ) : (
              <div className="space-y-3">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-white rounded-lg border border-gray-200">
                          <User className="w-8 h-8 text-gray-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{request.patient.name}</h3>
                            <span className="text-sm text-gray-500">({request.patient.id})</span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityBadge(request.priority)}`}>
                              {request.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Diagnosis:</span> {request.diagnosis}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              {getTypeIcon(request.type)}
                              {request.type}
                            </span>
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-4 h-4" />
                              {request.requestedBy}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {request.requestedAt}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 text-sm rounded-full ${getStatusBadge(request.status)}`}>
                          {request.status}
                        </span>
                        {request.status === 'Pending' && (
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                            Process Admission
                          </button>
                        )}
                        {request.status === 'Approved' && (
                          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                            Admit Patient
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                  {(['Emergency', 'Elective', 'Transfer'] as const).map((type) => (
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
                      {type}
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
                    placeholder="Search patient by name or ID..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="mt-2 space-y-2">
                  {mockPatients.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No patients registered. Search or register a patient.</p>
                  ) : (
                  mockPatients.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPatient?.id === patient.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{patient.name}</p>
                          <p className="text-sm text-gray-500">
                            {patient.age}y, {patient.gender} • ID: {patient.idNumber}
                          </p>
                        </div>
                        {selectedPatient?.id === patient.id && (
                          <CheckCircle className="w-5 h-5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </div>

              {/* Diagnosis */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Admitting Diagnosis</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Ward/Bed</label>
                <select
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a ward...</option>
                  {mockWards.map((ward) => (
                    <option key={ward.id} value={ward.id}>
                      {ward.name} ({ward.availableBeds} beds available)
                    </option>
                  ))}
                </select>
              </div>

              {/* Attending Doctor */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Attending Doctor</label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a doctor...</option>
                  {mockDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialty}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                  <UserPlus className="w-4 h-4 inline mr-2" />
                  Admit Patient
                </button>
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Generate Form
                </button>
              </div>
            </div>

            {/* Ward Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Ward Availability</h2>
              <div className="space-y-3">
                {mockWards.map((ward) => (
                  <div
                    key={ward.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">{ward.name}</span>
                      </div>
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        {ward.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bed className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-gray-600">
                        {ward.availableBeds} beds available
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
