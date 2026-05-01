import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DollarSign,
  Edit2,
  Plus,
  Loader2,
  Trash2,
  Calendar,
  X,
  Briefcase,
  Percent,
  Split,
  Banknote,
} from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

type FeeMode = 'flat' | 'percent_of_specialty' | 'split';
type EmploymentType = 'employed' | 'visiting_consultant' | 'locum';

interface DoctorLite {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  department?: { id: string; name: string };
}

interface FeeProfile {
  id: string;
  doctorId: string;
  doctor?: DoctorLite;
  employmentType: EmploymentType;
  feeMode: FeeMode;
  flatFee: number | null;
  percentOfSpecialty: number | null;
  doctorSharePercent: number | null;
  hospitalSharePercent: number | null;
  workingDays: number[] | null;
  followUpWindowDays: number | null;
  followUpFee: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
}

const DAYS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
];

const empBadge = (e: EmploymentType) =>
  ({
    employed: 'bg-blue-100 text-blue-800',
    visiting_consultant: 'bg-purple-100 text-purple-800',
    locum: 'bg-amber-100 text-amber-800',
  }[e]);

const modeIcon = (m: FeeMode) => {
  if (m === 'flat') return <Banknote className="w-3 h-3" />;
  if (m === 'percent_of_specialty') return <Percent className="w-3 h-3" />;
  return <Split className="w-3 h-3" />;
};

export default function DoctorFeesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ doctorId: string; profile?: FeeProfile } | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['doctor-fee-profiles'],
    queryFn: async () => (await api.get('/doctor-fees/profiles')).data as FeeProfile[],
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors-for-fee-picker'],
    queryFn: async () => {
      const res = await api.get('/users', { params: { role: 'doctor', limit: 200 } });
      return (res.data?.data ?? res.data ?? []) as DoctorLite[];
    },
    enabled: showPicker,
  });

  const deleteMutation = useMutation({
    mutationFn: async (doctorId: string) => api.delete(`/doctor-fees/profiles/${doctorId}`),
    onSuccess: () => {
      toast.success('Fee profile removed — doctor will use specialty/default rate');
      qc.invalidateQueries({ queryKey: ['doctor-fee-profiles'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to remove'),
  });

  const profileByDoctor = useMemo(() => {
    const m = new Map<string, FeeProfile>();
    (profiles || []).forEach((p) => m.set(p.doctorId, p));
    return m;
  }, [profiles]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="w-6 h-6" /> Doctor Consultation Fees
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Per-doctor overrides for the consultation fee. When a doctor has no profile here, the
            system falls back to the specialty rate (<code>OPD-CONSULT-{'{DEPT}'}</code>) and then
            the tenant default. Use this for senior consultants who charge premium, visiting
            consultants who get a revenue share, or locums on a different rate.
          </p>
        </div>
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Doctor Fee
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {profiles && profiles.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-800">
          No doctor fee overrides configured. All doctors are billing at the specialty / tenant
          default rate.
        </div>
      )}

      {profiles && profiles.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Working Days</th>
                <th className="px-4 py-3">Follow-up</th>
                <th className="px-4 py-3">Effective</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {p.doctor?.firstName} {p.doctor?.lastName}
                    </div>
                    {p.doctor?.department && (
                      <div className="text-xs text-gray-500">{p.doctor.department.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${empBadge(p.employmentType)}`}
                    >
                      <Briefcase className="w-3 h-3" />
                      {p.employmentType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      {modeIcon(p.feeMode)}
                      {p.feeMode === 'flat' && (
                        <span className="font-medium">{formatCurrency(p.flatFee || 0)}</span>
                      )}
                      {p.feeMode === 'percent_of_specialty' && (
                        <span className="font-medium">
                          {p.percentOfSpecialty}% of specialty rate
                        </span>
                      )}
                      {p.feeMode === 'split' && (
                        <span className="font-medium">
                          {p.doctorSharePercent}% doctor / {p.hospitalSharePercent}% hospital
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.workingDays && p.workingDays.length > 0
                      ? p.workingDays
                          .map((d) => DAYS.find((x) => x.iso === d)?.label)
                          .join(', ')
                      : 'Every day'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.followUpWindowDays
                      ? `${p.followUpWindowDays}d @ ${formatCurrency(p.followUpFee || 0)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.effectiveFrom || '—'} → {p.effectiveTo || 'open'}
                    {!p.isActive && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                        inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing({ doctorId: p.doctorId, profile: p })}
                        className="p-1.5 hover:bg-blue-50 rounded text-blue-600"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove fee profile for ${p.doctor?.firstName ?? 'doctor'}?`))
                            deleteMutation.mutate(p.doctorId);
                        }}
                        className="p-1.5 hover:bg-red-50 rounded text-red-600"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showPicker && (
        <DoctorPickerModal
          doctors={(doctors || []).filter((d) => !profileByDoctor.has(d.id))}
          onCancel={() => setShowPicker(false)}
          onPick={(d) => {
            setShowPicker(false);
            setEditing({ doctorId: d.id });
          }}
        />
      )}

      {editing && (
        <FeeProfileModal
          doctorId={editing.doctorId}
          profile={editing.profile}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ['doctor-fee-profiles'] });
          }}
        />
      )}
    </div>
  );
}

function DoctorPickerModal({
  doctors,
  onCancel,
  onPick,
}: {
  doctors: DoctorLite[];
  onCancel: () => void;
  onPick: (d: DoctorLite) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = doctors.filter((d) =>
    `${d.firstName} ${d.lastName} ${d.email ?? ''}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="font-semibold">Select doctor</h2>
          <button onClick={onCancel}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 border-b">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div className="overflow-y-auto flex-1 divide-y">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-500">
              No matching doctors without a fee profile.
            </div>
          )}
          {filtered.map((d) => (
            <button
              key={d.id}
              onClick={() => onPick(d)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="font-medium">
                {d.firstName} {d.lastName}
              </div>
              <div className="text-xs text-gray-500">
                {d.department?.name ?? 'No department'} {d.email ? ` • ${d.email}` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeeProfileModal({
  doctorId,
  profile,
  onClose,
  onSaved,
}: {
  doctorId: string;
  profile?: FeeProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    employmentType: (profile?.employmentType ?? 'employed') as EmploymentType,
    feeMode: (profile?.feeMode ?? 'flat') as FeeMode,
    flatFee: profile?.flatFee ?? 0,
    percentOfSpecialty: profile?.percentOfSpecialty ?? 100,
    doctorSharePercent: profile?.doctorSharePercent ?? 50,
    hospitalSharePercent: profile?.hospitalSharePercent ?? 50,
    workingDays: profile?.workingDays ?? [],
    followUpWindowDays: profile?.followUpWindowDays ?? 7,
    followUpFee: profile?.followUpFee ?? 0,
    effectiveFrom: profile?.effectiveFrom ?? '',
    effectiveTo: profile?.effectiveTo ?? '',
    isActive: profile?.isActive ?? true,
    notes: profile?.notes ?? '',
  });

  // Keep doctor + hospital share summing to 100
  useEffect(() => {
    if (form.feeMode === 'split') {
      setForm((f) => ({ ...f, hospitalSharePercent: 100 - Number(f.doctorSharePercent || 0) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.doctorSharePercent, form.feeMode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        employmentType: form.employmentType,
        feeMode: form.feeMode,
        workingDays: form.workingDays.length > 0 ? form.workingDays : null,
        followUpWindowDays: Number(form.followUpWindowDays) || null,
        followUpFee: Number(form.followUpFee) || 0,
        effectiveFrom: form.effectiveFrom || null,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
        notes: form.notes || null,
      };
      if (form.feeMode === 'flat') payload.flatFee = Number(form.flatFee);
      if (form.feeMode === 'percent_of_specialty')
        payload.percentOfSpecialty = Number(form.percentOfSpecialty);
      if (form.feeMode === 'split') {
        payload.doctorSharePercent = Number(form.doctorSharePercent);
        payload.hospitalSharePercent = Number(form.hospitalSharePercent);
      }
      return api.put(`/doctor-fees/profiles/${doctorId}`, payload);
    },
    onSuccess: () => {
      toast.success('Fee profile saved');
      onSaved();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save'),
  });

  const toggleDay = (d: number) =>
    setForm((f) => ({
      ...f,
      workingDays: f.workingDays.includes(d)
        ? f.workingDays.filter((x) => x !== d)
        : [...f.workingDays, d].sort(),
    }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
          <h2 className="font-semibold">{profile ? 'Edit' : 'Create'} fee profile</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Employment type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">EMPLOYMENT TYPE</label>
            <div className="grid grid-cols-3 gap-2">
              {(['employed', 'visiting_consultant', 'locum'] as EmploymentType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, employmentType: t })}
                  className={`px-3 py-2 rounded-lg border text-sm ${form.employmentType === t ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300'}`}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Fee mode */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">FEE MODE</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'flat', label: 'Flat fee' },
                { v: 'percent_of_specialty', label: '% of specialty' },
                { v: 'split', label: 'Revenue split' },
              ] as Array<{ v: FeeMode; label: string }>).map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setForm({ ...form, feeMode: m.v })}
                  className={`px-3 py-2 rounded-lg border text-sm ${form.feeMode === m.v ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fee inputs */}
          {form.feeMode === 'flat' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">FLAT FEE (UGX)</label>
              <input
                type="number"
                value={form.flatFee}
                onChange={(e) => setForm({ ...form, flatFee: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Doctor charges this amount regardless of specialty. Use for "Dr. Moses charges
                70,000" type cases.
              </p>
            </div>
          )}
          {form.feeMode === 'percent_of_specialty' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                % OF SPECIALTY RATE
              </label>
              <input
                type="number"
                value={form.percentOfSpecialty}
                onChange={(e) =>
                  setForm({ ...form, percentOfSpecialty: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                e.g. 150 = 1.5× the specialty rate. If specialty rate later changes, this scales
                automatically.
              </p>
            </div>
          )}
          {form.feeMode === 'split' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  DOCTOR SHARE %
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.doctorSharePercent}
                  onChange={(e) =>
                    setForm({ ...form, doctorSharePercent: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  HOSPITAL SHARE %
                </label>
                <input
                  type="number"
                  value={form.hospitalSharePercent}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                />
              </div>
              <p className="col-span-2 text-xs text-gray-500">
                Patient is charged the full specialty rate; the split is recorded against each
                consultation for finance/payroll. Used for visiting consultants.
              </p>
            </div>
          )}

          {/* Working days */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              WORKING DAYS (leave empty = every day)
            </label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => toggleDay(d.iso)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${form.workingDays.includes(d.iso) ? 'border-blue-600 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Doctor will not be auto-assigned on off-days.
            </p>
          </div>

          {/* Follow-up */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                FOLLOW-UP WINDOW (DAYS)
              </label>
              <input
                type="number"
                value={form.followUpWindowDays}
                onChange={(e) =>
                  setForm({ ...form, followUpWindowDays: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                FOLLOW-UP FEE (UGX)
              </label>
              <input
                type="number"
                value={form.followUpFee}
                onChange={(e) => setForm({ ...form, followUpFee: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <p className="col-span-2 text-xs text-gray-500">
              If patient returns to the same doctor within the window, charge this amount instead
              (0 = free follow-up).
            </p>
          </div>

          {/* Effective dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> EFFECTIVE FROM
              </label>
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> EFFECTIVE TO
              </label>
              <input
                type="date"
                value={form.effectiveTo}
                onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">NOTES</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
