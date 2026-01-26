import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  User, Phone, Mail, MapPin, Calendar, Heart, AlertCircle, 
  FileText, Activity, Pill, FlaskConical, CreditCard, 
  ArrowLeft, Edit, Clock, Building2, Users
} from 'lucide-react';
import { patientsService } from '../services/patients';

// Simple date formatter
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientsService.getById(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          Patient not found or an error occurred.
        </div>
        <button 
          onClick={() => navigate(-1)} 
          className="mt-4 text-blue-600 hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Patient Profile</h1>
            <p className="text-gray-500">View and manage patient information</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/patients/${id}/edit`)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Edit className="w-4 h-4" />
          Edit Patient
        </button>
      </div>

      {/* Patient Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-12 h-12 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{patient.fullName}</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                (patient as { status?: string }).status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {(patient as { status?: string }).status || 'Active'}
              </span>
            </div>
            <div className="flex items-center gap-6 text-gray-600">
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">{patient.mrn}</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {patient.dateOfBirth ? `${calculateAge(patient.dateOfBirth)} years` : 'N/A'}
              </span>
              <span className="capitalize">{patient.gender || 'N/A'}</span>
              {patient.bloodGroup && (
                <span className="flex items-center gap-1 text-red-600">
                  <Heart className="w-4 h-4" />
                  {patient.bloodGroup}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Contact Information
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{patient.phone || 'No phone'}</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700">{patient.email || 'No email'}</span>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-1" />
              <span className="text-gray-700">{patient.address || 'No address'}</span>
            </div>
          </div>
        </div>

        {/* Next of Kin */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Next of Kin
          </h3>
          {patient.nextOfKin ? (
            <div className="space-y-2">
              <p className="text-gray-700">{patient.nextOfKin.name || 'N/A'}</p>
              <p className="text-gray-500 text-sm">{patient.nextOfKin.relationship || ''}</p>
              <p className="text-gray-500 text-sm">{patient.nextOfKin.phone || ''}</p>
            </div>
          ) : (
            <p className="text-gray-500">No next of kin information</p>
          )}
        </div>

        {/* Registration Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Registration Details
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">National ID</span>
              <span className="text-gray-700">{patient.nationalId || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Registered</span>
              <span className="text-gray-700">
                {patient.createdAt ? formatDate(patient.createdAt) : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <button
            onClick={() => navigate(`/opd/token?patientId=${id}`)}
            className="flex flex-col items-center p-4 border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <Clock className="w-6 h-6 text-blue-600 mb-2" />
            <span className="text-sm text-gray-700">Issue Token</span>
          </button>
          <button
            onClick={() => navigate(`/encounters/new?patientId=${id}`)}
            className="flex flex-col items-center p-4 border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
          >
            <Activity className="w-6 h-6 text-green-600 mb-2" />
            <span className="text-sm text-gray-700">New Visit</span>
          </button>
          <button
            onClick={() => navigate(`/billing/new?patientId=${id}`)}
            className="flex flex-col items-center p-4 border rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
          >
            <CreditCard className="w-6 h-6 text-yellow-600 mb-2" />
            <span className="text-sm text-gray-700">New Bill</span>
          </button>
          <button
            onClick={() => navigate(`/lab?patientId=${id}`)}
            className="flex flex-col items-center p-4 border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
          >
            <FlaskConical className="w-6 h-6 text-purple-600 mb-2" />
            <span className="text-sm text-gray-700">Lab Tests</span>
          </button>
          <button
            onClick={() => navigate(`/pharmacy?patientId=${id}`)}
            className="flex flex-col items-center p-4 border rounded-lg hover:bg-orange-50 hover:border-orange-300 transition-colors"
          >
            <Pill className="w-6 h-6 text-orange-600 mb-2" />
            <span className="text-sm text-gray-700">Prescriptions</span>
          </button>
          <button
            onClick={() => navigate(`/patients/history?patientId=${id}`)}
            className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <FileText className="w-6 h-6 text-gray-600 mb-2" />
            <span className="text-sm text-gray-700">History</span>
          </button>
        </div>
      </div>

      {/* Recent Encounters (placeholder) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Recent Encounters
        </h3>
        <div className="text-gray-500 text-center py-8">
          <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No recent encounters found</p>
          <button
            onClick={() => navigate(`/encounters/new?patientId=${id}`)}
            className="mt-3 text-blue-600 hover:underline"
          >
            Start a new encounter
          </button>
        </div>
      </div>
    </div>
  );
}
