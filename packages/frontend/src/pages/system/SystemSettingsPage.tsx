import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../services/api';
import {
  Settings, Database, Globe, Shield, Server, Users, Building2,
  Activity, HardDrive, RefreshCw, Loader2, Save, Pencil, X, Check,
  Stethoscope, Calendar, Clock
} from 'lucide-react';

interface PlatformOverview {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  totalUsers: number;
  systemAdmins: number;
  totalFacilities: number;
  totalPatients: number;
  totalEncounters: number;
  todayEncounters: number;
  databaseSize: string;
}

interface PlatformSetting {
  id: string;
  key: string;
  value: any;
  description?: string;
}

const DEFAULT_SETTINGS: Record<string, { label: string; description: string; type: string; options?: string[] }> = {
  'platform.default_currency': {
    label: 'Default Currency',
    description: 'Default currency for new tenants',
    type: 'select',
    options: ['UGX', 'USD', 'EUR', 'GBP', 'KES', 'TZS', 'RWF'],
  },
  'platform.default_timezone': {
    label: 'Default Timezone',
    description: 'Default timezone for new tenants',
    type: 'select',
    options: ['Africa/Kampala', 'Africa/Nairobi', 'Africa/Dar_es_Salaam', 'Africa/Kigali', 'Africa/Lagos', 'UTC', 'US/Eastern', 'US/Pacific', 'Europe/London'],
  },
  'platform.max_users_per_tenant': {
    label: 'Max Users Per Tenant',
    description: 'Maximum number of users allowed per tenant (0 = unlimited)',
    type: 'number',
  },
  'platform.session_timeout_minutes': {
    label: 'Session Timeout (minutes)',
    description: 'Auto-logout after inactivity',
    type: 'number',
  },
  'platform.allow_self_registration': {
    label: 'Allow Self-Registration',
    description: 'Allow organizations to register themselves',
    type: 'boolean',
  },
  'platform.maintenance_mode': {
    label: 'Maintenance Mode',
    description: 'Put the platform in maintenance mode (users see a maintenance page)',
    type: 'boolean',
  },
};

export default function SystemSettingsPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [envInfo, setEnvInfo] = useState<Record<string, string>>({
    deploymentMode: 'on-premise',
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, settingsRes, setupRes] = await Promise.all([
        api.get('/settings/platform-overview'),
        api.get('/settings/platform'),
        api.get('/setup/status'),
      ]);

      const ov = overviewRes.data?.data || overviewRes.data;
      setOverview(ov);

      const settingsArr = settingsRes.data?.data || settingsRes.data || [];
      const map: Record<string, any> = {};
      if (Array.isArray(settingsArr)) {
        settingsArr.forEach((s: PlatformSetting) => {
          map[s.key] = s.value;
        });
      }
      setSettings(map);

      const setupData = setupRes.data?.data || setupRes.data || {};
      setEnvInfo({
        deploymentMode: setupData.deploymentMode || 'on-premise',
        version: '1.0.0',
      });
    } catch {
      toast.error('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSetting = async (key: string, value: any) => {
    setSaving(true);
    try {
      const shortKey = key.replace('platform.', '');
      await api.put(`/settings/platform/${shortKey}`, { value });
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Setting saved');
      setEditingKey(null);
    } catch {
      toast.error('Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (key: string) => {
    setEditingKey(key);
    const current = settings[key];
    setEditValue(current !== undefined && current !== null ? String(current) : '');
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-500 mt-1">Global system configuration &amp; health overview</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Platform Health Overview */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard icon={Building2} label="Organizations" value={overview.totalTenants} color="blue" sub={`${overview.activeTenants} active`} />
          <StatCard icon={Users} label="Total Users" value={overview.totalUsers} color="indigo" sub={`${overview.systemAdmins} sys admins`} />
          <StatCard icon={Building2} label="Facilities" value={overview.totalFacilities} color="purple" />
          <StatCard icon={Stethoscope} label="Patients" value={overview.totalPatients} color="green" />
          <StatCard icon={Activity} label="Encounters Today" value={overview.todayEncounters} color="orange" sub={`${overview.totalEncounters} total`} />
        </div>
      )}

      {/* System Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-gray-500" /> System Information
          </h2>
          <div className="space-y-3 text-sm">
            <InfoRow label="Deployment Mode" value={(envInfo.deploymentMode || 'on-premise').replace('-', ' ')} badge badgeColor="blue" />
            <InfoRow label="Version" value={`Glide HIMS v${envInfo.version}`} />
            <InfoRow label="Database Size" value={overview?.databaseSize || 'N/A'} />
            <InfoRow label="Total Encounters" value={String(overview?.totalEncounters || 0)} />
            <InfoRow label="API Prefix" value="/api/v1" mono />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-500" /> Security &amp; Access
          </h2>
          <div className="space-y-3 text-sm">
            <InfoRow label="Password Policy" value="Min 8 chars, uppercase + lowercase + digit + special" />
            <InfoRow label="JWT Expiry" value="15 minutes" />
            <InfoRow label="Refresh Token Expiry" value="7 days" />
            <InfoRow label="Rate Limiting" value="100 req / 60s" />
            <InfoRow label="Bcrypt Rounds" value="12" />
          </div>
        </div>
      </div>

      {/* Platform Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-500" /> Platform Defaults
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            These defaults apply when creating new tenants. Existing tenants keep their own settings.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {Object.entries(DEFAULT_SETTINGS).map(([key, config]) => {
            const currentValue = settings[key];
            const isEditing = editingKey === key;

            return (
              <div key={key} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{config.label}</p>
                  <p className="text-xs text-gray-500">{config.description}</p>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-2">
                    {config.type === 'select' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Select —</option>
                        {config.options?.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : config.type === 'boolean' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="false">Disabled</option>
                        <option value="true">Enabled</option>
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                    <button
                      onClick={() => {
                        let val: any = editValue;
                        if (config.type === 'number') val = Number(editValue) || 0;
                        if (config.type === 'boolean') val = editValue === 'true';
                        handleSaveSetting(key, val);
                      }}
                      disabled={saving}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">
                      {currentValue !== undefined && currentValue !== null ? (
                        config.type === 'boolean' ? (currentValue ? 'Enabled' : 'Disabled') : String(currentValue)
                      ) : (
                        <span className="text-gray-400 italic">Not set</span>
                      )}
                    </span>
                    <button onClick={() => startEdit(key)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: any; label: string; value: number; color: string; sub?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${colors[color] || colors.blue}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value, badge, badgeColor, mono }: {
  label: string; value: string; badge?: boolean; badgeColor?: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      {badge ? (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
          badgeColor === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {value}
        </span>
      ) : (
        <span className={`text-gray-900 font-medium ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
      )}
    </div>
  );
}
