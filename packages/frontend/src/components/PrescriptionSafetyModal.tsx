import { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, Pill } from 'lucide-react';
import type { SafetyAlert } from '../services/prescriptions';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  alerts: SafetyAlert[];
  degraded?: boolean;
  degradedReasons?: string[];
  message?: string;
  onCancel: () => void;
  onOverride: (reason: string) => void;
  submitting?: boolean;
}

const sevColor: Record<SafetyAlert['severity'], string> = {
  contraindicated: 'bg-red-100 border-red-400 text-red-900',
  severe: 'bg-red-100 border-red-400 text-red-900',
  major: 'bg-orange-100 border-orange-400 text-orange-900',
  moderate: 'bg-yellow-100 border-yellow-400 text-yellow-900',
};

const sevLabel: Record<SafetyAlert['severity'], string> = {
  contraindicated: 'CONTRAINDICATED',
  severe: 'SEVERE',
  major: 'MAJOR',
  moderate: 'MODERATE',
};

/**
 * Modal shown when POST /prescriptions returns 409 SAFETY_BLOCKED.
 * Displays each alert (DDI / allergy) and forces the prescriber to enter
 * a written justification before retrying with safetyOverride={ reason }.
 */
export default function PrescriptionSafetyModal({
  open,
  alerts,
  degraded,
  degradedReasons = [],
  message,
  onCancel,
  onOverride,
  submitting,
}: Props) {
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  if (!open) return null;

  const blocking = alerts.filter(
    (a) => a.severity === 'major' || a.severity === 'severe' || a.severity === 'contraindicated',
  );
  const advisory = alerts.filter((a) => !blocking.includes(a));
  const canOverride = acknowledged && reason.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-red-200 bg-red-50 px-6 py-4 rounded-t-lg">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900">
                Medication Safety Alert
              </h3>
              <p className="text-sm text-red-700 mt-0.5">
                {message || 'This prescription has been blocked by safety checks. Review and acknowledge to proceed.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alerts list */}
        <div className="overflow-y-auto px-6 py-4 space-y-3">
          {degraded && (
            <div className="rounded border-l-4 border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-900">
              <div className="font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Safety check degraded
              </div>
              <ul className="list-disc ml-6 mt-1">
                {degradedReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                One or more safety checks could not run. Override only if you have personally verified the prescription is safe.
              </p>
            </div>
          )}

          {[...blocking, ...advisory].map((a, idx) => (
            <div
              key={idx}
              className={`rounded border-l-4 p-3 text-sm ${sevColor[a.severity]}`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <Pill className="h-4 w-4" />
                <span>{sevLabel[a.severity]}</span>
                <span className="text-xs uppercase tracking-wider opacity-70">
                  · {a.kind === 'allergy' ? 'Allergy' : a.kind === 'interaction' ? 'Drug interaction' : 'Duplicate therapy'}
                </span>
              </div>
              <div className="mt-1">
                <span className="font-semibold">{a.drugName}</span>
                {a.pairedDrugName ? (
                  <>
                    {' '}
                    + <span className="font-semibold">{a.pairedDrugName}</span>
                  </>
                ) : null}
                {a.matchedAllergen ? (
                  <>
                    {' '}
                    — matches recorded allergy:{' '}
                    <span className="font-semibold">{a.matchedAllergen}</span>
                  </>
                ) : null}
              </div>
              <p className="mt-1">{a.description}</p>
              {a.recommendation && (
                <p className="mt-1 text-xs italic">→ {a.recommendation}</p>
              )}
            </div>
          ))}

          {alerts.length === 0 && !degraded && (
            <div className="text-sm text-gray-600">No alert details returned.</div>
          )}
        </div>

        {/* Override form */}
        <div className="border-t bg-gray-50 px-6 py-4 rounded-b-lg space-y-3">
          <label className="block text-sm font-medium text-gray-800">
            Clinical justification for override <span className="text-red-600">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Required. Minimum 10 characters. Will be permanently recorded in the patient's safety-override audit log with your name and timestamp."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have reviewed the toast.error(s) above, judged the clinical benefit to outweigh the risk for this patient, and accept responsibility for prescribing.
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel prescription
            </button>
            <button
              type="button"
              onClick={() => onOverride(reason.trim())}
              disabled={!canOverride || submitting}
              className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting…' : 'Override and prescribe'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
