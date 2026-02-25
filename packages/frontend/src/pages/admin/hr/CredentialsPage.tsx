import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Loader2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { hrService } from '../../../services';
import { api } from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';

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

const getCredentialStatus = (expiryDate?: string): Credential['status'] => {
  if (!expiryDate) return 'Pending Verification';
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring Soon';
  return 'Valid';
};

export default function CredentialsPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [activeTab, setActiveTab] = useState<'credentials' | 'types' | 'alerts'>('credentials');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [credTypesList, setCredTypesList] = useState<CredentialType[]>([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState<Omit<CredentialType, 'id'>>({
    name: '', category: 'License', requiresRenewal: false, renewalPeriod: 0, mandatory: false,
  });
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [credForm, setCredForm] = useState({
    staffId: '', credentialType: '', issuingBody: '', licenseNumber: '', issueDate: '', expiryDate: '',
  });
  const [addCredFile, setAddCredFile] = useState<File | null>(null);
  const addCredFileRef = useRef<HTMLInputElement>(null);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [viewingCredential, setViewingCredential] = useState<Credential | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCredentialId, setUploadCredentialId] = useState('');
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState<string | null>(null);
  const [submittingCred, setSubmittingCred] = useState(false);
  const [submittingUpload, setSubmittingUpload] = useState(false);

  // Fetch staff list
  const { data: staffResponse } = useQuery({
    queryKey: ['hr-staff', facilityId],
    queryFn: () => hrService.staff.list({ facilityId }),
    enabled: !!facilityId,
  });
  const staffList: any[] = Array.isArray(staffResponse) ? staffResponse : (staffResponse?.data ?? []);

  // Fetch all documents for all staff
  const { data: allDocuments = [], isLoading } = useQuery({
    queryKey: ['hr-credentials', facilityId],
    queryFn: async () => {
      const results = await Promise.all(
        staffList.map((s: any) =>
          hrService.credentials.listByStaff(s.id).then((docs: any[]) =>
            docs.map((d: any) => ({
              id: d.id,
              staffName: s.fullName || `${s.firstName} ${s.lastName}`,
              staffId: s.employeeCode || s.id,
              department: s.department || 'N/A',
              credentialType: d.documentType || 'Other',
              credentialName: d.documentName || d.documentType,
              issuingBody: d.issuingAuthority || '',
              issueDate: d.issuedDate || '',
              expiryDate: d.expiryDate || '',
              status: d.status === 'verified' ? 'Valid'
                : d.status === 'pending' ? 'Pending Verification'
                : d.status === 'expired' ? 'Expired'
                : getCredentialStatus(d.expiryDate),
              documentUrl: d.fileUrl,
              licenseNumber: d.licenseNumber,
            }))
          ).catch(() => [])
        )
      );
      return results.flat() as Credential[];
    },
    enabled: staffList.length > 0,
  });

  const credentials = allDocuments;

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: ({ staffId, formData }: { staffId: string; formData: FormData }) =>
      hrService.credentials.upload ? hrService.credentials.upload(staffId, formData) : Promise.reject('not implemented'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-credentials', facilityId] });
      setShowUploadModal(false);
    },
  });

  // Verify document mutation
  const verifyMutation = useMutation({
    mutationFn: ({ documentId }: { staffId: string; documentId: string }) =>
      hrService.credentials.verify(documentId, 'verified'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hr-credentials', facilityId] }),
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => hrService.credentials.delete(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-credentials', facilityId] });
      toast.success('Credential deleted');
      setShowDeleteConfirm(null);
    },
    onError: () => toast.error('Failed to delete credential'),
  });

  // Fetch credential types from settings
  useEffect(() => {
    api.get('/settings/credential-types').then((res) => {
      const types = res.data?.value?.types;
      if (Array.isArray(types) && types.length > 0) {
        setCredTypesList(types);
      }
    }).catch(() => { /* fallback: derive from credentials */ });
  }, []);

  // Derive credential type names for filter dropdown
  const credentialTypeNames = useMemo(() => [...new Set(credentials.map((c) => c.credentialType))], [credentials]);

  // Merged credential types: settings-based list + fallback derived strings
  const credentialTypes: CredentialType[] = useMemo(() => {
    if (credTypesList.length > 0) return credTypesList;
    return credentialTypeNames.map((name) => ({
      id: name,
      name,
      category: 'Certification' as const,
      requiresRenewal: false,
      renewalPeriod: 0,
      mandatory: false,
    }));
  }, [credTypesList, credentialTypeNames]);

  const saveCredentialTypes = useCallback(async (types: CredentialType[]) => {
    try {
      await api.put('/settings/credential-types', { value: { types } });
      setCredTypesList(types);
    } catch {
      toast.error('Failed to save credential types');
    }
  }, []);

  const handleAddType = async () => {
    const newType: CredentialType = {
      id: editingTypeId || crypto.randomUUID(),
      ...typeForm,
    };
    const updated = editingTypeId
      ? credentialTypes.map((t) => (t.id === editingTypeId ? newType : t))
      : [...credentialTypes, newType];
    await saveCredentialTypes(updated);
    toast.success(editingTypeId ? 'Credential type updated' : 'Credential type added');
    setShowTypeModal(false);
    setEditingTypeId(null);
    setTypeForm({ name: '', category: 'License', requiresRenewal: false, renewalPeriod: 0, mandatory: false });
  };

  const handleDeleteType = async (id: string) => {
    const updated = credentialTypes.filter((t) => t.id !== id);
    await saveCredentialTypes(updated);
    toast.success('Credential type removed');
  };

  const handleSubmitCredential = async () => {
    if (!credForm.staffId) { toast.error('Please select a staff member'); return; }
    if (!credForm.credentialType) { toast.error('Please select a credential type'); return; }
    setSubmittingCred(true);
    try {
      const formData = new FormData();
      formData.append('documentType', credForm.credentialType);
      formData.append('documentName', credForm.credentialType);
      if (credForm.issuingBody) formData.append('issuingAuthority', credForm.issuingBody);
      if (credForm.licenseNumber) formData.append('licenseNumber', credForm.licenseNumber);
      if (credForm.issueDate) formData.append('issuedDate', credForm.issueDate);
      if (credForm.expiryDate) formData.append('expiryDate', credForm.expiryDate);
      if (addCredFile) formData.append('file', addCredFile);
      await hrService.credentials.upload(credForm.staffId, formData);
      queryClient.invalidateQueries({ queryKey: ['hr-credentials', facilityId] });
      toast.success(editingCredential ? 'Credential updated' : 'Credential added');
      setShowAddModal(false);
      setEditingCredential(null);
      setCredForm({ staffId: '', credentialType: '', issuingBody: '', licenseNumber: '', issueDate: '', expiryDate: '' });
      setAddCredFile(null);
    } catch {
      toast.error('Failed to save credential');
    } finally {
      setSubmittingCred(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!uploadCredentialId) { toast.error('Please select a credential'); return; }
    if (!uploadFile) { toast.error('Please select a file'); return; }
    const cred = credentials.find((c) => c.id === uploadCredentialId);
    if (!cred) { toast.error('Credential not found'); return; }
    // Find the actual user id from staffList using the credential's staffId (employeeCode)
    const staff = staffList.find((s: any) => (s.employeeCode || s.id) === cred.staffId);
    const userId = staff?.id || cred.staffId;
    setSubmittingUpload(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('documentType', cred.credentialType);
      formData.append('documentName', cred.credentialName);
      await hrService.credentials.upload(userId, formData);
      queryClient.invalidateQueries({ queryKey: ['hr-credentials', facilityId] });
      toast.success('Document uploaded');
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadCredentialId('');
    } catch {
      toast.error('Failed to upload document');
    } finally {
      setSubmittingUpload(false);
    }
  };

  const handleDownload = (credential: Credential) => {
    const url = hrService.credentials.getDownloadUrl(credential.id);
    window.open(url, '_blank');
  };

  const openEditModal = (credential: Credential) => {
    setEditingCredential(credential);
    const staff = staffList.find((s: any) => (s.employeeCode || s.id) === credential.staffId);
    setCredForm({
      staffId: staff?.id || credential.staffId,
      credentialType: credential.credentialType,
      issuingBody: credential.issuingBody,
      licenseNumber: credential.licenseNumber || '',
      issueDate: credential.issueDate,
      expiryDate: credential.expiryDate,
    });
    setAddCredFile(null);
    setShowAddModal(true);
  };

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
  }, [credentials, searchTerm, statusFilter, typeFilter]);

  const stats = useMemo(() => ({
    totalCredentials: credentials.length,
    valid: credentials.filter((c) => c.status === 'Valid').length,
    expiringSoon: credentials.filter((c) => c.status === 'Expiring Soon').length,
    expired: credentials.filter((c) => c.status === 'Expired').length,
  }), [credentials]);

  const expiringCredentials = useMemo(() => {
    return credentials
      .filter((c) => c.status === 'Expiring Soon' || c.status === 'Expired')
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [credentials]);

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
                  {credentialTypeNames.map((type) => (
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
                          <div className="flex items-center gap-2 relative">
                            <button onClick={() => setViewingCredential(credential)} className="p-1 hover:bg-gray-100 rounded" title="View">
                              <Eye className="h-4 w-4 text-gray-500" />
                            </button>
                            <button onClick={() => openEditModal(credential)} className="p-1 hover:bg-gray-100 rounded" title="Edit">
                              <Edit className="h-4 w-4 text-gray-500" />
                            </button>
                            <button onClick={() => handleDownload(credential)} className="p-1 hover:bg-gray-100 rounded" title="Download">
                              <Download className="h-4 w-4 text-gray-500" />
                            </button>
                            <button onClick={() => setShowMoreMenu(showMoreMenu === credential.id ? null : credential.id)} className="p-1 hover:bg-gray-100 rounded" title="More">
                              <MoreVertical className="h-4 w-4 text-gray-500" />
                            </button>
                            {showMoreMenu === credential.id && (
                              <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg z-10 py-1 w-40">
                                <button
                                  onClick={() => { verifyMutation.mutate({ staffId: credential.staffId, documentId: credential.id }); setShowMoreMenu(null); }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <CheckCircle className="h-4 w-4 text-green-500" /> Verify
                                </button>
                                <button
                                  onClick={() => { setShowDeleteConfirm(credential.id); setShowMoreMenu(null); }}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                                >
                                  <Trash2 className="h-4 w-4" /> Delete
                                </button>
                              </div>
                            )}
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
            <button onClick={() => { setEditingTypeId(null); setTypeForm({ name: '', category: 'License', requiresRenewal: false, renewalPeriod: 0, mandatory: false }); setShowTypeModal(true); }} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
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
                {credentialTypes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900">No credential types defined</h3>
                      <p className="text-gray-500 mt-1">Add credential types to track staff certifications.</p>
                    </td>
                  </tr>
                ) : null}
                {credentialTypes.map((type) => {
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
                          <button onClick={() => { setEditingTypeId(type.id); setTypeForm({ name: type.name, category: type.category, requiresRenewal: type.requiresRenewal, renewalPeriod: type.renewalPeriod, mandatory: type.mandatory }); setShowTypeModal(true); }} className="p-1 hover:bg-gray-100 rounded" title="Edit">
                            <Edit className="h-4 w-4 text-gray-500" />
                          </button>
                          <button onClick={() => handleDeleteType(type.id)} className="p-1 hover:bg-gray-100 rounded" title="Delete">
                            <Trash2 className="h-4 w-4 text-red-500" />
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
            <h2 className="text-xl font-bold mb-4">{editingCredential ? 'Edit Credential' : 'Add Credential'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                <select value={credForm.staffId} onChange={(e) => setCredForm({ ...credForm, staffId: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Select Staff</option>
                  {staffList.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.fullName || `${s.firstName} ${s.lastName}`} ({s.employeeCode || s.id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credential Type</label>
                <select value={credForm.credentialType} onChange={(e) => setCredForm({ ...credForm, credentialType: e.target.value })} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Select Type</option>
                  {credentialTypes.map((type) => (
                    <option key={type.id} value={type.name}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Body</label>
                <input type="text" value={credForm.issuingBody} onChange={(e) => setCredForm({ ...credForm, issuingBody: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="e.g., State Medical Board" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License/Certificate Number</label>
                <input type="text" value={credForm.licenseNumber} onChange={(e) => setCredForm({ ...credForm, licenseNumber: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="Enter license number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                  <input type="date" value={credForm.issueDate} onChange={(e) => setCredForm({ ...credForm, issueDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input type="date" value={credForm.expiryDate} onChange={(e) => setCredForm({ ...credForm, expiryDate: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Document</label>
                <input ref={addCredFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setAddCredFile(e.target.files?.[0] || null)} />
                <div onClick={() => addCredFileRef.current?.click()} className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-400">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  {addCredFile ? (
                    <p className="text-sm text-blue-600 font-medium">{addCredFile.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG up to 10MB</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAddModal(false); setEditingCredential(null); setCredForm({ staffId: '', credentialType: '', issuingBody: '', licenseNumber: '', issueDate: '', expiryDate: '' }); setAddCredFile(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmitCredential} disabled={submittingCred} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {submittingCred && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingCredential ? 'Update Credential' : 'Add Credential'}
              </button>
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
                <select value={uploadCredentialId} onChange={(e) => setUploadCredentialId(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Select credential to update</option>
                  {credentials.map((c) => (
                    <option key={c.id} value={c.id}>{c.staffName} - {c.credentialName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document</label>
                <input ref={uploadFileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                <div onClick={() => uploadFileRef.current?.click()} className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-400">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  {uploadFile ? (
                    <p className="text-blue-600 font-medium">{uploadFile.name}</p>
                  ) : (
                    <>
                      <p className="text-gray-600">Drag and drop your file here</p>
                      <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadCredentialId(''); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleUploadDocument} disabled={submittingUpload} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {submittingUpload && <Loader2 className="h-4 w-4 animate-spin" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Credential Modal */}
      {viewingCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Credential Details</h2>
              <button onClick={() => setViewingCredential(null)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Staff Member</p>
                  <p className="font-medium">{viewingCredential.staffName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Staff ID</p>
                  <p className="font-medium">{viewingCredential.staffId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Department</p>
                  <p className="font-medium">{viewingCredential.department}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Credential Type</p>
                  <p className="font-medium">{viewingCredential.credentialType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Credential Name</p>
                  <p className="font-medium">{viewingCredential.credentialName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Issuing Body</p>
                  <p className="font-medium">{viewingCredential.issuingBody || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">License Number</p>
                  <p className="font-medium font-mono">{viewingCredential.licenseNumber || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[viewingCredential.status].color}`}>
                    {viewingCredential.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Issue Date</p>
                  <p className="font-medium">{viewingCredential.issueDate || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expiry Date</p>
                  <p className="font-medium">{viewingCredential.expiryDate || '—'}</p>
                </div>
              </div>
              {viewingCredential.documentUrl && (
                <div className="pt-3 border-t">
                  <button onClick={() => handleDownload(viewingCredential)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm">
                    <Download className="h-4 w-4" /> Download Document
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setViewingCredential(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-2">Delete Credential</h2>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this credential? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(showDeleteConfirm)} disabled={deleteMutation.isPending} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Credential Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{editingTypeId ? 'Edit Credential Type' : 'Add Credential Type'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} className="w-full border rounded-lg px-3 py-2" placeholder="e.g., Medical License" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={typeForm.category} onChange={(e) => setTypeForm({ ...typeForm, category: e.target.value as CredentialType['category'] })} className="w-full border rounded-lg px-3 py-2">
                  <option value="License">License</option>
                  <option value="Certification">Certification</option>
                  <option value="Training">Training</option>
                  <option value="Education">Education</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={typeForm.requiresRenewal} onChange={(e) => setTypeForm({ ...typeForm, requiresRenewal: e.target.checked })} className="rounded" />
                  <span className="text-sm font-medium text-gray-700">Requires Renewal</span>
                </label>
              </div>
              {typeForm.requiresRenewal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Period (months)</label>
                  <input type="number" value={typeForm.renewalPeriod} onChange={(e) => setTypeForm({ ...typeForm, renewalPeriod: parseInt(e.target.value) || 0 })} className="w-full border rounded-lg px-3 py-2" min="1" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={typeForm.mandatory} onChange={(e) => setTypeForm({ ...typeForm, mandatory: e.target.checked })} className="rounded" />
                  <span className="text-sm font-medium text-gray-700">Mandatory</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowTypeModal(false); setEditingTypeId(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddType} disabled={!typeForm.name} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {editingTypeId ? 'Update Type' : 'Add Type'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}