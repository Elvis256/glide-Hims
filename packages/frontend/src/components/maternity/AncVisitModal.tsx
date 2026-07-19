import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { maternityService } from '../../services/maternity';
import { getApiErrorMessage } from '../../services/api';

interface Props {
  registrationId: string;
  gestationalAge: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function AncVisitModal({ registrationId, gestationalAge, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    visitDate: new Date().toISOString().slice(0, 10),
    gestationalAge: String(Math.max(Math.floor(gestationalAge), 0) || ''),
    weight: '',
    bpSystolic: '',
    bpDiastolic: '',
    fundalHeight: '',
    fetalHeartRate: '',
    fetalPresentation: '',
    fetalMovement: true,
    edema: false,
    urineProtein: false,
    urineGlucose: false,
    hemoglobin: '',
    ironFolateGiven: true,
    tetanusToxoidGiven: false,
    ttDoseNumber: '',
    iptGiven: false,
    iptDoseNumber: '',
    complaints: '',
    plan: '',
    nextVisitDate: '',
  });

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (k: keyof typeof form) => () => setForm((f) => ({ ...f, [k]: !f[k] }));

  const mutation = useMutation({
    mutationFn: () =>
      maternityService.anc.recordVisit({
        registrationId,
        visitDate: form.visitDate,
        gestationalAge: Number(form.gestationalAge),
        weight: num(form.weight),
        bpSystolic: num(form.bpSystolic),
        bpDiastolic: num(form.bpDiastolic),
        fundalHeight: num(form.fundalHeight),
        fetalHeartRate: num(form.fetalHeartRate),
        fetalPresentation: form.fetalPresentation || undefined,
        fetalMovement: form.fetalMovement,
        edema: form.edema,
        urineProtein: form.urineProtein,
        urineGlucose: form.urineGlucose,
        hemoglobin: num(form.hemoglobin),
        ironFolateGiven: form.ironFolateGiven,
        tetanusToxoidGiven: form.tetanusToxoidGiven,
        ttDoseNumber: num(form.ttDoseNumber),
        iptGiven: form.iptGiven,
        iptDoseNumber: num(form.iptDoseNumber),
        complaints: form.complaints || undefined,
        plan: form.plan || undefined,
        nextVisitDate: form.nextVisitDate || undefined,
      }),
    onSuccess: () => {
      toast.success('ANC visit recorded');
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record visit')),
  });

  const numField = (label: string, key: keyof typeof form, props: Record<string, unknown> = {}) => (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        value={form[key] as string}
        onChange={set(key)}
        {...props}
      />
    </label>
  );

  const check = (label: string, key: keyof typeof form, danger = false) => (
    <label className={`flex items-center gap-2 text-sm ${danger && form[key] ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
      <input type="checkbox" checked={form[key] as boolean} onChange={toggle(key)} />
      {label}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Record ANC Visit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Visit Date *</span>
              <input type="date" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.visitDate} onChange={set('visitDate')} />
            </label>
            {numField('Gestational Age (wks) *', 'gestationalAge', { min: 4, max: 44 })}
            {numField('Weight (kg)', 'weight', { min: 25, max: 200, step: 0.1 })}
            {numField('BP Systolic', 'bpSystolic', { min: 40, max: 300 })}
            {numField('BP Diastolic', 'bpDiastolic', { min: 20, max: 200 })}
            {numField('Fundal Height (cm)', 'fundalHeight', { min: 4, max: 50 })}
            {numField('FHR (bpm)', 'fetalHeartRate', { min: 60, max: 220 })}
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Presentation</span>
              <select className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.fetalPresentation} onChange={set('fetalPresentation')}>
                <option value="">—</option>
                <option value="cephalic">Cephalic</option>
                <option value="breech">Breech</option>
                <option value="transverse">Transverse</option>
              </select>
            </label>
            {numField('Hb (g/dL)', 'hemoglobin', { min: 2, max: 25, step: 0.1 })}
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
            {check('Fetal movement felt', 'fetalMovement')}
            {check('Oedema present', 'edema', true)}
            {check('Urine protein +', 'urineProtein', true)}
            {check('Urine glucose +', 'urineGlucose', true)}
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-pink-50 rounded-lg">
            {check('Iron/Folate given', 'ironFolateGiven')}
            <div className="flex items-center gap-2">
              {check('Tetanus toxoid (TT)', 'tetanusToxoidGiven')}
              {form.tetanusToxoidGiven && (
                <input type="number" min="1" max="5" placeholder="dose #" className="w-20 rounded border border-gray-300 px-2 py-1 text-sm" value={form.ttDoseNumber} onChange={set('ttDoseNumber')} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {check('IPT (malaria)', 'iptGiven')}
              {form.iptGiven && (
                <input type="number" min="1" max="4" placeholder="dose #" className="w-20 rounded border border-gray-300 px-2 py-1 text-sm" value={form.iptDoseNumber} onChange={set('iptDoseNumber')} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Complaints</span>
              <textarea rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.complaints} onChange={set('complaints')} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Plan</span>
              <textarea rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.plan} onChange={set('plan')} />
            </label>
          </div>
          <label className="block max-w-xs">
            <span className="text-xs font-medium text-gray-600">Next Visit Date</span>
            <input type="date" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.nextVisitDate} onChange={set('nextVisitDate')} />
          </label>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!form.visitDate || !form.gestationalAge || mutation.isPending}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Visit
          </button>
        </div>
      </div>
    </div>
  );
}
