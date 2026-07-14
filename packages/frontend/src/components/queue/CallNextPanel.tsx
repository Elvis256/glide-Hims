import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Megaphone,
  User,
  ChevronRight,
  Volume2,
  Clock,
  UserCircle,
  Loader2,
  SkipForward,
  DoorOpen,
  X,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../services/queue';
import { toast } from 'sonner';
import { playCallChime } from '../../utils/chime';
import { Button, Card, Badge, EmptyState, cn } from '../ui';

const SKIP_REASONS = [
  { value: 'stepped_out', label: 'Stepped out' },
  { value: 'refuses', label: 'Refuses to come' },
  { value: 'cannot_locate', label: 'Cannot locate patient' },
  { value: 'other', label: 'Other' },
];

function SkipModal({
  patient,
  onClose,
  onSkip,
  isPending,
}: {
  patient: QueueEntry;
  onClose: () => void;
  onSkip: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('stepped_out');
  return (
    <>
      <div className="fixed inset-0 z-40 bg-surface-900/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="border-b border-surface-200 px-5 py-3.5 flex items-center justify-between">
            <h3 className="font-semibold text-surface-900">Skip Patient</h3>
            <Button variant="ghost" size="sm" icon={X} onClick={onClose} />
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-surface-600">
              Skip <span className="font-medium">{patient.patient?.fullName || 'this patient'}</span> (#{patient.ticketNumber})?
            </p>
            <div className="space-y-1">
              {SKIP_REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-surface-50">
                  <input
                    type="radio"
                    name="skip-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="w-4 h-4 accent-amber-600"
                  />
                  <span className="text-sm text-surface-700">{r.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                icon={SkipForward}
                loading={isPending}
                onClick={() => onSkip(reason)}
                className="flex-1 !bg-amber-500 hover:!bg-amber-600"
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export interface CallNextPanelProps {
  /** react-query cache key for the waiting queue */
  queueKey: string[];
  /** Fetches the waiting queue for this station */
  fetchQueue: () => Promise<QueueEntry[]>;
  /** Service point passed to queueService.callNext() */
  servicePoint: string;
  /** Spoken destination noun: "room" (doctor) or "counter" (reception) */
  destinationNoun?: string;
  title?: string;
  subtitle?: string;
}

/**
 * Shared call station: currently-serving display, race-safe complete-then-call,
 * voice announcement + chime, up-next rail with skip. Used by the doctor and
 * reception call pages so the calling behaviour stays identical everywhere.
 */
export default function CallNextPanel({
  queueKey,
  fetchQueue,
  servicePoint,
  destinationNoun = 'room',
  title = 'Call Next Patient',
  subtitle,
}: CallNextPanelProps) {
  const queryClient = useQueryClient();
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<QueueEntry | null>(null);
  const [roomNumber, setRoomNumber] = useState(() => localStorage.getItem(`callNext_room_${servicePoint}`) || '');
  const [skipTarget, setSkipTarget] = useState<QueueEntry | null>(null);
  const [lastPatient, setLastPatient] = useState<QueueEntry | null>(null);

  const { data: queue = [], isLoading } = useQuery({
    queryKey: queueKey,
    queryFn: fetchQueue,
    refetchInterval: 10000,
    select: (data) => (Array.isArray(data) ? data : []).filter(
      e => e.status === 'waiting' || e.status === 'called' || e.status === 'pending_payment',
    ),
  });

  const nextPatients = useMemo(() => queue.slice(0, 3), [queue]);

  const callNextMutation = useMutation({
    mutationFn: () => queueService.callNext(servicePoint),
    onSuccess: (data) => {
      if (data) {
        playCallChime();
        setCurrentPatient(data);
        announcePatient(data);
      }
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to call next patient');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => queueService.complete(id),
    onSuccess: () => {
      setLastPatient(currentPatient);
      setCurrentPatient(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to mark patient complete');
    },
  });

  const skipMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => queueService.skip(id, reason),
    onSuccess: () => {
      setSkipTarget(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Patient skipped');
    },
    onError: () => toast.error('Failed to skip patient'),
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => queueService.noShow(id),
    onSuccess: () => {
      setLastPatient(currentPatient);
      setCurrentPatient(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.warning('Patient marked as no-show');
    },
    onError: () => toast.error('Failed to mark no-show'),
  });

  const recallMutation = useMutation({
    mutationFn: (id: string) => queueService.recall(id),
    onSuccess: (data) => {
      playCallChime();
      setCurrentPatient(data);
      setLastPatient(null);
      announcePatient(data);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Patient recalled');
    },
    onError: () => toast.error('Failed to recall patient'),
  });

  const getWaitTime = (entry: QueueEntry) => {
    if (!entry.createdAt) return 0;
    return Math.floor((Date.now() - new Date(entry.createdAt).getTime()) / 60000);
  };

  const handleCallNext = async () => {
    // Race-safe sequencing: if a patient is currently being served, wait for
    // their completion to succeed BEFORE calling the next one. Without this
    // the two mutations fire in parallel and the queue can advance while the
    // previous patient's "completed" status is still in flight, creating
    // ghost active patients and lost callback events.
    if (callNextMutation.isPending || completeMutation.isPending) return;

    if (currentPatient) {
      try {
        await completeMutation.mutateAsync(currentPatient.id);
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Could not complete current patient — call next aborted');
        return;
      }
    }
    callNextMutation.mutate();
  };

  const announcePatient = (patient: QueueEntry) => {
    setIsAnnouncing(true);
    const destination = roomNumber ? `${destinationNoun} ${roomNumber}` : `the ${destinationNoun}`;
    const name = patient.patient?.fullName || 'Patient';
    const utterance = new SpeechSynthesisUtterance(
      `Now calling token number ${patient.ticketNumber}. ${name}, please proceed to ${destination}.`
    );
    utterance.onend = () => setIsAnnouncing(false);
    utterance.onerror = () => setIsAnnouncing(false);

    if (window.speechSynthesis) {
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsAnnouncing(false), 2000);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900 tracking-tight">{title}</h1>
            <p className="text-sm text-surface-500">{subtitle || `${queue.length} patient${queue.length === 1 ? '' : 's'} waiting`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-surface-200 px-3 py-2 shadow-sm">
          <DoorOpen className="w-4 h-4 text-brand-500 flex-shrink-0" />
          <input
            type="text"
            value={roomNumber}
            onChange={(e) => {
              setRoomNumber(e.target.value);
              localStorage.setItem(`callNext_room_${servicePoint}`, e.target.value);
            }}
            placeholder={`${destinationNoun[0].toUpperCase()}${destinationNoun.slice(1)} number`}
            className="w-32 text-sm font-medium text-surface-700 bg-transparent focus:outline-none placeholder-surface-400"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500" />
        </div>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Main display */}
          <div className="flex-1 flex flex-col min-h-0">
            {currentPatient ? (
              <div className="flex-1 bg-white rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.07)] border border-surface-200 p-8 flex flex-col overflow-y-auto">
                <div className="text-center mb-6">
                  <p className="text-surface-500 uppercase tracking-widest text-sm mb-3">Now Calling</p>
                  <div
                    className={cn(
                      'inline-block px-12 py-5 rounded-2xl transition-colors',
                      isAnnouncing ? 'bg-emerald-500 animate-pulse' : 'bg-brand-600',
                    )}
                  >
                    <span className="text-7xl font-extrabold text-white font-mono tracking-tight">
                      {currentPatient.ticketNumber}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center space-y-5">
                  <div className="flex items-center gap-4">
                    <UserCircle className="w-16 h-16 text-surface-200" />
                    <div>
                      <h2 className="text-3xl font-bold text-surface-900">
                        {currentPatient.patient?.fullName || 'Unknown Patient'}
                      </h2>
                      <p className="text-lg text-surface-500">{currentPatient.patient?.mrn || ''}</p>
                    </div>
                  </div>

                  {currentPatient.notes && (
                    <div className="bg-surface-50 rounded-xl px-6 py-3 max-w-xl w-full">
                      <p className="text-xs text-surface-500 mb-0.5">Notes</p>
                      <p className="text-base text-surface-800">{currentPatient.notes}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-surface-500 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Waiting for {getWaitTime(currentPatient)} minutes</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3 mt-6">
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => noShowMutation.mutate(currentPatient.id)}
                    loading={noShowMutation.isPending}
                    className="text-rose-600 hover:bg-rose-50"
                  >
                    No Show
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={Volume2}
                    disabled={isAnnouncing}
                    onClick={() => announcePatient(currentPatient)}
                  >
                    {isAnnouncing ? 'Announcing…' : 'Announce Again'}
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleCallNext}
                    disabled={isAnnouncing}
                    loading={callNextMutation.isPending || completeMutation.isPending}
                  >
                    Call Next <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ) : queue.length > 0 ? (
              <div className="flex-1 bg-white rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.07)] border border-surface-200 p-8 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4">
                  <Megaphone className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-surface-800">Ready to Call</h2>
                <p className="text-surface-500 mt-1">{queue.length} patient{queue.length === 1 ? '' : 's'} waiting in queue</p>
                <div className="mt-6 flex items-center gap-3">
                  {lastPatient && (
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => recallMutation.mutate(lastPatient.id)}
                      loading={recallMutation.isPending}
                    >
                      Recall {lastPatient.ticketNumber}
                    </Button>
                  )}
                  <Button
                    size="lg"
                    icon={Volume2}
                    className="px-8"
                    onClick={handleCallNext}
                    loading={callNextMutation.isPending}
                  >
                    Call First Patient
                  </Button>
                </div>
              </div>
            ) : (
              <Card className="flex-1 flex items-center justify-center">
                <EmptyState
                  icon={User}
                  title="No patients in queue"
                  description="All patients have been attended to."
                />
              </Card>
            )}
          </div>

          {/* Up next rail */}
          <div className="w-72 flex flex-col min-h-0">
            <Card flush className="flex-1 overflow-y-auto">
              <div className="px-4 py-3 border-b border-surface-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-500" />
                <h3 className="font-semibold text-surface-800">Up Next</h3>
              </div>
              {nextPatients.length > 0 ? (
                <div className="p-3 space-y-2">
                  {nextPatients.map((patient, index) => (
                    <div key={patient.id} className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-brand-600">{patient.ticketNumber}</span>
                        <Badge tone="neutral">#{index + 1}</Badge>
                      </div>
                      <p className="font-medium text-surface-800 text-sm truncate">{patient.patient?.fullName || 'Unknown'}</p>
                      <p className="text-xs text-surface-500">{patient.patient?.mrn || ''}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-surface-400">Waiting {getWaitTime(patient)} min</p>
                        <button
                          onClick={() => setSkipTarget(patient)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                          title="Skip patient"
                        >
                          <SkipForward className="w-3 h-3" />
                          Skip
                        </button>
                      </div>
                    </div>
                  ))}
                  {queue.length > 3 && (
                    <p className="text-center text-xs text-surface-400 pt-1">+{queue.length - 3} more in queue</p>
                  )}
                </div>
              ) : (
                <EmptyState icon={User} title="No more patients" className="py-8" />
              )}
            </Card>
          </div>
        </div>
      )}

      {skipTarget && (
        <SkipModal
          patient={skipTarget}
          onClose={() => setSkipTarget(null)}
          onSkip={(reason) => skipMutation.mutate({ id: skipTarget.id, reason })}
          isPending={skipMutation.isPending}
        />
      )}
    </div>
  );
}
