import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientsService, type Patient } from '../services/patients';
import { encountersService } from '../services/encounters';
import { usePatientStore } from '../store/patients';
import { useAuthStore } from '../store/auth';
import {
  Search,
  UserCircle,
  Eye,
  ClipboardPlus,
  Phone,
  Calendar,
  CreditCard,
  UserPlus,
  Clock,
  Users,
  TrendingUp,
  FileText,
  Receipt,
  MapPin,
  AlertCircle,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  Ticket,
  Edit,
  IdCard,
  Droplets,
  Crown,
  Building2,
  Shield,
  X,
  Keyboard,
} from 'lucide-react';

// Constants for filters
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS = [
  { value: '', label: 'All Genders' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

// Recent patients storage key
const RECENT_PATIENTS_KEY = 'glide-hims-recent-patients';

export default function PatientSearchPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'mrn' | 'name' | 'phone' | 'nationalId'>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  
  // Advanced filter states
  const [filterGender, setFilterGender] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [filterBloodGroup, setFilterBloodGroup] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  
  // Recent patients from localStorage
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);

  const localSearchPatients = usePatientStore((state) => state.searchPatients);

  // Permission check helper
  const hasPermission = useCallback((permission: string) => {
    if (user?.roles?.some(r => r === 'Super Admin')) return true;
    return user?.permissions?.includes(permission) || false;
  }, [user]);

  // Load recent patients from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_PATIENTS_KEY);
      if (stored) {
        setRecentPatients(JSON.parse(stored));
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Save patient to recent list
  const addToRecentPatients = useCallback((patient: Patient) => {
    setRecentPatients(prev => {
      const filtered = prev.filter(p => p.id !== patient.id);
      const updated = [patient, ...filtered].slice(0, 5);
      localStorage.setItem(RECENT_PATIENTS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Search patients from API
  const { data: apiPatients, isLoading, isError } = useQuery({
    queryKey: ['patients-search', searchTerm, searchType],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 50 }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Fetch recent encounters for activity sidebar
  const { data: recentEncounters } = useQuery({
    queryKey: ['recent-encounters'],
    queryFn: () => encountersService.list({ limit: 10 }),
    staleTime: 60000,
  });

  // Format time ago helper
  const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffHours / 24)} day${diffHours >= 48 ? 's' : ''} ago`;
  };

  // Calculate age helper
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

  // Format date helper
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Combine API results with local store and apply filters
  const localPatients = localSearchPatients(searchTerm);
  const rawPatients = searchTerm.length >= 2 
    ? [...(apiPatients?.data || []), ...localPatients.filter(lp => !apiPatients?.data?.some(ap => ap.id === lp.id))]
    : [];

  // Apply advanced filters
  const patients = rawPatients.filter(patient => {
    if (filterGender && patient.gender !== filterGender) return false;
    
    if (filterAgeMin || filterAgeMax) {
      const age = calculateAge(patient.dateOfBirth);
      if (filterAgeMin && age < parseInt(filterAgeMin)) return false;
      if (filterAgeMax && age > parseInt(filterAgeMax)) return false;
    }
    
    if (filterBloodGroup && patient.bloodGroup !== filterBloodGroup) return false;
    
    if (filterDateFrom) {
      const regDate = new Date(patient.createdAt);
      if (regDate < new Date(filterDateFrom)) return false;
    }
    
    if (filterDateTo) {
      const regDate = new Date(patient.createdAt);
      if (regDate > new Date(filterDateTo)) return false;
    }
    
    return true;
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is reactive via useQuery
  };

  // Handle patient selection
  const handleSelectPatient = useCallback((patient: Patient) => {
    addToRecentPatients(patient);
    navigate(`/patients/${patient.id}`);
  }, [addToRecentPatients, navigate]);

  // Clear all filters
  const clearFilters = () => {
    setFilterGender('');
    setFilterAgeMin('');
    setFilterAgeMax('');
    setFilterBloodGroup('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  // Check if any filters are active
  const hasActiveFilters = filterGender || filterAgeMin || filterAgeMax || filterBloodGroup || filterDateFrom || filterDateTo;

  // Export to CSV
  const exportToCSV = () => {
    if (patients.length === 0) {
      toast.error('No patients to export');
      return;
    }

    const headers = ['MRN', 'Name', 'Gender', 'Age', 'DOB', 'Phone', 'Blood Group', 'National ID', 'Registration Date'];
    const rows = patients.map(p => [
      p.mrn,
      p.fullName,
      p.gender,
      calculateAge(p.dateOfBirth),
      formatDate(p.dateOfBirth),
      p.phone || '',
      p.bloodGroup || '',
      p.nationalId || '',
      formatDate(p.createdAt),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `patients-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success(`Exported ${patients.length} patients to CSV`);
  };

  // Print patient list
  const printPatientList = () => {
    if (patients.length === 0) {
      toast.error('No patients to print');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Patient List</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            .print-date { font-size: 11px; color: #666; margin-bottom: 15px; }
          </style>
        </head>
        <body>
          <h1>Patient List</h1>
          <p class="print-date">Printed on: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>MRN</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Phone</th>
                <th>Blood Group</th>
              </tr>
            </thead>
            <tbody>
              ${patients.map(p => `
                <tr>
                  <td>${p.mrn}</td>
                  <td>${p.fullName}</td>
                  <td>${p.gender}</td>
                  <td>${calculateAge(p.dateOfBirth)}y</td>
                  <td>${p.phone || '-'}</td>
                  <td>${p.bloodGroup || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success('Print dialog opened');
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N for new patient
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        navigate('/patients/new');
        return;
      }

      // Only handle arrow keys when we have results
      if (patients.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, patients.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          if (selectedIndex >= 0 && patients[selectedIndex]) {
            e.preventDefault();
            handleSelectPatient(patients[selectedIndex]);
          }
          break;
        case 'Escape':
          setSelectedIndex(-1);
          searchInputRef.current?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [patients, selectedIndex, navigate, handleSelectPatient]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchTerm]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const items = resultsContainerRef.current.querySelectorAll('[data-patient-item]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Get patient badge
  const getPatientBadges = (patient: Patient) => {
    const badges = [];
    if (patient.paymentType === 'insurance') {
      badges.push({ label: 'Insurance', color: 'bg-blue-100 text-blue-700', icon: Shield });
    }
    if (patient.paymentType === 'corporate') {
      badges.push({ label: 'Corporate', color: 'bg-purple-100 text-purple-700', icon: Building2 });
    }
    if (patient.paymentType === 'membership' || patient.membershipType) {
      badges.push({ label: patient.membershipType || 'VIP', color: 'bg-amber-100 text-amber-700', icon: Crown });
    }
    return badges;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patient Search</h1>
          <p className="text-gray-500 text-sm">Find existing patient records or register new patients</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeyboardHelp(true)}
            className="btn-secondary flex items-center gap-1 text-xs"
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-4 h-4" />
            <span className="hidden sm:inline">Shortcuts</span>
          </button>
          <button
            onClick={() => navigate('/patients/new')}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Register New Patient
          </button>
        </div>
      </div>

      {/* Search Form */}
      <div className="card p-3 mb-4 flex-shrink-0">
        <form onSubmit={handleSearch}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search by MRN, name, phone, or national ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as typeof searchType)}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 sm:w-40 text-sm"
              >
                <option value="all">All Fields</option>
                <option value="mrn">MRN Only</option>
                <option value="name">Name Only</option>
                <option value="phone">Phone Only</option>
                <option value="nationalId">National ID</option>
              </select>
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`btn-secondary flex items-center gap-2 ${showAdvancedFilters ? 'bg-blue-50 border-blue-300' : ''}`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                {showAdvancedFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <div className="border-t pt-3 mt-1">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Advanced Filters</span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Gender</label>
                    <select
                      value={filterGender}
                      onChange={(e) => setFilterGender(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      {GENDERS.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Age Min</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filterAgeMin}
                      onChange={(e) => setFilterAgeMin(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="150"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Age Max</label>
                    <input
                      type="number"
                      placeholder="150"
                      value={filterAgeMax}
                      onChange={(e) => setFilterAgeMax(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max="150"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Blood Group</label>
                    <select
                      value={filterBloodGroup}
                      onChange={(e) => setFilterBloodGroup(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All</option>
                      {BLOOD_GROUPS.map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Registered From</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Registered To</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Search Results */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="card p-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 flex-shrink-0">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                {searchTerm.length >= 2 ? `Results (${patients.length})` : 'Search Results'}
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              </h2>
              {patients.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportToCSV}
                    className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                    title="Export to CSV"
                  >
                    <Download className="w-3 h-3" />
                    Export
                  </button>
                  <button
                    onClick={printPatientList}
                    className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                    title="Print list"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </button>
                </div>
              )}
            </div>
            
            <div ref={resultsContainerRef} className="flex-1 overflow-y-auto min-h-0">
              {!searchTerm || searchTerm.length < 2 ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">Enter at least 2 characters to search</p>
                  <p className="text-gray-400 text-xs mt-1">Try "Sarah", "MRN-2024", or "0700"</p>
                  <p className="text-gray-400 text-xs mt-2">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 ml-1">↓</kbd>
                    <span className="ml-1">to navigate</span>
                    <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 ml-2">Enter</kbd>
                    <span className="ml-1">to select</span>
                  </p>
                </div>
              ) : isLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-3 animate-spin" />
                  <p className="text-gray-500">Searching patients...</p>
                </div>
              ) : isError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
                  <p className="text-red-500">Error searching patients</p>
                  <p className="text-gray-400 text-xs mt-1">Please try again</p>
                </div>
              ) : patients.length === 0 ? (
                <div className="text-center py-8">
                  <UserCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">No patients found</p>
                  {hasActiveFilters && (
                    <button onClick={clearFilters} className="text-blue-600 text-sm mt-2 hover:underline">
                      Clear filters
                    </button>
                  )}
                  <button onClick={() => navigate('/patients/new')} className="btn-primary mt-3 text-sm">
                    Register New Patient
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {patients.map((patient, index) => {
                    const badges = getPatientBadges(patient);
                    const isSelected = index === selectedIndex;
                    
                    return (
                      <div
                        key={patient.id}
                        data-patient-item
                        className={`border rounded-lg p-3 transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                            : 'hover:border-blue-300 hover:bg-blue-50/30'
                        }`}
                        onClick={() => handleSelectPatient(patient)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Patient Photo/Avatar */}
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium text-sm relative">
                              {patient.fullName?.split(' ')[0]?.charAt(0)}{patient.fullName?.split(' ')[1]?.charAt(0) || ''}
                              {badges.length > 0 && (
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                                  <Crown className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-medium text-gray-900 text-sm">{patient.fullName}</h3>
                                <span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                  {patient.mrn}
                                </span>
                                {badges.map((badge, i) => (
                                  <span key={i} className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${badge.color}`}>
                                    <badge.icon className="w-3 h-3" />
                                    {badge.label}
                                  </span>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {calculateAge(patient.dateOfBirth)}y • {patient.gender === 'male' ? 'M' : patient.gender === 'female' ? 'F' : 'O'}
                                </span>
                                {patient.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {patient.phone}
                                  </span>
                                )}
                                {patient.bloodGroup && (
                                  <span className="flex items-center gap-1 text-red-600">
                                    <Droplets className="w-3 h-3" />
                                    {patient.bloodGroup}
                                  </span>
                                )}
                                {patient.nationalId && (
                                  <span className="flex items-center gap-1">
                                    <IdCard className="w-3 h-3" />
                                    {patient.nationalId}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                Registered: {formatDate(patient.createdAt)}
                              </div>
                            </div>
                          </div>
                          {/* Action Buttons */}
                          <div className="flex flex-wrap gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectPatient(patient); }}
                              className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                              title="View Profile"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                            {hasPermission('patients.update') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); addToRecentPatients(patient); navigate(`/patients/${patient.id}/edit`); }}
                                className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                                title="Edit Patient"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                            )}
                            {hasPermission('queue.create') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); addToRecentPatients(patient); navigate(`/opd/token?patientId=${patient.id}`); }}
                                className="btn-secondary text-xs px-2 py-1 flex items-center gap-1 text-green-600 hover:bg-green-50"
                                title="Issue Token"
                              >
                                <Ticket className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); addToRecentPatients(patient); navigate(`/encounters/new?patientId=${patient.id}`); }}
                              className="btn-primary text-xs px-2 py-1 flex items-center gap-1"
                              title="New Visit"
                            >
                              <ClipboardPlus className="w-3 h-3" />
                              Visit
                            </button>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                toast.info('Print card feature coming soon');
                              }}
                              className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
                              title="Print Patient Card"
                            >
                              <CreditCard className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Recent Patients */}
          {recentPatients.length > 0 && (
            <div className="card p-4 flex-shrink-0">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                Recently Viewed
              </h3>
              <div className="space-y-2">
                {recentPatients.slice(0, 5).map((patient) => (
                  <div 
                    key={patient.id} 
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleSelectPatient(patient)}
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium text-xs">
                      {patient.fullName?.split(' ')[0]?.charAt(0)}{patient.fullName?.split(' ')[1]?.charAt(0) || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-xs truncate">{patient.fullName}</p>
                      <p className="text-xs text-gray-500">{patient.mrn} • {calculateAge(patient.dateOfBirth)}y</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              Recent Activity
            </h3>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {(recentEncounters?.data || []).slice(0, 8).map((encounter) => (
                <div 
                  key={encounter.id} 
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/patients/${encounter.patientId}`)}
                >
                  <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-xs truncate">{encounter.patient?.fullName || 'Patient'}</p>
                    <p className="text-xs text-gray-500">{encounter.type?.toUpperCase()} • {encounter.status}</p>
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(encounter.createdAt)}</span>
                </div>
              ))}
              {(!recentEncounters?.data || recentEncounters.data.length === 0) && (
                <p className="text-xs text-gray-400 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card p-4 flex-shrink-0">
            <h3 className="text-sm font-semibold mb-3">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => navigate('/patients/new')}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <UserPlus className="w-5 h-5 text-blue-600" />
                <span className="text-xs text-gray-700">Register</span>
              </button>
              <button
                onClick={() => navigate('/opd/token')}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-green-300 hover:bg-green-50 transition-colors"
              >
                <Receipt className="w-5 h-5 text-green-600" />
                <span className="text-xs text-gray-700">Token</span>
              </button>
              <button
                onClick={() => navigate('/patients/documents')}
                className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-purple-300 hover:bg-purple-50 transition-colors"
              >
                <FileText className="w-5 h-5 text-purple-600" />
                <span className="text-xs text-gray-700">Docs</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowKeyboardHelp(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              <button onClick={() => setShowKeyboardHelp(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Navigate results</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">↑</kbd>
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">↓</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Select patient</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Enter</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Clear selection</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Esc</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">New patient</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Ctrl</kbd>
                  <span className="text-gray-400">+</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">N</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
