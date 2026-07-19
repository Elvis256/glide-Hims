import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2, ClipboardCheck } from 'lucide-react';
import { surgeryService } from '../../services/surgery';
import { getApiErrorMessage } from '../../services/api';

const STANDARD_ITEMS = [
  'Informed consent signed and filed',
  'Patient identity and procedure confirmed',
  'Surgical site marked',
  'Fasting (NPO) status confirmed',
  'Allergies reviewed',
  'Pre-op vitals recorded',
  'Required blood tests available',
  'Anesthesia review done',
];

interface Props {
  caseId: string;
  caseNumber: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function PreOpModal({ caseId, caseNumber, onClose, onSaved }: Props) {
  const [items, setItems] = useState(
    STANDARD_ITEMS.map((item) => ({ item, checked: false })),
  );
  const [consentSigned, setConsentSigned] = useState(false);
  const [bloodAvailable, setBloodAvailable] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('');
  const [notes, setNotes] = useState('');

  const allChecked = items.every((i) => i.checked);

  const mutation = useMutation({
    mutationFn: () =>
      surgeryService.cases.updatePreOp(caseId, {
        checklist: items,
        consentSigned,
        bloodAvailable,
        bloodGroup: bloodAvailable ? bloodGroup || undefined : undefined,
        preOpNotes: notes || undefined,
      } as any),
    onSuccess: () => {
      toast.success('Pre-op checklist saved — case moved to Pre-Op');
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save pre-op checklist')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-yellow-600" />
            Pre-Op Checklist — {caseNumber}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            {items.map((it, idx) => (
              <label key={it.item} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 text-sm">
                <input
                  type="checkbox"
                  checked={it.checked}
                  onChange={() =>
                    setItems((arr) => arr.map((x, i) => (i === idx ? { ...x, checked: !x.checked } : x)))
                  }
                />
                {it.item}
              </label>
            ))}
            <button
              onClick={() => setItems((arr) => arr.map((x) => ({ ...x, checked: true })))}
              className="text-xs text-indigo-600 hover:underline"
            >
              Check all
            </button>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={consentSigned} onChange={() => setConsentSigned((v) => !v)} />
              Consent signed (required for elective cases)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={bloodAvailable} onChange={() => setBloodAvailable((v) => !v)} />
                Blood available
              </label>
              {bloodAvailable && (
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="px-2 py-1 border rounded text-sm">
                  <option value="">Group…</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g}>{g}</option>)}
                </select>
              )}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">Notes</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>

          {!allChecked && (
            <p className="text-xs text-amber-600">
              All items must be checked before the surgery can be started.
            </p>
          )}
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Checklist
          </button>
        </div>
      </div>
    </div>
  );
}
