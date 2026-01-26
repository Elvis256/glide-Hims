import { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Printer,
  RefreshCw,
  User,
  Calendar,
  Pill,
  X,
  Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { patientsService } from '../../../services/patients';
import { prescriptionsService, type Prescription as APIPrescription } from '../../../services/prescriptions';

interface Patient {
  id: string;
  name: string;
}

interface PrescriptionMedication {
  name: string;
  strength: string;
  frequency: string;
  duration: string;
  quantity: string;
  refills: number;
}

interface Prescription {
  id: string;
  patientId: string;
  date: string;
  prescribingDoctor: string;
  status: 'Active' | 'Completed' | 'Cancelled';
  medications: PrescriptionMedication[];
  specialInstructions?: string;
  pharmacy?: string;
}

// Transform API prescription to local interface
function transformPrescription(apiPrescription: APIPrescription): Prescription {
  const statusMap: Record<APIPrescription['status'], Prescription['status']> = {
    pending: 'Active',
    partial: 'Active',
    dispensing: 'Active',
    ready: 'Active',
    dispensed: 'Completed',
    collected: 'Completed',
    cancelled: 'Cancelled',
  };

  return {
    id: apiPrescription.prescriptionNumber || apiPrescription.id,
    patientId: apiPrescription.patientId,
    date: apiPrescription.createdAt.split('T')[0],
    prescribingDoctor: apiPrescription.doctor?.fullName || 'Unknown Doctor',
    status: statusMap[apiPrescription.status] || 'Active',
    medications: apiPrescription.items.map((item) => ({
      name: item.drugName,
      strength: item.dose,
      frequency: item.frequency,
      duration: item.duration,
      quantity: `${item.quantity} units`,
      refills: 0,
    })),
    specialInstructions: apiPrescription.notes,
  };
}

const statusColors = {
  Active: 'bg-green-100 text-green-700',
  Completed: 'bg-gray-100 text-gray-700',
  Cancelled: 'bg-red-100 text-red-700',
};

export default function PrescriptionHistoryPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [expandedPrescription, setExpandedPrescription] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchDrug, setSearchDrug] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fetch patients based on search
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 20 }),
    enabled: patientDropdownOpen,
  });

  const patients: Patient[] = useMemo(() => {
    return (patientsData?.data || []).map((p) => ({ id: p.id, name: p.fullName }));
  }, [patientsData]);

  // Fetch prescriptions for selected patient
  const { data: prescriptionsData, isLoading: prescriptionsLoading } = useQuery({
    queryKey: ['prescriptions', selectedPatient?.id],
    queryFn: () =>
      selectedPatient
        ? prescriptionsService.getPatientPrescriptions(selectedPatient.id)
        : prescriptionsService.list(),
    select: (data) => (data || []).map(transformPrescription),
  });

  const prescriptions = prescriptionsData || [];

  const filteredPrescriptions = useMemo(() => {
    let result = prescriptions;
    
    if (searchDrug) {
      result = result.filter(p => 
        p.medications.some(m => 
          m.name.toLowerCase().includes(searchDrug.toLowerCase())
        )
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }
    
    if (dateFrom) {
      result = result.filter(p => p.date >= dateFrom);
    }
    
    if (dateTo) {
      result = result.filter(p => p.date <= dateTo);
    }
    
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [prescriptions, searchDrug, statusFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearchDrug('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const toggleExpand = (id: string) => {
    setExpandedPrescription(expandedPrescription === id ? null : id);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <History className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Prescription History</h1>
              <p className="text-sm text-gray-500">View and manage past prescriptions</p>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 ${showFilters ? 'bg-gray-100' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Patient Selector */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <button
              onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-2 border rounded-lg bg-white hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className={selectedPatient ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedPatient ? selectedPatient.name : 'All patients'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {patientDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patients..."
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientDropdownOpen(false);
                      setPatientSearch('');
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-500"
                  >
                    All patients
                  </button>
                  {patientsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : patients.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-500">No patients found</div>
                  ) : (
                    patients.map(patient => (
                      <button
                        key={patient.id}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientDropdownOpen(false);
                          setPatientSearch('');
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50"
                      >
                        {patient.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {prescriptionsLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </span>
            ) : (
              `${filteredPrescriptions.length} prescription${filteredPrescriptions.length !== 1 ? 's' : ''} found`
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-700">Filter Options</span>
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Drug Name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchDrug}
                    onChange={(e) => setSearchDrug(e.target.value)}
                    placeholder="Search drug..."
                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prescription List */}
      <div className="flex-1 p-6 overflow-y-auto">
        {prescriptionsLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Loader2 className="w-12 h-12 mb-3 animate-spin text-gray-300" />
            <p className="text-lg font-medium">Loading prescriptions...</p>
          </div>
        ) : filteredPrescriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Pill className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">No prescriptions found</p>
            <p className="text-sm">Try adjusting your filters or select a different patient</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {filteredPrescriptions.map(prescription => (
              <div key={prescription.id} className="bg-white rounded-lg border overflow-hidden">
                <button
                  onClick={() => toggleExpand(prescription.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">{prescription.date}</span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-left">
                        {prescription.medications.map(m => m.name).join(', ')}
                      </div>
                      <div className="text-sm text-gray-500 text-left">
                        {prescription.prescribingDoctor} {selectedPatient ? '' : `• Patient ID: ${prescription.patientId}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColors[prescription.status]}`}>
                      {prescription.status}
                    </span>
                    {expandedPrescription === prescription.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {expandedPrescription === prescription.id && (
                  <div className="px-4 pb-4 border-t bg-gray-50">
                    <div className="py-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Medications</div>
                      <div className="space-y-2">
                        {prescription.medications.map((med, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-lg border">
                            <div className="font-medium text-gray-900">{med.name} {med.strength}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              {med.frequency} • {med.duration}
                            </div>
                            <div className="text-sm text-gray-500">
                              Quantity: {med.quantity} | Refills: {med.refills}
                            </div>
                          </div>
                        ))}
                      </div>

                      {prescription.specialInstructions && (
                        <div className="mt-4">
                          <div className="text-sm font-medium text-gray-700 mb-1">Special Instructions</div>
                          <div className="p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                            {prescription.specialInstructions}
                          </div>
                        </div>
                      )}

                      {prescription.pharmacy && (
                        <div className="mt-4">
                          <div className="text-sm font-medium text-gray-700 mb-1">Pharmacy</div>
                          <div className="text-sm text-gray-600">{prescription.pharmacy}</div>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t flex gap-3">
                        <button className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-white">
                          <Printer className="w-4 h-4" />
                          Reprint
                        </button>
                        {prescription.status !== 'Cancelled' && (
                          <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            <RefreshCw className="w-4 h-4" />
                            Renew
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
