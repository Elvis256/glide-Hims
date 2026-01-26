import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Heart,
  Search,
  UserCircle,
  Thermometer,
  Activity,
  Wind,
  Droplets,
  Scale,
  Ruler,
  Save,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../services/patients';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
}

interface VitalRanges {
  min: number;
  max: number;
  unit: string;
}

const vitalRanges: Record<string, VitalRanges> = {
  temperature: { min: 36.1, max: 37.2, unit: '°C' },
  pulse: { min: 60, max: 100, unit: 'bpm' },
  bpSystolic: { min: 90, max: 120, unit: 'mmHg' },
  bpDiastolic: { min: 60, max: 80, unit: 'mmHg' },
  respiratoryRate: { min: 12, max: 20, unit: '/min' },
  oxygenSaturation: { min: 95, max: 100, unit: '%' },
  bloodGlucose: { min: 70, max: 100, unit: 'mg/dL' },
};

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

export default function RecordVitalsPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [vitals, setVitals] = useState({
    temperature: '',
    pulse: '',
    bpSystolic: '',
    bpDiastolic: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    bloodGlucose: '',
    painScale: '',
    notes: '',
  });

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

  const isAbnormal = (field: string, value: string): boolean => {
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    const range = vitalRanges[field];
    if (!range) return false;
    return num < range.min || num > range.max;
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 1000);
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setVitals({
      temperature: '',
      pulse: '',
      bpSystolic: '',
      bpDiastolic: '',
      respiratoryRate: '',
      oxygenSaturation: '',
      weight: '',
      height: '',
      bloodGlucose: '',
      painScale: '',
      notes: '',
    });
    setSaved(false);
  };

  const bmi = useMemo(() => {
    const w = parseFloat(vitals.weight);
    const h = parseFloat(vitals.height) / 100;
    if (w > 0 && h > 0) {
      return (w / (h * h)).toFixed(1);
    }
    return null;
  }, [vitals.weight, vitals.height]);

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Vitals Recorded Successfully</h2>
          <p className="text-gray-600 mb-6">
            Vitals for {selectedPatient?.name} have been saved
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Record Another
            </button>
            <button
              onClick={() => navigate('/nursing/vitals/history')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              View History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Heart className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Record Vitals</h1>
            <p className="text-sm text-gray-500">Capture patient vital signs</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
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
                        : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y • {patient.gender}</p>
                        {patient.ward && (
                          <p className="text-xs text-teal-600">{patient.ward} - Bed {patient.bed}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No patients found</p>
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y</p>
                    {selectedPatient.ward && (
                      <p className="text-xs text-teal-600">{selectedPatient.ward} - Bed {selectedPatient.bed}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Search for a patient to record vitals</p>
            )}
          </div>
        </div>

        {/* Vital Signs Form */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <h2 className="font-semibold text-gray-900 mb-3">Vital Signs</h2>
          
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Temperature */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Thermometer className="w-4 h-4 text-red-500" />
                    Temperature
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="36.5"
                      value={vitals.temperature}
                      onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        isAbnormal('temperature', vitals.temperature)
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">°C</span>
                  </div>
                  {isAbnormal('temperature', vitals.temperature) && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Abnormal
                    </p>
                  )}
                </div>

                {/* Pulse */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Activity className="w-4 h-4 text-pink-500" />
                    Pulse Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="72"
                      value={vitals.pulse}
                      onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        isAbnormal('pulse', vitals.pulse)
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">bpm</span>
                  </div>
                  {isAbnormal('pulse', vitals.pulse) && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Abnormal
                    </p>
                  )}
                </div>

                {/* Blood Pressure */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Heart className="w-4 h-4 text-red-500" />
                    Blood Pressure
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="120"
                      value={vitals.bpSystolic}
                      onChange={(e) => setVitals({ ...vitals, bpSystolic: e.target.value })}
                      className={`w-full px-2 py-2 border rounded-lg text-sm ${
                        isAbnormal('bpSystolic', vitals.bpSystolic)
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    <span className="text-gray-500">/</span>
                    <input
                      type="number"
                      placeholder="80"
                      value={vitals.bpDiastolic}
                      onChange={(e) => setVitals({ ...vitals, bpDiastolic: e.target.value })}
                      className={`w-full px-2 py-2 border rounded-lg text-sm ${
                        isAbnormal('bpDiastolic', vitals.bpDiastolic)
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>

                {/* Respiratory Rate */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Wind className="w-4 h-4 text-blue-500" />
                    Respiratory Rate
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="16"
                      value={vitals.respiratoryRate}
                      onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        isAbnormal('respiratoryRate', vitals.respiratoryRate)
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">/min</span>
                  </div>
                </div>

                {/* SpO2 */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    SpO2
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="98"
                      value={vitals.oxygenSaturation}
                      onChange={(e) => setVitals({ ...vitals, oxygenSaturation: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        isAbnormal('oxygenSaturation', vitals.oxygenSaturation)
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                  </div>
                </div>

                {/* Blood Glucose */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Droplets className="w-4 h-4 text-purple-500" />
                    Blood Glucose
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="95"
                      value={vitals.bloodGlucose}
                      onChange={(e) => setVitals({ ...vitals, bloodGlucose: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg text-sm ${
                        isAbnormal('bloodGlucose', vitals.bloodGlucose)
                          ? 'border-red-300 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">mg/dL</span>
                  </div>
                </div>

                {/* Weight */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Scale className="w-4 h-4 text-gray-500" />
                    Weight
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="70"
                      value={vitals.weight}
                      onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">kg</span>
                  </div>
                </div>

                {/* Height */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                    <Ruler className="w-4 h-4 text-gray-500" />
                    Height
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="170"
                      value={vitals.height}
                      onChange={(e) => setVitals({ ...vitals, height: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">cm</span>
                  </div>
                </div>

                {/* BMI (calculated) */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">BMI</label>
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                    {bmi ? `${bmi} kg/m²` : 'Enter weight & height'}
                  </div>
                </div>

                {/* Pain Scale */}
                <div className="space-y-1 col-span-2 md:col-span-3">
                  <label className="text-sm font-medium text-gray-700">Pain Scale (0-10)</label>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        onClick={() => setVitals({ ...vitals, painScale: num.toString() })}
                        className={`flex-1 py-2 text-xs font-medium rounded transition-colors ${
                          vitals.painScale === num.toString()
                            ? num <= 3
                              ? 'bg-green-500 text-white'
                              : num <= 6
                              ? 'bg-yellow-500 text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1 col-span-2 md:col-span-3">
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    rows={2}
                    placeholder="Additional observations..."
                    value={vitals.notes}
                    onChange={(e) => setVitals({ ...vitals, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Vitals
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to record vitals</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
