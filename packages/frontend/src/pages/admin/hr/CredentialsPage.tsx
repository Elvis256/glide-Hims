import { useState, useMemo } from 'react';
import {
  Award,
  Search,
  Plus,
  Edit,
  Eye,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  MoreVertical,
  FileText,
  Calendar,
  Bell,
  RefreshCw,
  Shield,
  Stethoscope,
} from 'lucide-react';

interface Credential {
  id: string;
  staffName: string;
  staffId: string;
  department: string;
  credentialType: string;
  credentialName: string;
  issuingBody: string;
  issueDate: string;
  expiryDate: string;
  status: 'Valid' | 'Expiring Soon' | 'Expired' | 'Pending Verification';
  documentUrl?: string;
  licenseNumber?: string;
}

interface CredentialType {
  id: string;
  name: string;
  category: 'License' | 'Certification' | 'Training' | 'Education';
  requiresRenewal: boolean;
  renewalPeriod: number;
  mandatory: boolean;
}

const credentials: Credential[] = [];

const credentialTypesList: CredentialType[] = [];

const statusConfig = {
  Valid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  'Expiring Soon': { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  Expired: { color: 'bg-red-100 text-red-800', icon: XCircle },
  'Pending Verification': { color: 'bg-blue-100 text-blue-800', icon: Clock },
};

const categoryIcons = {
  License: Shield,
  Certification: Award,
  Training: FileText,
  Education: Stethoscope,
};

export default function CredentialsPage() {
  const [activeTab, setActiveTab] = useState<'credentials' | 'types' | 'alerts'>('credentials');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const credentialTypes = useMemo(() => [...new Set(credentials.map((c) => c.credentialType))], []);

  const filteredCredentials = useMemo(() => {
    return credentials.filter((credential) => {
      const matchesSearch =
        credential.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credential.staffId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        credential.credentialName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || credential.status === statusFilter;
      const matchesType = typeFilter === 'all' || credential.credentialType === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [searchTerm, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    totalCredentials: credentials.length,
    valid: credentials.filter((c) => c.status === 'Valid').length,
    expiringSoon: credentials.filter((c) => c.status === 'Expiring Soon').length,
    expired: credentials.filter((c) => c.status === 'Expired').length,
  }), []);

  const expiringCredentials = useMemo(() => {
    return credentials
      .filter((c) => c.status === 'Expiring Soon' || c.status === 'Expired')
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, []);

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="h-7 w-7 text-blue-600" />
              Credentials & Certifications
            </h1>
            <p className="text-gray-600 mt-1">Track staff credentials, licenses, and certifications</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Credential
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Credentials</span>
              <Award className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalCredentials}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Valid</span>
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{stats.valid}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Expiring Soon</span>
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600">{stats.expiringSoon}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Expired</span>
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{stats.expired}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-1 mb-4 flex gap-1 w-fit">
        <button
          onClick={() => setActiveTab('credentials')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'credentials' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Award className="h-4 w-4 inline mr-2" />
          All Credentials
        </button>
        <button
          onClick={() => setActiveTab('types')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'types' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-2" />
          Credential Types
        </button>
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'alerts' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Bell className="h-4 w-4 inline mr-2" />
          Renewal Alerts
          {stats.expiringSoon + stats.expired > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs">
              {stats.expiringSoon + stats.expired}
            </span>
          )}
        </button>
      </div>

      {/* Credentials Tab */}
      {activeTab === 'credentials' && (
        <>
          <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search credentials..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="Valid">Valid</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                  <option value="Pending Verification">Pending</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  {credentialTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Credential</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Issuing Body</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">License #</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Expiry</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCredentials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">No credentials found</h3>
                        <p className="text-gray-500 mt-1">Add staff credentials to start tracking certifications and licenses.</p>
                      </td>
                    </tr>
                  ) : null}
                  {filteredCredentials.map((credential) => {
                    const StatusIcon = statusConfig[credential.status].icon;
                    const daysUntilExpiry = getDaysUntilExpiry(credential.expiryDate);
                    return (
                      <tr key={credential.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{credential.staffName}</p>
                            <p className="text-sm text-gray-500">{credential.department}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{credential.credentialName}</p>
                            <p className="text-sm text-gray-500">{credential.credentialType}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">{credential.issuingBody}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{credential.licenseNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="text-sm text-gray-600">{credential.expiryDate}</p>
                              {daysUntilExpiry > 0 && daysUntilExpiry <= 90 && (
                                <p className="text-xs text-yellow-600">{daysUntilExpiry} days left</p>
                              )}
                              {daysUntilExpiry <= 0 && (
                                <p className="text-xs text-red-600">Expired {Math.abs(daysUntilExpiry)} days ago</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[credential.status].color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {credential.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="p-1 hover:bg-gray-100 rounded" title="View">
                              <Eye className="h-4 w-4 text-gray-500" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                              <Edit className="h-4 w-4 text-gray-500" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded" title="Download">
                              <Download className="h-4 w-4 text-gray-500" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded" title="More">
                              <MoreVertical className="h-4 w-4 text-gray-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex-shrink-0 border-t px-4 py-3 bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-600">Showing {filteredCredentials.length} of {credentials.length} credentials</span>
            </div>
          </div>
        </>
      )}

      {/* Credential Types Tab */}
      {activeTab === 'types' && (
        <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Credential Types</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Add Type
            </button>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Credential Type</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Requires Renewal</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Renewal Period</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Mandatory</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {credentialTypesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900">No credential types defined</h3>
                      <p className="text-gray-500 mt-1">Add credential types to track staff certifications.</p>
                    </td>
                  </tr>
                ) : null}
                {credentialTypesList.map((type) => {
                  const CategoryIcon = categoryIcons[type.category];
                  return (
                    <tr key={type.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <CategoryIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{type.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          type.category === 'License' ? 'bg-purple-100 text-purple-800' :
                          type.category === 'Certification' ? 'bg-blue-100 text-blue-800' :
                          type.category === 'Training' ? 'bg-green-100 text-green-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {type.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {type.requiresRenewal ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {type.renewalPeriod > 0 ? (
                          <span className="text-gray-600">{type.renewalPeriod} months</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {type.mandatory ? (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Required</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Optional</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                            <Edit className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Renewal Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Renewal Alerts & Reminders</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" />
              Send Reminders
            </button>
          </div>
          <div className="overflow-auto flex-1 p-4">
            {expiringCredentials.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">All credentials are up to date!</h3>
                <p className="text-gray-500 mt-1">No credentials require immediate attention.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expiringCredentials.map((credential) => {
                  const daysUntilExpiry = getDaysUntilExpiry(credential.expiryDate);
                  const isExpired = daysUntilExpiry <= 0;
                  return (
                    <div
                      key={credential.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        isExpired ? 'bg-red-50 border-red-500' : 'bg-yellow-50 border-yellow-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isExpired ? 'bg-red-100' : 'bg-yellow-100'}`}>
                            <AlertTriangle className={`h-5 w-5 ${isExpired ? 'text-red-600' : 'text-yellow-600'}`} />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{credential.credentialName}</h4>
                            <p className="text-sm text-gray-600">{credential.staffName} • {credential.department}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="text-gray-500">License: {credential.licenseNumber}</span>
                              <span className={isExpired ? 'text-red-600 font-medium' : 'text-yellow-600 font-medium'}>
                                {isExpired
                                  ? `Expired ${Math.abs(daysUntilExpiry)} days ago`
                                  : `Expires in ${daysUntilExpiry} days`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50">
                            Send Reminder
                          </button>
                          <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            Update
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Add Credential</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>Select Staff</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credential Type</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>Select Type</option>
                  {credentialTypesList.map((type) => (
                    <option key={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Body</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="e.g., State Medical Board" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License/Certificate Number</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Enter license number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Document</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Credential</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Upload Document</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Credential</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>Select credential to update</option>
                  {credentials.map((c) => (
                    <option key={c.id}>{c.staffName} - {c.credentialName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document</label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Drag and drop your file here</p>
                  <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                  <button className="mt-4 px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
                    Select File
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}