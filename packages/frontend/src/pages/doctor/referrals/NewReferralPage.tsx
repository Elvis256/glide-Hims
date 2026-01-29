import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Send,
  User,
  ChevronDown,
  Building2,
  MapPin,
  Calendar,
  Paperclip,
  AlertCircle,
  FileText,
  Stethoscope,
  Hospital,
  ExternalLink,
  X,
  Check,
  Search,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../../services/patients';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  dateOfBirth: string;
  gender: string;
  currentDiagnosis: string;
}

interface Department {
  id: string;
  name: string;
  doctors: { id: string; name: string; specialty: string }[];
}

interface Document {
  id: string;
  name: string;
  type: 'lab' | 'imaging' | 'report';
  date: string;
}

const departments: Department[] = [];

const patientDocuments: Document[] = [];

const urgencyLevels = [
  { value: 'routine', label: 'Routine', color: 'bg-gray-100 text-gray-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-amber-100 text-amber-700' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700' },
];

export default function NewReferralPage() {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');

  // Fetch patients based on search
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length > 1,
  });

  // Transform patient data to match the expected interface
  const patients: Patient[] = useMemo(() => {
    return (patientsData?.data || []).map(p => ({
      id: p.id,
      name: p.fullName,
      mrn: p.mrn,
      dateOfBirth: p.dateOfBirth,
      gender: p.gender.charAt(0).toUpperCase() + p.gender.slice(1),
      currentDiagnosis: p.metadata?.currentDiagnosis 
        ? String(p.metadata.currentDiagnosis) 
        : 'No diagnosis on file',
    }));
  }, [patientsData]);

  const [referralType, setReferralType] = useState<'internal' | 'external'>('internal');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [externalFacility, setExternalFacility] = useState('');
  const [externalAddress, setExternalAddress] = useState('');
  const [externalDoctor, setExternalDoctor] = useState('');
  const [urgency, setUrgency] = useState('routine');
  const [referralReason, setReferralReason] = useState('');
  const [clinicalSummary, setClinicalSummary] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);

  const availableDoctors = useMemo(() => {
    if (!selectedDepartment) return [];
    const dept = departments.find((d) => d.id === selectedDepartment);
    return dept?.doctors || [];
  }, [selectedDepartment]);

  const toggleDocument = (docId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const selectedDocs = patientDocuments.filter((d) => selectedDocuments.includes(d.id));

  const canSubmit = useMemo(() => {
    if (!selectedPatient || !referralReason.trim()) return false;
    if (referralType === 'internal') {
      return selectedDepartment !== '' && selectedDoctor !== '';
    } else {
      return externalFacility.trim() !== '';
    }
  }, [selectedPatient, referralReason, referralType, selectedDepartment, selectedDoctor, externalFacility]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    alert('Referral submitted successfully!');
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Send className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">New Referral</h1>
            <p className="text-sm text-gray-500">Create a patient referral</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
          Submit Referral
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Form */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Patient Selector */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
            <div className="relative">
              <button
                onClick={() => setPatientDropdownOpen(!patientDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 border rounded-lg bg-white hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className={selectedPatient ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedPatient ? selectedPatient.name : 'Choose a patient...'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {patientDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search patients..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {patientsLoading && (
                      <div className="flex items-center justify-center py-4 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Searching...
                      </div>
                    )}
                    {!patientsLoading && patientSearch.length > 1 && patients.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">No patients found</div>
                    )}
                    {!patientsLoading && patientSearch.length <= 1 && (
                      <div className="px-4 py-3 text-sm text-gray-500">Type at least 2 characters to search</div>
                    )}
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientDropdownOpen(false);
                          setPatientSearch('');
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{patient.name}</div>
                        <div className="text-sm text-gray-500">
                          {patient.dateOfBirth} • {patient.gender} • {patient.mrn}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {selectedPatient && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-blue-800">Current Diagnosis</div>
                    <div className="text-sm text-blue-700">{selectedPatient.currentDiagnosis}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Referral Type */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">Referral Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setReferralType('internal')}
                className={`p-4 rounded-lg border-2 flex items-center gap-3 transition-colors ${
                  referralType === 'internal'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Hospital className={`w-5 h-5 ${referralType === 'internal' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className={`font-medium ${referralType === 'internal' ? 'text-indigo-900' : 'text-gray-900'}`}>
                    Internal Referral
                  </div>
                  <div className="text-sm text-gray-500">Within this hospital</div>
                </div>
              </button>
              <button
                onClick={() => setReferralType('external')}
                className={`p-4 rounded-lg border-2 flex items-center gap-3 transition-colors ${
                  referralType === 'external'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <ExternalLink className={`w-5 h-5 ${referralType === 'external' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div className="text-left">
                  <div className={`font-medium ${referralType === 'external' ? 'text-indigo-900' : 'text-gray-900'}`}>
                    External Referral
                  </div>
                  <div className="text-sm text-gray-500">Another facility</div>
                </div>
              </button>
            </div>
          </div>

          {/* Internal Referral Details */}
          {referralType === 'internal' && (
            <div className="bg-white rounded-lg border p-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-4">Referral Destination</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  {departments.length === 0 ? (
                    <div className="text-sm text-gray-500 italic py-2">No departments available</div>
                  ) : (
                    <select
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        setSelectedDoctor('');
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select department...</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    disabled={!selectedDepartment}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                  >
                    <option value="">Select doctor...</option>
                    {availableDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} - {doc.specialty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* External Referral Details */}
          {referralType === 'external' && (
            <div className="bg-white rounded-lg border p-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-4">External Facility Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      Facility Name
                    </div>
                  </label>
                  <input
                    type="text"
                    value={externalFacility}
                    onChange={(e) => setExternalFacility(e.target.value)}
                    placeholder="Enter facility name..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      Address
                    </div>
                  </label>
                  <input
                    type="text"
                    value={externalAddress}
                    onChange={(e) => setExternalAddress(e.target.value)}
                    placeholder="Enter facility address..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      Receiving Doctor (Optional)
                    </div>
                  </label>
                  <input
                    type="text"
                    value={externalDoctor}
                    onChange={(e) => setExternalDoctor(e.target.value)}
                    placeholder="Enter doctor's name..."
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Urgency */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">Urgency Level</label>
            <div className="flex gap-3">
              {urgencyLevels.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setUrgency(level.value)}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors border-2 ${
                    urgency === level.value
                      ? level.value === 'emergency'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : level.value === 'urgent'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
            {urgency === 'emergency' && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div className="text-sm text-red-700">
                  Emergency referrals require immediate attention and will be prioritized.
                </div>
              </div>
            )}
          </div>

          {/* Reason for Referral */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason for Referral *</label>
            <textarea
              value={referralReason}
              onChange={(e) => setReferralReason(e.target.value)}
              placeholder="Describe the reason for this referral..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Clinical Summary */}
          <div className="bg-white rounded-lg border p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Clinical Summary</label>
            <textarea
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              placeholder="Provide relevant clinical history, findings, and treatment to date..."
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Preferred Date */}
          <div className="bg-white rounded-lg border p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Preferred Appointment Date
              </div>
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Sidebar - Attachments */}
        <div className="w-80 bg-white border-l p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attach Documents
            </h3>
            <button
              onClick={() => setShowDocumentPicker(!showDocumentPicker)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showDocumentPicker ? 'Done' : 'Select'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">Attach relevant lab results, imaging, or reports</p>

          {showDocumentPicker ? (
            patientDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No documents available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {patientDocuments.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => toggleDocument(doc.id)}
                    className={`w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-colors ${
                      selectedDocuments.includes(doc.id)
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center ${
                        selectedDocuments.includes(doc.id)
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedDocuments.includes(doc.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{doc.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            doc.type === 'lab'
                              ? 'bg-purple-100 text-purple-700'
                              : doc.type === 'imaging'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {doc.type}
                        </span>
                        <span>{doc.date}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : selectedDocs.length > 0 ? (
            <div className="space-y-2">
              {selectedDocs.map((doc) => (
                <div key={doc.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{doc.name}</div>
                      <div className="text-xs text-gray-500">{doc.date}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleDocument(doc.id)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No documents attached</p>
              <button
                onClick={() => setShowDocumentPicker(true)}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
              >
                Select documents
              </button>
            </div>
          )}

          {/* Referral Summary */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-medium text-gray-900 mb-3">Referral Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Patient</span>
                <span className="text-gray-900 font-medium">{selectedPatient?.name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="text-gray-900 capitalize">{referralType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Urgency</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    urgency === 'emergency'
                      ? 'bg-red-100 text-red-700'
                      : urgency === 'urgent'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Attachments</span>
                <span className="text-gray-900">{selectedDocuments.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
