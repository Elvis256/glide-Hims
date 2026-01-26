import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  UserCircle,
  Calendar,
  FileText,
  Pill,
  Activity,
  Stethoscope,
  ArrowLeft,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { patientsService, encountersService, prescriptionsService, type Patient } from '../services';

interface LabOrderItem {
  id: string;
  createdAt?: string;
  tests?: Array<{ testName?: string; name?: string }>;
  doctor?: { fullName?: string };
  status?: string;
}

interface TimelineItem {
  id: string;
  date: string;
  type: string;
  department: string;
  doctor: string;
  diagnosis: string;
  status: string;
  source: 'encounter' | 'lab' | 'prescription';
}

export default function PatientHistoryPage() {
  const navigate = useNavigate();
  const { patientId: urlPatientId } = useParams<{ patientId: string }>();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Fetch patient from URL param if provided
  const { data: urlPatient } = useQuery({
    queryKey: ['patient', urlPatientId],
    queryFn: () => patientsService.getById(urlPatientId!),
    enabled: !!urlPatientId && !selectedPatient,
    staleTime: 30000,
  });

  // Set selected patient from URL param
  const activePatient = selectedPatient || urlPatient || null;

  // Search patients from API
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['patients', 'search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Fetch encounters for selected patient
  const { data: encountersData, isLoading: isLoadingEncounters } = useQuery({
    queryKey: ['encounters', activePatient?.id],
    queryFn: async () => {
      try {
        const result = await encountersService.list({ patientId: activePatient!.id });
        // API returns { data: [...], total: ... }
        return result;
      } catch {
        return { data: [], total: 0 };
      }
    },
    enabled: !!activePatient,
    staleTime: 30000,
  });

  // Lab samples endpoint doesn't support patientId filter - skip for now
  const labOrders: LabOrderItem[] = [];
  const isLoadingLabs = false;

  // Fetch prescriptions for selected patient
  const { data: prescriptions, isLoading: isLoadingPrescriptions } = useQuery({
    queryKey: ['prescriptions', activePatient?.id],
    queryFn: async () => {
      try {
        return await prescriptionsService.list({ patientId: activePatient!.id });
      } catch {
        return [];
      }
    },
    enabled: !!activePatient,
    staleTime: 30000,
  });

  const patients = searchResults?.data || [];

  const isLoadingHistory = isLoadingEncounters || isLoadingLabs || isLoadingPrescriptions;

  // Combine all sources into unified timeline
  const visits: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add encounters
    const encounters = encountersData?.data || [];
    encounters.forEach((enc) => {
      items.push({
        id: enc.id,
        date: enc.visitDate?.split('T')[0] || enc.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        type: enc.type?.toUpperCase() || 'OPD',
        department: enc.department || 'General',
        doctor: enc.doctor?.fullName || 'Dr. Assigned',
        diagnosis: enc.chiefComplaint || 'Consultation',
        status: enc.status || 'completed',
        source: 'encounter',
      });
    });

    // Add lab orders
    (labOrders || []).forEach((order) => {
      const testNames = order.tests?.map((t) => t.testName || t.name).filter(Boolean).join(', ') || 'Lab Tests';
      items.push({
        id: order.id,
        date: order.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        type: 'LAB',
        department: 'Laboratory',
        doctor: order.doctor?.fullName || 'Lab Tech',
        diagnosis: testNames,
        status: order.status || 'pending',
        source: 'lab',
      });
    });

    // Add prescriptions
    (prescriptions || []).forEach((rx) => {
      const drugNames = rx.items?.map((i) => i.drugName).filter(Boolean).slice(0, 3).join(', ') || 'Medications';
      items.push({
        id: rx.id,
        date: rx.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
        type: 'PRESCRIPTION',
        department: 'Pharmacy',
        doctor: rx.doctor?.fullName || 'Dr. Prescribed',
        diagnosis: drugNames,
        status: rx.status || 'pending',
        source: 'prescription',
      });
    });

    // Sort by date descending
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return items;
  }, [encountersData, labOrders, prescriptions]);

  const filteredVisits = useMemo(() => {
    if (filterType === 'all') return visits;
    return visits.filter((v) => v.type.toLowerCase() === filterType);
  }, [filterType, visits]);

  const getVisitIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'opd': return Stethoscope;
      case 'lab': return Activity;
      case 'ipd': return FileText;
      case 'emergency': return Activity;
      case 'prescription': return Pill;
      default: return FileText;
    }
  };

  const getVisitColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'opd': return 'bg-blue-100 text-blue-600';
      case 'lab': return 'bg-purple-100 text-purple-600';
      case 'ipd': return 'bg-green-100 text-green-600';
      case 'emergency': return 'bg-red-100 text-red-600';
      case 'prescription': return 'bg-orange-100 text-orange-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleVisitClick = (visit: TimelineItem) => {
    if (visit.source === 'encounter') {
      navigate(`/encounters/${visit.id}`);
    } else if (visit.source === 'lab') {
      navigate(`/lab/orders/${visit.id}`);
    } else if (visit.source === 'prescription') {
      navigate(`/pharmacy/prescriptions/${visit.id}`);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patient History</h1>
          <p className="text-gray-500 text-sm">View complete patient visit history and records</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Patient Search/Selection */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Select Patient</h2>
          
          {activePatient ? (
            <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3 mb-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{activePatient.fullName}</p>
                  <p className="text-xs text-gray-500">{activePatient.mrn}</p>
                </div>
              </div>
              <button onClick={() => setSelectedPatient(null)} className="text-xs text-blue-600 hover:underline">
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="relative mb-3 flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search patient..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-9 py-2 text-sm"
                  autoFocus
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {patients.length > 0 ? (
                  <div className="space-y-1">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => { setSelectedPatient(patient as Patient); setSearchTerm(''); }}
                        className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-50 text-left"
                      >
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserCircle className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{patient.fullName}</p>
                          <p className="text-xs text-gray-500">{patient.mrn}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchTerm.length >= 2 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {isSearching ? (
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    ) : (
                      'No patients found'
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 text-sm">Enter at least 2 characters</div>
                )}
              </div>
            </>
          )}

          {activePatient && (
            <div className="mt-4 pt-4 border-t flex-shrink-0">
              <h3 className="text-xs font-medium text-gray-500 mb-2">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-lg font-bold text-gray-900">{visits.length}</p>
                  <p className="text-xs text-gray-500">Total Records</p>
                </div>
                <div className="bg-gray-50 rounded p-2 text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {visits.filter((v) => new Date(v.date).getFullYear() === new Date().getFullYear()).length}
                  </p>
                  <p className="text-xs text-gray-500">This Year</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Visit History */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          {!activePatient ? (
            <div className="card p-8 flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <UserCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Select a patient to view their history</p>
              </div>
            </div>
          ) : (
            <div className="card p-4 flex-1 flex flex-col min-h-0">
              {/* Filter Tabs */}
              <div className="flex gap-1 mb-4 flex-shrink-0 overflow-x-auto">
                {['all', 'OPD', 'Lab', 'IPD', 'Emergency', 'Prescription'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type.toLowerCase())}
                    className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap ${
                      filterType === type.toLowerCase()
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type === 'all' ? 'All Records' : type}
                  </button>
                ))}
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  </div>
                ) : filteredVisits.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No records found</p>
                  </div>
                ) : (
                <div className="space-y-3">
                  {filteredVisits.map((visit) => {
                    const Icon = getVisitIcon(visit.type);
                    return (
                      <div
                        key={`${visit.source}-${visit.id}`}
                        className="flex gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleVisitClick(visit)}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getVisitColor(visit.type)}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-medium text-gray-900 text-sm">{visit.diagnosis}</h3>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(visit.date).toLocaleDateString()}
                            </span>
                            <span>{visit.department}</span>
                            <span>{visit.doctor}</span>
                          </div>
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${getVisitColor(visit.type)}`}>
                            {visit.type}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
