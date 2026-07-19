import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2, Baby, Syringe, CheckCircle } from 'lucide-react';
import {
  maternityService,
  DeliveryMode,
  LabourOutcome,
  BabySex,
  type DeliveryOutcome,
} from '../../services/maternity';
import { getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';

interface Props {
  labourId: string;
  patientName: string;
  onClose: () => void;
  onFinished: () => void;
}

const DELIVERY_MODES = [
  { value: DeliveryMode.SVD, label: 'Normal (SVD)' },
  { value: DeliveryMode.ASSISTED, label: 'Assisted (vacuum/forceps)' },
  { value: DeliveryMode.CAESAREAN, label: 'Caesarean' },
  { value: DeliveryMode.BREECH, label: 'Breech' },
];

export default function DeliveryModal({ labourId, patientName, onClose, onFinished }: Props) {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'delivery' | 'baby'>('delivery');
  const [deliveryForm, setDeliveryForm] = useState({
    deliveryMode: DeliveryMode.SVD as string,
    bloodLossMl: '',
    placentaComplete: true,
    episiotomyDone: false,
    perineumStatus: '',
    complications: '',
    deliveryNotes: '',
  });
  const [babyForm, setBabyForm] = useState({
    outcome: LabourOutcome.LIVE_BIRTH as string,
    sex: BabySex.FEMALE as string,
    birthWeight: '',
    apgar1min: '',
    apgar5min: '',
    resuscitationNeeded: false,
    skinToSkin: true,
    breastfeedingInitiated: true,
    vitaminKGiven: true,
    bcgGiven: false,
    abnormalities: '',
    notes: '',
  });

  const { data: outcomes = [], refetch: refetchOutcomes } = useQuery({
    queryKey: ['labour-outcomes', labourId],
    queryFn: async () => (await maternityService.labour.getOutcomes(labourId)).data,
  });

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  const deliveryMutation = useMutation({
    mutationFn: () =>
      maternityService.labour.recordDelivery(labourId, {
        deliveryMode: deliveryForm.deliveryMode as DeliveryMode,
        bloodLossMl: num(deliveryForm.bloodLossMl),
        placentaComplete: deliveryForm.placentaComplete,
        episiotomyDone: deliveryForm.episiotomyDone,
        perineumStatus: deliveryForm.perineumStatus || undefined,
        complications: deliveryForm.complications
          ? deliveryForm.complications.split(',').map((c) => c.trim()).filter(Boolean)
          : undefined,
        deliveryNotes: deliveryForm.deliveryNotes || undefined,
      }),
    onSuccess: () => {
      toast.success('Delivery recorded — now record the baby');
      setStep('baby');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record delivery')),
  });

  const babyMutation = useMutation({
    mutationFn: () =>
      maternityService.labour.recordBabyOutcome({
        labourRecordId: labourId,
        babyNumber: outcomes.length + 1,
        outcome: babyForm.outcome as LabourOutcome,
        sex: babyForm.sex as BabySex,
        birthWeight: Number(babyForm.birthWeight),
        apgar1min: num(babyForm.apgar1min),
        apgar5min: num(babyForm.apgar5min),
        resuscitationNeeded: babyForm.resuscitationNeeded,
        skinToSkin: babyForm.skinToSkin,
        breastfeedingInitiated: babyForm.breastfeedingInitiated,
        vitaminKGiven: babyForm.vitaminKGiven,
        bcgGiven: babyForm.bcgGiven,
        abnormalities: babyForm.abnormalities || undefined,
        notes: babyForm.notes || undefined,
      }),
    onSuccess: async (res) => {
      const baby: DeliveryOutcome = res.data;
      toast.success(`Baby ${baby.babyNumber || ''} recorded (${Number(baby.birthWeight)}kg)`);
      await refetchOutcomes();
      // Auto-generate the EPI schedule for live births
      if (baby.outcome === LabourOutcome.LIVE_BIRTH) {
        try {
          await maternityService.immunization.generateSchedule(baby.id, facilityId);
          toast.success('Immunization schedule generated (BCG, Polio, DPT…)');
        } catch (err) {
          toast.error(getApiErrorMessage(err, 'Could not generate immunization schedule'));
        }
      }
      queryClient.invalidateQueries({ queryKey: ['epi-due'] });
      setBabyForm((f) => ({ ...f, birthWeight: '', apgar1min: '', apgar5min: '', abnormalities: '', notes: '' }));
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record baby outcome')),
  });

  const check = (form: 'delivery' | 'baby', label: string, key: string) => {
    const state = form === 'delivery' ? deliveryForm : babyForm;
    const setState = form === 'delivery' ? setDeliveryForm : setBabyForm;
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={(state as any)[key]}
          onChange={() => setState((f: any) => ({ ...f, [key]: !f[key] }))}
        />
        {label}
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Baby className="w-5 h-5 text-pink-600" />
              {step === 'delivery' ? 'Record Delivery' : 'Record Baby'}
            </h2>
            <p className="text-sm text-gray-500">{patientName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {step === 'delivery' ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Mode *</label>
              <div className="grid grid-cols-2 gap-2">
                {DELIVERY_MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setDeliveryForm((f) => ({ ...f, deliveryMode: m.value }))}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium ${
                      deliveryForm.deliveryMode === m.value
                        ? 'bg-pink-100 border-pink-400 text-pink-700'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Blood Loss (ml)</span>
                <input
                  type="number" min="0"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={deliveryForm.bloodLossMl}
                  onChange={(e) => setDeliveryForm((f) => ({ ...f, bloodLossMl: e.target.value }))}
                />
                {Number(deliveryForm.bloodLossMl) >= 500 && (
                  <span className="text-xs font-medium text-red-600">⚠ PPH threshold (≥500ml)</span>
                )}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Perineum</span>
                <select
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={deliveryForm.perineumStatus}
                  onChange={(e) => setDeliveryForm((f) => ({ ...f, perineumStatus: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="intact">Intact</option>
                  <option value="first_degree_tear">1st degree tear</option>
                  <option value="second_degree_tear">2nd degree tear</option>
                  <option value="third_degree_tear">3rd degree tear</option>
                  <option value="fourth_degree_tear">4th degree tear</option>
                  <option value="episiotomy">Episiotomy</option>
                </select>
              </label>
            </div>
            <div className="flex gap-6">
              {check('delivery', 'Placenta complete', 'placentaComplete')}
              {check('delivery', 'Episiotomy done', 'episiotomyDone')}
            </div>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Complications (comma-separated)</span>
              <input
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="e.g. PPH, cord prolapse"
                value={deliveryForm.complications}
                onChange={(e) => setDeliveryForm((f) => ({ ...f, complications: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Notes</span>
              <textarea
                rows={2}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={deliveryForm.deliveryNotes}
                onChange={(e) => setDeliveryForm((f) => ({ ...f, deliveryNotes: e.target.value }))}
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => deliveryMutation.mutate()}
                disabled={deliveryMutation.isPending}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deliveryMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save & Record Baby
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {outcomes.length > 0 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
                {outcomes.map((o) => (
                  <p key={o.id} className="text-sm text-green-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Baby {o.babyNumber}: {o.sex}, {Number(o.birthWeight)}kg, Apgar {o.apgar1min ?? '—'}/{o.apgar5min ?? '—'}
                  </p>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Outcome *</span>
                <select
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={babyForm.outcome}
                  onChange={(e) => setBabyForm((f) => ({ ...f, outcome: e.target.value }))}
                >
                  <option value="live_birth">Live birth</option>
                  <option value="stillbirth">Stillbirth</option>
                  <option value="neonatal_death">Neonatal death</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Sex *</span>
                <select
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={babyForm.sex}
                  onChange={(e) => setBabyForm((f) => ({ ...f, sex: e.target.value }))}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="ambiguous">Ambiguous</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Birth Weight (kg) *</span>
                <input
                  type="number" min="0.3" max="7" step="0.05"
                  placeholder="e.g. 3.2"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={babyForm.birthWeight}
                  onChange={(e) => setBabyForm((f) => ({ ...f, birthWeight: e.target.value }))}
                />
                {babyForm.birthWeight && Number(babyForm.birthWeight) < 2.5 && (
                  <span className="text-xs font-medium text-amber-600">Low birth weight (&lt;2.5kg)</span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Apgar 1min</span>
                  <input
                    type="number" min="0" max="10"
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={babyForm.apgar1min}
                    onChange={(e) => setBabyForm((f) => ({ ...f, apgar1min: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Apgar 5min</span>
                  <input
                    type="number" min="0" max="10"
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={babyForm.apgar5min}
                    onChange={(e) => setBabyForm((f) => ({ ...f, apgar5min: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
              {check('baby', 'Resuscitation needed', 'resuscitationNeeded')}
              {check('baby', 'Skin-to-skin done', 'skinToSkin')}
              {check('baby', 'Breastfeeding initiated', 'breastfeedingInitiated')}
              {check('baby', 'Vitamin K given', 'vitaminKGiven')}
              {check('baby', 'BCG given at birth', 'bcgGiven')}
            </div>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Abnormalities / Notes</span>
              <textarea
                rows={2}
                className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={babyForm.abnormalities}
                onChange={(e) => setBabyForm((f) => ({ ...f, abnormalities: e.target.value }))}
              />
            </label>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Syringe className="w-3.5 h-3.5" />
              Saving a live birth auto-generates the immunization (EPI) schedule.
            </p>
            <div className="flex justify-between pt-2">
              <button
                onClick={() => babyMutation.mutate()}
                disabled={!babyForm.birthWeight || babyMutation.isPending}
                className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
              >
                {babyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {outcomes.length > 0 ? 'Save Another Baby (twin)' : 'Save Baby'}
              </button>
              <button
                onClick={() => { onFinished(); onClose(); }}
                disabled={outcomes.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
