import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2, Baby } from 'lucide-react';
import { maternityService } from '../../services/maternity';
import { getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';

interface Props {
  registrationId: string;
  patientName: string;
  gestationalAge: number;
  onClose: () => void;
  /** Called with the new labour id so the caller can open the partograph. */
  onAdmitted: (labourId: string) => void;
}

export default function AdmitLabourModal({ registrationId, patientName, gestationalAge, onClose, onAdmitted }: Props) {
  const facilityId = useFacilityId();
  const [form, setForm] = useState({
    gestationalAgeAtDelivery: String(Math.max(Math.floor(gestationalAge), 0) || ''),
    cervicalDilation: '',
    bpSystolic: '',
    bpDiastolic: '',
    admissionNotes: '',
  });

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () =>
      maternityService.labour.admit({
        registrationId,
        facilityId,
        gestationalAgeAtDelivery: Number(form.gestationalAgeAtDelivery),
        cervicalDilation: num(form.cervicalDilation),
        bpSystolic: num(form.bpSystolic),
        bpDiastolic: num(form.bpDiastolic),
        admissionNotes: form.admissionNotes || undefined,
      }),
    onSuccess: (res) => {
      toast.success('Admitted to labour ward — partograph opened');
      onAdmitted(res.data.id);
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to admit to labour')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Baby className="w-5 h-5 text-pink-600" />
            Admit to Labour
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{patientName}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Gestational Age (wks) *</span>
              <input type="number" min="20" max="44" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.gestationalAgeAtDelivery} onChange={set('gestationalAgeAtDelivery')} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Cervical Dilation (cm)</span>
              <input type="number" min="0" max="10" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.cervicalDilation} onChange={set('cervicalDilation')} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">BP Systolic</span>
              <input type="number" min="40" max="300" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.bpSystolic} onChange={set('bpSystolic')} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">BP Diastolic</span>
              <input type="number" min="20" max="200" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.bpDiastolic} onChange={set('bpDiastolic')} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Admission Notes</span>
            <textarea rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.admissionNotes} onChange={set('admissionNotes')} />
          </label>
        </div>
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.gestationalAgeAtDelivery || mutation.isPending}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Admit
          </button>
        </div>
      </div>
    </div>
  );
}
