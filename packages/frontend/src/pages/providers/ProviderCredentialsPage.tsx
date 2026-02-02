import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Award,
  AlertTriangle,
  Clock,
  CheckCircle,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Calendar,
  FileText,
  Bell,
  RefreshCw,
  Mail,
  User,
  Building2,
  X,
} from 'lucide-react';

interface ProviderCredential {
  id: string;
  providerId: string;
  providerName: string;
  providerType: string;
  departmentName: string;
  licenseNumber: string;
  licenseType: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'PENDING_RENEWAL';
  renewalSubmittedAt?: string;
  documentUrl?: string;
}

// Empty data - to be populated from API
const mockCredentials: ProviderCredential[] = [];

const statusFilters = ['All', 'VALID', 'EXPIRING_SOON', 'EXPIRED', 'PENDING_RENEWAL'];

export default function ProviderCredentialsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCredential, setSelectedCredential] = useState<ProviderCredential | null>(null);
  const [showRenewalModal, setShowRenewalModal] = useState(false);

  const { data: credentials, isLoading } = useQuery({
    queryKey: ['provider-credentials'],
    queryFn: async () => mockCredentials,
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      toast.success('Reminder sent successfully');
    },
  });

  const submitRenewalMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-credentials'] });
      setShowRenewalModal(false);
    },
  });

  const items = credentials || mockCredentials;

  const filteredCredentials = items.filter((cred) => {
    const matchesSearch = 
      cred.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cred.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'All' || cred.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VALID': return 'bg-green-100 text-green-700';
      case 'EXPIRING_SOON': return 'bg-orange-100 text-orange-700';
      case 'EXPIRED': return 'bg-red-100 text-red-700';
      case 'PENDING_RENEWAL': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VALID': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'EXPIRING_SOON': return <Clock className="w-4 h-4 text-orange-600" />;
      case 'EXPIRED': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'PENDING_RENEWAL': return <RefreshCw className="w-4 h-4 text-blue-600" />;
      default: return null;
    }
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const validCount = items.filter(c => c.status === 'VALID').length;
  const expiringCount = items.filter(c => c.status === 'EXPIRING_SOON').length;
  const expiredCount = items.filter(c => c.status === 'EXPIRED').length;
  const pendingCount = items.filter(c => c.status === 'PENDING_RENEWAL').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider Credentials</h1>
          <p className="text-gray-600">Track license expiry and renewal status</p>
        </div>
        <button
          onClick={() => {
            const expiring = items.filter(c => c.status === 'EXPIRING_SOON' || c.status === 'EXPIRED');
            if (expiring.length > 0) {
              expiring.forEach(c => sendReminderMutation.mutate(c.id));
            }
          }}
          disabled={sendReminderMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Bell className="w-4 h-4" />
          Send All Reminders
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Valid</p>
              <p className="text-xl font-bold text-green-600">{validCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-xl font-bold text-orange-600">{expiringCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expired</p>
              <p className="text-xl font-bold text-red-600">{expiredCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Renewal</p>
              <p className="text-xl font-bold text-blue-600">{pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts - only show if there are expiring or expired items */}
      {(expiringCount > 0 || expiredCount > 0) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-orange-800">Attention Required</h3>
              <p className="text-sm text-orange-700">
                {expiringCount > 0 && `${expiringCount} license(s) expiring within 30 days. `}
                {expiredCount > 0 && `${expiredCount} license(s) have expired.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or license number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {statusFilters.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Credentials Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Provider</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">License</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Issuing Authority</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Expiry</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredCredentials.map((cred) => (
              <tr key={cred.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{cred.providerName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {cred.departmentName} • {cred.providerType.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{cred.licenseNumber}</p>
                    <p className="text-xs text-gray-500">{cred.licenseType}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{cred.issuingAuthority}</span>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm text-gray-900">
                      {new Date(cred.expiryDate).toLocaleDateString()}
                    </p>
                    <p className={`text-xs ${
                      getDaysUntilExpiry(cred.expiryDate) < 0
                        ? 'text-red-600'
                        : getDaysUntilExpiry(cred.expiryDate) <= 30
                        ? 'text-orange-600'
                        : 'text-gray-500'
                    }`}>
                      {getDaysUntilExpiry(cred.expiryDate) < 0
                        ? `Expired ${Math.abs(getDaysUntilExpiry(cred.expiryDate))} days ago`
                        : `${getDaysUntilExpiry(cred.expiryDate)} days remaining`}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(cred.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cred.status)}`}>
                      {cred.status.replace('_', ' ')}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedCredential(cred)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="View details"
                    >
                      <FileText className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => sendReminderMutation.mutate(cred.id)}
                      disabled={sendReminderMutation.isPending}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Send reminder"
                    >
                      <Mail className="w-4 h-4 text-blue-500" />
                    </button>
                    {(cred.status === 'EXPIRING_SOON' || cred.status === 'EXPIRED') && (
                      <button
                        onClick={() => {
                          setSelectedCredential(cred);
                          setShowRenewalModal(true);
                        }}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Submit Renewal
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCredentials.length === 0 && (
          <div className="text-center py-12">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No credentials found</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedCredential && !showRenewalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">License Details</h2>
              <button
                onClick={() => setSelectedCredential(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Provider</p>
                  <p className="font-medium">{selectedCredential.providerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Department</p>
                  <p className="font-medium">{selectedCredential.departmentName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">License Number</p>
                  <p className="font-medium">{selectedCredential.licenseNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">License Type</p>
                  <p className="font-medium">{selectedCredential.licenseType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Issuing Authority</p>
                  <p className="font-medium">{selectedCredential.issuingAuthority}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCredential.status)}`}>
                    {selectedCredential.status.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Issue Date</p>
                  <p className="font-medium">{new Date(selectedCredential.issueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expiry Date</p>
                  <p className="font-medium">{new Date(selectedCredential.expiryDate).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedCredential.renewalSubmittedAt && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    Renewal submitted on {new Date(selectedCredential.renewalSubmittedAt).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setSelectedCredential(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renewal Modal */}
      {showRenewalModal && selectedCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Submit License Renewal</h2>
              <button
                onClick={() => {
                  setShowRenewalModal(false);
                  setSelectedCredential(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">Renewing license for:</p>
                <p className="font-medium">{selectedCredential.providerName}</p>
                <p className="text-sm text-gray-500">{selectedCredential.licenseNumber}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Expiry Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Document</label>
                <input
                  type="file"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  placeholder="Any additional notes..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowRenewalModal(false);
                  setSelectedCredential(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => submitRenewalMutation.mutate(selectedCredential.id)}
                disabled={submitRenewalMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {submitRenewalMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Renewal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
