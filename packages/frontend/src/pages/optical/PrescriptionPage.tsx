import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
}

interface OpticalExam {
  id: string;
  examDate: string;
  examType?: string;
  provider?: string;
}

interface EyeRx {
  sphere: string;
  cylinder: string;
  axis: string;
  add: string;
  prism: string;
  base: string;
}

interface ContactLensEye {
  baseCurve: string;
  diameter: string;
  brand: string;
  model: string;
  color: string;
}

interface ContactLensSchedule {
  wearSchedule: string;
  replacementSchedule: string;
  solution: string;
  trialLensNotes: string;
}

interface RxFormData {
  type: 'spectacle' | 'contact_lens';
  examId: string;
  od: EyeRx;
  os: EyeRx;
  pdDistance: string;
  pdNear: string;
  segmentHeight: string;
  expiryDate: string;
  notes: string;
  contactLensOd: ContactLensEye;
  contactLensOs: ContactLensEye;
  contactLensScheduleOd: ContactLensSchedule;
  contactLensScheduleOs: ContactLensSchedule;
}

interface Prescription {
  id: string;
  type: 'spectacle' | 'contact_lens';
  status: 'active' | 'expired' | 'superseded';
  createdAt: string;
  expiryDate?: string;
  notes?: string;
  examId?: string;
  od?: EyeRx;
  os?: EyeRx;
  pdDistance?: number;
  pdNear?: number;
  segmentHeight?: number;
  contactLensOd?: ContactLensEye;
  contactLensOs?: ContactLensEye;
  contactLensScheduleOd?: ContactLensSchedule;
  contactLensScheduleOs?: ContactLensSchedule;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyEye: EyeRx = {
  sphere: '',
  cylinder: '',
  axis: '',
  add: '',
  prism: '',
  base: '',
};

const emptyContactLensEye: ContactLensEye = {
  baseCurve: '',
  diameter: '',
  brand: '',
  model: '',
  color: '',
};

const emptyContactLensSchedule: ContactLensSchedule = {
  wearSchedule: 'daily',
  replacementSchedule: 'monthly',
  solution: '',
  trialLensNotes: '',
};

const initialForm: RxFormData = {
  type: 'spectacle',
  examId: '',
  od: { ...emptyEye },
  os: { ...emptyEye },
  pdDistance: '',
  pdNear: '',
  segmentHeight: '',
  expiryDate: '',
  notes: '',
  contactLensOd: { ...emptyContactLensEye },
  contactLensOs: { ...emptyContactLensEye },
  contactLensScheduleOd: { ...emptyContactLensSchedule },
  contactLensScheduleOs: { ...emptyContactLensSchedule },
};

const BASE_OPTIONS = ['up', 'down', 'in', 'out'] as const;
const WEAR_SCHEDULES = ['daily', 'extended', 'flexible'] as const;
const REPLACEMENT_SCHEDULES = ['daily', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  expired: 'bg-red-100 text-red-800',
  superseded: 'bg-yellow-100 text-yellow-800',
};

function formatRxSummary(eye: EyeRx | undefined, label: string): string {
  if (!eye) return '';
  const parts = [label + ':'];
  if (eye.sphere) parts.push(eye.sphere);
  if (eye.cylinder) parts.push(eye.cylinder);
  if (eye.axis) parts.push('x' + eye.axis);
  return parts.length > 1 ? parts.join(' ') : '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PrescriptionPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [form, setForm] = useState<RxFormData>({ ...initialForm });
  const [expandedRxId, setExpandedRxId] = useState<string | null>(null);

  // ---- Patient search ----
  const { data: patientsData } = useQuery({
    queryKey: ['patients-search', patientSearch, facilityId],
    queryFn: async () => {
      const res = await api.get('/patients', { params: { search: patientSearch } });
      return res.data;
    },
    enabled: patientSearch.length >= 2,
  });
  const patients = asList<Patient>(patientsData);

  // ---- Patient exams ----
  const { data: examsData } = useQuery({
    queryKey: ['optical-exams-patient', patientId, facilityId],
    queryFn: async () => {
      const res = await api.get(`/optical/exams/patient/${patientId}`);
      return res.data;
    },
    enabled: !!patientId,
  });
  const exams = asList<OpticalExam>(examsData);

  // ---- Prescription history ----
  const { data: rxData, isLoading: rxLoading } = useQuery({
    queryKey: ['optical-prescriptions-patient', patientId, facilityId],
    queryFn: async () => {
      const res = await api.get(`/optical/prescriptions/patient/${patientId}`);
      return res.data;
    },
    enabled: !!patientId,
  });
  const prescriptions = asList<Prescription>(rxData);

  // ---- Save mutations ----
  const spectacleMutation = useMutation({
    mutationFn: async (data: RxFormData) => {
      const res = await api.post('/optical/prescriptions', {
        patientId,
        examId: data.examId || undefined,
        od: {
          sphere: parseFloat(data.od.sphere) || 0,
          cylinder: parseFloat(data.od.cylinder) || 0,
          axis: parseInt(data.od.axis, 10) || 0,
          add: parseFloat(data.od.add) || 0,
          prism: parseFloat(data.od.prism) || 0,
          base: data.od.base || undefined,
        },
        os: {
          sphere: parseFloat(data.os.sphere) || 0,
          cylinder: parseFloat(data.os.cylinder) || 0,
          axis: parseInt(data.os.axis, 10) || 0,
          add: parseFloat(data.os.add) || 0,
          prism: parseFloat(data.os.prism) || 0,
          base: data.os.base || undefined,
        },
        pdDistance: parseFloat(data.pdDistance) || undefined,
        pdNear: parseFloat(data.pdNear) || undefined,
        segmentHeight: parseFloat(data.segmentHeight) || undefined,
        expiryDate: data.expiryDate || undefined,
        notes: data.notes || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-prescriptions-patient'] });
      setForm({ ...initialForm });
      toast.success('Spectacle prescription saved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save prescription')),
  });

  const contactLensMutation = useMutation({
    mutationFn: async (data: RxFormData) => {
      const res = await api.post('/optical/prescriptions/contact-lens', {
        patientId,
        examId: data.examId || undefined,
        od: {
          sphere: parseFloat(data.od.sphere) || 0,
          cylinder: parseFloat(data.od.cylinder) || 0,
          axis: parseInt(data.od.axis, 10) || 0,
          add: parseFloat(data.od.add) || 0,
          prism: parseFloat(data.od.prism) || 0,
          base: data.od.base || undefined,
        },
        os: {
          sphere: parseFloat(data.os.sphere) || 0,
          cylinder: parseFloat(data.os.cylinder) || 0,
          axis: parseInt(data.os.axis, 10) || 0,
          add: parseFloat(data.os.add) || 0,
          prism: parseFloat(data.os.prism) || 0,
          base: data.os.base || undefined,
        },
        pdDistance: parseFloat(data.pdDistance) || undefined,
        pdNear: parseFloat(data.pdNear) || undefined,
        segmentHeight: parseFloat(data.segmentHeight) || undefined,
        expiryDate: data.expiryDate || undefined,
        notes: data.notes || undefined,
        contactLensOd: {
          baseCurve: parseFloat(data.contactLensOd.baseCurve) || undefined,
          diameter: parseFloat(data.contactLensOd.diameter) || undefined,
          brand: data.contactLensOd.brand || undefined,
          model: data.contactLensOd.model || undefined,
          color: data.contactLensOd.color || undefined,
        },
        contactLensOs: {
          baseCurve: parseFloat(data.contactLensOs.baseCurve) || undefined,
          diameter: parseFloat(data.contactLensOs.diameter) || undefined,
          brand: data.contactLensOs.brand || undefined,
          model: data.contactLensOs.model || undefined,
          color: data.contactLensOs.color || undefined,
        },
        contactLensScheduleOd: {
          wearSchedule: data.contactLensScheduleOd.wearSchedule,
          replacementSchedule: data.contactLensScheduleOd.replacementSchedule,
          solution: data.contactLensScheduleOd.solution || undefined,
          trialLensNotes: data.contactLensScheduleOd.trialLensNotes || undefined,
        },
        contactLensScheduleOs: {
          wearSchedule: data.contactLensScheduleOs.wearSchedule,
          replacementSchedule: data.contactLensScheduleOs.replacementSchedule,
          solution: data.contactLensScheduleOs.solution || undefined,
          trialLensNotes: data.contactLensScheduleOs.trialLensNotes || undefined,
        },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['optical-prescriptions-patient'] });
      setForm({ ...initialForm });
      toast.success('Contact lens prescription saved');
    },
    onError: (err) =>
      toast.error(getApiErrorMessage(err, 'Failed to save contact lens prescription')),
  });

  const isSaving = spectacleMutation.isPending || contactLensMutation.isPending;

  // ---- Handlers ----
  const handleSelectPatient = (patient: Patient) => {
    setPatientId(patient.id);
    setSelectedPatient(patient);
    setPatientSearch(`${patient.firstName} ${patient.lastName}`);
    setShowDropdown(false);
    setForm({ ...initialForm });
    setExpandedRxId(null);
  };

  const updateEye = (eye: 'od' | 'os', field: keyof EyeRx, value: string) => {
    setForm((prev) => ({ ...prev, [eye]: { ...prev[eye], [field]: value } }));
  };

  const updateCLEye = (eye: 'contactLensOd' | 'contactLensOs', field: keyof ContactLensEye, value: string) => {
    setForm((prev) => ({ ...prev, [eye]: { ...prev[eye], [field]: value } }));
  };

  const updateCLSchedule = (
    eye: 'contactLensScheduleOd' | 'contactLensScheduleOs',
    field: keyof ContactLensSchedule,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [eye]: { ...prev[eye], [field]: value } }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      toast.error('Please select a patient first');
      return;
    }
    if (form.type === 'contact_lens') {
      contactLensMutation.mutate(form);
    } else {
      spectacleMutation.mutate(form);
    }
  };

  // ---- Render helpers ----
  const renderEyeRow = (label: string, eye: 'od' | 'os') => (
    <tr key={eye}>
      <td className="border border-gray-300 px-3 py-2 font-semibold text-gray-700 bg-gray-50">
        {label}
      </td>
      <td className="border border-gray-300 p-1">
        <input
          type="number"
          step="0.25"
          min="-20"
          max="20"
          value={form[eye].sphere}
          onChange={(e) => updateEye(eye, 'sphere', e.target.value)}
          className={INPUT_CLASS}
          placeholder="0.00"
        />
      </td>
      <td className="border border-gray-300 p-1">
        <input
          type="number"
          step="0.25"
          min="-20"
          max="20"
          value={form[eye].cylinder}
          onChange={(e) => updateEye(eye, 'cylinder', e.target.value)}
          className={INPUT_CLASS}
          placeholder="0.00"
        />
      </td>
      <td className="border border-gray-300 p-1">
        <input
          type="number"
          min="0"
          max="180"
          value={form[eye].axis}
          onChange={(e) => updateEye(eye, 'axis', e.target.value)}
          className={INPUT_CLASS}
          placeholder="0"
        />
      </td>
      <td className="border border-gray-300 p-1">
        <input
          type="number"
          step="0.25"
          min="0"
          max="4"
          value={form[eye].add}
          onChange={(e) => updateEye(eye, 'add', e.target.value)}
          className={INPUT_CLASS}
          placeholder="0.00"
        />
      </td>
      <td className="border border-gray-300 p-1">
        <input
          type="number"
          step="0.25"
          value={form[eye].prism}
          onChange={(e) => updateEye(eye, 'prism', e.target.value)}
          className={INPUT_CLASS}
          placeholder="0.00"
        />
      </td>
      <td className="border border-gray-300 p-1">
        <select
          value={form[eye].base}
          onChange={(e) => updateEye(eye, 'base', e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">—</option>
          {BASE_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b.charAt(0).toUpperCase() + b.slice(1)}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );

  const renderContactLensColumn = (
    label: string,
    eyeKey: 'contactLensOd' | 'contactLensOs',
    schedKey: 'contactLensScheduleOd' | 'contactLensScheduleOs',
  ) => (
    <div className="flex-1 space-y-4">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Eye className="h-4 w-4" /> {label}
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Base Curve</label>
          <input
            type="number"
            step="0.1"
            value={form[eyeKey].baseCurve}
            onChange={(e) => updateCLEye(eyeKey, 'baseCurve', e.target.value)}
            className={INPUT_CLASS}
            placeholder="8.6"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Diameter</label>
          <input
            type="number"
            step="0.1"
            value={form[eyeKey].diameter}
            onChange={(e) => updateCLEye(eyeKey, 'diameter', e.target.value)}
            className={INPUT_CLASS}
            placeholder="14.2"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Brand</label>
        <input
          type="text"
          value={form[eyeKey].brand}
          onChange={(e) => updateCLEye(eyeKey, 'brand', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Model</label>
        <input
          type="text"
          value={form[eyeKey].model}
          onChange={(e) => updateCLEye(eyeKey, 'model', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Color</label>
        <input
          type="text"
          value={form[eyeKey].color}
          onChange={(e) => updateCLEye(eyeKey, 'color', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Wear Schedule</label>
        <select
          value={form[schedKey].wearSchedule}
          onChange={(e) => updateCLSchedule(schedKey, 'wearSchedule', e.target.value)}
          className={INPUT_CLASS}
        >
          {WEAR_SCHEDULES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Replacement Schedule
        </label>
        <select
          value={form[schedKey].replacementSchedule}
          onChange={(e) => updateCLSchedule(schedKey, 'replacementSchedule', e.target.value)}
          className={INPUT_CLASS}
        >
          {REPLACEMENT_SCHEDULES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Solution</label>
        <input
          type="text"
          value={form[schedKey].solution}
          onChange={(e) => updateCLSchedule(schedKey, 'solution', e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Trial Lens Notes</label>
        <textarea
          value={form[schedKey].trialLensNotes}
          onChange={(e) => updateCLSchedule(schedKey, 'trialLensNotes', e.target.value)}
          rows={3}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );

  // ---- Main render ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Optical Prescriptions
          </h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage patient prescriptions</p>
        </div>
      </div>

      {/* Patient Selector */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="h-5 w-5 text-gray-500" />
          Select Patient
        </h2>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients by name…"
            value={patientSearch}
            onChange={(e) => {
              setPatientSearch(e.target.value);
              setShowDropdown(true);
              if (!e.target.value) {
                setPatientId(null);
                setSelectedPatient(null);
              }
            }}
            onFocus={() => patientSearch.length >= 2 && setShowDropdown(true)}
            className={`${INPUT_CLASS} pl-9`}
          />
          {showDropdown && patients.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-60 overflow-y-auto">
              {patients.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center gap-2"
                    onClick={() => handleSelectPatient(p)}
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {p.firstName} {p.lastName}
                    </span>
                    {p.dateOfBirth && (
                      <span className="text-gray-400 text-xs ml-auto">{p.dateOfBirth}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedPatient && (
          <p className="mt-3 text-sm text-green-700 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" />
            Patient selected: {selectedPatient.firstName} {selectedPatient.lastName}
          </p>
        )}
      </div>

      {/* Rx Form */}
      {patientId && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Toggle */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              New Prescription
            </h2>

            <div className="flex items-center gap-3 mb-6">
              <span className="text-sm font-medium text-gray-700">Type:</span>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, type: 'spectacle' }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.type === 'spectacle'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Spectacle
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, type: 'contact_lens' }))}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  form.type === 'contact_lens'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Contact Lens
              </button>
            </div>

            {/* Linked Exam */}
            <div className="mb-6 max-w-sm">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Linked Exam (optional)
              </label>
              <select
                value={form.examId}
                onChange={(e) => setForm((prev) => ({ ...prev, examId: e.target.value }))}
                className={INPUT_CLASS}
              >
                <option value="">— None —</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.examDate}
                    {exam.examType ? ` — ${exam.examType}` : ''}
                    {exam.provider ? ` (${exam.provider})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Rx Table */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500 w-16">
                      Eye
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Sphere
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Cylinder
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Axis
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Add
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Prism
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Base
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renderEyeRow('OD', 'od')}
                  {renderEyeRow('OS', 'os')}
                </tbody>
              </table>
            </div>

            {/* PD / Segment Height / Expiry */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  PD (Distance)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.pdDistance}
                  onChange={(e) => setForm((prev) => ({ ...prev, pdDistance: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="63"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">PD (Near)</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.pdNear}
                  onChange={(e) => setForm((prev) => ({ ...prev, pdNear: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="60"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Segment Height
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={form.segmentHeight}
                  onChange={(e) => setForm((prev) => ({ ...prev, segmentHeight: e.target.value }))}
                  className={INPUT_CLASS}
                  placeholder="mm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Expiry Date</label>
                <input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className={INPUT_CLASS}
                placeholder="Additional prescription notes…"
              />
            </div>
          </div>

          {/* Contact Lens Extension */}
          {form.type === 'contact_lens' && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                Contact Lens Details
              </h3>
              <div className="flex flex-col md:flex-row gap-8">
                {renderContactLensColumn('OD (Right)', 'contactLensOd', 'contactLensScheduleOd')}
                <div className="hidden md:block w-px bg-gray-200" />
                {renderContactLensColumn('OS (Left)', 'contactLensOs', 'contactLensScheduleOs')}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Rx
            </button>
          </div>
        </form>
      )}

      {/* Prescription History */}
      {patientId && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            Prescription History
          </h2>

          {rxLoading ? (
            <div className="flex items-center justify-center py-12">
              <Clock className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
              <p className="font-medium">No prescriptions found</p>
              <p className="text-sm">Create this patient&apos;s first prescription above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {prescriptions.map((rx) => {
                const isExpanded = expandedRxId === rx.id;
                return (
                  <div
                    key={rx.id}
                    className="rounded-lg border border-gray-200 overflow-hidden"
                  >
                    {/* Summary row */}
                    <button
                      type="button"
                      onClick={() => setExpandedRxId(isExpanded ? null : rx.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm text-gray-500">
                          {new Date(rx.createdAt).toLocaleDateString()}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            rx.type === 'contact_lens'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {rx.type === 'contact_lens' ? 'Contact Lens' : 'Spectacle'}
                        </span>
                        <span className="text-sm text-gray-700">
                          {formatRxSummary(rx.od, 'OD')}
                          {rx.od && rx.os ? ' | ' : ''}
                          {formatRxSummary(rx.os, 'OS')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            statusColors[rx.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {rx.status === 'active' && <CheckCircle className="h-3 w-3" />}
                          {rx.status === 'expired' && <XCircle className="h-3 w-3" />}
                          {rx.status === 'superseded' && <AlertCircle className="h-3 w-3" />}
                          {rx.status.charAt(0).toUpperCase() + rx.status.slice(1)}
                        </span>
                        <Eye className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 text-sm space-y-3">
                        {/* Rx detail table */}
                        <div className="overflow-x-auto">
                          <table
                            className="w-full text-sm"
                            style={{ borderCollapse: 'collapse' }}
                          >
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 px-3 py-1 text-left text-xs font-medium text-gray-500">
                                  Eye
                                </th>
                                <th className="border border-gray-300 px-3 py-1 text-left text-xs font-medium text-gray-500">
                                  Sph
                                </th>
                                <th className="border border-gray-300 px-3 py-1 text-left text-xs font-medium text-gray-500">
                                  Cyl
                                </th>
                                <th className="border border-gray-300 px-3 py-1 text-left text-xs font-medium text-gray-500">
                                  Axis
                                </th>
                                <th className="border border-gray-300 px-3 py-1 text-left text-xs font-medium text-gray-500">
                                  Add
                                </th>
                                <th className="border border-gray-300 px-3 py-1 text-left text-xs font-medium text-gray-500">
                                  Prism
                                </th>
                                <th className="border border-gray-300 px-3 py-1 text-left text-xs font-medium text-gray-500">
                                  Base
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rx.od && (
                                <tr>
                                  <td className="border border-gray-300 px-3 py-1 font-semibold">
                                    OD
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.od.sphere}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.od.cylinder}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.od.axis}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.od.add}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.od.prism}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.od.base}
                                  </td>
                                </tr>
                              )}
                              {rx.os && (
                                <tr>
                                  <td className="border border-gray-300 px-3 py-1 font-semibold">
                                    OS
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.os.sphere}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.os.cylinder}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.os.axis}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.os.add}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.os.prism}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-1">
                                    {rx.os.base}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap gap-4 text-gray-600">
                          {rx.pdDistance != null && (
                            <span>PD (Distance): {rx.pdDistance}</span>
                          )}
                          {rx.pdNear != null && <span>PD (Near): {rx.pdNear}</span>}
                          {rx.segmentHeight != null && (
                            <span>Seg Height: {rx.segmentHeight}</span>
                          )}
                          {rx.expiryDate && (
                            <span>
                              Expires: {new Date(rx.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Contact lens details in history */}
                        {rx.type === 'contact_lens' && (rx.contactLensOd || rx.contactLensOs) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            {rx.contactLensOd && (
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">CL — OD</p>
                                <p>BC: {rx.contactLensOd.baseCurve} | Dia: {rx.contactLensOd.diameter}</p>
                                <p>
                                  {rx.contactLensOd.brand} {rx.contactLensOd.model}{' '}
                                  {rx.contactLensOd.color}
                                </p>
                              </div>
                            )}
                            {rx.contactLensOs && (
                              <div>
                                <p className="font-semibold text-gray-700 mb-1">CL — OS</p>
                                <p>BC: {rx.contactLensOs.baseCurve} | Dia: {rx.contactLensOs.diameter}</p>
                                <p>
                                  {rx.contactLensOs.brand} {rx.contactLensOs.model}{' '}
                                  {rx.contactLensOs.color}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {rx.notes && (
                          <p className="text-gray-500 italic">Notes: {rx.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
