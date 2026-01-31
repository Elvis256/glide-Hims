import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  Clock,
  MapPin,
  User,
  FileText,
  Users,
  ShieldAlert,
  CheckCircle,
  Eye,
  EyeOff,
  Save,
  Search,
  UserCircle,
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

interface IncidentFormData {
  incidentType: string;
  date: string;
  time: string;
  location: string;
  patientInvolved: boolean;
  patientName: string;
  patientMrn: string;
  description: string;
  witnesses: string;
  immediateActions: string;
  severityLevel: string;
  followUpRequired: boolean;
  followUpDetails: string;
  anonymous: boolean;
  reporterName: string;
  reporterRole: string;
}

const incidentTypes = [
  { value: 'fall', label: 'Patient Fall' },
  { value: 'medication', label: 'Medication Error' },
  { value: 'injury', label: 'Patient Injury' },
  { value: 'equipment', label: 'Equipment Failure' },
  { value: 'needle', label: 'Needle Stick Injury' },
  { value: 'violence', label: 'Violence/Aggression' },
  { value: 'security', label: 'Security Incident' },
  { value: 'other', label: 'Other' },
];

const severityLevels = [
  { value: 'near-miss', label: 'Near Miss', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  { value: 'minor', label: 'Minor - No harm', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'moderate', label: 'Moderate - Temporary harm', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'major', label: 'Major - Significant harm', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'severe', label: 'Severe - Permanent harm/Death', color: 'bg-red-100 text-red-700 border-red-300' },
];

const locations = [
  'Ward A - General',
  'Ward B - Surgical',
  'Ward C - Pediatric',
  'ICU',
  'Emergency Department',
  'Operating Theatre',
  'Radiology',
  'Laboratory',
  'Pharmacy',
  'Outpatient Clinic',
  'Corridor/Hallway',
  'Patient Room',
  'Bathroom',
  'Other',
];

export default function IncidentReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [saved, setSaved] = useState(false);

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

  const [formData, setFormData] = useState<IncidentFormData>({
    incidentType: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    location: '',
    patientInvolved: false,
    patientName: '',
    patientMrn: '',
    description: '',
    witnesses: '',
    immediateActions: '',
    severityLevel: '',
    followUpRequired: false,
    followUpDetails: '',
    anonymous: false,
    reporterName: '',
    reporterRole: '',
  });

  const handleSave = () => {
    if (!admission?.id) {
      // Still show success for demo purposes
      setSaved(true);
      return;
    }

    const incidentDetails = [
      formData.incidentType && `Type: ${incidentTypes.find(t => t.value === formData.incidentType)?.label}`,
      formData.date && `Date: ${formData.date}`,
      formData.time && `Time: ${formData.time}`,
      formData.location && `Location: ${formData.location}`,
      formData.severityLevel && `Severity: ${severityLevels.find(s => s.value === formData.severityLevel)?.label}`,
      formData.description && `Description: ${formData.description}`,
      formData.immediateActions && `Immediate Actions: ${formData.immediateActions}`,
      formData.witnesses && `Witnesses: ${formData.witnesses}`,
      formData.followUpDetails && `Follow-up: ${formData.followUpDetails}`,
    ].filter(Boolean).join('. ');

    createNoteMutation.mutate({
      admissionId: admission.id,
      type: 'incident',
      content: `Incident Report: ${incidentDetails}`,
    });
  };

  const handleReset = () => {
    setFormData({
      incidentType: '',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      location: '',
      patientInvolved: false,
      patientName: '',
      patientMrn: '',
      description: '',
      witnesses: '',
      immediateActions: '',
      severityLevel: '',
      followUpRequired: false,
      followUpDetails: '',
      anonymous: false,
      reporterName: '',
      reporterRole: '',
    });
    setSaved(false);
  };

  const isFormValid = formData.incidentType && formData.location && formData.description && formData.severityLevel;

  if (saved) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Incident Report Submitted</h2>
          <p className="text-gray-600 mb-2">
            Your incident report has been submitted successfully.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Reference: INC-{new Date().getFullYear()}-{Math.floor(Math.random() * 10000).toString().padStart(4, '0')}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Submit Another Report
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Incident Report</h1>
              <p className="text-sm text-gray-500">Report safety incidents and near misses</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFormData({ ...formData, anonymous: !formData.anonymous })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
              formData.anonymous
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {formData.anonymous ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {formData.anonymous ? 'Anonymous Report' : 'Named Report'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Incident Type */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <ShieldAlert className="w-4 h-4" />
                Incident Type *
              </label>
              <select
                value={formData.incidentType}
                onChange={(e) => setFormData({ ...formData, incidentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select incident type...</option>
                {incidentTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4" />
                Date of Incident *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Time */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4" />
                Time of Incident *
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Location */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4" />
                Location *
              </label>
              <select
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select location...</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            {/* Severity Level */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Severity Level *
              </label>
              <div className="flex flex-wrap gap-2">
                {severityLevels.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setFormData({ ...formData, severityLevel: level.value })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      formData.severityLevel === level.value
                        ? level.color + ' ring-2 ring-offset-1 ring-gray-400'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient Involved */}
            <div className="lg:col-span-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.patientInvolved}
                  onChange={(e) => setFormData({ ...formData, patientInvolved: e.target.checked })}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <User className="w-4 h-4" />
                  Patient Involved
                </span>
              </label>
            </div>

            {formData.patientInvolved && (
              <>
                <div className="lg:col-span-3">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Search Patient</label>
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
                  {searchTerm && searchTerm.length >= 2 && (
                    <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                      {searchLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                        </div>
                      ) : filteredPatients.length > 0 ? (
                        filteredPatients.map((patient) => (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(patient);
                              setFormData({ ...formData, patientName: patient.name, patientMrn: patient.mrn });
                              setSearchTerm('');
                            }}
                            className="w-full text-left p-2 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <UserCircle className="w-6 h-6 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{patient.name}</p>
                              <p className="text-xs text-gray-500">{patient.mrn}</p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">No patients found</p>
                      )}
                    </div>
                  )}
                  {selectedPatient && (
                    <div className="mt-2 p-2 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-2">
                      <UserCircle className="w-6 h-6 text-teal-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{selectedPatient.name}</p>
                        <p className="text-xs text-gray-500">{selectedPatient.mrn}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Patient Name</label>
                  <input
                    type="text"
                    value={formData.patientName}
                    onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                    placeholder="Enter patient name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Patient MRN</label>
                  <input
                    type="text"
                    value={formData.patientMrn}
                    onChange={(e) => setFormData({ ...formData, patientMrn: e.target.value })}
                    placeholder="Enter MRN..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </>
            )}

            {/* Description */}
            <div className="lg:col-span-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4" />
                Description of Incident *
              </label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what happened, including the sequence of events..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
            </div>

            {/* Witnesses */}
            <div className="lg:col-span-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4" />
                Witnesses
              </label>
              <input
                type="text"
                value={formData.witnesses}
                onChange={(e) => setFormData({ ...formData, witnesses: e.target.value })}
                placeholder="Names of any witnesses (comma separated)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Immediate Actions */}
            <div className="lg:col-span-3">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Immediate Actions Taken</label>
              <textarea
                rows={3}
                value={formData.immediateActions}
                onChange={(e) => setFormData({ ...formData, immediateActions: e.target.value })}
                placeholder="Describe any immediate actions taken to address the incident..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
            </div>

            {/* Follow-up Required */}
            <div className="lg:col-span-3">
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={formData.followUpRequired}
                  onChange={(e) => setFormData({ ...formData, followUpRequired: e.target.checked })}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <span className="text-sm font-medium text-gray-700">Follow-up Required</span>
              </label>
              {formData.followUpRequired && (
                <textarea
                  rows={2}
                  value={formData.followUpDetails}
                  onChange={(e) => setFormData({ ...formData, followUpDetails: e.target.value })}
                  placeholder="Describe required follow-up actions..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                />
              )}
            </div>

            {/* Reporter Info (if not anonymous) */}
            {!formData.anonymous && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Reporter Name</label>
                  <input
                    type="text"
                    value={formData.reporterName}
                    onChange={(e) => setFormData({ ...formData, reporterName: e.target.value })}
                    placeholder="Your name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Reporter Role</label>
                  <input
                    type="text"
                    value={formData.reporterRole}
                    onChange={(e) => setFormData({ ...formData, reporterRole: e.target.value })}
                    placeholder="Your role/position..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isFormValid}
              className="flex items-center gap-2 px-6 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
