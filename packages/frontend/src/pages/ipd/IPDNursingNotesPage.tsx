import { useState, useMemo } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Search,
  Plus,
  User,
  Clock,
  Thermometer,
  Heart,
  Activity,
  Droplets,
  Wind,
  Pill,
  CheckCircle,
  AlertCircle,
  FileText,
  Calendar,
  Bed,
  Edit,
  TrendingUp,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import api, { getApiErrorMessage } from '../../services/api';

interface Admission {
  id: string;
  admissionNumber: string;
  status: string;
  admissionDate: string;
  admissionDiagnosis?: string;
  patient: {
    id: string;
    fullName: string;
    dateOfBirth?: string;
    gender?: string;
  };
  // GET /ipd/admissions joins `ward` at the top level (not bed.ward)
  ward?: {
    id: string;
    name: string;
  };
  bed?: {
    id: string;
    bedNumber: string;
  };
}

// Mirrors NursingNote entity: `type` (lowercase enum), `noteTime`, `nurse`
interface NursingNote {
  id: string;
  createdAt: string;
  noteTime?: string;
  shift: string;
  type: string;
  content: string;
  nurse?: { fullName: string };
}

// Mirrors MedicationAdministration entity
interface MedicationAdmin {
  id: string;
  drugName: string;
  dose: string;
  route: string;
  scheduledTime: string;
  administeredAt?: string;
  status: string; // scheduled | administered | held | refused | missed
  administeredBy?: { fullName: string };
  notes?: string;
}

const NOTE_TYPES = ['assessment', 'intervention', 'observation', 'progress', 'handoff', 'incident'] as const;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export default function IPDNursingNotesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'vitals' | 'medications' | 'carePlan'>('notes');
  const [selectedShift, setSelectedShift] = useState<string>('All');
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const showAddNoteModalDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!showAddNoteModal,
    onClose: () => setShowAddNoteModal(false),
  });
  const [newNote, setNewNote] = useState({
    shift: 'Day',
    noteType: 'assessment',
    content: '',
  });

  // Fetch active admissions
  const { data: admissions = [], isLoading: loadingAdmissions } = useQuery({
    queryKey: ['ipd-admissions-active'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'admitted' } });
      return (res.data?.data || res.data) as Admission[];
    },
  });

  // Fetch nursing notes for selected admission
  const { data: nursingNotes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ['nursing-notes', selectedAdmission?.id],
    queryFn: async () => {
      if (!selectedAdmission?.id) return [];
      const res = await api.get(`/ipd/admissions/${selectedAdmission.id}/nursing-notes`);
      return res.data as NursingNote[];
    },
    enabled: !!selectedAdmission?.id,
  });

  // Fetch medications for selected admission
  const { data: medications = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medications', selectedAdmission?.id],
    queryFn: async () => {
      if (!selectedAdmission?.id) return [];
      const res = await api.get(`/ipd/admissions/${selectedAdmission.id}/medications`);
      return res.data as MedicationAdmin[];
    },
    enabled: !!selectedAdmission?.id,
  });

  // Create nursing note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: typeof newNote) => {
      if (!selectedAdmission?.id) throw new Error('No admission selected');
      await api.post('/ipd/nursing-notes', {
        admissionId: selectedAdmission.id,
        type: data.noteType as any,
        content: data.content,
        shift: data.shift,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes', selectedAdmission?.id] });
      setShowAddNoteModal(false);
      setNewNote({ shift: 'Day', noteType: 'assessment', content: '' });
      toast.success('Nursing note saved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save note')),
  });

  // Administer a scheduled medication
  const administerMutation = useMutation({
    mutationFn: (medicationId: string) =>
      api.put(`/ipd/medications/${medicationId}/administer`, { status: 'administered' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications', selectedAdmission?.id] });
      toast.success('Medication recorded as administered');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record administration')),
  });

  const filteredAdmissions = useMemo(() => {
    return admissions.filter(
      (a) =>
        `${a.patient.fullName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.bed?.bedNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, admissions]);

  const filteredNotes = useMemo(() => {
    if (selectedShift === 'All') return nursingNotes;
    return nursingNotes.filter((n) => n.shift === selectedShift);
  }, [nursingNotes, selectedShift]);

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      assessment: 'bg-blue-100 text-blue-700',
      intervention: 'bg-green-100 text-green-700',
      observation: 'bg-purple-100 text-purple-700',
      progress: 'bg-yellow-100 text-yellow-700',
      handoff: 'bg-orange-100 text-orange-700',
      incident: 'bg-red-100 text-red-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  const getMedStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-yellow-100 text-yellow-700',
      administered: 'bg-green-100 text-green-700',
      held: 'bg-orange-100 text-orange-700',
      refused: 'bg-red-100 text-red-700',
      missed: 'bg-gray-200 text-gray-700',
    };
    return colors[status?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const getAge = (dob?: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return `${age}y`;
  };

  if (loadingAdmissions) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-pink-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          ref={showAddNoteModalDialogRef}
        >
          <div className="bg-white rounded-xl p-6 w-[500px] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Add Nursing Note</h2>
              <button onClick={() => setShowAddNoteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                  <select
                    value={newNote.shift}
                    onChange={(e) => setNewNote({ ...newNote, shift: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="Day">Day</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newNote.noteType}
                    onChange={(e) => setNewNote({ ...newNote, noteType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  >
                    {NOTE_TYPES.map((t) => (
                      <option key={t} value={t}>{cap(t)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
                  placeholder="Enter nursing note..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowAddNoteModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createNoteMutation.mutate(newNote)}
                  disabled={!newNote.content || createNoteMutation.isPending}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {createNoteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-100 rounded-lg">
            <ClipboardList className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IPD Nursing Notes</h1>
            <p className="text-sm text-gray-500">Patient care documentation and observations</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Patient List */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {filteredAdmissions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <User className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-medium">No patients found</p>
                <p className="text-sm">Patient nursing notes will appear here</p>
              </div>
            ) : (
            <div className="space-y-3">
              {filteredAdmissions.map((admission) => (
                <div
                  key={admission.id}
                  onClick={() => setSelectedAdmission(admission)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedAdmission?.id === admission.id
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{admission.patient.fullName}</p>
                      <p className="text-sm text-gray-500">{getAge(admission.patient.dateOfBirth)}, {admission.patient.gender || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Bed className="w-4 h-4" />
                    <span>{admission.bed?.bedNumber || 'No bed'} • {admission.ward?.name || 'No ward'}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{admission.admissionDiagnosis || 'No diagnosis'}</p>
                  <p className="text-xs text-gray-400 mt-1">#{admission.admissionNumber}</p>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        {selectedAdmission ? (
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex items-center gap-2 p-4 border-b border-gray-200">
              {[
                { key: 'notes', label: 'Nursing Notes', icon: <FileText className="w-4 h-4" /> },
                { key: 'medications', label: 'Medications', icon: <Pill className="w-4 h-4" /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-pink-100 text-pink-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              <div className="flex-1" />
              <button 
                onClick={() => setShowAddNoteModal(true)}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Note
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-6">
              {activeTab === 'notes' && (
                <div>
                  {/* Shift Filter */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-gray-500">Filter by shift:</span>
                    {(['All', 'Day', 'Evening', 'Night'] as const).map((shift) => (
                      <button
                        key={shift}
                        onClick={() => setSelectedShift(shift)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedShift === shift
                            ? 'bg-pink-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {shift}
                      </button>
                    ))}
                  </div>

                  {/* Notes List */}
                  {loadingNotes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-pink-600" />
                    </div>
                  ) : filteredNotes.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p>No nursing notes yet</p>
                      <button 
                        onClick={() => setShowAddNoteModal(true)}
                        className="mt-2 text-pink-600 hover:text-pink-700"
                      >
                        Add the first note
                      </button>
                    </div>
                  ) : (
                  <div className="space-y-4">
                    {filteredNotes.map((note) => (
                      <div key={note.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              {new Date(note.createdAt).toLocaleString()}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryBadge(note.type)}`}>
                              {cap(note.type)}
                            </span>
                            {note.shift && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                {note.shift} Shift
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-700 mb-2">{note.content}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <User className="w-4 h-4" />
                          <span>{note.nurse ? `${note.nurse.fullName}` : 'Unknown'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}

              {activeTab === 'medications' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Medication Administration Record (MAR)</h3>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
                        <CheckCircle className="w-4 h-4" />
                        Administered
                      </span>
                      <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                        <Clock className="w-4 h-4" />
                        Scheduled
                      </span>
                    </div>
                  </div>

                  {loadingMeds ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-pink-600" />
                    </div>
                  ) : medications.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">
                      <Pill className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p>No medications scheduled</p>
                    </div>
                  ) : (
                  <div className="space-y-3">
                    {medications.map((med) => (
                      <div key={med.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-lg ${med.status === 'administered' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                              <Pill className={`w-5 h-5 ${med.status === 'administered' ? 'text-green-600' : 'text-yellow-600'}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{med.drugName}</p>
                              <p className="text-sm text-gray-500">{med.dose} • {med.route}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-gray-500">Scheduled: {new Date(med.scheduledTime).toLocaleTimeString()}</p>
                              {med.administeredAt && (
                                <p className="text-sm text-green-600">Given: {new Date(med.administeredAt).toLocaleTimeString()}</p>
                              )}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getMedStatusBadge(med.status)}`}>
                              {med.status}
                            </span>
                            {med.status === 'scheduled' && (
                              <button
                                onClick={() => administerMutation.mutate(med.id)}
                                disabled={administerMutation.isPending}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                              >
                                Administer
                              </button>
                            )}
                          </div>
                        </div>
                        {med.administeredBy && (
                          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                            <User className="w-4 h-4" />
                            <span>Administered by {med.administeredBy.fullName}</span>
                            {med.notes && <span className="text-gray-400">• {med.notes}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-500">
            <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
            <p className="font-medium text-lg">Select a patient</p>
            <p className="text-sm">Choose a patient from the list to view nursing documentation</p>
          </div>
        )}
      </div>
    </div>
  );
}
