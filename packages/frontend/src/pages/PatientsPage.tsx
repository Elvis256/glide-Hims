import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../services/api';
import { queueService } from '../services/queue';
import type { Patient } from '../types';
import { usePermissions } from '../components/PermissionGate';
import {
  Plus,
  Search,
  Edit,
  Loader2,
  UserCircle,
  X,
  Eye,
  Users,
  CalendarPlus,
  Shield,
  Building2,
  Filter,
  Download,
  Printer,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  MoreHorizontal,
  Ticket,
  CreditCard,
  UserX,
  MessageSquare,
  Phone,
  Check,
  UserPlus,
} from 'lucide-react';

type ViewMode = 'table' | 'card';
type SortField = 'mrn' | 'fullName' | 'dateOfBirth' | 'phone' | 'createdAt' | 'paymentType';
type SortOrder = 'asc' | 'desc';

interface PatientsResponse {
  data: Patient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PatientStats {
  total: number;
  todayRegistrations: number;
  insurancePatients: number;
  corporatePatients: number;
}

// Extended patient type with optional fields not in base type
interface ExtendedPatient extends Patient {
  paymentType?: 'cash' | 'insurance' | 'corporate' | 'membership';
  lastVisit?: string;
}

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Format date for display
function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Get initials for avatar
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Payment type badges
const paymentTypeBadges: Record<string, { bg: string; text: string; label: string }> = {
  cash: { bg: 'bg-green-100', text: 'text-green-800', label: 'Cash' },
  insurance: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Insurance' },
  corporate: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Corporate' },
  membership: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Membership' },
};

// Sort Icon component - must be outside main component to avoid recreation
function SortIcon({ field, sortField, sortOrder }: { field: SortField; sortField: SortField; sortOrder: SortOrder }) {
  if (sortField !== field) return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
  return sortOrder === 'asc' ? (
    <ChevronUp className="w-4 h-4 text-blue-600" />
  ) : (
    <ChevronDown className="w-4 h-4 text-blue-600" />
  );
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  // State
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [tokenModalPatient, setTokenModalPatient] = useState<Patient | null>(null);
  const [tokenServicePoint, setTokenServicePoint] = useState<'registration' | 'triage' | 'consultation' | 'laboratory' | 'radiology' | 'pharmacy' | 'billing' | 'cashier'>('registration');

  // Fetch patients with pagination
  const { data: patientsResponse, isLoading } = useQuery({
    queryKey: ['patients', search, page, pageSize, genderFilter, paymentTypeFilter, dateRangeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', page.toString());
      params.set('limit', pageSize.toString());
      if (genderFilter) params.set('gender', genderFilter);
      if (paymentTypeFilter) params.set('paymentType', paymentTypeFilter);
      if (dateRangeFilter.from) params.set('fromDate', dateRangeFilter.from);
      if (dateRangeFilter.to) params.set('toDate', dateRangeFilter.to);
      const response = await api.get(`/patients?${params}`);
      // Handle both paginated and array responses
      if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data as PatientsResponse;
      }
      // Fallback for simple array response
      const patients = response.data as Patient[];
      return {
        data: patients,
        total: patients.length,
        page: 1,
        limit: patients.length,
        totalPages: 1,
      } as PatientsResponse;
    },
  });

  // Calculate stats from patients data
  const stats = useMemo<PatientStats>(() => {
    const patients = (patientsResponse?.data || []) as ExtendedPatient[];
    const today = new Date().toISOString().split('T')[0];
    return {
      total: patientsResponse?.total || patients.length,
      todayRegistrations: patients.filter((p) => p.createdAt?.startsWith(today)).length,
      insurancePatients: patients.filter((p) => p.paymentType === 'insurance').length,
      corporatePatients: patients.filter((p) => p.paymentType === 'corporate').length,
    };
  }, [patientsResponse]);

  // Sorted patients
  const sortedPatients = useMemo((): ExtendedPatient[] => {
    const patients = (patientsResponse?.data || []) as ExtendedPatient[];
    return [...patients].sort((a, b) => {
      let aVal: string | number | null = (a[sortField as keyof ExtendedPatient] as string | undefined) ?? null;
      let bVal: string | number | null = (b[sortField as keyof ExtendedPatient] as string | undefined) ?? null;
      if (sortField === 'dateOfBirth' || sortField === 'createdAt') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return sortOrder === 'asc' ? 1 : -1;
      if (bVal === null) return sortOrder === 'asc' ? -1 : 1;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [patientsResponse, sortField, sortOrder]);

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/patients/${id}`, { status: 'inactive' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Patient deactivated successfully');
    },
    onError: () => {
      toast.error('Failed to deactivate patient');
    },
  });

  // Issue token mutation
  const issueTokenMutation = useMutation({
    mutationFn: ({ patientId, servicePoint }: { patientId: string; servicePoint: 'registration' | 'triage' | 'consultation' | 'laboratory' | 'radiology' | 'pharmacy' | 'billing' | 'cashier' }) =>
      queueService.addToQueue({ patientId, servicePoint }),
    onSuccess: (data) => {
      toast.success(`Token ${data.ticketNumber} issued successfully`);
      setTokenModalPatient(null);
    },
    onError: () => {
      toast.error('Failed to issue token');
    },
  });

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedPatients.length === sortedPatients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(sortedPatients.map((p) => p.id));
    }
  };

  const handleSelectPatient = (id: string) => {
    setSelectedPatients((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleExportCSV = () => {
    const patientsToExport = selectedPatients.length > 0
      ? sortedPatients.filter((p) => selectedPatients.includes(p.id))
      : sortedPatients;
    
    const headers = ['MRN', 'Name', 'Gender', 'Date of Birth', 'Age', 'Phone', 'Payment Type', 'National ID', 'Address'];
    const rows = patientsToExport.map((p) => [
      p.mrn,
      p.fullName,
      p.gender,
      formatDate(p.dateOfBirth),
      calculateAge(p.dateOfBirth),
      p.phone || '',
      p.paymentType || 'cash',
      p.nationalId || '',
      p.address || '',
    ]);
    
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${patientsToExport.length} patients`);
  };

  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  const handleBulkSMS = () => {
    if (selectedPatients.length === 0) {
      toast.error('Please select patients first');
      return;
    }
    toast.info(`Bulk SMS for ${selectedPatients.length} patients - Coming soon`);
  };

  const handlePrintCards = () => {
    if (selectedPatients.length === 0) {
      toast.error('Please select patients first');
      return;
    }
    toast.info(`Print cards for ${selectedPatients.length} patients - Coming soon`);
  };

  const clearFilters = () => {
    setGenderFilter('');
    setPaymentTypeFilter('');
    setDateRangeFilter({ from: '', to: '' });
    setSearch('');
  };

  const totalPages = patientsResponse?.totalPages || Math.ceil((patientsResponse?.total || 0) / pageSize);

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-500 mt-1">Manage patient records and registrations</p>
        </div>
        <button
          onClick={() => navigate('/patients/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Register Patient
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CalendarPlus className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Today's Registrations</p>
              <p className="text-2xl font-bold text-gray-900">{stats.todayRegistrations}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Insurance Patients</p>
              <p className="text-2xl font-bold text-gray-900">{stats.insurancePatients}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Building2 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Corporate Patients</p>
              <p className="text-2xl font-bold text-gray-900">{stats.corporatePatients}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by MRN, name, phone, or national ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input pl-10 w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(genderFilter || paymentTypeFilter || dateRangeFilter.from || dateRangeFilter.to) && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  !
                </span>
              )}
            </button>

            {/* View Toggle */}
            <div className="flex border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                title="Table View"
              >
                <LayoutList className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                title="Card View"
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
            </div>

            <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="flex flex-col lg:flex-row gap-4 pt-4 border-t">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={genderFilter}
                onChange={(e) => {
                  setGenderFilter(e.target.value);
                  setPage(1);
                }}
                className="input w-full"
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Type</label>
              <select
                value={paymentTypeFilter}
                onChange={(e) => {
                  setPaymentTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="input w-full"
              >
                <option value="">All Payment Types</option>
                <option value="cash">Cash</option>
                <option value="insurance">Insurance</option>
                <option value="corporate">Corporate</option>
                <option value="membership">Membership</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={dateRangeFilter.from}
                onChange={(e) => {
                  setDateRangeFilter((prev) => ({ ...prev, from: e.target.value }));
                  setPage(1);
                }}
                className="input w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={dateRangeFilter.to}
                onChange={(e) => {
                  setDateRangeFilter((prev) => ({ ...prev, to: e.target.value }));
                  setPage(1);
                }}
                className="input w-full"
              />
            </div>
            <div className="flex items-end">
              <button onClick={clearFilters} className="btn-secondary">
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedPatients.length > 0 && (
        <div className="card p-3 bg-blue-50 border-blue-200 flex items-center justify-between">
          <span className="text-blue-800 font-medium">
            {selectedPatients.length} patient{selectedPatients.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handlePrintCards} className="btn-secondary flex items-center gap-2 text-sm">
              <CreditCard className="w-4 h-4" />
              Print Cards
            </button>
            <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              Export Selected
            </button>
            <button onClick={handleBulkSMS} className="btn-secondary flex items-center gap-2 text-sm">
              <MessageSquare className="w-4 h-4" />
              Send Bulk SMS
            </button>
            <button onClick={() => setSelectedPatients([])} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      ) : !sortedPatients.length ? (
        /* Empty State */
        <div className="card">
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No patients found</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {search || genderFilter || paymentTypeFilter
                ? 'No patients match your search criteria. Try adjusting your filters.'
                : 'Get started by registering your first patient.'}
            </p>
            <button
              onClick={() => navigate('/patients/new')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              Register First Patient
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedPatients.length === sortedPatients.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Photo</th>
                  <th
                    className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('mrn')}
                  >
                    <div className="flex items-center gap-1">
                      MRN <SortIcon field="mrn" sortField={sortField} sortOrder={sortOrder} />
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('fullName')}
                  >
                    <div className="flex items-center gap-1">
                      Name <SortIcon field="fullName" sortField={sortField} sortOrder={sortOrder} />
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('dateOfBirth')}
                  >
                    <div className="flex items-center gap-1">
                      Age/Gender <SortIcon field="dateOfBirth" sortField={sortField} sortOrder={sortOrder} />
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('phone')}
                  >
                    <div className="flex items-center gap-1">
                      Phone <SortIcon field="phone" sortField={sortField} sortOrder={sortOrder} />
                    </div>
                  </th>
                  <th
                    className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('paymentType')}
                  >
                    <div className="flex items-center gap-1">
                      Payment Type <SortIcon field="paymentType" sortField={sortField} sortOrder={sortOrder} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Last Visit</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedPatients.map((patient) => {
                  const paymentType = patient.paymentType || 'cash';
                  const badge = paymentTypeBadges[paymentType] || paymentTypeBadges.cash;
                  const status = patient.status || 'active';
                  const lastVisit = patient.lastVisit;

                  return (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedPatients.includes(patient.id)}
                          onChange={() => handleSelectPatient(patient.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                          {getInitials(patient.fullName)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {patient.mrn}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{patient.fullName}</p>
                          {patient.nationalId && (
                            <p className="text-xs text-gray-500">ID: {patient.nationalId}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-900">{calculateAge(patient.dateOfBirth)} yrs</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="capitalize text-gray-600">
                          {patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'O'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {patient.phone ? (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Phone className="w-3 h-3" />
                            {patient.phone}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {lastVisit ? formatDate(lastVisit) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {status === 'active' ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm">
                            <Check className="w-4 h-4" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400 text-sm">
                            <X className="w-4 h-4" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/patients/${patient.id}`)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="View Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {hasPermission('patients.update') && (
                            <button
                              onClick={() => navigate(`/patients/${patient.id}/edit`)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          <div className="relative">
                            <button
                              onClick={() => setActionMenuOpen(actionMenuOpen === patient.id ? null : patient.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            {actionMenuOpen === patient.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
                                {hasPermission('queue.create') && (
                                  <button
                                    onClick={() => {
                                      setTokenModalPatient(patient);
                                      setActionMenuOpen(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Ticket className="w-4 h-4" />
                                    Issue Token
                                  </button>
                                )}
                                {hasPermission('patients.read') && (
                                  <button
                                    onClick={() => {
                                      toast.info('Print card - Coming soon');
                                      setActionMenuOpen(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <CreditCard className="w-4 h-4" />
                                    Print Card
                                  </button>
                                )}
                                {hasPermission('patients.delete') && (
                                  <button
                                    onClick={() => {
                                      if (confirm('Are you sure you want to deactivate this patient?')) {
                                        deactivateMutation.mutate(patient.id);
                                      }
                                      setActionMenuOpen(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                                  >
                                    <UserX className="w-4 h-4" />
                                    Deactivate
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, patientsResponse?.total || 0)} of {patientsResponse?.total || 0}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="input text-sm py-1"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-sm py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary text-sm py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedPatients.map((patient) => {
            const paymentType = patient.paymentType || 'cash';
            const badge = paymentTypeBadges[paymentType] || paymentTypeBadges.cash;

            return (
              <div
                key={patient.id}
                className="card p-4 hover:shadow-md transition-shadow group relative"
              >
                {/* Selection checkbox */}
                <div className="absolute top-3 left-3">
                  <input
                    type="checkbox"
                    checked={selectedPatients.includes(patient.id)}
                    onChange={() => handleSelectPatient(patient.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>

                {/* Quick actions on hover */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={() => navigate(`/patients/${patient.id}`)}
                    className="p-1.5 bg-white rounded shadow hover:bg-blue-50 text-gray-600 hover:text-blue-600"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {hasPermission('patients.update') && (
                    <button
                      onClick={() => navigate(`/patients/${patient.id}/edit`)}
                      className="p-1.5 bg-white rounded shadow hover:bg-blue-50 text-gray-600 hover:text-blue-600"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {hasPermission('queue.create') && (
                    <button
                      onClick={() => setTokenModalPatient(patient)}
                      className="p-1.5 bg-white rounded shadow hover:bg-green-50 text-gray-600 hover:text-green-600"
                      title="Issue Token"
                    >
                      <Ticket className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-center text-center pt-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg mb-3">
                    {getInitials(patient.fullName)}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{patient.fullName}</h3>
                  <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded mb-2">
                    {patient.mrn}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                    <span>{calculateAge(patient.dateOfBirth)} yrs</span>
                    <span>•</span>
                    <span className="capitalize">{patient.gender}</span>
                  </div>
                  {patient.phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                      <Phone className="w-3 h-3" />
                      {patient.phone}
                    </div>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Issue Token Modal */}
      {tokenModalPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Issue Token</h2>
              <button
                onClick={() => setTokenModalPatient(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                  {getInitials(tokenModalPatient.fullName)}
                </div>
                <div>
                  <p className="font-medium">{tokenModalPatient.fullName}</p>
                  <p className="text-sm text-gray-500">{tokenModalPatient.mrn}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Point
                </label>
                <select
                  value={tokenServicePoint}
                  onChange={(e) => setTokenServicePoint(e.target.value as typeof tokenServicePoint)}
                  className="input w-full"
                >
                  <option value="registration">Registration</option>
                  <option value="triage">Triage</option>
                  <option value="consultation">Consultation</option>
                  <option value="laboratory">Laboratory</option>
                  <option value="radiology">Radiology</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="billing">Billing</option>
                  <option value="cashier">Cashier</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setTokenModalPatient(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    issueTokenMutation.mutate({
                      patientId: tokenModalPatient.id,
                      servicePoint: tokenServicePoint,
                    })
                  }
                  disabled={issueTokenMutation.isPending}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {issueTokenMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Ticket className="w-5 h-5" />
                      Issue Token
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close action menu */}
      {actionMenuOpen && (
        <div className="fixed inset-0 z-0" onClick={() => setActionMenuOpen(null)} />
      )}
    </div>
  );
}
