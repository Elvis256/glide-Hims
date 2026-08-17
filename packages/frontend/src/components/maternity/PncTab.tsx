import { useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { HeartHandshake, X, Loader2, AlertTriangle } from 'lucide-react';
import { maternityService } from '../../services/maternity';
import { getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';

/** WHO PNC contact schedule: within 24h, day 3, day 7-14, week 6. */
const VISIT_LABELS: Record<number, string> = {
  1: 'Visit 1 (24 hours)',
  2: 'Visit 2 (day 3)',
  3: 'Visit 3 (day 7–14)',
  4: 'Visit 4 (week 6)',
};

const DANGER_SIGNS: { key: string; label: string }[] = [
  { key: 'heavyBleeding', label: 'Heavy bleeding' },
  { key: 'fever', label: 'Fever' },
  { key: 'severeHeadache', label: 'Severe headache' },
  { key: 'blurredVision', label: 'Blurred vision' },
  { key: 'convulsions', label: 'Convulsions' },
  { key: 'breathingDifficulty', label: 'Breathing difficulty' },
  { key: 'legSwelling', label: 'Leg swelling' },
];

export default function PncTab() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [recording, setRecording] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const recordingDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!recording,
    onClose: () => setRecording(null),
  });

  const { data: dueList = [], isLoading } = useQuery({
    queryKey: ['pnc-due', facilityId],
    queryFn: async () => (await maternityService.pnc.getDueList(facilityId)).data,
  });

  const openRecord = (entry: any) => {
    setRecording(entry);
    setForm({
      visitNumber: entry.dueVisits?.[0] || 1,
      visitDate: new Date().toISOString().slice(0, 10),
      temperature: '',
      bpSystolic: '',
      bpDiastolic: '',
      uterusWellContracted: true,
      lochiaType: '',
      lochiaFoulSmelling: false,
      breastCondition: 'normal',
      breastfeedingEstablished: true,
      heavyBleeding: false,
      fever: false,
      severeHeadache: false,
      blurredVision: false,
      convulsions: false,
      breathingDifficulty: false,
      legSwelling: false,
      ironFolateGiven: true,
      vitaminAGiven: false,
      familyPlanningCounseling: false,
      contraceptiveMethod: '',
      complaints: '',
      treatment: '',
      nextVisitDate: '',
    });
  };

  const num = (v: string) => (String(v).trim() === '' ? undefined : Number(v));

  const mutation = useMutation({
    mutationFn: () =>
      maternityService.pnc.recordVisit({
        facilityId,
        registrationId:
          recording.delivery?.labourRecord?.registrationId ||
          recording.delivery?.labourRecord?.registration?.id,
        deliveryOutcomeId: recording.delivery?.id,
        visitNumber: Number(form.visitNumber) as 1 | 2 | 3 | 4,
        visitDate: form.visitDate,
        temperature: num(form.temperature),
        bpSystolic: num(form.bpSystolic),
        bpDiastolic: num(form.bpDiastolic),
        uterusWellContracted: form.uterusWellContracted,
        lochiaType: form.lochiaType || undefined,
        lochiaFoulSmelling: form.lochiaFoulSmelling,
        breastCondition: form.breastCondition || undefined,
        breastfeedingEstablished: form.breastfeedingEstablished,
        heavyBleeding: form.heavyBleeding,
        fever: form.fever,
        severeHeadache: form.severeHeadache,
        blurredVision: form.blurredVision,
        convulsions: form.convulsions,
        breathingDifficulty: form.breathingDifficulty,
        legSwelling: form.legSwelling,
        ironFolateGiven: form.ironFolateGiven,
        vitaminAGiven: form.vitaminAGiven,
        familyPlanningCounseling: form.familyPlanningCounseling,
        contraceptiveMethod: form.contraceptiveMethod || undefined,
        complaints: form.complaints || undefined,
        treatment: form.treatment || undefined,
        nextVisitDate: form.nextVisitDate || undefined,
      }),
    onSuccess: () => {
      toast.success('PNC visit recorded');
      setRecording(null);
      queryClient.invalidateQueries({ queryKey: ['pnc-due'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record PNC visit')),
  });

  const dangerCount = DANGER_SIGNS.filter((d) => form[d.key]).length;

  const check = (label: string, key: string, danger = false) => (
    <label className={`flex items-center gap-2 text-sm ${danger && form[key] ? 'text-red-700 font-semibold' : 'text-gray-700'}`}>
      <input type="checkbox" checked={!!form[key]} onChange={() => setForm((f: any) => ({ ...f, [key]: !f[key] }))} />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b bg-pink-50">
          <h3 className="font-semibold text-pink-800 flex items-center gap-2">
            <HeartHandshake className="w-5 h-5" />
            Postnatal follow-up due
          </h3>
        </div>
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading…</div>
        ) : dueList.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <HeartHandshake className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No postnatal visits due</p>
            <p className="text-sm text-gray-400 mt-1">Mothers appear here after delivery per the WHO contact schedule.</p>
          </div>
        ) : (
          <div className="divide-y">
            {dueList.map((entry: any) => (
              <div key={entry.delivery?.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-900">{entry.patient?.fullName || 'Mother'}</p>
                  <p className="text-sm text-gray-500">
                    Day {entry.daysPostpartum} postpartum • due:{' '}
                    {(entry.dueVisits || []).map((n: number) => VISIT_LABELS[n]).join(', ')}
                  </p>
                  {entry.completedVisits?.length > 0 && (
                    <p className="text-xs text-gray-400">Done: visits {entry.completedVisits.join(', ')}</p>
                  )}
                </div>
                <button
                  onClick={() => openRecord(entry)}
                  className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-sm font-medium hover:bg-pink-700"
                >
                  Record Visit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {recording && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          ref={recordingDialogRef}
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setRecording(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Record PNC Visit</h2>
              <button onClick={() => setRecording(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Visit *</span>
                  <select className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.visitNumber} onChange={(e) => setForm((f: any) => ({ ...f, visitNumber: e.target.value }))}>
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{VISIT_LABELS[n]}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Date *</span>
                  <input type="date" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.visitDate} onChange={(e) => setForm((f: any) => ({ ...f, visitDate: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Temp (°C)</span>
                  <input type="number" step="0.1" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.temperature} onChange={(e) => setForm((f: any) => ({ ...f, temperature: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">BP Systolic</span>
                  <input type="number" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.bpSystolic} onChange={(e) => setForm((f: any) => ({ ...f, bpSystolic: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">BP Diastolic</span>
                  <input type="number" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.bpDiastolic} onChange={(e) => setForm((f: any) => ({ ...f, bpDiastolic: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Lochia</span>
                  <select className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.lochiaType} onChange={(e) => setForm((f: any) => ({ ...f, lochiaType: e.target.value }))}>
                    <option value="">—</option>
                    <option value="rubra">Rubra (red)</option>
                    <option value="serosa">Serosa (pink)</option>
                    <option value="alba">Alba (white)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Breasts</span>
                  <select className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.breastCondition} onChange={(e) => setForm((f: any) => ({ ...f, breastCondition: e.target.value }))}>
                    <option value="normal">Normal</option>
                    <option value="engorged">Engorged</option>
                    <option value="cracked_nipples">Cracked nipples</option>
                    <option value="mastitis">Mastitis</option>
                    <option value="abscess">Abscess</option>
                  </select>
                </label>
              </div>

              <div className={`p-3 rounded-lg border ${dangerCount > 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'}`}>
                <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                  {dangerCount > 0 && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  Maternal danger signs
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {DANGER_SIGNS.map((d) => check(d.label, d.key, true))}
                </div>
                {dangerCount > 0 && (
                  <p className="text-xs font-medium text-red-700 mt-2">
                    ⚠ Danger sign present — assess and refer per protocol.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                {check('Uterus well contracted', 'uterusWellContracted')}
                {check('Lochia foul-smelling', 'lochiaFoulSmelling', true)}
                {check('Breastfeeding established', 'breastfeedingEstablished')}
                {check('Iron/Folate given', 'ironFolateGiven')}
                {check('Vitamin A given', 'vitaminAGiven')}
                <div className="flex items-center gap-2">
                  {check('FP counselling', 'familyPlanningCounseling')}
                  {form.familyPlanningCounseling && (
                    <input placeholder="method" className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm" value={form.contraceptiveMethod} onChange={(e) => setForm((f: any) => ({ ...f, contraceptiveMethod: e.target.value }))} />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Complaints</span>
                  <textarea rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.complaints} onChange={(e) => setForm((f: any) => ({ ...f, complaints: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Treatment / Plan</span>
                  <textarea rows={2} className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.treatment} onChange={(e) => setForm((f: any) => ({ ...f, treatment: e.target.value }))} />
                </label>
              </div>
              <label className="block max-w-xs">
                <span className="text-xs font-medium text-gray-600">Next Visit Date</span>
                <input type="date" className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm" value={form.nextVisitDate} onChange={(e) => setForm((f: any) => ({ ...f, nextVisitDate: e.target.value }))} />
              </label>
            </div>
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setRecording(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !form.visitDate}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
              >
                {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Visit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
