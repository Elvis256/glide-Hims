import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { referralsService } from '../services/referrals';

interface Referral {
  id: string;
  referralNumber: string;
  type: string;
  status: string;
  priority: string;
  reason: string;
  clinicalSummary: string;
  provisionalDiagnosis: string;
  appointmentDate: string;
  patient: {
    fullName: string;
    mrn: string;
    phone: string;
  };
  fromFacility?: { name: string };
  toFacility?: { name: string };
  externalFacilityName?: string;
  referredBy?: { fullName: string };
  createdAt: string;
}

/** Inbound lifecycle: pending -> accepted -> completed (or rejected).
 *  Only the receiving facility may accept/reject/complete. */
const INCOMING_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
] as const;

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  expired: 'bg-orange-100 text-orange-800',
};

const priorityColors: Record<string, string> = {
  emergency: 'bg-red-500 text-white',
  urgent: 'bg-orange-500 text-white',
  routine: 'bg-blue-500 text-white',
};

type ActionKind = 'accept' | 'reject' | 'complete';

export default function ReferralsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [action, setAction] = useState<{ kind: ActionKind; referral: Referral } | null>(null);

  const queryKey = ['referrals', activeTab, activeTab === 'incoming' ? statusFilter : ''];

  const { data: referrals = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const list =
        activeTab === 'incoming'
          ? await referralsService.getIncoming((statusFilter || undefined) as any)
          : await referralsService.getOutgoing();
      return list as unknown as Referral[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['referrals'] });

  const acceptMutation = useMutation({
    mutationFn: (v: { id: string; appointmentDate?: string; appointmentTime?: string; notes?: string }) =>
      referralsService.accept(v.id, {
        appointmentDate: v.appointmentDate || undefined,
        appointmentTime: v.appointmentTime || undefined,
        notes: v.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Referral accepted');
      setAction(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to accept referral'),
  });

  const rejectMutation = useMutation({
    mutationFn: (v: { id: string; reason: string }) => referralsService.reject(v.id, v.reason),
    onSuccess: () => {
      toast.success('Referral rejected');
      setAction(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to reject referral'),
  });

  const completeMutation = useMutation({
    mutationFn: (v: { id: string; feedbackNotes?: string }) =>
      referralsService.complete(v.id, { feedbackNotes: v.feedbackNotes || undefined }),
    onSuccess: () => {
      toast.success('Referral completed');
      setAction(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to complete referral'),
  });

  const actionPending =
    acceptMutation.isPending || rejectMutation.isPending || completeMutation.isPending;

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Referrals</h1>
          <p className="text-gray-600">Manage patient referrals between facilities</p>
        </div>
        <button
          onClick={() => navigate('/doctor/referrals/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Referral
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('incoming')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'incoming'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📥 Incoming Referrals
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'outgoing'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📤 Outgoing Referrals
        </button>
      </div>

      {/* Status filter — incoming only. Without this, an accepted referral is
          indistinguishable from a pending one in a long list. */}
      {activeTab === 'incoming' && (
        <div className="flex gap-2 mb-4">
          {INCOMING_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 rounded-full text-sm ${
                statusFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Referrals List */}
      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : referrals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No {activeTab} referrals found</div>
        ) : (
          <div className="divide-y">
            {referrals.map((referral) => (
              <div key={referral.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-blue-600">{referral.referralNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[referral.status]}`}>
                        {referral.status.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${priorityColors[referral.priority]}`}>
                        {referral.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Patient</div>
                        <div className="font-medium">{referral.patient?.fullName}</div>
                        <div className="text-gray-500">MRN: {referral.patient?.mrn}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">From</div>
                        <div className="font-medium">{referral.fromFacility?.name || 'External'}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">To</div>
                        <div className="font-medium">
                          {referral.toFacility?.name || referral.externalFacilityName || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Reason</div>
                        <div className="font-medium">{referral.reason.replace(/_/g, ' ')}</div>
                      </div>
                    </div>
                    {referral.provisionalDiagnosis && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-500">Diagnosis:</span> {referral.provisionalDiagnosis}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    {activeTab === 'incoming' && referral.status === 'pending' && (
                      <>
                        <button
                          onClick={() => setAction({ kind: 'accept', referral })}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => setAction({ kind: 'reject', referral })}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {/* Complete is a receiving-side action: the backend rejects it
                        from the sending facility, so only offer it on Incoming. */}
                    {activeTab === 'incoming' && referral.status === 'accepted' && (
                      <button
                        onClick={() => setAction({ kind: 'complete', referral })}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedReferral(referral)}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* View Referral Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Referral Details</h2>
                <button
                  onClick={() => setSelectedReferral(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Referral Number</div>
                  <div className="font-medium">{selectedReferral.referralNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div className={`inline-block px-2 py-0.5 rounded text-xs ${statusColors[selectedReferral.status]}`}>
                    {selectedReferral.status.toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Patient</div>
                  <div className="font-medium">{selectedReferral.patient?.fullName}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">MRN</div>
                  <div className="font-medium">{selectedReferral.patient?.mrn}</div>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Clinical Summary</div>
                <div className="mt-1 p-3 bg-gray-50 rounded">{selectedReferral.clinicalSummary}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Provisional Diagnosis</div>
                <div className="font-medium">{selectedReferral.provisionalDiagnosis || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Referred By</div>
                <div className="font-medium">{selectedReferral.referredBy?.fullName || 'N/A'}</div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setSelectedReferral(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {action && (
        <ReferralActionModal
          kind={action.kind}
          referral={action.referral}
          pending={actionPending}
          onClose={() => setAction(null)}
          onSubmit={(values) => {
            if (action.kind === 'accept') {
              acceptMutation.mutate({ id: action.referral.id, ...values });
            } else if (action.kind === 'reject') {
              rejectMutation.mutate({ id: action.referral.id, reason: values.reason || '' });
            } else {
              completeMutation.mutate({ id: action.referral.id, feedbackNotes: values.notes });
            }
          }}
        />
      )}
    </div>
  );
}

interface ActionValues {
  appointmentDate?: string;
  appointmentTime?: string;
  notes?: string;
  reason?: string;
}

function ReferralActionModal({
  kind,
  referral,
  pending,
  onClose,
  onSubmit,
}: {
  kind: ActionKind;
  referral: Referral;
  pending: boolean;
  onClose: () => void;
  onSubmit: (values: ActionValues) => void;
}) {
  const [values, setValues] = useState<ActionValues>({});

  const title =
    kind === 'accept' ? 'Accept Referral' : kind === 'reject' ? 'Reject Referral' : 'Complete Referral';

  // Backend RejectReferralDto.rejectionReason is @IsString() and NOT optional.
  const canSubmit = kind === 'reject' ? !!values.reason?.trim() : true;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600">
            {referral.referralNumber} — {referral.patient?.fullName}
          </div>

          {kind === 'accept' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment date <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="date"
                  value={values.appointmentDate || ''}
                  onChange={(e) => setValues((v) => ({ ...v, appointmentDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment time <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="time"
                  value={values.appointmentTime || ''}
                  onChange={(e) => setValues((v) => ({ ...v, appointmentTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes to the referring facility <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={values.notes || ''}
                  onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </>
          )}

          {kind === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={values.reason || ''}
                onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Sent back to the referring facility"
              />
            </div>
          )}

          {kind === 'complete' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feedback notes <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                rows={4}
                value={values.notes || ''}
                onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Outcome and recommendations for the referring facility"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(values)}
            disabled={pending || !canSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Saving…' : title}
          </button>
        </div>
      </div>
    </div>
  );
}
