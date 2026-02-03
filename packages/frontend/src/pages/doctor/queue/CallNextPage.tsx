import { usePermissions } from '../../../components/PermissionGate';
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
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../../services/queue';

export default function CallNextPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<QueueEntry | null>(null);

  // Fetch waiting queue from API
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['queue', 'waiting', 'consultation'],
    queryFn: () => queueService.getWaiting('consultation'),
    refetchInterval: 10000,
  });

  const nextPatients = useMemo(() => queue.slice(0, 3), [queue]);

  // Call next mutation
  const callNextMutation = useMutation({
    mutationFn: () => queueService.callNext('consultation'),
    onSuccess: (data) => {
      if (data) {
        setCurrentPatient(data);
        announcePatient(data);
      }
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  // Complete service mutation
  const completeMutation = useMutation({
    mutationFn: (id: string) => queueService.complete(id),
    onSuccess: () => {
      setCurrentPatient(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  const getWaitTime = (entry: QueueEntry) => {
    if (!entry.createdAt) return 0;
    const now = new Date();
    const created = new Date(entry.createdAt);
    return Math.floor((now.getTime() - created.getTime()) / 60000);
  };

  const handleCallNext = () => {
    if (currentPatient) {
      // Complete current patient first, then call next
      completeMutation.mutate(currentPatient.id);
    }
    callNextMutation.mutate();
  };

  const announcePatient = (patient: QueueEntry) => {
    setIsAnnouncing(true);
    const utterance = new SpeechSynthesisUtterance(
      `Now calling token number ${patient.ticketNumber}. ${patient.patient?.fullName || 'Patient'}, please proceed to the doctor's room.`
    );
    utterance.onend = () => setIsAnnouncing(false);
    utterance.onerror = () => setIsAnnouncing(false);

    if (window.speechSynthesis) {
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsAnnouncing(false), 2000);
    }
  };

  const simulateAnnouncement = () => {
    if (!currentPatient) return;
    announcePatient(currentPatient);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Megaphone className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Call Next Patient</h1>
            <p className="text-gray-500">{queue.length} patients waiting</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
      ) : (
      <div className="flex-1 flex gap-6">
        {/* Main Display - Current Patient */}
        <div className="flex-1 flex flex-col">
          {currentPatient ? (
            <div className="flex-1 bg-white rounded-2xl shadow-lg border-2 border-blue-100 p-8 flex flex-col">
              {/* Token Number - Large Display */}
              <div className="text-center mb-8">
                <p className="text-gray-500 text-lg mb-2">Now Calling</p>
                <div
                  className={`inline-block px-12 py-6 rounded-2xl ${
                    isAnnouncing
                      ? 'bg-green-500 animate-pulse'
                      : 'bg-blue-600'
                  }`}
                >
                  <span className="text-7xl font-bold text-white font-mono">
                    {currentPatient.ticketNumber}
                  </span>
                </div>
              </div>

              {/* Patient Details */}
              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                <div className="flex items-center gap-4">
                  <UserCircle className="w-20 h-20 text-gray-300" />
                  <div>
                    <h2 className="text-4xl font-bold text-gray-900">
                      {currentPatient.patient?.fullName || 'Unknown Patient'}
                    </h2>
                    <p className="text-xl text-gray-500">
                      {currentPatient.patient?.mrn || ''}
                    </p>
                  </div>
                </div>

                {currentPatient.notes && (
                  <div className="bg-gray-50 rounded-xl px-8 py-4 max-w-xl w-full">
                    <p className="text-sm text-gray-500 mb-1">Notes</p>
                    <p className="text-xl text-gray-800">{currentPatient.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-5 h-5" />
                  <span>Waiting for {getWaitTime(currentPatient)} minutes</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4 mt-8">
                <button
                  onClick={simulateAnnouncement}
                  disabled={isAnnouncing}
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold transition-all ${
                    isAnnouncing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg hover:shadow-xl'
                  }`}
                >
                  <Volume2 className={`w-6 h-6 ${isAnnouncing ? 'animate-pulse' : ''}`} />
                  {isAnnouncing ? 'Announcing...' : 'Announce Again'}
                </button>

                <button
                  onClick={handleCallNext}
                  disabled={isAnnouncing || callNextMutation.isPending}
                  className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold transition-all ${
                    isAnnouncing || callNextMutation.isPending
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {callNextMutation.isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      Call Next
                      <ChevronRight className="w-6 h-6" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : queue.length > 0 ? (
            <div className="flex-1 bg-white rounded-2xl shadow-lg border-2 border-green-100 p-8 flex flex-col items-center justify-center">
              <Megaphone className="w-24 h-24 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-700">Ready to Call Next Patient</h2>
              <p className="text-gray-500 mt-2">{queue.length} patients waiting in queue</p>
              <button
                onClick={handleCallNext}
                disabled={callNextMutation.isPending}
                className="mt-6 inline-flex items-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
              >
                {callNextMutation.isPending ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <Volume2 className="w-6 h-6" />
                    Call First Patient
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-8 flex flex-col items-center justify-center">
              <User className="w-24 h-24 text-gray-200 mb-4" />
              <h2 className="text-2xl font-bold text-gray-400">No Patients in Queue</h2>
              <p className="text-gray-400 mt-2">All patients have been attended to</p>
            </div>
          )}
        </div>

        {/* Next Patients Mini-List */}
        <div className="w-80 flex flex-col">
          <div className="bg-white rounded-xl shadow-lg border p-4 flex-1">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Up Next
            </h3>

            {nextPatients.length > 0 ? (
              <div className="space-y-3">
                {nextPatients.map((patient, index) => (
                  <div
                    key={patient.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-blue-600">
                        {patient.ticketNumber}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                        #{index + 1} in queue
                      </span>
                    </div>
                    <p className="font-medium text-gray-800">{patient.patient?.fullName || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">
                      {patient.patient?.mrn || ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Waiting {getWaitTime(patient)} min
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <User className="w-12 h-12 mb-2" />
                <p className="text-sm">No more patients</p>
              </div>
            )}

            {queue.length > 3 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                +{queue.length - 3} more in queue
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
