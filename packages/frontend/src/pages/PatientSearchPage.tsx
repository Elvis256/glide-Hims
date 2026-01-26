import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientsService, type Patient } from '../services/patients';
import { encountersService } from '../services/encounters';
import { usePatientStore } from '../store/patients';
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
} from 'lucide-react';

export default function PatientSearchPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'mrn' | 'name' | 'phone' | 'nationalId'>('all');
  const localSearchPatients = usePatientStore((state) => state.searchPatients);

  // Search patients from API
  const { data: apiPatients, isLoading, isError } = useQuery({
    queryKey: ['patients-search', searchTerm, searchType],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 20 }),
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

  // Combine API results with local store
  const localPatients = localSearchPatients(searchTerm);
  const patients = searchTerm.length >= 2 
    ? [...(apiPatients?.data || []), ...localPatients.filter(lp => !apiPatients?.data?.some(ap => ap.id === lp.id))]
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is reactive via useQuery
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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Patient Search</h1>
          <p className="text-gray-500 text-sm">Find existing patient records or register new patients</p>
        </div>
        <button
          onClick={() => navigate('/patients/new')}
          className="btn-primary flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Register New Patient
        </button>
      </div>

      {/* Search Form */}
      <div className="card p-3 mb-4 flex-shrink-0">
        <form onSubmit={handleSearch}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
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
          </div>
        </form>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Search Results */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="card p-4 flex-1 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">
              {searchTerm.length >= 2 ? `Results (${patients.length})` : 'Search Results'}
              {isLoading && <Loader2 className="w-4 h-4 animate-spin inline ml-2" />}
            </h2>
            
            <div className="flex-1 overflow-y-auto min-h-0">
              {!searchTerm || searchTerm.length < 2 ? (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500">Enter at least 2 characters to search</p>
                  <p className="text-gray-400 text-xs mt-1">Try "Sarah", "MRN-2024", or "0700"</p>
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
                  <button onClick={() => navigate('/patients/new')} className="btn-primary mt-3 text-sm">
                    Register New Patient
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {patients.map((patient) => (
                    <div
                      key={patient.id}
                      className="border rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-medium text-sm">
                            {patient.fullName?.split(' ')[0]?.charAt(0)}{patient.fullName?.split(' ')[1]?.charAt(0) || ''}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-gray-900 text-sm">{patient.fullName}</h3>
                              <span className="font-mono text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                {patient.mrn}
                              </span>
                            </div>
                            <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                              <span>{calculateAge(patient.dateOfBirth)}y • {patient.gender === 'male' ? 'M' : 'F'}</span>
                              {patient.phone && <span>{patient.phone}</span>}
                              {patient.bloodGroup && <span className="text-red-600">🩸{patient.bloodGroup}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}
                            className="btn-secondary text-xs px-2 py-1"
                          >
                            View
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/encounters/new?patientId=${patient.id}`); }}
                            className="btn-primary text-xs px-2 py-1"
                          >
                            Visit
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Recent Activity */}
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 flex-shrink-0">
              <Clock className="w-4 h-4 text-gray-400" />
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
    </div>
  );
}
