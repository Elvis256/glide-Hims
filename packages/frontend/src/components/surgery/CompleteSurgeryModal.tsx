import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2, CheckCircle } from 'lucide-react';
import { surgeryService } from '../../services/surgery';
import { getApiErrorMessage } from '../../services/api';

interface Props {
  caseId: string;
  caseNumber: string;
  onClose: () => void;
  onCompleted: () => void;
}

export default function CompleteSurgeryModal({ caseId, caseNumber, onClose, onCompleted }: Props) {
  const [form, setForm] = useState({
    operativeFindings: '',
    operativeNotes: '',
    bloodLossMl: '',
    postOpDiagnosis: '',
    postOpInstructions: '',
    dischargeDestination: 'Recovery ward',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      surgeryService.cases.complete(caseId, {
        operativeFindings: form.operativeFindings,
        operativeNotes: form.operativeNotes,
        bloodLossMl: form.bloodLossMl ? Number(form.bloodLossMl) : undefined,
        postOpDiagnosis: form.postOpDiagnosis || undefined,
        postOpInstructions: form.postOpInstructions || undefined,
        dischargeDestination: form.dischargeDestination,
      } as any),
    onSuccess: () => {
      toast.success('Surgery completed — patient in post-op recovery');
      onCompleted();
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to complete surgery')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-purple-600" />
            Complete Surgery — {caseNumber}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Operative Findings *</span>
            <textarea rows={2} value={form.operativeFindings} onChange={set('operativeFindings')} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Operative Notes *</span>
            <textarea rows={3} value={form.operativeNotes} onChange={set('operativeNotes')} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Blood Loss (ml)</span>
              <input type="number" min="0" value={form.bloodLossMl} onChange={set('bloodLossMl')} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Destination *</span>
              <select value={form.dischargeDestination} onChange={set('dischargeDestination')} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                <option>Recovery ward</option>
                <option>ICU</option>
                <option>General ward</option>
                <option>Home (day case)</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Post-Op Diagnosis</span>
            <input value={form.postOpDiagnosis} onChange={set('postOpDiagnosis')} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Post-Op Instructions</span>
            <textarea rows={2} value={form.postOpInstructions} onChange={set('postOpInstructions')} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.operativeFindings || !form.operativeNotes || mutation.isPending}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Complete Surgery
          </button>
        </div>
      </div>
    </div>
  );
}
