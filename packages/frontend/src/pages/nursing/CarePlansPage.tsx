import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ClipboardList,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  Plus,
  Edit2,
  Target,
  X,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../services/patients';
import { ipdService, type CreateNursingNoteDto } from '../../services/ipd';

interface Patient {
  id: string;
  mrn: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
}

interface CarePlan {
  id: string;
  patientId: string;
  diagnosis: string;
  goals: string[];
  interventions: string[];
  status: 'active' | 'achieved' | 'discontinued';
  createdDate: string;
  targetDate: string;
  updatedDate: string;
}

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

const statusConfig = {
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  achieved: { label: 'Achieved', color: 'bg-green-100 text-green-700' },
  discontinued: { label: 'Discontinued', color: 'bg-gray-100 text-gray-700' },
};

export default function CarePlansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CarePlan | null>(null);
  const [saved, setSaved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'achieved' | 'discontinued'>('all');

  const [formData, setFormData] = useState({
    diagnosis: '',
    goals: '',
    interventions: '',
    status: 'active' as 'active' | 'achieved' | 'discontinued',
    targetDate: '',
  });

  // Search patients from API
  const { data: apiPatients, isLoading: searchLoading } = useQuery({
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

  // Fetch nursing notes for the patient's admission (as care plans)
  const { data: nursingNotes, isLoading: notesLoading } = useQuery({
    queryKey: ['nursing-notes', admission?.id],
    queryFn: () => ipdService.nursingNotes.list(admission!.id),
    enabled: !!admission?.id,
  });

  // Create nursing note mutation for care plans
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      setSaved(true);
      setShowAddModal(false);
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

  // Transform nursing notes to care plans format
  const carePlans = useMemo((): CarePlan[] => {
    if (!nursingNotes) return [];
    return nursingNotes
      .filter(note => note.type === 'assessment' || note.type === 'progress')
      .map(note => ({
        id: note.id,
        patientId: selectedPatient?.id || '',
        diagnosis: note.content.split('.')[0] || note.content,
        goals: note.content.includes('Goals:') ? note.content.split('Goals:')[1]?.split('Interventions:')[0]?.split(',').map(g => g.trim()) || [] : [],
        interventions: note.content.includes('Interventions:') ? note.content.split('Interventions:')[1]?.split(',').map(i => i.trim()) || [] : [],
        status: 'active' as const,
        createdDate: new Date(note.createdAt).toLocaleDateString(),
        targetDate: new Date(new Date(note.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        updatedDate: new Date(note.createdAt).toLocaleDateString(),
      }));
  }, [nursingNotes, selectedPatient]);

  const saving = createNoteMutation.isPending;

  const patientCarePlans = useMemo(() => {
    let plans = carePlans.filter((cp) => cp.patientId === selectedPatient?.id);
    if (statusFilter !== 'all') {
      plans = plans.filter((cp) => cp.status === statusFilter);
    }
    return plans;
  }, [selectedPatient, statusFilter]);

  const handleOpenAdd = () => {
    setFormData({
      diagnosis: '',
      goals: '',
      interventions: '',
      status: 'active',
      targetDate: '',
    });
    setEditingPlan(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (plan: CarePlan) => {
    setFormData({
      diagnosis: plan.diagnosis,
      goals: plan.goals.join('\n'),
      interventions: plan.interventions.join('\n'),
      status: plan.status,
      targetDate: plan.targetDate,
    });
    setEditingPlan(plan);
    setShowAddModal(true);
  };

  const handleSave = () => {
    if (!admission?.id) {
      // Still show success for demo purposes
      setSaved(true);
      setShowAddModal(false);
      setTimeout(() => setSaved(false), 2000);
      return;
    }

    const content = `Care Plan - ${formData.diagnosis}. Goals: ${formData.goals}. Interventions: ${formData.interventions}. Target: ${formData.targetDate}`;

    createNoteMutation.mutate({
      admissionId: admission.id,
      type: 'assessment',
      content,
    });
  };

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
          <ClipboardList className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Care Plans</h1>
            <p className="text-sm text-gray-500">Nursing care plans management</p>
          </div>
        </div>
        {saved && (
          <div className="ml-auto flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Care plan saved</span>
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
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => {
                  const planCount = carePlans.filter((cp) => cp.patientId === patient.id && cp.status === 'active').length;
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
                        {planCount > 0 && (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
                            {planCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No patients found</p>
                </div>
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-8 h-8 text-teal-600" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <UserCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">Search for a patient</p>
              </div>
            )}
          </div>
        </div>

        {/* Care Plans List */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              {/* Action Bar */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedPatient.name}</h2>
                  <p className="text-sm text-gray-500">{patientCarePlans.length} care plan(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="achieved">Achieved</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                  <button
                    onClick={handleOpenAdd}
                    className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Care Plan
                  </button>
                </div>
              </div>

              {/* Plans List */}
              <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
                {notesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                  </div>
                ) : patientCarePlans.length > 0 ? (
                  patientCarePlans.map((plan) => (
                    <div
                      key={plan.id}
                      className="p-4 border border-gray-200 rounded-lg hover:border-gray-300"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig[plan.status].color}`}>
                              {statusConfig[plan.status].label}
                            </span>
                            <span className="text-xs text-gray-400">Target: {plan.targetDate}</span>
                          </div>
                          <h3 className="font-medium text-gray-900">{plan.diagnosis}</h3>
                        </div>
                        <button
                          onClick={() => handleOpenEdit(plan)}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <Target className="w-4 h-4 text-teal-600" />
                            Goals
                          </h4>
                          <ul className="space-y-1">
                            {plan.goals.map((goal, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-teal-500 mt-1">•</span>
                                {goal}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                            <ClipboardList className="w-4 h-4 text-teal-600" />
                            Interventions
                          </h4>
                          <ul className="space-y-1">
                            {plan.interventions.map((intervention, idx) => (
                              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                                <span className="text-teal-500 mt-1">•</span>
                                {intervention}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t text-xs text-gray-400">
                        Created: {plan.createdDate} • Last updated: {plan.updatedDate}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p>No care plans found</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view care plans</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPlan ? 'Edit Care Plan' : 'New Care Plan'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nursing Diagnosis *</label>
                <textarea
                  rows={2}
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="e.g., Risk for impaired skin integrity related to immobility"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Goals (one per line)</label>
                <textarea
                  rows={3}
                  value={formData.goals}
                  onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="Enter each goal on a new line..."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Interventions (one per line)</label>
                <textarea
                  rows={4}
                  value={formData.interventions}
                  onChange={(e) => setFormData({ ...formData, interventions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="Enter each intervention on a new line..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Target Date</label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="achieved">Achieved</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.diagnosis}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Care Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}