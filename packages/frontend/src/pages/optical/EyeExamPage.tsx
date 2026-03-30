import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Search, Plus, Trash2, Save, Clock, User } from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';

// ── Interfaces ──────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
}

interface VisualAcuity {
  uncorrected: string;
  corrected: string;
}

interface Autorefraction {
  sphere: string;
  cylinder: string;
  axis: string;
}

interface SegmentField {
  status: 'normal' | 'abnormal';
  notes: string;
}

interface AnteriorSegmentEye {
  lids: SegmentField;
  conjunctiva: SegmentField;
  cornea: SegmentField;
  lens: SegmentField;
}

interface PosteriorSegmentEye {
  disc: SegmentField;
  macula: SegmentField;
  vessels: SegmentField;
  periphery: SegmentField;
}

interface Diagnosis {
  id: string;
  code: string;
  description: string;
}

interface FormData {
  examType: string;
  chiefComplaint: string;
  visualAcuityOD: VisualAcuity;
  visualAcuityOS: VisualAcuity;
  autorefractionOD: Autorefraction;
  autorefractionOS: Autorefraction;
  iopOD: string;
  iopOS: string;
  iopMethod: string;
  anteriorSegmentOD: AnteriorSegmentEye;
  anteriorSegmentOS: AnteriorSegmentEye;
  posteriorSegmentOD: PosteriorSegmentEye;
  posteriorSegmentOS: PosteriorSegmentEye;
  pupilReactions: string;
  colorVision: string;
  diagnoses: Diagnosis[];
  recommendations: string;
  nextExamDate: string;
}

interface ExamRecord {
  id: string;
  date: string;
  examType: string;
  visualAcuityOD?: VisualAcuity;
  visualAcuityOS?: VisualAcuity;
  diagnoses?: { code: string; description: string }[];
  examiner?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const EXAM_TYPES = [
  { value: 'comprehensive', label: 'Comprehensive' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'contact_lens_fitting', label: 'Contact Lens Fitting' },
  { value: 'visual_field', label: 'Visual Field' },
  { value: 'retinal_screening', label: 'Retinal Screening' },
];

const IOP_METHODS = [
  { value: 'goldmann', label: 'Goldmann' },
  { value: 'non_contact', label: 'Non-Contact' },
  { value: 'icare', label: 'iCare' },
  { value: 'tono_pen', label: 'Tono-Pen' },
];

const SEGMENT_LABELS: Record<string, string> = {
  lids: 'Lids',
  conjunctiva: 'Conjunctiva',
  cornea: 'Cornea',
  lens: 'Lens',
  disc: 'Disc',
  macula: 'Macula',
  vessels: 'Vessels',
  periphery: 'Periphery',
};

function makeSegmentField(): SegmentField {
  return { status: 'normal', notes: '' };
}

function makeAnteriorSegment(): AnteriorSegmentEye {
  return {
    lids: makeSegmentField(),
    conjunctiva: makeSegmentField(),
    cornea: makeSegmentField(),
    lens: makeSegmentField(),
  };
}

function makePosteriorSegment(): PosteriorSegmentEye {
  return {
    disc: makeSegmentField(),
    macula: makeSegmentField(),
    vessels: makeSegmentField(),
    periphery: makeSegmentField(),
  };
}

function initialFormData(): FormData {
  return {
    examType: 'comprehensive',
    chiefComplaint: '',
    visualAcuityOD: { uncorrected: '', corrected: '' },
    visualAcuityOS: { uncorrected: '', corrected: '' },
    autorefractionOD: { sphere: '', cylinder: '', axis: '' },
    autorefractionOS: { sphere: '', cylinder: '', axis: '' },
    iopOD: '',
    iopOS: '',
    iopMethod: 'goldmann',
    anteriorSegmentOD: makeAnteriorSegment(),
    anteriorSegmentOS: makeAnteriorSegment(),
    posteriorSegmentOD: makePosteriorSegment(),
    posteriorSegmentOS: makePosteriorSegment(),
    pupilReactions: '',
    colorVision: '',
    diagnoses: [{ id: crypto.randomUUID(), code: '', description: '' }],
    recommendations: '',
    nextExamDate: '',
  };
}

let nextDiagId = 0;
function tempId(): string {
  return `diag-${Date.now()}-${++nextDiagId}`;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
const selectClass = inputClass;
const sectionClass = 'bg-white rounded-lg shadow p-6 space-y-6';
const sectionHeader = 'text-lg font-semibold text-gray-900 border-b pb-2';
const odosGrid = 'grid grid-cols-1 md:grid-cols-2 gap-6';

// ── Component ───────────────────────────────────────────────────────────────

export default function EyeExamPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  // Patient selection
  const [searchTerm, setSearchTerm] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>(initialFormData);

  // ── Patient search query ──────────────────────────────────────────────────

  const { data: patientsData } = useQuery({
    queryKey: ['patients', 'search', searchTerm],
    queryFn: () => api.get('/patients', { params: { search: searchTerm } }),
    enabled: searchTerm.length >= 2,
  });

  const patients = asList<Patient>(patientsData);

  // ── Exam history query ────────────────────────────────────────────────────

  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: ['optical-exams', patientId],
    queryFn: () => api.get(`/optical/exams/patient/${patientId}`),
    enabled: !!patientId,
  });

  const exams = asList<ExamRecord>(examsData);

  // ── Save mutation ─────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (data: FormData & { patientId: string; facilityId: string }) =>
      api.post('/optical/exams', data),
    onSuccess: () => {
      toast.success('Eye exam saved successfully');
      queryClient.invalidateQueries({ queryKey: ['optical-exams', patientId] });
      setFormData(initialFormData());
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function selectPatient(patient: Patient) {
    setPatientId(patient.id);
    setSelectedPatient(patient);
    setSearchTerm(patient.fullName);
    setShowDropdown(false);
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    setShowDropdown(value.length >= 2);
    if (!value) {
      setPatientId(null);
      setSelectedPatient(null);
    }
  }

  function updateFormData<K extends keyof FormData>(key: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function addDiagnosis() {
    setFormData((prev) => ({
      ...prev,
      diagnoses: [...prev.diagnoses, { id: tempId(), code: '', description: '' }],
    }));
  }

  function removeDiagnosis(id: string) {
    setFormData((prev) => ({
      ...prev,
      diagnoses: prev.diagnoses.filter((d) => d.id !== id),
    }));
  }

  function updateDiagnosis(id: string, field: 'code' | 'description', value: string) {
    setFormData((prev) => ({
      ...prev,
      diagnoses: prev.diagnoses.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    }));
  }

  function handleSave() {
    if (!patientId) {
      toast.error('Please select a patient');
      return;
    }
    saveMutation.mutate({ ...formData, patientId, facilityId });
  }

  // ── Segment field updaters ────────────────────────────────────────────────

  function updateAnterior(
    eye: 'anteriorSegmentOD' | 'anteriorSegmentOS',
    field: keyof AnteriorSegmentEye,
    prop: keyof SegmentField,
    value: string,
  ) {
    setFormData((prev) => ({
      ...prev,
      [eye]: {
        ...prev[eye],
        [field]: { ...prev[eye][field], [prop]: value },
      },
    }));
  }

  function updatePosterior(
    eye: 'posteriorSegmentOD' | 'posteriorSegmentOS',
    field: keyof PosteriorSegmentEye,
    prop: keyof SegmentField,
    value: string,
  ) {
    setFormData((prev) => ({
      ...prev,
      [eye]: {
        ...prev[eye],
        [field]: { ...prev[eye][field], [prop]: value },
      },
    }));
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderEyeBadge(label: string, color: 'blue' | 'green') {
    const colors =
      color === 'blue'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-green-100 text-green-800';
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
        {label}
      </span>
    );
  }

  function renderAnteriorSegmentFields(
    eye: 'anteriorSegmentOD' | 'anteriorSegmentOS',
    data: AnteriorSegmentEye,
  ) {
    return (Object.keys(data) as (keyof AnteriorSegmentEye)[]).map((field) => (
      <div key={field} className="flex items-center gap-2">
        <label className="w-28 text-sm font-medium text-gray-700">{SEGMENT_LABELS[field]}</label>
        <select
          value={data[field].status}
          onChange={(e) => updateAnterior(eye, field, 'status', e.target.value)}
          className={`${selectClass} w-32`}
        >
          <option value="normal">Normal</option>
          <option value="abnormal">Abnormal</option>
        </select>
        <input
          type="text"
          placeholder="Notes"
          value={data[field].notes}
          onChange={(e) => updateAnterior(eye, field, 'notes', e.target.value)}
          className={inputClass}
        />
      </div>
    ));
  }

  function renderPosteriorSegmentFields(
    eye: 'posteriorSegmentOD' | 'posteriorSegmentOS',
    data: PosteriorSegmentEye,
  ) {
    return (Object.keys(data) as (keyof PosteriorSegmentEye)[]).map((field) => (
      <div key={field} className="flex items-center gap-2">
        <label className="w-28 text-sm font-medium text-gray-700">{SEGMENT_LABELS[field]}</label>
        <select
          value={data[field].status}
          onChange={(e) => updatePosterior(eye, field, 'status', e.target.value)}
          className={`${selectClass} w-32`}
        >
          <option value="normal">Normal</option>
          <option value="abnormal">Abnormal</option>
        </select>
        <input
          type="text"
          placeholder="Notes"
          value={data[field].notes}
          onChange={(e) => updatePosterior(eye, field, 'notes', e.target.value)}
          className={inputClass}
        />
      </div>
    ));
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Eye className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Eye Examination</h1>
            <p className="text-gray-500 text-sm">Comprehensive ophthalmic assessment</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Patient Selector ──────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>
            <User className="w-5 h-5 inline-block mr-2" />
            Patient
          </h3>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients by name, phone, or ID..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchTerm.length >= 2 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className={`${inputClass} pl-10`}
              />
            </div>

            {showDropdown && patients.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => selectPatient(p)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 flex items-center gap-3"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.fullName}</div>
                      <div className="text-xs text-gray-500">
                        {p.gender && <span className="capitalize">{p.gender}</span>}
                        {p.dateOfBirth && <span> · DOB: {p.dateOfBirth}</span>}
                        {p.phone && <span> · {p.phone}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && searchTerm.length >= 2 && patients.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm text-gray-500 text-center">
                No patients found
              </div>
            )}
          </div>

          {selectedPatient && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
              <User className="w-5 h-5 text-blue-600" />
              <div>
                <span className="font-medium text-blue-900">{selectedPatient.fullName}</span>
                {selectedPatient.phone && (
                  <span className="text-sm text-blue-700 ml-2">({selectedPatient.phone})</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Exam Type & Chief Complaint ───────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>Exam Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
              <select
                value={formData.examType}
                onChange={(e) => updateFormData('examType', e.target.value)}
                className={selectClass}
              >
                {EXAM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
            <textarea
              value={formData.chiefComplaint}
              onChange={(e) => updateFormData('chiefComplaint', e.target.value)}
              rows={3}
              placeholder="Describe the patient's primary concern..."
              className={inputClass}
            />
          </div>
        </div>

        {/* ── Visual Acuity ─────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>Visual Acuity</h3>

          <div className={odosGrid}>
            {/* OD */}
            <div className="space-y-3">
              <div>{renderEyeBadge('OD (Right Eye)', 'blue')}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uncorrected</label>
                <input
                  type="text"
                  placeholder="e.g. 20/20"
                  value={formData.visualAcuityOD.uncorrected}
                  onChange={(e) =>
                    updateFormData('visualAcuityOD', {
                      ...formData.visualAcuityOD,
                      uncorrected: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corrected</label>
                <input
                  type="text"
                  placeholder="e.g. 20/20"
                  value={formData.visualAcuityOD.corrected}
                  onChange={(e) =>
                    updateFormData('visualAcuityOD', {
                      ...formData.visualAcuityOD,
                      corrected: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {/* OS */}
            <div className="space-y-3">
              <div>{renderEyeBadge('OS (Left Eye)', 'green')}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Uncorrected</label>
                <input
                  type="text"
                  placeholder="e.g. 20/20"
                  value={formData.visualAcuityOS.uncorrected}
                  onChange={(e) =>
                    updateFormData('visualAcuityOS', {
                      ...formData.visualAcuityOS,
                      uncorrected: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corrected</label>
                <input
                  type="text"
                  placeholder="e.g. 20/20"
                  value={formData.visualAcuityOS.corrected}
                  onChange={(e) =>
                    updateFormData('visualAcuityOS', {
                      ...formData.visualAcuityOS,
                      corrected: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Autorefraction ────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>Autorefraction</h3>

          <div className={odosGrid}>
            {/* OD */}
            <div className="space-y-3">
              <div>{renderEyeBadge('OD (Right Eye)', 'blue')}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sphere</label>
                <input
                  type="number"
                  step={0.25}
                  value={formData.autorefractionOD.sphere}
                  onChange={(e) =>
                    updateFormData('autorefractionOD', {
                      ...formData.autorefractionOD,
                      sphere: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cylinder</label>
                <input
                  type="number"
                  step={0.25}
                  value={formData.autorefractionOD.cylinder}
                  onChange={(e) =>
                    updateFormData('autorefractionOD', {
                      ...formData.autorefractionOD,
                      cylinder: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Axis</label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={formData.autorefractionOD.axis}
                  onChange={(e) =>
                    updateFormData('autorefractionOD', {
                      ...formData.autorefractionOD,
                      axis: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {/* OS */}
            <div className="space-y-3">
              <div>{renderEyeBadge('OS (Left Eye)', 'green')}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sphere</label>
                <input
                  type="number"
                  step={0.25}
                  value={formData.autorefractionOS.sphere}
                  onChange={(e) =>
                    updateFormData('autorefractionOS', {
                      ...formData.autorefractionOS,
                      sphere: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cylinder</label>
                <input
                  type="number"
                  step={0.25}
                  value={formData.autorefractionOS.cylinder}
                  onChange={(e) =>
                    updateFormData('autorefractionOS', {
                      ...formData.autorefractionOS,
                      cylinder: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Axis</label>
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={formData.autorefractionOS.axis}
                  onChange={(e) =>
                    updateFormData('autorefractionOS', {
                      ...formData.autorefractionOS,
                      axis: e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Intraocular Pressure (IOP) ────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>Intraocular Pressure (IOP)</h3>

          <div className={odosGrid}>
            <div className="space-y-3">
              <div>{renderEyeBadge('OD (Right Eye)', 'blue')}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pressure (mmHg)
                </label>
                <input
                  type="number"
                  value={formData.iopOD}
                  onChange={(e) => updateFormData('iopOD', e.target.value)}
                  placeholder="e.g. 15"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>{renderEyeBadge('OS (Left Eye)', 'green')}</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pressure (mmHg)
                </label>
                <input
                  type="number"
                  value={formData.iopOS}
                  onChange={(e) => updateFormData('iopOS', e.target.value)}
                  placeholder="e.g. 15"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
            <select
              value={formData.iopMethod}
              onChange={(e) => updateFormData('iopMethod', e.target.value)}
              className={selectClass}
            >
              {IOP_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Anterior Segment ──────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>Anterior Segment</h3>

          <div className={odosGrid}>
            <div className="space-y-3">
              <div>{renderEyeBadge('OD (Right Eye)', 'blue')}</div>
              {renderAnteriorSegmentFields('anteriorSegmentOD', formData.anteriorSegmentOD)}
            </div>
            <div className="space-y-3">
              <div>{renderEyeBadge('OS (Left Eye)', 'green')}</div>
              {renderAnteriorSegmentFields('anteriorSegmentOS', formData.anteriorSegmentOS)}
            </div>
          </div>
        </div>

        {/* ── Posterior Segment ─────────────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>Posterior Segment</h3>

          <div className={odosGrid}>
            <div className="space-y-3">
              <div>{renderEyeBadge('OD (Right Eye)', 'blue')}</div>
              {renderPosteriorSegmentFields('posteriorSegmentOD', formData.posteriorSegmentOD)}
            </div>
            <div className="space-y-3">
              <div>{renderEyeBadge('OS (Left Eye)', 'green')}</div>
              {renderPosteriorSegmentFields('posteriorSegmentOS', formData.posteriorSegmentOS)}
            </div>
          </div>
        </div>

        {/* ── Pupil Reactions & Color Vision ─────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>Additional Tests</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pupil Reactions
              </label>
              <input
                type="text"
                value={formData.pupilReactions}
                onChange={(e) => updateFormData('pupilReactions', e.target.value)}
                placeholder="e.g. PERRLA"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color Vision</label>
              <input
                type="text"
                value={formData.colorVision}
                onChange={(e) => updateFormData('colorVision', e.target.value)}
                placeholder="e.g. Normal (Ishihara 14/14)"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ── Diagnosis ─────────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold text-gray-900">Diagnosis</h3>
            <button
              type="button"
              onClick={addDiagnosis}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-4 h-4" />
              Add Diagnosis
            </button>
          </div>

          <div className="space-y-3">
            {formData.diagnoses.map((diag) => (
              <div key={diag.id} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Code (e.g. H52.1)"
                  value={diag.code}
                  onChange={(e) => updateDiagnosis(diag.id, 'code', e.target.value)}
                  className={`${inputClass} w-40`}
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={diag.description}
                  onChange={(e) => updateDiagnosis(diag.id, 'description', e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeDiagnosis(diag.id)}
                  disabled={formData.diagnoses.length <= 1}
                  className="p-2 text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recommendations & Next Exam ────────────────────────────────── */}
        <div className={sectionClass}>
          <h3 className={sectionHeader}>Plan</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
            <textarea
              value={formData.recommendations}
              onChange={(e) => updateFormData('recommendations', e.target.value)}
              rows={3}
              placeholder="Treatment plan, prescriptions, referrals..."
              className={inputClass}
            />
          </div>

          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Exam Date</label>
            <input
              type="date"
              value={formData.nextExamDate}
              onChange={(e) => updateFormData('nextExamDate', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* ── Save Button ───────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending || !patientId}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Exam'}
          </button>
        </div>

        {/* ── Patient Exam History ───────────────────────────────────────── */}
        {patientId && (
          <div className={sectionClass}>
            <h3 className={sectionHeader}>
              <Clock className="w-5 h-5 inline-block mr-2" />
              Exam History
            </h3>

            {examsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading exam history...</div>
            ) : exams.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No previous exams found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-700">Date</th>
                      <th className="text-left p-3 font-medium text-gray-700">Exam Type</th>
                      <th className="text-left p-3 font-medium text-gray-700">Visual Acuity</th>
                      <th className="text-left p-3 font-medium text-gray-700">Diagnoses</th>
                      <th className="text-left p-3 font-medium text-gray-700">Examiner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => (
                      <tr key={exam.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-gray-900">
                          {new Date(exam.date).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-gray-700 capitalize">
                          {exam.examType?.replace(/_/g, ' ')}
                        </td>
                        <td className="p-3 text-gray-700">
                          {exam.visualAcuityOD && exam.visualAcuityOS
                            ? `OD: ${exam.visualAcuityOD.corrected || exam.visualAcuityOD.uncorrected || '—'} / OS: ${exam.visualAcuityOS.corrected || exam.visualAcuityOS.uncorrected || '—'}`
                            : '—'}
                        </td>
                        <td className="p-3 text-gray-700">
                          {exam.diagnoses?.length
                            ? exam.diagnoses.map((d) => d.code || d.description).join(', ')
                            : '—'}
                        </td>
                        <td className="p-3 text-gray-700">{exam.examiner || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
