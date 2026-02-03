import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileText,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Plus,
  Calendar,
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
  Filter,
  Printer,
  Download,
  Share2,
  Mic,
  MicOff,
  Bold,
  Italic,
  List,
  X,
  Edit3,
  ClipboardList,
  AlertCircle,
  BookOpen,
  MessageSquare,
  Activity,
  FileCheck,
  PlusCircle,
  User,
  Link2,
  Zap,
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { ipdService, type CreateNursingNoteDto, type NursingNoteType } from '../../services/ipd';
import PermissionGate, { usePermissions } from '../../components/PermissionGate';

// Extended Note Types
type ExtendedNoteType = 
  | 'assessment' 
  | 'progress' 
  | 'intervention' 
  | 'patient_response' 
  | 'education' 
  | 'communication' 
  | 'discharge_planning';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
  admissionId?: string;
}

interface NoteTemplate {
  id: string;
  name: string;
  type: ExtendedNoteType;
  content: string;
  darFormat?: boolean;
}

interface QuickPhrase {
  id: string;
  label: string;
  text: string;
  category: string;
}

interface NoteAddendum {
  id: string;
  noteId: string;
  content: string;
  isLateEntry: boolean;
  author: string;
  timestamp: string;
}

// Note type configuration with icons and colors
const noteTypeConfig: Record<ExtendedNoteType, { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: React.ElementType;
  apiType: NursingNoteType;
}> = {
  assessment: { 
    label: 'Assessment Note', 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-100',
    icon: ClipboardList,
    apiType: 'assessment',
  },
  progress: { 
    label: 'Progress Note', 
    color: 'text-orange-700', 
    bgColor: 'bg-orange-100',
    icon: Activity,
    apiType: 'progress',
  },
  intervention: { 
    label: 'Intervention Note', 
    color: 'text-green-700', 
    bgColor: 'bg-green-100',
    icon: Zap,
    apiType: 'intervention',
  },
  patient_response: { 
    label: 'Patient Response', 
    color: 'text-purple-700', 
    bgColor: 'bg-purple-100',
    icon: MessageSquare,
    apiType: 'observation',
  },
  education: { 
    label: 'Education Note', 
    color: 'text-cyan-700', 
    bgColor: 'bg-cyan-100',
    icon: BookOpen,
    apiType: 'observation',
  },
  communication: { 
    label: 'Communication Note', 
    color: 'text-indigo-700', 
    bgColor: 'bg-indigo-100',
    icon: Share2,
    apiType: 'handoff',
  },
  discharge_planning: { 
    label: 'Discharge Planning', 
    color: 'text-emerald-700', 
    bgColor: 'bg-emerald-100',
    icon: FileCheck,
    apiType: 'observation',
  },
};

// Quick phrases for common documentation
const quickPhrases: QuickPhrase[] = [
  { id: '1', label: 'Vital Signs Stable', text: 'Vital signs within normal limits. Patient appears comfortable.', category: 'assessment' },
  { id: '2', label: 'Patient Resting', text: 'Patient resting quietly in bed. No distress noted.', category: 'observation' },
  { id: '3', label: 'Pain Assessment', text: 'Pain assessed using numeric scale. Patient reports pain level of _/10.', category: 'assessment' },
  { id: '4', label: 'Medication Given', text: 'Medication administered as ordered. Patient tolerated well with no adverse reactions.', category: 'intervention' },
  { id: '5', label: 'Fall Precautions', text: 'Fall precautions in place. Bed in low position, call light within reach, side rails up.', category: 'safety' },
  { id: '6', label: 'Patient Education', text: 'Patient education provided regarding ___. Patient verbalized understanding.', category: 'education' },
  { id: '7', label: 'Family Update', text: 'Family member at bedside. Updated on patient condition and care plan.', category: 'communication' },
  { id: '8', label: 'Wound Care', text: 'Wound assessed and dressing changed per protocol. No signs of infection noted.', category: 'intervention' },
  { id: '9', label: 'IV Site', text: 'IV site assessed. No redness, swelling, or tenderness. Fluids infusing as ordered.', category: 'assessment' },
  { id: '10', label: 'Discharge Planning', text: 'Discussed discharge plan with patient. Follow-up appointments scheduled.', category: 'discharge' },
];

// Note templates
const noteTemplates: NoteTemplate[] = [
  {
    id: 'admission',
    name: 'Admission Note',
    type: 'assessment',
    content: `ADMISSION NURSING ASSESSMENT

Patient admitted from: ___
Admitting diagnosis: ___
Chief complaint: ___

INITIAL ASSESSMENT:
- Level of consciousness: Alert and oriented x___
- Vital signs: T___ HR___ BP___/___ RR___ SpO2___%
- Pain level: ___/10
- Allergies: ___
- Medications brought from home: ___

SKIN ASSESSMENT:
- Condition: ___
- Wounds/pressure areas: ___

SAFETY ASSESSMENT:
- Fall risk: ___
- Mobility status: ___
- Code status: ___

PLAN:
- Orient patient to room and unit
- Review care plan with patient/family
- Initial orders reviewed and implemented`,
  },
  {
    id: 'routine',
    name: 'Routine Care',
    type: 'progress',
    content: `ROUTINE NURSING CARE

Shift: ___
Time: ___

ASSESSMENT:
- Patient condition: ___
- Vital signs: Within normal limits / See flowsheet
- Pain level: ___/10
- Activity: ___

INTERVENTIONS:
- Medications administered as scheduled
- Personal care provided
- Position changes performed
- Safety measures maintained

PATIENT RESPONSE:
- Tolerated care well
- No complaints at this time

PLAN:
- Continue current plan of care`,
  },
  {
    id: 'education',
    name: 'Patient Education',
    type: 'education',
    content: `PATIENT EDUCATION NOTE

Topic: ___
Teaching method used: ___

CONTENT COVERED:
1. ___
2. ___
3. ___

PATIENT/FAMILY RESPONSE:
- Verbalized understanding: Yes / No / Partial
- Demonstrated skill: Yes / No / N/A
- Questions asked: ___

BARRIERS TO LEARNING:
- None identified / ___

FOLLOW-UP:
- Reinforcement needed: ___
- Additional resources provided: ___`,
  },
  {
    id: 'dar',
    name: 'DAR Format (Progress)',
    type: 'progress',
    darFormat: true,
    content: '',
  },
];

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

// Format timestamp
const formatTimestamp = (date: Date): string => {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function NursingNotesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Patient selection state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Note form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedNoteType, setSelectedNoteType] = useState<ExtendedNoteType>('progress');
  const [noteContent, setNoteContent] = useState('');
  const [showDARFormat, setShowDARFormat] = useState(false);
  const [darData, setDarData] = useState({ data: '', action: '', response: '' });
  const [showQuickPhrases, setShowQuickPhrases] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [linkedIntervention, setLinkedIntervention] = useState('');
  const [isLateEntry, setIsLateEntry] = useState(false);
  
  // Voice to text
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  
  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [authorFilter, setAuthorFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchInNotes, setSearchInNotes] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Expanded notes
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  
  // Addendum state
  const [addendumNoteId, setAddendumNoteId] = useState<string | null>(null);
  const [addendumContent, setAddendumContent] = useState('');

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(!!SpeechRecognition);
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setNoteContent(prev => prev + ' ' + transcript);
      };
      recognitionRef.current.onerror = () => {
        setIsRecording(false);
        toast.error('Voice recognition error');
      };
    }
  }, []);

  // Search patients from API
  const { data: apiPatients } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
  });

  // Get current admission for selected patient
  const { data: admission } = useQuery({
    queryKey: ['patient-admission', selectedPatient?.id],
    queryFn: async () => {
      const response = await ipdService.admissions.list({ patientId: selectedPatient!.id, status: 'admitted' });
      return response.data[0] || null;
    },
    enabled: !!selectedPatient?.id,
  });

  // Fetch nursing notes for admission
  const { data: nursingNotes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['nursing-notes', admission?.id],
    queryFn: () => ipdService.nursingNotes.list(admission!.id),
    enabled: !!admission?.id,
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes', admission?.id] });
      setSaved(true);
      setShowAddForm(false);
      resetNoteForm();
      toast.success('Note saved successfully');
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => {
      toast.error('Failed to save note');
    },
  });

  const filteredPatients = useMemo(() => {
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

  // Filter and search notes
  const filteredNotes = useMemo(() => {
    let notes = [...nursingNotes];
    
    // Type filter
    if (typeFilter !== 'all') {
      notes = notes.filter(n => n.type === typeFilter);
    }
    
    // Author filter
    if (authorFilter) {
      notes = notes.filter(n => 
        (n.nurse?.fullName || n.nurse?.firstName || '').toLowerCase().includes(authorFilter.toLowerCase())
      );
    }
    
    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      notes = notes.filter(n => new Date(n.noteTime) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      notes = notes.filter(n => new Date(n.noteTime) <= to);
    }
    
    // Full-text search
    if (searchInNotes) {
      const searchLower = searchInNotes.toLowerCase();
      notes = notes.filter(n => 
        n.content.toLowerCase().includes(searchLower)
      );
    }
    
    return notes.sort((a, b) => new Date(b.noteTime).getTime() - new Date(a.noteTime).getTime());
  }, [nursingNotes, typeFilter, authorFilter, dateFrom, dateTo, searchInNotes]);

  // Get unique authors for filter dropdown
  const uniqueAuthors = useMemo(() => {
    const authors = new Set<string>();
    nursingNotes.forEach(n => {
      const name = n.nurse?.fullName || n.nurse?.firstName;
      if (name) authors.add(name);
    });
    return Array.from(authors);
  }, [nursingNotes]);

  const resetNoteForm = () => {
    setNoteContent('');
    setDarData({ data: '', action: '', response: '' });
    setShowDARFormat(false);
    setLinkedIntervention('');
    setIsLateEntry(false);
    setSelectedNoteType('progress');
  };

  const toggleNoteExpand = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  const insertQuickPhrase = (phrase: QuickPhrase) => {
    const newContent = noteContent ? noteContent + '\n\n' + phrase.text : phrase.text;
    setNoteContent(newContent);
    setShowQuickPhrases(false);
    textareaRef.current?.focus();
  };

  const applyTemplate = (template: NoteTemplate) => {
    if (template.darFormat) {
      setShowDARFormat(true);
      setSelectedNoteType('progress');
    } else {
      setNoteContent(template.content);
      setSelectedNoteType(template.type);
    }
    setShowTemplates(false);
  };

  const applyFormatting = (format: 'bold' | 'italic' | 'list') => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = noteContent;
    const selectedText = text.substring(start, end);
    
    let newText = '';
    let cursorOffset = 0;
    
    switch (format) {
      case 'bold':
        newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end);
        cursorOffset = 2;
        break;
      case 'italic':
        newText = text.substring(0, start) + `_${selectedText}_` + text.substring(end);
        cursorOffset = 1;
        break;
      case 'list':
        const lines = selectedText.split('\n');
        const bulletedLines = lines.map(line => `• ${line}`).join('\n');
        newText = text.substring(0, start) + bulletedLines + text.substring(end);
        cursorOffset = 2;
        break;
    }
    
    setNoteContent(newText);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start + cursorOffset, end + cursorOffset);
    }, 0);
  };

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) return;
    
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
      toast.info('Listening... Speak now');
    }
  };

  const handleSave = () => {
    if (!admission?.id) return;
    
    let content = noteContent;
    
    // Build DAR format content
    if (showDARFormat) {
      if (!darData.data.trim() && !darData.action.trim() && !darData.response.trim()) {
        toast.error('Please fill in at least one DAR field');
        return;
      }
      content = `[DAR FORMAT]\n\nDATA:\n${darData.data}\n\nACTION:\n${darData.action}\n\nRESPONSE:\n${darData.response}`;
    } else if (!content.trim()) {
      toast.error('Please enter note content');
      return;
    }
    
    // Add late entry indicator
    if (isLateEntry) {
      content = `[LATE ENTRY]\n\n${content}`;
    }
    
    // Add linked intervention
    if (linkedIntervention) {
      content = `${content}\n\n[Linked to: ${linkedIntervention}]`;
    }

    const noteData: CreateNursingNoteDto = {
      admissionId: admission.id,
      type: noteTypeConfig[selectedNoteType]?.apiType || 'observation',
      content,
    };

    createNoteMutation.mutate(noteData);
  };

  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  const handleExport = () => {
    if (!selectedPatient || filteredNotes.length === 0) return;
    
    let exportContent = `NURSING NOTES EXPORT\n`;
    exportContent += `Patient: ${selectedPatient.name} (${selectedPatient.mrn})\n`;
    exportContent += `Export Date: ${formatTimestamp(new Date())}\n`;
    exportContent += `${'='.repeat(60)}\n\n`;
    
    filteredNotes.forEach(note => {
      const config = Object.values(noteTypeConfig).find(c => c.apiType === note.type) || 
                     { label: note.type };
      exportContent += `[${config.label}]\n`;
      exportContent += `Date/Time: ${formatTimestamp(new Date(note.noteTime))}\n`;
      exportContent += `Author: ${note.nurse?.fullName || note.nurse?.firstName || 'Unknown'}\n`;
      exportContent += `${'-'.repeat(40)}\n`;
      exportContent += `${note.content}\n\n`;
      exportContent += `${'='.repeat(60)}\n\n`;
    });
    
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nursing_notes_${selectedPatient.mrn}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Notes exported successfully');
  };

  const handleShare = () => {
    toast.success('Sharing options coming soon');
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setAuthorFilter('');
    setDateFrom('');
    setDateTo('');
    setSearchInNotes('');
  };

  const saving = createNoteMutation.isPending;
  const canCreate = hasPermission('nursing.create');
  const canRead = hasPermission('nursing.read');

  return (
    <PermissionGate 
      permissions={['nursing.read']} 
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-120px)]">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">You don't have permission to view nursing notes.</p>
          </div>
        </div>
      }
    >
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
            <FileText className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Nursing Notes</h1>
              <p className="text-sm text-gray-500">Patient documentation and nursing notes</p>
            </div>
          </div>
          
          {saved && (
            <div className="ml-auto flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Note saved</span>
            </div>
          )}
          
          {/* Actions */}
          {selectedPatient && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Print notes"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={handleExport}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Export to PDF"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                title="Share with care team"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
          {/* Patient Selection Panel */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-teal-600" />
              Select Patient
            </h2>
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
            
            {/* Selected Patient Display */}
            {selectedPatient && !searchTerm && (
              <div className="mb-3 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-10 h-10 text-teal-600" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y {selectedPatient.gender}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                      <FileText className="w-3 h-3" />
                      {nursingNotes.length}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {(searchTerm ? filteredPatients : []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <UserCircle className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm text-center">
                    {searchTerm ? 'No patients found' : selectedPatient ? '' : 'Search for a patient'}
                  </p>
                </div>
              ) : (
                (searchTerm ? filteredPatients : []).map((patient) => (
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
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-8 h-8 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y {patient.gender}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Notes Display Panel */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
            {selectedPatient ? (
              <>
                {/* Action Bar */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                    <p className="text-sm text-gray-500">
                      {filteredNotes.length} of {nursingNotes.length} note(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Search in notes */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search in notes..."
                        value={searchInNotes}
                        onChange={(e) => setSearchInNotes(e.target.value)}
                        className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-48 focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    
                    {/* Filter Toggle */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                        showFilters || typeFilter !== 'all' || authorFilter || dateFrom || dateTo
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Filters
                      {(typeFilter !== 'all' || authorFilter || dateFrom || dateTo) && (
                        <span className="w-2 h-2 bg-teal-500 rounded-full" />
                      )}
                    </button>
                    
                    {/* Add Note Button */}
                    <PermissionGate permissions={['nursing.create']}>
                      <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Note
                      </button>
                    </PermissionGate>
                  </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-900">Filter Notes</h3>
                      <button
                        onClick={clearFilters}
                        className="text-sm text-teal-600 hover:text-teal-700"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Type Filter */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Note Type</label>
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="all">All Types</option>
                          {Object.entries(noteTypeConfig).map(([key, config]) => (
                            <option key={key} value={config.apiType}>{config.label}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Author Filter */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Author</label>
                        <select
                          value={authorFilter}
                          onChange={(e) => setAuthorFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        >
                          <option value="">All Authors</option>
                          {uniqueAuthors.map(author => (
                            <option key={author} value={author}>{author}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Date From */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">From Date</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      
                      {/* Date To */}
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">To Date</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Add New Note Form */}
                {showAddForm && canCreate && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900">New Nursing Note</h3>
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          resetNoteForm();
                        }}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Note Type Selection */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Note Type</label>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(noteTypeConfig).map(([key, config]) => {
                            const Icon = config.icon;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setSelectedNoteType(key as ExtendedNoteType);
                                  setShowDARFormat(false);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                  selectedNoteType === key
                                    ? 'bg-teal-600 text-white'
                                    : `${config.bgColor} ${config.color} hover:opacity-80`
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {config.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quick Actions Row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setShowTemplates(!showTemplates)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
                        >
                          <ClipboardList className="w-4 h-4" />
                          Templates
                        </button>
                        <button
                          onClick={() => setShowQuickPhrases(!showQuickPhrases)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
                        >
                          <Zap className="w-4 h-4" />
                          Quick Phrases
                        </button>
                        <button
                          onClick={() => {
                            setShowDARFormat(!showDARFormat);
                            if (!showDARFormat) {
                              setSelectedNoteType('progress');
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm ${
                            showDARFormat 
                              ? 'border-orange-500 bg-orange-50 text-orange-700' 
                              : 'border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          <Activity className="w-4 h-4" />
                          DAR Format
                        </button>
                        {voiceSupported && (
                          <button
                            onClick={toggleVoiceRecording}
                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm ${
                              isRecording
                                ? 'border-red-500 bg-red-50 text-red-700 animate-pulse'
                                : 'border-gray-300 hover:bg-gray-100'
                            }`}
                          >
                            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            {isRecording ? 'Stop' : 'Voice'}
                          </button>
                        )}
                        <label className="flex items-center gap-2 ml-auto">
                          <input
                            type="checkbox"
                            checked={isLateEntry}
                            onChange={(e) => setIsLateEntry(e.target.checked)}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-gray-600">Late Entry</span>
                        </label>
                      </div>

                      {/* Templates Dropdown */}
                      {showTemplates && (
                        <div className="p-3 bg-white border border-gray-200 rounded-lg">
                          <p className="text-xs font-medium text-gray-500 mb-2">SELECT TEMPLATE</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {noteTemplates.map(template => (
                              <button
                                key={template.id}
                                onClick={() => applyTemplate(template)}
                                className="p-2 text-left border border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-colors"
                              >
                                <p className="font-medium text-sm text-gray-900">{template.name}</p>
                                <p className="text-xs text-gray-500">{noteTypeConfig[template.type]?.label}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick Phrases Dropdown */}
                      {showQuickPhrases && (
                        <div className="p-3 bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                          <p className="text-xs font-medium text-gray-500 mb-2">QUICK PHRASES</p>
                          <div className="space-y-1">
                            {quickPhrases.map(phrase => (
                              <button
                                key={phrase.id}
                                onClick={() => insertQuickPhrase(phrase)}
                                className="w-full p-2 text-left border border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-colors"
                              >
                                <p className="font-medium text-sm text-gray-900">{phrase.label}</p>
                                <p className="text-xs text-gray-500 truncate">{phrase.text}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* DAR Format Fields */}
                      {showDARFormat ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded text-xs font-bold flex items-center justify-center">D</span>
                                Data - Objective & Subjective Findings
                              </span>
                            </label>
                            <textarea
                              rows={3}
                              value={darData.data}
                              onChange={(e) => setDarData({ ...darData, data: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-teal-500"
                              placeholder="Document patient data, observations, and assessment findings..."
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-5 h-5 bg-green-100 text-green-700 rounded text-xs font-bold flex items-center justify-center">A</span>
                                Action - What Was Done
                              </span>
                            </label>
                            <textarea
                              rows={3}
                              value={darData.action}
                              onChange={(e) => setDarData({ ...darData, action: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-teal-500"
                              placeholder="Document nursing interventions and actions taken..."
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-5 h-5 bg-purple-100 text-purple-700 rounded text-xs font-bold flex items-center justify-center">R</span>
                                Response - Patient's Response
                              </span>
                            </label>
                            <textarea
                              rows={3}
                              value={darData.response}
                              onChange={(e) => setDarData({ ...darData, response: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-teal-500"
                              placeholder="Document patient's response to interventions..."
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Rich Text Toolbar */}
                          <div className="flex items-center gap-1 p-2 bg-white border border-gray-200 rounded-t-lg">
                            <button
                              onClick={() => applyFormatting('bold')}
                              className="p-1.5 hover:bg-gray-100 rounded"
                              title="Bold"
                            >
                              <Bold className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => applyFormatting('italic')}
                              className="p-1.5 hover:bg-gray-100 rounded"
                              title="Italic"
                            >
                              <Italic className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => applyFormatting('list')}
                              className="p-1.5 hover:bg-gray-100 rounded"
                              title="Bullet List"
                            >
                              <List className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Note Content */}
                          <textarea
                            ref={textareaRef}
                            rows={6}
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 border-t-0 rounded-b-lg text-sm resize-none focus:ring-2 focus:ring-teal-500"
                            placeholder="Enter your nursing note..."
                          />
                        </>
                      )}

                      {/* Link to Intervention */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center gap-1">
                          <Link2 className="w-4 h-4" />
                          Link to Intervention/Care Plan (Optional)
                        </label>
                        <input
                          type="text"
                          value={linkedIntervention}
                          onChange={(e) => setLinkedIntervention(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="e.g., Pain Management Protocol, Wound Care Plan..."
                        />
                      </div>
                    </div>
                    
                    {/* Form Actions */}
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          resetNoteForm();
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || (!noteContent.trim() && !showDARFormat) || (showDARFormat && !darData.data.trim() && !darData.action.trim() && !darData.response.trim())}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Note
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Notes Timeline */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {notesLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filteredNotes.length > 0 ? (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                      
                      <div className="space-y-4">
                        {filteredNotes.map((note) => {
                          const config = Object.entries(noteTypeConfig).find(([_, c]) => c.apiType === note.type)?.[1] || 
                                        { label: note.type, color: 'text-gray-700', bgColor: 'bg-gray-100', icon: FileText };
                          const Icon = config.icon;
                          const noteDate = new Date(note.noteTime);
                          const isExpanded = expandedNotes.has(note.id);
                          const isLongNote = note.content.length > 200;
                          const displayContent = isExpanded || !isLongNote 
                            ? note.content 
                            : note.content.substring(0, 200) + '...';
                          const isLateEntry = note.content.includes('[LATE ENTRY]');
                          
                          return (
                            <div
                              key={note.id}
                              className="relative pl-10"
                            >
                              {/* Timeline dot */}
                              <div className={`absolute left-2 w-5 h-5 rounded-full ${config.bgColor} flex items-center justify-center ring-4 ring-white`}>
                                <Icon className={`w-3 h-3 ${config.color}`} />
                              </div>
                              
                              <div className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all">
                                {/* Note Header */}
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                                      <Tag className="w-3 h-3" />
                                      {config.label}
                                    </span>
                                    {isLateEntry && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
                                        <AlertCircle className="w-3 h-3" />
                                        Late Entry
                                      </span>
                                    )}
                                    {note.content.includes('[DAR FORMAT]') && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                        DAR
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {noteDate.toLocaleDateString()}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3.5 h-3.5" />
                                      {noteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Note Content */}
                                <div className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
                                  {displayContent.replace('[LATE ENTRY]\n\n', '').replace('[DAR FORMAT]\n\n', '')}
                                </div>
                                
                                {/* Expand/Collapse Button */}
                                {isLongNote && (
                                  <button
                                    onClick={() => toggleNoteExpand(note.id)}
                                    className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 mb-2"
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="w-4 h-4" />
                                        Show less
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-4 h-4" />
                                        Show full note
                                      </>
                                    )}
                                  </button>
                                )}
                                
                                {/* Note Footer */}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {note.nurse?.fullName || note.nurse?.firstName || 'Unknown'}
                                  </p>
                                  
                                  <PermissionGate permissions={['nursing.create']}>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          setAddendumNoteId(note.id);
                                          setAddendumContent('');
                                        }}
                                        className="text-xs text-gray-500 hover:text-teal-600 flex items-center gap-1"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5" />
                                        Add Addendum
                                      </button>
                                    </div>
                                  </PermissionGate>
                                </div>
                                
                                {/* Addendum Form */}
                                {addendumNoteId === note.id && (
                                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-sm font-medium text-amber-800 mb-2">Add Addendum</p>
                                    <textarea
                                      rows={3}
                                      value={addendumContent}
                                      onChange={(e) => setAddendumContent(e.target.value)}
                                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm resize-none mb-2"
                                      placeholder="Enter addendum..."
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button
                                        onClick={() => setAddendumNoteId(null)}
                                        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => {
                                          // For now, create as a new note referencing the original
                                          if (!admission?.id || !addendumContent.trim()) return;
                                          const addendumNote: CreateNursingNoteDto = {
                                            admissionId: admission.id,
                                            type: note.type as NursingNoteType,
                                            content: `[ADDENDUM to note from ${formatTimestamp(new Date(note.noteTime))}]\n\n${addendumContent}`,
                                          };
                                          createNoteMutation.mutate(addendumNote);
                                          setAddendumNoteId(null);
                                          setAddendumContent('');
                                        }}
                                        disabled={!addendumContent.trim()}
                                        className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                                      >
                                        Save Addendum
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="font-medium">No notes found</p>
                        <p className="text-sm text-gray-400">
                          {nursingNotes.length > 0 
                            ? 'Try adjusting your filters'
                            : 'Add the first nursing note for this patient'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="font-medium text-lg">Select a Patient</p>
                  <p className="text-sm text-gray-400">Search and select a patient to view their nursing notes</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}

// Extend Window interface for Speech Recognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
