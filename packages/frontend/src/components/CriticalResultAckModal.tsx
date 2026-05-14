import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  CriticalResultAlert,
  AcknowledgeCriticalResultPayload,
} from '../services/critical-results';

interface Props {
  alert: CriticalResultAlert;
  onConfirm: (payload: AcknowledgeCriticalResultPayload) => Promise<void> | void;
  onCancel: () => void;
}

const MIN_NOTE = 10;

export default function CriticalResultAckModal({ alert, onConfirm, onCancel }: Props) {
  const [note, setNote] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noteOk = note.trim().length >= MIN_NOTE;

  const handleSubmit = async () => {
    if (!noteOk) {
      setError(`Please describe your review (min ${MIN_NOTE} chars).`);
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm({
        note: note.trim(),
        actionTaken: actionTaken.trim() || undefined,
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to acknowledge');
    } finally {
      setSubmitting(false);
    }
  };

  const sevColor =
    alert.severity === 'abnormal'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : 'bg-red-100 text-red-800 border-red-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Acknowledge Critical Result
              </h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Closed-loop sign-off (JCI patient-safety standard).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className={`rounded border p-3 text-sm ${sevColor}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wide">
                {alert.resourceType} · {alert.severity.replace('_', ' ')}
              </span>
              <span className="text-xs">
                SLA: {new Date(alert.slaDeadline).toLocaleString()}
              </span>
            </div>
            {alert.summary && <p className="mt-1">{alert.summary}</p>}
            {alert.patient?.fullName && (
              <p className="mt-1 text-xs">
                Patient: <strong>{alert.patient.fullName}</strong>
                {alert.patient.mrn ? ` (${alert.patient.mrn})` : ''}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Clinical review note <span className="text-red-600">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Describe what was reviewed, your interpretation, and any communication with the patient/team."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className={`mt-1 text-xs ${noteOk ? 'text-gray-500' : 'text-red-600'}`}>
              {note.trim().length}/{MIN_NOTE} characters minimum
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Action taken (optional)
            </label>
            <input
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="e.g. Started IV fluids; ordered repeat in 2h; admitted; informed family"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !noteOk}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Acknowledging…' : 'Acknowledge & Sign'}
          </button>
        </div>
      </div>
    </div>
  );
}
