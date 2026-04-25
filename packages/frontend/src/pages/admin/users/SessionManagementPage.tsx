import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Monitor,
  Search,
  LogOut,
  Clock,
  Globe,
  User,
  AlertTriangle,
  Settings,
  RefreshCw,
  Smartphone,
  Laptop,
  Tablet,
  ChevronDown,
  Check,
  Wifi,
  WifiOff,
  Save,
  Users,
  Loader2,
  Info,
} from 'lucide-react';
import api from '../../../services/api';

interface Session {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;
  isActive: boolean;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  tokenHash?: string;
}

type DeviceType = 'desktop' | 'mobile' | 'tablet';
type SessionStatus = 'active' | 'idle' | 'expired';

function parseUserAgent(ua: string): { browser: string; deviceType: DeviceType } {
  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/i.test(ua)) browser = 'IE';

  let deviceType: DeviceType = 'desktop';
  if (/mobile|android.*mobile|iphone/i.test(ua)) deviceType = 'mobile';
  else if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';

  return { browser, deviceType };
}

function deriveStatus(session: Session): SessionStatus {
  if (!session.isActive || new Date(session.expiresAt) < new Date()) return 'expired';
  const idleThreshold = 30 * 60 * 1000; // 30 minutes
  if (new Date().getTime() - new Date(session.lastActivityAt).getTime() > idleThreshold) return 'idle';
  return 'active';
}

interface SessionSettings {
  sessionTimeout: number;
  idleTimeout: number;
  maxConcurrentSessions: number;
  forceLogoutOnPasswordChange: boolean;
  rememberMeDuration: number;
  enforceIPBinding: boolean;
}

const defaultSettings: SessionSettings = {
  sessionTimeout: 480,
  idleTimeout: 30,
  maxConcurrentSessions: 3,
  forceLogoutOnPasswordChange: true,
  rememberMeDuration: 7,
  enforceIPBinding: false,
};

export default function SessionManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch session config from API
  const { data: settingsData } = useQuery({
    queryKey: ['session-config'],
    queryFn: async () => {
      const response = await api.get('/settings/session_config');
      return response.data as SessionSettings;
    },
  });

  const [settings, setSettings] = useState<SessionSettings>(defaultSettings);

  // Sync local state when API data arrives
  React.useEffect(() => {
    if (settingsData) {
      setSettings({ ...defaultSettings, ...settingsData });
    }
  }, [settingsData]);

  // Save session config via API
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: SessionSettings) => {
      const response = await api.put('/settings/session_config', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-config'] });
      toast.success('Session settings saved successfully');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message || 'Failed to save settings';
      toast.error(msg);
    },
  });

  // Fetch sessions from API
  const { data: sessionsData, isLoading, error, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const response = await api.get('/auth/sessions');
      return response.data.data as Session[];
    },
    staleTime: 30000,
  });

  const sessions = sessionsData ?? [];

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settings);
  };

  const statuses = ['All Status', 'active', 'idle', 'expired'];

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const { browser } = parseUserAgent(session.userAgent);
      const status = deriveStatus(session);
      const matchesSearch =
        session.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.ipAddress.includes(searchTerm) ||
        browser.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (session.deviceInfo || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All Status' || status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [sessions, searchTerm, selectedStatus]);

  const sessionStats = useMemo(() => {
    return {
      total: sessions.length,
      active: sessions.filter((s) => deriveStatus(s) === 'active').length,
      idle: sessions.filter((s) => deriveStatus(s) === 'idle').length,
      expired: sessions.filter((s) => deriveStatus(s) === 'expired').length,
      uniqueUsers: new Set(sessions.map((s) => s.userId)).size,
    };
  }, [sessions]);

  const getDeviceIcon = (deviceType: DeviceType) => {
    const icons = {
      desktop: <Laptop className="w-4 h-4" />,
      mobile: <Smartphone className="w-4 h-4" />,
      tablet: <Tablet className="w-4 h-4" />,
    };
    return icons[deviceType];
  };

  const getStatusBadge = (status: SessionStatus) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      idle: 'bg-yellow-100 text-yellow-700',
      expired: 'bg-red-100 text-red-700',
    };
    const icons = {
      active: <Wifi className="w-3 h-3" />,
      idle: <Clock className="w-3 h-3" />,
      expired: <WifiOff className="w-3 h-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await api.delete(`/auth/sessions/${sessionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('Session revoked successfully');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message || 'Failed to revoke session';
      toast.error(msg);
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/auth/sessions');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('All other sessions revoked');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message || 'Failed to revoke sessions';
      toast.error(msg);
    },
  });

  const handleForceLogout = (sessionId: string) => {
    revokeSessionMutation.mutate(sessionId);
  };

  const handleBulkLogout = () => {
    if (selectedSessions.length === sessions.length) {
      revokeAllMutation.mutate();
    } else {
      selectedSessions.forEach((id) => revokeSessionMutation.mutate(id));
    }
    setSelectedSessions([]);
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessions((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Monitor className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Session Management</h1>
            <p className="text-sm text-gray-500">Monitor and manage active user sessions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showSettings ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button 
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Total Sessions</span>
            <Monitor className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{sessionStats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Active</span>
            <Wifi className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{sessionStats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Idle</span>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{sessionStats.idle}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Expired</span>
            <WifiOff className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{sessionStats.expired}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Unique Users</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{sessionStats.uniqueUsers}</p>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sessions Table */}
        <div className={`${showSettings ? 'flex-1' : 'w-full'} bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden`}>
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by user, IP, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
              >
                <Wifi className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{selectedStatus}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {showStatusDropdown && (
                <div className="absolute top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => { setSelectedStatus(status); setShowStatusDropdown(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                      {selectedStatus === status && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSessions.length > 0 && (
              <button
                onClick={handleBulkLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <LogOut className="w-4 h-4" />
                Force Logout ({selectedSessions.length})
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <span className="ml-2 text-gray-500">Loading sessions...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
                <p className="text-lg font-medium">Failed to Load Sessions</p>
                <p className="text-sm text-gray-400 mt-2">
                  An error occurred while fetching session data. Please try again.
                </p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Info className="w-12 h-12 text-blue-400 mb-4" />
                <p className="text-lg font-medium">No Active Sessions</p>
                <p className="text-sm text-gray-400 mt-2">
                  {sessions.length === 0 
                    ? 'No users are currently logged in or session data is unavailable.'
                    : 'No sessions match the current filter criteria.'}
                </p>
              </div>
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedSessions.length === filteredSessions.length && filteredSessions.length > 0}
                      onChange={() => {
                        if (selectedSessions.length === filteredSessions.length) {
                          setSelectedSessions([]);
                        } else {
                          setSelectedSessions(filteredSessions.map((s) => s.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Login Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSessions.map((session) => {
                  const { browser, deviceType } = parseUserAgent(session.userAgent);
                  const status = deriveStatus(session);
                  return (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.includes(session.id)}
                        onChange={() => toggleSessionSelection(session.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{session.userId}</p>
                          <p className="text-xs text-gray-500">{session.deviceInfo || deviceType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(deviceType)}
                        <div>
                          <p className="text-sm text-gray-900">{browser}</p>
                          <p className="text-xs text-gray-500 font-mono">{session.ipAddress}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{session.ipAddress}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{new Date(session.createdAt).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{new Date(session.lastActivityAt).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(status)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleForceLogout(session.id)}
                        disabled={revokeSessionMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200 disabled:opacity-50"
                      >
                        <LogOut className="w-3 h-3" />
                        Logout
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="w-96 bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Session Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Session Timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Timeout (minutes)
                </label>
                <input
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) => setSettings({ ...settings, sessionTimeout: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum session duration before forced logout</p>
              </div>

              {/* Idle Timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idle Timeout (minutes)
                </label>
                <input
                  type="number"
                  value={settings.idleTimeout}
                  onChange={(e) => setSettings({ ...settings, idleTimeout: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Time before session is marked as idle</p>
              </div>

              {/* Max Concurrent Sessions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Concurrent Sessions
                </label>
                <input
                  type="number"
                  value={settings.maxConcurrentSessions}
                  onChange={(e) => setSettings({ ...settings, maxConcurrentSessions: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum simultaneous sessions per user</p>
              </div>

              {/* Remember Me Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remember Me Duration (days)
                </label>
                <input
                  type="number"
                  value={settings.rememberMeDuration}
                  onChange={(e) => setSettings({ ...settings, rememberMeDuration: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Toggle Settings */}
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Force Logout on Password Change</p>
                    <p className="text-xs text-gray-500">Terminate all sessions when password is changed</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, forceLogoutOnPasswordChange: !settings.forceLogoutOnPasswordChange })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.forceLogoutOnPasswordChange ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.forceLogoutOnPasswordChange ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </label>

                <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Enforce IP Binding</p>
                    <p className="text-xs text-gray-500">Lock session to originating IP address</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, enforceIPBinding: !settings.enforceIPBinding })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.enforceIPBinding ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.enforceIPBinding ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>

              {/* API note */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Settings are saved to the server and apply to all users across the system.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200">
              <button 
                onClick={handleSaveSettings}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                {saveSettingsMutation.isSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved!
                  </>
                ) : saveSettingsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
