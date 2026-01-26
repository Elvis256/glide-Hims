import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardCheck,
  UserCircle,
  Heart,
  Activity,
  Thermometer,
  Wind,
  Droplets,
  Save,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface AssessmentData {
  temperature: string;
  pulse: string;
  bpSystolic: string;
  bpDiastolic: string;
  respiratoryRate: string;
  oxygenSaturation: string;
  weight: string;
  height: string;
  painScale: string;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  allergies: string;
  currentMedications: string;
  medicalHistory: string;
  levelOfConsciousness: string;
  mobilityStatus: string;
  skinCondition: string;
  nursingNotes: string;
  priority: string;
}

const priorityLevels = [
  { value: 'immediate', label: 'Immediate (Red)', color: 'bg-red-500', description: 'Life-threatening' },
  { value: 'urgent', label: 'Urgent (Orange)', color: 'bg-orange-500', description: 'Serious but stable' },
  { value: 'less-urgent', label: 'Less Urgent (Yellow)', color: 'bg-yellow-500', description: 'Needs attention' },
  { value: 'non-urgent', label: 'Non-Urgent (Green)', color: 'bg-green-500', description: 'Minor issues' },
];

export default function NursingAssessmentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const patientFromQueue = location.state?.patient;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [assessment, setAssessment] = useState<AssessmentData>({
    temperature: '',
    pulse: '',
    bpSystolic: '',
    bpDiastolic: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    painScale: '',
    chiefComplaint: patientFromQueue?.chiefComplaint || '',
    historyOfPresentIllness: '',
    allergies: '',
    currentMedications: '',
    medicalHistory: '',
    levelOfConsciousness: 'alert',
    mobilityStatus: 'ambulatory',
    skinCondition: 'normal',
    nursingNotes: '',
    priority: patientFromQueue?.priority || 'less-urgent',
  });

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 1000);
  };

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Assessment Complete</h2>
          <p className="text-gray-600 mb-6">
            Patient has been triaged and assigned priority: {priorityLevels.find(p => p.value === assessment.priority)?.label}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/nursing/triage')}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Back to Queue
            </button>
            <button
              onClick={() => {
                setSaved(false);
                setAssessment({
                  ...assessment,
                  temperature: '',
                  pulse: '',
                  bpSystolic: '',
                  bpDiastolic: '',
                  respiratoryRate: '',
                  oxygenSaturation: '',
                  chiefComplaint: '',
                  historyOfPresentIllness: '',
                  nursingNotes: '',
                });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              New Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <ClipboardCheck className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Nursing Assessment</h1>
              <p className="text-sm text-gray-500">Complete patient triage assessment</p>
            </div>
          </div>
        </div>
        {patientFromQueue && (
          <div className="flex items-center gap-3 bg-teal-50 px-4 py-2 rounded-lg">
            <UserCircle className="w-8 h-8 text-teal-600" />
            <div>
              <p className="font-medium text-gray-900">{patientFromQueue.name}</p>
              <p className="text-xs text-gray-500">{patientFromQueue.mrn}</p>
            </div>
          </div>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Vital Signs */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Vital Signs
            </h2>
            <div className="space-y-3">
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={assessment.temperature}
                  onChange={(e) => setAssessment({ ...assessment, temperature: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="36.5"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  <Activity className="w-4 h-4 text-pink-500" />
                  Pulse (bpm)
                </label>
                <input
                  type="number"
                  value={assessment.pulse}
                  onChange={(e) => setAssessment({ ...assessment, pulse: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="72"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  <Heart className="w-4 h-4 text-red-500" />
                  Blood Pressure (mmHg)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={assessment.bpSystolic}
                    onChange={(e) => setAssessment({ ...assessment, bpSystolic: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="120"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    value={assessment.bpDiastolic}
                    onChange={(e) => setAssessment({ ...assessment, bpDiastolic: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="80"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  <Wind className="w-4 h-4 text-blue-500" />
                  Respiratory Rate (/min)
                </label>
                <input
                  type="number"
                  value={assessment.respiratoryRate}
                  onChange={(e) => setAssessment({ ...assessment, respiratoryRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="16"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-1">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  SpO2 (%)
                </label>
                <input
                  type="number"
                  value={assessment.oxygenSaturation}
                  onChange={(e) => setAssessment({ ...assessment, oxygenSaturation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="98"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Pain Scale (0-10)</label>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAssessment({ ...assessment, painScale: num.toString() })}
                      className={`flex-1 py-1.5 text-xs font-medium rounded ${
                        assessment.painScale === num.toString()
                          ? num <= 3
                            ? 'bg-green-500 text-white'
                            : num <= 6
                            ? 'bg-yellow-500 text-white'
                            : 'bg-red-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Assessment */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Clinical Assessment</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Chief Complaint *</label>
                <textarea
                  rows={2}
                  value={assessment.chiefComplaint}
                  onChange={(e) => setAssessment({ ...assessment, chiefComplaint: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="Primary reason for visit..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">History of Present Illness</label>
                <textarea
                  rows={2}
                  value={assessment.historyOfPresentIllness}
                  onChange={(e) => setAssessment({ ...assessment, historyOfPresentIllness: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="Onset, duration, severity..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Allergies</label>
                <input
                  type="text"
                  value={assessment.allergies}
                  onChange={(e) => setAssessment({ ...assessment, allergies: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Known allergies..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Current Medications</label>
                <input
                  type="text"
                  value={assessment.currentMedications}
                  onChange={(e) => setAssessment({ ...assessment, currentMedications: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="List current medications..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Level of Consciousness</label>
                <select
                  value={assessment.levelOfConsciousness}
                  onChange={(e) => setAssessment({ ...assessment, levelOfConsciousness: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="alert">Alert & Oriented</option>
                  <option value="verbal">Responds to Verbal</option>
                  <option value="pain">Responds to Pain</option>
                  <option value="unresponsive">Unresponsive</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Mobility Status</label>
                <select
                  value={assessment.mobilityStatus}
                  onChange={(e) => setAssessment({ ...assessment, mobilityStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="ambulatory">Ambulatory</option>
                  <option value="assisted">Needs Assistance</option>
                  <option value="wheelchair">Wheelchair</option>
                  <option value="stretcher">Stretcher</option>
                  <option value="bedbound">Bedbound</option>
                </select>
              </div>
            </div>
          </div>

          {/* Priority & Notes */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                Triage Priority
              </h2>
              <div className="space-y-2">
                {priorityLevels.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setAssessment({ ...assessment, priority: level.value })}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      assessment.priority === level.value
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full ${level.color}`} />
                    <div className="text-left flex-1">
                      <p className="font-medium text-gray-900 text-sm">{level.label}</p>
                      <p className="text-xs text-gray-500">{level.description}</p>
                    </div>
                    {assessment.priority === level.value && (
                      <CheckCircle className="w-5 h-5 text-teal-600" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Nursing Notes</h2>
              <textarea
                rows={4}
                value={assessment.nursingNotes}
                onChange={(e) => setAssessment({ ...assessment, nursingNotes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                placeholder="Additional observations and notes..."
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !assessment.chiefComplaint}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Complete Assessment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
