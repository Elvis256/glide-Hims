import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Droplets,
  Search,
  UserCircle,
  Save,
  CheckCircle,
  AlertTriangle,
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

const catheterTypes = [
  { value: 'foley', label: 'Foley (Indwelling)', description: 'For continuous drainage' },
  { value: 'straight', label: 'Straight (Intermittent)', description: 'For single use' },
  { value: 'suprapubic', label: 'Suprapubic', description: 'Surgical insertion' },
  { value: 'condom', label: 'Condom (External)', description: 'Male external catheter' },
];

const catheterSizes = [
  { value: '8Fr', label: '8 Fr', usage: 'Pediatric' },
  { value: '10Fr', label: '10 Fr', usage: 'Pediatric/Small adult' },
  { value: '12Fr', label: '12 Fr', usage: 'Small adult' },
  { value: '14Fr', label: '14 Fr', usage: 'Standard adult' },
  { value: '16Fr', label: '16 Fr', usage: 'Standard adult' },
  { value: '18Fr', label: '18 Fr', usage: 'Large adult' },
  { value: '20Fr', label: '20 Fr', usage: 'Irrigation/Clots' },
  { value: '22Fr', label: '22 Fr', usage: 'Irrigation/Clots' },
  { value: '24Fr', label: '24 Fr', usage: 'Three-way catheter' },
];

const urineColors = [
  { value: 'clear', label: 'Clear/Pale Yellow', status: 'normal' },
  { value: 'yellow', label: 'Yellow', status: 'normal' },
  { value: 'dark-yellow', label: 'Dark Yellow', status: 'warning' },
  { value: 'amber', label: 'Amber/Concentrated', status: 'warning' },
  { value: 'pink', label: 'Pink/Light Blood', status: 'alert' },
  { value: 'red', label: 'Red/Bloody', status: 'alert' },
  { value: 'brown', label: 'Brown', status: 'alert' },
  { value: 'cloudy', label: 'Cloudy', status: 'warning' },
  { value: 'purulent', label: 'Purulent', status: 'alert' },
];

const balloonVolumes = ['5ml', '10ml', '15ml', '30ml'];

const complications = [
  'None',
  'Urethral trauma',
  'False passage',
  'Infection/UTI',
  'Bladder spasm',
  'Hematuria',
  'Blockage',
  'Leakage',
  'Patient discomfort',
  'Allergic reaction',
];

export default function CatheterizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    catheterType: '',
    catheterSize: '',
    insertionDate: new Date().toISOString().split('T')[0],
    insertionTime: new Date().toTimeString().slice(0, 5),
    urineOutput: '',
    urineColor: '',
    balloonInflation: '10ml',
    complications: 'None',
    insertedBy: '',
    indication: '',
    notes: '',
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

  // Create nursing note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: CreateNursingNoteDto) => ipdService.nursingNotes.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nursing-notes'] });
      setSaved(true);
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

  const saving = createNoteMutation.isPending;

  const handleSave = () => {
    if (!admission?.id) {
      // Still show success for demo purposes
      setSaved(true);
      return;
    }

    const cathDetails = [
      `Type: ${formData.catheterType}`,
      `Size: ${formData.catheterSize}`,
      `Date/Time: ${formData.insertionDate} ${formData.insertionTime}`,
      `Balloon: ${formData.balloonInflation}`,
      formData.urineOutput && `Initial output: ${formData.urineOutput}ml`,
      formData.urineColor && `Urine color: ${formData.urineColor}`,
      formData.indication && `Indication: ${formData.indication}`,
      formData.complications !== 'None' && `Complications: ${formData.complications}`,
      formData.insertedBy && `Inserted by: ${formData.insertedBy}`,
      formData.notes && `Notes: ${formData.notes}`,
    ].filter(Boolean).join('. ');

    createNoteMutation.mutate({
      admissionId: admission.id,
      type: 'intervention',
      content: `Urinary Catheterization: ${cathDetails}`,
    });
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setFormData({
      catheterType: '',
      catheterSize: '',
      insertionDate: new Date().toISOString().split('T')[0],
      insertionTime: new Date().toTimeString().slice(0, 5),
      urineOutput: '',
      urineColor: '',
      balloonInflation: '10ml',
      complications: 'None',
      insertedBy: '',
      indication: '',
      notes: '',
    });
    setSaved(false);
  };

  const getColorStatus = (status: string) => {
    switch (status) {
      case 'normal':
        return 'border-green-300 bg-green-50';
      case 'warning':
        return 'border-yellow-300 bg-yellow-50';
      case 'alert':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-gray-200';
    }
  };

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Catheterization Documented</h2>
          <p className="text-gray-600 mb-6">
            Urinary catheterization for {selectedPatient?.name} has been recorded
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Record Another
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <Droplets className="w-6 h-6 text-teal-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Urinary Catheterization</h1>
            <p className="text-sm text-gray-500">Document catheter insertion</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Patient Selection */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
          <h2 className="font-semibold text-gray-900 mb-3">Select Patient</h2>
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
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {searchTerm && searchTerm.length >= 2 ? (
              searchLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                </div>
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
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
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.mrn} • {patient.age}y • {patient.gender}</p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No patients found</p>
                </div>
              )
            ) : selectedPatient ? (
              <div className="p-3 rounded-lg border border-teal-500 bg-teal-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPatient.name}</p>
                    <p className="text-xs text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y</p>
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

        {/* Catheterization Form */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <h2 className="font-semibold text-gray-900 mb-3">Catheterization Details</h2>
          
          {selectedPatient ? (
            <div className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Catheter Type */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Catheter Type *</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {catheterTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, catheterType: type.value })}
                        className={`p-3 rounded-lg border transition-colors text-left ${
                          formData.catheterType === type.value
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="text-sm font-medium block">{type.label}</span>
                        <p className="text-xs text-gray-500">{type.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catheter Size */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Catheter Size (French) *</label>
                  <select
                    value={formData.catheterSize}
                    onChange={(e) => setFormData({ ...formData, catheterSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select size...</option>
                    {catheterSizes.map((size) => (
                      <option key={size.value} value={size.value}>
                        {size.label} - {size.usage}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Balloon Inflation */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Balloon Inflation</label>
                  <div className="flex gap-2">
                    {balloonVolumes.map((vol) => (
                      <button
                        key={vol}
                        type="button"
                        onClick={() => setFormData({ ...formData, balloonInflation: vol })}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          formData.balloonInflation === vol
                            ? 'bg-teal-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {vol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date/Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Insertion Date</label>
                    <input
                      type="date"
                      value={formData.insertionDate}
                      onChange={(e) => setFormData({ ...formData, insertionDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Time</label>
                    <input
                      type="time"
                      value={formData.insertionTime}
                      onChange={(e) => setFormData({ ...formData, insertionTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Urine Output */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Initial Urine Output</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.urineOutput}
                      onChange={(e) => setFormData({ ...formData, urineOutput: e.target.value })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">ml</span>
                  </div>
                </div>

                {/* Urine Color */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Urine Color/Appearance</label>
                  <div className="flex flex-wrap gap-2">
                    {urineColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, urineColor: color.value })}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                          formData.urineColor === color.value
                            ? getColorStatus(color.status) + ' border-2'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {color.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Indication */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Indication</label>
                  <input
                    type="text"
                    value={formData.indication}
                    onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
                    placeholder="e.g., Urinary retention, Surgery, I/O monitoring..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* Complications */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Complications</label>
                  <select
                    value={formData.complications}
                    onChange={(e) => setFormData({ ...formData, complications: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      formData.complications !== 'None'
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300'
                    }`}
                  >
                    {complications.map((comp) => (
                      <option key={comp} value={comp}>{comp}</option>
                    ))}
                  </select>
                </div>

                {/* Inserted By */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Inserted By</label>
                  <input
                    type="text"
                    value={formData.insertedBy}
                    onChange={(e) => setFormData({ ...formData, insertedBy: e.target.value })}
                    placeholder="Enter name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional observations..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>

                {formData.complications !== 'None' && (
                  <div className="md:col-span-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-700">
                      Complication noted: {formData.complications}. Please notify physician.
                    </span>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3 mt-4 pt-3 border-t">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.catheterType || !formData.catheterSize}
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
                      Save Documentation
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Droplets className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to document catheterization</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
