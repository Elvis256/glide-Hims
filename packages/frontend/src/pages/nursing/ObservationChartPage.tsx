import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Clock,
  Brain,
  Activity,
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

interface ObservationEntry {
  id: string;
  time: string;
  consciousness: string;
  gcsEye: number;
  gcsVerbal: number;
  gcsMotor: number;
  pupilLeft: { size: number; reactive: boolean };
  pupilRight: { size: number; reactive: boolean };
  limbMovement: {
    leftArm: string;
    rightArm: string;
    leftLeg: string;
    rightLeg: string;
  };
  notes?: string;
}

const mockPatients: Patient[] = [
  { id: '1', mrn: 'MRN-2024-0001', name: 'Sarah Nakimera', age: 39, gender: 'Female', ward: 'Ward A', bed: 'A-12' },
  { id: '2', mrn: 'MRN-2024-0002', name: 'James Okello', age: 34, gender: 'Male', ward: 'Ward B', bed: 'B-05' },
  { id: '3', mrn: 'MRN-2024-0003', name: 'Grace Namukasa', age: 28, gender: 'Female' },
  { id: '4', mrn: 'MRN-2024-0004', name: 'Peter Ochieng', age: 45, gender: 'Male', ward: 'ICU', bed: 'ICU-2' },
  { id: '5', mrn: 'MRN-2024-0005', name: 'Mary Achieng', age: 52, gender: 'Female', ward: 'Ward C', bed: 'C-08' },
];

const mockObservations: ObservationEntry[] = [
  {
    id: '1',
    time: '06:00',
    consciousness: 'A',
    gcsEye: 4,
    gcsVerbal: 5,
    gcsMotor: 6,
    pupilLeft: { size: 3, reactive: true },
    pupilRight: { size: 3, reactive: true },
    limbMovement: { leftArm: 'Normal', rightArm: 'Normal', leftLeg: 'Normal', rightLeg: 'Normal' },
  },
  {
    id: '2',
    time: '08:00',
    consciousness: 'A',
    gcsEye: 4,
    gcsVerbal: 5,
    gcsMotor: 6,
    pupilLeft: { size: 3, reactive: true },
    pupilRight: { size: 3, reactive: true },
    limbMovement: { leftArm: 'Normal', rightArm: 'Normal', leftLeg: 'Normal', rightLeg: 'Normal' },
  },
  {
    id: '3',
    time: '10:00',
    consciousness: 'V',
    gcsEye: 3,
    gcsVerbal: 4,
    gcsMotor: 6,
    pupilLeft: { size: 4, reactive: true },
    pupilRight: { size: 3, reactive: true },
    limbMovement: { leftArm: 'Weak', rightArm: 'Normal', leftLeg: 'Weak', rightLeg: 'Normal' },
    notes: 'Patient drowsy, requires verbal stimulation',
  },
  {
    id: '4',
    time: '12:00',
    consciousness: 'A',
    gcsEye: 4,
    gcsVerbal: 5,
    gcsMotor: 6,
    pupilLeft: { size: 3, reactive: true },
    pupilRight: { size: 3, reactive: true },
    limbMovement: { leftArm: 'Normal', rightArm: 'Normal', leftLeg: 'Normal', rightLeg: 'Normal' },
    notes: 'Improved after medication',
  },
];

const avpuOptions = [
  { value: 'A', label: 'Alert', color: 'bg-green-500' },
  { value: 'V', label: 'Voice', color: 'bg-yellow-500' },
  { value: 'P', label: 'Pain', color: 'bg-orange-500' },
  { value: 'U', label: 'Unresponsive', color: 'bg-red-500' },
];

const gcsEyeOptions = [
  { value: 4, label: '4 - Spontaneous' },
  { value: 3, label: '3 - To voice' },
  { value: 2, label: '2 - To pain' },
  { value: 1, label: '1 - None' },
];

const gcsVerbalOptions = [
  { value: 5, label: '5 - Oriented' },
  { value: 4, label: '4 - Confused' },
  { value: 3, label: '3 - Inappropriate words' },
  { value: 2, label: '2 - Incomprehensible sounds' },
  { value: 1, label: '1 - None' },
];

const gcsMotorOptions = [
  { value: 6, label: '6 - Obeys commands' },
  { value: 5, label: '5 - Localizes pain' },
  { value: 4, label: '4 - Withdraws from pain' },
  { value: 3, label: '3 - Flexion to pain' },
  { value: 2, label: '2 - Extension to pain' },
  { value: 1, label: '1 - None' },
];

const pupilSizes = [1, 2, 3, 4, 5, 6, 7, 8];

const limbMovementOptions = [
  { value: 'Normal', label: 'Normal', color: 'text-green-600' },
  { value: 'Weak', label: 'Weak', color: 'text-yellow-600' },
  { value: 'Very Weak', label: 'Very Weak', color: 'text-orange-600' },
  { value: 'No Movement', label: 'No Movement', color: 'text-red-600' },
];

export default function ObservationChartPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [observations, setObservations] = useState<ObservationEntry[]>(mockObservations);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newObs, setNewObs] = useState({
    time: new Date().toTimeString().slice(0, 5),
    consciousness: 'A',
    gcsEye: 4,
    gcsVerbal: 5,
    gcsMotor: 6,
    pupilLeftSize: 3,
    pupilLeftReactive: true,
    pupilRightSize: 3,
    pupilRightReactive: true,
    leftArm: 'Normal',
    rightArm: 'Normal',
    leftLeg: 'Normal',
    rightLeg: 'Normal',
    notes: '',
  });

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return mockPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const gcsTotal = newObs.gcsEye + newObs.gcsVerbal + newObs.gcsMotor;

  const getGcsStatus = (score: number) => {
    if (score >= 13) return { label: 'Mild', color: 'text-green-600 bg-green-50' };
    if (score >= 9) return { label: 'Moderate', color: 'text-yellow-600 bg-yellow-50' };
    return { label: 'Severe', color: 'text-red-600 bg-red-50' };
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      const entry: ObservationEntry = {
        id: Date.now().toString(),
        time: newObs.time,
        consciousness: newObs.consciousness,
        gcsEye: newObs.gcsEye,
        gcsVerbal: newObs.gcsVerbal,
        gcsMotor: newObs.gcsMotor,
        pupilLeft: { size: newObs.pupilLeftSize, reactive: newObs.pupilLeftReactive },
        pupilRight: { size: newObs.pupilRightSize, reactive: newObs.pupilRightReactive },
        limbMovement: {
          leftArm: newObs.leftArm,
          rightArm: newObs.rightArm,
          leftLeg: newObs.leftLeg,
          rightLeg: newObs.rightLeg,
        },
        notes: newObs.notes || undefined,
      };
      setObservations((prev) => [entry, ...prev]);
      setSaving(false);
      setSaved(true);
    }, 500);
  };

  const handleReset = () => {
    setNewObs({
      time: new Date().toTimeString().slice(0, 5),
      consciousness: 'A',
      gcsEye: 4,
      gcsVerbal: 5,
      gcsMotor: 6,
      pupilLeftSize: 3,
      pupilLeftReactive: true,
      pupilRightSize: 3,
      pupilRightReactive: true,
      leftArm: 'Normal',
      rightArm: 'Normal',
      leftLeg: 'Normal',
      rightLeg: 'Normal',
      notes: '',
    });
    setSaved(false);
    setShowAddForm(false);
  };

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
          <Brain className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Observation Chart</h1>
            <p className="text-sm text-gray-500">Neurological observations & monitoring</p>
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

          {/* Quick Reference */}
          {selectedPatient && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-700 mb-2">AVPU Scale</h3>
              <div className="space-y-1">
                {avpuOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2 text-xs">
                    <div className={`w-3 h-3 rounded-full ${opt.color}`} />
                    <span className="font-medium">{opt.value}</span>
                    <span className="text-gray-500">- {opt.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Observation Chart */}
        <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
          {selectedPatient ? (
            <>
              {/* Add Observation Form */}
              {showAddForm ? (
                saved ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-2">Observation Recorded</h2>
                      <p className="text-gray-600 mb-4">Neurological observation has been saved</p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={handleReset}
                          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                        >
                          Add Another
                        </button>
                        <button
                          onClick={() => { handleReset(); setShowAddForm(false); }}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          View Chart
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Record Observation</h3>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <input
                          type="time"
                          value={newObs.time}
                          onChange={(e) => setNewObs({ ...newObs, time: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* AVPU */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Consciousness (AVPU)</label>
                        <div className="flex gap-1">
                          {avpuOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setNewObs({ ...newObs, consciousness: opt.value })}
                              className={`flex-1 py-2 rounded text-sm font-medium transition-colors ${
                                newObs.consciousness === opt.value
                                  ? `${opt.color} text-white`
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {opt.value}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* GCS */}
                      <div className="lg:col-span-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">Glasgow Coma Scale</label>
                          <span className={`px-2 py-1 rounded text-sm font-medium ${getGcsStatus(gcsTotal).color}`}>
                            GCS: {gcsTotal}/15 - {getGcsStatus(gcsTotal).label}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Eye (E)</label>
                            <select
                              value={newObs.gcsEye}
                              onChange={(e) => setNewObs({ ...newObs, gcsEye: parseInt(e.target.value) })}
                              className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                            >
                              {gcsEyeOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Verbal (V)</label>
                            <select
                              value={newObs.gcsVerbal}
                              onChange={(e) => setNewObs({ ...newObs, gcsVerbal: parseInt(e.target.value) })}
                              className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                            >
                              {gcsVerbalOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 block mb-1">Motor (M)</label>
                            <select
                              value={newObs.gcsMotor}
                              onChange={(e) => setNewObs({ ...newObs, gcsMotor: parseInt(e.target.value) })}
                              className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                            >
                              {gcsMotorOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Pupils */}
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Pupil Reactions</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Eye className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium">Left Pupil</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Size (mm)</label>
                                <select
                                  value={newObs.pupilLeftSize}
                                  onChange={(e) => setNewObs({ ...newObs, pupilLeftSize: parseInt(e.target.value) })}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                  {pupilSizes.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                  ))}
                                </select>
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newObs.pupilLeftReactive}
                                  onChange={(e) => setNewObs({ ...newObs, pupilLeftReactive: e.target.checked })}
                                  className="rounded text-teal-600"
                                />
                                <span className="text-sm">Reactive</span>
                              </label>
                            </div>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Eye className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium">Right Pupil</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Size (mm)</label>
                                <select
                                  value={newObs.pupilRightSize}
                                  onChange={(e) => setNewObs({ ...newObs, pupilRightSize: parseInt(e.target.value) })}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                  {pupilSizes.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                  ))}
                                </select>
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newObs.pupilRightReactive}
                                  onChange={(e) => setNewObs({ ...newObs, pupilRightReactive: e.target.checked })}
                                  className="rounded text-teal-600"
                                />
                                <span className="text-sm">Reactive</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Limb Movement */}
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Limb Movement</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { key: 'leftArm', label: 'Left Arm' },
                            { key: 'rightArm', label: 'Right Arm' },
                            { key: 'leftLeg', label: 'Left Leg' },
                            { key: 'rightLeg', label: 'Right Leg' },
                          ].map((limb) => (
                            <div key={limb.key}>
                              <label className="text-xs text-gray-500 block mb-1">{limb.label}</label>
                              <select
                                value={newObs[limb.key as keyof typeof newObs] as string}
                                onChange={(e) => setNewObs({ ...newObs, [limb.key]: e.target.value })}
                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm"
                              >
                                {limbMovementOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                        <textarea
                          value={newObs.notes}
                          onChange={(e) => setNewObs({ ...newObs, notes: e.target.value })}
                          rows={2}
                          placeholder="Additional observations..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                      >
                        Cancel
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
                            Save Observation
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 w-fit"
                >
                  <Activity className="w-4 h-4" />
                  Record Observation
                </button>
              )}

              {/* Observation History */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1 flex flex-col min-h-0">
                <h3 className="font-semibold text-gray-900 mb-3">Observation History</h3>
                <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
                  <table className="w-full min-w-[800px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="pb-2 pr-4 font-medium">Time</th>
                        <th className="pb-2 pr-4 font-medium">AVPU</th>
                        <th className="pb-2 pr-4 font-medium">GCS (E+V+M)</th>
                        <th className="pb-2 pr-4 font-medium">Pupils (L/R)</th>
                        <th className="pb-2 pr-4 font-medium">Limbs</th>
                        <th className="pb-2 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {observations.map((obs) => {
                        const gcs = obs.gcsEye + obs.gcsVerbal + obs.gcsMotor;
                        const avpu = avpuOptions.find((a) => a.value === obs.consciousness);
                        return (
                          <tr key={obs.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="w-3 h-3 text-gray-400" />
                                {obs.time}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-medium ${avpu?.color}`}>
                                {obs.consciousness}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-1 rounded text-sm ${getGcsStatus(gcs).color}`}>
                                {gcs} ({obs.gcsEye}+{obs.gcsVerbal}+{obs.gcsMotor})
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  <span>{obs.pupilLeft.size}mm</span>
                                  <span className={obs.pupilLeft.reactive ? 'text-green-600' : 'text-red-600'}>
                                    {obs.pupilLeft.reactive ? '✓' : '✗'}
                                  </span>
                                </div>
                                <span>/</span>
                                <div className="flex items-center gap-1">
                                  <span>{obs.pupilRight.size}mm</span>
                                  <span className={obs.pupilRight.reactive ? 'text-green-600' : 'text-red-600'}>
                                    {obs.pupilRight.reactive ? '✓' : '✗'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-xs">
                              <div className="grid grid-cols-2 gap-1">
                                <span className={limbMovementOptions.find((l) => l.value === obs.limbMovement.leftArm)?.color}>
                                  LA: {obs.limbMovement.leftArm}
                                </span>
                                <span className={limbMovementOptions.find((l) => l.value === obs.limbMovement.rightArm)?.color}>
                                  RA: {obs.limbMovement.rightArm}
                                </span>
                                <span className={limbMovementOptions.find((l) => l.value === obs.limbMovement.leftLeg)?.color}>
                                  LL: {obs.limbMovement.leftLeg}
                                </span>
                                <span className={limbMovementOptions.find((l) => l.value === obs.limbMovement.rightLeg)?.color}>
                                  RL: {obs.limbMovement.rightLeg}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 text-sm text-gray-500">{obs.notes || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Brain className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view observation chart</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
