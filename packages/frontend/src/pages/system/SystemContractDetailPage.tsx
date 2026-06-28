import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Loader2, FileText, Calendar, Users, Globe, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import { Contract, CONTRACT_STATUS_STYLES, fmtMoney, fmtDate, unwrap } from './saas/_shared';

export default function SystemContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/saas-revenue/contracts/${id}`);
      setContract(unwrap<Contract>(r));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: 'activate' | 'terminate') => {
    if (!confirm(`Are you sure you want to ${action} this contract?`)) return;
    setSaving(true);
    try {
      await api.post(`/saas-revenue/contracts/${id}/${action}`);
      toast.success(`Contract ${action}d`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action}`);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!contract) return <div className="text-center py-12 text-gray-500">Contract not found</div>;

  const meta = contract.metadata || {};

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/system/contracts" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{contract.contractNumber}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${CONTRACT_STATUS_STYLES[contract.status]}`}>{contract.status.replace('_', ' ')}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {contract.clientOrganization || contract.clientName}
              {contract.clientOrganization && contract.clientName && contract.clientOrganization !== contract.clientName && ` · ${contract.clientName}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {(contract.status === 'draft' || contract.status === 'pending_signature') && (
            <button onClick={() => handleAction('activate')} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all">
              <Check className="w-4 h-4" /> Activate Contract
            </button>
          )}
          {contract.status === 'active' && (
            <button onClick={() => handleAction('terminate')} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all">
              <X className="w-4 h-4" /> Terminate
            </button>
          )}
          <a href={`/api/v1/saas-revenue/contracts/${contract.id}/html`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-semibold hover:bg-gray-50 transition-all">
            <FileText className="w-4 h-4" /> View / Print PDF
          </a>
        </div>
      </div>

      {/* Key metrics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Receipt className="w-3.5 h-3.5" /> Contract Value
          </div>
          <div className="text-lg font-bold text-gray-900">{fmtMoney(contract.totalValueMinor, contract.currency)}</div>
          {meta.billingInterval && <div className="text-xs text-gray-500 mt-0.5 capitalize">{meta.billingInterval} billing</div>}
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Calendar className="w-3.5 h-3.5" /> Contract Period
          </div>
          <div className="text-sm font-semibold text-gray-900">{fmtDate(contract.startDate)}</div>
          <div className="text-xs text-gray-500">to {fmtDate(contract.endDate)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Users className="w-3.5 h-3.5" /> Licensed Seats
          </div>
          <div className="text-lg font-bold text-gray-900">{meta.seats || '—'}</div>
          {meta.lineItemCount && <div className="text-xs text-gray-500 mt-0.5">{meta.lineItemCount} modules</div>}
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Globe className="w-3.5 h-3.5" /> Deployment
          </div>
          <div className="text-sm font-semibold text-gray-900 capitalize">{meta.deploymentType || contract.contractType?.replace('_', ' ') || '—'}</div>
          <div className="text-xs text-gray-500 mt-0.5">{contract.autoRenew ? 'Auto-renew enabled' : 'Manual renewal'}</div>
        </div>
      </div>

      {/* Cross-links */}
      {(contract.quotationId || contract.subscriptionId) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex flex-wrap gap-4">
          {contract.quotationId && (
            <Link to={`/system/quotations/${contract.quotationId}`} className="text-sm text-blue-600 hover:underline font-medium">
              View Originating Quotation {meta.quotationNumber ? `(${meta.quotationNumber})` : ''} &rarr;
            </Link>
          )}
          {contract.subscriptionId && (
            <Link to={`/system/subscriptions/${contract.subscriptionId}`} className="text-sm text-emerald-600 hover:underline font-medium">
              View Subscription &rarr;
            </Link>
          )}
        </div>
      )}

      {/* Contract details */}
      <div className="bg-white rounded-xl border p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><label className="block text-xs text-gray-500 mb-1">Contract Type</label><div className="font-medium capitalize">{contract.contractType?.replace('_', ' ')}</div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Currency</label><div className="font-medium">{contract.currency}</div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Auto-Renew</label><div className="font-medium">{contract.autoRenew ? 'Yes' : 'No'}</div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Renewal Notice</label><div className="font-medium">{contract.renewalNoticeDays} days before expiry</div></div>
        </div>

        {contract.termsText && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">Terms & Conditions</h3>
            <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed text-gray-700 font-mono text-xs max-h-[500px] overflow-y-auto">{contract.termsText}</div>
          </div>
        )}

        {contract.signatories && contract.signatories.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">Signatories</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contract.signatories.map((s, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.title} — {s.email}</div>
                  {s.signedAt
                    ? <div className="text-xs text-emerald-600 mt-1 font-semibold">Signed: {fmtDate(s.signedAt)}</div>
                    : <div className="text-xs text-amber-600 mt-1">Awaiting signature</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {contract.notes && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">Notes</h3>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">{contract.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
