import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scan,
  Search,
  User,
  AlertTriangle,
  CheckCircle,
  Circle,
  Send,
  Info,
  XCircle,
  Bone,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../../services/patients';

const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

interface Patient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
}

interface BodyRegion {
  id: string;
  name: string;
  modalities: string[];
}

const modalities = [
  { id: 'xray', name: 'X-Ray', icon: '🦴', color: 'blue' },
  { id: 'ct', name: 'CT Scan', icon: '🔄', color: 'purple' },
  { id: 'mri', name: 'MRI', icon: '🧲', color: 'indigo' },
  { id: 'ultrasound', name: 'Ultrasound', icon: '📡', color: 'teal' },
  { id: 'fluoroscopy', name: 'Fluoroscopy', icon: '📺', color: 'orange' },
];

const bodyRegions: BodyRegion[] = [
  { id: 'head', name: 'Head/Brain', modalities: ['ct', 'mri'] },
  { id: 'neck', name: 'Neck/Cervical Spine', modalities: ['xray', 'ct', 'mri', 'ultrasound'] },
  { id: 'chest', name: 'Chest', modalities: ['xray', 'ct'] },
  { id: 'abdomen', name: 'Abdomen', modalities: ['xray', 'ct', 'mri', 'ultrasound'] },
  { id: 'pelvis', name: 'Pelvis', modalities: ['xray', 'ct', 'mri', 'ultrasound'] },
  { id: 'spine', name: 'Spine (Thoracic/Lumbar)', modalities: ['xray', 'ct', 'mri'] },
  { id: 'shoulder', name: 'Shoulder', modalities: ['xray', 'mri', 'ultrasound'] },
  { id: 'elbow', name: 'Elbow', modalities: ['xray', 'mri'] },
  { id: 'wrist', name: 'Wrist/Hand', modalities: ['xray', 'mri'] },
  { id: 'hip', name: 'Hip', modalities: ['xray', 'ct', 'mri'] },
  { id: 'knee', name: 'Knee', modalities: ['xray', 'mri'] },
  { id: 'ankle', name: 'Ankle/Foot', modalities: ['xray', 'mri'] },
];

const xrayViews = ['AP (Anterior-Posterior)', 'Lateral', 'Oblique', 'PA (Posterior-Anterior)', 'Decubitus'];
const contrastOptions = ['No Contrast', 'With Contrast', 'With & Without Contrast'];
const priorities = ['Routine', 'Urgent', 'STAT'];

export default function RadiologyOrdersPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedModality, setSelectedModality] = useState('xray');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedViews, setSelectedViews] = useState<string[]>([]);
  const [contrast, setContrast] = useState('No Contrast');
  const [priority, setPriority] = useState('Routine');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [indication, setIndication] = useState('');
  const [pregnancyStatus, setPregnancyStatus] = useState<'unknown' | 'no' | 'yes' | 'possible'>('unknown');

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length > 1,
  });
  const patients = patientsData?.data || [];

  const patientList: Patient[] = patients.map((p) => ({
    id: p.id,
    name: p.fullName,
    mrn: p.mrn,
    age: calculateAge(p.dateOfBirth),
    gender: p.gender.charAt(0).toUpperCase() + p.gender.slice(1),
  }));

  const availableRegions = useMemo(() => {
    return bodyRegions.filter((region) => region.modalities.includes(selectedModality));
  }, [selectedModality]);

  const showViewsSelector = selectedModality === 'xray';
  const showContrastSelector = ['ct', 'mri'].includes(selectedModality);
  const isFemalePatient = selectedPatient?.gender === 'Female';
  const showPregnancyWarning = isFemalePatient && ['xray', 'ct', 'fluoroscopy'].includes(selectedModality);

  const toggleView = (view: string) => {
    setSelectedViews((prev) =>
      prev.includes(view) ? prev.filter((v) => v !== view) : [...prev, view]
    );
  };

  const handleSubmit = () => {
    if (!selectedPatient) {
      alert('Please select a patient');
      return;
    }
    if (!selectedRegion) {
      alert('Please select a body region');
      return;
    }
    if (showPregnancyWarning && pregnancyStatus === 'unknown') {
      alert('Please confirm pregnancy status for female patient');
      return;
    }
    if (showPregnancyWarning && pregnancyStatus === 'yes') {
      alert('Cannot proceed with ionizing radiation for pregnant patient');
      return;
    }
    const modName = modalities.find((m) => m.id === selectedModality)?.name;
    const regionName = bodyRegions.find((r) => r.id === selectedRegion)?.name;
    alert(`Radiology order submitted!\nPatient: ${selectedPatient.name}\nStudy: ${modName} - ${regionName}\nPriority: ${priority}`);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Scan className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Radiology Orders</h1>
              <p className="text-sm text-gray-500">Order imaging studies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Selection */}
        <div className="flex-1 flex flex-col overflow-hidden border-r bg-white">
          {/* Patient Selector */}
          <div className="p-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or MRN..."
                value={selectedPatient ? selectedPatient.name : patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setSelectedPatient(null);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {showPatientDropdown && !selectedPatient && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {patientsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    </div>
                  ) : patientList.length === 0 && patientSearch.length > 1 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">No patients found</div>
                  ) : (
                    patientList.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatient(patient);
                        setShowPatientDropdown(false);
                        setPatientSearch('');
                        setPregnancyStatus('unknown');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="font-medium">{patient.name}</span>
                      <span className="text-sm text-gray-500">{patient.mrn}</span>
                    </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedPatient && (
              <div className="mt-2 text-sm text-gray-600">
                {selectedPatient.age}y {selectedPatient.gender} • {selectedPatient.mrn}
              </div>
            )}
          </div>

          {/* Modality Selection */}
          <div className="p-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Modality</label>
            <div className="grid grid-cols-5 gap-2">
              {modalities.map((mod) => (
                <button
                  key={mod.id}
                  onClick={() => {
                    setSelectedModality(mod.id);
                    setSelectedRegion(null);
                    setSelectedViews([]);
                  }}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    selectedModality === mod.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{mod.icon}</div>
                  <div className="text-xs font-medium">{mod.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Body Region Selection */}
          <div className="flex-1 overflow-auto p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">Select Body Region</label>
            <div className="grid grid-cols-2 gap-2">
              {availableRegions.map((region) => (
                <button
                  key={region.id}
                  onClick={() => setSelectedRegion(region.id)}
                  className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                    selectedRegion === region.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {selectedRegion === region.id ? (
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  )}
                  <div className="flex items-center gap-2">
                    <Bone className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{region.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Order Details */}
        <div className="w-96 flex flex-col overflow-hidden bg-gray-50">
          {/* Views for X-Ray */}
          {showViewsSelector && (
            <div className="p-4 border-b bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Views</label>
              <div className="space-y-2">
                {xrayViews.map((view) => (
                  <button
                    key={view}
                    onClick={() => toggleView(view)}
                    className={`w-full p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                      selectedViews.includes(view)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {selectedViews.includes(view) ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300" />
                    )}
                    {view}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Contrast Options */}
          {showContrastSelector && (
            <div className="p-4 border-b bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Contrast</label>
              <div className="space-y-2">
                {contrastOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => setContrast(option)}
                    className={`w-full p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                      contrast === option
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {contrast === option ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300" />
                    )}
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="p-4 border-b bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    priority === p
                      ? p === 'STAT'
                        ? 'bg-red-600 text-white'
                        : p === 'Urgent'
                        ? 'bg-amber-500 text-white'
                        : 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Clinical History */}
          <div className="p-4 border-b bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">Clinical History</label>
            <textarea
              value={clinicalHistory}
              onChange={(e) => setClinicalHistory(e.target.value)}
              placeholder="Relevant medical history..."
              rows={2}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Indication */}
          <div className="p-4 border-b bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">Clinical Indication</label>
            <textarea
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              placeholder="Reason for study..."
              rows={2}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Pregnancy Warning */}
          {showPregnancyWarning && (
            <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Pregnancy Status Required</p>
                  <p className="text-xs text-red-700 mt-1">
                    Ionizing radiation study ordered for female patient.
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPregnancyStatus('no')}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        pregnancyStatus === 'no'
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Not Pregnant
                    </button>
                    <button
                      onClick={() => setPregnancyStatus('yes')}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        pregnancyStatus === 'yes'
                          ? 'bg-red-100 border-red-500 text-red-700'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Pregnant
                    </button>
                    <button
                      onClick={() => setPregnancyStatus('possible')}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors col-span-2 ${
                        pregnancyStatus === 'possible'
                          ? 'bg-amber-100 border-amber-500 text-amber-700'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Possibly Pregnant (LMP within 14 days)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pregnancyStatus === 'yes' && (
            <div className="mx-4 mt-2 p-3 bg-red-100 border border-red-300 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Cannot proceed - Patient is pregnant</span>
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Order Summary */}
          <div className="p-4 border-t bg-white">
            {selectedRegion && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">
                  {modalities.find((m) => m.id === selectedModality)?.name} -{' '}
                  {bodyRegions.find((r) => r.id === selectedRegion)?.name}
                </p>
                {showViewsSelector && selectedViews.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Views: {selectedViews.join(', ')}</p>
                )}
                {showContrastSelector && <p className="text-xs text-gray-500 mt-1">{contrast}</p>}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!selectedPatient || !selectedRegion || (showPregnancyWarning && pregnancyStatus === 'yes')}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit Order
            </button>
            <p className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
              <Info className="w-3 h-3" />
              Order will be sent to radiology department
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
