import { useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Syringe, AlertTriangle, X, Loader2 } from 'lucide-react';
import { maternityService, type ImmunizationSchedule } from '../../services/maternity';
import { getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';

const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-700',
  due: 'bg-blue-100 text-blue-700',
  overdue: 'bg-red-100 text-red-700',
  administered: 'bg-green-100 text-green-700',
  missed: 'bg-orange-100 text-orange-700',
  contraindicated: 'bg-purple-100 text-purple-700',
};

export default function EpiTab() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'due' | 'defaulters'>('due');
  const [administering, setAdministering] = useState<ImmunizationSchedule | null>(null);
  const [form, setForm] = useState({ batchNumber: '', siteOfAdministration: '', adverseReaction: false, reactionDescription: '', notes: '' });

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const administeringDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!administering,
    onClose: () => setAdministering(null),
  });

  const { data: due = [], isLoading: dueLoading } = useQuery({
    queryKey: ['epi-due', facilityId],
    queryFn: async () => (await maternityService.immunization.getDue(facilityId)).data,
    enabled: view === 'due',
  });
  const { data: defaulters = [], isLoading: defLoading } = useQuery({
    queryKey: ['epi-defaulters', facilityId],
    queryFn: async () => (await maternityService.immunization.getDefaulters(facilityId)).data,
    enabled: view === 'defaulters',
  });

  const administerMutation = useMutation({
    mutationFn: () =>
      maternityService.immunization.administer(administering!.id, {
        batchNumber: form.batchNumber || undefined,
        siteOfAdministration: form.siteOfAdministration || undefined,
        adverseReaction: form.adverseReaction,
        reactionDescription: form.adverseReaction ? form.reactionDescription || undefined : undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success(`${administering?.vaccineName} recorded as administered`);
      setAdministering(null);
      setForm({ batchNumber: '', siteOfAdministration: '', adverseReaction: false, reactionDescription: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['epi-due'] });
      queryClient.invalidateQueries({ queryKey: ['epi-defaulters'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to record vaccination')),
  });

  const rows = view === 'due' ? due : defaulters;
  const loading = view === 'due' ? dueLoading : defLoading;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setView('due')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'due' ? 'bg-pink-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          Due / Scheduled
        </button>
        <button
          onClick={() => setView('defaulters')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${view === 'defaulters' ? 'bg-pink-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-1" />
          Defaulters
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Syringe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>{view === 'due' ? 'No vaccinations due' : 'No defaulters — well done!'}</p>
            <p className="text-sm text-gray-400 mt-1">
              Schedules are generated automatically when a live birth is recorded.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3">Baby / Mother</th>
                <th className="px-4 py-3">Vaccine</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {s.deliveryOutcome?.labourRecord?.registration?.patient?.fullName
                        ? `Baby of ${s.deliveryOutcome.labourRecord.registration.patient.fullName}`
                        : `Baby ${s.deliveryOutcome?.babyNumber ?? ''}`}
                    </p>
                    {s.deliveryOutcome?.sex && (
                      <p className="text-xs text-gray-500 capitalize">{s.deliveryOutcome.sex}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{s.vaccineName}</td>
                  <td className="px-4 py-3">{new Date(s.dueDate).toLocaleDateString('en-GB')}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[s.status] || 'bg-gray-100'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.status !== 'administered' && (
                      <button
                        onClick={() => setAdministering(s)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                      >
                        <Syringe className="w-3.5 h-3.5 inline mr-1" />
                        Administer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Administer modal */}
      {administering && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          ref={administeringDialogRef}
        >
          <div className="absolute inset-0 bg-black/30" onClick={() => setAdministering(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Syringe className="w-5 h-5 text-green-600" />
                Administer {administering.vaccineName}
              </h2>
              <button onClick={() => setAdministering(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Batch Number</span>
                  <input
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={form.batchNumber}
                    onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Site</span>
                  <select
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    value={form.siteOfAdministration}
                    onChange={(e) => setForm((f) => ({ ...f, siteOfAdministration: e.target.value }))}
                  >
                    <option value="">—</option>
                    <option value="left_thigh">Left thigh</option>
                    <option value="right_thigh">Right thigh</option>
                    <option value="left_arm">Left arm</option>
                    <option value="right_arm">Right arm</option>
                    <option value="oral">Oral</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.adverseReaction}
                  onChange={() => setForm((f) => ({ ...f, adverseReaction: !f.adverseReaction }))}
                />
                Adverse reaction observed
              </label>
              {form.adverseReaction && (
                <textarea
                  rows={2}
                  placeholder="Describe the reaction..."
                  className="w-full rounded border border-red-300 px-2 py-1.5 text-sm"
                  value={form.reactionDescription}
                  onChange={(e) => setForm((f) => ({ ...f, reactionDescription: e.target.value }))}
                />
              )}
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Notes</span>
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setAdministering(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => administerMutation.mutate()}
                disabled={administerMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {administerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Record Vaccination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
