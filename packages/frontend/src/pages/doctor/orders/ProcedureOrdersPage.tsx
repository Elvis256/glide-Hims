import { usePermissions } from '../../../components/PermissionGate';
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Syringe,
  Search,
  User,
  Calendar,
  Clock,
  CheckSquare,
  Square,
  FileText,
  Send,
  Info,
  AlertCircle,
  Shield,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { patientsService } from '../../../services/patients';

const calculateAge = (dateOfBirth: string): number => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

interface Patient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
}

interface Procedure {
  id: string;
  name: string;
  category: string;
  description: string;
  duration: string;
  anesthesia: string;
  preReqs: string[];
}

const procedures: Procedure[] = [
  {
    id: '1',
    name: 'Skin Lesion Excision',
    category: 'Minor Surgery',
    description: 'Surgical removal of skin lesions, moles, or cysts',
    duration: '30-60 min',
    anesthesia: 'Local',
    preReqs: ['NPO 2 hours', 'Consent form', 'Allergy check'],
  },
  {
    id: '2',
    name: 'Lipoma Removal',
    category: 'Minor Surgery',
    description: 'Excision of benign fatty tumors',
    duration: '45-90 min',
    anesthesia: 'Local',
    preReqs: ['NPO 2 hours', 'Consent form', 'Labs within 30 days'],
  },
  {
    id: '3',
    name: 'Abscess Incision & Drainage',
    category: 'Minor Surgery',
    description: 'Drainage of localized infection',
    duration: '20-40 min',
    anesthesia: 'Local',
    preReqs: ['Consent form', 'Allergy check'],
  },
  {
    id: '4',
    name: 'Wound Debridement',
    category: 'Wound Care',
    description: 'Removal of dead tissue from wounds',
    duration: '30-60 min',
    anesthesia: 'Local/None',
    preReqs: ['Wound assessment', 'Consent form'],
  },
  {
    id: '5',
    name: 'Wound Closure/Suturing',
    category: 'Wound Care',
    description: 'Primary closure of lacerations',
    duration: '15-45 min',
    anesthesia: 'Local',
    preReqs: ['Tetanus status', 'Allergy check'],
  },
  {
    id: '6',
    name: 'Dressing Change',
    category: 'Wound Care',
    description: 'Wound dressing and care',
    duration: '15-30 min',
    anesthesia: 'None',
    preReqs: ['Wound assessment'],
  },
  {
    id: '7',
    name: 'Joint Injection (Corticosteroid)',
    category: 'Injections',
    description: 'Intra-articular steroid injection for inflammation',
    duration: '15-30 min',
    anesthesia: 'Local',
    preReqs: ['Consent form', 'Allergy check', 'Recent imaging'],
  },
  {
    id: '8',
    name: 'Trigger Point Injection',
    category: 'Injections',
    description: 'Treatment of muscle knots and myofascial pain',
    duration: '15-20 min',
    anesthesia: 'None',
    preReqs: ['Consent form'],
  },
  {
    id: '9',
    name: 'Nerve Block',
    category: 'Injections',
    description: 'Regional anesthesia or therapeutic nerve block',
    duration: '20-45 min',
    anesthesia: 'Local',
    preReqs: ['Consent form', 'Allergy check', 'NPO if sedation'],
  },
  {
    id: '10',
    name: 'Skin Biopsy (Punch)',
    category: 'Biopsies',
    description: 'Cylindrical sample of skin for pathology',
    duration: '15-30 min',
    anesthesia: 'Local',
    preReqs: ['Consent form', 'Bleeding history'],
  },
  {
    id: '11',
    name: 'Skin Biopsy (Shave)',
    category: 'Biopsies',
    description: 'Superficial skin sample',
    duration: '10-20 min',
    anesthesia: 'Local',
    preReqs: ['Consent form'],
  },
  {
    id: '12',
    name: 'Fine Needle Aspiration',
    category: 'Biopsies',
    description: 'Needle aspiration for cytology',
    duration: '20-30 min',
    anesthesia: 'Local/None',
    preReqs: ['Consent form', 'Recent imaging', 'Bleeding history'],
  },
];

const categories = ['Minor Surgery', 'Wound Care', 'Injections', 'Biopsies'];
const anesthesiaOptions = ['None', 'Local', 'Local with Sedation', 'Regional', 'General'];
const consentStatuses = ['Not Obtained', 'Verbal Consent', 'Written Consent Signed'];

export default function ProcedureOrdersPage() {
  const { hasPermission } = usePermissions();
  if (!hasPermission('orders.create')) {
    return <div className="p-8 text-center text-red-600">No permission to create procedure orders.</div>;
  }
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Minor Surgery');
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [preReqsCompleted, setPreReqsCompleted] = useState<string[]>([]);
  const [consentStatus, setConsentStatus] = useState('Not Obtained');
  const [anesthesia, setAnesthesia] = useState('Local');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const [procedureSearch, setProcedureSearch] = useState('');

  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 10 }),
    enabled: patientSearch.length > 1,
  });
  const patients = patientsData?.data || [];

  const patientList: Patient[] = patients.map((p) => ({
    id: p.id,
    name: p.fullName,
    mrn: p.mrn,
    age: calculateAge(p.dateOfBirth),
    gender: p.gender.charAt(0).toUpperCase() + p.gender.slice(1),
  }));

  const filteredProcedures = useMemo(() => {
    return procedures.filter(
      (proc) =>
        proc.category === activeCategory &&
        (proc.name.toLowerCase().includes(procedureSearch.toLowerCase()) ||
          proc.description.toLowerCase().includes(procedureSearch.toLowerCase()))
    );
  }, [activeCategory, procedureSearch]);

  const togglePreReq = (req: string) => {
    setPreReqsCompleted((prev) =>
      prev.includes(req) ? prev.filter((r) => r !== req) : [...prev, req]
    );
  };

  const allPreReqsMet = useMemo(() => {
    if (!selectedProcedure) return false;
    return selectedProcedure.preReqs.every((req) => preReqsCompleted.includes(req));
  }, [selectedProcedure, preReqsCompleted]);

  const handleSubmit = () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }
    if (!selectedProcedure) {
      toast.error('Please select a procedure');
      return;
    }
    if (consentStatus === 'Not Obtained') {
      toast.error('Consent must be obtained before scheduling');
      return;
    }
    toast.success(`Procedure order submitted!\nPatient: ${selectedPatient.name}\nProcedure: ${selectedProcedure.name}\nDate: ${scheduledDate || 'TBD'} ${scheduledTime || ''}`);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Syringe className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Procedure Orders</h1>
              <p className="text-sm text-gray-500">Schedule procedures and interventions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Procedure Selection */}
        <div className="flex-1 flex flex-col overflow-hidden border-r bg-white">
          {/* Patient Selector */}
          <div className="p-4 border-b">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or MRN..."
                value={selectedPatient ? selectedPatient.name : patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setSelectedPatient(null);
                  setShowPatientDropdown(true);
                }}
                onFocus={() => setShowPatientDropdown(true)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              {showPatientDropdown && !selectedPatient && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {patientsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-green-600" />
                    </div>
                  ) : patientList.length === 0 && patientSearch.length > 1 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">No patients found</div>
                  ) : (
                    patientList.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatient(patient);
                        setShowPatientDropdown(false);
                        setPatientSearch('');
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="font-medium">{patient.name}</span>
                      <span className="text-sm text-gray-500">{patient.mrn}</span>
                    </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedPatient && (
              <div className="mt-2 text-sm text-gray-600">
                {selectedPatient.age}y {selectedPatient.gender} • {selectedPatient.mrn}
              </div>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex border-b overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setSelectedProcedure(null);
                  setPreReqsCompleted([]);
                }}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeCategory === category
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Procedure Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search procedures..."
                value={procedureSearch}
                onChange={(e) => setProcedureSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Procedure List */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
              {filteredProcedures.map((proc) => (
                <button
                  key={proc.id}
                  onClick={() => {
                    setSelectedProcedure(proc);
                    setPreReqsCompleted([]);
                    setAnesthesia(proc.anesthesia);
                  }}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${
                    selectedProcedure?.id === proc.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-medium text-gray-900">{proc.name}</span>
                      <p className="text-sm text-gray-500 mt-1">{proc.description}</p>
                    </div>
                    {selectedProcedure?.id === proc.id && (
                      <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {proc.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" />
                      {proc.anesthesia}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Order Details */}
        <div className="w-96 flex flex-col overflow-hidden bg-gray-50">
          {selectedProcedure ? (
            <>
              {/* Selected Procedure Info */}
              <div className="p-4 border-b bg-white">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Syringe className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedProcedure.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{selectedProcedure.description}</p>
                  </div>
                </div>
              </div>

              {/* Pre-Procedure Requirements */}
              <div className="p-4 border-b bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Pre-Procedure Requirements
                </label>
                <div className="space-y-2">
                  {selectedProcedure.preReqs.map((req) => (
                    <button
                      key={req}
                      onClick={() => togglePreReq(req)}
                      className={`w-full p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                        preReqsCompleted.includes(req)
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {preReqsCompleted.includes(req) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                      {req}
                    </button>
                  ))}
                </div>
                {!allPreReqsMet && (
                  <div className="mt-2 flex items-center gap-2 text-amber-600 text-xs">
                    <AlertCircle className="w-4 h-4" />
                    Complete all requirements before scheduling
                  </div>
                )}
              </div>

              {/* Consent Status */}
              <div className="p-4 border-b bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Consent Status
                </label>
                <div className="space-y-2">
                  {consentStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => setConsentStatus(status)}
                      className={`w-full p-2 rounded-lg border text-left text-sm flex items-center gap-2 transition-colors ${
                        consentStatus === status
                          ? status === 'Written Consent Signed'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : status === 'Verbal Consent'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {consentStatus === status ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scheduling */}
              <div className="p-4 border-b bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Scheduling Preferences
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Time</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Anesthesia */}
              <div className="p-4 border-b bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-2">Anesthesia</label>
                <select
                  value={anesthesia}
                  onChange={(e) => setAnesthesia(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  {anesthesiaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="p-4 border-b bg-white flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions..."
                  rows={2}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                />
              </div>

              {/* Submit */}
              <div className="p-4 border-t bg-white">
                <button
                  onClick={handleSubmit}
                  disabled={!selectedPatient || !selectedProcedure || consentStatus === 'Not Obtained'}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Submit Order
                </button>
                <p className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
                  <Info className="w-3 h-3" />
                  Order will be sent to scheduling
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Syringe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select a procedure to continue</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
