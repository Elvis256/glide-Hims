import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Loader2, FileText } from 'lucide-react';
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link to="/system/contracts" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{contract.contractNumber}</h1>
          <p className="text-sm text-gray-500">{contract.clientName}{contract.clientOrganization ? ` — ${contract.clientOrganization}` : ''}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${CONTRACT_STATUS_STYLES[contract.status]}`}>{contract.status.replace('_', ' ')}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(contract.status === 'draft' || contract.status === 'pending_signature') && (
          <button onClick={() => handleAction('activate')} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"><Check className="w-4 h-4" /> Activate</button>
        )}
        {contract.status === 'active' && (
          <button onClick={() => handleAction('terminate')} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"><X className="w-4 h-4" /> Terminate</button>
        )}
        <a href={`/api/v1/saas-revenue/contracts/${contract.id}/html`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 border rounded text-sm hover:bg-gray-50"><FileText className="w-4 h-4" /> View PDF</a>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className="block text-xs text-gray-500 mb-1">Type</label><div className="text-sm font-medium">{contract.contractType}</div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Value</label><div className="text-sm font-medium">{fmtMoney(contract.totalValueMinor, contract.currency)}</div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Start Date</label><div className="text-sm">{fmtDate(contract.startDate)}</div></div>
          <div><label className="block text-xs text-gray-500 mb-1">End Date</label><div className="text-sm">{fmtDate(contract.endDate)}</div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Auto-Renew</label><div className="text-sm">{contract.autoRenew ? 'Yes' : 'No'}</div></div>
          <div><label className="block text-xs text-gray-500 mb-1">Renewal Notice</label><div className="text-sm">{contract.renewalNoticeDays} days</div></div>
        </div>

        {contract.termsText && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Terms & Conditions</h3>
            <div className="p-4 bg-gray-50 rounded text-sm whitespace-pre-wrap">{contract.termsText}</div>
          </div>
        )}

        {contract.signatories && contract.signatories.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Signatories</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contract.signatories.map((s, i) => (
                <div key={i} className="p-3 border rounded">
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-xs text-gray-500">{s.title} — {s.email}</div>
                  {s.signedAt ? <div className="text-xs text-emerald-600 mt-1">Signed: {fmtDate(s.signedAt)}</div> : <div className="text-xs text-amber-600 mt-1">Not yet signed</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {contract.notes && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <div className="text-sm text-gray-600">{contract.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
