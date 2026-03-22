import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Database,
  Settings,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpCircle,
  Search,
  Calendar,
  Wifi,
  WifiOff,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import api from '../../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DHIS2Config {
  baseUrl: string;
  username: string;
  password: string;
  orgUnitId: string;
  enabled: boolean;
  lastPush?: string;
  lastPushResult?: string;
}

interface DHIS2OrgUnit {
  id: string;
  name: string;
  level: number;
}

interface PushResult {
  success: boolean;
  imported: number;
  updated: number;
  ignored: number;
  conflicts: string[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const dhis2Api = {
  getConfig: async (): Promise<DHIS2Config> => {
    const res = await api.get('/integrations/dhis2/config');
    return res.data;
  },
  saveConfig: async (config: Partial<DHIS2Config>) => {
    const res = await api.post('/integrations/dhis2/config', config);
    return res.data;
  },
  testConnection: async (): Promise<{ success: boolean; message: string; orgUnitName?: string }> => {
    const res = await api.post('/integrations/dhis2/test-connection');
    return res.data;
  },
  getOrgUnits: async (): Promise<{ data: DHIS2OrgUnit[]; count: number }> => {
    const res = await api.get('/integrations/dhis2/org-units');
    return res.data;
  },
  pushHMIS105: async (body: { month: number; year: number; facilityId?: string }): Promise<PushResult> => {
    const res = await api.post('/integrations/dhis2/push-hmis105', body);
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function DHIS2SettingsPage() {
  const now = new Date();

  // Form state
  const [baseUrl, setBaseUrl] = useState('https://hmis2.health.go.ug/api');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [pushMonth, setPushMonth] = useState(now.getMonth() + 1);
  const [pushYear, setPushYear] = useState(now.getFullYear());

  // Fetch current config
  const { data: config, isLoading: configLoading, refetch: refetchConfig } = useQuery({
    queryKey: ['dhis2-config'],
    queryFn: dhis2Api.getConfig,
    retry: false,
    meta: { errorMessage: false },
  });

  // Populate form when config loads
  useState(() => {
    if (config) {
      setBaseUrl(config.baseUrl || 'https://hmis2.health.go.ug/api');
      setUsername(config.username || '');
      setPassword(config.password || '');
      setOrgUnitId(config.orgUnitId || '');
      setEnabled(config.enabled);
    }
  });

  // Sync form when config changes
  const [prevConfig, setPrevConfig] = useState<DHIS2Config | null>(null);
  if (config && config !== prevConfig) {
    setPrevConfig(config);
    setBaseUrl(config.baseUrl || 'https://hmis2.health.go.ug/api');
    setUsername(config.username || '');
    setPassword(config.password || '');
    setOrgUnitId(config.orgUnitId || '');
    setEnabled(config.enabled);
  }

  // Save config
  const saveMutation = useMutation({
    mutationFn: () => dhis2Api.saveConfig({ baseUrl, username, password, orgUnitId, enabled }),
    onSuccess: () => {
      toast.success('DHIS2 configuration saved');
      refetchConfig();
    },
    onError: () => toast.error('Failed to save configuration'),
  });

  // Test connection
  const testMutation = useMutation({
    mutationFn: dhis2Api.testConnection,
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message + (result.orgUnitName ? ` — Org Unit: ${result.orgUnitName}` : ''));
      } else {
        toast.error(result.message);
      }
    },
    onError: () => toast.error('Connection test failed'),
  });

  // Org units
  const { data: orgUnitsData, isLoading: orgUnitsLoading, refetch: fetchOrgUnits } = useQuery({
    queryKey: ['dhis2-org-units'],
    queryFn: dhis2Api.getOrgUnits,
    enabled: false,
  });

  const filteredOrgUnits = useMemo(() => {
    const list = orgUnitsData?.data || [];
    if (!orgSearch) return list.slice(0, 50);
    const q = orgSearch.toLowerCase();
    return list.filter(ou => ou.name.toLowerCase().includes(q)).slice(0, 50);
  }, [orgUnitsData, orgSearch]);

  // Push HMIS 105
  const pushMutation = useMutation({
    mutationFn: () => dhis2Api.pushHMIS105({ month: pushMonth, year: pushYear }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Push complete — Imported: ${result.imported}, Updated: ${result.updated}`);
      } else {
        toast.error(`Push had issues — Ignored: ${result.ignored}`);
      }
      refetchConfig();
    },
    onError: () => toast.error('Failed to push data to DHIS2'),
  });

  const handleLoadOrgUnits = () => {
    fetchOrgUnits();
    setShowOrgDropdown(true);
  };

  // Connection status derived from last test result
  const isConnected = testMutation.data?.success;
  const connectionTested = testMutation.data !== undefined;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Database className="w-7 h-7 text-blue-600" />
            DHIS2 Integration
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Push HMIS 105 report data to Uganda's District Health Information System
          </p>
        </div>
        <a
          href="https://hmis2.health.go.ug"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <ExternalLink className="w-4 h-4" />
          Open DHIS2
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* -------- Connection Settings Card -------- */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Connection Settings
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DHIS2 Base URL</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://hmis2.health.go.ug/api"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="DHIS2 username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="DHIS2 password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dhis2-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="dhis2-enabled" className="text-sm text-gray-700">
                Enable DHIS2 integration
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Configuration
              </button>
              <button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !baseUrl || !username}
                className="flex-1 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {testMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                Test Connection
              </button>
            </div>

            {connectionTested && (
              <div className={`p-3 rounded-lg text-sm ${isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {isConnected ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <XCircle className="w-4 h-4 inline mr-1" />}
                {testMutation.data?.message}
              </div>
            )}
          </div>
        </div>

        {/* -------- Status Card -------- */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-gray-600" />
            Integration Status
          </h2>

          {configLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connection indicator */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {connectionTested ? (
                  isConnected ? (
                    <Wifi className="w-5 h-5 text-green-500" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-500" />
                  )
                ) : (
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {connectionTested
                      ? isConnected ? 'Connected' : 'Connection Failed'
                      : 'Not tested'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {connectionTested ? testMutation.data?.message : 'Click "Test Connection" to verify'}
                  </p>
                </div>
              </div>

              {/* Enabled status */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-3 h-3 rounded-full ${config?.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {config?.enabled ? 'Integration Enabled' : 'Integration Disabled'}
                  </p>
                </div>
              </div>

              {/* Last push */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Last Push</p>
                  <p className="text-xs text-gray-500">
                    {config?.lastPush
                      ? `${new Date(config.lastPush).toLocaleString()} — ${config.lastPushResult === 'success' ? '✅ Success' : '❌ Failed'}`
                      : 'Never pushed'}
                  </p>
                </div>
              </div>

              {/* Org unit */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Database className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-800">Organisation Unit</p>
                  <p className="text-xs text-gray-500">
                    {config?.orgUnitId || 'Not configured'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* -------- Org Unit Mapping Card -------- */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Organisation Unit Mapping
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selected Org Unit ID
              </label>
              <input
                type="text"
                value={orgUnitId}
                onChange={(e) => setOrgUnitId(e.target.value)}
                placeholder="e.g. aB1cD2eF3gH"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleLoadOrgUnits}
              disabled={orgUnitsLoading || !baseUrl || !username}
              className="w-full py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {orgUnitsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Load Org Units from DHIS2
            </button>

            {showOrgDropdown && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Search org units..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredOrgUnits.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500 text-center">
                      {orgUnitsLoading ? 'Loading...' : 'No org units found'}
                    </p>
                  ) : (
                    filteredOrgUnits.map((ou) => (
                      <button
                        key={ou.id}
                        onClick={() => {
                          setOrgUnitId(ou.id);
                          setShowOrgDropdown(false);
                          toast.success(`Selected: ${ou.name}`);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 ${
                          orgUnitId === ou.id ? 'bg-blue-50 font-medium' : ''
                        }`}
                      >
                        <span className="text-gray-800">{ou.name}</span>
                        <span className="text-xs text-gray-400 ml-2">Level {ou.level} · {ou.id}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* -------- Push HMIS 105 Card -------- */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-green-600" />
            Push HMIS 105 to DHIS2
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={pushMonth}
                  onChange={(e) => setPushMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={pushYear}
                  onChange={(e) => setPushYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => pushMutation.mutate()}
              disabled={pushMutation.isPending || !config?.enabled || !config?.orgUnitId}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pushMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="w-4 h-4" />
              )}
              Push {MONTHS[pushMonth - 1]} {pushYear} to DHIS2
            </button>

            {!config?.enabled && (
              <p className="text-xs text-amber-600">Enable the integration and configure org unit to push data.</p>
            )}

            {pushMutation.data && (
              <div className={`p-4 rounded-lg ${pushMutation.data.success ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {pushMutation.data.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${pushMutation.data.success ? 'text-green-700' : 'text-red-700'}`}>
                    {pushMutation.data.success ? 'Push Successful' : 'Push Had Issues'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-2 bg-white rounded">
                    <p className="text-lg font-bold text-green-600">{pushMutation.data.imported}</p>
                    <p className="text-xs text-gray-500">Imported</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <p className="text-lg font-bold text-blue-600">{pushMutation.data.updated}</p>
                    <p className="text-xs text-gray-500">Updated</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <p className="text-lg font-bold text-amber-600">{pushMutation.data.ignored}</p>
                    <p className="text-xs text-gray-500">Ignored</p>
                  </div>
                </div>
                {pushMutation.data.conflicts.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-700 mb-1">Conflicts:</p>
                    <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto">
                      {pushMutation.data.conflicts.map((c, i) => (
                        <li key={i} className="p-1 bg-red-100 rounded">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
