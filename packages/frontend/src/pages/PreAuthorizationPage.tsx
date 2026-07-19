import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientsService, type Patient } from '../services/patients';
import { insuranceService, type CreatePreAuthDto } from '../services/insurance';
import { getApiErrorMessage } from '../services/api';
import { formatCurrency } from '../lib/currency';
import { useFacilityId } from '../lib/facility';
import { asList } from '../utils/unwrapResponse';

const AUTH_TYPES = [
  { value: 'admission', label: 'Admission' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'investigation', label: 'Investigation (CT/MRI…)' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'extension', label: 'Stay extension' },
] as const;
import {
  FileCheck,
  Search,
  UserCircle,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Send,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface SelectedPatient {
  id: string;
  mrn: string;
  fullName: string;
}

export default function PreAuthorizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [authType, setAuthType] = useState<string>('procedure');
  const [primaryDiagnosis, setPrimaryDiagnosis] = useState('');
  const [proposedTreatment, setProposedTreatment] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Search patients from API
  const { data: patientsData, isLoading: isSearching } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientsService.search({ search: searchTerm, limit: 10 }),
    enabled: searchTerm.length >= 2,
    staleTime: 30000,
  });

  // Fetch patient's insurance policies when a patient is selected
  const { data: patientPolicies } = useQuery({
    queryKey: ['patient-policies', selectedPatient?.id],
    queryFn: () => insuranceService.policies.getByPatient(selectedPatient!.id),
    enabled: !!selectedPatient?.id,
  });

  // Fetch pre-authorization requests
  const { data: preAuthRequests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ['pre-auth-requests', statusFilter],
    queryFn: () => insuranceService.preAuth.list(
      statusFilter !== 'all' ? { status: statusFilter } : undefined
    ),
    staleTime: 30000,
  });

  // Create pre-auth mutation
  const createPreAuthMutation = useMutation({
    mutationFn: (data: CreatePreAuthDto) => insuranceService.preAuth.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-auth-requests'] });
      toast.success('Pre-authorization request created');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedPatient(null);
        setPrimaryDiagnosis('');
        setProposedTreatment('');
        setEstimatedCost(0);
        setClinicalNotes('');
      }, 2000);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to submit pre-authorization request')),
  });

  // Get active policy for selected patient
  const activePolicy = patientPolicies?.find(p => p.status === 'active');

  const patients = asList(patientsData);

  const filteredRequests = preAuthRequests || [];

  const handleSubmit = () => {
    if (!selectedPatient || !primaryDiagnosis || !proposedTreatment || !clinicalNotes || estimatedCost <= 0) return;

    const policyId = activePolicy?.id;
    if (!policyId) {
      toast.error('Patient does not have an active insurance policy');
      return;
    }

    createPreAuthMutation.mutate({
      facilityId,
      policyId,
      authType: authType as CreatePreAuthDto['authType'],
      primaryDiagnosis,
      clinicalJustification: clinicalNotes,
      proposedTreatment,
      estimatedCost,
    });
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient({
      id: patient.id,
      mrn: patient.mrn,
      fullName: patient.fullName,
    });
    setSearchTerm('');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      submitted: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      denied: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-700',
    };
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-3 h-3" />,
      submitted: <Send className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      denied: <XCircle className="w-3 h-3" />,
      expired: <Clock className="w-3 h-3" />,
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {icons[status] || <FileCheck className="w-3 h-3" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <FileCheck className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pre-Authorization</h1>
            <p className="text-gray-500 text-sm">Request approval for procedures</p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* Left: New Request */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">New Pre-Authorization Request</h2>
          
          {showSuccess ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Request Submitted!</h3>
                <p className="text-gray-500 text-sm">Awaiting insurance response</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4">
              {/* Patient Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Patient</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <UserCircle className="w-8 h-8 text-blue-600" />
                      <div>
                        <p className="font-medium text-sm">{selectedPatient.fullName}</p>
                        <p className="text-xs text-gray-500">
                          {activePolicy
                            ? `${(activePolicy as any).provider?.name || 'Insurance'} · ${activePolicy.policyNumber}`
                            : selectedPatient.mrn}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="text-xs text-blue-600">Change</button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search patient..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input pl-9 py-2 text-sm"
                      />
                      {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                      )}
                    </div>
                    {searchTerm.length >= 2 && patients.length > 0 && (
                      <div className="border rounded mt-2 max-h-24 overflow-y-auto">
                        {patients.map((patient) => (
                          <button
                            key={patient.id}
                            onClick={() => handleSelectPatient(patient)}
                            className="w-full p-2 hover:bg-gray-50 text-left text-sm"
                          >
                            <p className="font-medium">{patient.fullName}</p>
                            <p className="text-xs text-gray-500">{patient.mrn}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchTerm.length >= 2 && !isSearching && patients.length === 0 && (
                      <p className="text-xs text-gray-500 mt-2">No patients found</p>
                    )}
                  </>
                )}
              </div>

              {/* Authorization type */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Authorization Type *</label>
                <select value={authType} onChange={(e) => setAuthType(e.target.value)} className="input py-2 text-sm">
                  {AUTH_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Primary Diagnosis *</label>
                <input
                  type="text"
                  value={primaryDiagnosis}
                  onChange={(e) => setPrimaryDiagnosis(e.target.value)}
                  placeholder="e.g. Lumbar disc prolapse"
                  className="input py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Proposed Treatment / Service *</label>
                <input
                  type="text"
                  value={proposedTreatment}
                  onChange={(e) => setProposedTreatment(e.target.value)}
                  placeholder="e.g. MRI - Lumbar spine"
                  className="input py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Cost (UGX) *</label>
                <input
                  type="number"
                  value={estimatedCost || ''}
                  onChange={(e) => setEstimatedCost(Number(e.target.value))}
                  placeholder="Enter estimated cost"
                  className="input py-2 text-sm"
                  min="0"
                />
              </div>

              {proposedTreatment && estimatedCost > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Treatment:</span>
                    <span className="font-medium">{proposedTreatment}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500">Estimated Cost:</span>
                    <span className="font-medium">{formatCurrency(estimatedCost)}</span>
                  </div>
                </div>
              )}

              {/* Clinical Justification */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Clinical Justification *</label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Why is this clinically necessary?"
                  className="input py-2 h-20 resize-none text-sm"
                />
              </div>
            </div>
          )}

          {!showSuccess && (
            <button
              onClick={handleSubmit}
              disabled={
                !selectedPatient || !primaryDiagnosis || !proposedTreatment || !clinicalNotes ||
                estimatedCost <= 0 || !activePolicy || createPreAuthMutation.isPending
              }
              className="btn-primary mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {createPreAuthMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Request
                </>
              )}
            </button>
          )}
          {selectedPatient && !activePolicy && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Patient has no active insurance policy
            </p>
          )}
          {createPreAuthMutation.isError && (
            <p className="text-xs text-red-600 mt-2">Failed to submit request. Please try again.</p>
          )}
        </div>

        {/* Right: Request History */}
        <div className="card p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              Request History
              {isLoadingRequests && <Loader2 className="w-3 h-3 animate-spin" />}
            </h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {filteredRequests.length === 0 && !isLoadingRequests && (
              <div className="text-center py-8">
                <FileCheck className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No pre-authorization requests</p>
              </div>
            )}
            {filteredRequests.map((req) => (
              <div key={req.id} className="p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-blue-600">{req.authNumber}</span>
                  {getStatusBadge(req.status)}
                </div>
                <p className="font-medium text-gray-900 text-sm">
                  {req.proposedTreatment || req.primaryDiagnosis}
                  <span className="text-gray-400 font-normal capitalize"> · {String(req.authType).replace('_', ' ')}</span>
                </p>
                <p className="text-xs text-gray-500">Est. Cost: {formatCurrency(Number(req.estimatedCost) || 0)}</p>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                  {Number(req.approvedAmount) > 0 && (
                    <span className="text-green-600 font-medium">
                      Approved: {formatCurrency(Number(req.approvedAmount))}
                    </span>
                  )}
                </div>
                {req.denialReason && (
                  <p className="text-xs text-red-600 mt-1">{req.denialReason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
