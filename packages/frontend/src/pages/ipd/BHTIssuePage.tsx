import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Printer,
  User,
  Calendar,
  Bed,
  Stethoscope,
  ClipboardList,
  Activity,
  Pill,
  AlertCircle,
  Download,
  Eye,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';

interface Admission {
  id: string;
  admissionNumber: string;
  status: string;
  admissionDate: string;
  primaryDiagnosis?: string;
  admissionType?: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
    phone?: string;
    address?: string;
    nationalId?: string;
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

export default function BHTIssuePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch active admissions
  const { data: admissions = [], isLoading } = useQuery({
    queryKey: ['bht-admissions'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'active' } });
      return res.data as Admission[];
    },
  });

  const filteredAdmissions = useMemo(() => {
    return admissions.filter(
      (adm) =>
        `${adm.patient.firstName} ${adm.patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adm.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (adm.patient.nationalId && adm.patient.nationalId.includes(searchTerm))
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

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bed Head Ticket (BHT)</h1>
            <p className="text-sm text-gray-500">Generate and manage BHT documents</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-blue-700 font-medium">{admissions.length} Active Admissions</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Admissions List */}
        <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or admission number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {filteredAdmissions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <FileText className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-medium">No admissions found</p>
                <p className="text-sm">Admission records will appear here</p>
              </div>
            ) : (
            <div className="space-y-3">
              {filteredAdmissions.map((admission) => (
                <div
                  key={admission.id}
                  onClick={() => {
                    setSelectedAdmission(admission);
                    setShowPreview(false);
                  }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedAdmission?.id === admission.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{admission.patient.firstName} {admission.patient.lastName}</p>
                      <p className="text-sm text-indigo-600">#{admission.admissionNumber}</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1 capitalize">
                      <CheckCircle className="w-3 h-3" />
                      {admission.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      {admission.bed?.bedNumber || 'No bed'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(admission.admissionDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* BHT Details/Preview */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
          {selectedAdmission ? (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      !showPreview ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4 inline mr-2" />
                    Details
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      showPreview ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Eye className="w-4 h-4 inline mr-2" />
                    Preview
                  </button>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4 inline mr-2" />
                    Download
                  </button>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    <Printer className="w-4 h-4 inline mr-2" />
                    Print
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-auto p-6">
                {!showPreview ? (
                  <div className="grid grid-cols-2 gap-6">
                    {/* Patient Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-600" />
                        Patient Information
                      </h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Full Name</p>
                            <p className="font-medium">{selectedAdmission.patient.firstName} {selectedAdmission.patient.lastName}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Admission Number</p>
                            <p className="font-medium text-indigo-600">#{selectedAdmission.admissionNumber}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Age</p>
                            <p className="font-medium">{getAge(selectedAdmission.patient.dateOfBirth)} years</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Gender</p>
                            <p className="font-medium capitalize">{selectedAdmission.patient.gender || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">ID Number</p>
                            <p className="font-medium">{selectedAdmission.patient.nationalId || 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Address</p>
                          <p className="font-medium">{selectedAdmission.patient.address || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Phone</p>
                          <p className="font-medium">{selectedAdmission.patient.phone || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Admission Information */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Bed className="w-5 h-5 text-indigo-600" />
                        Admission Information
                      </h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Admission Date</p>
                            <p className="font-medium">{new Date(selectedAdmission.admissionDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Admission Time</p>
                            <p className="font-medium">{new Date(selectedAdmission.admissionDate).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Admission Type</p>
                            <p className="font-medium capitalize">{selectedAdmission.admissionType || 'Elective'}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Ward / Bed</p>
                            <p className="font-medium">{selectedAdmission.bed?.ward?.name || 'N/A'} - {selectedAdmission.bed?.bedNumber || 'N/A'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Attending Doctor</p>
                          <p className="font-medium flex items-center gap-2">
                            <Stethoscope className="w-4 h-4 text-gray-500" />
                            {selectedAdmission.attendingDoctor 
                              ? `Dr. ${selectedAdmission.attendingDoctor.firstName} ${selectedAdmission.attendingDoctor.lastName}`
                              : 'Not assigned'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Diagnosis</p>
                          <p className="font-medium">{selectedAdmission.primaryDiagnosis || 'To be determined'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        Current Status
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium capitalize">
                          {selectedAdmission.status}
                        </span>
                        <span className="text-gray-500">
                          Since {new Date(selectedAdmission.admissionDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* BHT Preview - Print Format */
                  <div className="max-w-3xl mx-auto bg-white border-2 border-gray-300 p-8">
                    {/* Header */}
                    <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                      <h1 className="text-2xl font-bold text-gray-900">GLIDE HOSPITAL</h1>
                      <p className="text-sm text-gray-600">P.O. Box 12345, Nairobi, Kenya</p>
                      <p className="text-sm text-gray-600">Tel: +254 20 123 4567</p>
                      <h2 className="text-xl font-bold text-gray-900 mt-4 underline">BED HEAD TICKET</h2>
                    </div>

                    {/* BHT Number */}
                    <div className="flex justify-between mb-6">
                      <div>
                        <span className="font-bold">Admission No:</span>{' '}
                        <span className="text-lg font-mono">{selectedAdmission.admissionNumber}</span>
                      </div>
                      <div>
                        <span className="font-bold">Date:</span> {new Date(selectedAdmission.admissionDate).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Patient Details */}
                    <div className="border border-gray-400 p-4 mb-4">
                      <h3 className="font-bold border-b border-gray-400 pb-2 mb-3">PATIENT DETAILS</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-bold">Name:</span> {selectedAdmission.patient.firstName} {selectedAdmission.patient.lastName}</div>
                        <div><span className="font-bold">ID No:</span> {selectedAdmission.patient.nationalId || 'N/A'}</div>
                        <div><span className="font-bold">Age:</span> {getAge(selectedAdmission.patient.dateOfBirth)} years</div>
                        <div><span className="font-bold">Gender:</span> {selectedAdmission.patient.gender || 'N/A'}</div>
                        <div className="col-span-2"><span className="font-bold">Address:</span> {selectedAdmission.patient.address || 'N/A'}</div>
                        <div><span className="font-bold">Phone:</span> {selectedAdmission.patient.phone || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Admission Details */}
                    <div className="border border-gray-400 p-4 mb-4">
                      <h3 className="font-bold border-b border-gray-400 pb-2 mb-3">ADMISSION DETAILS</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-bold">Ward:</span> {selectedAdmission.bed?.ward?.name || 'N/A'}</div>
                        <div><span className="font-bold">Bed:</span> {selectedAdmission.bed?.bedNumber || 'N/A'}</div>
                        <div><span className="font-bold">Admission Type:</span> {selectedAdmission.admissionType || 'Elective'}</div>
                        <div><span className="font-bold">Time:</span> {new Date(selectedAdmission.admissionDate).toLocaleTimeString()}</div>
                        <div className="col-span-2">
                          <span className="font-bold">Attending Doctor:</span>{' '}
                          {selectedAdmission.attendingDoctor 
                            ? `Dr. ${selectedAdmission.attendingDoctor.firstName} ${selectedAdmission.attendingDoctor.lastName}`
                            : 'Not assigned'}
                        </div>
                        <div className="col-span-2"><span className="font-bold">Diagnosis:</span> {selectedAdmission.primaryDiagnosis || 'To be determined'}</div>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-3 gap-8 mt-8 pt-4">
                      <div className="text-center">
                        <div className="border-b border-gray-400 mb-1 h-8"></div>
                        <p className="text-sm">Admitting Officer</p>
                      </div>
                      <div className="text-center">
                        <div className="border-b border-gray-400 mb-1 h-8"></div>
                        <p className="text-sm">Attending Doctor</p>
                      </div>
                      <div className="text-center">
                        <div className="border-b border-gray-400 mb-1 h-8"></div>
                        <p className="text-sm">Nurse In-Charge</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <FileText className="w-16 h-16 text-gray-300 mb-4" />
              <p className="font-medium text-lg">Select an admission</p>
              <p className="text-sm">Choose a patient from the list to view or generate BHT</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
