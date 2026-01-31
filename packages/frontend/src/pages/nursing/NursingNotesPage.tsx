import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { ipdService, type CreateNursingNoteDto, type NursingNoteType } from '../../services/ipd';

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

const categoryConfig: Record<string, { label: string; color: string; noteType: NursingNoteType }> = {
  assessment: { label: 'Assessment', color: 'bg-blue-100 text-blue-700', noteType: 'assessment' },
  intervention: { label: 'Intervention', color: 'bg-green-100 text-green-700', noteType: 'intervention' },
  observation: { label: 'Observation', color: 'bg-purple-100 text-purple-700', noteType: 'observation' },
  progress: { label: 'Progress', color: 'bg-orange-100 text-orange-700', noteType: 'progress' },
  handoff: { label: 'Handoff', color: 'bg-yellow-100 text-yellow-700', noteType: 'handoff' },
  incident: { label: 'Incident', color: 'bg-red-100 text-red-700', noteType: 'incident' },
};

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

export default function NursingNotesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [newNote, setNewNote] = useState({
    category: 'observation' as keyof typeof categoryConfig,
    content: '',
  });

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
      setNewNote({ category: 'observation', content: '' });
      setTimeout(() => setSaved(false), 2000);
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

  const patientNotes = useMemo(() => {
    let notes = [...nursingNotes];
    if (categoryFilter !== 'all') {
      notes = notes.filter((n) => n.type === categoryFilter);
    }
    return notes.sort((a, b) => new Date(b.noteTime).getTime() - new Date(a.noteTime).getTime());
  }, [nursingNotes, categoryFilter]);

  const handleSave = () => {
    if (!admission?.id || !newNote.content.trim()) return;

    const noteData: CreateNursingNoteDto = {
      admissionId: admission.id,
      type: categoryConfig[newNote.category]?.noteType || 'observation',
      content: newNote.content,
    };

    createNoteMutation.mutate(noteData);
  };

  const saving = createNoteMutation.isPending;

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
          <FileText className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Nursing Notes</h1>
            <p className="text-sm text-gray-500">Patient documentation and notes</p>
          </div>
        </div>
        {saved && (
          <div className="ml-auto flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Note saved</span>
          </div>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {(searchTerm ? filteredPatients : []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <UserCircle className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-sm">{searchTerm ? 'No patients found' : selectedPatient ? '' : 'Search for a patient'}</p>
              </div>
            ) : (searchTerm ? filteredPatients : []).map((patient) => {
              const noteCount = 0; // Note count not easily accessible without patient-specific query
              return (
                <button
                  key={patient.id}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedPatient?.id === patient.id
                      ? 'border-teal-500 bg-teal-50'
                      : 'border-gray-200 hover:border-teal-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-8 h-8 text-gray-400" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                      <p className="text-xs text-gray-500">{patient.mrn}</p>
                    </div>
                    {noteCount > 0 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                        {noteCount}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes Display */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">{patientNotes.length} note(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Categories</option>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Note
                  </button>
                </div>
              </div>

              {/* Add New Note Form */}
              {showAddForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3">New Nursing Note</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(categoryConfig).map(([key, config]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setNewNote({ ...newNote, category: key as keyof typeof categoryConfig })}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                              newNote.category === key
                                ? 'bg-teal-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {config.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1 block">Note Content</label>
                      <textarea
                        rows={4}
                        value={newNote.content}
                        onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                        placeholder="Enter your nursing note..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !newNote.content.trim()}
                      className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
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

              {/* Notes List */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {patientNotes.length > 0 ? (
                  <div className="space-y-4">
                    {patientNotes.map((note) => {
                      const category = categoryConfig[note.type] || { label: note.type, color: 'bg-gray-100 text-gray-700' };
                      const noteDate = new Date(note.noteTime);
                      const dateStr = noteDate.toLocaleDateString();
                      const timeStr = noteDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div
                          key={note.id}
                          className="p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${category.color}`}>
                                <Tag className="w-3 h-3" />
                                {category.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <Calendar className="w-4 h-4" />
                              <span>{dateStr}</span>
                              <Clock className="w-4 h-4 ml-2" />
                              <span>{timeStr}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{note.content}</p>
                          <p className="text-xs text-gray-400">— {note.nurse?.fullName || note.nurse?.firstName || 'Unknown'}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No notes found</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view notes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
