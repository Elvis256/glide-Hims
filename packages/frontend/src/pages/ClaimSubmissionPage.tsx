import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Search,
  ArrowLeft,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  DollarSign,
  Calendar,
  Loader2,
} from 'lucide-react';
import { insuranceService, type Claim as APIClaim } from '../services/insurance';

interface ClaimUI {
  id: string;
  claimNumber: string;
  patientName: string;
  patientMrn: string;
  provider: string;
  totalAmount: number;
  submittedDate: string;
  status: 'draft' | 'submitted' | 'processing' | 'approved' | 'rejected' | 'paid';
  paidAmount?: number;
  rejectionReason?: string;
}

// Transform API Claim to UI format
const transformClaim = (claim: APIClaim): ClaimUI => ({
  id: claim.id,
  claimNumber: claim.claimNumber,
  patientName: claim.policy?.provider?.name ? `Patient ${claim.patientId.slice(-4)}` : 'Unknown Patient',
  patientMrn: claim.patientId,
  provider: claim.policy?.provider?.name || 'Unknown Provider',
  totalAmount: claim.totalAmount,
  submittedDate: claim.submittedAt ? claim.submittedAt.split('T')[0] : claim.createdAt.split('T')[0],
  status: claim.status === 'appealed' ? 'submitted' : claim.status,
  paidAmount: claim.paidAmount,
  rejectionReason: claim.rejectionReason,
});

export default function ClaimSubmissionPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedClaim, setSelectedClaim] = useState<ClaimUI | null>(null);

  // Fetch claims from API
  const { data: apiClaims = [], isLoading, error } = useQuery({
    queryKey: ['insurance-claims'],
    queryFn: () => insuranceService.claims.list(),
  });

  // Transform API claims to UI format
  const claims = useMemo(() => apiClaims.map(transformClaim), [apiClaims]);

  const filteredClaims = claims.filter((claim) => {
    const matchesSearch = 
      claim.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.patientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    submitted: claims.filter(c => c.status === 'submitted').length,
    processing: claims.filter(c => c.status === 'processing').length,
    approved: claims.filter(c => c.status === 'approved' || c.status === 'paid').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
    totalPending: claims.filter(c => ['submitted', 'processing'].includes(c.status)).reduce((sum, c) => sum + c.totalAmount, 0),
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; icon: React.ReactNode }> = {
      draft: { bg: 'bg-gray-100 text-gray-700', icon: <FileText className="w-3 h-3" /> },
      submitted: { bg: 'bg-blue-100 text-blue-700', icon: <Send className="w-3 h-3" /> },
      processing: { bg: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
      approved: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      paid: { bg: 'bg-green-100 text-green-700', icon: <DollarSign className="w-3 h-3" /> },
      rejected: { bg: 'bg-red-100 text-red-700', icon: <AlertCircle className="w-3 h-3" /> },
    };
    const c = config[status] || config.draft;
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${c.bg}`}>
        {c.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Claim Submission</h1>
              <p className="text-gray-500 text-sm">Submit and track insurance claims</p>
            </div>
          </div>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Upload className="w-4 h-4" />
          New Claim
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{stats.submitted}</p>
          <p className="text-xs text-gray-500">Submitted</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-yellow-600">{stats.processing}</p>
          <p className="text-xs text-gray-500">Processing</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-green-600">{stats.approved}</p>
          <p className="text-xs text-gray-500">Approved/Paid</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-xl font-bold text-red-600">{stats.rejected}</p>
          <p className="text-xs text-gray-500">Rejected</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gray-900">UGX {(stats.totalPending / 1000).toFixed(0)}K</p>
          <p className="text-xs text-gray-500">Pending Amount</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Claims List */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <div className="flex gap-3 mb-3 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search claim or patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-9 py-2 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-2 text-sm w-32"
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="processing">Processing</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-500">Loading claims...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8 text-red-500">
                <AlertCircle className="w-5 h-5 mr-2" />
                <span>Failed to load claims</span>
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <FileText className="w-5 h-5 mr-2 opacity-50" />
                <span>No claims found</span>
              </div>
            ) : (
              filteredClaims.map((claim) => (
              <button
                key={claim.id}
                onClick={() => setSelectedClaim(claim)}
                className={`w-full p-3 border rounded-lg text-left transition-colors ${
                  selectedClaim?.id === claim.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm text-blue-600">{claim.claimNumber}</span>
                  {getStatusBadge(claim.status)}
                </div>
                <p className="font-medium text-gray-900">{claim.patientName}</p>
                <div className="flex justify-between mt-1 text-sm">
                  <span className="text-gray-500">{claim.provider}</span>
                  <span className="font-medium">UGX {claim.totalAmount.toLocaleString()}</span>
                </div>
              </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Claim Details */}
        <div className="card p-4 flex flex-col min-h-0">
          {!selectedClaim ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select a claim to view details</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono font-bold text-blue-600">{selectedClaim.claimNumber}</span>
                {getStatusBadge(selectedClaim.status)}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Patient</h3>
                  <p className="font-medium">{selectedClaim.patientName}</p>
                  <p className="text-sm text-gray-500">{selectedClaim.patientMrn}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Insurance</h3>
                  <p className="text-sm">{selectedClaim.provider}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Claim Amount</h3>
                  <div className="border-t mt-2 pt-2 flex justify-between font-medium">
                    <span>Total</span>
                    <span>UGX {selectedClaim.totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {selectedClaim.paidAmount && (
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-sm text-green-700">
                      Paid: <span className="font-bold">UGX {selectedClaim.paidAmount.toLocaleString()}</span>
                    </p>
                  </div>
                )}

                {selectedClaim.rejectionReason && (
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 inline mr-1" />
                      {selectedClaim.rejectionReason}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  <span>Submitted: {selectedClaim.submittedDate}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
