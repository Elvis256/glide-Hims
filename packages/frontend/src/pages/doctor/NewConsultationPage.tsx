import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  UserCircle,
  Stethoscope,
  ClipboardList,
  Activity,
  ChevronDown,
  Save,
  PlayCircle,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  Clock,
  Loader2,
  FileText,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../services/queue';
import { encountersService } from '../../services/encounters';
import { vitalsService } from '../../services/vitals';
import { useFacilityId } from '../../lib/facility';

interface Vitals {
  temperature: string;
  pulse: string;
  bp: string;
  respiratoryRate: string;
  spo2: string;
  painScale: number;
  recordedAt: string;
  recordedBy: string;
}

interface ConsultationForm {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  reviewOfSystems: string;
  physicalExam: string;
  template: string;
}

// No mock vitals - use real data from API

const templates = [
  { value: '', label: 'Select a template...' },
  { value: 'general', label: 'General Consultation' },
  { value: 'followup', label: 'Follow-up Visit' },
  { value: 'prenatal', label: 'Prenatal Checkup' },
  { value: 'chronic', label: 'Chronic Disease Management' },
  { value: 'respiratory', label: 'Respiratory Complaint' },
  { value: 'cardiovascular', label: 'Cardiovascular Assessment' },
];

const templateContent: Record<string, Partial<ConsultationForm>> = {
  general: {
    historyOfPresentIllness: 'Onset: \nLocation: \nDuration: \nCharacter: \nAggravating factors: \nRelieving factors: \nTiming: \nSeverity: ',
    reviewOfSystems: 'Constitutional: No fever, chills, or weight changes\nCardiovascular: \nRespiratory: \nGastrointestinal: \nGenitourinary: \nMusculoskeletal: \nNeurological: ',
    physicalExam: 'General: Patient appears well, in no acute distress\nVitals: As recorded\nHEENT: \nChest: \nCardiovascular: \nAbdomen: \nExtremities: \nNeurological: ',
  },
  followup: {
    historyOfPresentIllness: 'Patient returns for follow-up of:\nCurrent status: \nMedication compliance: \nSide effects: \nNew concerns: ',
    reviewOfSystems: 'Focused review based on primary condition:\n',
    physicalExam: 'Focused examination:\n',
  },
  prenatal: {
    historyOfPresentIllness: 'G_P_: \nLMP: \nEDD: \nGA: \nMovement: \nContractions: \nBleeding: \nDischarge: ',
    reviewOfSystems: 'Nausea/Vomiting: \nEdema: \nHeadache: \nVisual changes: \nAbdominal pain: ',
    physicalExam: 'Fundal height: \nFetal heart rate: \nPresentation: \nEdema: \nBlood pressure: ',
  },
  chronic: {
    historyOfPresentIllness: 'Condition being managed: \nLast visit: \nCurrent medications: \nCompliance: \nHome monitoring results: \nNew symptoms: ',
    reviewOfSystems: 'Symptoms related to primary condition:\nComplications screening:\n',
    physicalExam: 'Targeted examination for chronic condition:\n',
  },
  respiratory: {
    historyOfPresentIllness: 'Cough: Duration_, Character_\nSputum: Color_, Amount_\nDyspnea: At rest/exertion\nWheezing: \nFever: \nExposures: \nSmoking history: ',
    reviewOfSystems: 'ENT: \nRespiratory: Cough, dyspnea, wheeze\nCardiovascular: \nConstitutional: Fever, chills, night sweats',
    physicalExam: 'Respiratory rate: \nOxygen saturation: \nChest inspection: \nPercussion: \nAuscultation: \nAccessory muscle use: ',
  },
  cardiovascular: {
    historyOfPresentIllness: 'Chest pain: Location_, Character_, Radiation_\nDyspnea: \nPalpitations: \nEdema: \nSyncope: \nExercise tolerance: ',
    reviewOfSystems: 'Cardiovascular: Chest pain, palpitations, edema\nRespiratory: Dyspnea, orthopnea, PND\nNeurological: Syncope, dizziness',
    physicalExam: 'JVP: \nHeart sounds: S1_, S2_, Murmurs_\nPulses: \nEdema: \nCapillary refill: ',
  },
};

export default function NewConsultationPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<QueueEntry | null>(null);
  const [form, setForm] = useState<ConsultationForm>({
    chiefComplaint: '',
    historyOfPresentIllness: '',
    reviewOfSystems: '',
    physicalExam: '',
    template: '',
  });

  // Fetch waiting patients from queue - use lowercase service point
  const { data: waitingPatients = [], isLoading } = useQuery({
    queryKey: ['queue', 'waiting', 'consultation'],
    queryFn: () => queueService.getWaiting('consultation'),
    refetchInterval: 30000,
  });

  // Fetch vitals for selected patient
  const { data: patientVitals } = useQuery({
    queryKey: ['vitals', selectedPatient?.patientId],
    queryFn: async () => {
      if (!selectedPatient?.patientId) return null;
      const history = await vitalsService.getPatientHistory(selectedPatient.patientId);
      // Get most recent vitals
      if (history && history.length > 0) {
        const latest = history[0];
        return {
          temperature: String(latest.temperature || '-'),
          pulse: String(latest.pulse || '-'),
          bp: latest.bloodPressureSystolic && latest.bloodPressureDiastolic 
            ? `${latest.bloodPressureSystolic}/${latest.bloodPressureDiastolic}` 
            : '-/-',
          respiratoryRate: String(latest.respiratoryRate || '-'),
          spo2: String(latest.oxygenSaturation || '-'),
          painScale: latest.painScale || 0,
          recordedAt: new Date(latest.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recordedBy: 'Nurse',
        } as Vitals;
      }
      return null;
    },
    enabled: !!selectedPatient?.patientId,
  });

  // Start consultation mutation
  const startConsultMutation = useMutation({
    mutationFn: async (entry: QueueEntry) => {
      // Start service in queue
      await queueService.startService(entry.id);
      // Create encounter
      return encountersService.create({
        patientId: entry.patientId,
        facilityId,
        type: 'opd',
        chiefComplaint: form.chiefComplaint,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  // Save consultation mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // In production, would save clinical notes
      await new Promise(resolve => setTimeout(resolve, 500));
    },
  });

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return waitingPatients;
    const query = searchQuery.toLowerCase();
    return waitingPatients.filter(
      (p) =>
        p.patient?.fullName?.toLowerCase().includes(query) ||
        p.patient?.mrn?.toLowerCase().includes(query) ||
        p.ticketNumber?.toLowerCase().includes(query)
    );
  }, [searchQuery, waitingPatients]);

  const vitals = patientVitals;

  const handleSelectPatient = (entry: QueueEntry) => {
    setSelectedPatient(entry);
    setForm((prev) => ({
      ...prev,
      chiefComplaint: entry.notes || '',
    }));
  };

  const getWaitTime = (entry: QueueEntry) => {
    if (!entry.createdAt) return '0 min';
    const now = new Date();
    const created = new Date(entry.createdAt);
    const mins = Math.floor((now.getTime() - created.getTime()) / 60000);
    return `${mins} min`;
  };

  const handleTemplateChange = (templateValue: string) => {
    setForm((prev) => ({
      ...prev,
      template: templateValue,
      ...(templateContent[templateValue] || {}),
    }));
  };

  const handleSaveDraft = () => {
    saveMutation.mutate();
  };

  const handleStartConsultation = () => {
    if (selectedPatient) {
      startConsultMutation.mutate(selectedPatient);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Consultation</h1>
            <p className="text-sm text-gray-500">Document patient encounter</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={!selectedPatient || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveMutation.isPending ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleStartConsultation}
            disabled={!selectedPatient || startConsultMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {startConsultMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
            Start Consultation
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Patient Sidebar */}
        <div className="w-1/4 bg-white rounded-xl border border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <p className="text-center text-gray-500 py-8 text-sm">No patients waiting</p>
            ) : (
              filteredPatients.map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleSelectPatient(entry)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                  selectedPatient?.id === entry.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2">
                  <UserCircle className="w-8 h-8 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{entry.patient?.fullName || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{entry.patient?.mrn || entry.ticketNumber}</p>
                    <p className="text-xs text-gray-600 mt-1 truncate">{entry.notes || 'No complaint'}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{getWaitTime(entry)}</span>
                    </div>
                  </div>
                </div>
              </button>
            )))}
          </div>
        </div>

        {/* Consultation Form */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Vitals Summary */}
              {vitals && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-600" />
                      Vitals from Nursing
                    </h3>
                    <span className="text-xs text-gray-500">
                      Recorded by {vitals.recordedBy} at {vitals.recordedAt}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-3">
                    <div className="bg-white rounded-lg p-2 text-center">
                      <Thermometer className="w-4 h-4 text-red-500 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-gray-900">{vitals.temperature}°C</p>
                      <p className="text-xs text-gray-500">Temp</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <Heart className="w-4 h-4 text-pink-500 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-gray-900">{vitals.pulse}</p>
                      <p className="text-xs text-gray-500">Pulse</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <Activity className="w-4 h-4 text-red-500 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-gray-900">{vitals.bp}</p>
                      <p className="text-xs text-gray-500">BP</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <Wind className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-gray-900">{vitals.respiratoryRate}</p>
                      <p className="text-xs text-gray-500">RR</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <Droplets className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-lg font-semibold text-gray-900">{vitals.spo2}%</p>
                      <p className="text-xs text-gray-500">SpO2</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 text-center">
                      <span className="text-lg mb-1 block">😣</span>
                      <p className="text-lg font-semibold text-gray-900">{vitals.painScale}/10</p>
                      <p className="text-xs text-gray-500">Pain</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Template Selector */}
              <div className="mb-4">
                <div className="relative">
                  <select
                    value={form.template}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm appearance-none bg-white pr-10"
                  >
                    {templates.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Form Sections */}
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Chief Complaint */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-orange-500" />
                    Chief Complaint
                  </h3>
                  <textarea
                    rows={2}
                    value={form.chiefComplaint}
                    onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Patient's main reason for visit..."
                  />
                </div>

                {/* History of Present Illness */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <ClipboardList className="w-5 h-5 text-purple-500" />
                    History of Present Illness
                  </h3>
                  <textarea
                    rows={4}
                    value={form.historyOfPresentIllness}
                    onChange={(e) => setForm({ ...form, historyOfPresentIllness: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Detailed history of the current illness..."
                  />
                </div>

                {/* Review of Systems */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Activity className="w-5 h-5 text-green-500" />
                    Review of Systems
                  </h3>
                  <textarea
                    rows={4}
                    value={form.reviewOfSystems}
                    onChange={(e) => setForm({ ...form, reviewOfSystems: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Systematic review of body systems..."
                  />
                </div>

                {/* Physical Exam */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                    <Stethoscope className="w-5 h-5 text-blue-500" />
                    Physical Examination
                  </h3>
                  <textarea
                    rows={4}
                    value={form.physicalExam}
                    onChange={(e) => setForm({ ...form, physicalExam: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Findings from physical examination..."
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-center">
                <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Select a Patient</h3>
                <p className="text-sm text-gray-500">Choose a patient from the list to start documentation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
