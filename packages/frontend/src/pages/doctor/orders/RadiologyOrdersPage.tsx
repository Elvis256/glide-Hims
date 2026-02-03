import { usePermissions } from '../../../components/PermissionGate';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import { toast } from 'sonner';
import { patientsService } from '../../../services/patients';
import { encountersService } from '../../../services/encounters';
import { ordersService, type CreateOrderDto, type OrderPriority } from '../../../services/orders';

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

// Common imaging protocols for quick ordering
const commonProtocols = [
  { id: 'cxr', name: 'Chest X-Ray', modality: 'xray', region: 'chest', views: ['PA (Posterior-Anterior)', 'Lateral'], icon: '🫁' },
  { id: 'kub', name: 'KUB (Abdomen)', modality: 'xray', region: 'abdomen', views: ['AP (Anterior-Posterior)'], icon: '🩻' },
  { id: 'cthead', name: 'CT Head (Non-contrast)', modality: 'ct', region: 'head', contrast: 'No Contrast', icon: '🧠' },
  { id: 'ctabdpelvis', name: 'CT Abd/Pelvis', modality: 'ct', region: 'abdomen', contrast: 'With Contrast', icon: '🔬' },
  { id: 'mribrain', name: 'MRI Brain', modality: 'mri', region: 'head', contrast: 'With & Without Contrast', icon: '🧲' },
  { id: 'usabdomen', name: 'US Abdomen', modality: 'ultrasound', region: 'abdomen', icon: '📡' },
];

const mapPriorityToApi = (priority: string): OrderPriority => {
  switch (priority.toLowerCase()) {
    case 'stat': return 'stat';
    case 'urgent': return 'urgent';
    default: return 'routine';
  }
};

export default function RadiologyOrdersPage() {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  if (!hasPermission('orders.create')) {
    return <div className="p-8 text-center text-red-600">You do not have permission to create radiology orders.</div>;
  }
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<string | null>(null);

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length > 1,
  });
  const patients = patientsData?.data || [];

  // Fetch active encounter for selected patient
  const { data: patientEncounters } = useQuery({
    queryKey: ['encounters', 'patient', selectedPatient?.id],
    queryFn: () => encountersService.list({ patientId: selectedPatient!.id, status: 'in_consultation', limit: 1 }),
    enabled: !!selectedPatient?.id,
  });

  // Set encounter ID when patient encounters load
  useMemo(() => {
    if (patientEncounters?.data && patientEncounters.data.length > 0) {
      setSelectedEncounterId(patientEncounters.data[0].id);
    } else {
      setSelectedEncounterId(null);
    }
  }, [patientEncounters]);

  // Create radiology order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: CreateOrderDto) => {
      return ordersService.create(data);
    },
    onSuccess: (order) => {
      setCreatedOrderNumber(order.orderNumber);
      setShowSuccess(true);
    },
    onError: (error) => {
      toast.error(`Failed to create radiology order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    },
  });

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
      toast.error('Please select a patient');
      return;
    }
    if (!selectedEncounterId) {
      toast.error('Patient does not have an active encounter. Please start a consultation first.');
      return;
    }
    if (!selectedRegion) {
      toast.error('Please select a body region');
      return;
    }
    if (showPregnancyWarning && pregnancyStatus === 'unknown') {
      toast.error('Please confirm pregnancy status for female patient');
      return;
    }
    if (showPregnancyWarning && pregnancyStatus === 'yes') {
      toast.error('Cannot proceed with ionizing radiation for pregnant patient');
      return;
    }
    
    const modName = modalities.find((m) => m.id === selectedModality)?.name || selectedModality;
    const regionName = bodyRegions.find((r) => r.id === selectedRegion)?.name || selectedRegion;
    const studyName = `${modName} - ${regionName}`;
    
    const instructions: string[] = [];
    if (selectedViews.length > 0) instructions.push(`Views: ${selectedViews.join(', ')}`);
    if (contrast !== 'No Contrast') instructions.push(`Contrast: ${contrast}`);
    if (pregnancyStatus !== 'unknown') instructions.push(`Pregnancy status: ${pregnancyStatus}`);

    const orderData: CreateOrderDto = {
      encounterId: selectedEncounterId,
      orderType: 'radiology',
      priority: mapPriorityToApi(priority),
      instructions: instructions.length > 0 ? instructions.join('; ') : undefined,
      clinicalNotes: [clinicalHistory, indication].filter(Boolean).join('\n\n') || undefined,
      testCodes: [{
        code: `${selectedModality.toUpperCase()}-${selectedRegion.toUpperCase()}`,
        name: studyName,
      }],
    };

    createOrderMutation.mutate(orderData);
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setSelectedEncounterId(null);
    setSelectedRegion(null);
    setSelectedViews([]);
    setContrast('No Contrast');
    setPriority('Routine');
    setClinicalHistory('');
    setIndication('');
    setPregnancyStatus('unknown');
    setShowSuccess(false);
    setCreatedOrderNumber(null);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Success State */}
      {showSuccess && createdOrderNumber && (
        <div className="absolute inset-0 bg-white z-50 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Radiology Order Submitted!</h2>
            <p className="text-gray-500 mb-4">
              Order has been sent to the radiology department.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">Order Number</p>
              <p className="text-2xl font-mono font-bold text-blue-700">{createdOrderNumber}</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Order More Studies
              </button>
              <button
                onClick={() => navigate('/radiology/queue')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Radiology Queue
              </button>
            </div>
          </div>
        </div>
      )}

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
              disabled={!selectedPatient || !selectedEncounterId || !selectedRegion || (showPregnancyWarning && pregnancyStatus === 'yes') || createOrderMutation.isPending}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {createOrderMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {createOrderMutation.isPending ? 'Submitting...' : 'Submit Order'}
            </button>
            {selectedPatient && !selectedEncounterId && (
              <p className="text-xs text-amber-600 text-center mt-2">
                ⚠️ Patient has no active encounter
              </p>
            )}
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
