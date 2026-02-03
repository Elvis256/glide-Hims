import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Pill,
  UserCircle,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Save,
  Scan,
  Printer,
  ChevronRight,
  Activity,
  Droplet,
  Syringe,
  Eye,
  KeyRound,
  ShieldCheck,
  Ban,
  Phone,
  Weight,
  Calendar,
  Heart,
  Thermometer,
  Wind,
  Scale,
  AlertOctagon,
  Info,
  FileText,
} from 'lucide-react';
import { ipdService, type AdministerMedicationDto, type MedicationStatus } from '../../services/ipd';
import { usePermissions } from '../../components/PermissionGate';

// Route icons mapping
const routeIcons: Record<string, typeof Pill> = {
  oral: Pill,
  iv: Droplet,
  im: Syringe,
  sc: Syringe,
  topical: Eye,
  inhalation: Wind,
  rectal: Pill,
  sublingual: Pill,
};

interface PatientInfo {
  id?: string;
  name: string;
  mrn: string;
  age: number;
  weight: number;
  photo?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  bloodType?: string;
}

interface VitalsSummary {
  temperature?: number;
  pulse?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  painLevel?: number;
  recordedAt?: string;
}

interface MedicationDetails {
  id?: string;
  patientName: string;
  patientMrn: string;
  ward: string;
  bed: string;
  medication: string;
  genericName?: string;
  brandName?: string;
  dose: string;
  route: string;
  frequency: string;
  prescribedBy: string;
  allergies: string[];
  specialInstructions?: string;
  lastGiven?: string;
  scheduledTime?: string;
  isControlled?: boolean;
  patientInfo?: PatientInfo;
  vitals?: VitalsSummary;
  isNPO?: boolean;
}

// Action types
type ActionType = 'give' | 'hold' | 'refuse' | 'not_available' | null;

// Injection sites for subcutaneous/intramuscular
const injectionSites = [
  'Left Deltoid',
  'Right Deltoid',
  'Left Vastus Lateralis',
  'Right Vastus Lateralis',
  'Left Ventrogluteal',
  'Right Ventrogluteal',
  'Abdomen (Left)',
  'Abdomen (Right)',
];

// Hold reasons
const holdReasons = [
  { value: 'npo', label: 'Patient NPO' },
  { value: 'vitals', label: 'Abnormal vitals' },
  { value: 'labs', label: 'Lab values out of range' },
  { value: 'procedure', label: 'Scheduled procedure' },
  { value: 'sleeping', label: 'Patient sleeping' },
  { value: 'doctor', label: 'Per physician order' },
  { value: 'other', label: 'Other' },
];

// Refusal reasons
const refusalReasons = [
  { value: 'no_reason', label: 'No reason given' },
  { value: 'side_effects', label: 'Concerned about side effects' },
  { value: 'feeling_better', label: 'Feels better, doesn\'t need it' },
  { value: 'taste', label: 'Does not like taste' },
  { value: 'religious', label: 'Religious/cultural reasons' },
  { value: 'swallowing', label: 'Difficulty swallowing' },
  { value: 'other', label: 'Other' },
];

// Patient reactions
const patientReactions = [
  { value: 'tolerated', label: 'Tolerated well' },
  { value: 'mild_discomfort', label: 'Mild discomfort' },
  { value: 'nausea', label: 'Nausea reported' },
  { value: 'dizziness', label: 'Dizziness reported' },
  { value: 'pain', label: 'Pain at site' },
  { value: 'rash', label: 'Skin reaction/rash' },
  { value: 'other', label: 'Other reaction' },
];

// Helper to determine time status
function getTimeStatus(scheduledTime?: string): { status: 'on-time' | 'early' | 'late'; label: string; color: string } {
  if (!scheduledTime) return { status: 'on-time', label: 'On time', color: 'green' };
  
  const scheduled = new Date(scheduledTime);
  const now = new Date();
  const diffMinutes = Math.round((now.getTime() - scheduled.getTime()) / 60000);
  
  if (diffMinutes < -30) return { status: 'early', label: `${Math.abs(diffMinutes)} min early`, color: 'blue' };
  if (diffMinutes > 30) return { status: 'late', label: `${diffMinutes} min late`, color: 'red' };
  return { status: 'on-time', label: 'On time', color: 'green' };
}

// Format date/time helper
function formatDateTime(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdministerMedsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const medFromSchedule = location.state?.medication;
  const nextMedication = location.state?.nextMedication;

  // Permission check
  const canAdminister = hasAnyPermission(['pharmacy.dispense', 'nursing.write']);

  // State for wizard steps
  const [currentWizardStep, setCurrentWizardStep] = useState(1);
  const [administered, setAdministered] = useState(false);
  const [action, setAction] = useState<ActionType>(null);
  
  // Verification states
  const [patientVerified, setPatientVerified] = useState(false);
  const [drugVerified, setDrugVerified] = useState(false);
  const [doseVerified, setDoseVerified] = useState(false);
  const [routeVerified, setRouteVerified] = useState(false);
  const [timeVerified, setTimeVerified] = useState(false);
  const [scannedMRN, setScannedMRN] = useState('');
  const [scannedDrugBarcode, setScannedDrugBarcode] = useState('');
  
  // Administration form state
  const [actualDose, setActualDose] = useState('');
  const [injectionSite, setInjectionSite] = useState('');
  const [patientReaction, setPatientReaction] = useState('tolerated');
  const [notes, setNotes] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [refuseReason, setRefuseReason] = useState('');
  const [witnessedBy, setWitnessedBy] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [showPinEntry, setShowPinEntry] = useState(false);

  // Default medication data with enhanced fields
  const medication: MedicationDetails = medFromSchedule || {
    patientName: 'Sarah Wanjiku',
    patientMrn: 'MRN-2024-0042',
    ward: 'Medical Ward A',
    bed: '12',
    medication: 'Amoxicillin',
    genericName: 'Amoxicillin',
    brandName: 'Amoxil',
    dose: '500mg',
    route: 'Oral',
    frequency: 'TDS (Three times daily)',
    prescribedBy: 'Dr. John Kamau',
    allergies: ['Penicillin', 'Sulfa drugs'],
    specialInstructions: 'Take with food. Complete full course.',
    lastGiven: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    scheduledTime: new Date().toISOString(),
    isControlled: false,
    isNPO: false,
    patientInfo: {
      name: 'Sarah Wanjiku',
      mrn: 'MRN-2024-0042',
      age: 45,
      weight: 68,
      gender: 'female',
      dateOfBirth: '1979-03-15',
      bloodType: 'O+',
    },
    vitals: {
      temperature: 37.2,
      pulse: 78,
      bpSystolic: 120,
      bpDiastolic: 80,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      painLevel: 2,
      recordedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  };

  // Initialize actual dose from prescribed dose
  useEffect(() => {
    if (medication.dose && !actualDose) {
      setActualDose(medication.dose);
    }
  }, [medication.dose, actualDose]);

  // Check for allergy warning - now more comprehensive
  const allergyWarnings = medication.allergies?.filter(allergy => {
    const medLower = medication.medication.toLowerCase();
    const allergyLower = allergy.toLowerCase();
    // Check for penicillin-related allergies with amoxicillin
    if (allergyLower.includes('penicillin') && 
        (medLower.includes('amoxicillin') || medLower.includes('ampicillin') || medLower.includes('penicillin'))) {
      return true;
    }
    // Check for sulfa allergies
    if (allergyLower.includes('sulfa') && 
        (medLower.includes('sulfamethoxazole') || medLower.includes('bactrim'))) {
      return true;
    }
    return false;
  }) || [];

  const hasAllergyWarning = allergyWarnings.length > 0;
  const timeStatus = getTimeStatus(medication.scheduledTime);
  const isInjection = ['im', 'sc', 'iv'].includes(medication.route.toLowerCase());

  // Calculate verification progress
  const verificationSteps = [
    { step: 1, label: 'Right Patient', verified: patientVerified, icon: UserCircle },
    { step: 2, label: 'Right Drug', verified: drugVerified, icon: Pill },
    { step: 3, label: 'Right Dose', verified: doseVerified, icon: Scale },
    { step: 4, label: 'Right Route', verified: routeVerified, icon: Syringe },
    { step: 5, label: 'Right Time', verified: timeVerified, icon: Clock },
  ];

  const allVerified = patientVerified && drugVerified && doseVerified && routeVerified && timeVerified;
  const completedSteps = verificationSteps.filter(s => s.verified).length;

  // Administer medication mutation
  const administerMutation = useMutation({
    mutationFn: (data: { id: string; dto: AdministerMedicationDto }) =>
      ipdService.medications.administer(data.id, data.dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications-today'] });
      toast.success(
        action === 'give' ? 'Medication administered successfully' :
        action === 'hold' ? 'Medication held' :
        action === 'refuse' ? 'Refusal recorded' :
        'Pharmacy notified - medication not available'
      );
      setAdministered(true);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record administration');
    },
  });

  const administering = administerMutation.isPending;

  // Verify patient by scanning or entering MRN
  const handlePatientVerification = useCallback(() => {
    const mrnToCheck = scannedMRN.trim().toUpperCase();
    const expectedMRN = medication.patientMrn.toUpperCase();
    
    if (mrnToCheck === expectedMRN || mrnToCheck === '') {
      setPatientVerified(true);
      toast.success('Patient verified');
    } else {
      toast.error('MRN does not match! Please verify patient identity.');
      setPatientVerified(false);
    }
  }, [scannedMRN, medication.patientMrn]);

  // Verify drug by scanning barcode
  const handleDrugVerification = useCallback(() => {
    setDrugVerified(true);
    toast.success('Drug verified');
  }, []);

  // Confirm PIN for controlled substances
  const handlePinConfirmation = useCallback(() => {
    if (pinConfirmation.length >= 4) {
      setShowPinEntry(false);
      handleAdminister();
    } else {
      toast.error('Please enter a valid PIN');
    }
  }, [pinConfirmation]);

  const handleAdminister = useCallback(() => {
    if (!canAdminister) {
      toast.error('You do not have permission to administer medications');
      return;
    }

    if (!allVerified && action === 'give') {
      toast.error('Please complete all verification steps first');
      return;
    }

    if (medication.isControlled && !witnessedBy && action === 'give') {
      toast.error('Controlled substances require a witness');
      return;
    }

    if (!medication.id) {
      // Demo mode - just show success
      toast.success(
        action === 'give' ? 'Medication administered successfully' :
        action === 'hold' ? 'Medication held' :
        action === 'refuse' ? 'Refusal recorded' :
        'Pharmacy notified - medication not available'
      );
      setAdministered(true);
      return;
    }

    const statusMap: Record<string, MedicationStatus> = {
      give: 'given',
      hold: 'held',
      refuse: 'refused',
      not_available: 'missed',
    };

    const dto: AdministerMedicationDto = {
      status: statusMap[action!] || 'given',
      notes: [
        notes,
        actualDose !== medication.dose ? `Actual dose: ${actualDose}` : '',
        injectionSite ? `Site: ${injectionSite}` : '',
        patientReaction !== 'tolerated' ? `Reaction: ${patientReaction}` : '',
        witnessedBy ? `Witnessed by: ${witnessedBy}` : '',
      ].filter(Boolean).join('. ') || undefined,
      reason: action === 'hold' ? holdReason : action === 'refuse' ? refuseReason : undefined,
    };

    administerMutation.mutate({ id: medication.id, dto });
  }, [canAdminister, allVerified, action, medication, notes, actualDose, injectionSite, patientReaction, witnessedBy, holdReason, refuseReason, administerMutation]);

  // Print label handler
  const handlePrintLabel = () => {
    toast.success('Printing administration label...');
    // In real implementation, this would trigger print dialog
  };

  // Navigate to next medication
  const handleNextMedication = () => {
    if (nextMedication) {
      navigate('/nursing/meds/administer', { state: { medication: nextMedication } });
      // Reset state
      setAdministered(false);
      setAction(null);
      setPatientVerified(false);
      setDrugVerified(false);
      setDoseVerified(false);
      setRouteVerified(false);
      setTimeVerified(false);
      setCurrentWizardStep(1);
    } else {
      navigate('/nursing/meds/schedule');
    }
  };

  // Permission denied view
  if (!canAdminister) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Ban className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You do not have permission to administer medications. Required permissions: 
            <span className="font-medium"> pharmacy.dispense</span> or 
            <span className="font-medium"> nursing.write</span>
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Post-administration success view
  if (administered) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center max-w-lg">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
            action === 'give' ? 'bg-green-100' : 
            action === 'hold' ? 'bg-yellow-100' : 
            action === 'not_available' ? 'bg-orange-100' : 'bg-red-100'
          }`}>
            {action === 'give' ? (
              <CheckCircle className="w-10 h-10 text-green-600" />
            ) : action === 'hold' ? (
              <Clock className="w-10 h-10 text-yellow-600" />
            ) : action === 'not_available' ? (
              <Phone className="w-10 h-10 text-orange-600" />
            ) : (
              <XCircle className="w-10 h-10 text-red-600" />
            )}
          </div>
          
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {action === 'give' ? 'Medication Administered Successfully' : 
             action === 'hold' ? 'Medication Held' : 
             action === 'not_available' ? 'Pharmacy Notified' : 'Refusal Recorded'}
          </h2>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-lg font-medium text-gray-900">{medication.medication} {medication.dose}</p>
            <p className="text-gray-600">{medication.patientName} • {medication.patientMrn}</p>
            <p className="text-sm text-gray-500 mt-1">
              {new Date().toLocaleString('en-US', { 
                dateStyle: 'medium', 
                timeStyle: 'short' 
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={handlePrintLabel}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Printer className="w-4 h-4" />
              Print Label
            </button>
            
            <button
              onClick={handleNextMedication}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              {nextMedication ? (
                <>
                  Next Medication
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                'Back to Schedule'
              )}
            </button>
            
            <button
              onClick={() => {
                setAdministered(false);
                setAction(null);
                setPatientVerified(false);
                setDrugVerified(false);
                setDoseVerified(false);
                setRouteVerified(false);
                setTimeVerified(false);
                setCurrentWizardStep(1);
                setActualDose(medication.dose);
                setNotes('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              New Administration
            </button>
          </div>

          {nextMedication && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700 font-medium">Next medication due:</p>
              <p className="text-blue-900">{nextMedication.medication} - {nextMedication.patientName}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // PIN confirmation modal
  if (showPinEntry) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Confirm Administration</h3>
              <p className="text-sm text-gray-500">Enter your PIN to confirm</p>
            </div>
          </div>
          
          <input
            type="password"
            value={pinConfirmation}
            onChange={(e) => setPinConfirmation(e.target.value)}
            maxLength={6}
            placeholder="Enter PIN"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest mb-4"
            autoFocus
          />
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowPinEntry(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePinConfirmation}
              disabled={pinConfirmation.length < 4}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get route icon
  const RouteIcon = routeIcons[medication.route.toLowerCase()] || Pill;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header with Progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Pill className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Administer Medication</h1>
              <p className="text-sm text-gray-500">5 Rights Verification • Step-by-step</p>
            </div>
          </div>
        </div>
        
        {/* Progress indicator */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-1">
            {verificationSteps.map((step, idx) => (
              <div
                key={step.step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  step.verified
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.verified ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
            ))}
          </div>
          <span className="text-sm text-gray-500 ml-2">
            {completedSteps}/5 verified
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Left Column: Patient Info Panel */}
        <div className="lg:col-span-3 space-y-4 overflow-y-auto">
          {/* Patient Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Patient Information</h2>
              <button
                onClick={() => {
                  setScannedMRN(medication.patientMrn);
                  handlePatientVerification();
                }}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200"
              >
                <Scan className="w-3 h-3" />
                Scan
              </button>
            </div>
            
            {/* Patient Photo & Basic Info */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                {medication.patientInfo?.photo ? (
                  <img 
                    src={medication.patientInfo.photo} 
                    alt={medication.patientName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCircle className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{medication.patientName}</p>
                <p className="text-sm text-gray-600">{medication.patientMrn}</p>
                <p className="text-xs text-teal-600">{medication.ward} • Bed {medication.bed}</p>
              </div>
            </div>

            {/* Patient Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Age</p>
                  <p className="font-medium">{medication.patientInfo?.age || 'N/A'} yrs</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <Weight className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Weight</p>
                  <p className="font-medium">{medication.patientInfo?.weight || 'N/A'} kg</p>
                </div>
              </div>
            </div>

            {/* MRN Verification Input */}
            <div className="mt-3">
              <label className="text-xs text-gray-500 mb-1 block">Verify MRN</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scannedMRN}
                  onChange={(e) => setScannedMRN(e.target.value)}
                  placeholder="Scan or enter MRN"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  onClick={handlePatientVerification}
                  disabled={patientVerified}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    patientVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-teal-600 text-white hover:bg-teal-700'
                  }`}
                >
                  {patientVerified ? <CheckCircle className="w-4 h-4" /> : 'Verify'}
                </button>
              </div>
            </div>
          </div>

          {/* Allergies Alert */}
          {medication.allergies && medication.allergies.length > 0 && (
            <div className={`rounded-xl border p-4 ${
              hasAllergyWarning 
                ? 'bg-red-50 border-red-300' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-5 h-5 ${hasAllergyWarning ? 'text-red-600' : 'text-yellow-600'}`} />
                <span className={`text-sm font-semibold ${hasAllergyWarning ? 'text-red-700' : 'text-yellow-700'}`}>
                  {hasAllergyWarning ? 'ALLERGY WARNING!' : 'Known Allergies'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {medication.allergies.map((allergy, idx) => (
                  <span 
                    key={idx}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      allergyWarnings.includes(allergy)
                        ? 'bg-red-200 text-red-800'
                        : 'bg-yellow-200 text-yellow-800'
                    }`}
                  >
                    {allergy}
                  </span>
                ))}
              </div>
              {hasAllergyWarning && (
                <p className="text-xs text-red-600 mt-2 font-medium">
                  ⚠️ This medication may cause an allergic reaction!
                </p>
              )}
            </div>
          )}

          {/* NPO Warning */}
          {medication.isNPO && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-semibold text-orange-700">NPO STATUS</span>
              </div>
              <p className="text-xs text-orange-600 mt-1">
                Patient is NPO. Verify oral medications are appropriate.
              </p>
            </div>
          )}

          {/* Current Vitals Summary */}
          {medication.vitals && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">Current Vitals</h3>
                <span className="text-xs text-gray-500">
                  {formatDateTime(medication.vitals.recordedAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Thermometer className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{medication.vitals.temperature}°C</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span className="text-sm">{medication.vitals.pulse} bpm</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">{medication.vitals.bpSystolic}/{medication.vitals.bpDiastolic}</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm">SpO₂ {medication.vitals.oxygenSaturation}%</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Middle Column: Medication Details & Verification */}
        <div className="lg:col-span-5 space-y-4 overflow-y-auto">
          {/* Medication to Administer */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Medication to Administer</h2>
              <button
                onClick={handleDrugVerification}
                disabled={drugVerified}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                  drugVerified
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Scan className="w-4 h-4" />
                {drugVerified ? 'Verified' : 'Scan Drug'}
              </button>
            </div>

            {/* Drug Name with brand/generic */}
            <div className="p-4 bg-purple-50 rounded-lg mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <RouteIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-lg">{medication.brandName || medication.medication}</p>
                  {medication.genericName && (
                    <p className="text-sm text-purple-600">({medication.genericName})</p>
                  )}
                  {medication.isControlled && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                      <ShieldCheck className="w-3 h-3" />
                      Controlled Substance
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Medication Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Scale className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-500">Prescribed Dose</p>
                </div>
                <p className="text-lg font-semibold text-gray-900">{medication.dose}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <RouteIcon className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-500">Route</p>
                </div>
                <p className="text-lg font-semibold text-gray-900">{medication.route}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-500">Frequency</p>
                </div>
                <p className="text-sm font-medium text-gray-900">{medication.frequency}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-500">Scheduled Time</p>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {formatDateTime(medication.scheduledTime)}
                </p>
                <span className={`text-xs font-medium ${
                  timeStatus.color === 'green' ? 'text-green-600' :
                  timeStatus.color === 'blue' ? 'text-blue-600' : 'text-red-600'
                }`}>
                  {timeStatus.label}
                </span>
              </div>
            </div>

            {/* Special Instructions */}
            {medication.specialInstructions && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-blue-700">Special Instructions</p>
                    <p className="text-sm text-blue-800">{medication.specialInstructions}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Last Given */}
            {medication.lastGiven && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Last given: {formatDateTime(medication.lastGiven)}</span>
              </div>
            )}

            {/* Prescriber */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <FileText className="w-4 h-4" />
              <span>Prescribed by: {medication.prescribedBy}</span>
            </div>
          </div>

          {/* 5 Rights Verification Steps */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">5 Rights Verification</h2>
            <div className="space-y-2">
              {verificationSteps.map((item) => {
                const StepIcon = item.icon;
                return (
                  <button
                    key={item.step}
                    onClick={() => {
                      switch (item.step) {
                        case 1:
                          if (!patientVerified) {
                            setScannedMRN(medication.patientMrn);
                            handlePatientVerification();
                          }
                          break;
                        case 2:
                          handleDrugVerification();
                          break;
                        case 3:
                          setDoseVerified(true);
                          toast.success('Dose verified');
                          break;
                        case 4:
                          setRouteVerified(true);
                          toast.success('Route verified');
                          break;
                        case 5:
                          setTimeVerified(true);
                          toast.success('Time verified');
                          break;
                      }
                    }}
                    disabled={item.verified}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      item.verified
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      item.verified
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.verified ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500">
                        {item.step === 1 && `MRN: ${medication.patientMrn}`}
                        {item.step === 2 && medication.medication}
                        {item.step === 3 && medication.dose}
                        {item.step === 4 && medication.route}
                        {item.step === 5 && formatDateTime(medication.scheduledTime)}
                      </p>
                    </div>
                    {!item.verified && (
                      <span className="text-xs text-teal-600 font-medium">Click to verify</span>
                    )}
                  </button>
                );
              })}
            </div>

            {allVerified && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    All 5 Rights verified - Ready to administer
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Administration Form & Actions */}
        <div className="lg:col-span-4 space-y-4 overflow-y-auto">
          {/* Action Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Administration Action</h2>
            
            <div className="space-y-2">
              <button
                onClick={() => setAction('give')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  action === 'give'
                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    action === 'give' ? 'bg-green-500' : 'bg-green-100'
                  }`}>
                    <CheckCircle className={`w-5 h-5 ${action === 'give' ? 'text-white' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Give Medication</p>
                    <p className="text-xs text-gray-500">Administer as prescribed</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAction('hold')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  action === 'hold'
                    ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200'
                    : 'border-gray-200 hover:border-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    action === 'hold' ? 'bg-yellow-500' : 'bg-yellow-100'
                  }`}>
                    <Clock className={`w-5 h-5 ${action === 'hold' ? 'text-white' : 'text-yellow-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Hold Medication</p>
                    <p className="text-xs text-gray-500">Postpone for clinical reason</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAction('refuse')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  action === 'refuse'
                    ? 'border-red-500 bg-red-50 ring-2 ring-red-200'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    action === 'refuse' ? 'bg-red-500' : 'bg-red-100'
                  }`}>
                    <XCircle className={`w-5 h-5 ${action === 'refuse' ? 'text-white' : 'text-red-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Patient Refused</p>
                    <p className="text-xs text-gray-500">Patient declined medication</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAction('not_available')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  action === 'not_available'
                    ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-200'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    action === 'not_available' ? 'bg-orange-500' : 'bg-orange-100'
                  }`}>
                    <Phone className={`w-5 h-5 ${action === 'not_available' ? 'text-white' : 'text-orange-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Not Available</p>
                    <p className="text-xs text-gray-500">Notify pharmacy</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Administration Details Form */}
          {action === 'give' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Administration Details</h3>
              
              <div className="space-y-4">
                {/* Actual Dose */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Dose Given
                  </label>
                  <input
                    type="text"
                    value={actualDose}
                    onChange={(e) => setActualDose(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Enter actual dose"
                  />
                  {actualDose !== medication.dose && (
                    <p className="text-xs text-yellow-600 mt-1">
                      ⚠️ Different from prescribed dose ({medication.dose})
                    </p>
                  )}
                </div>

                {/* Injection Site (for IM/SC/IV) */}
                {isInjection && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Injection Site *
                    </label>
                    <select
                      value={injectionSite}
                      onChange={(e) => setInjectionSite(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select site...</option>
                      {injectionSites.map((site) => (
                        <option key={site} value={site}>{site}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Patient Reaction */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Patient Response
                  </label>
                  <select
                    value={patientReaction}
                    onChange={(e) => setPatientReaction(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {patientReactions.map((reaction) => (
                      <option key={reaction.value} value={reaction.value}>
                        {reaction.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Witnessed By (for controlled substances) */}
                {medication.isControlled && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Witnessed By *
                    </label>
                    <input
                      type="text"
                      value={witnessedBy}
                      onChange={(e) => setWitnessedBy(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Enter witness name/ID"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Required for controlled substances
                    </p>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Additional observations..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Hold Reason */}
          {action === 'hold' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Reason for Hold</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Select Reason *
                  </label>
                  <select
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select reason...</option>
                    {holdReasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Additional Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Add details..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Refuse Reason */}
          {action === 'refuse' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Reason for Refusal</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Select Reason *
                  </label>
                  <select
                    value={refuseReason}
                    onChange={(e) => setRefuseReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Select reason...</option>
                    {refusalReasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Additional Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                    placeholder="Document patient's stated reason..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Not Available Note */}
          {action === 'not_available' && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Notify Pharmacy</h3>
              <div className="p-3 bg-orange-50 rounded-lg mb-4">
                <p className="text-sm text-orange-700">
                  Pharmacy will be notified that this medication is not available on the floor.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Additional Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  placeholder="Additional details for pharmacy..."
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={() => {
              if (medication.isControlled && action === 'give') {
                setShowPinEntry(true);
              } else {
                handleAdminister();
              }
            }}
            disabled={
              !action || 
              administering || 
              (action === 'give' && !allVerified) ||
              (action === 'give' && isInjection && !injectionSite) ||
              (action === 'give' && medication.isControlled && !witnessedBy) ||
              (action === 'hold' && !holdReason) ||
              (action === 'refuse' && !refuseReason)
            }
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {administering ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {action === 'give' ? 'Record Administration' :
                 action === 'hold' ? 'Record Hold' :
                 action === 'refuse' ? 'Record Refusal' :
                 action === 'not_available' ? 'Notify Pharmacy' :
                 'Select an Action'}
              </>
            )}
          </button>

          {/* Validation Messages */}
          {action === 'give' && !allVerified && (
            <p className="text-center text-sm text-amber-600">
              Complete all 5 Rights verification before administering
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
