import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
} from 'lucide-react';
import { ipdService, type AdministerMedicationDto, type MedicationStatus } from '../../services/ipd';

interface MedicationDetails {
  id?: string;
  patientName: string;
  patientMrn: string;
  ward: string;
  bed: string;
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  prescribedBy: string;
  allergies: string[];
}

export default function AdministerMedsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const medFromSchedule = location.state?.medication;

  const [administered, setAdministered] = useState(false);
  const [action, setAction] = useState<'give' | 'hold' | 'refuse' | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [notes, setNotes] = useState('');
  const [verificationStep, setVerificationStep] = useState(1);

  const medication: MedicationDetails = medFromSchedule || {
    patientName: '',
    patientMrn: '',
    ward: '',
    bed: '',
    medication: '',
    dose: '',
    route: '',
    frequency: '',
    prescribedBy: '',
    allergies: [],
  };

  // Administer medication mutation
  const administerMutation = useMutation({
    mutationFn: (data: { id: string; dto: AdministerMedicationDto }) =>
      ipdService.medications.administer(data.id, data.dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medications-today'] });
      setAdministered(true);
    },
  });

  const administering = administerMutation.isPending;

  const hasAllergyWarning = medication.allergies?.includes('Penicillin') && 
    medication.medication.toLowerCase().includes('amoxicillin');

  const verificationSteps = [
    { step: 1, label: 'Right Patient', description: 'Verify patient identity (2 identifiers)' },
    { step: 2, label: 'Right Medication', description: 'Check medication name and form' },
    { step: 3, label: 'Right Dose', description: 'Verify dose and concentration' },
    { step: 4, label: 'Right Route', description: 'Confirm administration route' },
    { step: 5, label: 'Right Time', description: 'Check scheduled time' },
  ];

  const handleAdminister = () => {
    if (!medication.id) {
      // No medication ID - just show success for demo
      setAdministered(true);
      return;
    }

    const statusMap: Record<string, MedicationStatus> = {
      give: 'given',
      hold: 'held',
      refuse: 'refused',
    };

    const dto: AdministerMedicationDto = {
      status: statusMap[action!] || 'given',
      notes: notes || undefined,
      reason: action === 'hold' ? holdReason : undefined,
    };

    administerMutation.mutate({ id: medication.id, dto });
  };

  if (administered) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            action === 'give' ? 'bg-green-100' : 
            action === 'hold' ? 'bg-yellow-100' : 'bg-red-100'
          }`}>
            {action === 'give' ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : action === 'hold' ? (
              <Clock className="w-8 h-8 text-yellow-600" />
            ) : (
              <XCircle className="w-8 h-8 text-red-600" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {action === 'give' ? 'Medication Administered' : 
             action === 'hold' ? 'Medication Held' : 'Patient Refused'}
          </h2>
          <p className="text-gray-600 mb-6">
            {medication.medication} for {medication.patientName}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/nursing/meds/schedule')}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Back to Schedule
            </button>
            <button
              onClick={() => {
                setAdministered(false);
                setAction(null);
                setVerificationStep(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              New Administration
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
            <Pill className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Administer Medication</h1>
              <p className="text-sm text-gray-500">Verify and record medication administration</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Patient & Medication Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Patient</h2>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <UserCircle className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{medication.patientName}</p>
                <p className="text-sm text-gray-500">{medication.patientMrn}</p>
                <p className="text-xs text-teal-600">{medication.ward} - Bed {medication.bed}</p>
              </div>
            </div>

            {hasAllergyWarning && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-700">ALLERGY ALERT</span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  Patient allergic to: {medication.allergies?.join(', ')}
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Medication</h2>
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-purple-600">Drug Name</p>
                <p className="font-medium text-gray-900">{medication.medication}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Dose</p>
                  <p className="text-sm font-medium text-gray-900">{medication.dose}</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Route</p>
                  <p className="text-sm font-medium text-gray-900">{medication.route}</p>
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Frequency</p>
                <p className="text-sm font-medium text-gray-900">{medication.frequency || 'TDS'}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Prescribed By</p>
                <p className="text-sm font-medium text-gray-900">{medication.prescribedBy || 'Dr. John Kamau'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Steps */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">5 Rights Verification</h2>
            <button className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
              <Scan className="w-4 h-4" />
              Scan Barcode
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto">
            {verificationSteps.map((item) => (
              <button
                key={item.step}
                onClick={() => {
                  if (item.step === verificationStep) {
                    setVerificationStep(verificationStep + 1);
                  }
                }}
                disabled={item.step > verificationStep}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  item.step < verificationStep
                    ? 'border-green-200 bg-green-50'
                    : item.step === verificationStep
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  item.step < verificationStep
                    ? 'bg-green-500 text-white'
                    : item.step === verificationStep
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-300 text-white'
                }`}>
                  {item.step < verificationStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{item.step}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              </button>
            ))}
          </div>
          
          {verificationStep > 5 && (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">All verifications complete</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          <h2 className="font-semibold text-gray-900 mb-4">Administration Action</h2>
          
          <div className="flex-1 space-y-4">
            <div className="space-y-2">
              <button
                onClick={() => setAction('give')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  action === 'give'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">Give Medication</p>
                    <p className="text-xs text-gray-500">Administer as prescribed</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAction('hold')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  action === 'hold'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-yellow-600" />
                  <div>
                    <p className="font-medium text-gray-900">Hold Medication</p>
                    <p className="text-xs text-gray-500">Postpone for clinical reason</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setAction('refuse')}
                className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                  action === 'refuse'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <XCircle className="w-6 h-6 text-red-600" />
                  <div>
                    <p className="font-medium text-gray-900">Patient Refused</p>
                    <p className="text-xs text-gray-500">Patient declined medication</p>
                  </div>
                </div>
              </button>
            </div>

            {action === 'hold' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Reason for Hold *</label>
                <select
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Select reason...</option>
                  <option value="npo">Patient NPO</option>
                  <option value="vitals">Abnormal vitals</option>
                  <option value="labs">Lab values out of range</option>
                  <option value="doctor">Per doctor order</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <button
            onClick={handleAdminister}
            disabled={!action || administering || verificationStep <= 5 || (action === 'hold' && !holdReason)}
            className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {administering ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Record Administration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
