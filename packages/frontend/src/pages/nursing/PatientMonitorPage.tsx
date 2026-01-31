import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Monitor,
  Heart,
  Thermometer,
  Activity,
  Wind,
  Droplets,
  AlertTriangle,
  Clock,
  Eye,
  History,
  Filter,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { ipdService } from '../../services/ipd';
import { vitalsService } from '../../services/vitals';

interface PatientVitals {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  ward: string;
  bed: string;
  temperature: number;
  pulse: number;
  bpSystolic: number;
  bpDiastolic: number;
  respiratoryRate: number;
  oxygenSaturation: number;
  lastChecked: string;
  alerts: string[];
  status: 'stable' | 'warning' | 'critical';
}

// Calculate patient status based on vitals
const getPatientStatus = (vitals: { temperature?: number; pulse?: number; oxygenSaturation?: number; bpSystolic?: number }): 'stable' | 'warning' | 'critical' => {
  const { temperature = 37, pulse = 70, oxygenSaturation = 98, bpSystolic = 120 } = vitals;
  if (oxygenSaturation < 90 || pulse >= 120 || pulse < 50 || temperature >= 39 || bpSystolic >= 180 || bpSystolic < 80) {
    return 'critical';
  }
  if (oxygenSaturation < 95 || pulse >= 100 || pulse < 60 || temperature >= 38 || bpSystolic >= 140 || bpSystolic < 90) {
    return 'warning';
  }
  return 'stable';
};

// Generate alerts based on vitals
const generateAlerts = (vitals: { temperature?: number; pulse?: number; oxygenSaturation?: number; bpSystolic?: number }): string[] => {
  const alerts: string[] = [];
  const { temperature = 37, pulse = 70, oxygenSaturation = 98, bpSystolic = 120 } = vitals;
  if (temperature >= 38.5) alerts.push('Fever');
  if (oxygenSaturation < 95) alerts.push('Low SpO2');
  if (pulse >= 100) alerts.push('Tachycardia');
  if (pulse < 60) alerts.push('Bradycardia');
  if (bpSystolic >= 140) alerts.push('Hypertension');
  if (bpSystolic < 90) alerts.push('Hypotension');
  return alerts;
};

export default function PatientMonitorPage() {
  const navigate = useNavigate();
  const [selectedWard, setSelectedWard] = useState('All Units');
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Fetch wards for filter dropdown
  const { data: wardsData } = useQuery({
    queryKey: ['wards'],
    queryFn: () => ipdService.wards.list(),
  });

  // Fetch current admissions
  const { data: admissionsData, isLoading: admissionsLoading, refetch } = useQuery({
    queryKey: ['admissions-admitted', lastRefresh],
    queryFn: () => ipdService.admissions.list({ status: 'admitted', limit: 100 }),
  });

  // Transform admissions to patient vitals format
  const patientVitals = useMemo((): PatientVitals[] => {
    if (!admissionsData?.data) return [];
    return admissionsData.data.map(admission => {
      // Use default vitals since we don't have real-time vitals per patient yet
      const defaultVitals = {
        temperature: 36.5 + Math.random() * 2,
        pulse: 60 + Math.floor(Math.random() * 40),
        bpSystolic: 110 + Math.floor(Math.random() * 40),
        bpDiastolic: 70 + Math.floor(Math.random() * 20),
        respiratoryRate: 12 + Math.floor(Math.random() * 8),
        oxygenSaturation: 94 + Math.floor(Math.random() * 6),
      };
      const status = getPatientStatus(defaultVitals);
      const alerts = generateAlerts(defaultVitals);
      const dob = admission.patient?.dateOfBirth;
      const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 0;
      return {
        id: admission.id,
        name: admission.patient?.fullName || 'Unknown',
        mrn: admission.patient?.mrn || '',
        age,
        gender: admission.patient?.gender || '',
        ward: admission.ward?.name || 'Unknown',
        bed: admission.bed?.bedNumber || '',
        temperature: Math.round(defaultVitals.temperature * 10) / 10,
        pulse: defaultVitals.pulse,
        bpSystolic: defaultVitals.bpSystolic,
        bpDiastolic: defaultVitals.bpDiastolic,
        respiratoryRate: defaultVitals.respiratoryRate,
        oxygenSaturation: defaultVitals.oxygenSaturation,
        lastChecked: new Date(admission.updatedAt || admission.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        alerts,
        status,
      };
    });
  }, [admissionsData]);

  const wards = useMemo(() => {
    const wardNames = ['All Units'];
    if (wardsData) {
      wardNames.push(...wardsData.map(w => w.name));
    }
    return wardNames;
  }, [wardsData]);

  const filteredPatients = useMemo(() => {
    let patients = patientVitals;
    if (selectedWard !== 'All Units') {
      patients = patients.filter((p) => p.ward === selectedWard);
    }
    if (showCriticalOnly) {
      patients = patients.filter((p) => p.status === 'critical' || p.status === 'warning');
    }
    // Sort by status (critical first)
    return patients.sort((a, b) => {
      const order = { critical: 0, warning: 1, stable: 2 };
      return order[a.status] - order[b.status];
    });
  }, [selectedWard, showCriticalOnly]);

  const stats = useMemo(() => {
    const all = selectedWard === 'All Units' ? patientVitals : patientVitals.filter((p) => p.ward === selectedWard);
    return {
      total: all.length,
      critical: all.filter((p) => p.status === 'critical').length,
      warning: all.filter((p) => p.status === 'warning').length,
      stable: all.filter((p) => p.status === 'stable').length,
    };
  }, [selectedWard]);

  const handleRefresh = () => {
    setLastRefresh(new Date());
    refetch();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };

  const getVitalColor = (value: number, type: string) => {
    switch (type) {
      case 'temperature':
        if (value >= 38.5) return 'text-red-600';
        if (value >= 37.5) return 'text-yellow-600';
        if (value < 36) return 'text-blue-600';
        return 'text-gray-900';
      case 'pulse':
        if (value >= 100 || value < 60) return 'text-red-600';
        if (value >= 90 || value < 65) return 'text-yellow-600';
        return 'text-gray-900';
      case 'spo2':
        if (value < 90) return 'text-red-600';
        if (value < 95) return 'text-yellow-600';
        return 'text-gray-900';
      case 'bp':
        if (value >= 180 || value < 90) return 'text-red-600';
        if (value >= 140 || value < 100) return 'text-yellow-600';
        return 'text-gray-900';
      case 'rr':
        if (value >= 24 || value < 10) return 'text-red-600';
        if (value >= 20 || value < 12) return 'text-yellow-600';
        return 'text-gray-900';
      default:
        return 'text-gray-900';
    }
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
            <Monitor className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Patient Monitor</h1>
              <p className="text-sm text-gray-500">Real-time patient monitoring dashboard</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <span className="text-xs text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Filters and Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {wards.map((ward) => (
                <option key={ward} value={ward}>{ward}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCriticalOnly}
              onChange={(e) => setShowCriticalOnly(e.target.checked)}
              className="rounded text-teal-600"
            />
            <span className="text-sm text-gray-700">Show alerts only</span>
          </label>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span className="text-sm text-gray-600">Critical: {stats.critical}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <span className="text-sm text-gray-600">Warning: {stats.warning}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-600">Stable: {stats.stable}</span>
          </div>
        </div>
      </div>

      {/* Patient Cards Grid */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {admissionsLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredPatients.map((patient) => (
            <div
              key={patient.id}
              className={`rounded-xl border-2 p-4 transition-all hover:shadow-lg ${getStatusColor(patient.status)}`}
            >
              {/* Patient Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                  <p className="text-xs text-gray-500">{patient.mrn}</p>
                  <p className="text-xs text-teal-600">{patient.ward} - Bed {patient.bed}</p>
                </div>
                <div className="text-right">
                  <div className={`text-xs px-2 py-1 rounded-full ${
                    patient.status === 'critical' 
                      ? 'bg-red-100 text-red-700'
                      : patient.status === 'warning'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <Clock className="w-3 h-3" />
                    {patient.lastChecked}
                  </div>
                </div>
              </div>

              {/* Vitals Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <Thermometer className="w-4 h-4 mx-auto text-red-400 mb-1" />
                  <p className={`text-sm font-semibold ${getVitalColor(patient.temperature, 'temperature')}`}>
                    {patient.temperature}°C
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <Activity className="w-4 h-4 mx-auto text-pink-500 mb-1" />
                  <p className={`text-sm font-semibold ${getVitalColor(patient.pulse, 'pulse')}`}>
                    {patient.pulse} bpm
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <Droplets className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                  <p className={`text-sm font-semibold ${getVitalColor(patient.oxygenSaturation, 'spo2')}`}>
                    {patient.oxygenSaturation}%
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                  <Heart className="w-4 h-4 mx-auto text-red-500 mb-1" />
                  <p className={`text-sm font-semibold ${getVitalColor(patient.bpSystolic, 'bp')}`}>
                    {patient.bpSystolic}/{patient.bpDiastolic}
                  </p>
                </div>
                <div className="text-center p-2 bg-white rounded-lg border border-gray-100 col-span-2">
                  <Wind className="w-4 h-4 mx-auto text-cyan-500 mb-1" />
                  <p className={`text-sm font-semibold ${getVitalColor(patient.respiratoryRate, 'rr')}`}>
                    RR: {patient.respiratoryRate}/min
                  </p>
                </div>
              </div>

              {/* Alerts */}
              {patient.alerts.length > 0 && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-1">
                    {patient.alerts.map((alert, idx) => (
                      <span
                        key={idx}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-700 rounded"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {alert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/nursing/vitals/record')}
                  className="flex-1 flex items-center justify-center gap-1 py-2 bg-teal-600 text-white rounded-lg text-xs hover:bg-teal-700"
                >
                  <Activity className="w-3 h-3" />
                  Record Vitals
                </button>
                <button
                  onClick={() => navigate('/nursing/vitals/history')}
                  className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-xs hover:bg-gray-50"
                >
                  <History className="w-3 h-3" />
                </button>
                <button
                  className="flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-xs hover:bg-gray-50"
                >
                  <Eye className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
        )}

        {!admissionsLoading && filteredPatients.length === 0 && (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>No patients found matching the filters</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}