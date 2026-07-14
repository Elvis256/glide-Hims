import { useEffect, useState } from 'react';
import api from '../../services/api';
import { toast } from 'sonner';

interface SsoConfig {
  enabled?: boolean;
  provider?: 'saml' | 'oidc' | '';
  issuer?: string;
  ssoUrl?: string;
  certificate?: string;
  emailAttribute?: string;
  defaultRoleId?: string;
  // OIDC
  clientId?: string;
  clientSecret?: string;
  discoveryUrl?: string;
}

const empty: SsoConfig = {
  enabled: false,
  provider: '',
  emailAttribute: 'email',
};

export default function SsoConfigPage() {
  const [cfg, setCfg] = useState<SsoConfig>(empty);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<SsoConfig>('/admin/integrations/sso');
      setCfg({ ...empty, ...res.data });
    } catch {
      setCfg(empty);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      await api.post('/admin/integrations/sso', cfg);
      toast.success('SSO configuration saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Single Sign-On (SSO)</h1>
      <p className="text-sm text-gray-600 mb-6">
        Configure SAML 2.0 or OIDC identity provider integration. Changes take effect on next login.
      </p>
      <div className="bg-white rounded shadow p-6 space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!cfg.enabled}
            onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
          />
          <span className="font-medium">Enable SSO</span>
        </label>

        <label className="block">
          <span className="text-sm">Provider</span>
          <select
            className="w-full border rounded p-2"
            value={cfg.provider || ''}
            onChange={(e) => setCfg({ ...cfg, provider: e.target.value as any })}
          >
            <option value="">— select —</option>
            <option value="saml">SAML 2.0</option>
            <option value="oidc">OpenID Connect</option>
          </select>
        </label>

        {cfg.provider === 'saml' && (
          <>
            <label className="block">
              <span className="text-sm">Issuer / Entity ID</span>
              <input
                className="w-full border rounded p-2"
                value={cfg.issuer || ''}
                onChange={(e) => setCfg({ ...cfg, issuer: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm">SSO URL</span>
              <input
                className="w-full border rounded p-2"
                value={cfg.ssoUrl || ''}
                onChange={(e) => setCfg({ ...cfg, ssoUrl: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm">X.509 Certificate (PEM)</span>
              <textarea
                className="w-full border rounded p-2 font-mono text-xs"
                rows={6}
                value={cfg.certificate || ''}
                onChange={(e) => setCfg({ ...cfg, certificate: e.target.value })}
              />
            </label>
          </>
        )}

        {cfg.provider === 'oidc' && (
          <>
            <label className="block">
              <span className="text-sm">Discovery URL</span>
              <input
                className="w-full border rounded p-2"
                value={cfg.discoveryUrl || ''}
                onChange={(e) => setCfg({ ...cfg, discoveryUrl: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm">Client ID</span>
              <input
                className="w-full border rounded p-2"
                value={cfg.clientId || ''}
                onChange={(e) => setCfg({ ...cfg, clientId: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-sm">Client Secret</span>
              <input
                type="password"
                className="w-full border rounded p-2"
                value={cfg.clientSecret || ''}
                onChange={(e) => setCfg({ ...cfg, clientSecret: e.target.value })}
              />
            </label>
          </>
        )}

        <label className="block">
          <span className="text-sm">Email attribute name</span>
          <input
            className="w-full border rounded p-2"
            value={cfg.emailAttribute || 'email'}
            onChange={(e) => setCfg({ ...cfg, emailAttribute: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="text-sm">Default Role ID for new SSO users (optional)</span>
          <input
            className="w-full border rounded p-2"
            value={cfg.defaultRoleId || ''}
            onChange={(e) => setCfg({ ...cfg, defaultRoleId: e.target.value })}
          />
        </label>

        <div className="flex justify-end pt-4">
          <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
