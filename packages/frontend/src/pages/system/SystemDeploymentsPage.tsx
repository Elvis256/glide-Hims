import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';
import {
  Server, Cloud, HardDrive, Plus, Search, RefreshCw,
  CheckCircle2, AlertTriangle, Clock, Loader2, Copy, Check,
  ExternalLink, MoreVertical, KeyRound, Activity, Building2, Download, X,
  Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import TierBadge from '../../components/TierBadge';
import SystemPagination from '../../components/SystemPagination';
import ConfirmDialog from '../../components/ConfirmDialog';

type DeploymentType = 'cloud' | 'hybrid' | 'standalone';
type DeploymentStatus = 'active' | 'pending' | 'error' | 'expired';

interface Deployment {
  id: string;
  tenantId?: string;
  organizationName: string;
  type: DeploymentType;
  status: DeploymentStatus;
  licenseKey: string;
  licenseStatus?: 'active' | 'suspended' | 'revoked' | 'expired' | null;
  licenseExpiresAt?: string | null;
  domain?: string;
  version: string;
  lastSeen?: string;
  createdAt: string;
  tier: 'community' | 'professional' | 'enterprise';
  maxUsers: number;
  notes?: string;
}

interface CreateDeploymentForm {
  organizationName: string;
  type: DeploymentType;
  tier: 'community' | 'professional' | 'enterprise';
  domain?: string;
  maxUsers: number;
  notes?: string;
}

const STATUS_STYLES: Record<DeploymentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS: Record<DeploymentStatus, React.ReactNode> = {
  active: <CheckCircle2 className="w-3.5 h-3.5" />,
  pending: <Clock className="w-3.5 h-3.5" />,
  error: <AlertTriangle className="w-3.5 h-3.5" />,
  expired: <AlertTriangle className="w-3.5 h-3.5" />,
};

const TYPE_CONFIG: Record<DeploymentType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  cloud: {
    label: 'Cloud',
    icon: <Server className="w-4 h-4" />,
    color: 'text-green-600 bg-green-50',
    description: 'Hosted on this server, auto-active',
  },
  hybrid: {
    label: 'Hybrid',
    icon: <Cloud className="w-4 h-4" />,
    color: 'text-blue-600 bg-blue-50',
    description: 'Customer-hosted, central updates',
  },
  standalone: {
    label: 'Standalone',
    icon: <HardDrive className="w-4 h-4" />,
    color: 'text-purple-600 bg-purple-50',
    description: 'Air-gapped, offline operation',
  },
};

function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

export default function SystemDeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem('deployments_intro_banner_dismissed') === '1'; }
    catch { return false; }
  });
  const dismissBanner = () => {
    setBannerDismissed(true);
    try { localStorage.setItem('deployments_intro_banner_dismissed', '1'); } catch { /* ignore */ }
  };
  const [typeFilter, setTypeFilter] = useState<'all' | 'cloud' | DeploymentType>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateDeploymentForm>({
    organizationName: '',
    type: 'hybrid',
    tier: 'professional',
    domain: '',
    maxUsers: 50,
    notes: '',
  });
  const { copied, copy } = useCopyToClipboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantFilterId = searchParams.get('tenantId') || '';
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [busyDeploymentId, setBusyDeploymentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [reissueModal, setReissueModal] = useState<{ open: boolean; dep: Deployment | null; days: number; busy: boolean }>({
    open: false, dep: null, days: 365, busy: false,
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmLabel: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', confirmLabel: 'Confirm', onConfirm: () => {} });

  const closeConfirmDialog = () => setConfirmDialog((prev) => ({ ...prev, open: false }));

  const toggleKeyVisibility = (depId: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(depId)) next.delete(depId);
      else next.add(depId);
      return next;
    });
  };

  const maskKey = (key: string) => key.length > 8 ? key.slice(0, 8) + '...' : key;

  const closeActionMenu = () => setActionMenuId(null);

  const executeLicenseAction = async (
    dep: Deployment,
    action: 'suspend' | 'reactivate' | 'revoke' | 'extend',
  ) => {
    setBusyDeploymentId(dep.id);
    closeActionMenu();
    try {
      if (action === 'extend') {
        await api.put(`/license/${encodeURIComponent(dep.licenseKey)}/extend`, { days: 30 });
        toast.success('License extended by 30 days');
      } else {
        await api.put(`/license/${encodeURIComponent(dep.licenseKey)}/${action}`);
        toast.success(`License ${action === 'reactivate' ? 'reactivated' : action + 'd'}`);
      }
      await loadDeployments();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action} license`);
    } finally {
      setBusyDeploymentId(null);
    }
  };

  const runLicenseAction = (
    dep: Deployment,
    action: 'suspend' | 'reactivate' | 'revoke' | 'extend',
  ) => {
    if (!dep.licenseKey) {
      toast.error('No license key on this deployment');
      return;
    }
    if (action === 'revoke') {
      setConfirmDialog({
        open: true,
        title: 'Revoke License',
        message: `Revoke license for ${dep.organizationName}? This is permanent \u2014 the install will stop validating immediately.`,
        variant: 'danger',
        confirmLabel: 'Revoke',
        onConfirm: () => {
          closeConfirmDialog();
          executeLicenseAction(dep, 'revoke');
        },
      });
      return;
    }
    if (action === 'suspend') {
      setConfirmDialog({
        open: true,
        title: 'Suspend License',
        message: `Suspend license for ${dep.organizationName}? The deployment will stop functioning until reactivated.`,
        variant: 'warning',
        confirmLabel: 'Suspend',
        onConfirm: () => {
          closeConfirmDialog();
          executeLicenseAction(dep, 'suspend');
        },
      });
      return;
    }
    executeLicenseAction(dep, action);
  };

  const downloadInstallerBundle = async (dep: Deployment) => {
    closeActionMenu();
    setBusyDeploymentId(dep.id);
    try {
      const res = await api.get(`/deployments/${dep.id}/installer-bundle`, { responseType: 'blob' });
      const cd: string = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `glide-hims-bootstrap-${dep.id}.sh`;
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Installer bundle downloaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to download installer bundle');
    } finally {
      setBusyDeploymentId(null);
    }
  };

  const downloadLicense = async (dep: Deployment) => {
    if (!dep.licenseKey) {
      toast.error('No license key on this deployment');
      return;
    }
    closeActionMenu();
    try {
      const res = await api.get(`/license/${encodeURIComponent(dep.licenseKey)}`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `license-${dep.organizationName.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to download license');
    }
  };

  const openReissueModal = (dep: Deployment) => {
    closeActionMenu();
    setReissueModal({ open: true, dep, days: 365, busy: false });
  };

  const executeReissue = async () => {
    const dep = reissueModal.dep;
    if (!dep) return;
    setReissueModal((prev) => ({ ...prev, busy: true }));
    try {
      const res = await api.post(`/license/${encodeURIComponent(dep.licenseKey)}/reissue`, {
        extensionDays: reissueModal.days,
      });
      const licenseData = res.data?.license || res.data;
      // Download the new license.json file
      const blob = new Blob([JSON.stringify(licenseData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `license-${dep.organizationName.replace(/\s+/g, '-').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`License reissued (+${reissueModal.days} days) — file downloaded`);
      setReissueModal({ open: false, dep: null, days: 365, busy: false });
      loadDeployments();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to reissue license');
      setReissueModal((prev) => ({ ...prev, busy: false }));
    }
  };

  const loadDeployments = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/deployments');
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setDeployments(data);
    } catch (err: any) {
      setDeployments([]);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to load deployments';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
    api
      .get('/tenants', { params: { limit: 1000 } })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.data || []);
        setTenants(list.map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })));
      })
      .catch(() => setTenants([]));
  }, []);

  const handleCreate = async () => {
    if (!selectedTenantId && !form.organizationName.trim()) {
      toast.error('Pick an existing organization or enter a new name');
      return;
    }
    setCreating(true);
    try {
      const payload: any = { ...form };
      if (selectedTenantId) {
        payload.tenantId = selectedTenantId;
        const t = tenants.find((x) => x.id === selectedTenantId);
        if (t && !payload.organizationName) payload.organizationName = t.name;
      }
      await api.post('/deployments', payload);
      toast.success(`${TYPE_CONFIG[form.type].label} deployment created`);
      setShowCreate(false);
      setSelectedTenantId('');
      setForm({ organizationName: '', type: 'hybrid', tier: 'professional', domain: '', maxUsers: 50, notes: '' });
      loadDeployments();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create deployment');
    } finally {
      setCreating(false);
    }
  };

  const filtered = deployments.filter((d) => {
    const matchTenant = !tenantFilterId || d.tenantId === tenantFilterId;
    const q = search.trim().toLowerCase();
    const tenantSlug = d.tenantId ? tenants.find((t) => t.id === d.tenantId)?.slug || '' : '';
    const matchSearch = !q ||
      d.organizationName.toLowerCase().includes(q) ||
      d.licenseKey.toLowerCase().includes(q) ||
      (d.domain || '').toLowerCase().includes(q) ||
      tenantSlug.toLowerCase().includes(q) ||
      (d.tenantId || '').toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || d.type === typeFilter;
    return matchTenant && matchSearch && matchType;
  });

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1); }, [search, typeFilter, tenantFilterId]);

  const total = filtered.length;
  const paginatedFiltered = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const tenantFilterName = tenantFilterId
    ? deployments.find((d) => d.tenantId === tenantFilterId)?.organizationName
    : null;

  const clearTenantFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('tenantId');
    setSearchParams(next, { replace: true });
  };

  const stats = {
    total: deployments.length,
    cloud: deployments.filter((d) => d.type === 'cloud').length,
    hybrid: deployments.filter((d) => d.type === 'hybrid').length,
    standalone: deployments.filter((d) => d.type === 'standalone').length,
    active: deployments.filter((d) => d.status === 'active').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deployments</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Cloud, Hybrid &amp; Standalone deployments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDeployments}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Deployment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Total Deployments', value: stats.total, icon: Server, color: 'text-gray-600 bg-gray-100' },
          { label: 'Cloud (Hosted)', value: stats.cloud, icon: Server, color: 'text-green-600 bg-green-50' },
          { label: 'Hybrid (Client)', value: stats.hybrid, icon: Cloud, color: 'text-blue-600 bg-blue-50' },
          { label: 'Standalone (Offline)', value: stats.standalone, icon: HardDrive, color: 'text-purple-600 bg-purple-50' },
          { label: 'Active', value: stats.active, icon: Activity, color: 'text-emerald-600 bg-emerald-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      {!bannerDismissed && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 relative">
          <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 flex-1 pr-6">
            <p className="font-medium">Three deployment types available</p>
            <p className="mt-1">
              <strong>Cloud</strong> — Tenant hosted on this central server. Auto-active, no phone-home needed.{' '}
              <strong>Hybrid</strong> — Customer hosts on their own servers (AWS/Azure/On-Premise).
              Updates pushed from this server.{' '}
              <strong>Standalone</strong> — Completely air-gapped for government, military, and remote clinics.
              Updates via USB/manual distribution.
            </p>
          </div>
          <button
            onClick={dismissBanner}
            className="absolute top-2 right-2 p-1 text-blue-600 hover:bg-blue-100 rounded"
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by organization, slug, license key, domain, or ID…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'cloud', 'hybrid', 'standalone'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tenant filter banner */}
      {tenantFilterId && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <Building2 className="w-4 h-4" />
            <span>
              Showing deployments for{' '}
              <strong>{tenantFilterName || 'selected organization'}</strong>
            </span>
          </div>
          <button
            onClick={clearTenantFilter}
            className="text-blue-700 hover:text-blue-900 text-sm font-medium inline-flex items-center gap-1"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Deployments List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-700 font-medium">Could not load deployments</p>
          <p className="text-red-600 text-sm mt-1">{loadError}</p>
          <button
            onClick={loadDeployments}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No deployments found</p>
          <p className="text-gray-400 text-sm mt-1">
            {deployments.length === 0
              ? 'Create your first deployment above.'
              : 'Try adjusting your search or filters.'}
          </p>
          {deployments.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Create First Deployment
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">License Key</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Seen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Version</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedFiltered.map((dep) => (
                <tr key={dep.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {dep.tenantId ? (
                      <Link
                        to={`/system/tenants?tenantId=${dep.tenantId}`}
                        className="font-medium text-gray-900 hover:text-blue-700 hover:underline"
                        title="Open organization"
                      >
                        {dep.organizationName}
                      </Link>
                    ) : (
                      <p className="font-medium text-gray-900">{dep.organizationName}</p>
                    )}
                    <Link
                      to={`/system/deployments/${dep.id}`}
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                    >
                      View detail <ExternalLink className="w-3 h-3" />
                    </Link>
                    {dep.domain && (
                      <a
                        href={`https://${dep.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {dep.domain} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_CONFIG[dep.type].color}`}>
                      {TYPE_CONFIG[dep.type].icon}
                      {TYPE_CONFIG[dep.type].label}
                    </span>
                    <div className="mt-1">
                      <TierBadge tier={dep.tier} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {dep.licenseKey ? (
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {revealedKeys.has(dep.id) ? dep.licenseKey : maskKey(dep.licenseKey)}
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(dep.id)}
                          className="text-gray-400 hover:text-gray-600"
                          title={revealedKeys.has(dep.id) ? 'Hide license key' : 'Reveal license key'}
                        >
                          {revealedKeys.has(dep.id) ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => copy(dep.licenseKey, dep.id)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Copy license key"
                        >
                          {copied === dep.id ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No license</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[dep.status]}`}>
                      {STATUS_ICONS[dep.status]}
                      {dep.status.charAt(0).toUpperCase() + dep.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {dep.lastSeen
                      ? new Date(dep.lastSeen).toLocaleDateString()
                      : dep.type === 'standalone'
                        ? <span className="text-gray-400 italic">Offline</span>
                        : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{dep.version}</td>
                  <td className="px-4 py-3 relative">
                    <button
                      className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50"
                      disabled={busyDeploymentId === dep.id}
                      onClick={() => setActionMenuId(actionMenuId === dep.id ? null : dep.id)}
                    >
                      {busyDeploymentId === dep.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MoreVertical className="w-4 h-4" />
                      )}
                    </button>
                    {actionMenuId === dep.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={closeActionMenu}
                        />
                        <div className="absolute right-2 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 text-sm">
                          {dep.licenseKey ? (
                            <>
                              <button
                                onClick={() => downloadInstallerBundle(dep)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-blue-700"
                              >
                                <Download className="w-4 h-4" />
                                Download installer
                              </button>
                              <button
                                onClick={() => downloadLicense(dep)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                              >
                                <KeyRound className="w-4 h-4" />
                                Download license
                              </button>
                              <button
                                onClick={() => runLicenseAction(dep, 'extend')}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                              >
                                <Clock className="w-4 h-4" />
                                Extend +30 days
                              </button>
                              {dep.type === 'standalone' && (
                                <button
                                  onClick={() => openReissueModal(dep)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-indigo-700"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  Reissue license
                                </button>
                              )}
                              {dep.licenseStatus === 'suspended' ? (
                                <button
                                  onClick={() => runLicenseAction(dep, 'reactivate')}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-green-700"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Reactivate license
                                </button>
                              ) : (
                                <button
                                  onClick={() => runLicenseAction(dep, 'suspend')}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-yellow-700"
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                  Suspend license
                                </button>
                              )}
                              <div className="border-t border-gray-100 my-1" />
                              <button
                                onClick={() => runLicenseAction(dep, 'revoke')}
                                className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center gap-2 text-red-700"
                              >
                                <AlertTriangle className="w-4 h-4" />
                                Revoke license
                              </button>
                            </>
                          ) : (
                            <p className="px-3 py-2 text-gray-400 italic text-xs">
                              No license actions available
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <SystemPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirmDialog}
      />

      {/* Create Deployment Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Create Deployment</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Existing Organization (optional)</label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="input w-full"
                >
                  <option value="">— Create new organization —</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Pick an existing tenant, or leave blank to provision a new one from the name below.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name {selectedTenantId ? '' : '*'}</label>
                <input
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  className="input w-full"
                  placeholder="e.g. Mulago National Referral Hospital"
                  disabled={!!selectedTenantId}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Deployment Type *</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['cloud', 'hybrid', 'standalone'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm({ ...form, type })}
                      className={`p-3 rounded-xl border-2 text-left transition-colors ${
                        form.type === type
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {TYPE_CONFIG[type].icon}
                        <span className="font-medium text-sm">{TYPE_CONFIG[type].label}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {TYPE_CONFIG[type].description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="community">Community (free support)</option>
                  <option value="professional">Professional (4h response)</option>
                  <option value="enterprise">Enterprise (1h, 24/7 support)</option>
                </select>
              </div>

              {(form.type === 'cloud' || form.type === 'hybrid') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Domain (optional)</label>
                  <input
                    value={form.domain}
                    onChange={(e) => setForm({ ...form, domain: e.target.value })}
                    className="input w-full"
                    placeholder="e.g. hims.mulago.go.ug"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                <input
                  type="number"
                  value={form.maxUsers}
                  onChange={(e) => setForm({ ...form, maxUsers: Number(e.target.value) })}
                  className="input w-full"
                  min={1}
                  max={10000}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="input w-full h-20 resize-none"
                  placeholder="Additional notes about this deployment…"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                ) : (
                  <><KeyRound className="w-4 h-4" /> Generate License &amp; Create</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reissue License Modal */}
      {reissueModal.open && reissueModal.dep && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Reissue License</h2>
              <button
                onClick={() => setReissueModal({ open: false, dep: null, days: 365, busy: false })}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Extend and reissue the license for <strong>{reissueModal.dep.organizationName}</strong>.
                A new <code>license.json</code> file will be downloaded for the on-premise admin to apply.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Extension days</label>
                <input
                  type="number"
                  min={1}
                  max={730}
                  value={reissueModal.days}
                  onChange={(e) => setReissueModal((prev) => ({ ...prev, days: Number(e.target.value) }))}
                  className="input w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Between 1 and 730 days. Default: 365.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setReissueModal({ open: false, dep: null, days: 365, busy: false })}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={executeReissue}
                disabled={reissueModal.busy || reissueModal.days < 1 || reissueModal.days > 730}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {reissueModal.busy ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Reissuing...</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> Reissue &amp; Download</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
