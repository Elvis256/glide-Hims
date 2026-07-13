import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Activity,
  AlertTriangle,
  Baby,
  HeartPulse,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  maternityService,
  type PartographData,
  type PartographLineParams,
  type RecordPartographObservationDto,
} from '../../services/maternity';

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  latent_phase: {
    label: 'Latent phase (< 4 cm)',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  normal: {
    label: 'Normal progress',
    className: 'bg-green-50 text-green-800 border-green-300',
  },
  alert_line_crossed: {
    label: 'ALERT line crossed — progress slower than 1 cm/hour',
    className: 'bg-amber-50 text-amber-800 border-amber-400',
  },
  action_line_crossed: {
    label: 'ACTION line crossed — senior review / intervention required',
    className: 'bg-red-50 text-red-800 border-red-400',
  },
};

const LIQUOR_OPTIONS = [
  { value: 'intact', label: 'Membranes intact (I)' },
  { value: 'clear', label: 'Clear (C)' },
  { value: 'meconium', label: 'Meconium (M)' },
  { value: 'blood_stained', label: 'Blood-stained (B)' },
  { value: 'absent', label: 'Absent (A)' },
];

const MOULDING_OPTIONS = ['none', '+', '++', '+++'];

interface Props {
  labourId: string;
  onClose: () => void;
}

interface FormState {
  cervicalDilationCm: string;
  descentFifths: string;
  contractionsPer10Min: string;
  contractionDurationSeconds: string;
  fetalHeartRate: string;
  liquor: string;
  moulding: string;
  pulse: string;
  bpSystolic: string;
  bpDiastolic: string;
  temperature: string;
  oxytocinDropsPerMin: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  cervicalDilationCm: '',
  descentFifths: '',
  contractionsPer10Min: '',
  contractionDurationSeconds: '',
  fetalHeartRate: '',
  liquor: '',
  moulding: '',
  pulse: '',
  bpSystolic: '',
  bpDiastolic: '',
  temperature: '',
  oxytocinDropsPerMin: '',
  notes: '',
};

export default function PartographPanel({ labourId, onClose }: Props) {
  const [data, setData] = useState<PartographData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await maternityService.labour.getPartograph(labourId);
      setData(res.data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load partograph');
    } finally {
      setLoading(false);
    }
  }, [labourId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Chart data ──────────────────────────────────────────────────────────────

  const t0 = useMemo(() => {
    if (!data) return null;
    const first = data.observations[0]?.observedAt || data.labour.admissionTime;
    return first ? new Date(first).getTime() : null;
  }, [data]);

  const hoursSinceT0 = useCallback(
    (iso: string) => (t0 == null ? 0 : (new Date(iso).getTime() - t0) / 3_600_000),
    [t0],
  );

  const dilationPoints = useMemo(
    () =>
      (data?.observations || [])
        .filter((o) => o.cervicalDilationCm != null)
        .map((o) => ({
          hours: Number(hoursSinceT0(o.observedAt).toFixed(2)),
          dilation: Number(o.cervicalDilationCm),
        })),
    [data, hoursSinceT0],
  );

  const fhrPoints = useMemo(
    () =>
      (data?.observations || [])
        .filter((o) => o.fetalHeartRate != null)
        .map((o) => ({
          hours: Number(hoursSinceT0(o.observedAt).toFixed(2)),
          fhr: Number(o.fetalHeartRate),
        })),
    [data, hoursSinceT0],
  );

  const maxHours = useMemo(() => {
    const observed = Math.max(
      1,
      ...dilationPoints.map((p) => p.hours),
      ...fhrPoints.map((p) => p.hours),
    );
    // Leave room for the action line reaching 10 cm
    return Math.ceil(observed + 4);
  }, [dilationPoints, fhrPoints]);

  /** Two-point series for a WHO line: from its start until it reaches 10 cm. */
  const lineSeries = useCallback(
    (line: PartographLineParams | null, key: string) => {
      if (!line || t0 == null) return [];
      const startHours = hoursSinceT0(line.startAt);
      const hoursTo10 = (10 - line.startDilationCm) / line.cmPerHour;
      return [
        { hours: Number(startHours.toFixed(2)), [key]: line.startDilationCm },
        {
          hours: Number((startHours + hoursTo10).toFixed(2)),
          [key]: 10,
        },
      ];
    },
    [t0, hoursSinceT0],
  );

  const alertLineData = useMemo(
    () => lineSeries(data?.analysis.alertLine ?? null, 'alert'),
    [data, lineSeries],
  );
  const actionLineData = useMemo(
    () => lineSeries(data?.analysis.actionLine ?? null, 'action'),
    [data, lineSeries],
  );

  // ── Submit ──────────────────────────────────────────────────────────────────

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  const submit = async () => {
    const dto: RecordPartographObservationDto = {
      cervicalDilationCm: num(form.cervicalDilationCm),
      descentFifths: num(form.descentFifths),
      contractionsPer10Min: num(form.contractionsPer10Min),
      contractionDurationSeconds: num(form.contractionDurationSeconds),
      fetalHeartRate: num(form.fetalHeartRate),
      liquor: form.liquor || undefined,
      moulding: form.moulding || undefined,
      pulse: num(form.pulse),
      bpSystolic: num(form.bpSystolic),
      bpDiastolic: num(form.bpDiastolic),
      temperature: num(form.temperature),
      oxytocinDropsPerMin: num(form.oxytocinDropsPerMin),
      notes: form.notes || undefined,
    };
    try {
      setSubmitting(true);
      const res = await maternityService.labour.recordPartographObservation(labourId, dto);
      const result = res.data;
      toast.success('Observation recorded');
      for (const alert of result.alerts || []) {
        toast.warning(alert, { duration: 10_000 });
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record observation');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const status = data ? STATUS_META[data.analysis.progressStatus] : null;

  const field = (
    label: string,
    key: keyof FormState,
    props: Record<string, unknown> = {},
  ) => (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        type="number"
        className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-pink-500 focus:outline-none"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Baby className="w-6 h-6 text-pink-600" />
            <div>
              <h2 className="text-lg font-semibold">Partograph</h2>
              {data && (
                <p className="text-sm text-gray-500">
                  {data.labour.patient?.name || 'Patient'} · {data.labour.labourNumber} ·{' '}
                  {data.labour.status.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="p-2 text-gray-500 hover:text-gray-700"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="p-12 text-center text-gray-500">Loading partograph…</div>
        )}

        {!loading && data && (
          <div className="p-6 space-y-6">
            {/* Status banners */}
            {status && (
              <div
                className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${status.className}`}
              >
                <Activity className="w-4 h-4 shrink-0" />
                {status.label}
              </div>
            )}
            {data.analysis.fetalHeartRateAbnormal && (
              <div className="flex items-center gap-2 rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                <HeartPulse className="w-4 h-4 shrink-0" />
                Abnormal fetal heart rate: {data.analysis.latestFetalHeartRate} bpm (normal
                110–160)
              </div>
            )}

            {/* Dilation chart */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Cervical dilation (cm) vs hours
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hours"
                    type="number"
                    domain={[0, maxHours]}
                    tickCount={Math.min(13, maxHours + 1)}
                    label={{ value: 'Hours', position: 'insideBottomRight', offset: -4 }}
                  />
                  <YAxis type="number" domain={[0, 10]} tickCount={11} width={30} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={4} stroke="#d1d5db" strokeDasharray="4 4" />
                  <Line
                    data={alertLineData}
                    dataKey="alert"
                    name="Alert line"
                    stroke="#f59e0b"
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    data={actionLineData}
                    dataKey="action"
                    name="Action line"
                    stroke="#dc2626"
                    strokeDasharray="6 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    data={dilationPoints}
                    dataKey="dilation"
                    name="Dilation"
                    stroke="#db2777"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* FHR chart */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Fetal heart rate (bpm)
              </h3>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart
                  data={fhrPoints}
                  margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="hours"
                    type="number"
                    domain={[0, maxHours]}
                    tickCount={Math.min(13, maxHours + 1)}
                  />
                  <YAxis type="number" domain={[60, 200]} width={36} />
                  <Tooltip />
                  <ReferenceLine y={110} stroke="#dc2626" strokeDasharray="4 4" />
                  <ReferenceLine y={160} stroke="#dc2626" strokeDasharray="4 4" />
                  <Line
                    dataKey="fhr"
                    name="FHR"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Add observation */}
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700"
              >
                <Plus className="w-4 h-4" />
                Record observation
              </button>
            ) : (
              <div className="rounded-lg border border-gray-200 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">New observation</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {field('Dilation (cm)', 'cervicalDilationCm', { min: 0, max: 10 })}
                  {field('Descent (fifths)', 'descentFifths', { min: 0, max: 5 })}
                  {field('Contractions /10min', 'contractionsPer10Min', { min: 0, max: 10 })}
                  {field('Duration (sec)', 'contractionDurationSeconds', { min: 0, max: 300 })}
                  {field('FHR (bpm)', 'fetalHeartRate', { min: 40, max: 240 })}
                  {field('Pulse', 'pulse', { min: 20, max: 250 })}
                  {field('BP systolic', 'bpSystolic', { min: 40, max: 300 })}
                  {field('BP diastolic', 'bpDiastolic', { min: 20, max: 200 })}
                  {field('Temp (°C)', 'temperature', { min: 30, max: 45, step: 0.1 })}
                  {field('Oxytocin (drops/min)', 'oxytocinDropsPerMin', { min: 0 })}
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Liquor</span>
                    <select
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      value={form.liquor}
                      onChange={(e) => setForm((f) => ({ ...f, liquor: e.target.value }))}
                    >
                      <option value="">—</option>
                      {LIQUOR_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-600">Moulding</span>
                    <select
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                      value={form.moulding}
                      onChange={(e) => setForm((f) => ({ ...f, moulding: e.target.value }))}
                    >
                      <option value="">—</option>
                      {MOULDING_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">Notes</span>
                  <textarea
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => void submit()}
                    disabled={submitting}
                    className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
                  >
                    {submitting ? 'Saving…' : 'Save observation'}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Observation table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Observations</h3>
              {data.observations.length === 0 ? (
                <p className="text-sm text-gray-500">No observations recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="py-2 pr-3">Time</th>
                        <th className="py-2 pr-3">Dilation</th>
                        <th className="py-2 pr-3">Descent</th>
                        <th className="py-2 pr-3">FHR</th>
                        <th className="py-2 pr-3">Contr./10m</th>
                        <th className="py-2 pr-3">Liquor</th>
                        <th className="py-2 pr-3">Moulding</th>
                        <th className="py-2 pr-3">BP</th>
                        <th className="py-2 pr-3">Pulse</th>
                        <th className="py-2 pr-3">Temp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.observations].reverse().map((o) => (
                        <tr key={o.id} className="border-b last:border-0">
                          <td className="py-1.5 pr-3 whitespace-nowrap">
                            {new Date(o.observedAt).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-1.5 pr-3">{o.cervicalDilationCm ?? '—'}</td>
                          <td className="py-1.5 pr-3">{o.descentFifths ?? '—'}</td>
                          <td
                            className={`py-1.5 pr-3 ${
                              o.fetalHeartRate != null &&
                              (o.fetalHeartRate < 110 || o.fetalHeartRate > 160)
                                ? 'font-semibold text-red-600'
                                : ''
                            }`}
                          >
                            {o.fetalHeartRate ?? '—'}
                          </td>
                          <td className="py-1.5 pr-3">
                            {o.contractionsPer10Min != null
                              ? `${o.contractionsPer10Min}×${o.contractionDurationSeconds ?? '?'}s`
                              : '—'}
                          </td>
                          <td className="py-1.5 pr-3">{o.liquor ?? '—'}</td>
                          <td className="py-1.5 pr-3">{o.moulding ?? '—'}</td>
                          <td className="py-1.5 pr-3">
                            {o.bpSystolic != null ? `${o.bpSystolic}/${o.bpDiastolic ?? '?'}` : '—'}
                          </td>
                          <td className="py-1.5 pr-3">{o.pulse ?? '—'}</td>
                          <td className="py-1.5 pr-3">{o.temperature ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {data.analysis.progressStatus === 'action_line_crossed' && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                WHO guidance: crossing the action line calls for full reassessment and a
                decision on augmentation, transfer or operative delivery by senior staff.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
