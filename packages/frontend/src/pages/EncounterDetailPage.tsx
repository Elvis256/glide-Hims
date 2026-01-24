import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Encounter, Vital, ClinicalNote, Prescription } from '../types';
import {
  ArrowLeft,
  Loader2,
  Heart,
  Thermometer,
  Activity,
  Scale,
  Stethoscope,
  Pill,
  CreditCard,
  CheckCircle,
  Save,
  Plus,
} from 'lucide-react';

const statusSteps = [
  { key: 'registered', label: 'Registered' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'in_consultation', label: 'Consultation' },
  { key: 'pending_pharmacy', label: 'Pharmacy' },
  { key: 'pending_payment', label: 'Payment' },
  { key: 'completed', label: 'Completed' },
];

export default function EncounterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'vitals' | 'consultation' | 'prescriptions' | 'billing'>('vitals');

  // Fetch encounter
  const { data: encounter, isLoading } = useQuery({
    queryKey: ['encounter', id],
    queryFn: async () => {
      const response = await api.get(`/encounters/${id}`);
      return response.data as Encounter;
    },
    enabled: !!id,
  });

  // Fetch vitals
  const { data: vitals } = useQuery({
    queryKey: ['vitals', id],
    queryFn: async () => {
      const response = await api.get(`/vitals/encounter/${id}`);
      return response.data as Vital[];
    },
    enabled: !!id,
  });

  // Fetch clinical notes
  const { data: clinicalNotes } = useQuery({
    queryKey: ['clinical-notes', id],
    queryFn: async () => {
      const response = await api.get(`/clinical-notes/encounter/${id}`);
      return response.data as ClinicalNote[];
    },
    enabled: !!id,
  });

  // Fetch prescriptions
  const { data: prescriptions } = useQuery({
    queryKey: ['prescriptions', id],
    queryFn: async () => {
      const response = await api.get(`/prescriptions?encounterId=${id}`);
      return response.data.data as Prescription[];
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Encounter not found</p>
      </div>
    );
  }

  const currentStepIndex = statusSteps.findIndex(s => s.key === encounter.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/encounters')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{encounter.patient.fullName}</h1>
            <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
              {encounter.visitNumber}
            </span>
          </div>
          <p className="text-gray-500">
            MRN: {encounter.patient.mrn} • {encounter.type.toUpperCase()} Visit
            {encounter.chiefComplaint && ` • ${encounter.chiefComplaint}`}
          </p>
        </div>
      </div>

      {/* Status Progress */}
      <div className="card">
        <div className="flex items-center justify-between">
          {statusSteps.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div key={step.key} className="flex-1 flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                  </div>
                  <span
                    className={`text-xs mt-1 ${
                      isCompleted || isCurrent ? 'text-gray-900 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < statusSteps.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-2 rounded ${
                      index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {[
            { key: 'vitals', label: 'Vitals', icon: Heart },
            { key: 'consultation', label: 'Consultation', icon: Stethoscope },
            { key: 'prescriptions', label: 'Prescriptions', icon: Pill },
            { key: 'billing', label: 'Billing', icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 pb-3 px-1 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'vitals' && (
        <VitalsTab
          encounterId={id!}
          vitals={vitals || []}
          onVitalsSaved={() => queryClient.invalidateQueries({ queryKey: ['vitals', id] })}
        />
      )}

      {activeTab === 'consultation' && (
        <ConsultationTab
          encounterId={id!}
          notes={clinicalNotes || []}
          onNotesSaved={() => queryClient.invalidateQueries({ queryKey: ['clinical-notes', id] })}
        />
      )}

      {activeTab === 'prescriptions' && (
        <PrescriptionsTab
          encounterId={id!}
          prescriptions={prescriptions || []}
          onPrescriptionSaved={() => queryClient.invalidateQueries({ queryKey: ['prescriptions', id] })}
        />
      )}

      {activeTab === 'billing' && (
        <BillingTab
          encounterId={id!}
          patientId={encounter.patientId}
        />
      )}
    </div>
  );
}

// Vitals Tab Component
interface VitalsTabProps {
  encounterId: string;
  vitals: Vital[];
  onVitalsSaved: () => void;
}

function VitalsTab({ encounterId, vitals, onVitalsSaved }: VitalsTabProps) {
  const [showForm, setShowForm] = useState(vitals.length === 0);
  const [formData, setFormData] = useState({
    temperature: '',
    pulse: '',
    bpSystolic: '',
    bpDiastolic: '',
    respiratoryRate: '',
    oxygenSaturation: '',
    weight: '',
    height: '',
    painScale: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/vitals', { encounterId, ...data });
      return response.data;
    },
    onSuccess: () => {
      onVitalsSaved();
      setShowForm(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {};
    if (formData.temperature) data.temperature = parseFloat(formData.temperature);
    if (formData.pulse) data.pulse = parseInt(formData.pulse);
    if (formData.bpSystolic) data.bpSystolic = parseInt(formData.bpSystolic);
    if (formData.bpDiastolic) data.bpDiastolic = parseInt(formData.bpDiastolic);
    if (formData.respiratoryRate) data.respiratoryRate = parseInt(formData.respiratoryRate);
    if (formData.oxygenSaturation) data.oxygenSaturation = parseFloat(formData.oxygenSaturation);
    if (formData.weight) data.weight = parseFloat(formData.weight);
    if (formData.height) data.height = parseFloat(formData.height);
    if (formData.painScale) data.painScale = parseInt(formData.painScale);
    if (formData.notes) data.notes = formData.notes;
    mutation.mutate(data);
  };

  const latestVital = vitals[0];

  return (
    <div className="space-y-4">
      {/* Latest Vitals Display */}
      {latestVital && !showForm && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Current Vitals</h3>
            <button
              onClick={() => setShowForm(true)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Record New
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {latestVital.temperature && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Thermometer className="w-6 h-6 text-red-500" />
                <div>
                  <p className="text-sm text-gray-500">Temperature</p>
                  <p className="font-semibold">{latestVital.temperature}°C</p>
                </div>
              </div>
            )}
            {latestVital.pulse && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Heart className="w-6 h-6 text-red-500" />
                <div>
                  <p className="text-sm text-gray-500">Pulse</p>
                  <p className="font-semibold">{latestVital.pulse} bpm</p>
                </div>
              </div>
            )}
            {latestVital.bpSystolic && latestVital.bpDiastolic && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Activity className="w-6 h-6 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-500">Blood Pressure</p>
                  <p className="font-semibold">{latestVital.bpSystolic}/{latestVital.bpDiastolic}</p>
                </div>
              </div>
            )}
            {latestVital.weight && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Scale className="w-6 h-6 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500">Weight</p>
                  <p className="font-semibold">{latestVital.weight} kg</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vitals Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Record Vitals</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                className="input"
                placeholder="36.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pulse (bpm)</label>
              <input
                type="number"
                value={formData.pulse}
                onChange={(e) => setFormData({ ...formData, pulse: e.target.value })}
                className="input"
                placeholder="72"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BP Systolic</label>
              <input
                type="number"
                value={formData.bpSystolic}
                onChange={(e) => setFormData({ ...formData, bpSystolic: e.target.value })}
                className="input"
                placeholder="120"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BP Diastolic</label>
              <input
                type="number"
                value={formData.bpDiastolic}
                onChange={(e) => setFormData({ ...formData, bpDiastolic: e.target.value })}
                className="input"
                placeholder="80"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resp. Rate</label>
              <input
                type="number"
                value={formData.respiratoryRate}
                onChange={(e) => setFormData({ ...formData, respiratoryRate: e.target.value })}
                className="input"
                placeholder="18"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
              <input
                type="number"
                step="0.1"
                value={formData.oxygenSaturation}
                onChange={(e) => setFormData({ ...formData, oxygenSaturation: e.target.value })}
                className="input"
                placeholder="98"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="input"
                placeholder="70"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
              <input
                type="number"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                className="input"
                placeholder="170"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
              rows={2}
            />
          </div>
          <div className="flex gap-3 mt-4">
            {vitals.length > 0 && (
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            )}
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Vitals
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Consultation Tab
interface ConsultationTabProps {
  encounterId: string;
  notes: ClinicalNote[];
  onNotesSaved: () => void;
}

function ConsultationTab({ encounterId, notes, onNotesSaved }: ConsultationTabProps) {
  const [formData, setFormData] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
    followUpDate: '',
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/clinical-notes', { encounterId, ...data });
      return response.data;
    },
    onSuccess: () => {
      onNotesSaved();
      setFormData({ subjective: '', objective: '', assessment: '', plan: '', followUpDate: '' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {};
    if (formData.subjective) data.subjective = formData.subjective;
    if (formData.objective) data.objective = formData.objective;
    if (formData.assessment) data.assessment = formData.assessment;
    if (formData.plan) data.plan = formData.plan;
    if (formData.followUpDate) data.followUpDate = formData.followUpDate;
    mutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      {/* Previous Notes */}
      {notes.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Clinical Notes</h3>
          {notes.map((note) => (
            <div key={note.id} className="border-b last:border-0 pb-4 last:pb-0 mb-4 last:mb-0">
              <p className="text-xs text-gray-500 mb-2">
                {new Date(note.createdAt).toLocaleString()} by {note.provider?.fullName || 'Provider'}
              </p>
              {note.subjective && (
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-700">Subjective</p>
                  <p className="text-sm text-gray-600">{note.subjective}</p>
                </div>
              )}
              {note.objective && (
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-700">Objective</p>
                  <p className="text-sm text-gray-600">{note.objective}</p>
                </div>
              )}
              {note.assessment && (
                <div className="mb-2">
                  <p className="text-sm font-medium text-gray-700">Assessment</p>
                  <p className="text-sm text-gray-600">{note.assessment}</p>
                </div>
              )}
              {note.plan && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Plan</p>
                  <p className="text-sm text-gray-600">{note.plan}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Note Form */}
      <form onSubmit={handleSubmit} className="card">
        <h3 className="font-semibold text-gray-900 mb-4">
          {notes.length > 0 ? 'Add Clinical Note' : 'Clinical Assessment (SOAP)'}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subjective (History & Symptoms)
            </label>
            <textarea
              value={formData.subjective}
              onChange={(e) => setFormData({ ...formData, subjective: e.target.value })}
              className="input"
              rows={3}
              placeholder="Patient reports..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Objective (Examination Findings)
            </label>
            <textarea
              value={formData.objective}
              onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
              className="input"
              rows={3}
              placeholder="On examination..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assessment (Diagnosis)
            </label>
            <textarea
              value={formData.assessment}
              onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
              className="input"
              rows={2}
              placeholder="Diagnosis/Impression..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan (Treatment)
            </label>
            <textarea
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              className="input"
              rows={2}
              placeholder="Treatment plan..."
            />
          </div>
          <div className="w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
            <input
              type="date"
              value={formData.followUpDate}
              onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
              className="input"
            />
          </div>
        </div>
        <div className="mt-4">
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Clinical Notes
          </button>
        </div>
      </form>
    </div>
  );
}

// Prescriptions Tab
interface PrescriptionsTabProps {
  encounterId: string;
  prescriptions: Prescription[];
  onPrescriptionSaved: () => void;
}

function PrescriptionsTab({ encounterId, prescriptions, onPrescriptionSaved }: PrescriptionsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState([{ drugCode: '', drugName: '', dose: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/prescriptions', { encounterId, items: data });
      return response.data;
    },
    onSuccess: () => {
      onPrescriptionSaved();
      setShowForm(false);
      setItems([{ drugCode: '', drugName: '', dose: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);
    },
  });

  const addItem = () => {
    setItems([...items, { drugCode: '', drugName: '', dose: '', frequency: '', duration: '', quantity: 1, instructions: '' }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = items.filter(item => item.drugName && item.dose && item.quantity > 0);
    if (validItems.length === 0) return;
    mutation.mutate(validItems);
  };

  return (
    <div className="space-y-4">
      {/* Existing Prescriptions */}
      {prescriptions.map((rx) => (
        <div key={rx.id} className="card">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-sm bg-green-50 text-green-700 px-2 py-1 rounded">
              {rx.prescriptionNumber}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${
              rx.status === 'dispensed' ? 'bg-green-100 text-green-700' :
              rx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {rx.status}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-2 py-1">Drug</th>
                <th className="text-left px-2 py-1">Dose</th>
                <th className="text-left px-2 py-1">Frequency</th>
                <th className="text-left px-2 py-1">Duration</th>
                <th className="text-left px-2 py-1">Qty</th>
              </tr>
            </thead>
            <tbody>
              {rx.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-2 py-2">{item.drugName}</td>
                  <td className="px-2 py-2">{item.dose}</td>
                  <td className="px-2 py-2">{item.frequency}</td>
                  <td className="px-2 py-2">{item.duration}</td>
                  <td className="px-2 py-2">{item.quantityDispensed}/{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Add Prescription Button */}
      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Prescription
        </button>
      )}

      {/* Prescription Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card">
          <h3 className="font-semibold text-gray-900 mb-4">New Prescription</h3>
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-7 gap-2 mb-2 items-end">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500">Drug Name *</label>
                <input
                  type="text"
                  value={item.drugName}
                  onChange={(e) => updateItem(index, 'drugName', e.target.value)}
                  className="input text-sm"
                  placeholder="Paracetamol"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Dose *</label>
                <input
                  type="text"
                  value={item.dose}
                  onChange={(e) => updateItem(index, 'dose', e.target.value)}
                  className="input text-sm"
                  placeholder="500mg"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Frequency</label>
                <input
                  type="text"
                  value={item.frequency}
                  onChange={(e) => updateItem(index, 'frequency', e.target.value)}
                  className="input text-sm"
                  placeholder="TDS"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Duration</label>
                <input
                  type="text"
                  value={item.duration}
                  onChange={(e) => updateItem(index, 'duration', e.target.value)}
                  className="input text-sm"
                  placeholder="5 days"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Qty *</label>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                  className="input text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-2 text-red-500 hover:bg-red-50 rounded"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addItem} className="text-blue-600 text-sm hover:underline mb-4">
            + Add another drug
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Prescription
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// Billing Tab
interface BillingTabProps {
  encounterId: string;
  patientId: string;
}

function BillingTab({ encounterId, patientId }: BillingTabProps) {
  const queryClient = useQueryClient();

  const { data: invoices } = useQuery({
    queryKey: ['invoices', encounterId],
    queryFn: async () => {
      const response = await api.get(`/billing/invoices?encounterId=${encounterId}`);
      return response.data.data;
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/billing/invoices', {
        patientId,
        encounterId,
        items: [
          { serviceCode: 'CONS001', description: 'Consultation Fee', quantity: 1, unitPrice: 50000 },
        ],
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', encounterId] });
    },
  });

  return (
    <div className="space-y-4">
      {invoices?.length > 0 ? (
        invoices.map((invoice: any) => (
          <div key={invoice.id} className="card">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                {invoice.invoiceNumber}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                invoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {invoice.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Total</p>
                <p className="font-semibold">UGX {invoice.totalAmount?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Paid</p>
                <p className="font-semibold text-green-600">UGX {invoice.amountPaid?.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Balance</p>
                <p className="font-semibold text-red-600">UGX {invoice.balanceDue?.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="card text-center py-8">
          <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No invoice generated yet</p>
          <button
            onClick={() => createInvoiceMutation.mutate()}
            disabled={createInvoiceMutation.isPending}
            className="btn-primary"
          >
            {createInvoiceMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Generate Invoice'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
