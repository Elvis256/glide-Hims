import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { vitalsService, type VitalRecord } from '../../services/vitals';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
}

// Calculate age from date of birth
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
  const ranges: Record<string, { min: number; max: number }> = {
    temperature: { min: 36.1, max: 37.2 },
    pulse: { min: 60, max: 100 },
    bpSystolic: { min: 90, max: 120 },
    bpDiastolic: { min: 60, max: 80 },
    respiratoryRate: { min: 12, max: 20 },
    oxygenSaturation: { min: 95, max: 100 },
  };
  const range = ranges[field];
  if (!range) return false;
  return value < range.min || value > range.max;
};

export default function VitalsHistoryPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [dateFilter, setDateFilter] = useState('all');

  // Search patients from API
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Transform API results to component format
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

  // Fetch vitals history for selected patient
  const { data: vitalsData, isLoading: vitalsLoading } = useQuery({
    queryKey: ['patient-vitals', selectedPatient?.id],
    queryFn: () => vitalsService.getPatientHistory(selectedPatient!.id, 50),
    enabled: !!selectedPatient?.id,
  });

  const filteredVitals = vitalsData || [];

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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Vitals History</h1>
              <p className="text-sm text-gray-500">View patient vital sign records</p>
            </div>
          </div>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
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
                        <p className="text-xs text-gray-500">{patient.mrn}</p>
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
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Type to search patients</p>
            )}
          </div>
        </div>

        {/* Vitals Table */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">
              {selectedPatient ? `${selectedPatient.name}'s Vitals` : 'Select a patient'}
            </h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
              </select>
            </div>
          </div>

          {selectedPatient ? (
            vitalsLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : filteredVitals.length > 0 ? (
              <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Date/Time</th>
                      <th className="text-center py-2 px-2 font-medium text-gray-600">
                        <Thermometer className="w-4 h-4 inline text-red-500" />
                      </th>
                      <th className="text-center py-2 px-2 font-medium text-gray-600">
                        <Activity className="w-4 h-4 inline text-pink-500" />
                      </th>
                      <th className="text-center py-2 px-2 font-medium text-gray-600">
                        <Heart className="w-4 h-4 inline text-red-500" />
                      </th>
                      <th className="text-center py-2 px-2 font-medium text-gray-600">
                        <Wind className="w-4 h-4 inline text-blue-500" />
                      </th>
                      <th className="text-center py-2 px-2 font-medium text-gray-600">
                        <Droplets className="w-4 h-4 inline text-blue-500" />
                      </th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">By</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredVitals.map((vital) => (
                      <tr key={vital.id} className="hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-gray-900">{formatDate(vital.createdAt)}</span>
                            <span className="text-gray-500">{formatTime(vital.createdAt)}</span>
                          </div>
                        </td>
                        <td className={`text-center py-2 px-2 font-medium ${
                          isAbnormal('temperature', vital.temperature) ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.temperature ? `${vital.temperature}°C` : '-'}
                        </td>
                        <td className={`text-center py-2 px-2 font-medium ${
                          isAbnormal('pulse', vital.pulse) ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.pulse || '-'}
                        </td>
                        <td className={`text-center py-2 px-2 font-medium ${
                          isAbnormal('bpSystolic', vital.bloodPressureSystolic) || isAbnormal('bpDiastolic', vital.bloodPressureDiastolic)
                            ? 'text-red-600'
                            : 'text-gray-900'
                        }`}>
                          {vital.bloodPressureSystolic && vital.bloodPressureDiastolic 
                            ? `${vital.bloodPressureSystolic}/${vital.bloodPressureDiastolic}` 
                            : '-'}
                        </td>
                        <td className={`text-center py-2 px-2 font-medium ${
                          isAbnormal('respiratoryRate', vital.respiratoryRate) ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.respiratoryRate || '-'}
                        </td>
                        <td className={`text-center py-2 px-2 font-medium ${
                          isAbnormal('oxygenSaturation', vital.oxygenSaturation) ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {vital.oxygenSaturation ? `${vital.oxygenSaturation}%` : '-'}
                        </td>
                        <td className="py-2 px-3 text-gray-600">{vital.recordedBy?.fullName || '-'}</td>
                        <td className="py-2 px-3 text-gray-500 text-xs max-w-[150px] truncate">
                          {vital.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
  );
}
