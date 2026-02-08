import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  ChevronDown,
  ChevronUp,
  Loader2,
  Building2,
  DollarSign,
  Filter,
  Download,
  Printer,
  Eye,
  Copy,
  X,
  List,
  LayoutGrid,
  Heart,
  Thermometer,
  TestTube,
  Image as ImageIcon,
  Syringe,
  Receipt,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
} from 'lucide-react';
import { patientsService, encountersService, prescriptionsService, billingService, ordersService, type Patient, type Encounter, type Invoice } from '../services';
import { vitalsService, type VitalRecord } from '../services/vitals';
import { usePermissions } from '../components/PermissionGate';

// Types
interface VisitData {
  id: string;
  encounterId: string;
  date: string;
  visitNumber: string;
  type: 'opd' | 'ipd' | 'emergency' | 'day-case';
  department: string;
  doctor: string;
  doctorId?: string;
  chiefComplaint: string;
  diagnoses: Array<{ code: string; name: string }>;
  prescriptionsCount: number;
  labOrdersCount: number;
  radiologyOrdersCount: number;
  proceduresCount: number;
  totalBill: number;
  status: string;
  notes?: string;
  // Detail data (loaded on expand)
  vitals?: VitalRecord;
  prescriptions?: Array<{ id: string; drugName: string; dosage: string; frequency: string; duration: string }>;
  labOrders?: Array<{ id: string; testName: string; status: string; result?: string }>;
  radiologyOrders?: Array<{ id: string; studyType: string; status: string; findings?: string }>;
  procedures?: Array<{ id: string; name: string; status: string }>;
  invoices?: Invoice[];
}

interface VisitFilters {
  dateFrom: string;
  dateTo: string;
  department: string;
  doctor: string;
  visitType: string;
  hasDiagnosis: string;
}

type ViewMode = 'timeline' | 'table';
type SortField = 'date' | 'type' | 'department' | 'doctor' | 'amount';
type SortDirection = 'asc' | 'desc';

// Utility functions
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', minimumFractionDigits: 0 }).format(amount);
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

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Visit type styling
const getVisitTypeStyle = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'opd': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', line: 'bg-blue-400' };
    case 'ipd': return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', line: 'bg-green-400' };
    case 'emergency': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', line: 'bg-red-400' };
    case 'day-case': return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', line: 'bg-purple-400' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', line: 'bg-gray-400' };
  }
};

const getVisitIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'opd': return Stethoscope;
    case 'ipd': return Building2;
    case 'emergency': return AlertCircle;
    case 'day-case': return Activity;
    default: return FileText;
  }
};

const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'in_consultation': case 'in_progress': return 'bg-blue-100 text-blue-700';
    case 'waiting': case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export default function PatientHistoryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlPatientId = searchParams.get('patientId');
  const { hasPermission, hasAnyPermission } = usePermissions();
  
  // Permission checks
  const canViewClinical = hasAnyPermission(['encounters.read', 'diagnoses.read']);
  const canViewBilling = hasPermission('billing.read');
  const isReceptionOnly = !canViewClinical && !canViewBilling;

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [expandedVisits, setExpandedVisits] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<VisitFilters>({
    dateFrom: '',
    dateTo: '',
    department: '',
    doctor: '',
    visitType: '',
    hasDiagnosis: '',
  });
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch patient from URL param if provided
  const { data: urlPatient } = useQuery({
    queryKey: ['patient', urlPatientId],
    queryFn: () => patientsService.getById(urlPatientId!),
    enabled: !!urlPatientId && !selectedPatient,
    staleTime: 30000,
  });

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
        const result = await encountersService.list({ 
          patientId: activePatient!.id,
          limit: 100,
        });
        return result;
      } catch {
        return { data: [], total: 0 };
      }
    },
    enabled: !!activePatient,
    staleTime: 30000,
  });

  // Fetch prescriptions for selected patient
  const { data: prescriptions } = useQuery({
    queryKey: ['prescriptions', activePatient?.id],
    queryFn: async () => {
      try {
        return await prescriptionsService.list({ patientId: activePatient!.id });
      } catch {
        return [];
      }
    },
    enabled: !!activePatient && canViewClinical,
    staleTime: 30000,
  });

  // Fetch invoices for selected patient
  const { data: invoicesData } = useQuery({
    queryKey: ['invoices', activePatient?.id],
    queryFn: async () => {
      try {
        return await billingService.invoices.list({ patientId: activePatient!.id, limit: 100 });
      } catch {
        return { data: [], total: 0 };
      }
    },
    enabled: !!activePatient && canViewBilling,
    staleTime: 30000,
  });

  // Fetch orders for the patient
  const { data: ordersData } = useQuery({
    queryKey: ['orders', activePatient?.id],
    queryFn: async () => {
      try {
        // Get orders via encounter IDs
        const encounters = encountersData?.data || [];
        const allOrders: any[] = [];
        for (const enc of encounters.slice(0, 10)) { // Limit to recent encounters
          try {
            const orders = await ordersService.getByEncounter(enc.id);
            allOrders.push(...orders);
          } catch {
            // Continue on error
          }
        }
        return allOrders;
      } catch {
        return [];
      }
    },
    enabled: !!activePatient && !!encountersData?.data?.length && canViewClinical,
    staleTime: 30000,
  });

  const patients = searchResults?.data || [];
  const encounters = encountersData?.data || [];
  const invoices = invoicesData?.data || [];
  const orders = ordersData || [];

  // Build visit data from encounters
  const visits: VisitData[] = useMemo(() => {
    return encounters.map((enc: Encounter) => {
      // Find related invoices
      const visitInvoices = invoices.filter((inv: Invoice) => inv.encounterId === enc.id);
      const totalBill = visitInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.totalAmount || 0), 0);

      // Find related prescriptions
      const visitPrescriptions = (prescriptions || []).filter((rx: any) => rx.encounterId === enc.id);

      // Find related orders
      const visitOrders = orders.filter((ord: any) => ord.encounterId === enc.id);
      const labOrders = visitOrders.filter((o: any) => o.orderType === 'lab');
      const radiologyOrders = visitOrders.filter((o: any) => o.orderType === 'radiology');
      const procedureOrders = visitOrders.filter((o: any) => o.orderType === 'procedure');

      return {
        id: enc.id,
        encounterId: enc.id,
        date: enc.visitDate || enc.createdAt,
        visitNumber: enc.visitNumber || '-',
        type: enc.type || 'opd',
        department: enc.department || 'General',
        doctor: enc.doctor?.fullName || 'Not Assigned',
        doctorId: enc.doctorId,
        chiefComplaint: enc.chiefComplaint || '-',
        diagnoses: [], // Would need diagnoses service
        prescriptionsCount: visitPrescriptions.length,
        labOrdersCount: labOrders.length,
        radiologyOrdersCount: radiologyOrders.length,
        proceduresCount: procedureOrders.length,
        totalBill,
        status: enc.status || 'completed',
        notes: enc.notes,
        invoices: visitInvoices,
        prescriptions: visitPrescriptions.map((rx: any) => ({
          id: rx.id,
          drugName: rx.items?.[0]?.drugName || 'Medication',
          dosage: rx.items?.[0]?.dosage || '',
          frequency: rx.items?.[0]?.frequency || '',
          duration: rx.items?.[0]?.duration || '',
        })),
        labOrders: labOrders.map((o: any) => ({
          id: o.id,
          testName: o.testCodes?.[0]?.name || 'Lab Test',
          status: o.status,
        })),
        radiologyOrders: radiologyOrders.map((o: any) => ({
          id: o.id,
          studyType: o.testCodes?.[0]?.name || 'Imaging',
          status: o.status,
        })),
        procedures: procedureOrders.map((o: any) => ({
          id: o.id,
          name: o.testCodes?.[0]?.name || 'Procedure',
          status: o.status,
        })),
      };
    });
  }, [encounters, invoices, prescriptions, orders]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const totalVisits = visits.length;
    const lastVisit = visits.length > 0 ? visits[0]?.date : null;
    const totalSpent = visits.reduce((sum, v) => sum + (v.totalBill || 0), 0);
    
    // Most visited department
    const deptCounts: Record<string, number> = {};
    visits.forEach(v => {
      deptCounts[v.department] = (deptCounts[v.department] || 0) + 1;
    });
    const mostVisitedDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return { totalVisits, lastVisit, totalSpent, mostVisitedDept };
  }, [visits]);

  // Apply filters and sorting
  const filteredVisits = useMemo(() => {
    let result = [...visits];

    // Apply filters
    if (filters.dateFrom) {
      result = result.filter(v => new Date(v.date) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      result = result.filter(v => new Date(v.date) <= new Date(filters.dateTo));
    }
    if (filters.department) {
      result = result.filter(v => v.department.toLowerCase().includes(filters.department.toLowerCase()));
    }
    if (filters.doctor) {
      result = result.filter(v => v.doctor.toLowerCase().includes(filters.doctor.toLowerCase()));
    }
    if (filters.visitType) {
      result = result.filter(v => v.type === filters.visitType);
    }
    if (filters.hasDiagnosis === 'yes') {
      result = result.filter(v => v.diagnoses.length > 0);
    } else if (filters.hasDiagnosis === 'no') {
      result = result.filter(v => v.diagnoses.length === 0);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'department':
          comparison = a.department.localeCompare(b.department);
          break;
        case 'doctor':
          comparison = a.doctor.localeCompare(b.doctor);
          break;
        case 'amount':
          comparison = a.totalBill - b.totalBill;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [visits, filters, sortField, sortDirection]);

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const departments = [...new Set(visits.map(v => v.department))].filter(Boolean);
    const doctors = [...new Set(visits.map(v => v.doctor))].filter(Boolean);
    return { departments, doctors };
  }, [visits]);

  // Handlers
  const toggleVisitExpand = useCallback((visitId: string) => {
    setExpandedVisits(prev => {
      const next = new Set(prev);
      if (next.has(visitId)) {
        next.delete(visitId);
      } else {
        next.add(visitId);
      }
      return next;
    });
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const clearFilters = useCallback(() => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      department: '',
      doctor: '',
      visitType: '',
      hasDiagnosis: '',
    });
  }, []);

  const handleExportPDF = useCallback(() => {
    toast.info('Generating PDF...', { description: 'This feature will export full history to PDF' });
    // In a real implementation, you would call a service to generate the PDF
  }, []);

  const handleExportExcel = useCallback(() => {
    toast.info('Generating Excel...', { description: 'This feature will export history to Excel' });
    // In a real implementation, you would generate an Excel file
  }, []);

  const handlePrintSummary = useCallback(() => {
    window.print();
    toast.success('Print dialog opened');
  }, []);

  const handleViewEncounter = useCallback((visitId: string) => {
    navigate(`/encounters/${visitId}`);
  }, [navigate]);

  const handlePrintVisit = useCallback((visit: VisitData) => {
    toast.info('Printing visit summary...', { description: `Visit on ${formatDate(visit.date)}` });
  }, []);

  const handleRequestRecords = useCallback((visit: VisitData) => {
    toast.info('Records copy request submitted', { description: 'You will be notified when ready' });
  }, []);

  // Fetch vitals for expanded visit
  const fetchVisitDetails = useCallback(async (visitId: string) => {
    if (!canViewClinical) return;
    try {
      const vitals = await vitalsService.getByEncounter(visitId);
      // Update the visit data with vitals
      // In a full implementation, you'd update state here
    } catch {
      // Silent fail for vitals
    }
  }, [canViewClinical]);

  // Render patient info bar
  const renderPatientInfoBar = () => {
    if (!activePatient) return null;
    
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 border border-blue-100">
        <div className="flex items-center gap-4">
          {(activePatient as any).photoUrl ? (
            <img src={(activePatient as any).photoUrl} alt={activePatient.fullName} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-xl border-2 border-white shadow">
              {getInitials(activePatient.fullName)}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{activePatient.fullName}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                MRN: {activePatient.mrn}
              </span>
              {activePatient.dateOfBirth && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {calculateAge(activePatient.dateOfBirth)} years
                </span>
              )}
              <span className="flex items-center gap-1">
                <UserCircle className="w-4 h-4" />
                {activePatient.gender || 'Unknown'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedPatient(null)}
            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-100 rounded-lg"
          >
            Change Patient
          </button>
        </div>
      </div>
    );
  };

  // Render summary cards
  const renderSummaryCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div className="bg-white rounded-xl p-4 border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{summaryStats.totalVisits}</p>
            <p className="text-xs text-gray-500">Total Visits</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">
              {summaryStats.lastVisit ? formatDate(summaryStats.lastVisit) : '-'}
            </p>
            <p className="text-xs text-gray-500">Last Visit</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900 truncate">{summaryStats.mostVisitedDept}</p>
            <p className="text-xs text-gray-500">Most Visited</p>
          </div>
        </div>
      </div>
      {canViewBilling && (
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(summaryStats.totalSpent)}</p>
              <p className="text-xs text-gray-500">Total Spent</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render filters panel
  const renderFilters = () => (
    <div className={`bg-gray-50 rounded-xl p-4 mb-4 border ${showFilters ? '' : 'hidden'}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">Filters</h3>
        <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">
          Clear All
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From Date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
            className="input text-sm py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To Date</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
            className="input text-sm py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Department</label>
          <select
            value={filters.department}
            onChange={(e) => setFilters(f => ({ ...f, department: e.target.value }))}
            className="input text-sm py-1.5"
          >
            <option value="">All</option>
            {filterOptions.departments.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Doctor</label>
          <select
            value={filters.doctor}
            onChange={(e) => setFilters(f => ({ ...f, doctor: e.target.value }))}
            className="input text-sm py-1.5"
          >
            <option value="">All</option>
            {filterOptions.doctors.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Visit Type</label>
          <select
            value={filters.visitType}
            onChange={(e) => setFilters(f => ({ ...f, visitType: e.target.value }))}
            className="input text-sm py-1.5"
          >
            <option value="">All</option>
            <option value="opd">OPD</option>
            <option value="ipd">IPD</option>
            <option value="emergency">Emergency</option>
            <option value="day-case">Day Case</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Has Diagnosis</label>
          <select
            value={filters.hasDiagnosis}
            onChange={(e) => setFilters(f => ({ ...f, hasDiagnosis: e.target.value }))}
            className="input text-sm py-1.5"
          >
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>
    </div>
  );

  // Render visit detail expansion
  const renderVisitDetails = (visit: VisitData) => {
    if (!expandedVisits.has(visit.id)) return null;

    return (
      <div className="mt-3 pt-3 border-t border-dashed space-y-4">
        {/* Vitals (clinical roles only) */}
        {canViewClinical && visit.vitals && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              Vitals Recorded
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {visit.vitals.temperature && (
                <div className="bg-gray-50 rounded p-2">
                  <span className="text-gray-500">Temp:</span> {visit.vitals.temperature}°C
                </div>
              )}
              {visit.vitals.pulse && (
                <div className="bg-gray-50 rounded p-2">
                  <span className="text-gray-500">Pulse:</span> {visit.vitals.pulse} bpm
                </div>
              )}
              {visit.vitals.bloodPressureSystolic && (
                <div className="bg-gray-50 rounded p-2">
                  <span className="text-gray-500">BP:</span> {visit.vitals.bloodPressureSystolic}/{visit.vitals.bloodPressureDiastolic}
                </div>
              )}
              {visit.vitals.oxygenSaturation && (
                <div className="bg-gray-50 rounded p-2">
                  <span className="text-gray-500">SpO2:</span> {visit.vitals.oxygenSaturation}%
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chief Complaint (clinical roles only) */}
        {canViewClinical && visit.chiefComplaint && visit.chiefComplaint !== '-' && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-500" />
              Chief Complaint
            </h4>
            <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">{visit.chiefComplaint}</p>
          </div>
        )}

        {/* Diagnoses (clinical roles only) */}
        {canViewClinical && visit.diagnoses.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Diagnoses (ICD Codes)
            </h4>
            <div className="flex flex-wrap gap-2">
              {visit.diagnoses.map((d, i) => (
                <span key={i} className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">
                  {d.code}: {d.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Prescriptions (clinical roles only) */}
        {canViewClinical && visit.prescriptions && visit.prescriptions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Pill className="w-4 h-4 text-purple-500" />
              Prescriptions ({visit.prescriptionsCount})
            </h4>
            <div className="space-y-1">
              {visit.prescriptions.slice(0, 5).map((rx, i) => (
                <div key={i} className="text-sm text-gray-600 bg-gray-50 rounded p-2">
                  {rx.drugName} - {rx.dosage} {rx.frequency} for {rx.duration}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lab Tests (clinical roles only) */}
        {canViewClinical && visit.labOrders && visit.labOrders.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <TestTube className="w-4 h-4 text-blue-500" />
              Lab Tests ({visit.labOrdersCount})
            </h4>
            <div className="space-y-1">
              {visit.labOrders.map((lab, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                  <span>{lab.testName}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusStyle(lab.status)}`}>
                    {lab.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Radiology (clinical roles only) */}
        {canViewClinical && visit.radiologyOrders && visit.radiologyOrders.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-indigo-500" />
              Radiology ({visit.radiologyOrdersCount})
            </h4>
            <div className="space-y-1">
              {visit.radiologyOrders.map((rad, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                  <span>{rad.studyType}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusStyle(rad.status)}`}>
                    {rad.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Procedures (clinical roles only) */}
        {canViewClinical && visit.procedures && visit.procedures.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Syringe className="w-4 h-4 text-green-500" />
              Procedures ({visit.proceduresCount})
            </h4>
            <div className="space-y-1">
              {visit.procedures.map((proc, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                  <span>{proc.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusStyle(proc.status)}`}>
                    {proc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bill Summary (billing roles only) */}
        {canViewBilling && visit.invoices && visit.invoices.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-green-500" />
              Bill Summary
            </h4>
            <div className="space-y-1">
              {visit.invoices.map((inv, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                  <span>{inv.invoiceNumber}</span>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusStyle(inv.status)}`}>
                      {inv.status}
                    </span>
                    <span className="font-medium">{formatCurrency(inv.totalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => handleViewEncounter(visit.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
          >
            <Eye className="w-4 h-4" />
            View Full Details
          </button>
          <button
            onClick={() => handlePrintVisit(visit)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Printer className="w-4 h-4" />
            Print Summary
          </button>
          <button
            onClick={() => handleRequestRecords(visit)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <Copy className="w-4 h-4" />
            Request Copy
          </button>
        </div>
      </div>
    );
  };

  // Render timeline view
  const renderTimelineView = () => (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {filteredVisits.map((visit, index) => {
          const style = getVisitTypeStyle(visit.type);
          const Icon = getVisitIcon(visit.type);
          const isExpanded = expandedVisits.has(visit.id);

          return (
            <div key={visit.id} className="relative pl-12">
              {/* Timeline dot */}
              <div className={`absolute left-0 w-10 h-10 rounded-full ${style.bg} ${style.border} border-2 flex items-center justify-center z-10`}>
                <Icon className={`w-5 h-5 ${style.text}`} />
              </div>

              {/* Visit card */}
              <div className={`bg-white rounded-xl border ${isExpanded ? 'ring-2 ring-blue-200' : ''} shadow-sm overflow-hidden`}>
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleVisitExpand(visit.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                          {visit.type.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusStyle(visit.status)}`}>
                          {visit.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-400">#{visit.visitNumber}</span>
                      </div>
                      <p className="font-medium text-gray-900">
                        {formatDate(visit.date)} - {visit.department}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        <Stethoscope className="w-4 h-4 inline mr-1" />
                        {visit.doctor}
                      </p>
                      {canViewClinical && visit.chiefComplaint !== '-' && (
                        <p className="text-sm text-gray-500 mt-1 truncate">
                          {visit.chiefComplaint}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      {canViewBilling && visit.totalBill > 0 && (
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(visit.totalBill)}
                        </span>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {canViewClinical && (
                          <>
                            {visit.prescriptionsCount > 0 && (
                              <span className="flex items-center gap-1">
                                <Pill className="w-3 h-3" /> {visit.prescriptionsCount}
                              </span>
                            )}
                            {visit.labOrdersCount > 0 && (
                              <span className="flex items-center gap-1">
                                <TestTube className="w-3 h-3" /> {visit.labOrdersCount}
                              </span>
                            )}
                            {visit.radiologyOrdersCount > 0 && (
                              <span className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" /> {visit.radiologyOrdersCount}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    {renderVisitDetails(visit)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render table view
  const renderTableView = () => (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">
                <button onClick={() => handleSort('date')} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
                  Date
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button onClick={() => handleSort('type')} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
                  Type
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button onClick={() => handleSort('department')} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
                  Department
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button onClick={() => handleSort('doctor')} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
                  Doctor
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              {canViewClinical && <th className="px-4 py-3 text-left font-medium text-gray-600">Chief Complaint</th>}
              {canViewBilling && (
                <th className="px-4 py-3 text-right">
                  <button onClick={() => handleSort('amount')} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 ml-auto">
                    Amount
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              )}
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredVisits.map(visit => {
              const style = getVisitTypeStyle(visit.type);
              const isExpanded = expandedVisits.has(visit.id);

              return (
                <>
                  <tr
                    key={visit.id}
                    className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                    onClick={() => toggleVisitExpand(visit.id)}
                  >
                    <td className="px-4 py-3">{formatDate(visit.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                        {visit.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">{visit.department}</td>
                    <td className="px-4 py-3">{visit.doctor}</td>
                    {canViewClinical && (
                      <td className="px-4 py-3 max-w-xs truncate">{visit.chiefComplaint}</td>
                    )}
                    {canViewBilling && (
                      <td className="px-4 py-3 text-right font-medium">
                        {visit.totalBill > 0 ? formatCurrency(visit.totalBill) : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${getStatusStyle(visit.status)}`}>
                        {visit.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${visit.id}-details`}>
                      <td colSpan={canViewClinical && canViewBilling ? 8 : canViewClinical || canViewBilling ? 7 : 6} className="px-4 py-4 bg-gray-50">
                        {renderVisitDetails(visit)}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredVisits.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No visits found</p>
        </div>
      )}
    </div>
  );

  // Render patient search
  const renderPatientSearch = () => (
    <div className="bg-white rounded-xl border shadow-sm p-6 max-w-lg mx-auto mt-8">
      <div className="text-center mb-6">
        <UserCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Select a Patient</h2>
        <p className="text-sm text-gray-500">Search for a patient to view their visit history</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, MRN, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input pl-10 py-3"
          autoFocus
        />
      </div>

      {searchTerm.length >= 2 && (
        <div className="mt-4 max-h-64 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : patients.length > 0 ? (
            <div className="space-y-2">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => { setSelectedPatient(patient as Patient); setSearchTerm(''); }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left border"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-medium">
                    {getInitials(patient.fullName)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{patient.fullName}</p>
                    <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No patients found
            </div>
          )}
        </div>
      )}

      {searchTerm.length > 0 && searchTerm.length < 2 && (
        <p className="text-center text-sm text-gray-400 mt-4">Type at least 2 characters to search</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Patient Visit History</h1>
                <p className="text-sm text-gray-500">Comprehensive visit history and medical records</p>
              </div>
            </div>

            {activePatient && (
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${viewMode === 'timeline' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Timeline
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm ${viewMode === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                  >
                    <List className="w-4 h-4" />
                    Table
                  </button>
                </div>

                {/* Filter toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm ${showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>

                {/* Export dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">
                    <Download className="w-4 h-4" />
                    Export
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 hidden group-hover:block">
                    <button onClick={handleExportPDF} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                      <FileText className="w-4 h-4" />
                      Export to PDF
                    </button>
                    <button onClick={handleExportExcel} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                      <Download className="w-4 h-4" />
                      Export to Excel
                    </button>
                    <button onClick={handlePrintSummary} className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50">
                      <Printer className="w-4 h-4" />
                      Print Summary
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {!activePatient ? (
          renderPatientSearch()
        ) : (
          <>
            {/* Patient info bar */}
            {renderPatientInfoBar()}

            {/* Summary cards */}
            {renderSummaryCards()}

            {/* Filters */}
            {renderFilters()}

            {/* Loading state */}
            {isLoadingEncounters ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <>
                {/* Results count */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    Showing {filteredVisits.length} of {visits.length} visits
                  </p>
                  {filters.dateFrom || filters.dateTo || filters.department || filters.doctor || filters.visitType || filters.hasDiagnosis ? (
                    <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">
                      Clear filters
                    </button>
                  ) : null}
                </div>

                {/* Visit list */}
                {viewMode === 'timeline' ? renderTimelineView() : renderTableView()}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
