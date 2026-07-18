import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  AlertTriangle,
  User,
  Clock,
  Stethoscope,
  CheckCircle,
  ChevronRight,
  Save,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { emergencyService, TriageLevel } from '../../services';
import { doctorDutyService } from '../../services/doctor-duty';
import { getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';

// Map Manchester Triage priorities to backend triage levels
const priorityToLevel: Record<string, TriageLevel> = {
  'immediate': TriageLevel.RESUSCITATION,
  'very-urgent': TriageLevel.EMERGENT,
  'urgent': TriageLevel.URGENT,
  'standard': TriageLevel.LESS_URGENT,
  'non-urgent': TriageLevel.NON_URGENT,
};

type TriagePriority = 'immediate' | 'very-urgent' | 'urgent' | 'standard' | 'non-urgent';

interface VitalsData {
  temperature: string;
  heartRate: string;
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  bloodGlucose: string;
  painLevel: string;
  consciousnessLevel: string;
}

// Tailwind can only generate classes it can see verbatim — template-built
// names like `bg-${color}-100` silently produce no styling.
const avpuClasses: Record<string, string> = {
  alert: 'bg-green-100 border-green-500 text-green-700 ring-2 ring-green-200',
  'voice-responsive': 'bg-yellow-100 border-yellow-500 text-yellow-700 ring-2 ring-yellow-200',
  'pain-responsive': 'bg-orange-100 border-orange-500 text-orange-700 ring-2 ring-orange-200',
  unresponsive: 'bg-red-100 border-red-500 text-red-700 ring-2 ring-red-200',
};

const priorityConfig: Record<TriagePriority, { label: string; color: string; bgColor: string; maxWait: string }> = {
  'immediate': { label: 'Immediate', color: 'text-red-700', bgColor: 'bg-red-500', maxWait: '0 min' },
  'very-urgent': { label: 'Very Urgent', color: 'text-orange-700', bgColor: 'bg-orange-500', maxWait: '10 min' },
  'urgent': { label: 'Urgent', color: 'text-yellow-700', bgColor: 'bg-yellow-500', maxWait: '60 min' },
  'standard': { label: 'Standard', color: 'text-green-700', bgColor: 'bg-green-500', maxWait: '120 min' },
  'non-urgent': { label: 'Non-Urgent', color: 'text-blue-700', bgColor: 'bg-blue-500', maxWait: '240 min' },
};

const chiefComplaints = [
  { id: 'chest-pain', label: 'Chest Pain', priority: 'immediate' as TriagePriority },
  { id: 'difficulty-breathing', label: 'Difficulty Breathing', priority: 'immediate' as TriagePriority },
  { id: 'stroke-symptoms', label: 'Stroke Symptoms', priority: 'immediate' as TriagePriority },
  { id: 'severe-bleeding', label: 'Severe Bleeding', priority: 'immediate' as TriagePriority },
  { id: 'severe-abdominal-pain', label: 'Severe Abdominal Pain', priority: 'very-urgent' as TriagePriority },
  { id: 'high-fever', label: 'High Fever (>39°C)', priority: 'very-urgent' as TriagePriority },
  { id: 'fracture', label: 'Suspected Fracture', priority: 'urgent' as TriagePriority },
  { id: 'moderate-pain', label: 'Moderate Pain', priority: 'urgent' as TriagePriority },
  { id: 'laceration', label: 'Laceration', priority: 'standard' as TriagePriority },
  { id: 'minor-burns', label: 'Minor Burns', priority: 'standard' as TriagePriority },
  { id: 'sprain', label: 'Sprain / Strain', priority: 'non-urgent' as TriagePriority },
  { id: 'cold-flu', label: 'Cold / Flu Symptoms', priority: 'non-urgent' as TriagePriority },
  { id: 'other', label: 'Other', priority: 'standard' as TriagePriority },
];

const bays = ['Resus 1', 'Resus 2', 'Bay 1', 'Bay 2', 'Bay 3', 'Bay 4', 'Bay 5', 'Minor Injuries'];

export default function EmergencyTriagePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchParams] = useSearchParams();
  const caseId = searchParams.get('caseId');
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(caseId);

  // Fetch pending cases for triage queue
  const { data: pendingCases, isLoading: loadingCases } = useQuery({
    queryKey: ['emergency-triage-queue', facilityId],
    queryFn: async () => {
      const response = await emergencyService.getTriageQueue(facilityId);
      return response.data;
    },
    enabled: !caseId, // Only fetch if no case ID provided
  });

  // Fetch case details if case ID provided
  const { data: selectedCaseData } = useQuery({
    queryKey: ['emergency-case', selectedCaseId],
    queryFn: async () => {
      if (!selectedCaseId) return null;
      const response = await emergencyService.getCase(selectedCaseId);
      return response.data;
    },
    enabled: !!selectedCaseId,
  });
  // Fetch on-duty doctors for assignment
  const { data: onDutyDoctors = [] } = useQuery({
    queryKey: ['doctors-on-duty-triage'],
    queryFn: () => doctorDutyService.getDoctorsWithStatus(),
    select: (data) => data.filter((d) => d.status !== 'off_duty'),
  });

  const [selectedComplaint, setSelectedComplaint] = useState<string>('');
  const [complaintNotes, setComplaintNotes] = useState('');
  const [vitals, setVitals] = useState<VitalsData>({
    temperature: '',
    heartRate: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    bloodGlucose: '',
    painLevel: '5',
    consciousnessLevel: 'alert',
  });
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedBay, setSelectedBay] = useState('');
  // Nurse can override the computed priority from the right-hand scale.
  const [priorityOverride, setPriorityOverride] = useState<TriagePriority | null>(null);

  const casePatient = selectedCaseData?.encounter?.patient;
  const patientAge = casePatient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(casePatient.dateOfBirth).getTime()) / 31557600000)
    : null;

  const suggestedPriority = useMemo((): TriagePriority => {
    const complaint = chiefComplaints.find(c => c.id === selectedComplaint);
    if (!complaint) return 'standard';

    let priority = complaint.priority;

    // Adjust based on vitals
    const hr = parseInt(vitals.heartRate);
    const rr = parseInt(vitals.respiratoryRate);
    const spo2 = parseInt(vitals.oxygenSaturation);
    const temp = parseFloat(vitals.temperature);
    const sys = parseInt(vitals.bloodPressureSystolic);

    if (spo2 < 92 || hr > 130 || hr < 40 || sys < 90 || rr > 30) {
      priority = 'immediate';
    } else if (spo2 < 95 || hr > 110 || temp > 39 || sys > 180) {
      if (priority !== 'immediate') priority = 'very-urgent';
    }

    if (vitals.consciousnessLevel === 'unresponsive') {
      priority = 'immediate';
    } else if (vitals.consciousnessLevel === 'pain-responsive') {
      priority = 'immediate';
    } else if (vitals.consciousnessLevel === 'voice-responsive') {
      if (priority !== 'immediate') priority = 'very-urgent';
    }

    return priority;
  }, [selectedComplaint, vitals]);

  const effectivePriority = priorityOverride ?? suggestedPriority;

  // Triage mutation
  const triageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCaseId) throw new Error('No case selected');
      
      // Map consciousness level to GCS approximation
      const gcsMap: Record<string, number> = {
        'alert': 15,
        'voice-responsive': 13,
        'pain-responsive': 8,
        'unresponsive': 3,
      };

      const noteParts = [
        `Chief Complaint: ${chiefComplaints.find(c => c.id === selectedComplaint)?.label || selectedComplaint}`,
      ];
      if (complaintNotes.trim()) noteParts.push(complaintNotes.trim());
      if (priorityOverride && priorityOverride !== suggestedPriority)
        noteParts.push(`Priority set manually to ${priorityConfig[priorityOverride].label} (suggested: ${priorityConfig[suggestedPriority].label})`);
      const assignedDoctorName = onDutyDoctors.find(d => d.id === selectedDoctor)?.fullName;
      if (assignedDoctorName || selectedBay)
        noteParts.push(`Assigned: ${[assignedDoctorName, selectedBay].filter(Boolean).join(' at ')}`);

      const response = await emergencyService.triageCase(selectedCaseId, {
        triageLevel: priorityToLevel[effectivePriority],
        bloodPressureSystolic: vitals.bloodPressureSystolic ? parseInt(vitals.bloodPressureSystolic) : undefined,
        bloodPressureDiastolic: vitals.bloodPressureDiastolic ? parseInt(vitals.bloodPressureDiastolic) : undefined,
        heartRate: vitals.heartRate ? parseInt(vitals.heartRate) : undefined,
        respiratoryRate: vitals.respiratoryRate ? parseInt(vitals.respiratoryRate) : undefined,
        temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
        oxygenSaturation: vitals.oxygenSaturation ? parseInt(vitals.oxygenSaturation) : undefined,
        bloodGlucose: vitals.bloodGlucose ? parseFloat(vitals.bloodGlucose) : undefined,
        painScore: vitals.painLevel ? parseInt(vitals.painLevel) : undefined,
        gcsScore: gcsMap[vitals.consciousnessLevel] || 15,
        triageNotes: noteParts.join('\n'),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-cases'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-triage-queue'] });
      queryClient.invalidateQueries({ queryKey: ['emergency-dashboard'] });
      toast.success(`Triage complete — priority ${priorityConfig[effectivePriority].label}`);
      navigate('/emergency');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save triage')),
  });

  const handleSubmit = () => {
    if (selectedCaseId) {
      triageMutation.mutate();
    }
  };

  // If no case ID and we need to select from queue
  if (!selectedCaseId && !caseId) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/emergency')} className="p-2 hover:bg-gray-200 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency Triage Queue</h1>
            <p className="text-sm text-gray-500">Select a patient to triage</p>
          </div>
        </div>
        
        {loadingCases ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
          </div>
        ) : pendingCases && pendingCases.length > 0 ? (
          <div className="bg-white rounded-xl shadow divide-y">
            {pendingCases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className="w-full p-4 text-left hover:bg-yellow-50 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{c.caseNumber}</p>
                  <p className="text-sm text-gray-600">
                    {c.encounter?.patient?.fullName || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-500">{c.chiefComplaint}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    Arrived: {new Date(c.arrivalTime).toLocaleTimeString()}
                  </p>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600">No patients waiting for triage</p>
            <button
              onClick={() => navigate('/emergency')}
              className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Back to Emergency
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/emergency')} className="p-2 hover:bg-gray-200 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2 bg-yellow-100 rounded-lg">
            <ClipboardList className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Emergency Triage</h1>
            <p className="text-sm text-gray-500">
              {selectedCaseData ? (
                <>Case: {selectedCaseData.caseNumber} - {selectedCaseData.encounter?.patient?.fullName || 'Unknown'}</>
              ) : (
                'Manchester Triage System Assessment'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-500">{new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-6">
        {[
          { num: 1, label: 'Patient & Complaint' },
          { num: 2, label: 'Vitals Assessment' },
          { num: 3, label: 'Priority & Assignment' },
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              step >= s.num ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
            </div>
            <span className={`text-sm ${step >= s.num ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
              {s.label}
            </span>
            {idx < 2 && <ChevronRight className="w-4 h-4 text-gray-300 ml-4" />}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left Panel - Form */}
        <div className="flex-1 bg-white rounded-xl border shadow-sm overflow-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500" />
                  Patient
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{casePatient?.fullName || 'Unknown patient'}</p>
                    <p className="text-sm text-gray-500">
                      {[
                        casePatient?.mrn && `MRN ${casePatient.mrn}`,
                        patientAge != null && `${patientAge}y`,
                        casePatient?.gender,
                      ].filter(Boolean).join(' • ') || 'No demographics on file'}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{selectedCaseData?.caseNumber}</p>
                    {selectedCaseData?.arrivalTime && (
                      <p>Arrived {new Date(selectedCaseData.arrivalTime).toLocaleTimeString()}</p>
                    )}
                  </div>
                </div>
                {selectedCaseData?.chiefComplaint && (
                  <p className="mt-2 text-sm text-gray-700 bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded">
                    At registration: {selectedCaseData.chiefComplaint}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-gray-500" />
                  Chief Complaint
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {chiefComplaints.map((complaint) => {
                    const config = priorityConfig[complaint.priority];
                    return (
                      <button
                        key={complaint.id}
                        onClick={() => setSelectedComplaint(complaint.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          selectedComplaint === complaint.id
                            ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-sm font-medium">{complaint.label}</span>
                        <span className={`block text-xs mt-1 ${config.color}`}>
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                  <textarea
                    value={complaintNotes}
                    onChange={(e) => setComplaintNotes(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 h-20"
                    placeholder="Describe symptoms in detail..."
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-500" />
                Vital Signs Assessment
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <Thermometer className="w-4 h-4 text-orange-500" />
                      Temperature (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitals.temperature}
                      onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="36.5"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <Heart className="w-4 h-4 text-red-500" />
                      Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      value={vitals.heartRate}
                      onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="72"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <Activity className="w-4 h-4 text-purple-500" />
                      Blood Pressure (mmHg)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={vitals.bloodPressureSystolic}
                        onChange={(e) => setVitals({ ...vitals, bloodPressureSystolic: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="120"
                      />
                      <span className="self-center">/</span>
                      <input
                        type="number"
                        value={vitals.bloodPressureDiastolic}
                        onChange={(e) => setVitals({ ...vitals, bloodPressureDiastolic: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="80"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <Wind className="w-4 h-4 text-blue-500" />
                      Respiratory Rate (breaths/min)
                    </label>
                    <input
                      type="number"
                      value={vitals.respiratoryRate}
                      onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="16"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <Droplets className="w-4 h-4 text-cyan-500" />
                      Oxygen Saturation (%)
                    </label>
                    <input
                      type="number"
                      value={vitals.oxygenSaturation}
                      onChange={(e) => setVitals({ ...vitals, oxygenSaturation: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="98"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                      <Droplets className="w-4 h-4 text-purple-500" />
                      Blood Glucose (mg/dL)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitals.bloodGlucose}
                      onChange={(e) => setVitals({ ...vitals, bloodGlucose: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Optional — check if altered consciousness"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pain Level (0-10)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={vitals.painLevel}
                        onChange={(e) => setVitals({ ...vitals, painLevel: e.target.value })}
                        className="flex-1"
                      />
                      <span className={`w-8 text-center font-bold ${
                        parseInt(vitals.painLevel) >= 8 ? 'text-red-600' :
                        parseInt(vitals.painLevel) >= 5 ? 'text-orange-600' : 'text-green-600'
                      }`}>
                        {vitals.painLevel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Level of Consciousness (AVPU)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'alert', label: 'Alert', color: 'green' },
                    { value: 'voice-responsive', label: 'Voice Responsive', color: 'yellow' },
                    { value: 'pain-responsive', label: 'Pain Responsive', color: 'orange' },
                    { value: 'unresponsive', label: 'Unresponsive', color: 'red' },
                  ].map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setVitals({ ...vitals, consciousnessLevel: level.value })}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                        vitals.consciousnessLevel === level.value
                          ? avpuClasses[level.value]
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-gray-500" />
                Assignment
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Doctor (optional)</label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Assign later</option>
                    {onDutyDoctors.map(d => (
                      <option key={d.id} value={d.id}>{d.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Bay (optional)</label>
                  <select
                    value={selectedBay}
                    onChange={(e) => setSelectedBay(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">No bay</option>
                    {bays.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Triage Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Patient:</span>
                    <span className="ml-2 font-medium">
                      {casePatient?.fullName || 'Unknown'}
                      {patientAge != null ? `, ${patientAge}y` : ''} {casePatient?.gender || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Chief Complaint:</span>
                    <span className="ml-2 font-medium">
                      {chiefComplaints.find(c => c.id === selectedComplaint)?.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Vitals:</span>
                    <span className="ml-2 font-medium">
                      T:{vitals.temperature}°C HR:{vitals.heartRate} BP:{vitals.bloodPressureSystolic}/{vitals.bloodPressureDiastolic}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">SpO2:</span>
                    <span className="ml-2 font-medium">{vitals.oxygenSaturation}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Priority Preview */}
        <div className="w-80 flex flex-col gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold mb-3">
              {priorityOverride ? 'Priority (set by nurse)' : 'Suggested Priority'}
            </h3>
            <div className={`p-4 rounded-lg ${priorityConfig[effectivePriority].bgColor} text-white text-center`}>
              <p className="text-2xl font-bold">{priorityConfig[effectivePriority].label}</p>
              <p className="text-sm opacity-90 mt-1">Max wait: {priorityConfig[effectivePriority].maxWait}</p>
            </div>
            {priorityOverride && priorityOverride !== suggestedPriority && (
              <button
                onClick={() => setPriorityOverride(null)}
                className="mt-2 w-full text-xs text-blue-600 hover:underline"
              >
                Reset to suggested ({priorityConfig[suggestedPriority].label})
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="font-semibold mb-1">Priority Scale</h3>
            <p className="text-xs text-gray-500 mb-3">Tap a level to override the suggestion</p>
            <div className="space-y-2">
              {Object.entries(priorityConfig).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setPriorityOverride(key as TriagePriority)}
                  className={`w-full flex items-center justify-between p-2 rounded hover:bg-gray-50 ${
                    effectivePriority === key ? 'ring-2 ring-gray-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${config.bgColor}`} />
                    <span className="text-sm font-medium">{config.label}</span>
                  </div>
                  <span className="text-xs text-gray-500">{config.maxWait}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="mt-auto flex flex-col gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                disabled={step === 1 && !selectedComplaint}
                className="w-full px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!selectedComplaint || triageMutation.isPending}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {triageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Complete Triage
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}