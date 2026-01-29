import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Droplets,
  Search,
  UserCircle,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertTriangle,
  Syringe,
  Save,
} from 'lucide-react';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
}

interface BloodSugarReading {
  id: string;
  value: number;
  time: string;
  date: string;
  timing: 'fasting' | 'before-meal' | 'after-meal' | 'bedtime' | 'random';
  insulinGiven?: {
    type: string;
    units: number;
  };
  notes?: string;
}

const patients: Patient[] = [];

const timingOptions = [
  { value: 'fasting', label: 'Fasting', targetMin: 70, targetMax: 100 },
  { value: 'before-meal', label: 'Before Meal', targetMin: 80, targetMax: 130 },
  { value: 'after-meal', label: 'After Meal (2hr)', targetMin: 80, targetMax: 180 },
  { value: 'bedtime', label: 'Bedtime', targetMin: 90, targetMax: 150 },
  { value: 'random', label: 'Random', targetMin: 70, targetMax: 200 },
];

const insulinTypes = [
  'Rapid Acting (Lispro/Aspart)',
  'Short Acting (Regular)',
  'Intermediate (NPH)',
  'Long Acting (Glargine/Detemir)',
  'Mixed (70/30)',
];

export default function BloodSugarPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [readings, setReadings] = useState<BloodSugarReading[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newReading, setNewReading] = useState({
    value: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    timing: 'random' as const,
    giveInsulin: false,
    insulinType: '',
    insulinUnits: '',
    notes: '',
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const getValueStatus = (value: number, timing: string) => {
    const target = timingOptions.find((t) => t.value === timing);
    if (!target) return 'normal';
    if (value < 70) return 'low';
    if (value > target.targetMax) return 'high';
    if (value >= target.targetMin && value <= target.targetMax) return 'normal';
    return 'warning';
  };

  const getValueColor = (value: number, timing: string) => {
    const status = getValueStatus(value, timing);
    switch (status) {
      case 'low':
        return 'text-blue-600 bg-blue-50';
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-green-600 bg-green-50';
    }
  };

  const stats = useMemo(() => {
    if (readings.length === 0) return { avg: 0, min: 0, max: 0, inRange: 0 };
    const values = readings.map((r) => r.value);
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const inRangeCount = readings.filter((r) => {
      const status = getValueStatus(r.value, r.timing);
      return status === 'normal';
    }).length;
    return {
      avg,
      min: Math.min(...values),
      max: Math.max(...values),
      inRange: Math.round((inRangeCount / readings.length) * 100),
    };
  }, [readings]);

  const handleSaveReading = () => {
    if (!newReading.value) return;
    setSaving(true);
    
    setTimeout(() => {
      const reading: BloodSugarReading = {
        id: Date.now().toString(),
        value: parseInt(newReading.value),
        date: newReading.date,
        time: newReading.time,
        timing: newReading.timing,
        notes: newReading.notes || undefined,
      };
      
      if (newReading.giveInsulin && newReading.insulinType && newReading.insulinUnits) {
        reading.insulinGiven = {
          type: newReading.insulinType,
          units: parseInt(newReading.insulinUnits),
        };
      }
      
      setReadings((prev) => [reading, ...prev]);
      setNewReading({
        value: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        timing: 'random',
        giveInsulin: false,
        insulinType: '',
        insulinUnits: '',
        notes: '',
      });
      setSaving(false);
      setShowAddForm(false);
    }, 500);
  };

  const getTrend = () => {
    if (readings.length < 2) return null;
    const recent = readings.slice(0, 3);
    const avg = recent.reduce((a, b) => a + b.value, 0) / recent.length;
    const older = readings.slice(3, 6);
    if (older.length === 0) return null;
    const olderAvg = older.reduce((a, b) => a + b.value, 0) / older.length;
    if (avg > olderAvg + 10) return 'up';
    if (avg < olderAvg - 10) return 'down';
    return 'stable';
  };

  const trend = getTrend();

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
          <Droplets className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Blood Glucose Monitoring</h1>
            <p className="text-sm text-gray-500">Track and monitor blood sugar levels</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
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
            {searchTerm ? (
              filteredPatients.length > 0 ? (
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
              <p className="text-sm text-gray-500 text-center py-4">Search for a patient</p>
            )}
          </div>

          {/* Target Ranges */}
          {selectedPatient && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Target Ranges (mg/dL)</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fasting</span>
                  <span className="text-gray-700">70-100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Before Meal</span>
                  <span className="text-gray-700">80-130</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">After Meal</span>
                  <span className="text-gray-700">&lt;180</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bedtime</span>
                  <span className="text-gray-700">90-150</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Blood Sugar Chart */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          {selectedPatient ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Average</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.avg}</p>
                  <p className="text-xs text-gray-400">mg/dL</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Range</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.min}-{stats.max}</p>
                  <p className="text-xs text-gray-400">mg/dL</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">In Target</p>
                  <p className={`text-2xl font-bold ${stats.inRange >= 70 ? 'text-green-600' : stats.inRange >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {stats.inRange}%
                  </p>
                  <p className="text-xs text-gray-400">of readings</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-sm text-gray-500 mb-1">Trend</p>
                  <div className="flex items-center gap-2">
                    {trend === 'up' && <TrendingUp className="w-6 h-6 text-red-500" />}
                    {trend === 'down' && <TrendingDown className="w-6 h-6 text-blue-500" />}
                    {trend === 'stable' && <Minus className="w-6 h-6 text-green-500" />}
                    <span className="text-lg font-semibold capitalize">{trend || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Add Reading Form */}
              {showAddForm ? (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Add Blood Sugar Reading</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Blood Sugar (mg/dL) *</label>
                      <input
                        type="number"
                        value={newReading.value}
                        onChange={(e) => setNewReading({ ...newReading, value: e.target.value })}
                        placeholder="120"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Timing</label>
                      <select
                        value={newReading.timing}
                        onChange={(e) => setNewReading({ ...newReading, timing: e.target.value as never })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {timingOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Date</label>
                      <input
                        type="date"
                        value={newReading.date}
                        onChange={(e) => setNewReading({ ...newReading, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Time</label>
                      <input
                        type="time"
                        value={newReading.time}
                        onChange={(e) => setNewReading({ ...newReading, time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  {/* Insulin Section */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newReading.giveInsulin}
                        onChange={(e) => setNewReading({ ...newReading, giveInsulin: e.target.checked })}
                        className="rounded text-teal-600"
                      />
                      <Syringe className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium">Insulin Given</span>
                    </label>
                    {newReading.giveInsulin && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Insulin Type</label>
                          <select
                            value={newReading.insulinType}
                            onChange={(e) => setNewReading({ ...newReading, insulinType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            <option value="">Select type...</option>
                            {insulinTypes.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Units</label>
                          <input
                            type="number"
                            value={newReading.insulinUnits}
                            onChange={(e) => setNewReading({ ...newReading, insulinUnits: e.target.value })}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="text-xs text-gray-500 block mb-1">Notes</label>
                    <input
                      type="text"
                      value={newReading.notes}
                      onChange={(e) => setNewReading({ ...newReading, notes: e.target.value })}
                      placeholder="Optional notes..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveReading}
                      disabled={saving || !newReading.value}
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
                          Save Reading
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 w-fit"
                >
                  <Plus className="w-4 h-4" />
                  Add Reading
                </button>
              )}

              {/* Readings List */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 flex flex-col min-h-0">
                <h3 className="font-semibold text-gray-900 mb-3">Blood Sugar Readings</h3>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="space-y-2">
                    {readings.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Droplets className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p>No readings recorded. Add a reading to get started.</p>
                      </div>
                    ) : readings.map((reading) => (
                      <div
                        key={reading.id}
                        className={`p-3 rounded-lg border ${
                          getValueStatus(reading.value, reading.timing) === 'high' || getValueStatus(reading.value, reading.timing) === 'low'
                            ? 'border-red-200'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`text-2xl font-bold px-3 py-1 rounded ${getValueColor(reading.value, reading.timing)}`}>
                              {reading.value}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {timingOptions.find((t) => t.value === reading.timing)?.label}
                                </span>
                                {(getValueStatus(reading.value, reading.timing) === 'high' || getValueStatus(reading.value, reading.timing) === 'low') && (
                                  <AlertTriangle className="w-4 h-4 text-red-500" />
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {reading.date} at {reading.time}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {reading.insulinGiven && (
                              <div className="flex items-center gap-1 text-sm text-purple-600">
                                <Syringe className="w-4 h-4" />
                                {reading.insulinGiven.units}u {reading.insulinGiven.type.split('(')[0]}
                              </div>
                            )}
                            {reading.notes && (
                              <p className="text-xs text-gray-500">{reading.notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Droplets className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to track blood glucose</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}