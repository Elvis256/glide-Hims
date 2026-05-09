import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  ArrowLeft, Activity, AlertTriangle, CheckCircle2, Clock, Cpu,
  HardDrive, Loader2, RefreshCw, Server, Building2, KeyRound,
  ExternalLink, Database, Download, Power, Calendar, Upload, FileArchive, Wifi, WifiOff,
} from 'lucide-react';
import TierBadge from '../../components/TierBadge';
import { toast } from 'sonner';

interface HealthSample {
  id: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline' | 'degraded';
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  uptime: number;
  uptimePercentage: number;
  errorRatePercent: number;
  createdAt: string;
}

interface DeploymentAlert {
  id: string;
  title: string;
  severity: 'info' | 'warning' | 'critical' | 'resolved';
  status: 'open' | 'acknowledged' | 'resolved' | 'escalated' | 'false_positive';
  createdAt: string;
}

interface DeploymentDetail {
  id: string;
  tenantId: string;
  tenant: { id: string; name: string; slug: string } | null;
  organizationName: string;
  type: 'hybrid' | 'standalone' | 'cloud';
  status: string;
  apiEndpoint?: string;
  domain?: string | null;
  tier?: string | null;
  maxUsers?: number | null;
  currentVersion: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastSync?: string;
  lastHealthCheck?: string;
  license: {
    licenseKey: string;
    status: string;
    licenseType: string;
    issuedAt: string;
    expiresAt: string;
    maxUsers: number;
    maxFacilities: number;
    enabledModules: string[];
    hardwareId?: string;
    lastValidatedAt?: string;
  } | null;
}

interface DetailResponse {
  deployment: DeploymentDetail;
  health: { latest: HealthSample | null; history: HealthSample[] };
  alerts: DeploymentAlert[];
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-700',
  suspended: 'bg-red-100 text-red-800',
  maintenance: 'bg-blue-100 text-blue-800',
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-green-600',
  warning: 'text-yellow-600',
  critical: 'text-red-600',
  offline: 'text-gray-500',
  degraded: 'text-orange-600',
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
  resolved: 'bg-gray-50 text-gray-600 border-gray-200',
};

function MetricBar({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const v = Math.max(0, Math.min(100, value || 0));
  const color = v >= 85 ? 'bg-red-500' : v >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          {icon}
          {label}
        </div>
        <span className="text-sm font-semibold text-gray-900">{v.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export default function SystemDeploymentDetailPage() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [uploadingSnapshot, setUploadingSnapshot] = useState(false);
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSnapshots = async () => {
    if (!deploymentId) return;
    try {
      const res = await api.get<any[]>(`/deployments/${deploymentId}/snapshots`);
      setSnapshots(Array.isArray(res.data) ? res.data : (res.data as any)?.data || []);
    } catch (e) {
      // non-fatal
      setSnapshots([]);
    }
  };

  const load = async (silent = false) => {
    if (!deploymentId) return;
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get<DetailResponse>(`/deployments/${deploymentId}/detail`);
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load deployment detail');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    loadSnapshots();
  }, [deploymentId]);

  const onSnapshotFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !deploymentId) return;
    setUploadingSnapshot(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (snapshotNotes.trim()) fd.append('notes', snapshotNotes.trim());
      await api.post(`/deployments/${deploymentId}/snapshots`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Imported ${file.name}`);
      setSnapshotNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadSnapshots();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Snapshot upload failed');
    } finally {
      setUploadingSnapshot(false);
    }
  };

  const downloadSnapshot = async (snapshotId: string, filename: string) => {
    try {
      const res = await api.get(`/deployments/snapshots/${snapshotId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to download snapshot');
    }
  };

  const downloadInstaller = async () => {
    if (!deploymentId) return;
    try {
      const res = await api.get(`/deployments/${deploymentId}/installer-bundle`, { responseType: 'blob' });
      const cd: string = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `glide-hims-bootstrap-${deploymentId}.sh`;
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Installer bundle downloaded');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to download installer');
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await api.put(`/deployments/alerts/${alertId}/resolve`);
      toast.success('Alert resolved');
      load(true);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to resolve alert');
    }
  };

  const [connectivity, setConnectivity] = useState<{
    reachable: boolean;
    statusCode: number | null;
    latencyMs: number | null;
    target: string | null;
    error?: string;
    checkedAt: string;
  } | null>(null);
  const [testingConnectivity, setTestingConnectivity] = useState(false);

  const testConnectivity = async () => {
    if (!deploymentId) return;
    setTestingConnectivity(true);
    try {
      const res = await api.post(`/deployments/${deploymentId}/test-connectivity`);
      setConnectivity(res.data);
      if (res.data.reachable) {
        toast.success(`Reachable in ${res.data.latencyMs}ms`);
      } else {
        toast.error(res.data.error || 'Not reachable');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Connectivity test failed');
    } finally {
      setTestingConnectivity(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-700 font-medium">Could not load deployment</p>
        <p className="text-red-600 text-sm mt-1">{error || 'No data'}</p>
        <button
          onClick={() => load()}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const { deployment, health, alerts } = data;
  const latest = health.latest;
  const openAlerts = alerts.filter((a) => a.status === 'open');

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <button
        onClick={() => navigate('/system/deployments')}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to deployments
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="w-6 h-6 text-blue-600" />
            {deployment.organizationName}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[deployment.status] || 'bg-gray-100 text-gray-700'}`}>
              {deployment.status}
            </span>
            <span className="text-gray-500 capitalize">{deployment.type}</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500 font-mono text-xs">v{deployment.currentVersion}</span>
            {deployment.tenant && (
              <>
                <span className="text-gray-400">•</span>
                <Link
                  to={`/system/tenants?tenantId=${deployment.tenant.id}`}
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {deployment.tenant.name}
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={testConnectivity}
            disabled={testingConnectivity}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {testingConnectivity ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : connectivity?.reachable ? (
              <Wifi className="w-4 h-4 text-green-600" />
            ) : connectivity ? (
              <WifiOff className="w-4 h-4 text-red-600" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            Test connectivity
          </button>
          <button
            onClick={downloadInstaller}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Installer
          </button>
        </div>
      </div>

      {connectivity && (
        <div className={`border rounded-lg p-3 mt-2 text-sm flex items-start gap-3 ${
          connectivity.reachable
            ? 'bg-green-50 border-green-200 text-green-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          {connectivity.reachable ? (
            <Wifi className="w-5 h-5 mt-0.5 shrink-0" />
          ) : (
            <WifiOff className="w-5 h-5 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {connectivity.reachable
                ? `Reachable · ${connectivity.statusCode} · ${connectivity.latencyMs}ms`
                : `Not reachable${connectivity.statusCode ? ` (HTTP ${connectivity.statusCode})` : ''}`}
            </p>
            {connectivity.target && (
              <p className="text-xs font-mono opacity-75 truncate">→ {connectivity.target}</p>
            )}
            {connectivity.error && (
              <p className="text-xs opacity-90 mt-0.5">{connectivity.error}</p>
            )}
            <p className="text-xs opacity-70 mt-0.5">
              Checked {new Date(connectivity.checkedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => setConnectivity(null)}
            className="text-xs underline opacity-75 hover:opacity-100 shrink-0"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Health metrics */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Health
          </h2>
          {latest ? (
            <div className="flex items-center gap-2 text-sm">
              <span className={`font-medium capitalize ${HEALTH_COLORS[latest.status] || 'text-gray-600'}`}>
                {latest.status}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500 text-xs">
                {new Date(latest.createdAt).toLocaleString()}
              </span>
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">No samples yet</span>
          )}
        </div>
        {latest ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricBar label="CPU" value={latest.cpuUsagePercent} icon={<Cpu className="w-4 h-4" />} />
            <MetricBar label="Memory" value={latest.memoryUsagePercent} icon={<Database className="w-4 h-4" />} />
            <MetricBar label="Disk" value={latest.diskUsagePercent} icon={<HardDrive className="w-4 h-4" />} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 inline-flex items-center gap-1.5">
                <Power className="w-4 h-4" />
                Uptime
              </span>
              <span className="text-sm font-semibold text-gray-900">{(latest.uptimePercentage || 0).toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 inline-flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Error rate
              </span>
              <span className="text-sm font-semibold text-gray-900">{(latest.errorRatePercent || 0).toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Last heartbeat
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {deployment.lastHealthCheck
                  ? new Date(deployment.lastHealthCheck).toLocaleString()
                  : '—'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-6 text-center">
            Waiting for the deployment to phone home with health metrics.
          </p>
        )}
      </div>

      {/* Heartbeat history */}
      {health.history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Recent heartbeats
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">CPU</th>
                  <th className="py-2 pr-4 text-right">Mem</th>
                  <th className="py-2 pr-4 text-right">Disk</th>
                  <th className="py-2 pr-4 text-right">Errors</th>
                  <th className="py-2 text-right">Uptime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {health.history.slice(0, 20).map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 pr-4 text-gray-600 text-xs">
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs font-medium capitalize ${HEALTH_COLORS[h.status] || 'text-gray-600'}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">{(h.cpuUsagePercent || 0).toFixed(1)}%</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{(h.memoryUsagePercent || 0).toFixed(1)}%</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{(h.diskUsagePercent || 0).toFixed(1)}%</td>
                    <td className="py-2 pr-4 text-right text-gray-700">{(h.errorRatePercent || 0).toFixed(2)}%</td>
                    <td className="py-2 text-right text-gray-700">{(h.uptimePercentage || 0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alerts
          </h2>
          <span className="text-xs text-gray-500">
            {openAlerts.length} open / {alerts.length} total
          </span>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center inline-flex items-center justify-center gap-2 w-full">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            No alerts on file
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 20).map((a) => (
              <div
                key={a.id}
                className={`border rounded-lg px-3 py-2 flex items-center justify-between ${SEVERITY_COLORS[a.severity] || 'bg-gray-50 border-gray-200'}`}
              >
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs opacity-75">
                    {a.severity} · {a.status} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
                {a.status === 'open' && (
                  <button
                    onClick={() => resolveAlert(a.id)}
                    className="text-xs font-medium px-2 py-1 bg-white border border-current rounded hover:bg-opacity-50"
                  >
                    Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* License + meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            License
          </h2>
          {deployment.license ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Key</dt>
                <dd className="font-mono text-xs text-gray-900 truncate max-w-[60%]" title={deployment.license.licenseKey}>
                  {deployment.license.licenseKey}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-900 capitalize">{deployment.license.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Type</dt>
                <dd><TierBadge tier={deployment.license.licenseType} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Max users</dt>
                <dd className="text-gray-900">{deployment.license.maxUsers}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Issued</dt>
                <dd className="text-gray-900">{new Date(deployment.license.issuedAt).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Expires</dt>
                <dd className="text-gray-900">{new Date(deployment.license.expiresAt).toLocaleDateString()}</dd>
              </div>
              {deployment.license.hardwareId && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Hardware ID</dt>
                  <dd className="font-mono text-xs text-gray-900 truncate max-w-[60%]">{deployment.license.hardwareId}</dd>
                </div>
              )}
              {deployment.license.lastValidatedAt && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Last validated</dt>
                  <dd className="text-gray-900 text-xs">{new Date(deployment.license.lastValidatedAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-500 italic">No license attached</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Deployment metadata
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Tier</dt>
              <dd><TierBadge tier={deployment.tier} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Max users</dt>
              <dd className="text-gray-900">{deployment.maxUsers || '—'}</dd>
            </div>
            {deployment.domain && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Domain</dt>
                <dd>
                  <a
                    href={`https://${deployment.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    {deployment.domain} <ExternalLink className="w-3 h-3" />
                  </a>
                </dd>
              </div>
            )}
            {deployment.apiEndpoint && (
              <div className="flex justify-between">
                <dt className="text-gray-500">API endpoint</dt>
                <dd className="font-mono text-xs text-gray-900 truncate max-w-[60%]">{deployment.apiEndpoint}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-900">{new Date(deployment.createdAt).toLocaleString()}</dd>
            </div>
            {deployment.lastSync && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Last sync</dt>
                <dd className="text-gray-900">{new Date(deployment.lastSync).toLocaleString()}</dd>
              </div>
            )}
            {deployment.notes && (
              <div className="pt-2 border-t border-gray-100">
                <dt className="text-gray-500 text-xs uppercase mb-1">Notes</dt>
                <dd className="text-gray-700 text-sm whitespace-pre-wrap">{deployment.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Snapshots panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <FileArchive className="w-4 h-4" />
            Snapshots & Backups
          </h2>
          <span className="text-xs text-gray-500">
            For standalone/on-premise deployments — upload tenant database snapshots to keep an off-site copy.
          </span>
        </div>

        <div className="border border-dashed border-gray-300 rounded-lg p-4 mb-4 bg-gray-50">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              type="text"
              value={snapshotNotes}
              onChange={(e) => setSnapshotNotes(e.target.value)}
              placeholder="Notes (e.g. weekly backup, pre-upgrade checkpoint)"
              className="flex-1 px-3 py-2 border border-gray-200 rounded text-sm bg-white"
            />
            <input
              ref={fileInputRef}
              type="file"
              onChange={onSnapshotFile}
              disabled={uploadingSnapshot}
              className="hidden"
              id="snapshot-upload-input"
            />
            <label
              htmlFor="snapshot-upload-input"
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded text-sm font-medium cursor-pointer ${
                uploadingSnapshot
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {uploadingSnapshot ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload snapshot</>
              )}
            </label>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-500 italic text-center py-4">
            No snapshots imported yet for this tenant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">Filename</th>
                  <th className="text-left px-3 py-2">Size</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Notes</th>
                  <th className="text-left px-3 py-2">Created</th>
                  <th className="text-right px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-800 truncate max-w-[280px]">{s.filename}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {s.sizeBytes ? `${(Number(s.sizeBytes) / 1024).toFixed(1)} KB` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        s.status === 'completed' ? 'bg-green-100 text-green-800'
                          : s.status === 'failed' ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[200px]">{s.notes || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{new Date(s.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => downloadSnapshot(s.id, s.filename)}
                        className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 rounded text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
