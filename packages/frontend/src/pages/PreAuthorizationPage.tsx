import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientsService, type Patient } from '../services/patients';
import { insuranceService, type PreAuth, type InsurancePolicy } from '../services/insurance';
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

// Static procedures (can be replaced with API call when services endpoint is available)
const procedures = [
  { id: 'p1', name: 'CT Scan - Head', code: 'CT001', estimatedCost: 350000 },
  { id: 'p2', name: 'MRI - Spine', code: 'MRI002', estimatedCost: 500000 },
  { id: 'p3', name: 'Knee Replacement Surgery', code: 'SURG001', estimatedCost: 8000000 },
  { id: 'p4', name: 'Appendectomy', code: 'SURG002', estimatedCost: 2500000 },
  { id: 'p5', name: 'Colonoscopy', code: 'END001', estimatedCost: 400000 },
];

interface SelectedPatient {
  id: string;
  mrn: string;
  fullName: string;
  insuranceProvider?: string;
  policyId?: string;
}

export default function PreAuthorizationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [selectedProcedure, setSelectedProcedure] = useState<string>('');
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
    mutationFn: (data: { policyId: string; patientId: string; serviceType: string; estimatedCost: number; notes?: string }) =>
      insuranceService.preAuth.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pre-auth-requests'] });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setSelectedPatient(null);
        setSelectedProcedure('');
        setClinicalNotes('');
      }, 2000);
    },
  });

  // Get active policy for selected patient
  const activePolicy = patientPolicies?.find(p => p.status === 'active');

  const patients = patientsData?.data || [];

  const filteredRequests = preAuthRequests || [];

  const selectedProcedureData = procedures.find(p => p.id === selectedProcedure);

  const handleSubmit = () => {
    if (!selectedPatient || !selectedProcedure || !selectedProcedureData) return;
    
    // Use patient's active policy if available, otherwise we need a policy ID
    const policyId = activePolicy?.id || selectedPatient.policyId;
    if (!policyId) {
      toast.error('Patient does not have an active insurance policy');
      return;
    }

    createPreAuthMutation.mutate({
      policyId,
      patientId: selectedPatient.id,
      serviceType: selectedProcedureData.name,
      estimatedCost: selectedProcedureData.estimatedCost,
      notes: clinicalNotes || undefined,
    });
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient({
      id: patient.id,
      mrn: patient.mrn,
      fullName: patient.fullName,
      insuranceProvider: patient.insuranceProvider,
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
                        <p className="text-xs text-gray-500">{selectedPatient.insuranceProvider}</p>
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
                            <p className="text-xs text-gray-500">{patient.insuranceProvider || 'No insurance'}</p>
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

              {/* Procedure Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Procedure</label>
                <select
                  value={selectedProcedure}
                  onChange={(e) => setSelectedProcedure(e.target.value)}
                  className="input py-2"
                >
                  <option value="">Select procedure...</option>
                  {procedures.map((proc) => (
                    <option key={proc.id} value={proc.id}>
                      {proc.name} - UGX {proc.estimatedCost.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {selectedProcedureData && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Procedure Code:</span>
                    <span className="font-mono">{selectedProcedureData.code}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500">Estimated Cost:</span>
                    <span className="font-medium">UGX {selectedProcedureData.estimatedCost.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Clinical Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Clinical Justification</label>
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Enter clinical notes and justification..."
                  className="input py-2 h-20 resize-none text-sm"
                />
              </div>
            </div>
          )}

          {!showSuccess && (
            <button
              onClick={handleSubmit}
              disabled={!selectedPatient || !selectedProcedure || !activePolicy || createPreAuthMutation.isPending}
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
                  <span className="font-mono text-sm text-blue-600">{req.requestNumber}</span>
                  {getStatusBadge(req.status)}
                </div>
                <p className="font-medium text-gray-900 text-sm">{req.serviceType}</p>
                <p className="text-xs text-gray-500">Est. Cost: UGX {req.estimatedCost.toLocaleString()}</p>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                  {req.approvedAmount && (
                    <span className="text-green-600 font-medium">
                      Approved: UGX {req.approvedAmount.toLocaleString()}
                    </span>
                  )}
                </div>
                {req.denialReason && (
                  <p className="text-xs text-red-600 mt-1">{req.denialReason}</p>
                )}
                {req.notes && (
                  <p className="text-xs text-gray-500 mt-1">{req.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
