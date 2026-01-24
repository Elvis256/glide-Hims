import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  Plus,
  Loader2,
  FileText,
  Stethoscope,
  ClipboardList,
  AlertCircle,
  FileCheck,
  X,
  Edit,
  Clock,
} from 'lucide-react';

interface ClinicalNote {
  id: string;
  encounterId: string;
  type: 'subjective' | 'objective' | 'assessment' | 'plan' | 'progress' | 'procedure' | 'consultation';
  content: string;
  diagnosis?: string;
  diagnosisCode?: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author?: { firstName: string; lastName: string };
}

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  subjective: { label: 'Subjective', icon: ClipboardList, color: 'bg-blue-100 text-blue-800' },
  objective: { label: 'Objective', icon: Stethoscope, color: 'bg-green-100 text-green-800' },
  assessment: { label: 'Assessment', icon: AlertCircle, color: 'bg-amber-100 text-amber-800' },
  plan: { label: 'Plan', icon: FileCheck, color: 'bg-purple-100 text-purple-800' },
  progress: { label: 'Progress Note', icon: FileText, color: 'bg-gray-100 text-gray-800' },
  procedure: { label: 'Procedure Note', icon: FileText, color: 'bg-red-100 text-red-800' },
  consultation: { label: 'Consultation', icon: FileText, color: 'bg-cyan-100 text-cyan-800' },
};

export default function ClinicalNotesPage() {
  const [searchParams] = useSearchParams();
  const encounterId = searchParams.get('encounterId');
  const patientId = searchParams.get('patientId');
  
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null);
  const [showSOAPModal, setShowSOAPModal] = useState(false);

  // Fetch notes for encounter
  const { data: notes, isLoading } = useQuery({
    queryKey: ['clinical-notes', encounterId],
    queryFn: async () => {
      if (!encounterId) return [];
      const response = await api.get(`/clinical-notes/encounter/${encounterId}`);
      return response.data as ClinicalNote[];
    },
    enabled: !!encounterId,
  });

  // Fetch patient history
  const { data: patientHistory } = useQuery({
    queryKey: ['clinical-notes-history', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const response = await api.get(`/clinical-notes/patient/${patientId}/history`);
      return response.data as ClinicalNote[];
    },
    enabled: !!patientId && !encounterId,
  });

  // Create/update note mutation
  const noteMutation = useMutation({
    mutationFn: (data: Partial<ClinicalNote>) => {
      if (editingNote) {
        return api.patch(`/clinical-notes/${editingNote.id}`, data);
      }
      return api.post('/clinical-notes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-notes'] });
      setShowModal(false);
      setEditingNote(null);
    },
  });

  // Create SOAP notes mutation
  const soapMutation = useMutation({
    mutationFn: (data: { 
      encounterId: string;
      subjective: string;
      objective: string;
      assessment: string;
      plan: string;
      diagnosis?: string;
      diagnosisCode?: string;
    }) => {
      // Create all 4 SOAP notes
      const promises = [
        api.post('/clinical-notes', { encounterId: data.encounterId, type: 'subjective', content: data.subjective }),
        api.post('/clinical-notes', { encounterId: data.encounterId, type: 'objective', content: data.objective }),
        api.post('/clinical-notes', { 
          encounterId: data.encounterId, 
          type: 'assessment', 
          content: data.assessment,
          diagnosis: data.diagnosis,
          diagnosisCode: data.diagnosisCode,
        }),
        api.post('/clinical-notes', { encounterId: data.encounterId, type: 'plan', content: data.plan }),
      ];
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical-notes'] });
      setShowSOAPModal(false);
    },
  });

  const handleNoteSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    noteMutation.mutate({
      encounterId: encounterId || formData.get('encounterId') as string,
      type: formData.get('type') as ClinicalNote['type'],
      content: formData.get('content') as string,
      diagnosis: formData.get('diagnosis') as string || undefined,
      diagnosisCode: formData.get('diagnosisCode') as string || undefined,
    });
  };

  const handleSOAPSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    soapMutation.mutate({
      encounterId: encounterId!,
      subjective: formData.get('subjective') as string,
      objective: formData.get('objective') as string,
      assessment: formData.get('assessment') as string,
      plan: formData.get('plan') as string,
      diagnosis: formData.get('diagnosis') as string || undefined,
      diagnosisCode: formData.get('diagnosisCode') as string || undefined,
    });
  };

  const displayNotes = encounterId ? notes : patientHistory;

  if (!encounterId && !patientId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Notes</h1>
          <p className="mt-1 text-sm text-gray-500">Document clinical observations and SOAP notes</p>
        </div>
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Patient Selected</h3>
          <p className="text-gray-500 mb-4">
            Navigate to this page from an encounter or patient record to view and create clinical notes.
          </p>
          <p className="text-sm text-gray-400">
            URL parameters: ?encounterId=xxx or ?patientId=xxx
          </p>
        </div>
      </div>
    );
  }

  // Group notes by type for SOAP display
  const soapNotes = {
    subjective: notes?.filter(n => n.type === 'subjective'),
    objective: notes?.filter(n => n.type === 'objective'),
    assessment: notes?.filter(n => n.type === 'assessment'),
    plan: notes?.filter(n => n.type === 'plan'),
    other: notes?.filter(n => !['subjective', 'objective', 'assessment', 'plan'].includes(n.type)),
  };

  const hasSOAPNotes = soapNotes.subjective?.length || soapNotes.objective?.length || 
                       soapNotes.assessment?.length || soapNotes.plan?.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Notes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {encounterId ? `Encounter: ${encounterId.slice(0, 8)}...` : `Patient History`}
          </p>
        </div>
        <div className="flex space-x-2">
          {encounterId && (
            <button
              onClick={() => setShowSOAPModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              <Stethoscope className="h-4 w-4 mr-2" />
              SOAP Note
            </button>
          )}
          <button
            onClick={() => {
              setEditingNote(null);
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : hasSOAPNotes ? (
        /* SOAP Format Display */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subjective */}
          <div className="bg-white shadow rounded-lg p-4 border-l-4 border-blue-500">
            <h3 className="font-medium text-blue-800 flex items-center">
              <ClipboardList className="h-5 w-5 mr-2" />
              Subjective
            </h3>
            <div className="mt-2 space-y-2">
              {soapNotes.subjective?.map((note) => (
                <div key={note.id} className="text-sm text-gray-700 p-2 bg-blue-50 rounded">
                  {note.content}
                  <div className="text-xs text-gray-400 mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              )) || <p className="text-sm text-gray-400 italic">No subjective notes</p>}
            </div>
          </div>

          {/* Objective */}
          <div className="bg-white shadow rounded-lg p-4 border-l-4 border-green-500">
            <h3 className="font-medium text-green-800 flex items-center">
              <Stethoscope className="h-5 w-5 mr-2" />
              Objective
            </h3>
            <div className="mt-2 space-y-2">
              {soapNotes.objective?.map((note) => (
                <div key={note.id} className="text-sm text-gray-700 p-2 bg-green-50 rounded">
                  {note.content}
                  <div className="text-xs text-gray-400 mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              )) || <p className="text-sm text-gray-400 italic">No objective notes</p>}
            </div>
          </div>

          {/* Assessment */}
          <div className="bg-white shadow rounded-lg p-4 border-l-4 border-amber-500">
            <h3 className="font-medium text-amber-800 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Assessment
            </h3>
            <div className="mt-2 space-y-2">
              {soapNotes.assessment?.map((note) => (
                <div key={note.id} className="text-sm text-gray-700 p-2 bg-amber-50 rounded">
                  {note.content}
                  {note.diagnosis && (
                    <div className="mt-1 text-xs font-medium text-amber-700">
                      Dx: {note.diagnosis} {note.diagnosisCode && `(${note.diagnosisCode})`}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              )) || <p className="text-sm text-gray-400 italic">No assessment notes</p>}
            </div>
          </div>

          {/* Plan */}
          <div className="bg-white shadow rounded-lg p-4 border-l-4 border-purple-500">
            <h3 className="font-medium text-purple-800 flex items-center">
              <FileCheck className="h-5 w-5 mr-2" />
              Plan
            </h3>
            <div className="mt-2 space-y-2">
              {soapNotes.plan?.map((note) => (
                <div key={note.id} className="text-sm text-gray-700 p-2 bg-purple-50 rounded">
                  {note.content}
                  <div className="text-xs text-gray-400 mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              )) || <p className="text-sm text-gray-400 italic">No plan notes</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-8 text-center text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No clinical notes recorded yet</p>
          <button
            onClick={() => setShowSOAPModal(true)}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Create SOAP Note
          </button>
        </div>
      )}

      {/* Other Notes */}
      {soapNotes.other && soapNotes.other.length > 0 && (
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-4">Additional Notes</h3>
          <div className="space-y-3">
            {soapNotes.other.map((note) => {
              const config = typeConfig[note.type] || typeConfig.progress;
              const Icon = config.icon;
              return (
                <div key={note.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(note.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{note.content}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Single Note Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingNote ? 'Edit Note' : 'Add Clinical Note'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleNoteSubmit} className="space-y-4">
                {!encounterId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Encounter ID</label>
                    <input
                      type="text"
                      name="encounterId"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Note Type</label>
                  <select
                    name="type"
                    defaultValue={editingNote?.type || 'progress'}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="subjective">Subjective</option>
                    <option value="objective">Objective</option>
                    <option value="assessment">Assessment</option>
                    <option value="plan">Plan</option>
                    <option value="progress">Progress Note</option>
                    <option value="procedure">Procedure Note</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Content</label>
                  <textarea
                    name="content"
                    required
                    rows={6}
                    defaultValue={editingNote?.content}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter clinical observations..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Diagnosis (optional)</label>
                    <input
                      type="text"
                      name="diagnosis"
                      defaultValue={editingNote?.diagnosis}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="e.g., Malaria"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ICD-10 Code</label>
                    <input
                      type="text"
                      name="diagnosisCode"
                      defaultValue={editingNote?.diagnosisCode}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="e.g., B50.9"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={noteMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {noteMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SOAP Note Modal */}
      {showSOAPModal && encounterId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowSOAPModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">SOAP Note</h3>
                <button onClick={() => setShowSOAPModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSOAPSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700">
                    <ClipboardList className="h-4 w-4 inline mr-1" />
                    Subjective
                  </label>
                  <textarea
                    name="subjective"
                    required
                    rows={3}
                    className="mt-1 block w-full border border-blue-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Chief complaint, history of present illness, patient's symptoms..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-green-700">
                    <Stethoscope className="h-4 w-4 inline mr-1" />
                    Objective
                  </label>
                  <textarea
                    name="objective"
                    required
                    rows={3}
                    className="mt-1 block w-full border border-green-300 rounded-md shadow-sm py-2 px-3 focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Vital signs, physical examination findings, lab results..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-amber-700">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Assessment
                  </label>
                  <textarea
                    name="assessment"
                    required
                    rows={3}
                    className="mt-1 block w-full border border-amber-300 rounded-md shadow-sm py-2 px-3 focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                    placeholder="Diagnosis, clinical impression, differential diagnoses..."
                  />
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <input
                        type="text"
                        name="diagnosis"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="Primary Diagnosis"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="diagnosisCode"
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="ICD-10 Code"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-purple-700">
                    <FileCheck className="h-4 w-4 inline mr-1" />
                    Plan
                  </label>
                  <textarea
                    name="plan"
                    required
                    rows={3}
                    className="mt-1 block w-full border border-purple-300 rounded-md shadow-sm py-2 px-3 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    placeholder="Treatment plan, medications, follow-up instructions..."
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSOAPModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={soapMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {soapMutation.isPending ? 'Saving...' : 'Save SOAP Note'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
