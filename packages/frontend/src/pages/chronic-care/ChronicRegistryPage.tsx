import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ClipboardList,
  Search,
  Plus,
  Filter,
  Eye,
  Edit2,
  Loader2,
  X,
  Save,
  User,
  Calendar,
  Pill,
  Activity,
  Heart,
  Phone,
  Mail,
  FileText,
  ChevronDown,
  Check,
} from 'lucide-react';
import { chronicCareService } from '../../services/chronic-care';
import type { ChronicPatient, ChronicStatus, ChronicCondition } from '../../services/chronic-care';
import { useFacilityId } from '../../lib/facility';
import api from '../../services/api';

const statusColors: Record<ChronicStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Active' },
  controlled: { bg: 'bg-green-100', text: 'text-green-700', label: 'Controlled' },
  uncontrolled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Uncontrolled' },
  in_remission: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Remission' },
  resolved: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Resolved' },
};

const commonConditions = [
  { code: 'E11', name: 'Type 2 Diabetes Mellitus' },
  { code: 'I10', name: 'Essential Hypertension' },
  { code: 'J45', name: 'Asthma' },
  { code: 'J44', name: 'COPD' },
  { code: 'N18', name: 'Chronic Kidney Disease' },
  { code: 'K74', name: 'Chronic Liver Disease' },
  { code: 'I25', name: 'Chronic Ischemic Heart Disease' },
  { code: 'G20', name: 'Parkinson\'s Disease' },
  { code: 'M05', name: 'Rheumatoid Arthritis' },
  { code: 'B20', name: 'HIV Disease' },
  { code: 'C50', name: 'Breast Cancer' },
  { code: 'G35', name: 'Multiple Sclerosis' },
];

export default function ChronicRegistryPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChronicStatus | 'all'>('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<ChronicPatient | null>(null);
  const [viewPatient, setViewPatient] = useState<ChronicPatient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const [formData, setFormData] = useState({
    patientId: '',
    diagnosisId: '',
    diagnosedDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'active' as ChronicStatus,
    nextFollowUp: '',
    followUpIntervalDays: 30,
    reminderEnabled: true,
    currentMedications: [] as string[],
    notes: '',
  });

  // Fetch conditions
  const { data: conditions = [] } = useQuery({
    queryKey: ['chronic-conditions'],
    queryFn: () => chronicCareService.getConditionsList(),
  });

  // Use common conditions if API returns empty
  const conditionsList = conditions.length > 0 ? conditions : commonConditions.map(c => ({ id: c.code, ...c }));

  // Fetch patients
  const { data: patientsData, isLoading } = useQuery({
    queryKey: ['chronic-patients', facilityId, searchTerm, statusFilter, conditionFilter],
    queryFn: () => chronicCareService.getPatients(facilityId, {
      search: searchTerm || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      diagnosisId: conditionFilter !== 'all' ? conditionFilter : undefined,
      limit: 200,
    }),
    enabled: !!facilityId,
  });

  // Search patients for enrollment
  const { data: searchResults = [] } = useQuery({
    queryKey: ['patient-search', patientSearch],
    queryFn: async () => {
      if (patientSearch.length < 2) return [];
      const { data } = await api.get('/patients', { params: { search: patientSearch, limit: 10 } });
      return data.data || data || [];
    },
    enabled: patientSearch.length >= 2,
  });

  const patients = patientsData?.data || [];

  const registerMutation = useMutation({
    mutationFn: (data: typeof formData) => chronicCareService.register(facilityId, {
      ...data,
      currentMedications: data.currentMedications.filter(m => m.trim()),
    }),
    onSuccess: () => {
      toast.success('Patient enrolled in chronic care program');
      queryClient.invalidateQueries({ queryKey: ['chronic-patients'] });
      closeModal();
    },
    onError: () => toast.error('Failed to enroll patient'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) => 
      chronicCareService.update(id, data),
    onSuccess: () => {
      toast.success('Patient record updated');
      queryClient.invalidateQueries({ queryKey: ['chronic-patients'] });
      closeModal();
    },
    onError: () => toast.error('Failed to update'),
  });

  const openModal = (patient?: ChronicPatient) => {
    if (patient) {
      setEditingPatient(patient);
      setSelectedPatient(patient.patient);
      setFormData({
        patientId: patient.patientId,
        diagnosisId: patient.diagnosis.id || patient.diagnosis.icd10Code,
        diagnosedDate: format(new Date(patient.diagnosedDate), 'yyyy-MM-dd'),
        status: patient.status,
        nextFollowUp: patient.nextFollowUp ? format(new Date(patient.nextFollowUp), 'yyyy-MM-dd') : '',
        followUpIntervalDays: patient.followUpIntervalDays,
        reminderEnabled: patient.reminderEnabled,
        currentMedications: patient.currentMedications || [],
        notes: patient.notes || '',
      });
    } else {
      setEditingPatient(null);
      setSelectedPatient(null);
      setFormData({
        patientId: '',
        diagnosisId: '',
        diagnosedDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'active',
        nextFollowUp: '',
        followUpIntervalDays: 30,
        reminderEnabled: true,
        currentMedications: [],
        notes: '',
      });
    }
    setPatientSearch('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPatient(null);
    setSelectedPatient(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPatient) {
      updateMutation.mutate({ id: editingPatient.id, data: formData });
    } else {
      registerMutation.mutate(formData);
    }
  };

  const addMedication = () => {
    setFormData(prev => ({ ...prev, currentMedications: [...prev.currentMedications, ''] }));
  };

  const updateMedication = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      currentMedications: prev.currentMedications.map((m, i) => i === index ? value : m),
    }));
  };

  const removeMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      currentMedications: prev.currentMedications.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <ClipboardList className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Chronic Care Registry</h1>
            <p className="text-sm text-gray-500">Enroll and manage chronic disease patients</p>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
        >
          <Plus className="w-4 h-4" />
          Enroll Patient
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(statusColors).map(([key, val]) => {
          const count = patients.filter(p => p.status === key).length;
          return (
            <div key={key} className={`bg-white rounded-lg border p-4 ${statusFilter === key ? 'ring-2 ring-rose-500' : ''}`}>
              <button
                onClick={() => setStatusFilter(statusFilter === key ? 'all' : key as ChronicStatus)}
                className="w-full text-left"
              >
                <p className="text-sm text-gray-500">{val.label}</p>
                <p className={`text-2xl font-bold ${val.text}`}>{count}</p>
              </button>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, MRN, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Conditions</option>
          {conditionsList.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ChronicStatus | 'all')}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Statuses</option>
          {Object.entries(statusColors).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No chronic care patients found</p>
            <button
              onClick={() => openModal()}
              className="mt-4 text-rose-600 hover:underline"
            >
              Enroll your first patient
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diagnosed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Follow-up</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {patients.map((patient) => {
                const status = statusColors[patient.status];
                const isOverdue = patient.nextFollowUp && new Date(patient.nextFollowUp) < new Date();
                return (
                  <tr key={patient.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{patient.patient.fullName}</div>
                      <div className="text-xs text-gray-500">MRN: {patient.patient.mrn}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-rose-600">{patient.diagnosis.name}</div>
                      <div className="text-xs text-gray-500">{patient.diagnosis.icd10Code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {format(new Date(patient.diagnosedDate), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {patient.nextFollowUp ? (
                        <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {format(new Date(patient.nextFollowUp), 'dd/MM/yyyy')}
                          {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not scheduled</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {patient.patient.phone && (
                          <a href={`tel:${patient.patient.phone}`} className="text-green-600 hover:text-green-800">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {patient.patient.email && (
                          <a href={`mailto:${patient.patient.email}`} className="text-blue-600 hover:text-blue-800">
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewPatient(patient)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => openModal(patient)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Enroll/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingPatient ? 'Edit Chronic Care Record' : 'Enroll Patient in Chronic Care'}
              </h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Patient Selection */}
              {!editingPatient && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Patient *</label>
                  {selectedPatient ? (
                    <div className="flex items-center justify-between bg-rose-50 rounded-lg p-3">
                      <div>
                        <p className="font-medium">{selectedPatient.fullName}</p>
                        <p className="text-sm text-gray-600">MRN: {selectedPatient.mrn}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(null);
                          setFormData(prev => ({ ...prev, patientId: '' }));
                        }}
                        className="text-rose-600 hover:text-rose-800"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search by name, MRN, or phone..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg"
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {searchResults.map((p: any) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedPatient(p);
                                setFormData(prev => ({ ...prev, patientId: p.id }));
                                setPatientSearch('');
                              }}
                              className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium">{p.fullName}</p>
                                <p className="text-sm text-gray-500">MRN: {p.mrn}</p>
                              </div>
                              <Check className="w-4 h-4 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {editingPatient && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium">{editingPatient.patient.fullName}</p>
                  <p className="text-sm text-gray-600">MRN: {editingPatient.patient.mrn}</p>
                </div>
              )}

              {/* Condition */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chronic Condition *</label>
                  <select
                    value={formData.diagnosisId}
                    onChange={(e) => setFormData(prev => ({ ...prev, diagnosisId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select condition...</option>
                    {conditionsList.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.icd10Code || c.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Diagnosed *</label>
                  <input
                    type="date"
                    value={formData.diagnosedDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, diagnosedDate: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ChronicStatus }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    {Object.entries(statusColors).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Interval (days)</label>
                  <input
                    type="number"
                    value={formData.followUpIntervalDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, followUpIntervalDays: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    min="1"
                  />
                </div>
              </div>

              {/* Next Follow-up */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next Follow-up Date</label>
                  <input
                    type="date"
                    value={formData.nextFollowUp}
                    onChange={(e) => setFormData(prev => ({ ...prev, nextFollowUp: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.reminderEnabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                      className="rounded border-gray-300 text-rose-600"
                    />
                    <span className="text-sm">Enable automatic reminders</span>
                  </label>
                </div>
              </div>

              {/* Medications */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Current Medications</label>
                  <button
                    type="button"
                    onClick={addMedication}
                    className="text-sm text-rose-600 hover:text-rose-800"
                  >
                    + Add Medication
                  </button>
                </div>
                {formData.currentMedications.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No medications added</p>
                ) : (
                  <div className="space-y-2">
                    {formData.currentMedications.map((med, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Pill className="w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={med}
                          onChange={(e) => updateMedication(idx, e.target.value)}
                          placeholder="e.g., Metformin 500mg twice daily"
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeMedication(idx)}
                          className="p-1 hover:bg-red-50 rounded text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Additional notes about the patient's condition..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending || updateMutation.isPending || (!editingPatient && !formData.patientId)}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
                >
                  {(registerMutation.isPending || updateMutation.isPending) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingPatient ? 'Update' : 'Enroll Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Patient Modal */}
      {viewPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Patient Details</h2>
              <button onClick={() => setViewPatient(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-100 rounded-full">
                  <User className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{viewPatient.patient.fullName}</h3>
                  <p className="text-gray-500">MRN: {viewPatient.patient.mrn}</p>
                </div>
              </div>

              <div className="bg-rose-50 rounded-lg p-4">
                <h4 className="font-medium text-rose-800 mb-2">Chronic Condition</h4>
                <p className="font-medium">{viewPatient.diagnosis.name}</p>
                <p className="text-sm text-gray-600">ICD-10: {viewPatient.diagnosis.icd10Code}</p>
                <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${statusColors[viewPatient.status].bg} ${statusColors[viewPatient.status].text}`}>
                  {statusColors[viewPatient.status].label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Diagnosed Date</p>
                  <p className="font-medium">{format(new Date(viewPatient.diagnosedDate), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-gray-500">Next Follow-up</p>
                  <p className="font-medium">
                    {viewPatient.nextFollowUp ? format(new Date(viewPatient.nextFollowUp), 'dd MMM yyyy') : 'Not scheduled'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Follow-up Interval</p>
                  <p className="font-medium">{viewPatient.followUpIntervalDays} days</p>
                </div>
                <div>
                  <p className="text-gray-500">Reminders</p>
                  <p className="font-medium">{viewPatient.reminderEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>

              {viewPatient.currentMedications && viewPatient.currentMedications.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Current Medications</p>
                  <div className="space-y-1">
                    {viewPatient.currentMedications.map((med, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <Pill className="w-4 h-4 text-rose-500" />
                        <span>{med}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewPatient.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-sm bg-gray-50 rounded p-3">{viewPatient.notes}</p>
                </div>
              )}
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setViewPatient(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setViewPatient(null);
                  openModal(viewPatient);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
