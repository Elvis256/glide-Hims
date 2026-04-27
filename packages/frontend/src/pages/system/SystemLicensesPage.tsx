import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Loader2, Plus, RefreshCw, Ban, CalendarPlus, ShieldCheck, AlertCircle } from 'lucide-react';
import api from '../../services/api';

interface License {
  id: string;
  licenseKey: string;
  organizationName: string;
  email: string | null;
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  licenseType: 'trial' | 'standard' | 'professional' | 'enterprise';
  issuedAt: string;
  expiresAt: string;
  maxUsers: number;
  maxFacilities: number;
  enabledModules: string[] | null;
  hardwareId: string | null;
  tenantId: string | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-rose-100 text-rose-700',
  suspended: 'bg-amber-100 text-amber-700',
  revoked: 'bg-gray-200 text-gray-700',
};

const TIER_BADGE: Record<string, string> = {
  trial: 'bg-gray-100 text-gray-700',
  standard: 'bg-blue-100 text-blue-700',
  professional: 'bg-indigo-100 text-indigo-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export default function SystemLicensesPage() {
  const [items, setItems] = useState<License[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [extendingId, setExtendingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [licRes, tnRes] = await Promise.all([
        api.get('/license'),
        api.get('/tenants').catch(() => ({ data: { data: [] } })),
      ]);
      setItems(licRes.data?.data || licRes.data || []);
      setTenants(tnRes.data?.data || tnRes.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tenantById = useMemo(() => {
    const m = new Map<string, Tenant>();
    tenants.forEach((t) => m.set(t.id, t));
    return m;
  }, [tenants]);

  const onRevoke = async (lic: License) => {
    if (!confirm(`Revoke license for ${lic.organizationName}? This is immediate.`)) return;
    try {
      await api.put(`/license/${lic.licenseKey}/revoke`);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Revoke failed');
    }
  };

  const onExtend = async (lic: License) => {
    const daysStr = prompt(`Extend license for ${lic.organizationName} by how many days?`, '30');
    if (!daysStr) return;
    const days = parseInt(daysStr, 10);
    if (!Number.isFinite(days) || days <= 0) { alert('Enter a positive integer'); return; }
    setExtendingId(lic.id);
    try {
      await api.put(`/license/${lic.licenseKey}/extend`, { days });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Extend failed');
    } finally {
      setExtendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-indigo-600" /> Licenses
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Issue, extend, and revoke license keys. Each tenant gets a 30-day trial automatically when created.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Issue License
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Limits</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">License Key</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100 text-sm">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
              </td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No licenses yet. Click "Issue License" to create one.</td></tr>
            )}
            {!loading && items.map((l) => {
              const tenant = l.tenantId ? tenantById.get(l.tenantId) : null;
              const days = daysUntil(l.expiresAt);
              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{l.organizationName}</div>
                    {l.email && <div className="text-xs text-gray-500">{l.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TIER_BADGE[l.licenseType] || ''}`}>
                      {l.licenseType}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[l.status] || ''}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {tenant ? (
                      <span title={tenant.id}>{tenant.name}</span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {l.maxUsers} users · {l.maxFacilities} fac.
                    {l.enabledModules?.length ? <div className="text-gray-400">{l.enabledModules.length} modules</div> : null}
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {new Date(l.expiresAt).toLocaleDateString()}
                    <div className={days < 0 ? 'text-rose-600' : days <= 7 ? 'text-amber-600' : 'text-gray-400'}>
                      {days < 0 ? `expired ${-days}d ago` : `${days}d left`}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{l.licenseKey}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => onExtend(l)}
                        disabled={extendingId === l.id}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Extend"
                      >
                        {extendingId === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                      </button>
                      {l.status !== 'revoked' && (
                        <button
                          onClick={() => onRevoke(l)}
                          className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                          title="Revoke"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateLicenseModal
          tenants={tenants}
          onClose={() => setShowCreate(false)}
          onCreated={async () => { setShowCreate(false); await load(); }}
        />
      )}
    </div>
  );
}

function CreateLicenseModal({
  tenants,
  onClose,
  onCreated,
}: {
  tenants: Tenant[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tenantId, setTenantId] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [licenseType, setLicenseType] = useState<'trial' | 'standard' | 'professional' | 'enterprise'>('professional');
  const [validityDays, setValidityDays] = useState(365);
  const [maxUsers, setMaxUsers] = useState(50);
  const [maxFacilities, setMaxFacilities] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!tenantId) { setErr('Select a tenant'); return; }
    if (!organizationName) { setErr('Organization name required'); return; }
    setSubmitting(true);
    setErr(null);
    try {
      await api.post('/license/generate', {
        tenantId,
        organizationName,
        email: email || `${tenantId}@licenses.local`,
        licenseType,
        maxUsers,
        maxFacilities,
        validityDays,
      });
      onCreated();
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Failed to issue license');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" /> Issue License
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          {err && <div className="p-2 bg-rose-50 text-rose-700 rounded text-xs">{err}</div>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tenant *</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded"
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                const t = tenants.find((x) => x.id === e.target.value);
                if (t && !organizationName) setOrganizationName(t.name);
              }}
            >
              <option value="">— select —</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Organization Name *</label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="billing contact"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tier *</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value as any)}
              >
                <option value="trial">Trial</option>
                <option value="standard">Standard</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Valid for (days) *</label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={validityDays}
                onChange={(e) => setValidityDays(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Users</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={maxUsers}
                onChange={(e) => setMaxUsers(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Max Facilities</label>
              <input
                type="number"
                min={1}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                value={maxFacilities}
                onChange={(e) => setMaxFacilities(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Issue
          </button>
        </div>
      </div>
    </div>
  );
}
