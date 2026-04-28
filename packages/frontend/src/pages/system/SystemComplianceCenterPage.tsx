import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, Siren, DatabaseBackup, KeyRound, FileBarChart2, Download } from 'lucide-react';
import api from '../../services/api';

type VulnerabilityRecord = {
  id: string;
  discoveredDate: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  component: string;
  status: 'open' | 'in_progress' | 'mitigated' | 'closed';
  owner: string;
};

type IncidentRecord = {
  id: string;
  detectedAt: string;
  severity: 'p1' | 'p2' | 'p3' | 'p4';
  service: string;
  summary: string;
  status: 'open' | 'monitoring' | 'resolved';
};

type BackupRecord = {
  id: string;
  recordDate: string;
  environment: 'production' | 'staging' | 'drill';
  backupStatus: 'success' | 'failed';
  restoreTested: 'yes' | 'no';
  restoreDurationMinutes: number;
};

type AccessReviewRecord = {
  id: string;
  reviewDate: string;
  environment: 'production' | 'staging';
  privilegedAccounts: number;
  accountsRevoked: number;
  reviewOwner: string;
};

type SLARecord = {
  id: string;
  month: string;
  availabilityPercent: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  p4Count: number;
};

// (legacy STORAGE_KEYS removed; data now lives in /api/v1/compliance/:type)

const RECORD_TYPES = {
  vulnerabilities: 'vulnerability',
  incidents: 'incident',
  backups: 'backup',
  accessReviews: 'access_review',
  sla: 'sla',
} as const;

function useApiRecords<T extends { id: string }>(recordType: string, defaultValue: T[]) {
  const [records, setRecords] = useState<T[]>(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/compliance/${recordType}`)
      .then((r) => {
        if (cancelled) return;
        const items = (r.data?.data || []).map((row: any) => ({ id: row.id, ...row.payload }));
        setRecords(items);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [recordType]);

  const add = async (record: T) => {
    const { id, ...payload } = record as any;
    void id;
    const resp = await api.post(`/compliance/${recordType}`, payload);
    const created = { id: resp.data.id, ...resp.data.payload } as T;
    setRecords((prev) => [created, ...prev]);
  };

  const clear = async () => {
    await Promise.all(records.map((r) => api.delete(`/compliance/${recordType}/${r.id}`)));
    setRecords([]);
  };

  return { records, add, clear, loading };
}

function StatusPill({ value }: { value: string }) {
  const style = value.includes('open') || value.includes('failed') || value.includes('critical') || value.includes('p1')
    ? 'bg-red-100 text-red-700'
    : value.includes('progress') || value.includes('monitoring') || value.includes('high') || value.includes('p2')
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-emerald-100 text-emerald-700';

  return <span className={`px-2 py-1 text-xs rounded-full font-medium ${style}`}>{value}</span>;
}

export default function SystemComplianceCenterPage() {
  const vulnerabilities = useApiRecords<VulnerabilityRecord>(RECORD_TYPES.vulnerabilities, []);
  const incidents = useApiRecords<IncidentRecord>(RECORD_TYPES.incidents, []);
  const backups = useApiRecords<BackupRecord>(RECORD_TYPES.backups, []);
  const accessReviews = useApiRecords<AccessReviewRecord>(RECORD_TYPES.accessReviews, []);
  const sla = useApiRecords<SLARecord>(RECORD_TYPES.sla, []);

  const [vulnForm, setVulnForm] = useState({ severity: 'high', component: '', status: 'open', owner: '' });
  const [incidentForm, setIncidentForm] = useState({ severity: 'p2', service: '', summary: '', status: 'open' });
  const [backupForm, setBackupForm] = useState({ environment: 'production', backupStatus: 'success', restoreTested: 'yes', restoreDurationMinutes: 30 });
  const [accessForm, setAccessForm] = useState({ environment: 'production', privilegedAccounts: 0, accountsRevoked: 0, reviewOwner: '' });
  const [slaForm, setSlaForm] = useState({ month: new Date().toISOString().slice(0, 7), availabilityPercent: 99.5, p1Count: 0, p2Count: 0, p3Count: 0, p4Count: 0 });

  const metrics = useMemo(() => {
    const openVulns = vulnerabilities.records.filter((v) => v.status !== 'closed').length;
    const openIncidents = incidents.records.filter((i) => i.status !== 'resolved').length;
    const failedBackups = backups.records.filter((b) => b.backupStatus === 'failed').length;
    const latestSla = sla.records[0]?.availabilityPercent ?? 0;

    return { openVulns, openIncidents, failedBackups, latestSla };
  }, [vulnerabilities.records, incidents.records, backups.records, sla.records]);

  const addVulnerability = () => {
    if (!vulnForm.component || !vulnForm.owner) return;
    vulnerabilities.add({
      id: `VULN-${Date.now()}`,
      discoveredDate: new Date().toISOString(),
      severity: vulnForm.severity as VulnerabilityRecord['severity'],
      component: vulnForm.component,
      status: vulnForm.status as VulnerabilityRecord['status'],
      owner: vulnForm.owner,
    });
    setVulnForm({ severity: 'high', component: '', status: 'open', owner: '' });
  };

  const addIncident = () => {
    if (!incidentForm.service || !incidentForm.summary) return;
    incidents.add({
      id: `INC-${Date.now()}`,
      detectedAt: new Date().toISOString(),
      severity: incidentForm.severity as IncidentRecord['severity'],
      service: incidentForm.service,
      summary: incidentForm.summary,
      status: incidentForm.status as IncidentRecord['status'],
    });
    setIncidentForm({ severity: 'p2', service: '', summary: '', status: 'open' });
  };

  const addBackupEvidence = () => {
    backups.add({
      id: `BKP-${Date.now()}`,
      recordDate: new Date().toISOString(),
      environment: backupForm.environment as BackupRecord['environment'],
      backupStatus: backupForm.backupStatus as BackupRecord['backupStatus'],
      restoreTested: backupForm.restoreTested as BackupRecord['restoreTested'],
      restoreDurationMinutes: Number(backupForm.restoreDurationMinutes),
    });
  };

  const addAccessReview = () => {
    if (!accessForm.reviewOwner) return;
    accessReviews.add({
      id: `ACR-${Date.now()}`,
      reviewDate: new Date().toISOString(),
      environment: accessForm.environment as AccessReviewRecord['environment'],
      privilegedAccounts: Number(accessForm.privilegedAccounts),
      accountsRevoked: Number(accessForm.accountsRevoked),
      reviewOwner: accessForm.reviewOwner,
    });
  };

  const addSlaRecord = () => {
    sla.add({
      id: `SLA-${Date.now()}`,
      month: slaForm.month,
      availabilityPercent: Number(slaForm.availabilityPercent),
      p1Count: Number(slaForm.p1Count),
      p2Count: Number(slaForm.p2Count),
      p3Count: Number(slaForm.p3Count),
      p4Count: Number(slaForm.p4Count),
    });
  };

  const exportEvidence = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      vulnerabilities: vulnerabilities.records,
      incidents: incidents.records,
      backups: backups.records,
      accessReviews: accessReviews.records,
      sla: sla.records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-evidence-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Center</h1>
          <p className="text-gray-600">Auditor-facing evidence dashboard for security, operations, and SLA controls.</p>
        </div>
        <button onClick={exportEvidence} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Download className="h-4 w-4" />
          Export Evidence
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4"><div className="flex items-center gap-2 text-gray-600"><AlertTriangle className="h-4 w-4" />Open Vulnerabilities</div><div className="text-2xl font-bold mt-2">{metrics.openVulns}</div></div>
        <div className="bg-white rounded-lg border p-4"><div className="flex items-center gap-2 text-gray-600"><Siren className="h-4 w-4" />Open Incidents</div><div className="text-2xl font-bold mt-2">{metrics.openIncidents}</div></div>
        <div className="bg-white rounded-lg border p-4"><div className="flex items-center gap-2 text-gray-600"><DatabaseBackup className="h-4 w-4" />Failed Backups</div><div className="text-2xl font-bold mt-2">{metrics.failedBackups}</div></div>
        <div className="bg-white rounded-lg border p-4"><div className="flex items-center gap-2 text-gray-600"><ShieldCheck className="h-4 w-4" />Latest SLA %</div><div className="text-2xl font-bold mt-2">{metrics.latestSla || '—'}</div></div>
      </div>

      <section className="bg-white rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Vulnerability Register</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select value={vulnForm.severity} onChange={(e) => setVulnForm({ ...vulnForm, severity: e.target.value })} className="border rounded px-2 py-2"><option value="critical">critical</option><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select>
          <input placeholder="Component" value={vulnForm.component} onChange={(e) => setVulnForm({ ...vulnForm, component: e.target.value })} className="border rounded px-2 py-2" />
          <select value={vulnForm.status} onChange={(e) => setVulnForm({ ...vulnForm, status: e.target.value })} className="border rounded px-2 py-2"><option value="open">open</option><option value="in_progress">in_progress</option><option value="mitigated">mitigated</option><option value="closed">closed</option></select>
          <input placeholder="Owner" value={vulnForm.owner} onChange={(e) => setVulnForm({ ...vulnForm, owner: e.target.value })} className="border rounded px-2 py-2" />
          <button onClick={addVulnerability} className="bg-gray-900 text-white rounded px-3 py-2">Add</button>
        </div>
        <div className="space-y-2 max-h-44 overflow-auto">
          {vulnerabilities.records.map((r) => (<div key={r.id} className="flex items-center justify-between border rounded p-2 text-sm"><div><div className="font-medium">{r.id} · {r.component}</div><div className="text-gray-500">{new Date(r.discoveredDate).toLocaleString()} · owner: {r.owner}</div></div><div className="flex gap-2"><StatusPill value={r.severity} /><StatusPill value={r.status} /></div></div>))}
          {vulnerabilities.records.length === 0 && <p className="text-sm text-gray-500">No vulnerability records yet.</p>}
        </div>
      </section>

      <section className="bg-white rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Siren className="h-4 w-4" />Incident Register</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <select value={incidentForm.severity} onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })} className="border rounded px-2 py-2"><option value="p1">p1</option><option value="p2">p2</option><option value="p3">p3</option><option value="p4">p4</option></select>
          <input placeholder="Service" value={incidentForm.service} onChange={(e) => setIncidentForm({ ...incidentForm, service: e.target.value })} className="border rounded px-2 py-2" />
          <input placeholder="Summary" value={incidentForm.summary} onChange={(e) => setIncidentForm({ ...incidentForm, summary: e.target.value })} className="border rounded px-2 py-2 md:col-span-2" />
          <button onClick={addIncident} className="bg-gray-900 text-white rounded px-3 py-2">Add</button>
        </div>
        <div className="space-y-2 max-h-44 overflow-auto">
          {incidents.records.map((r) => (<div key={r.id} className="flex items-center justify-between border rounded p-2 text-sm"><div><div className="font-medium">{r.id} · {r.service}</div><div className="text-gray-500">{r.summary}</div></div><div className="flex gap-2"><StatusPill value={r.severity} /><StatusPill value={r.status} /></div></div>))}
          {incidents.records.length === 0 && <p className="text-sm text-gray-500">No incident records yet.</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><DatabaseBackup className="h-4 w-4" />Backup/Restore Evidence</h2>
          <div className="grid grid-cols-2 gap-2">
            <select value={backupForm.environment} onChange={(e) => setBackupForm({ ...backupForm, environment: e.target.value })} className="border rounded px-2 py-2"><option value="production">production</option><option value="staging">staging</option><option value="drill">drill</option></select>
            <select value={backupForm.backupStatus} onChange={(e) => setBackupForm({ ...backupForm, backupStatus: e.target.value })} className="border rounded px-2 py-2"><option value="success">success</option><option value="failed">failed</option></select>
            <select value={backupForm.restoreTested} onChange={(e) => setBackupForm({ ...backupForm, restoreTested: e.target.value })} className="border rounded px-2 py-2"><option value="yes">yes</option><option value="no">no</option></select>
            <input type="number" min={0} value={backupForm.restoreDurationMinutes} onChange={(e) => setBackupForm({ ...backupForm, restoreDurationMinutes: Number(e.target.value) })} className="border rounded px-2 py-2" placeholder="Restore mins" />
            <button onClick={addBackupEvidence} className="col-span-2 bg-gray-900 text-white rounded px-3 py-2">Add Backup Evidence</button>
          </div>
          <div className="space-y-2 max-h-44 overflow-auto">
            {backups.records.map((r) => (<div key={r.id} className="flex items-center justify-between border rounded p-2 text-sm"><div><div className="font-medium">{r.environment} · {new Date(r.recordDate).toLocaleDateString()}</div><div className="text-gray-500">restore: {r.restoreTested} ({r.restoreDurationMinutes} min)</div></div><StatusPill value={r.backupStatus} /></div>))}
            {backups.records.length === 0 && <p className="text-sm text-gray-500">No backup evidence records yet.</p>}
          </div>
        </section>

        <section className="bg-white rounded-lg border p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><KeyRound className="h-4 w-4" />Access Reviews</h2>
          <div className="grid grid-cols-2 gap-2">
            <select value={accessForm.environment} onChange={(e) => setAccessForm({ ...accessForm, environment: e.target.value })} className="border rounded px-2 py-2"><option value="production">production</option><option value="staging">staging</option></select>
            <input type="number" min={0} placeholder="Privileged accounts" value={accessForm.privilegedAccounts} onChange={(e) => setAccessForm({ ...accessForm, privilegedAccounts: Number(e.target.value) })} className="border rounded px-2 py-2" />
            <input type="number" min={0} placeholder="Accounts revoked" value={accessForm.accountsRevoked} onChange={(e) => setAccessForm({ ...accessForm, accountsRevoked: Number(e.target.value) })} className="border rounded px-2 py-2" />
            <input placeholder="Review owner" value={accessForm.reviewOwner} onChange={(e) => setAccessForm({ ...accessForm, reviewOwner: e.target.value })} className="border rounded px-2 py-2" />
            <button onClick={addAccessReview} className="col-span-2 bg-gray-900 text-white rounded px-3 py-2">Add Access Review</button>
          </div>
          <div className="space-y-2 max-h-44 overflow-auto">
            {accessReviews.records.map((r) => (<div key={r.id} className="border rounded p-2 text-sm"><div className="font-medium">{r.environment} · {new Date(r.reviewDate).toLocaleDateString()}</div><div className="text-gray-500">accounts: {r.privilegedAccounts}, revoked: {r.accountsRevoked}, owner: {r.reviewOwner}</div></div>))}
            {accessReviews.records.length === 0 && <p className="text-sm text-gray-500">No access review records yet.</p>}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-lg border p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><FileBarChart2 className="h-4 w-4" />SLA Monthly Evidence</h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
          <input type="month" value={slaForm.month} onChange={(e) => setSlaForm({ ...slaForm, month: e.target.value })} className="border rounded px-2 py-2" />
          <input type="number" step="0.01" value={slaForm.availabilityPercent} onChange={(e) => setSlaForm({ ...slaForm, availabilityPercent: Number(e.target.value) })} className="border rounded px-2 py-2" placeholder="Availability %" />
          <input type="number" min={0} value={slaForm.p1Count} onChange={(e) => setSlaForm({ ...slaForm, p1Count: Number(e.target.value) })} className="border rounded px-2 py-2" placeholder="P1" />
          <input type="number" min={0} value={slaForm.p2Count} onChange={(e) => setSlaForm({ ...slaForm, p2Count: Number(e.target.value) })} className="border rounded px-2 py-2" placeholder="P2" />
          <input type="number" min={0} value={slaForm.p3Count} onChange={(e) => setSlaForm({ ...slaForm, p3Count: Number(e.target.value) })} className="border rounded px-2 py-2" placeholder="P3" />
          <input type="number" min={0} value={slaForm.p4Count} onChange={(e) => setSlaForm({ ...slaForm, p4Count: Number(e.target.value) })} className="border rounded px-2 py-2" placeholder="P4" />
          <button onClick={addSlaRecord} className="bg-gray-900 text-white rounded px-3 py-2">Add SLA</button>
        </div>
        <div className="space-y-2 max-h-44 overflow-auto">
          {sla.records.map((r) => (<div key={r.id} className="border rounded p-2 text-sm flex items-center justify-between"><div className="font-medium">{r.month} · availability {r.availabilityPercent}%</div><div className="text-gray-500">P1:{r.p1Count} P2:{r.p2Count} P3:{r.p3Count} P4:{r.p4Count}</div></div>))}
          {sla.records.length === 0 && <p className="text-sm text-gray-500">No SLA evidence records yet.</p>}
        </div>
      </section>

      <div className="flex gap-2">
        <button onClick={() => vulnerabilities.clear()} className="px-3 py-2 rounded border text-sm">Clear Vulnerabilities</button>
        <button onClick={() => incidents.clear()} className="px-3 py-2 rounded border text-sm">Clear Incidents</button>
        <button onClick={() => backups.clear()} className="px-3 py-2 rounded border text-sm">Clear Backup Evidence</button>
        <button onClick={() => accessReviews.clear()} className="px-3 py-2 rounded border text-sm">Clear Access Reviews</button>
        <button onClick={() => sla.clear()} className="px-3 py-2 rounded border text-sm">Clear SLA</button>
      </div>
    </div>
  );
}
