import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFacilityId } from '../../../lib/facility';
import {
  FileText,
  Search,
  Filter,
  Plus,
  Download,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  X,
  Upload,
  AlertCircle,
  Loader2,
  Users,
  ClipboardList,
  UserSearch,
} from 'lucide-react';
import { insuranceService, type Claim, type InsuranceProvider, type AwaitingClaimEncounter, type InsurancePolicy } from '../../../services/insurance';
import api, { getApiErrorMessage } from '../../../services/api';
import { patientsService, type Patient } from '../../../services/patients';
import { formatCurrency } from '../../../lib/currency';
import { toCsv, downloadBlob } from '../../reports/_reportUtils';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Extended claim type for UI display
interface ClaimDisplay {
  id: string;
  claimNumber: string;
  patientName: string;
  patientMrn: string;
  provider: string;
  providerId: string;
  serviceType: string;
  serviceDate: string;
  submissionDate: string;
  amount: number;
  approvedAmount?: number;
  status: string;
  documents: { name: string }[];
  rejectionReason?: string;
}

// Transform API claim to display format
const transformClaimToDisplay = (claim: Claim): ClaimDisplay => ({
  id: claim.id,
  claimNumber: claim.claimNumber,
  patientName: claim.patient?.fullName || 'Unknown Patient',
  patientMrn: claim.patient?.mrn || '',
  provider: claim.policy?.provider?.name || 'Unknown Provider',
  providerId: claim.policy?.providerId || '',
  serviceType: claim.claimType || 'outpatient',
  serviceDate: claim.serviceDate || claim.createdAt?.split('T')[0] || '',
  submissionDate: claim.submittedAt?.split('T')[0] || claim.createdAt?.split('T')[0] || '',
  amount: Number(claim.totalClaimed) || 0,
  approvedAmount: Number(claim.totalApproved) > 0 ? Number(claim.totalApproved) : undefined,
  status: claim.status as ClaimDisplay['status'],
  documents: [],
  rejectionReason: claim.denialReason,
});


export default function ClaimsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'claims' | 'awaiting'>('awaiting');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<ClaimDisplay | null>(null);
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approveAmount, setApproveAmount] = useState<number>(0);

  // New claim form state — mirrors backend CreateClaimDto
  const [newClaimForm, setNewClaimForm] = useState({
    claimType: 'outpatient',
    serviceDate: new Date().toISOString().split('T')[0],
    primaryDiagnosis: '',
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<InsurancePolicy | null>(null);

  // Reactive hook: getFacilityId() read once at mount raced the async profile
  // load, so on hard refresh the claims query fired with no facility → [].
  const facilityId = useFacilityId();

  // Search patients for new claim
  const { data: patientResults, isLoading: isSearchingPatients } = useQuery({
    queryKey: ['patient-search', patientSearch],
    queryFn: () => patientsService.search({ search: patientSearch, limit: 5 }),
    enabled: patientSearch.length >= 2,
    staleTime: 10000,
  });

  // Fetch policies for selected patient
  const { data: patientPolicies, isLoading: isLoadingPolicies } = useQuery({
    queryKey: ['patient-policies', selectedPatient?.id],
    queryFn: () => insuranceService.policies.getByPatient(selectedPatient!.id),
    enabled: !!selectedPatient?.id,
    staleTime: 30000,
  });

  // Fetch claims from API — facilityId passed explicitly and gated
  const { data: claimsData, isLoading: isLoadingClaims, refetch: refetchClaims } = useQuery({
    queryKey: ['insurance-claims', facilityId, statusFilter, providerFilter],
    queryFn: () => insuranceService.claims.list({
      facilityId,
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(providerFilter && { providerId: providerFilter }),
    } as any),
    enabled: !!facilityId,
    staleTime: 30000,
  });

  // Fetch encounters awaiting claims
  const { data: awaitingEncounters, isLoading: isLoadingAwaiting, refetch: refetchAwaiting } = useQuery({
    queryKey: ['insurance-awaiting-claims', facilityId],
    queryFn: () => insuranceService.encounters.getAwaitingClaims(),
    staleTime: 30000,
  });

  // Fetch providers for filter dropdown
  const { data: providersData, isLoading: isLoadingProviders } = useQuery({
    queryKey: ['insurance-providers', facilityId],
    queryFn: () => insuranceService.providers.list(),
    staleTime: 60000,
  });

  // Create claim mutation
  const createClaimMutation = useMutation({
    mutationFn: () =>
      insuranceService.claims.create({
        facilityId,
        policyId: selectedPolicy!.id,
        claimType: newClaimForm.claimType as any,
        serviceDate: newClaimForm.serviceDate,
        primaryDiagnosis: newClaimForm.primaryDiagnosis,
      }),
    onSuccess: (claim: any) => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      setShowNewClaimModal(false);
      setNewClaimForm({ claimType: 'outpatient', serviceDate: new Date().toISOString().split('T')[0], primaryDiagnosis: '' });
      setSelectedPatient(null);
      setSelectedPolicy(null);
      toast.success(`Draft claim ${claim?.claimNumber || ''} created — add items, then submit`);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create claim')),
  });

  // Submit claim mutation
  const submitClaimMutation = useMutation({
    mutationFn: (claimId: string) => insuranceService.claims.submit(claimId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      setShowDetailsModal(false);
      setSelectedClaim(null);
      toast.success('Claim submitted to insurer');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to submit claim')),
  });

  // Approve claim mutation
  const approveClaimMutation = useMutation({
    mutationFn: ({ claimId, approvedAmount }: { claimId: string; approvedAmount: number }) =>
      insuranceService.claims.approve(claimId, approvedAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      setShowDetailsModal(false);
      setSelectedClaim(null);
      setApproveAmount(0);
      toast.success('Claim approval recorded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record approval')),
  });

  // Reject claim mutation
  const rejectClaimMutation = useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) =>
      insuranceService.claims.reject(claimId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      setShowDetailsModal(false);
      setSelectedClaim(null);
      setRejectReason('');
      toast.success('Claim rejection recorded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record rejection')),
  });

  // Create claim from encounter mutation
  const createClaimFromEncounterMutation = useMutation({
    mutationFn: (encounterId: string) => insuranceService.encounters.createClaimFromEncounter(encounterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      queryClient.invalidateQueries({ queryKey: ['insurance-awaiting-claims'] });
      toast.success('Claim created from encounter');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create claim from encounter')),
  });

  // Transform claims to display format
  const claims: ClaimDisplay[] = useMemo(() => {
    return (claimsData || []).map(transformClaimToDisplay);
  }, [claimsData]);

  // Provider options — VALUE is the id (sending the name as providerId cast a
  // non-UUID into a uuid column and 500'd the whole list)
  const providerOptions = useMemo(
    () => (providersData || []).map((p: InsuranceProvider) => ({ id: p.id, name: p.name })),
    [providersData],
  );

  const stats = useMemo(() => ({
    submitted: claims.filter(c => c.status === 'submitted').length,
    approved: claims.filter(c => c.status === 'approved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
    pending: claims.filter(c => c.status === 'in_review').length,
    totalAmount: claims.reduce((sum, c) => sum + c.amount, 0),
    approvedAmount: claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + (c.approvedAmount || 0), 0),
  }), [claims]);

  const filteredClaims = useMemo(() => {
    return claims.filter(claim => {
      const matchesSearch = claim.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.patientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
      const matchesProvider = !providerFilter || claim.providerId === providerFilter;
      const matchesDateFrom = !dateFrom || claim.submissionDate >= dateFrom;
      const matchesDateTo = !dateTo || claim.submissionDate <= dateTo;
      return matchesSearch && matchesStatus && matchesProvider && matchesDateFrom && matchesDateTo;
    });
  }, [claims, searchTerm, statusFilter, providerFilter, dateFrom, dateTo]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      submitted: 'bg-blue-100 text-blue-700',
      in_review: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      paid: 'bg-emerald-100 text-emerald-700',
      appealed: 'bg-orange-100 text-orange-700',
    };
    const icons: Record<string, React.ReactNode> = {
      draft: <FileText className="w-3 h-3" />,
      submitted: <Send className="w-3 h-3" />,
      in_review: <Clock className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />,
      paid: <CheckCircle className="w-3 h-3" />,
      appealed: <RefreshCw className="w-3 h-3" />,
    };
    const displayName = status === 'in_review' ? 'In Review' : status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {icons[status]}
        {displayName}
      </span>
    );
  };

  const handleExport = () => {
    const headers = ['Claim #', 'Patient', 'Provider', 'Service Date', 'Amount', 'Status'];
    const rows = filteredClaims.map(c => [
      c.claimNumber,
      c.patientName,
      c.provider,
      c.serviceDate,
      c.amount,
      c.status,
    ]);
    const csvContent = '\ufeff' + toCsv([headers, ...rows]);
    downloadBlob(
      `insurance-claims-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv;charset=utf-8',
      csvContent,
    );
  };

  // Server-side payer-formatted (NHIS-style) batch CSV export. Pulls real claim
  // line-items rather than the on-screen summary, so the file is uploadable to
  // an insurer portal.
  const handleBatchPayerExport = async () => {
    if (!providerFilter) {
      toast.error('Pick a specific provider for the batch export');
      return;
    }
    const from = dateFrom || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);
    const to = dateTo || new Date().toISOString().slice(0, 10);
    try {
      const res = await api.get('/insurance/claims/export.csv', {
        params: { providerId: providerFilter, dateFrom: from, dateTo: to },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claims_batch_${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      const count = res.headers['x-claim-count'];
      toast.success(`Exported ${count ?? ''} claims`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Batch export failed');
    }
  };

  const handleClaimPdf = async (claimId: string) => {
    try {
      const res = await api.get(`/insurance/claims/${claimId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not generate PDF');
    }
  };

  const handleCreateClaim = () => {
    if (!selectedPatient || !selectedPolicy || !newClaimForm.primaryDiagnosis) {
      toast.error('Please select a patient, policy, and enter the diagnosis');
      return;
    }
    createClaimMutation.mutate();
  };

  const handleApprove = (claim: ClaimDisplay) => {
    const amount = approveAmount || claim.amount;
    approveClaimMutation.mutate({ claimId: claim.id, approvedAmount: amount });
  };

  const handleReject = (claim: ClaimDisplay) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    rejectClaimMutation.mutate({ claimId: claim.id, reason: rejectReason });
  };

  const handleCreateClaimFromEncounter = (encounterId: string) => {
    createClaimFromEncounterMutation.mutate(encounterId);
  };

  const isLoading = isLoadingClaims || isLoadingProviders || isLoadingAwaiting;
  const isMutating = createClaimMutation.isPending || submitClaimMutation.isPending || 
                     approveClaimMutation.isPending || rejectClaimMutation.isPending ||
                     createClaimFromEncounterMutation.isPending;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Insurance Claims</h1>
            <p className="text-gray-500 text-sm">Manage and track insurance claims</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchClaims(); refetchAwaiting(); }}
            className="btn-secondary flex items-center gap-2"
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleBatchPayerExport}
            className="btn-secondary flex items-center gap-2"
            title="NHIS-style CSV batch for the filtered provider + date range"
          >
            <Upload className="w-4 h-4" />
            Payer Batch CSV
          </button>
          <button onClick={() => setShowNewClaimModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Claim
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 flex-shrink-0 border-b">
        <button
          onClick={() => setActiveTab('awaiting')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'awaiting'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Awaiting Claims
          {(awaitingEncounters?.length || 0) > 0 && (
            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
              {awaitingEncounters?.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'claims'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          All Claims
          <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
            {claims.length}
          </span>
        </button>
      </div>

      {/* Awaiting Claims Section */}
      {activeTab === 'awaiting' && (
        <div className="card flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-orange-50 to-yellow-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Insurance Patient Encounters</h2>
                <p className="text-sm text-gray-500">
                  Patients who visited with insurance - click "Create Claim" to generate claim from services
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-auto flex-1">
            {isLoadingAwaiting ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading encounters...</span>
              </div>
            ) : !awaitingEncounters?.length ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <CheckCircle className="w-12 h-12 text-green-300 mb-3" />
                <p className="font-medium">No pending insurance encounters</p>
                <p className="text-sm">All insurance patient services have been claimed</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visit #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {awaitingEncounters.map((enc) => (
                    <tr key={enc.encounterId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-gray-900">{enc.visitNumber}</span>
                        <span className="ml-2 text-xs text-gray-500 uppercase">{enc.encounterType}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{enc.patient.fullName}</div>
                        <div className="text-xs text-gray-500">MRN: {enc.patient.mrn}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{enc.provider.name}</div>
                        <div className="text-xs text-gray-500">
                          Policy: {enc.insurancePolicy.policyNumber}
                          {enc.insurancePolicy.memberNumber && ` / ${enc.insurancePolicy.memberNumber}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {new Date(enc.serviceDate).toLocaleDateString('en-UG')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-sm">{enc.invoice.invoiceNumber}</span>
                        <span className="ml-2 text-xs text-gray-500">({enc.invoice.itemCount} items)</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                        {formatCurrency(enc.invoice.totalAmount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => handleCreateClaimFromEncounter(enc.encounterId)}
                          disabled={createClaimFromEncounterMutation.isPending}
                          className="btn-primary text-sm px-3 py-1 flex items-center gap-1"
                        >
                          {createClaimFromEncounterMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                          Create Claim
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Claims Tab Content */}
      {activeTab === 'claims' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3 cursor-pointer hover:ring-2 ring-blue-500" onClick={() => setStatusFilter('submitted')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Submitted</p>
              <p className="text-xl font-bold text-blue-600">{stats.submitted}</p>
            </div>
            <Send className="w-8 h-8 text-blue-200" />
          </div>
        </div>
        <div className="card p-3 cursor-pointer hover:ring-2 ring-green-500" onClick={() => setStatusFilter('approved')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Approved</p>
              <p className="text-xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-200" />
          </div>
        </div>
        <div className="card p-3 cursor-pointer hover:ring-2 ring-red-500" onClick={() => setStatusFilter('rejected')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Rejected</p>
              <p className="text-xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-200" />
          </div>
        </div>
        <div className="card p-3 cursor-pointer hover:ring-2 ring-yellow-500" onClick={() => setStatusFilter('in_review')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Under Review</p>
              <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by claim # or patient..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 py-2 text-sm"
            />
          </div>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="input py-2 text-sm w-40"
          >
            <option value="">All Providers</option>
            {providerOptions.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input py-2 text-sm w-36"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
            <option value="appealed">Appealed</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input py-2 text-sm"
              placeholder="From"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input py-2 text-sm"
              placeholder="To"
            />
          </div>
          {(statusFilter !== 'all' || providerFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setStatusFilter('all'); setProviderFilter(''); setDateFrom(''); setDateTo(''); }}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <Filter className="w-3 h-3" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Claims Table */}
      <div className="card flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading claims...</span>
            </div>
          ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Claim #</th>
                <th className="text-left p-3 font-medium text-gray-600">Patient</th>
                <th className="text-left p-3 font-medium text-gray-600">Provider</th>
                <th className="text-left p-3 font-medium text-gray-600">Service</th>
                <th className="text-right p-3 font-medium text-gray-600">Amount</th>
                <th className="text-left p-3 font-medium text-gray-600">Date</th>
                <th className="text-left p-3 font-medium text-gray-600">Status</th>
                <th className="text-center p-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredClaims.map(claim => (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <span className="font-mono text-blue-600">{claim.claimNumber}</span>
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{claim.patientName}</p>
                    <p className="text-xs text-gray-500">{claim.patientMrn}</p>
                  </td>
                  <td className="p-3 text-gray-600">{claim.provider}</td>
                  <td className="p-3 text-gray-600">{claim.serviceType}</td>
                  <td className="p-3 text-right font-medium">
                    {formatCurrency(claim.amount)}
                    {claim.approvedAmount && claim.approvedAmount !== claim.amount && (
                      <p className="text-xs text-green-600">Approved: {claim.approvedAmount.toLocaleString()}</p>
                    )}
                  </td>
                  <td className="p-3 text-gray-600">{claim.submissionDate}</td>
                  <td className="p-3">{getStatusBadge(claim.status)}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setSelectedClaim(claim); setApproveAmount(claim.amount); setShowDetailsModal(true); }}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                        title="View Details"
                        disabled={isMutating}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClaims.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No claims yet</h3>
                    <p className="text-gray-500 mb-4">Get started by submitting your first insurance claim.</p>
                    <button onClick={() => setShowNewClaimModal(true)} className="btn-primary inline-flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      New Claim
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
        <div className="p-3 border-t bg-gray-50 flex-shrink-0 flex items-center justify-between text-sm text-gray-600">
          <span>Showing {filteredClaims.length} of {claims.length} claims</span>
          <div className="flex items-center gap-4">
            <span>Total: <strong>{formatCurrency(stats.totalAmount)}</strong></span>
            <span className="text-green-600">Approved: <strong>{formatCurrency(stats.approvedAmount)}</strong></span>
          </div>
        </div>
      </div>
        </>
      )}

      {/* New Claim Modal */}
      {showNewClaimModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-lg">Submit New Claim</h2>
              <button onClick={() => { setShowNewClaimModal(false); setPatientSearch(''); setSelectedPatient(null); setSelectedPolicy(null); }} className="p-1 hover:bg-gray-100 rounded" disabled={createClaimMutation.isPending}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Patient Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Patient *</label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{selectedPatient.fullName}</p>
                      <p className="text-sm text-gray-500">MRN: {selectedPatient.mrn}</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedPatient(null); setSelectedPolicy(null); setPatientSearch(''); }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Search by name or MRN..." 
                      className="input pl-10"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    {isSearchingPatients && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                    )}
                    {patientSearch.length >= 2 && patientResults?.data && patientResults.data.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {patientResults.data.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setSelectedPatient(p); setPatientSearch(''); }}
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b last:border-b-0"
                          >
                            <p className="font-medium">{p.fullName}</p>
                            <p className="text-xs text-gray-500">MRN: {p.mrn}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Policy Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Policy *</label>
                {!selectedPatient ? (
                  <p className="text-sm text-gray-400 italic">Select a patient first</p>
                ) : isLoadingPolicies ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading policies...</span>
                  </div>
                ) : !patientPolicies?.length ? (
                  <p className="text-sm text-orange-600">No active insurance policies found for this patient</p>
                ) : (
                  <select 
                    className="input"
                    value={selectedPolicy?.id || ''}
                    onChange={(e) => {
                      const policy = patientPolicies.find(p => p.id === e.target.value);
                      setSelectedPolicy(policy || null);
                    }}
                  >
                    <option value="">Select a policy...</option>
                    {patientPolicies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.provider?.name || 'Unknown'} - {policy.policyNumber} ({policy.coverageType})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Claim Type *</label>
                  <select
                    className="input"
                    value={newClaimForm.claimType}
                    onChange={(e) => setNewClaimForm({ ...newClaimForm, claimType: e.target.value })}
                  >
                    <option value="outpatient">Outpatient</option>
                    <option value="inpatient">Inpatient</option>
                    <option value="maternity">Maternity</option>
                    <option value="emergency">Emergency</option>
                    <option value="surgical">Surgical</option>
                    <option value="diagnostic">Diagnostic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={newClaimForm.serviceDate}
                    onChange={(e) => setNewClaimForm({ ...newClaimForm, serviceDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Diagnosis *</label>
                <input
                  type="text"
                  placeholder="e.g. Malaria (B54)"
                  className="input"
                  value={newClaimForm.primaryDiagnosis}
                  onChange={(e) => setNewClaimForm({ ...newClaimForm, primaryDiagnosis: e.target.value })}
                />
              </div>
              <p className="text-xs text-gray-500">
                The claim is created as a DRAFT — claimed amounts come from the invoice items you
                attach; use "Create from encounter" on the Awaiting tab when billing an existing visit.
              </p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => { setShowNewClaimModal(false); setPatientSearch(''); setSelectedPatient(null); setSelectedPolicy(null); }} className="btn-secondary" disabled={createClaimMutation.isPending}>Cancel</button>
              <button
                onClick={handleCreateClaim}
                className="btn-primary flex items-center gap-2"
                disabled={createClaimMutation.isPending || !selectedPatient || !selectedPolicy || !newClaimForm.primaryDiagnosis}
              >
                {createClaimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {createClaimMutation.isPending ? 'Creating…' : 'Create Draft Claim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Details Modal */}
      {showDetailsModal && selectedClaim && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="font-semibold text-lg">{selectedClaim.claimNumber}</h2>
                {getStatusBadge(selectedClaim.status)}
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500">Patient</p>
                  <p className="font-medium">{selectedClaim.patientName}</p>
                  <p className="text-sm text-gray-500">{selectedClaim.patientMrn}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Insurance Provider</p>
                  <p className="font-medium">{selectedClaim.provider}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Service Type</p>
                  <p className="font-medium">{selectedClaim.serviceType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Service Date</p>
                  <p className="font-medium">{selectedClaim.serviceDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Claim Amount</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedClaim.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Submission Date</p>
                  <p className="font-medium">{selectedClaim.submissionDate}</p>
                </div>
              </div>

              {selectedClaim.status === 'approved' && selectedClaim.approvedAmount && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Approved Amount: {formatCurrency(selectedClaim.approvedAmount)}</span>
                  </div>
                </div>
              )}

              {selectedClaim.status === 'rejected' && selectedClaim.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Rejection Reason</p>
                      <p className="text-sm">{selectedClaim.rejectionReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedClaim.status === 'in_review' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Awaiting insurance response</span>
                  </div>
                </div>
              )}

              {/* Approve/Reject Actions for submitted or in_review claims */}
              {(selectedClaim.status === 'submitted' || selectedClaim.status === 'in_review') && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">Claim Actions</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Approved Amount (UGX)</label>
                      <input 
                        type="number" 
                        className="input w-full"
                        value={approveAmount || ''}
                        onChange={(e) => setApproveAmount(parseFloat(e.target.value) || 0)}
                        placeholder="Enter approved amount..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleApprove(selectedClaim)}
                        className="btn-primary flex items-center gap-2 flex-1"
                        disabled={approveClaimMutation.isPending || !approveAmount}
                      >
                        {approveClaimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        Approve
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Rejection Reason</label>
                      <textarea 
                        className="input w-full"
                        rows={2}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Enter reason for rejection..."
                      />
                    </div>
                    <button 
                      onClick={() => handleReject(selectedClaim)}
                      className="btn-secondary text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-2 w-full justify-center"
                      disabled={rejectClaimMutation.isPending || !rejectReason.trim()}
                    >
                      {rejectClaimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                  </div>
                </div>
              )}


              {/* Status */}
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Status</p>
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${selectedClaim.status === 'approved' || selectedClaim.status === 'paid' ? 'bg-green-500' : selectedClaim.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                  <div>
                    <p className="text-sm font-medium capitalize">{String(selectedClaim.status).replace('_', ' ')}</p>
                    <p className="text-xs text-gray-500">
                      {selectedClaim.submissionDate ? `Submitted ${selectedClaim.submissionDate}` : 'Not yet submitted'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
              <button
                onClick={() => handleClaimPdf(selectedClaim.id)}
                className="btn-secondary flex items-center gap-2"
                title="Open printable claim form"
              >
                <FileText className="w-4 h-4" />
                Print Form (PDF)
              </button>
              {selectedClaim.status === 'draft' && (
                <button 
                  onClick={() => submitClaimMutation.mutate(selectedClaim.id)} 
                  className="btn-primary flex items-center gap-2"
                  disabled={submitClaimMutation.isPending}
                >
                  {submitClaimMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Claim
                </button>
              )}
              <button onClick={() => { setShowDetailsModal(false); setRejectReason(''); setApproveAmount(0); }} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
