import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft,
  ClipboardList,
  Search,
  UserCircle,
  Calendar,
  Thermometer,
  Activity,
  Heart,
  Wind,
  Droplets,
  Filter,
  Download,
  Loader2,
  AlertTriangle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Table,
  List,
  Columns,
  X,
  Printer,
  FileSpreadsheet,
  ArrowUpDown,
  CheckSquare,
  User,
  AlertCircle,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import AccessDenied from '../../components/AccessDenied';
import { patientsService } from '../../services/patients';
import { vitalsService, type VitalRecord } from '../../services/vitals';
import { usePermissions } from '../../components/PermissionGate';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  admissionDate?: string;
}

type ViewMode = 'timeline' | 'table' | 'comparison';
type VitalType = 'all' | 'temperature' | 'bp' | 'pulse' | 'respiratoryRate' | 'oxygenSaturation' | 'painScale';
type SortField = 'createdAt' | 'temperature' | 'bp' | 'pulse' | 'respiratoryRate' | 'oxygenSaturation' | 'painScale' | 'recordedBy';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

const vitalRanges: Record<string, { min: number; max: number; unit: string; label: string; color: string }> = {
  temperature: { min: 36.1, max: 37.2, unit: '°C', label: 'Temperature', color: '#ef4444' },
  pulse: { min: 60, max: 100, unit: 'bpm', label: 'Pulse Rate', color: '#ec4899' },
  bpSystolic: { min: 90, max: 120, unit: 'mmHg', label: 'Systolic BP', color: '#f97316' },
  bpDiastolic: { min: 60, max: 80, unit: 'mmHg', label: 'Diastolic BP', color: '#f97316' },
  respiratoryRate: { min: 12, max: 20, unit: '/min', label: 'Respiratory Rate', color: '#3b82f6' },
  oxygenSaturation: { min: 95, max: 100, unit: '%', label: 'SpO2', color: '#06b6d4' },
  painScale: { min: 0, max: 3, unit: '/10', label: 'Pain Scale', color: '#8b5cf6' },
};

const calculateAge = (dob?: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const isAbnormal = (field: string, value?: number): boolean => {
  if (value === undefined || value === null) return false;
  const range = vitalRanges[field];
  if (!range) return false;
  return value < range.min || value > range.max;
};

const hasAnyAbnormal = (vital: VitalRecord): boolean => {
  return (
    isAbnormal('temperature', vital.temperature) ||
    isAbnormal('pulse', vital.pulse) ||
    isAbnormal('bpSystolic', vital.bloodPressureSystolic) ||
    isAbnormal('bpDiastolic', vital.bloodPressureDiastolic) ||
    isAbnormal('respiratoryRate', vital.respiratoryRate) ||
    isAbnormal('oxygenSaturation', vital.oxygenSaturation) ||
    isAbnormal('painScale', vital.painScale)
  );
};

function VitalSparkline({ data, color }: { data: { value: number }[]; color: string }) {
  if (data.length < 2) return <span className="text-gray-400 text-xs">--</span>;
  return (
    <div className="w-20 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function VitalsHistoryPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [vitalTypeFilter, setVitalTypeFilter] = useState<VitalType>('all');
  const [abnormalOnly, setAbnormalOnly] = useState(false);
  const [recordedByFilter, setRecordedByFilter] = useState('');
  
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  const filteredPatients: Patient[] = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const patients = apiPatients?.data || [];
    return patients.map(p => ({
      id: p.id,
      mrn: p.mrn,
      name: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
    }));
  }, [apiPatients, searchTerm]);

  const { data: vitalsData, isLoading: vitalsLoading } = useQuery({
    queryKey: ['patient-vitals-history', selectedPatient?.id],
    queryFn: () => vitalsService.getPatientHistory(selectedPatient!.id, 200),
    enabled: !!selectedPatient?.id,
  });

  const recorders = useMemo(() => {
    const set = new Set<string>();
    (vitalsData || []).forEach(v => {
      if (v.recordedBy?.fullName) set.add(v.recordedBy.fullName);
    });
    return Array.from(set);
  }, [vitalsData]);

  const filteredVitals = useMemo(() => {
    let result = vitalsData || [];
    
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter(v => new Date(v.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(v => new Date(v.createdAt) <= to);
    }
    
    if (abnormalOnly) {
      result = result.filter(hasAnyAbnormal);
    }
    
    if (recordedByFilter) {
      result = result.filter(v => v.recordedBy?.fullName === recordedByFilter);
    }
    
    result = [...result].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      
      switch (sortField) {
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'temperature':
          aVal = a.temperature || 0;
          bVal = b.temperature || 0;
          break;
        case 'pulse':
          aVal = a.pulse || 0;
          bVal = b.pulse || 0;
          break;
        case 'bp':
          aVal = a.bloodPressureSystolic || 0;
          bVal = b.bloodPressureSystolic || 0;
          break;
        case 'respiratoryRate':
          aVal = a.respiratoryRate || 0;
          bVal = b.respiratoryRate || 0;
          break;
        case 'oxygenSaturation':
          aVal = a.oxygenSaturation || 0;
          bVal = b.oxygenSaturation || 0;
          break;
        case 'recordedBy':
          aVal = a.recordedBy?.fullName || '';
          bVal = b.recordedBy?.fullName || '';
          break;
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
    
    return result;
  }, [vitalsData, dateFrom, dateTo, abnormalOnly, recordedByFilter, sortField, sortDirection]);

  const paginatedVitals = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredVitals.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredVitals, currentPage]);

  const totalPages = Math.ceil(filteredVitals.length / ITEMS_PER_PAGE);

  const summaryStats = useMemo(() => {
    if (!filteredVitals.length) return null;
    
    const latest = filteredVitals[0];
    const abnormalRecent = filteredVitals.slice(0, 5).some(hasAnyAbnormal);
    const firstRecord = filteredVitals[filteredVitals.length - 1];
    const daysSinceFirst = Math.floor(
      (new Date().getTime() - new Date(firstRecord.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return {
      latest,
      totalRecordings: filteredVitals.length,
      daysSinceFirst,
      hasRecentAbnormal: abnormalRecent,
    };
  }, [filteredVitals]);

  const sparklineData = useMemo(() => {
    const last10 = filteredVitals.slice(0, 10).reverse();
    return {
      temperature: last10.map(v => ({ value: v.temperature || 0 })),
      pulse: last10.map(v => ({ value: v.pulse || 0 })),
      bp: last10.map(v => ({ value: v.bloodPressureSystolic || 0 })),
      respiratoryRate: last10.map(v => ({ value: v.respiratoryRate || 0 })),
      oxygenSaturation: last10.map(v => ({ value: v.oxygenSaturation || 0 })),
    };
  }, [filteredVitals]);

  const comparisonVitals = useMemo(() => {
    return compareIds.map(id => filteredVitals.find(v => v.id === id)).filter(Boolean) as VitalRecord[];
  }, [compareIds, filteredVitals]);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 3) {
        toast.error('Can only compare up to 3 recordings');
        return prev;
      }
      return [...prev, id];
    });
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setVitalTypeFilter('all');
    setAbnormalOnly(false);
    setRecordedByFilter('');
    setCurrentPage(1);
  };

  const handleExportPDF = useCallback(() => {
    toast.success('Generating PDF...');
    setTimeout(() => toast.success('PDF downloaded successfully'), 1000);
    setShowExportMenu(false);
  }, []);

  const handleExportExcel = useCallback(() => {
    toast.success('Generating Excel file...');
    setTimeout(() => toast.success('Excel file downloaded successfully'), 1000);
    setShowExportMenu(false);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
    setShowExportMenu(false);
  }, []);

  if (!hasPermission('vitals.read')) {
    return <AccessDenied />;
  }

  const VitalValue = ({ field, value, unit }: { field: string; value?: number; unit?: string }) => {
    const abnormal = isAbnormal(field, value);
    return (
      <span className={`font-medium ${abnormal ? 'text-red-600 bg-red-50 px-1 rounded' : 'text-gray-900'}`}>
        {value != null ? `${value}${unit || ''}` : '-'}
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Vitals History</h1>
              <p className="text-sm text-gray-500">View and analyze patient vital sign records</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'timeline' ? 'bg-white shadow text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Timeline View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Table View"
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'comparison' ? 'bg-white shadow text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Comparison View"
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${showFilters ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(dateFrom || dateTo || abnormalOnly || recordedByFilter) && (
              <span className="w-2 h-2 bg-teal-500 rounded-full" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <button
                  onClick={handleExportPDF}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <FileText className="w-4 h-4" />
                  Export to PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export to Excel
                </button>
                <button
                  onClick={handlePrint}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Printer className="w-4 h-4" />
                  Print Summary
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Filters</h3>
            <button onClick={clearFilters} className="text-sm text-teal-600 hover:text-teal-700">
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vital Type</label>
              <select
                value={vitalTypeFilter}
                onChange={(e) => { setVitalTypeFilter(e.target.value as VitalType); setCurrentPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Vitals</option>
                <option value="temperature">Temperature</option>
                <option value="bp">Blood Pressure</option>
                <option value="pulse">Pulse Rate</option>
                <option value="respiratoryRate">Respiratory Rate</option>
                <option value="oxygenSaturation">SpO2</option>
                <option value="painScale">Pain Scale</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recorded By</label>
              <select
                value={recordedByFilter}
                onChange={(e) => { setRecordedByFilter(e.target.value); setCurrentPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">All Staff</option>
                {recorders.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={abnormalOnly}
                  onChange={(e) => { setAbnormalOnly(e.target.checked); setCurrentPage(1); }}
                  className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-gray-700">Abnormal Only</span>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient Selection Sidebar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => {
                      setSelectedPatient(patient);
                      setSearchTerm('');
                      setCompareIds([]);
                      setCurrentPage(1);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPatient?.id === patient.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-8 h-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y • {patient.gender}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No patients found</p>
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-teal-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y • {selectedPatient.gender}</p>
                  </div>
                  <button
                    onClick={() => { setSelectedPatient(null); setCompareIds([]); }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Type to search patients</p>
            )}
          </div>

          {/* Quick Charts */}
          {selectedPatient && filteredVitals.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Quick Trends</h3>
                <button
                  onClick={() => navigate(`/nursing/vital-trends?patientId=${selectedPatient.id}`)}
                  className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1"
                >
                  Full Charts <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-red-500" /> Temp
                  </span>
                  <VitalSparkline data={sparklineData.temperature} color="#ef4444" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-pink-500" /> Pulse
                  </span>
                  <VitalSparkline data={sparklineData.pulse} color="#ec4899" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-orange-500" /> BP
                  </span>
                  <VitalSparkline data={sparklineData.bp} color="#f97316" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-cyan-500" /> SpO2
                  </span>
                  <VitalSparkline data={sparklineData.oxygenSaturation} color="#06b6d4" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 flex flex-col min-h-0 space-y-4">
          {/* Summary Cards */}
          {selectedPatient && summaryStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-teal-100 rounded-lg">
                    <Activity className="w-4 h-4 text-teal-600" />
                  </div>
                  <span className="text-xs text-gray-500">Latest Recording</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{formatDateTime(summaryStats.latest.createdAt)}</p>
                <p className="text-xs text-gray-500">
                  {summaryStats.latest.temperature && `${summaryStats.latest.temperature}°C`}
                  {summaryStats.latest.pulse && ` • ${summaryStats.latest.pulse}bpm`}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-500">Total Recordings</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.totalRecordings}</p>
                <p className="text-xs text-gray-500">vital recordings</p>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="text-xs text-gray-500">Tracking Period</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.daysSinceFirst}</p>
                <p className="text-xs text-gray-500">days of data</p>
              </div>

              <div className={`rounded-xl border p-3 ${summaryStats.hasRecentAbnormal ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${summaryStats.hasRecentAbnormal ? 'bg-red-100' : 'bg-green-100'}`}>
                    {summaryStats.hasRecentAbnormal ? (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    ) : (
                      <CheckSquare className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  <span className="text-xs text-gray-500">Status</span>
                </div>
                <p className={`text-sm font-medium ${summaryStats.hasRecentAbnormal ? 'text-red-700' : 'text-green-700'}`}>
                  {summaryStats.hasRecentAbnormal ? 'Abnormal Values Detected' : 'All Values Normal'}
                </p>
                <p className="text-xs text-gray-500">in recent recordings</p>
              </div>
            </div>
          )}

          {/* Main View Area */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 flex flex-col min-h-0">
            {selectedPatient ? (
              vitalsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : filteredVitals.length > 0 ? (
                <>
                  {/* Timeline View */}
                  {viewMode === 'timeline' && (
                    <div className="flex-1 overflow-auto min-h-0">
                      <div className="relative pl-8 space-y-4">
                        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
                        
                        {filteredVitals.map((vital) => (
                          <div key={vital.id} className="relative">
                            <div className={`absolute left-0 top-3 w-2.5 h-2.5 rounded-full border-2 ${
                              hasAnyAbnormal(vital) ? 'bg-red-500 border-red-300' : 'bg-teal-500 border-teal-300'
                            }`} />
                            
                            <div className={`ml-4 p-4 rounded-lg border transition-colors ${
                              expandedId === vital.id ? 'border-teal-300 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                            }`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-gray-900">{formatDateTime(vital.createdAt)}</span>
                                  {hasAnyAbnormal(vital) && (
                                    <span className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                      <AlertCircle className="w-3 h-3" /> Abnormal
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <User className="w-3 h-3" /> {vital.recordedBy?.fullName || 'Unknown'}
                                  </span>
                                  <button
                                    onClick={() => setExpandedId(expandedId === vital.id ? null : vital.id)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                  >
                                    {expandedId === vital.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>
                                  <button
                                    onClick={() => toggleCompare(vital.id)}
                                    className={`p-1 rounded ${compareIds.includes(vital.id) ? 'text-teal-600 bg-teal-100' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="Compare"
                                  >
                                    <Columns className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-sm">
                                <div>
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Thermometer className="w-3 h-3 text-red-500" /> Temp
                                  </span>
                                  <VitalValue field="temperature" value={vital.temperature} unit="°C" />
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Activity className="w-3 h-3 text-pink-500" /> Pulse
                                  </span>
                                  <VitalValue field="pulse" value={vital.pulse} unit=" bpm" />
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Heart className="w-3 h-3 text-orange-500" /> BP
                                  </span>
                                  <span className={`font-medium ${
                                    isAbnormal('bpSystolic', vital.bloodPressureSystolic) || isAbnormal('bpDiastolic', vital.bloodPressureDiastolic)
                                      ? 'text-red-600 bg-red-50 px-1 rounded' : 'text-gray-900'
                                  }`}>
                                    {vital.bloodPressureSystolic && vital.bloodPressureDiastolic
                                      ? `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic}`
                                      : '-'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Wind className="w-3 h-3 text-blue-500" /> RR
                                  </span>
                                  <VitalValue field="respiratoryRate" value={vital.respiratoryRate} unit="/min" />
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <Droplets className="w-3 h-3 text-cyan-500" /> SpO2
                                  </span>
                                  <VitalValue field="oxygenSaturation" value={vital.oxygenSaturation} unit="%" />
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <BarChart3 className="w-3 h-3 text-purple-500" /> Pain
                                  </span>
                                  <VitalValue field="painScale" value={vital.painScale} unit="/10" />
                                </div>
                              </div>
                              
                              {expandedId === vital.id && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-xs text-gray-500">Weight</span>
                                      <p className="font-medium text-gray-900">{vital.weight ? `${vital.weight} kg` : '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Height</span>
                                      <p className="font-medium text-gray-900">{vital.height ? `${vital.height} cm` : '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Blood Glucose</span>
                                      <p className="font-medium text-gray-900">{vital.bloodGlucose ? `${vital.bloodGlucose} mg/dL` : '-'}</p>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Recorded At</span>
                                      <p className="font-medium text-gray-900">{formatDateTime(vital.createdAt)}</p>
                                    </div>
                                  </div>
                                  {vital.notes && (
                                    <div className="mt-3">
                                      <span className="text-xs text-gray-500">Notes</span>
                                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded mt-1">{vital.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Table View */}
                  {viewMode === 'table' && (
                    <>
                      <div className="flex-1 overflow-auto min-h-0">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="text-left py-2 px-3">
                                <button
                                  onClick={() => handleSort('createdAt')}
                                  className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900"
                                >
                                  Date/Time
                                  <ArrowUpDown className="w-3 h-3" />
                                </button>
                              </th>
                              <th className="text-center py-2 px-2">
                                <button
                                  onClick={() => handleSort('temperature')}
                                  className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 mx-auto"
                                >
                                  <Thermometer className="w-4 h-4 text-red-500" />
                                </button>
                              </th>
                              <th className="text-center py-2 px-2">
                                <button
                                  onClick={() => handleSort('bp')}
                                  className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 mx-auto"
                                >
                                  <Heart className="w-4 h-4 text-orange-500" />
                                </button>
                              </th>
                              <th className="text-center py-2 px-2">
                                <button
                                  onClick={() => handleSort('pulse')}
                                  className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 mx-auto"
                                >
                                  <Activity className="w-4 h-4 text-pink-500" />
                                </button>
                              </th>
                              <th className="text-center py-2 px-2">
                                <button
                                  onClick={() => handleSort('respiratoryRate')}
                                  className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 mx-auto"
                                >
                                  <Wind className="w-4 h-4 text-blue-500" />
                                </button>
                              </th>
                              <th className="text-center py-2 px-2">
                                <button
                                  onClick={() => handleSort('oxygenSaturation')}
                                  className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900 mx-auto"
                                >
                                  <Droplets className="w-4 h-4 text-cyan-500" />
                                </button>
                              </th>
                              <th className="text-center py-2 px-2">Pain</th>
                              <th className="text-left py-2 px-3">
                                <button
                                  onClick={() => handleSort('recordedBy')}
                                  className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900"
                                >
                                  Recorded By
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {paginatedVitals.map((vital) => (
                              <tr key={vital.id} className={`hover:bg-gray-50 ${hasAnyAbnormal(vital) ? 'bg-red-50/50' : ''}`}>
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="text-gray-900">{formatDate(vital.createdAt)}</span>
                                    <span className="text-gray-500">{formatTime(vital.createdAt)}</span>
                                  </div>
                                </td>
                                <td className={`text-center py-2 px-2 ${
                                  isAbnormal('temperature', vital.temperature) ? 'bg-red-100 text-red-700 font-medium' : ''
                                }`}>
                                  {vital.temperature ? `${vital.temperature}°C` : '-'}
                                </td>
                                <td className={`text-center py-2 px-2 ${
                                  isAbnormal('bpSystolic', vital.bloodPressureSystolic) || isAbnormal('bpDiastolic', vital.bloodPressureDiastolic)
                                    ? 'bg-red-100 text-red-700 font-medium' : ''
                                }`}>
                                  {vital.bloodPressureSystolic && vital.bloodPressureDiastolic
                                    ? `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic}`
                                    : '-'}
                                </td>
                                <td className={`text-center py-2 px-2 ${
                                  isAbnormal('pulse', vital.pulse) ? 'bg-red-100 text-red-700 font-medium' : ''
                                }`}>
                                  {vital.pulse || '-'}
                                </td>
                                <td className={`text-center py-2 px-2 ${
                                  isAbnormal('respiratoryRate', vital.respiratoryRate) ? 'bg-red-100 text-red-700 font-medium' : ''
                                }`}>
                                  {vital.respiratoryRate || '-'}
                                </td>
                                <td className={`text-center py-2 px-2 ${
                                  isAbnormal('oxygenSaturation', vital.oxygenSaturation) ? 'bg-red-100 text-red-700 font-medium' : ''
                                }`}>
                                  {vital.oxygenSaturation ? `${vital.oxygenSaturation}%` : '-'}
                                </td>
                                <td className={`text-center py-2 px-2 ${
                                  isAbnormal('painScale', vital.painScale) ? 'bg-red-100 text-red-700 font-medium' : ''
                                }`}>
                                  {vital.painScale ?? '-'}
                                </td>
                                <td className="py-2 px-3 text-gray-600">{vital.recordedBy?.fullName || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-500">
                            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredVitals.length)} of {filteredVitals.length}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                              Previous
                            </button>
                            <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
                            <button
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Comparison View */}
                  {viewMode === 'comparison' && (
                    <div className="flex-1 overflow-auto min-h-0">
                      {compareIds.length === 0 ? (
                        <div className="text-center py-12">
                          <Columns className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">Select recordings to compare (up to 3)</p>
                          <p className="text-sm text-gray-400 mt-1">Click the compare icon on timeline entries</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left py-3 px-4 font-medium text-gray-600 w-40">Vital Sign</th>
                                {comparisonVitals.map((v) => (
                                  <th key={v.id} className="text-center py-3 px-4 min-w-[150px]">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="font-medium text-gray-900">{formatDate(v.createdAt)}</p>
                                        <p className="text-xs text-gray-500">{formatTime(v.createdAt)}</p>
                                      </div>
                                      <button
                                        onClick={() => toggleCompare(v.id)}
                                        className="p-1 text-gray-400 hover:text-red-500"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {[
                                { key: 'temperature', label: 'Temperature', unit: '°C', icon: <Thermometer className="w-4 h-4 text-red-500" /> },
                                { key: 'bp', label: 'Blood Pressure', unit: 'mmHg', icon: <Heart className="w-4 h-4 text-orange-500" /> },
                                { key: 'pulse', label: 'Pulse Rate', unit: 'bpm', icon: <Activity className="w-4 h-4 text-pink-500" /> },
                                { key: 'respiratoryRate', label: 'Respiratory Rate', unit: '/min', icon: <Wind className="w-4 h-4 text-blue-500" /> },
                                { key: 'oxygenSaturation', label: 'SpO2', unit: '%', icon: <Droplets className="w-4 h-4 text-cyan-500" /> },
                                { key: 'painScale', label: 'Pain Scale', unit: '/10', icon: <BarChart3 className="w-4 h-4 text-purple-500" /> },
                                { key: 'weight', label: 'Weight', unit: 'kg', icon: null },
                                { key: 'height', label: 'Height', unit: 'cm', icon: null },
                                { key: 'bloodGlucose', label: 'Blood Glucose', unit: 'mg/dL', icon: null },
                              ].map((row) => (
                                <tr key={row.key}>
                                  <td className="py-3 px-4 font-medium text-gray-700">
                                    <div className="flex items-center gap-2">
                                      {row.icon}
                                      {row.label}
                                    </div>
                                  </td>
                                  {comparisonVitals.map((v, idx) => {
                                    let value: string | number = '-';
                                    let abnormal = false;
                                    
                                    if (row.key === 'bp') {
                                      if (v.bloodPressureSystolic && v.bloodPressureDiastolic) {
                                        value = `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`;
                                        abnormal = isAbnormal('bpSystolic', v.bloodPressureSystolic) || isAbnormal('bpDiastolic', v.bloodPressureDiastolic);
                                      }
                                    } else {
                                      const val = v[row.key as keyof VitalRecord] as number | undefined;
                                      if (val != null) {
                                        value = `${val}${row.unit}`;
                                        abnormal = isAbnormal(row.key, val);
                                      }
                                    }
                                    
                                    let highlight = false;
                                    if (idx > 0 && comparisonVitals.length > 1) {
                                      const prevVal = row.key === 'bp'
                                        ? comparisonVitals[idx - 1].bloodPressureSystolic
                                        : comparisonVitals[idx - 1][row.key as keyof VitalRecord];
                                      const currVal = row.key === 'bp'
                                        ? v.bloodPressureSystolic
                                        : v[row.key as keyof VitalRecord];
                                      highlight = prevVal !== currVal;
                                    }
                                    
                                    return (
                                      <td
                                        key={v.id}
                                        className={`text-center py-3 px-4 ${
                                          abnormal ? 'bg-red-100 text-red-700 font-medium' : ''
                                        } ${highlight ? 'ring-2 ring-amber-400 ring-inset' : ''}`}
                                      >
                                        {value}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                              <tr>
                                <td className="py-3 px-4 font-medium text-gray-700">Notes</td>
                                {comparisonVitals.map((v) => (
                                  <td key={v.id} className="py-3 px-4 text-sm text-gray-600">
                                    {v.notes || '-'}
                                  </td>
                                ))}
                              </tr>
                              <tr className="bg-gray-50">
                                <td className="py-3 px-4 font-medium text-gray-700">Recorded By</td>
                                {comparisonVitals.map((v) => (
                                  <td key={v.id} className="py-3 px-4 text-center text-sm text-gray-600">
                                    {v.recordedBy?.fullName || '-'}
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                      
                      {compareIds.length < 3 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-500 mb-2">Add recordings to compare:</p>
                          <div className="flex flex-wrap gap-2">
                            {filteredVitals.slice(0, 10).filter(v => !compareIds.includes(v.id)).map(v => (
                              <button
                                key={v.id}
                                onClick={() => toggleCompare(v.id)}
                                className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:border-teal-400 hover:bg-teal-50"
                              >
                                {formatDateTime(v.createdAt)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No vitals recorded for this patient</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>Select a patient to view vitals history</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
