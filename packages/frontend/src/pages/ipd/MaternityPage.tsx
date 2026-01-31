import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Baby,
  Heart,
  User,
  Clock,
  Calendar,
  Activity,
  AlertCircle,
  Plus,
  Search,
  FileText,
  Stethoscope,
  Thermometer,
  Droplets,
  TrendingUp,
  CheckCircle,
  Edit,
  Eye,
  UserPlus,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';

interface LabourRecord {
  id: string;
  labourNumber: string;
  status: string;
  cervicalDilation?: number;
  admissionTime: string;
  registration: {
    id: string;
    gravida: number;
    para: number;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      dateOfBirth?: string;
    };
  };
}

interface MaternityDashboard {
  activeRegistrations: number;
  dueSoonCount: number;
  activeLaboursCount: number;
  activeLabours: LabourRecord[];
  deliveriesThisMonth: number;
  highRiskCount: number;
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

export default function MaternityPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'delivered' | 'newborns'>('current');
  const [selectedLabour, setSelectedLabour] = useState<LabourRecord | null>(null);
  const facilityId = getFacilityId();

  // Fetch maternity dashboard
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['maternity-dashboard', facilityId],
    queryFn: async () => {
      if (!facilityId) return null;
      const res = await api.get('/maternity/dashboard', { params: { facilityId } });
      return res.data as MaternityDashboard;
    },
    enabled: !!facilityId,
  });

  // Fetch active labours
  const { data: activeLabours = [], isLoading: laboursLoading } = useQuery({
    queryKey: ['maternity-labours', facilityId],
    queryFn: async () => {
      if (!facilityId) return [];
      const res = await api.get('/maternity/labour/active', { params: { facilityId } });
      return res.data as LabourRecord[];
    },
    enabled: !!facilityId,
  });

  // Fallback: Fetch admissions if no facilityId
  const { data: admissions = [], isLoading: admissionsLoading } = useQuery({
    queryKey: ['maternity-admissions'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'active' } });
      return res.data as Admission[];
    },
    enabled: !facilityId,
  });

  const isLoading = dashboardLoading || laboursLoading || admissionsLoading;

  // Filter for female patients as potential maternity patients
  const maternityPatients = useMemo(() => {
    return admissions.filter(
      (a) => a.patient.gender?.toLowerCase() === 'female' || !a.patient.gender
    );
  }, [admissions]);

  const filteredLabours = useMemo(() => {
    return activeLabours.filter((l) =>
      `${l.registration.patient.firstName} ${l.registration.patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.labourNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, activeLabours]);

  const getAge = (dob?: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const getStageFromDilation = (dilation?: number) => {
    if (!dilation) return 'Admitted';
    if (dilation < 4) return 'Latent Phase';
    if (dilation < 10) return 'Active Phase';
    return 'Second Stage';
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Baby className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Maternity Ward</h1>
            <p className="text-sm text-gray-500">Labour, delivery, and newborn care</p>
          </div>
        </div>
        <button className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium">
          <Plus className="w-4 h-4 inline mr-2" />
          New Admission
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Activity className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.activeLaboursCount || activeLabours.length}</p>
              <p className="text-sm text-gray-500">In Labour</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{dashboard?.deliveriesThisMonth || 0}</p>
              <p className="text-sm text-gray-500">Deliveries (Month)</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{dashboard?.activeRegistrations || maternityPatients.length}</p>
              <p className="text-sm text-gray-500">ANC Registrations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{dashboard?.highRiskCount || 0}</p>
              <p className="text-sm text-gray-500">High Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'current' ? 'bg-rose-100 text-rose-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Activity className="w-4 h-4 inline mr-2" />
          In Labour
        </button>
        <button
          onClick={() => setActiveTab('delivered')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'delivered' ? 'bg-rose-100 text-rose-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Delivered
        </button>
        <button
          onClick={() => setActiveTab('newborns')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'newborns' ? 'bg-rose-100 text-rose-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Baby className="w-4 h-4 inline mr-2" />
          Newborns
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {activeTab !== 'newborns' ? (
          <>
            {/* Patient List */}
            <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search patients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {filteredLabours.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Baby className="w-12 h-12 text-gray-300 mb-3" />
                    <p className="font-medium">No patients in labour</p>
                    <p className="text-sm">Active labour cases will appear here</p>
                    {!facilityId && (
                      <p className="text-xs text-gray-400 mt-2">Configure facility to view maternity data</p>
                    )}
                  </div>
                ) : (
                <div className="space-y-3">
                  {filteredLabours.map((labour) => (
                    <div
                      key={labour.id}
                      onClick={() => setSelectedLabour(labour)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedLabour?.id === labour.id
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {labour.registration.patient.firstName} {labour.registration.patient.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {getAge(labour.registration.patient.dateOfBirth)}y • G{labour.registration.gravida}P{labour.registration.para}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          {getStageFromDilation(labour.cervicalDilation)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Activity className="w-4 h-4" />
                        <span>Dilation: {labour.cervicalDilation || 0}cm</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">#{labour.labourNumber}</p>
                    </div>
                  ))}
                </div>
                )}
              </div>
            </div>

            {/* Patient Details */}
            {selectedLabour ? (
              <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-lg font-semibold text-gray-900">
                          {selectedLabour.registration.patient.firstName} {selectedLabour.registration.patient.lastName}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          {getStageFromDilation(selectedLabour.cervicalDilation)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {getAge(selectedLabour.registration.patient.dateOfBirth)}y • G{selectedLabour.registration.gravida}P{selectedLabour.registration.para} • #{selectedLabour.labourNumber}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium">
                        <Plus className="w-4 h-4 inline mr-2" />
                        Record Partograph
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Labour Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-rose-600" />
                        Labour Status
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Cervical Dilation:</span>
                          <span className="font-medium">{selectedLabour.cervicalDilation || 0}cm</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Stage:</span>
                          <span className="font-medium">{getStageFromDilation(selectedLabour.cervicalDilation)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Admitted:</span>
                          <span className="font-medium">{new Date(selectedLabour.admissionTime).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Obstetric History */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-rose-600" />
                        Obstetric History
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Gravida:</span>
                          <span className="font-medium">{selectedLabour.registration.gravida}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Para:</span>
                          <span className="font-medium">{selectedLabour.registration.para}</span>
                        </div>
                      </div>
                    </div>

                    {/* Partograph */}
                    <div className="col-span-2 bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-rose-600" />
                        Labour Progress (Partograph)
                      </h3>
                      <div className="py-8 text-center text-gray-500">
                        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p>Click "Record Partograph" to add progress entries</p>
                        <p className="text-xs text-gray-400 mt-1">Track cervical dilation, FHR, contractions over time</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      Record Delivery
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <ClipboardList className="w-4 h-4 inline mr-2" />
                      Update Progress
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      <FileText className="w-4 h-4 inline mr-2" />
                      Print Records
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-500">
                <Baby className="w-16 h-16 text-gray-300 mb-4" />
                <p className="font-medium text-lg">Select a patient</p>
                <p className="text-sm">Choose a patient from the list to view details</p>
              </div>
            )}
          </>
        ) : (
          /* Newborns Tab */
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search newborns..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center text-gray-500">
              <Baby className="w-16 h-16 text-gray-300 mb-4" />
              <p className="font-medium text-lg">No newborns registered</p>
              <p className="text-sm">Newborn records will appear here after delivery</p>
              <p className="text-xs text-gray-400 mt-2">Newborn registration requires maternity module backend</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
