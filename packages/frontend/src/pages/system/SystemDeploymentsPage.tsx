import { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Server, Cloud, HardDrive, Plus, Search, RefreshCw,
  CheckCircle2, AlertTriangle, Clock, Loader2, Copy, Check,
  ExternalLink, MoreVertical, KeyRound, Activity, Building2,
} from 'lucide-react';
import { toast } from 'sonner';

type DeploymentType = 'hybrid' | 'standalone';
type DeploymentStatus = 'active' | 'pending' | 'error' | 'expired';

interface Deployment {
  id: string;
  organizationName: string;
  type: DeploymentType;
  status: DeploymentStatus;
  licenseKey: string;
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

const TYPE_CONFIG: Record<DeploymentType, { label: string; icon: React.ReactNode; color: string }> = {
  hybrid: {
    label: 'Hybrid',
    icon: <Cloud className="w-4 h-4" />,
    color: 'text-blue-600 bg-blue-50',
  },
  standalone: {
    label: 'Standalone',
    icon: <HardDrive className="w-4 h-4" />,
    color: 'text-purple-600 bg-purple-50',
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
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | DeploymentType>('all');
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

  const loadDeployments = async () => {
    setLoading(true);
    try {
      // Try to load from the deployments API; fall back to empty state if not yet implemented
      const res = await api.get('/deployments').catch(() => ({ data: [] }));
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setDeployments(data);
    } catch {
      setDeployments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
    api
      .get('/tenants')
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
      toast.success(`${form.type === 'hybrid' ? 'Hybrid' : 'Standalone'} deployment created`);
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
    const matchSearch =
      d.organizationName.toLowerCase().includes(search.toLowerCase()) ||
      d.licenseKey.toLowerCase().includes(search.toLowerCase()) ||
      (d.domain || '').toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || d.type === typeFilter;
    return matchSearch && matchType;
  });

  const stats = {
    total: deployments.length,
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
          <p className="text-sm text-gray-500 mt-1">Manage Hybrid &amp; Standalone customer deployments</p>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Deployments', value: stats.total, icon: Server, color: 'text-gray-600 bg-gray-100' },
          { label: 'Hybrid (Cloud)', value: stats.hybrid, icon: Cloud, color: 'text-blue-600 bg-blue-50' },
          { label: 'Standalone (Offline)', value: stats.standalone, icon: HardDrive, color: 'text-purple-600 bg-purple-50' },
          { label: 'Active', value: stats.active, icon: Activity, color: 'text-green-600 bg-green-50' },
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
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Building2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Two deployment types available</p>
          <p className="mt-1">
            <strong>Hybrid</strong> — Customer hosts on their own servers (AWS/Azure/On-Premise). 
            Updates pushed from this server.{' '}
            <strong>Standalone</strong> — Completely air-gapped for government, military, and remote clinics. 
            Updates via USB/manual distribution.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by organization, license key, or domain…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'hybrid', 'standalone'] as const).map((t) => (
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

      {/* Deployments List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Server className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No deployments found</p>
          <p className="text-gray-400 text-sm mt-1">
            {deployments.length === 0
              ? 'Create your first hybrid or standalone deployment above.'
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
              {filtered.map((dep) => (
                <tr key={dep.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{dep.organizationName}</p>
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
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{dep.licenseKey}</code>
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
                  <td className="px-4 py-3">
                    <button className="text-gray-400 hover:text-gray-600 p-1">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                <div className="grid grid-cols-2 gap-3">
                  {(['hybrid', 'standalone'] as const).map((type) => (
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
                        {type === 'hybrid'
                          ? 'Customer-hosted, central updates'
                          : 'Air-gapped, offline operation'}
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

              {form.type === 'hybrid' && (
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
    </div>
  );
}
