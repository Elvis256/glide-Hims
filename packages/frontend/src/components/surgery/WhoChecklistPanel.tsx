import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardCheck, Lock, X } from 'lucide-react';
import {
  surgeryService,
  type WhoChecklist,
  type WhoChecklistPhase,
} from '../../services/surgery';

/**
 * WHO Surgical Safety Checklist (2009) item definitions.
 * Mirrors the backend's WHO_PHASE_ITEMS validation exactly:
 *  - kind 'confirm'  → checkbox, must be ticked
 *  - kind 'choice'   → select, must pick one of the options
 *  - kind 'text'     → free text, required ('none' if not applicable)
 */
type ItemSpec =
  | { key: string; label: string; kind: 'confirm' }
  | { key: string; label: string; kind: 'choice'; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: 'text'; placeholder?: string };

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];
const YES_NA = [
  { value: 'yes', label: 'Yes' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const PHASES: Array<{
  phase: WhoChecklistPhase;
  title: string;
  subtitle: string;
  items: ItemSpec[];
}> = [
  {
    phase: 'sign_in',
    title: 'Sign in',
    subtitle: 'Before induction of anaesthesia',
    items: [
      {
        key: 'identityProcedureConsentConfirmed',
        label: 'Patient has confirmed identity, site, procedure and consent',
        kind: 'confirm',
      },
      { key: 'siteMarked', label: 'Surgical site marked', kind: 'choice', options: YES_NA },
      {
        key: 'anesthesiaSafetyCheckComplete',
        label: 'Anaesthesia machine and medication check complete',
        kind: 'confirm',
      },
      {
        key: 'pulseOximeterFunctioning',
        label: 'Pulse oximeter on the patient and functioning',
        kind: 'confirm',
      },
      { key: 'knownAllergy', label: 'Known allergy?', kind: 'choice', options: YES_NO },
      {
        key: 'difficultAirwayOrAspirationRisk',
        label: 'Difficult airway or aspiration risk?',
        kind: 'choice',
        options: YES_NO,
      },
      {
        key: 'significantBloodLossRisk',
        label: 'Risk of >500 ml blood loss (7 ml/kg in children)?',
        kind: 'choice',
        options: YES_NO,
      },
    ],
  },
  {
    phase: 'time_out',
    title: 'Time out',
    subtitle: 'Before skin incision',
    items: [
      {
        key: 'teamIntroducedByNameAndRole',
        label: 'All team members introduced by name and role',
        kind: 'confirm',
      },
      {
        key: 'patientSiteProcedureConfirmed',
        label: 'Patient, site and procedure confirmed aloud',
        kind: 'confirm',
      },
      {
        key: 'antibioticProphylaxisWithin60Min',
        label: 'Antibiotic prophylaxis given within the last 60 minutes',
        kind: 'choice',
        options: YES_NA,
      },
      {
        key: 'surgeonReviewedCriticalSteps',
        label: 'Surgeon reviewed critical steps, duration, anticipated blood loss',
        kind: 'confirm',
      },
      {
        key: 'anesthesiaReviewedConcerns',
        label: 'Anaesthesia team reviewed patient-specific concerns',
        kind: 'confirm',
      },
      {
        key: 'nursingConfirmedSterility',
        label: 'Nursing confirmed sterility and equipment availability',
        kind: 'confirm',
      },
      {
        key: 'essentialImagingDisplayed',
        label: 'Essential imaging displayed',
        kind: 'choice',
        options: YES_NA,
      },
    ],
  },
  {
    phase: 'sign_out',
    title: 'Sign out',
    subtitle: 'Before the patient leaves the operating room',
    items: [
      {
        key: 'procedureNameRecorded',
        label: 'Name of the procedure recorded',
        kind: 'confirm',
      },
      {
        key: 'instrumentSpongeNeedleCountsCorrect',
        label: 'Instrument, sponge and needle counts correct',
        kind: 'choice',
        options: YES_NA,
      },
      {
        key: 'specimenLabelled',
        label: 'Specimen labelled (incl. patient name)',
        kind: 'choice',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no_specimen', label: 'No specimen' },
          { value: 'not_applicable', label: 'Not applicable' },
        ],
      },
      {
        key: 'equipmentProblemsIdentified',
        label: 'Equipment problems to be addressed',
        kind: 'text',
        placeholder: "'none' if none",
      },
      {
        key: 'recoveryConcernsReviewed',
        label: 'Surgeon, anaesthesia and nursing reviewed key recovery concerns',
        kind: 'confirm',
      },
    ],
  },
];

const PHASE_DONE_AT: Record<WhoChecklistPhase, keyof WhoChecklist> = {
  sign_in: 'signInCompletedAt',
  time_out: 'timeOutCompletedAt',
  sign_out: 'signOutCompletedAt',
};
const PHASE_DATA: Record<WhoChecklistPhase, keyof WhoChecklist> = {
  sign_in: 'signIn',
  time_out: 'timeOut',
  sign_out: 'signOut',
};

interface Props {
  caseId: string;
  caseNumber?: string;
  onClose: () => void;
}

export default function WhoChecklistPanel({ caseId, caseNumber, onClose }: Props) {
  const [checklist, setChecklist] = useState<WhoChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await surgeryService.whoChecklist.get(caseId);
      setChecklist(res.data);
      setValues({});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load WHO checklist');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** First phase without a completion timestamp is the active one. */
  const activePhase = useMemo(() => {
    if (!checklist) return null;
    return PHASES.find((p) => !checklist[PHASE_DONE_AT[p.phase]]) ?? null;
  }, [checklist]);

  const submit = async () => {
    if (!activePhase) return;
    try {
      setSubmitting(true);
      await surgeryService.whoChecklist.completePhase(caseId, activePhase.phase, values);
      toast.success(`${activePhase.title} phase completed`);
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to complete phase');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCompleted = (phaseDef: (typeof PHASES)[number]) => {
    const data = (checklist?.[PHASE_DATA[phaseDef.phase]] || {}) as Record<string, unknown>;
    const completedAt = checklist?.[PHASE_DONE_AT[phaseDef.phase]] as string | undefined;
    return (
      <div className="space-y-1">
        {phaseDef.items.map((item) => (
          <div key={item.key} className="flex items-start gap-2 text-sm text-gray-600">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <span>
              {item.label}
              {typeof data[item.key] === 'string' && (
                <span className="ml-1 font-medium text-gray-800">
                  — {String(data[item.key]).replace(/_/g, ' ')}
                </span>
              )}
            </span>
          </div>
        ))}
        {completedAt && (
          <p className="pt-1 text-xs text-gray-400">
            Completed {new Date(completedAt).toLocaleString('en-GB')}
          </p>
        )}
      </div>
    );
  };

  const renderForm = (phaseDef: (typeof PHASES)[number]) => (
    <div className="space-y-3">
      {phaseDef.items.map((item) => {
        if (item.kind === 'confirm') {
          return (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-teal-600"
                checked={values[item.key] === true}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [item.key]: e.target.checked || undefined }))
                }
              />
              <span className="text-sm text-gray-700">{item.label}</span>
            </label>
          );
        }
        if (item.kind === 'choice') {
          return (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-700">{item.label}</span>
              <select
                className="rounded border border-gray-300 px-2 py-1 text-sm"
                value={(values[item.key] as string) || ''}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [item.key]: e.target.value || undefined }))
                }
              >
                <option value="">Select…</option>
                {item.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        return (
          <label key={item.key} className="block">
            <span className="text-sm text-gray-700">{item.label}</span>
            <input
              type="text"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              placeholder={item.placeholder}
              value={(values[item.key] as string) || ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, [item.key]: e.target.value || undefined }))
              }
            />
          </label>
        );
      })}
      <button
        onClick={() => void submit()}
        disabled={submitting}
        className="mt-2 w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {submitting ? 'Saving…' : `Complete ${phaseDef.title.toLowerCase()} phase`}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-teal-600" />
            <div>
              <h2 className="text-lg font-semibold">WHO Surgical Safety Checklist</h2>
              {caseNumber && <p className="text-sm text-gray-500">Case {caseNumber}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && <div className="p-12 text-center text-gray-500">Loading checklist…</div>}

        {!loading && checklist && (
          <div className="p-6 space-y-4">
            {PHASES.map((phaseDef, idx) => {
              const done = Boolean(checklist[PHASE_DONE_AT[phaseDef.phase]]);
              const isActive = activePhase?.phase === phaseDef.phase;
              const isLocked = !done && !isActive;
              return (
                <div
                  key={phaseDef.phase}
                  className={`rounded-lg border p-4 ${
                    done
                      ? 'border-green-200 bg-green-50/40'
                      : isActive
                        ? 'border-teal-300 bg-white shadow-sm'
                        : 'border-gray-200 bg-gray-50 opacity-70'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {idx + 1}. {phaseDef.title}
                      </h3>
                      <p className="text-xs text-gray-500">{phaseDef.subtitle}</p>
                    </div>
                    {done ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : isLocked ? (
                      <span className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                        <Lock className="w-3.5 h-3.5" /> Locked
                      </span>
                    ) : (
                      <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700">
                        In progress
                      </span>
                    )}
                  </div>
                  {done
                    ? renderCompleted(phaseDef)
                    : isActive
                      ? renderForm(phaseDef)
                      : (
                        <p className="text-xs text-gray-400">
                          Complete the previous phase first.
                        </p>
                      )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
