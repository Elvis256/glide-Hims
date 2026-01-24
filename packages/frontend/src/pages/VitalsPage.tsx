import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  Plus,
  Loader2,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Scale,
  Ruler,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

interface Vital {
  id: string;
  encounterId: string;
  temperature?: number;
  temperatureUnit?: 'C' | 'F';
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  weightUnit?: 'kg' | 'lb';
  height?: number;
  heightUnit?: 'cm' | 'in';
  bmi?: number;
  painScore?: number;
  notes?: string;
  recordedById: string;
  createdAt: string;
}

interface VitalHistory {
  date: string;
  temperature?: number;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  oxygenSaturation?: number;
}

const VitalCard = ({ 
  icon: Icon, 
  label, 
  value, 
  unit, 
  normalRange, 
  color 
}: { 
  icon: any; 
  label: string; 
  value?: number | string; 
  unit: string; 
  normalRange?: string;
  color: string;
}) => {
  const isNormal = true; // Would calculate based on normalRange
  return (
    <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${color}`}>
      <div className="flex items-center justify-between">
        <Icon className="h-6 w-6 text-gray-400" />
        {value && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${isNormal ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isNormal ? 'Normal' : 'Abnormal'}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value ?? '--'} <span className="text-sm font-normal text-gray-500">{unit}</span>
      </p>
      <p className="text-sm text-gray-500">{label}</p>
      {normalRange && <p className="text-xs text-gray-400 mt-1">Normal: {normalRange}</p>}
    </div>
  );
};

export default function VitalsPage() {
  const [searchParams] = useSearchParams();
  const encounterId = searchParams.get('encounterId');
  const patientId = searchParams.get('patientId');
  
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // Fetch vitals for encounter
  const { data: vitals, isLoading } = useQuery({
    queryKey: ['vitals', encounterId],
    queryFn: async () => {
      if (!encounterId) return null;
      const response = await api.get(`/vitals/encounter/${encounterId}/latest`);
      return response.data as Vital;
    },
    enabled: !!encounterId,
  });

  // Fetch patient vital history
  const { data: vitalHistory } = useQuery({
    queryKey: ['vital-history', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const response = await api.get(`/vitals/patient/${patientId}/history`);
      return response.data as Vital[];
    },
    enabled: !!patientId,
  });

  // Record vitals mutation
  const vitalsMutation = useMutation({
    mutationFn: (data: Partial<Vital>) => api.post('/vitals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitals'] });
      queryClient.invalidateQueries({ queryKey: ['vital-history'] });
      setShowModal(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    vitalsMutation.mutate({
      encounterId: encounterId || formData.get('encounterId') as string,
      temperature: Number(formData.get('temperature')) || undefined,
      temperatureUnit: 'C',
      bloodPressureSystolic: Number(formData.get('systolic')) || undefined,
      bloodPressureDiastolic: Number(formData.get('diastolic')) || undefined,
      heartRate: Number(formData.get('heartRate')) || undefined,
      respiratoryRate: Number(formData.get('respiratoryRate')) || undefined,
      oxygenSaturation: Number(formData.get('oxygenSaturation')) || undefined,
      weight: Number(formData.get('weight')) || undefined,
      weightUnit: 'kg',
      height: Number(formData.get('height')) || undefined,
      heightUnit: 'cm',
      painScore: Number(formData.get('painScore')) || undefined,
      notes: formData.get('notes') as string,
    });
  };

  if (!encounterId && !patientId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vitals Recording</h1>
          <p className="mt-1 text-sm text-gray-500">Record and monitor patient vital signs</p>
        </div>
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <Activity className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Patient Selected</h3>
          <p className="text-gray-500 mb-4">
            Navigate to this page from an encounter or patient record to view and record vitals.
          </p>
          <p className="text-sm text-gray-400">
            URL parameters: ?encounterId=xxx or ?patientId=xxx
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vital Signs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {encounterId ? `Encounter: ${encounterId.slice(0, 8)}...` : `Patient: ${patientId?.slice(0, 8)}...`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Record Vitals
        </button>
      </div>

      {/* Current Vitals Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <VitalCard
              icon={Thermometer}
              label="Temperature"
              value={vitals?.temperature}
              unit="°C"
              normalRange="36.1-37.2"
              color="border-orange-500"
            />
            <VitalCard
              icon={Heart}
              label="Blood Pressure"
              value={vitals?.bloodPressureSystolic && vitals?.bloodPressureDiastolic 
                ? `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}` 
                : undefined}
              unit="mmHg"
              normalRange="90-120/60-80"
              color="border-red-500"
            />
            <VitalCard
              icon={Activity}
              label="Heart Rate"
              value={vitals?.heartRate}
              unit="bpm"
              normalRange="60-100"
              color="border-pink-500"
            />
            <VitalCard
              icon={Wind}
              label="Respiratory Rate"
              value={vitals?.respiratoryRate}
              unit="/min"
              normalRange="12-20"
              color="border-blue-500"
            />
            <VitalCard
              icon={Droplets}
              label="O2 Saturation"
              value={vitals?.oxygenSaturation}
              unit="%"
              normalRange="95-100"
              color="border-cyan-500"
            />
            <VitalCard
              icon={Scale}
              label="Weight"
              value={vitals?.weight}
              unit="kg"
              color="border-green-500"
            />
            <VitalCard
              icon={Ruler}
              label="Height"
              value={vitals?.height}
              unit="cm"
              color="border-purple-500"
            />
            <VitalCard
              icon={Activity}
              label="BMI"
              value={vitals?.bmi?.toFixed(1)}
              unit="kg/m²"
              normalRange="18.5-24.9"
              color="border-indigo-500"
            />
          </div>

          {/* Pain Score */}
          {vitals?.painScore !== undefined && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Pain Score (0-10)</h3>
              <div className="flex items-center space-x-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <div
                    key={score}
                    className={`w-8 h-8 rounded flex items-center justify-center text-sm font-medium ${
                      vitals.painScore === score
                        ? score <= 3
                          ? 'bg-green-500 text-white'
                          : score <= 6
                          ? 'bg-yellow-500 text-white'
                          : 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {score}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Vital History */}
      {vitalHistory && vitalHistory.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Vital History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Temp</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">BP</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">HR</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">RR</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">SpO2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vitalHistory.slice(0, 10).map((v, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {new Date(v.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {v.temperature ? `${v.temperature}°C` : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {v.bloodPressureSystolic && v.bloodPressureDiastolic 
                        ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` 
                        : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {v.heartRate ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {v.respiratoryRate ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {v.oxygenSaturation ? `${v.oxygenSaturation}%` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Vitals Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Record Vital Signs</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!encounterId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Encounter ID</label>
                    <input
                      type="text"
                      name="encounterId"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Temperature (°C)</label>
                    <input
                      type="number"
                      name="temperature"
                      step="0.1"
                      min="30"
                      max="45"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      name="heartRate"
                      min="30"
                      max="250"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">BP Systolic (mmHg)</label>
                    <input
                      type="number"
                      name="systolic"
                      min="60"
                      max="250"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">BP Diastolic (mmHg)</label>
                    <input
                      type="number"
                      name="diastolic"
                      min="40"
                      max="150"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Respiratory Rate (/min)</label>
                    <input
                      type="number"
                      name="respiratoryRate"
                      min="5"
                      max="60"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">O2 Saturation (%)</label>
                    <input
                      type="number"
                      name="oxygenSaturation"
                      min="50"
                      max="100"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                    <input
                      type="number"
                      name="weight"
                      step="0.1"
                      min="0.5"
                      max="500"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
                    <input
                      type="number"
                      name="height"
                      min="30"
                      max="250"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pain Score (0-10)</label>
                  <input
                    type="range"
                    name="painScore"
                    min="0"
                    max="10"
                    defaultValue="0"
                    className="mt-1 block w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>No Pain (0)</span>
                    <span>Worst Pain (10)</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    name="notes"
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Additional observations..."
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={vitalsMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {vitalsMutation.isPending ? 'Saving...' : 'Save Vitals'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
