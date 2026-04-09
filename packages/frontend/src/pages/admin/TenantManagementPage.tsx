import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';
import {
  Building2, Plus, Copy, Check, Search, MoreVertical,
  Loader2, Power, PowerOff, Trash2, Pencil,
  Users, Calendar, Shield, Hospital, Activity, AlertTriangle,
  CheckCircle2, Clock, Eye, RefreshCw, X, KeyRound, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  description?: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  facilityCount: number;
  isSetupComplete: boolean;
  lastActivity?: string;
  adminUsername?: string;
  adminEmail?: string;
}

interface CreateTenantForm {
  name: string;
  slug?: string;
  description?: string;
}

export default function TenantManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [detailTenant, setDetailTenant] = useState<Tenant | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [resetPasswordTenant, setResetPasswordTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (user && !user.isSystemAdmin) {
      navigate('/');
    }
  }, [user, navigate]);

  const fetchTenants = async () => {
    try {
      const res = await api.get('/tenants/with-stats');
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
      setTenants(data);
    } catch {
      toast.error('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const getLoginUrl = (slug: string) => `${window.location.origin}/login/${slug}`;

  const copyLoginUrl = (slug: string) => {
    const url = getLoginUrl(slug);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSlug(slug);
      toast.success('Login link copied to clipboard');
      setTimeout(() => setCopiedSlug(null), 2000);
    }).catch(() => {
      // Fallback for clipboard permission issues
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedSlug(slug);
      toast.success('Login link copied to clipboard');
      setTimeout(() => setCopiedSlug(null), 2000);
    });
  };

  const handleStatusChange = async (tenant: Tenant, newStatus: string) => {
    try {
      await api.patch(`/tenants/${tenant.id}`, { status: newStatus });
      toast.success(`${tenant.name} ${newStatus === 'active' ? 'activated' : 'suspended'}`);
      fetchTenants();
    } catch {
      toast.error('Failed to update organization status');
    }
    setActionMenuId(null);
  };

  const handleDelete = async (tenant: Tenant) => {
    if (!confirm(`Are you sure you want to delete "${tenant.name}"?\n\nThis will remove the organization and all its data. This action cannot be undone.`)) return;
    try {
      await api.delete(`/tenants/${tenant.id}`);
      toast.success(`${tenant.name} deleted`);
      fetchTenants();
    } catch {
      toast.error('Failed to delete organization');
    }
    setActionMenuId(null);
  };

  const filteredTenants = tenants.filter(t => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.adminUsername && t.adminUsername.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalUsers = tenants.reduce((sum, t) => sum + (t.userCount || 0), 0);
  const totalFacilities = tenants.reduce((sum, t) => sum + (t.facilityCount || 0), 0);
  const pendingSetup = tenants.filter(t => !t.isSetupComplete).length;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const setupBadge = (isSetupComplete: boolean) => {
    if (isSetupComplete) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
          <CheckCircle2 className="w-3 h-3" /> Ready
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        <AlertTriangle className="w-3 h-3" /> Pending Setup
      </span>
    );
  };

  const timeAgo = (date: string | undefined) => {
    if (!date) return 'Never';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organizations</h2>
          <p className="text-gray-500 mt-1">Manage tenant organizations, users, and access</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); fetchTenants(); }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Organization
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
              <p className="text-xs text-gray-500">Organizations</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Power className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{tenants.filter(t => t.status === 'active').length}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
              <p className="text-xs text-gray-500">Total Users</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Hospital className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalFacilities}</p>
              <p className="text-xs text-gray-500">Facilities</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingSetup}</p>
              <p className="text-xs text-gray-500">Pending Setup</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, slug, or admin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Tenants Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredTenants.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No organizations found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || statusFilter !== 'all' ? 'Try a different search or filter.' : 'Create your first organization to get started.'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button onClick={() => setShowCreateModal(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Organization
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Login Link</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Users</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Facilities</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setup</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{tenant.name}</p>
                        <p className="text-xs text-gray-500">
                          {tenant.adminUsername ? (
                            <span className="flex items-center gap-1">
                              <Shield className="w-3 h-3" /> {tenant.adminUsername}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">No admin</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={getLoginUrl(tenant.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-gray-100 px-2 py-1 rounded font-mono text-blue-700 hover:text-blue-900 hover:bg-blue-50 truncate max-w-[180px] transition-colors cursor-pointer"
                        title={getLoginUrl(tenant.slug)}
                      >
                        /login/{tenant.slug}
                      </a>
                      <button
                        onClick={() => copyLoginUrl(tenant.slug)}
                        className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
                        title="Copy link"
                      >
                        {copiedSlug === tenant.slug ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {tenant.userCount || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                      <Hospital className="w-3.5 h-3.5 text-gray-400" />
                      {tenant.facilityCount || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {setupBadge(tenant.isSetupComplete)}
                  </td>
                  <td className="px-4 py-4">
                    {statusBadge(tenant.status)}
                  </td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Activity className="w-3 h-3" />
                      {timeAgo(tenant.lastActivity)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setActionMenuId(actionMenuId === tenant.id ? null : tenant.id)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {actionMenuId === tenant.id && (
                        <div className="absolute right-0 mt-1 w-52 bg-white border rounded-lg shadow-lg z-10 py-1">
                          <button
                            onClick={() => {
                              setDetailTenant(tenant);
                              setShowDetailModal(true);
                              setActionMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" /> View Details
                          </button>
                          <button
                            onClick={() => {
                              setEditingTenant(tenant);
                              setShowEditModal(true);
                              setActionMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Pencil className="w-4 h-4" /> Edit
                          </button>
                          <button
                            onClick={() => {
                              copyLoginUrl(tenant.slug);
                              setActionMenuId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Copy className="w-4 h-4" /> Copy Login Link
                          </button>
                          {tenant.adminUsername && (
                            <button
                              onClick={() => {
                                setResetPasswordTenant(tenant);
                                setActionMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                            >
                              <KeyRound className="w-4 h-4" /> Reset Admin Password
                            </button>
                          )}
                          <div className="border-t my-1" />
                          {tenant.status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(tenant, 'suspended')}
                              className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                            >
                              <PowerOff className="w-4 h-4" /> Suspend
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(tenant, 'active')}
                              className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                            >
                              <Power className="w-4 h-4" /> Activate
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(tenant)}
                            className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Table Footer */}
          <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500">
            Showing {filteredTenants.length} of {tenants.length} organizations
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchTenants();
          }}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          onClose={() => { setShowEditModal(false); setEditingTenant(null); }}
          onUpdated={() => {
            setShowEditModal(false);
            setEditingTenant(null);
            fetchTenants();
          }}
        />
      )}

      {/* Detail Modal */}
      {showDetailModal && detailTenant && (
        <TenantDetailModal
          tenant={detailTenant}
          onClose={() => { setShowDetailModal(false); setDetailTenant(null); }}
          onEdit={() => {
            setShowDetailModal(false);
            setEditingTenant(detailTenant);
            setShowEditModal(true);
            setDetailTenant(null);
          }}
          onResetPassword={() => {
            setShowDetailModal(false);
            setResetPasswordTenant(detailTenant);
            setDetailTenant(null);
          }}
          getLoginUrl={getLoginUrl}
          copyLoginUrl={copyLoginUrl}
          copiedSlug={copiedSlug}
        />
      )}

      {/* Reset Admin Password Modal */}
      {resetPasswordTenant && (
        <TenantAdminResetPasswordModal
          tenant={resetPasswordTenant}
          onClose={() => setResetPasswordTenant(null)}
        />
      )}

      {/* Close action menu on outside click */}
      {actionMenuId && (
        <div className="fixed inset-0 z-0" onClick={() => setActionMenuId(null)} />
      )}
    </div>
  );
}

// ─── Tenant Detail Modal ───
function TenantDetailModal({
  tenant, onClose, onEdit, onResetPassword, getLoginUrl, copyLoginUrl, copiedSlug,
}: {
  tenant: Tenant;
  onClose: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
  getLoginUrl: (slug: string) => string;
  copyLoginUrl: (slug: string) => void;
  copiedSlug: string | null;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            {tenant.name}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              tenant.status === 'active' ? 'bg-green-100 text-green-800' :
              tenant.status === 'suspended' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {tenant.status === 'active' ? <Power className="w-3.5 h-3.5 mr-1" /> : <PowerOff className="w-3.5 h-3.5 mr-1" />}
              {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
            </span>
            {tenant.isSetupComplete ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Setup Complete
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-amber-50 text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" /> Pending Setup
              </span>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Users className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{tenant.userCount || 0}</p>
              <p className="text-xs text-gray-500">Users</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Hospital className="w-6 h-6 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{tenant.facilityCount || 0}</p>
              <p className="text-xs text-gray-500">Facilities</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Activity className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <p className="text-sm font-bold text-gray-900">{tenant.lastActivity ? new Date(tenant.lastActivity).toLocaleDateString() : 'Never'}</p>
              <p className="text-xs text-gray-500">Last Active</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Organization Code</p>
                <p className="font-mono font-medium text-gray-900">{tenant.slug}</p>
              </div>
              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-medium text-gray-900">{new Date(tenant.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              {tenant.adminUsername && (
                <div>
                  <p className="text-gray-500">Primary Admin</p>
                  <p className="font-medium text-gray-900">{tenant.adminUsername}</p>
                </div>
              )}
              {tenant.adminEmail && (
                <div>
                  <p className="text-gray-500">Admin Email</p>
                  <p className="font-medium text-gray-900">{tenant.adminEmail}</p>
                </div>
              )}
              {tenant.description && (
                <div className="col-span-2">
                  <p className="text-gray-500">Description</p>
                  <p className="font-medium text-gray-900">{tenant.description}</p>
                </div>
              )}
              {tenant.settings && Object.keys(tenant.settings).length > 0 && (
                <>
                  {tenant.settings.currency && (
                    <div>
                      <p className="text-gray-500">Currency</p>
                      <p className="font-medium text-gray-900">{tenant.settings.currency}</p>
                    </div>
                  )}
                  {tenant.settings.timezone && (
                    <div>
                      <p className="text-gray-500">Timezone</p>
                      <p className="font-medium text-gray-900">{tenant.settings.timezone}</p>
                    </div>
                  )}
                  {tenant.settings.facilityMode && (
                    <div>
                      <p className="text-gray-500">Facility Mode</p>
                      <p className="font-medium text-gray-900 capitalize">{tenant.settings.facilityMode.replace(/_/g, ' ')}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Login Link */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Login Link</h4>
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
              <a
                href={getLoginUrl(tenant.slug)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-blue-700 hover:text-blue-900 flex-1 truncate transition-colors"
                title={getLoginUrl(tenant.slug)}
              >
                {getLoginUrl(tenant.slug)}
              </a>
              <button
                onClick={() => copyLoginUrl(tenant.slug)}
                className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors"
              >
                {copiedSlug === tenant.slug ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-secondary">Close</button>
          {tenant.adminUsername && (
            <button onClick={onResetPassword} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100">
              <KeyRound className="w-4 h-4" /> Reset Admin Password
            </button>
          )}
          <button onClick={onEdit} className="btn-primary flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Tenant Modal ───
function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateTenantForm>({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const generateSlug = (name: string) =>
    name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.post('/tenants', {
        ...form,
        slug: form.slug || generateSlug(form.name),
      });
      toast.success('Organization created! Share the login link with the tenant admin to complete setup.');
      onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">New Organization</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Kampala Medical Center"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Code (slug)</label>
            <input
              type="text"
              className="input"
              placeholder="Auto-generated from name"
              value={form.slug || ''}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
            <p className="text-xs text-gray-400 mt-1">
              Login URL: <span className="font-mono">/login/{form.slug || generateSlug(form.name) || 'your-slug'}</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Brief description of the organization"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700 flex gap-2">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>After creation, share the login link with the tenant admin. They will complete a setup wizard to configure their facility, admin account, and settings.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Organization
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Tenant Modal ───
function EditTenantModal({ tenant, onClose, onUpdated }: { tenant: Tenant; onClose: () => void; onUpdated: () => void }) {
  const [form, setForm] = useState({
    name: tenant.name,
    slug: tenant.slug,
    description: tenant.description || '',
    status: tenant.status,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/tenants/${tenant.id}`, form);
      toast.success('Organization updated successfully');
      onUpdated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Organization</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Code (slug)</label>
            <input
              type="text"
              className="input"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
            <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Changing this will break existing login links for members
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tenant Admin Reset Password Modal ───
function TenantAdminResetPasswordModal({
  tenant,
  onClose,
}: {
  tenant: Tenant;
  onClose: () => void;
}) {
  const [tenantUsers, setTenantUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadTenantAdmins = async () => {
      try {
        const res = await api.get('/users/tenant-admins');
        const all = res.data?.data || res.data || [];
        const filtered = Array.isArray(all)
          ? all.filter((u: any) => u.tenantId === tenant.id)
          : [];
        setTenantUsers(filtered);
        if (filtered.length === 1) setSelectedUser(filtered[0]);
      } catch {
        toast.error('Failed to load tenant users');
      } finally {
        setLoading(false);
      }
    };
    loadTenantAdmins();
  }, [tenant.id]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setResetting(true);
    try {
      const res = await api.post(`/users/system-reset-password/${selectedUser.id}`, {
        newPassword: newPassword || undefined,
      });
      const data = res.data?.data || res.data;
      setResult(data);
      toast.success('Password reset successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const copyPassword = () => {
    if (result?.temporaryPassword) {
      navigator.clipboard.writeText(result.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Reset Admin Password</h3>
            <p className="text-xs text-gray-500">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : tenantUsers.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No admin users found for this tenant.</p>
              <p className="text-gray-400 text-xs mt-1">The tenant may not have completed setup yet.</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">Close</button>
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium mb-2">Password reset for {selectedUser?.username}!</p>
                <p className="text-xs text-green-700 mb-3">User will be required to change this on next login.</p>
                <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-green-200">
                  <code className="flex-1 text-sm font-mono text-gray-900">{result.temporaryPassword}</code>
                  <button onClick={copyPassword} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button onClick={onClose} className="w-full py-2.5 text-sm font-medium bg-slate-800 text-white rounded-xl hover:bg-slate-900">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {tenantUsers.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
                  <select
                    value={selectedUser?.id || ''}
                    onChange={(e) => setSelectedUser(tenantUsers.find((u: any) => u.id === e.target.value) || null)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select a user —</option>
                    {tenantUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName || u.username} ({u.roleName || 'User'}) — @{u.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedUser && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-600 uppercase">
                    {(selectedUser.fullName || selectedUser.username)?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{selectedUser.fullName || selectedUser.username}</p>
                    <p className="text-xs text-gray-500">@{selectedUser.username} · {selectedUser.roleName || 'User'}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password <span className="text-gray-400 text-xs">(leave blank to auto-generate)</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Auto-generate if blank"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">User will be forced to change password on next login.</p>
              </div>

              <div className="flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting || !selectedUser}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {resetting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reset Password
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
