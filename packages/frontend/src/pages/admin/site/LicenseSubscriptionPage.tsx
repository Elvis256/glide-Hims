import { useEffect, useState } from 'react';
import { KeyRound, Loader2, AlertCircle, CheckCircle2, Clock, Users, Building2, Package } from 'lucide-react';
import { api } from '../../../services/api';
import { toast } from 'sonner';

interface LicenseInfo {
  id: string;
  organizationName: string;
  licenseType: string;
  status: string;
  issuedAt: string;
  expiresAt: string;
  daysRemaining: number;
  maxUsers: number;
  maxFacilities: number;
  enabledModules?: string[] | null;
  licenseKey: string | null;
}

const TIER_BADGE: Record<string, string> = {
  trial: 'bg-amber-100 text-amber-800',
  starter: 'bg-blue-100 text-blue-800',
  professional: 'bg-indigo-100 text-indigo-800',
  enterprise: 'bg-emerald-100 text-emerald-800',
};

export default function LicenseSubscriptionPage() {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get('/license/me')
      .then((res: any) => setLicense(res.data?.license || null))
      .catch((e) => setError(e?.response?.data?.message || e?.message || 'Failed to load license'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const activate = async () => {
    if (!keyInput.trim()) {
      toast.error('Paste a license key');
      return;
    }
    setActivating(true);
    try {
      await api.post('/license/activate', { licenseKey: keyInput.trim() });
      toast.success('License activated');
      setKeyInput('');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.response?.data?.message || 'Activation failed');
    } finally {
      setActivating(false);
    }
  };

  const expiringSoon = license && license.daysRemaining <= 14 && license.status === 'active';
  const expired = license && license.status === 'expired';

  return (
    <div className="space-y-6 p-2">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-indigo-600" /> License & Subscription
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          View your current plan, limits and expiry. Paste an offline key below if your provider supplied one.
        </p>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin inline mr-2" /> Loading license…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      {!loading && !license && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          <KeyRound className="w-8 h-8 mx-auto text-gray-300 mb-2" />
          No license found for this organization. Activate one below or contact your provider.
        </div>
      )}

      {!loading && license && (
        <>
          {expired && (
            <div className="flex items-start gap-2 p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">License expired</div>
                <div>Your subscription expired on {new Date(license.expiresAt).toLocaleDateString()}. Some features may be limited.</div>
              </div>
            </div>
          )}
          {expiringSoon && !expired && (
            <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Expiring in {license.daysRemaining} day{license.daysRemaining === 1 ? '' : 's'}</div>
                <div>Contact your provider to renew before {new Date(license.expiresAt).toLocaleDateString()}.</div>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-gray-500">Current Plan</div>
                <div className="text-lg font-semibold text-gray-900">{license.organizationName}</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${TIER_BADGE[license.licenseType] || 'bg-gray-100 text-gray-700'}`}>
                {license.licenseType}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500"><CheckCircle2 className="w-3 h-3" /> Status</div>
                <div className="mt-2 text-base font-semibold text-gray-900 capitalize">{license.status}</div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500"><Clock className="w-3 h-3" /> Expires</div>
                <div className="mt-2 text-base font-semibold text-gray-900">
                  {new Date(license.expiresAt).toLocaleDateString()}
                </div>
                <div className="text-xs text-gray-500">{license.daysRemaining} days remaining</div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500"><Users className="w-3 h-3" /> Max Users</div>
                <div className="mt-2 text-base font-semibold text-gray-900">{license.maxUsers}</div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500"><Building2 className="w-3 h-3" /> Max Facilities</div>
                <div className="mt-2 text-base font-semibold text-gray-900">{license.maxFacilities}</div>
              </div>
            </div>
            {license.enabledModules && license.enabledModules.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 mb-2"><Package className="w-3 h-3" /> Enabled Modules</div>
                <div className="flex flex-wrap gap-2">
                  {license.enabledModules.map((m) => (
                    <span key={m} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-medium text-gray-700">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {license.licenseKey && (
              <div className="px-6 py-3 border-t border-gray-200 text-xs text-gray-500">
                License key: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">{license.licenseKey}</code>
              </div>
            )}
          </div>
        </>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-900">Activate Offline License Key</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          For on-premise installations or renewals — paste the key your provider sent you.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="GLD-XXXX-XXXX-XXXX-XXXX"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={activating}
          />
          <button
            onClick={activate}
            disabled={activating || !keyInput.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Activate
          </button>
        </div>
      </div>
    </div>
  );
}
