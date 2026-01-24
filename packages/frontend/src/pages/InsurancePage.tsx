import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Shield,
  Users,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Phone,
  Mail,
  Building,
  DollarSign,
  ClipboardCheck,
  RefreshCw,
  XCircle,
  Eye,
} from 'lucide-react';

interface InsuranceProvider {
  id: string;
  name: string;
  code: string;
  providerType: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  paymentTermsDays: number;
  claimSubmissionMethod: string;
}

interface InsurancePolicy {
  id: string;
  policyNumber: string;
  membershipNumber: string;
  provider: InsuranceProvider;
  patient: { id: string; firstName: string; lastName: string; mrn: string };
  planName?: string;
  coverageType: string;
  maxCoverageAmount?: number;
  usedAmount: number;
  startDate: string;
  endDate: string;
  status: string;
}

interface InsuranceClaim {
  id: string;
  claimNumber: string;
  status: string;
  totalAmount: number;
  approvedAmount?: number;
  paidAmount?: number;
  submissionDate?: string;
  provider?: InsuranceProvider;
  patient: { id: string; firstName: string; lastName: string; mrn: string };
  createdAt: string;
}

interface PreAuthorization {
  id: string;
  preAuthNumber: string;
  status: string;
  requestedAmount?: number;
  approvedAmount?: number;
  serviceDescription: string;
  patient: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface DashboardStats {
  totalProviders: number;
  activePolicies: number;
  pendingClaims: number;
  totalClaimsValue: number;
  pendingPreAuths: number;
  claimsThisMonth: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

export default function InsurancePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'providers' | 'policies' | 'claims' | 'preauth'>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [preAuths, setPreAuths] = useState<PreAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const response = await api.get('/insurance/dashboard');
        setStats(response.data);
      } else if (activeTab === 'providers') {
        const response = await api.get('/insurance/providers');
        setProviders(response.data.data || response.data);
      } else if (activeTab === 'policies') {
        const response = await api.get('/insurance/policies');
        setPolicies(response.data.data || response.data);
      } else if (activeTab === 'claims') {
        const response = await api.get('/insurance/claims');
        setClaims(response.data.data || response.data);
      } else if (activeTab === 'preauth') {
        const response = await api.get('/insurance/pre-auth');
        setPreAuths(response.data.data || response.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      approved: 'bg-green-100 text-green-800',
      paid: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      submitted: 'bg-blue-100 text-blue-800',
      in_review: 'bg-purple-100 text-purple-800',
      draft: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800',
      denied: 'bg-red-100 text-red-800',
      expired: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-gray-100 text-gray-800',
      partially_approved: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Insurance Providers</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalProviders || 0}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Building className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Policies</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.activePolicies || 0}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Claims</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.pendingClaims || 0}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-full">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Claims Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.totalClaimsValue || 0)}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Claims This Month</p>
              <p className="text-2xl font-bold text-blue-600">{stats?.claimsThisMonth || 0}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Approved This Month</p>
              <p className="text-2xl font-bold text-green-600">{stats?.approvedThisMonth || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rejected This Month</p>
              <p className="text-2xl font-bold text-red-600">{stats?.rejectedThisMonth || 0}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-200" />
          </div>
        </div>
      </div>

      {/* Pending Pre-Auths */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Pending Pre-Authorizations</h3>
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
            {stats?.pendingPreAuths || 0} pending
          </span>
        </div>
        <p className="text-gray-500 text-sm">
          Pre-authorization requests awaiting approval from insurance providers.
        </p>
      </div>
    </div>
  );

  const renderProviders = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Add Provider
        </button>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers
          .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                       p.code.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((provider) => (
          <div key={provider.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                <p className="text-sm text-gray-500">{provider.code}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                provider.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {provider.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Building className="h-4 w-4" />
                <span className="capitalize">{provider.providerType?.replace('_', ' ')}</span>
              </div>
              {provider.phone && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{provider.phone}</span>
                </div>
              )}
              {provider.email && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4" />
                  <span>{provider.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>Payment: {provider.paymentTermsDays} days</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex justify-end gap-2">
              <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
              <button className="text-gray-600 hover:text-gray-800 text-sm">View</button>
            </div>
          </div>
        ))}
      </div>

      {providers.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Providers Found</h3>
          <p className="text-gray-500 mt-2">Add insurance providers to get started.</p>
        </div>
      )}
    </div>
  );

  const renderPolicies = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by policy number, patient..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New Policy
          </button>
        </div>
      </div>

      {/* Policies Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Policy Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Coverage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {policies.map((policy) => (
              <tr key={policy.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{policy.policyNumber}</div>
                  <div className="text-sm text-gray-500">Member: {policy.membershipNumber}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {policy.patient?.firstName} {policy.patient?.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{policy.patient?.mrn}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{policy.provider?.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {policy.maxCoverageAmount ? formatCurrency(policy.maxCoverageAmount) : 'Unlimited'}
                  </div>
                  <div className="text-sm text-gray-500">
                    Used: {formatCurrency(policy.usedAmount || 0)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(policy.status)}`}>
                    {policy.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {policies.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Policies Found</h3>
            <p className="text-gray-500 mt-2">Create insurance policies for patients.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderClaims = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search claims..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            New Claim
          </button>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Claim #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {claims
              .filter(c => statusFilter === 'all' || c.status === statusFilter)
              .map((claim) => (
              <tr key={claim.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-blue-600">{claim.claimNumber}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {claim.patient?.firstName} {claim.patient?.lastName}
                  </div>
                  <div className="text-sm text-gray-500">{claim.patient?.mrn}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{claim.provider?.name || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{formatCurrency(claim.totalAmount)}</div>
                  {claim.approvedAmount && (
                    <div className="text-sm text-green-600">
                      Approved: {formatCurrency(claim.approvedAmount)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(claim.status)}`}>
                    {claim.status?.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(claim.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button className="text-blue-600 hover:text-blue-900">
                      <Eye className="h-4 w-4" />
                    </button>
                    {claim.status === 'draft' && (
                      <button className="text-green-600 hover:text-green-900">
                        <ClipboardCheck className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {claims.length === 0 && !loading && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Claims Found</h3>
            <p className="text-gray-500 mt-2">Submit insurance claims for billing.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderPreAuth = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search pre-authorizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Request Pre-Auth
        </button>
      </div>

      {/* Pre-Auth List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pre-Auth #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {preAuths.map((preAuth) => (
              <tr key={preAuth.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-blue-600">{preAuth.preAuthNumber}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {preAuth.patient?.firstName} {preAuth.patient?.lastName}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{preAuth.serviceDescription}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {preAuth.requestedAmount ? formatCurrency(preAuth.requestedAmount) : '-'}
                  </div>
                  {preAuth.approvedAmount && (
                    <div className="text-sm text-green-600">
                      Approved: {formatCurrency(preAuth.approvedAmount)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(preAuth.status)}`}>
                    {preAuth.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(preAuth.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-blue-600 hover:text-blue-900">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {preAuths.length === 0 && !loading && (
          <div className="text-center py-12">
            <ClipboardCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Pre-Authorizations</h3>
            <p className="text-gray-500 mt-2">Request pre-authorization for services.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <Shield className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insurance & Claims</h1>
            <p className="text-sm text-gray-500">Manage insurance providers, policies, and claims</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: AlertCircle },
            { id: 'providers', label: 'Providers', icon: Building },
            { id: 'policies', label: 'Policies', icon: FileText },
            { id: 'claims', label: 'Claims', icon: DollarSign },
            { id: 'preauth', label: 'Pre-Auth', icon: ClipboardCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'providers' && renderProviders()}
          {activeTab === 'policies' && renderPolicies()}
          {activeTab === 'claims' && renderClaims()}
          {activeTab === 'preauth' && renderPreAuth()}
        </>
      )}
    </div>
  );
}
