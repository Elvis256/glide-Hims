import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Encounter, Vital, ClinicalNote, Prescription } from '../types';
import DrugAutocomplete from '../components/DrugAutocomplete';
import { ordersService, type Order, type CreateOrderDto, type TestCode } from '../services/orders';
import { labService, type LabTest, type LabResult } from '../services/lab';
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
  FlaskConical,
  Trash2,
  Search,
  FileText,
  Clock,
  ChevronRight,
  AlertCircle,
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
  const [activeTab, setActiveTab] = useState<'vitals' | 'consultation' | 'lab' | 'results' | 'prescriptions' | 'billing'>('vitals');

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
            { key: 'lab', label: 'Lab Orders', icon: FlaskConical },
            { key: 'results', label: 'Lab Results', icon: FileText },
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

      {activeTab === 'lab' && (
        <LabOrdersTab
          encounterId={id!}
        />
      )}

      {activeTab === 'results' && (
        <LabResultsTab
          encounterId={id!}
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

interface PrescriptionItem {
  drugCode: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
}

// ========== Lab Orders Tab ==========
interface LabOrdersTabProps {
  encounterId: string;
}

function LabOrdersTab({ encounterId }: LabOrdersTabProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedTests, setSelectedTests] = useState<TestCode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Fetch existing orders for this encounter
  const { data: orders = [] } = useQuery({
    queryKey: ['lab-orders', encounterId],
    queryFn: () => ordersService.getByEncounter(encounterId),
  });

  // Filter lab orders only
  const labOrders = orders.filter(o => o.orderType === 'lab');

  // Fetch available lab tests
  const { data: availableTests = [] } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => labService.tests.list(),
  });

  // Filter tests by search
  const filteredTests = availableTests.filter(test => 
    test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: (data: CreateOrderDto) => ordersService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders', encounterId] });
      setShowForm(false);
      setSelectedTests([]);
      setClinicalNotes('');
      setPriority('routine');
    },
  });

  const toggleTest = (test: LabTest) => {
    const exists = selectedTests.find(t => t.code === test.code);
    if (exists) {
      setSelectedTests(prev => prev.filter(t => t.code !== test.code));
    } else {
      setSelectedTests(prev => [...prev, { code: test.code, name: test.name, sampleType: test.sampleType }]);
    }
  };

  const handleSubmit = () => {
    if (selectedTests.length === 0) return;
    createOrderMutation.mutate({
      encounterId,
      orderType: 'lab',
      priority,
      clinicalNotes: clinicalNotes || undefined,
      testCodes: selectedTests,
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="py-4 space-y-4">
      {/* Existing Orders */}
      {labOrders.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Lab Orders</h3>
          <div className="space-y-3">
            {labOrders.map((order) => (
              <div key={order.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-blue-600">{order.orderNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      order.priority === 'stat' ? 'bg-red-100 text-red-700' :
                      order.priority === 'urgent' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {order.priority}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {order.testCodes?.map(t => t.name).join(', ')}
                  </div>
                  {order.clinicalNotes && (
                    <p className="mt-1 text-xs text-gray-500">Notes: {order.clinicalNotes}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Order Form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Order Lab Tests
        </button>
      ) : (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Order Lab Tests</h3>
          
          {/* Priority Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <div className="flex gap-2">
              {(['routine', 'urgent', 'stat'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    priority === p
                      ? p === 'stat' ? 'bg-red-600 text-white' :
                        p === 'urgent' ? 'bg-orange-500 text-white' :
                        'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Search Tests */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Tests</label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tests..."
                className="input pl-9"
              />
            </div>
            
            {/* Available Tests */}
            <div className="border rounded-lg max-h-48 overflow-auto">
              {filteredTests.length === 0 ? (
                <p className="p-3 text-sm text-gray-500 text-center">No tests found</p>
              ) : (
                filteredTests.map((test) => {
                  const isSelected = selectedTests.some(t => t.code === test.code);
                  return (
                    <button
                      key={test.id}
                      type="button"
                      onClick={() => toggleTest(test)}
                      className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50 border-b last:border-b-0 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div>
                        <span className="text-sm font-medium">{test.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{test.code}</span>
                      </div>
                      {isSelected && <CheckCircle className="w-4 h-4 text-blue-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Tests */}
          {selectedTests.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected ({selectedTests.length})
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedTests.map((test) => (
                  <span
                    key={test.code}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {test.name}
                    <button
                      type="button"
                      onClick={() => setSelectedTests(prev => prev.filter(t => t.code !== test.code))}
                      className="hover:text-blue-900"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Clinical Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Notes</label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Reason for test, relevant symptoms..."
              rows={2}
              className="input"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setSelectedTests([]);
              }}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedTests.length === 0 || createOrderMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {createOrderMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrescriptionsTab({ encounterId, prescriptions, onPrescriptionSaved }: PrescriptionsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<PrescriptionItem[]>([]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/prescriptions', { encounterId, items: data });
      return response.data;
    },
    onSuccess: () => {
      onPrescriptionSaved();
      setShowForm(false);
      setItems([]);
    },
  });

  const createEmptyItem = (): PrescriptionItem => ({
    drugCode: '',
    drugName: '',
    dose: '',
    frequency: '',
    duration: '',
    quantity: 1,
    instructions: ''
  });

  const addItem = () => {
    setItems([...items, createEmptyItem()]);
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
      {prescriptions.length === 0 && !showForm ? (
        <div className="card text-center py-8">
          <Pill className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No prescriptions yet</p>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 mx-auto">
            <Plus className="w-4 h-4" />
            Add Prescription
          </button>
        </div>
      ) : (
        <>
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
          {items.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg mb-4">
              <Pill className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm mb-2">No drugs added yet</p>
              <button type="button" onClick={addItem} className="text-blue-600 text-sm hover:underline">
                + Add a drug
              </button>
            </div>
          ) : (
            <>
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-7 gap-2 mb-2 items-end">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500">Drug Name *</label>
                    <DrugAutocomplete
                      value={item.drugName}
                      onChange={(drug) => updateItem(index, 'drugName', drug.name)}
                      placeholder="Search drug..."
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
            </>
          )}
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
        </>
      )}
    </div>
  );
}

// Billing Tab
interface BillingTabProps {
  encounterId: string;
  patientId: string;
}

interface InvoiceItem {
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

function BillingTab({ encounterId, patientId }: BillingTabProps) {
  const queryClient = useQueryClient();
  const [invoiceItems] = useState<InvoiceItem[]>([]);

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
        items: invoiceItems,
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

// ========== Lab Results Tab ==========
interface LabResultsTabProps {
  encounterId: string;
}

function LabResultsTab({ encounterId }: LabResultsTabProps) {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  // Fetch lab orders for this encounter
  const { data: orders, isLoading } = useQuery({
    queryKey: ['lab-orders', encounterId],
    queryFn: () => ordersService.getByEncounter(encounterId),
  });

  // Filter to only lab orders
  const labOrders = orders?.filter((o) => o.orderType === 'lab') || [];

  // Fetch all samples to find ones linked to these orders
  const { data: samplesData } = useQuery({
    queryKey: ['lab-samples', 'encounter', encounterId],
    queryFn: () => labService.samples.list({}),
    enabled: labOrders.length > 0,
  });

  // Filter samples that belong to our orders
  const orderSamples = samplesData?.data?.filter(
    (sample) => labOrders.some((o) => o.id === sample.orderId)
  ) || [];

  // Get sample IDs that have results (completed or processing status)
  const samplesWithResultsIds = orderSamples
    .filter((s) => s.status === 'completed' || s.status === 'processing')
    .map((s) => s.id);

  // Fetch results for ALL samples with results
  const { data: allResultsData } = useQuery({
    queryKey: ['lab-results-all', samplesWithResultsIds],
    queryFn: async () => {
      const allResults: Record<string, LabResult[]> = {};
      for (const sampleId of samplesWithResultsIds) {
        try {
          const results = await labService.results.getForSample(sampleId);
          allResults[sampleId] = results || [];
        } catch {
          allResults[sampleId] = [];
        }
      }
      return allResults;
    },
    enabled: samplesWithResultsIds.length > 0,
  });

  const samplesWithResults = orderSamples.filter((s) => s.status === 'completed' || s.status === 'processing');

  // Collect all abnormal results for clinical alert
  const abnormalResults: Array<{ testName: string; parameter: string; value: string; flag: string }> = [];
  if (allResultsData) {
    Object.entries(allResultsData).forEach(([sampleId, results]) => {
      const sample = orderSamples.find((s) => s.id === sampleId);
      const order = labOrders.find((o) => o.id === sample?.orderId);
      results.forEach((r) => {
        if (r.abnormalFlag && r.abnormalFlag !== 'normal') {
          abnormalResults.push({
            testName: order?.testCodes?.[0]?.name || sample?.labTest?.name || 'Test',
            parameter: r.parameter,
            value: r.value + (r.unit ? ` ${r.unit}` : ''),
            flag: r.abnormalFlag,
          });
        }
      });
    });
  }

  const toggleTest = (orderId: string) => {
    const newExpanded = new Set(expandedTests);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedTests(newExpanded);
  };

  const getStatusColor = (flag?: string) => {
    switch (flag) {
      case 'high':
      case 'low':
        return 'text-orange-600 bg-orange-50';
      case 'critical':
      case 'critical_high':
      case 'critical_low':
        return 'text-red-600 bg-red-50 font-bold';
      default:
        return 'text-green-600 bg-green-50';
    }
  };

  const getFlagLabel = (flag?: string) => {
    switch (flag) {
      case 'high': return 'HIGH';
      case 'low': return 'LOW';
      case 'critical_high': return 'CRITICAL HIGH';
      case 'critical_low': return 'CRITICAL LOW';
      case 'critical': return 'CRITICAL';
      default: return 'Normal';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading results...</span>
        </div>
      </div>
    );
  }

  if (!labOrders || labOrders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          <FlaskConical className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>No lab orders for this encounter</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Clinical Alert for Abnormal Results */}
      {abnormalResults.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 mb-2">⚠️ Abnormal Results Require Review</h3>
              <div className="space-y-1">
                {abnormalResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      r.flag.includes('critical') ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {getFlagLabel(r.flag)}
                    </span>
                    <span className="text-red-700">
                      <strong>{r.testName}</strong> - {r.parameter}: {r.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FlaskConical className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{labOrders.length}</p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{samplesWithResults.length}</p>
              <p className="text-sm text-gray-500">Results Ready</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${abnormalResults.length > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
              {abnormalResults.length > 0 ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
            </div>
            <div>
              <p className={`text-2xl font-bold ${abnormalResults.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {abnormalResults.length}
              </p>
              <p className="text-sm text-gray-500">Abnormal Values</p>
            </div>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Lab Test Results</h3>
          <p className="text-sm text-gray-500">Click on a test to expand/collapse results</p>
        </div>
        <div className="divide-y divide-gray-100">
          {labOrders.map((order) => {
            const sample = orderSamples.find((s) => s.orderId === order.id);
            const hasSample = !!sample;
            const sampleStatus = sample?.status || 'pending';
            const sampleResults = sample?.id ? allResultsData?.[sample.id] || [] : [];
            const hasResults = sampleResults.length > 0;
            const isExpanded = expandedTests.has(order.id);
            const hasAbnormal = sampleResults.some((r) => r.abnormalFlag && r.abnormalFlag !== 'normal');
            
            return (
              <div key={order.id} className={`p-4 ${hasAbnormal ? 'bg-red-50/30' : ''}`}>
                <div 
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 -m-2 p-2 rounded"
                  onClick={() => toggleTest(order.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${hasAbnormal ? 'bg-red-100' : hasResults ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <FlaskConical className={`w-5 h-5 ${hasAbnormal ? 'text-red-600' : hasResults ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {order.testCodes?.map((test: { code: string; name: string }) => (
                          <span key={test.code} className="font-medium text-gray-900">{test.name}</span>
                        ))}
                        {hasAbnormal && (
                          <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 font-medium">
                            ⚠️ Abnormal
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Order: {order.orderNumber}</span>
                        {hasSample && <span>• Sample: {sample.sampleNumber}</span>}
                        <span>• {new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      sampleStatus === 'completed' ? 'bg-green-100 text-green-700' :
                      sampleStatus === 'processing' ? 'bg-blue-100 text-blue-700' :
                      sampleStatus === 'received' ? 'bg-purple-100 text-purple-700' :
                      sampleStatus === 'collected' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {sampleStatus === 'completed' ? '✓ Results Ready' :
                       sampleStatus === 'processing' ? 'Processing' :
                       sampleStatus === 'received' ? 'At Lab' :
                       sampleStatus === 'collected' ? 'Collected' : 'Pending Collection'}
                    </span>
                    {hasResults && (
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    )}
                  </div>
                </div>

                {/* Expanded Results View */}
                {isExpanded && hasResults && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">Test Results</h4>
                      {sampleResults[0]?.validatedAt && (
                        <span className="text-xs text-gray-500">
                          Validated: {new Date(sampleResults[0].validatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left bg-gray-50">
                            <th className="px-3 py-2 font-medium text-gray-600">Parameter</th>
                            <th className="px-3 py-2 font-medium text-gray-600">Result</th>
                            <th className="px-3 py-2 font-medium text-gray-600">Unit</th>
                            <th className="px-3 py-2 font-medium text-gray-600">Reference Range</th>
                            <th className="px-3 py-2 font-medium text-gray-600">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sampleResults.map((result) => {
                            const isAbnormal = result.abnormalFlag && result.abnormalFlag !== 'normal';
                            return (
                              <tr key={result.id} className={`border-b border-gray-100 ${isAbnormal ? 'bg-red-50' : ''}`}>
                                <td className="px-3 py-3 font-medium text-gray-900">{result.parameter}</td>
                                <td className={`px-3 py-3 font-semibold ${isAbnormal ? 'text-red-600' : 'text-gray-900'}`}>
                                  {result.value}
                                </td>
                                <td className="px-3 py-3 text-gray-500">{result.unit || '-'}</td>
                                <td className="px-3 py-3 text-gray-500">
                                  {result.referenceRange || 
                                    (result.referenceMin !== undefined && result.referenceMax !== undefined 
                                      ? `${result.referenceMin} - ${result.referenceMax}` 
                                      : '-')}
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.abnormalFlag)}`}>
                                    {getFlagLabel(result.abnormalFlag)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Lab Comments/Interpretation */}
                    {(sampleResults[0]?.comments || sampleResults[0]?.interpretation) && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-blue-800 text-sm">Lab Comments:</p>
                            <p className="text-sm text-blue-700 mt-1">
                              {sampleResults[0].interpretation || sampleResults[0].comments}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Validated By */}
                    {sampleResults[0]?.validatedBy && (
                      <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>
                          Validated by: {typeof sampleResults[0].validatedBy === 'string' 
                            ? sampleResults[0].validatedBy 
                            : `${sampleResults[0].validatedBy.firstName} ${sampleResults[0].validatedBy.lastName}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Pending status message */}
                {!hasResults && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-700 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>
                        {!hasSample ? 'Sample not yet collected' :
                         sampleStatus === 'collected' ? 'Sample collected - awaiting receipt at lab' :
                         sampleStatus === 'received' ? 'Sample received at lab - awaiting processing' :
                         sampleStatus === 'processing' ? 'Sample being processed - results pending' :
                         'Results pending'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
