import { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { insuranceService } from '../../../services/insurance';
import type { Claim } from '../../../services/insurance';

// Extended claim type for UI display (pending API integration)
interface ClaimDisplay {
  id: string;
  claimNumber: string;
  patientName: string;
  patientMrn: string;
  provider: string;
  serviceType: string;
  serviceDate: string;
  submissionDate: string;
  amount: number;
  approvedAmount?: number;
  status: 'draft' | 'submitted' | 'processing' | 'approved' | 'rejected' | 'pending' | 'paid' | 'appealed';
  documents: { name: string }[];
  rejectionReason?: string;
}

const claims: ClaimDisplay[] = [];

const providers = ['All Providers', 'NHIF', 'Jubilee Insurance', 'AAR Insurance', 'UAP Insurance', 'Britam'];


export default function ClaimsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('All Providers');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedClaim, setSelectedClaim] = useState<ClaimDisplay | null>(null);
  const [showNewClaimModal, setShowNewClaimModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const stats = useMemo(() => ({
    submitted: claims.filter(c => c.status === 'submitted').length,
    approved: claims.filter(c => c.status === 'approved').length,
    rejected: claims.filter(c => c.status === 'rejected').length,
    pending: claims.filter(c => c.status === 'pending').length,
    totalAmount: claims.reduce((sum, c) => sum + c.amount, 0),
    approvedAmount: claims.filter(c => c.status === 'approved').reduce((sum, c) => sum + (c.approvedAmount || 0), 0),
  }), []);

  const filteredClaims = useMemo(() => {
    return claims.filter(claim => {
      const matchesSearch = claim.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        claim.patientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
      const matchesProvider = providerFilter === 'All Providers' || claim.provider === providerFilter;
      const matchesDateFrom = !dateFrom || claim.submissionDate >= dateFrom;
      const matchesDateTo = !dateTo || claim.submissionDate <= dateTo;
      return matchesSearch && matchesStatus && matchesProvider && matchesDateFrom && matchesDateTo;
    });
  }, [searchTerm, statusFilter, providerFilter, dateFrom, dateTo]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
    };
    const icons: Record<string, React.ReactNode> = {
      submitted: <Send className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />,
      pending: <Clock className="w-3 h-3" />,
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleExport = () => {
    alert('Exporting claims report...');
  };

  const handleResubmit = (claim: ClaimDisplay) => {
    alert(`Resubmitting claim ${claim.claimNumber}...`);
    setShowDetailsModal(false);
  };

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
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => setShowNewClaimModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Claim
          </button>
        </div>
      </div>

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
        <div className="card p-3 cursor-pointer hover:ring-2 ring-yellow-500" onClick={() => setStatusFilter('pending')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Pending</p>
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
            {providers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input py-2 text-sm w-32"
          >
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="pending">Pending</option>
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
          {(statusFilter !== 'all' || providerFilter !== 'All Providers' || dateFrom || dateTo) && (
            <button
              onClick={() => { setStatusFilter('all'); setProviderFilter('All Providers'); setDateFrom(''); setDateTo(''); }}
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
                    UGX {claim.amount.toLocaleString()}
                    {claim.approvedAmount && claim.approvedAmount !== claim.amount && (
                      <p className="text-xs text-green-600">Approved: {claim.approvedAmount.toLocaleString()}</p>
                    )}
                  </td>
                  <td className="p-3 text-gray-600">{claim.submissionDate}</td>
                  <td className="p-3">{getStatusBadge(claim.status)}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => { setSelectedClaim(claim); setShowDetailsModal(true); }}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {claim.status === 'rejected' && (
                        <button
                          onClick={() => handleResubmit(claim)}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-orange-600"
                          title="Resubmit"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
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
        </div>
        <div className="p-3 border-t bg-gray-50 flex-shrink-0 flex items-center justify-between text-sm text-gray-600">
          <span>Showing {filteredClaims.length} of {claims.length} claims</span>
          <div className="flex items-center gap-4">
            <span>Total: <strong>UGX {stats.totalAmount.toLocaleString()}</strong></span>
            <span className="text-green-600">Approved: <strong>UGX {stats.approvedAmount.toLocaleString()}</strong></span>
          </div>
        </div>
      </div>

      {/* New Claim Modal */}
      {showNewClaimModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-lg">Submit New Claim</h2>
              <button onClick={() => setShowNewClaimModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
                <input type="text" placeholder="Search patient..." className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                <select className="input">
                  <option>Select provider...</option>
                  {providers.slice(1).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                  <select className="input">
                    <option>Consultation</option>
                    <option>Lab Tests</option>
                    <option>Radiology</option>
                    <option>Pharmacy</option>
                    <option>Surgery</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Date</label>
                  <input type="date" className="input" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Claim Amount (UGX)</label>
                <input type="number" placeholder="Enter amount..." className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Documents</label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Drag & drop files or click to upload</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={() => setShowNewClaimModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => { setShowNewClaimModal(false); alert('Claim submitted!'); }} className="btn-primary flex items-center gap-2">
                <Send className="w-4 h-4" />
                Submit Claim
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
                  <p className="font-medium text-lg">UGX {selectedClaim.amount.toLocaleString()}</p>
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
                    <span className="font-medium">Approved Amount: UGX {selectedClaim.approvedAmount.toLocaleString()}</span>
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

              {selectedClaim.status === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Awaiting insurance response</span>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Attached Documents</p>
                <div className="space-y-2">
                  {selectedClaim.documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{doc.name}</span>
                      </div>
                      <button className="text-blue-600 text-sm hover:underline">View</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Timeline */}
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Status History</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                    <div>
                      <p className="text-sm font-medium">Claim Submitted</p>
                      <p className="text-xs text-gray-500">{selectedClaim.submissionDate} at 09:30 AM</p>
                    </div>
                  </div>
                  {selectedClaim.status !== 'submitted' && (
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${selectedClaim.status === 'approved' ? 'bg-green-500' : selectedClaim.status === 'rejected' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                      <div>
                        <p className="text-sm font-medium capitalize">{selectedClaim.status}</p>
                        <p className="text-xs text-gray-500">{selectedClaim.submissionDate} at 02:15 PM</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
              {selectedClaim.status === 'rejected' && (
                <button onClick={() => handleResubmit(selectedClaim)} className="btn-primary flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Resubmit Claim
                </button>
              )}
              <button onClick={() => setShowDetailsModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
