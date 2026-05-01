import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, RefreshCw, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';

/**
 * EFRIS (URA e-invoicing) configuration & outbox monitoring.
 * Tenants enable submission per-environment and can replay failed documents.
 */

interface EfrisConfig {
  id?: string;
  tinNumber?: string;
  taxpayerName?: string;
  branchCode?: string;
  environment?: 'sandbox' | 'production';
  apiBaseUrl?: string;
  apiKey?: string;
  isEnabled?: boolean;
  submitOnCompletion?: boolean;
  defaultCurrency?: string;
  notes?: string;
}

interface EfrisDocument {
  id: string;
  saleId?: string;
  documentType: string;
  status: string;
  efrisDocumentNumber?: string;
  attemptCount: number;
  lastError?: string;
  submittedAt?: string;
  acceptedAt?: string;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending_submission: 'bg-yellow-100 text-yellow-800',
  submitting: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  failed: 'bg-red-100 text-red-800',
};

export default function EfrisConfigPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EfrisConfig>({});
  const [statusFilter, setStatusFilter] = useState('');

  const { data: cfg, isLoading } = useQuery<EfrisConfig | null>({
    queryKey: ['efris-config'],
    queryFn: async () => {
      const res = await api.get('/efris/config');
      return res.data ?? null;
    },
  });

  useEffect(() => {
    if (cfg) setForm(cfg);
  }, [cfg]);

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['efris-documents', statusFilter],
    queryFn: async () => {
      const res = await api.get('/efris/documents', {
        params: statusFilter ? { status: statusFilter } : {},
      });
      return res.data;
    },
  });
  const docs: EfrisDocument[] = Array.isArray(docsData) ? docsData : (docsData?.data ?? []);

  const saveMutation = useMutation({
    mutationFn: async (payload: EfrisConfig) => {
      const res = await api.put('/efris/config', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['efris-config'] });
      toast.success('EFRIS configuration saved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save EFRIS config')),
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/efris/documents/${id}/retry`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['efris-documents'] });
      toast.success('Document re-queued for submission');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Retry failed')),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">EFRIS (URA e-Invoicing)</h1>
        <p className="text-sm text-gray-500">
          Configure URA fiscal device credentials and monitor invoice submissions.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-900">Configuration</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="TIN Number">
            <input
              className="input"
              value={form.tinNumber || ''}
              onChange={(e) => setForm({ ...form, tinNumber: e.target.value })}
              placeholder="1000000000"
            />
          </Field>
          <Field label="Taxpayer Name">
            <input
              className="input"
              value={form.taxpayerName || ''}
              onChange={(e) => setForm({ ...form, taxpayerName: e.target.value })}
            />
          </Field>
          <Field label="Branch Code">
            <input
              className="input"
              value={form.branchCode || ''}
              onChange={(e) => setForm({ ...form, branchCode: e.target.value })}
            />
          </Field>
          <Field label="Environment">
            <select
              className="input"
              value={form.environment || 'sandbox'}
              onChange={(e) =>
                setForm({ ...form, environment: e.target.value as 'sandbox' | 'production' })
              }
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </Field>
          <Field label="API Base URL">
            <input
              className="input"
              value={form.apiBaseUrl || ''}
              onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })}
              placeholder="https://efris.ura.go.ug/efris/..."
            />
          </Field>
          <Field label="API Key / Secret">
            <input
              type="password"
              className="input"
              value={form.apiKey || ''}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="(stored encrypted)"
            />
          </Field>
          <Field label="Default Currency">
            <input
              className="input"
              value={form.defaultCurrency || 'UGX'}
              onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <Toggle
            label="Enable EFRIS submission"
            checked={!!form.isEnabled}
            onChange={(v) => setForm({ ...form, isEnabled: v })}
          />
          <Toggle
            label="Auto-submit on sale completion"
            checked={!!form.submitOnCompletion}
            onChange={(v) => setForm({ ...form, submitOnCompletion: v })}
          />
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Configuration
          </button>
        </div>
      </div>

      {/* Documents */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="font-semibold text-gray-900">Submission Outbox</h3>
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending_submission">Pending</option>
            <option value="submitting">Submitting</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        {docsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : docs.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p>No EFRIS documents yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-6 py-3">Created</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">EFRIS #</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-center">Attempts</th>
                  <th className="px-6 py-3">Last Error</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-3 text-gray-700">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 uppercase text-gray-700">{d.documentType}</td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-600">
                      {d.efrisDocumentNumber || '—'}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[d.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {d.status === 'accepted' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : d.status === 'failed' || d.status === 'rejected' ? (
                          <AlertCircle className="h-3 w-3" />
                        ) : null}
                        {d.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center text-gray-700">{d.attemptCount}</td>
                    <td className="max-w-xs truncate px-6 py-3 text-xs text-red-600">
                      {d.lastError || ''}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {(d.status === 'failed' || d.status === 'rejected') && (
                        <button
                          onClick={() => retryMutation.mutate(d.id)}
                          disabled={retryMutation.isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid #d1d5db;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none}.input:focus{border-color:#3b82f6;box-shadow:0 0 0 1px #3b82f6}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}
