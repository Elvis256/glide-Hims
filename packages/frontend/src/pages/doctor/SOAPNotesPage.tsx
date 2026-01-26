import { useState, useEffect } from 'react';
import {
  Search,
  UserCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  Save,
  CheckCircle,
  Clock,
  Loader2,
  PenLine,
  Clipboard,
  Microscope,
  ListChecks,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientsService, type Patient as ApiPatient } from '../../services/patients';
import { encountersService, type Encounter } from '../../services/encounters';

interface PatientWithEncounter {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  encounterId: string;
  encounterType: string;
  startTime: string;
}

// Calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Transform encounter to local patient format
function transformEncounterToPatient(encounter: Encounter): PatientWithEncounter | null {
  if (!encounter.patient) return null;
  return {
    id: encounter.patient.id,
    name: encounter.patient.fullName,
    mrn: encounter.patient.mrn,
    age: calculateAge(encounter.patient.dateOfBirth),
    gender: encounter.patient.gender.charAt(0).toUpperCase() + encounter.patient.gender.slice(1),
    encounterId: encounter.visitNumber,
    encounterType: encounter.type.toUpperCase(),
    startTime: new Date(encounter.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

// Transform API patient to local format
function transformPatientToLocal(patient: ApiPatient, encounter?: Encounter): PatientWithEncounter {
  return {
    id: patient.id,
    name: patient.fullName,
    mrn: patient.mrn,
    age: calculateAge(patient.dateOfBirth),
    gender: patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1),
    encounterId: encounter?.visitNumber || '',
    encounterType: encounter?.type.toUpperCase() || 'N/A',
    startTime: encounter ? new Date(encounter.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  };
}

interface SOAPData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface QuickPhrase {
  label: string;
  text: string;
}

const quickPhrases: Record<keyof SOAPData, QuickPhrase[]> = {
  subjective: [
    { label: 'No complaints', text: 'Patient denies any current complaints.' },
    { label: 'Pain improved', text: 'Patient reports improvement in pain since last visit.' },
    { label: 'Medication effective', text: 'Patient states current medications are effective.' },
    { label: 'New symptom', text: 'Patient reports new onset of ' },
    { label: 'Side effects', text: 'Patient reports side effects including ' },
  ],
  objective: [
    { label: 'NAD', text: 'Patient appears in no acute distress.' },
    { label: 'A&O x3', text: 'Patient is alert and oriented to person, place, and time.' },
    { label: 'Vitals stable', text: 'Vital signs are within normal limits.' },
    { label: 'Lungs clear', text: 'Lungs are clear to auscultation bilaterally.' },
    { label: 'Heart RRR', text: 'Heart has regular rate and rhythm, no murmurs.' },
  ],
  assessment: [
    { label: 'Stable', text: 'Condition is stable, continue current management.' },
    { label: 'Improving', text: 'Condition is improving on current treatment.' },
    { label: 'Worsening', text: 'Condition has worsened, requires adjustment in treatment.' },
    { label: 'New diagnosis', text: 'New diagnosis: ' },
    { label: 'Rule out', text: 'Rule out: ' },
  ],
  plan: [
    { label: 'Continue meds', text: 'Continue current medications as prescribed.' },
    { label: 'Follow-up', text: 'Follow-up in 2 weeks for reassessment.' },
    { label: 'Lab work', text: 'Order laboratory investigations: ' },
    { label: 'Imaging', text: 'Order imaging studies: ' },
    { label: 'Refer', text: 'Refer to specialist for further evaluation: ' },
  ],
};

const sectionConfig = {
  subjective: { title: 'Subjective', icon: PenLine, color: 'text-blue-500', bgColor: 'bg-blue-50' },
  objective: { title: 'Objective', icon: Microscope, color: 'text-green-500', bgColor: 'bg-green-50' },
  assessment: { title: 'Assessment', icon: Clipboard, color: 'text-purple-500', bgColor: 'bg-purple-50' },
  plan: { title: 'Plan', icon: ListChecks, color: 'text-orange-500', bgColor: 'bg-orange-50' },
};

export default function SOAPNotesPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientWithEncounter | null>(null);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<keyof SOAPData, boolean>>({
    subjective: true,
    objective: true,
    assessment: true,
    plan: true,
  });
  const [soapData, setSoapData] = useState<SOAPData>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'pending'>('saved');
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch patients based on search
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', 'search', debouncedSearch],
    queryFn: () => patientsService.search({ search: debouncedSearch, limit: 20 }),
  });

  // Fetch active encounters (in-progress status)
  const { data: encountersData, isLoading: encountersLoading } = useQuery({
    queryKey: ['encounters', 'active'],
    queryFn: () => encountersService.list({ status: 'in-progress', limit: 50 }),
  });

  // Fetch encounters for selected patient
  const { data: patientEncountersData } = useQuery({
    queryKey: ['encounters', 'patient', selectedPatient?.id],
    queryFn: () => encountersService.list({ patientId: selectedPatient!.id, limit: 10 }),
    enabled: !!selectedPatient?.id,
  });

  // Save SOAP notes mutation
  const saveSoapMutation = useMutation({
    mutationFn: async ({ encounterId, notes }: { encounterId: string; notes: string }) => {
      // Find the encounter by visit number from our encounters data
      const encounter = encountersData?.data.find(e => e.visitNumber === encounterId);
      if (!encounter) {
        throw new Error('Encounter not found');
      }
      return encountersService.update(encounter.id, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['encounters'] });
      setAutoSaveStatus('saved');
      setLastSaved(new Date().toLocaleTimeString());
    },
    onError: () => {
      setAutoSaveStatus('pending');
    },
  });

  // Transform encounters to patient list for display
  const activePatients: PatientWithEncounter[] = encountersData?.data
    .map(transformEncounterToPatient)
    .filter((p): p is PatientWithEncounter => p !== null)
    .filter((p) => {
      if (!debouncedSearch) return true;
      const query = debouncedSearch.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.mrn.toLowerCase().includes(query) ||
        p.encounterId.toLowerCase().includes(query)
      );
    }) || [];

  // Auto-save effect
  useEffect(() => {
    if (!selectedPatient || !selectedEncounterId) return;

    const hasContent = Object.values(soapData).some((v) => v.trim());
    if (!hasContent) return;

    setAutoSaveStatus('pending');
    const timer = setTimeout(() => {
      setAutoSaveStatus('saving');
      const notes = `SUBJECTIVE:\n${soapData.subjective}\n\nOBJECTIVE:\n${soapData.objective}\n\nASSESSMENT:\n${soapData.assessment}\n\nPLAN:\n${soapData.plan}`;
      saveSoapMutation.mutate({ encounterId: selectedEncounterId, notes });
    }, 2000);

    return () => clearTimeout(timer);
  }, [soapData, selectedPatient, selectedEncounterId]);

  const handleSelectPatient = (patient: PatientWithEncounter) => {
    setSelectedPatient(patient);
    setSelectedEncounterId(patient.encounterId);
    setSoapData({
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    });
    setLastSaved(null);
  };

  const toggleSection = (section: keyof SOAPData) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const insertQuickPhrase = (section: keyof SOAPData, text: string) => {
    setSoapData((prev) => ({
      ...prev,
      [section]: prev[section] ? `${prev[section]}\n${text}` : text,
    }));
  };

  const handleSignAndComplete = () => {
    if (!selectedEncounterId) return;
    const notes = `SUBJECTIVE:\n${soapData.subjective}\n\nOBJECTIVE:\n${soapData.objective}\n\nASSESSMENT:\n${soapData.assessment}\n\nPLAN:\n${soapData.plan}`;
    saveSoapMutation.mutate(
      { encounterId: selectedEncounterId, notes },
      {
        onSuccess: () => {
          alert('SOAP note signed and completed successfully!');
        },
        onError: (error) => {
          alert(`Failed to save SOAP note: ${error instanceof Error ? error.message : 'Unknown error'}`);
        },
      }
    );
  };

  const isLoading = patientsLoading || encountersLoading;

  const renderSection = (key: keyof SOAPData) => {
    const config = sectionConfig[key];
    const Icon = config.icon;
    const isExpanded = expandedSections[key];

    return (
      <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection(key)}
          className={`w-full flex items-center justify-between p-4 ${config.bgColor} hover:opacity-90 transition-opacity`}
        >
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.color}`} />
            <h3 className="font-semibold text-gray-900">{config.title}</h3>
            {soapData[key] && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                {soapData[key].split('\n').length} lines
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {isExpanded && (
          <div className="p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {quickPhrases[key].map((phrase, idx) => (
                <button
                  key={idx}
                  onClick={() => insertQuickPhrase(key, phrase.text)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {phrase.label}
                </button>
              ))}
            </div>
            <textarea
              rows={4}
              value={soapData[key]}
              onChange={(e) => setSoapData({ ...soapData, [key]: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={`Enter ${config.title.toLowerCase()} findings...`}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">SOAP Notes</h1>
            <p className="text-sm text-gray-500">Document clinical encounters in SOAP format</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Auto-save indicator */}
          {selectedPatient && (
            <div className="flex items-center gap-2 text-sm">
              {autoSaveStatus === 'saving' && (
                <>
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-blue-600">Saving...</span>
                </>
              )}
              {autoSaveStatus === 'saved' && lastSaved && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-500">Saved at {lastSaved}</span>
                </>
              )}
              {autoSaveStatus === 'pending' && (
                <>
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Pending save...</span>
                </>
              )}
            </div>
          )}
          <button
            onClick={handleSignAndComplete}
            disabled={!selectedPatient || saveSoapMutation.isPending || !Object.values(soapData).some((v) => v.trim())}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saveSoapMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Sign & Complete
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Patient Sidebar */}
        <div className="w-1/4 bg-white rounded-xl border border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Active Encounters</h3>
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
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : activePatients.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No active encounters found
              </div>
            ) : (
              activePatients.map((patient) => (
                <button
                  key={`${patient.id}-${patient.encounterId}`}
                  onClick={() => handleSelectPatient(patient)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                    selectedPatient?.id === patient.id && selectedPatient?.encounterId === patient.encounterId
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <UserCircle className="w-8 h-8 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.mrn}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                          {patient.encounterType}
                        </span>
                        <span className="text-xs text-gray-400">{patient.encounterId}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>Started {patient.startTime}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* SOAP Form */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Patient Header */}
              <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCircle className="w-10 h-10 text-indigo-600" />
                    <div>
                      <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                      <p className="text-sm text-gray-600">
                        {selectedPatient.age}y {selectedPatient.gender} • {selectedPatient.mrn}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-indigo-700">{selectedPatient.encounterType}</p>
                    <p className="text-xs text-gray-500">Encounter: {selectedPatient.encounterId}</p>
                  </div>
                </div>
              </div>

              {/* SOAP Sections */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {(Object.keys(soapData) as Array<keyof SOAPData>).map(renderSection)}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Select an Encounter</h3>
                <p className="text-sm text-gray-500">Choose a patient with an active encounter to document SOAP notes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
