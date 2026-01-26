import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Volume2,
  UserCircle,
  Clock,
  CheckCircle,
  SkipForward,
  XCircle,
  RefreshCw,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../services/queue';

const SERVICE_POINTS = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'triage', label: 'Triage' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'billing', label: 'Billing' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'injection', label: 'Injection' },
  { value: 'dressing', label: 'Dressing' },
  { value: 'vitals', label: 'Vitals' },
  { value: 'records', label: 'Records' },
  { value: 'registration', label: 'Registration' },
];

export default function CallNextPatientPage() {
  const queryClient = useQueryClient();
  const [counterNumber, setCounterNumber] = useState('1');
  const [servicePoint, setServicePoint] = useState('consultation');
  const [currentPatient, setCurrentPatient] = useState<QueueEntry | null>(null);
  const [recentlyCalled, setRecentlyCalled] = useState<{ patient: QueueEntry; time: Date }[]>([]);

  // Fetch waiting queue from API
  const { data: waitingList = [], isLoading, refetch } = useQuery({
    queryKey: ['queue', 'waiting', servicePoint],
    queryFn: () => queueService.getWaiting(servicePoint),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Call next patient mutation
  const callNextMutation = useMutation({
    mutationFn: () => queueService.callNext(servicePoint),
    onSuccess: (data) => {
      if (data) {
        setCurrentPatient(data);
        setRecentlyCalled([{ patient: data, time: new Date() }, ...recentlyCalled.slice(0, 4)]);
      }
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  // Start service mutation
  const startServiceMutation = useMutation({
    mutationFn: (id: string) => queueService.startService(id),
    onSuccess: () => {
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

  // No-show mutation
  const noShowMutation = useMutation({
    mutationFn: (id: string) => queueService.noShow(id),
    onSuccess: () => {
      setCurrentPatient(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: (id: string) => queueService.skip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  const callNextPatient = () => {
    if (waitingList.length === 0) return;
    callNextMutation.mutate();
  };

  const speakAnnouncement = (token: string, counter: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `Token number ${token.replace('-', ' ')}, please proceed to counter ${counter}`
      );
      speechSynthesis.speak(utterance);
    }
  };

  const recallPatient = () => {
    if (currentPatient) {
      speakAnnouncement(currentPatient.ticketNumber || '', counterNumber);
    }
  };

  const completeService = () => {
    if (currentPatient) {
      completeMutation.mutate(currentPatient.id);
    }
  };

  const markNoShow = () => {
    if (currentPatient) {
      noShowMutation.mutate(currentPatient.id);
    }
  };

  const skipPatient = (patient: QueueEntry) => {
    skipMutation.mutate(patient.id);
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent': return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Urgent</span>;
      case 'elderly': return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Elderly</span>;
      case 'pregnant': return <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded text-xs">Pregnant</span>;
      default: return null;
    }
  };

  const getWaitTime = (entry: QueueEntry) => {
    if (!entry.createdAt) return 0;
    const now = new Date();
    const created = new Date(entry.createdAt);
    return Math.floor((now.getTime() - created.getTime()) / 60000);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Volume2 className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Call Next Patient</h1>
            <p className="text-gray-500 text-sm">Manage patient queue and service</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Service Point:</label>
            <select
              value={servicePoint}
              onChange={(e) => setServicePoint(e.target.value)}
              className="px-3 py-1.5 border rounded font-medium"
            >
              {SERVICE_POINTS.map(sp => (
                <option key={sp.value} value={sp.value}>{sp.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Counter/Room:</label>
            <input
              type="text"
              value={counterNumber}
              onChange={(e) => setCounterNumber(e.target.value)}
              className="w-20 px-3 py-1.5 border rounded text-center font-medium"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Left: Current Patient */}
        <div className="flex flex-col gap-4">
          {/* Now Serving */}
          <div className={`card p-4 ${currentPatient ? 'border-2 border-green-500 bg-green-50' : ''}`}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              Now Serving
            </h2>
            {currentPatient ? (
              <div className="text-center py-4">
                <p className="text-4xl font-mono font-bold text-green-600 mb-2">
                  {currentPatient.ticketNumber}
                </p>
                <p className="text-lg font-medium text-gray-900">{currentPatient.patient?.fullName || 'Unknown'}</p>
                <p className="text-sm text-gray-500">{currentPatient.patient?.mrn || ''}</p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={recallPatient}
                    className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Recall
                  </button>
                  <button
                    onClick={completeService}
                    className="flex-1 btn-primary text-sm flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete
                  </button>
                </div>
                <button
                  onClick={markNoShow}
                  className="w-full mt-2 text-sm text-red-600 hover:underline flex items-center justify-center gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  Mark No-Show
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <UserCircle className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p>No patient currently being served</p>
              </div>
            )}
          </div>

          {/* Call Next Button */}
          <button
            onClick={callNextPatient}
            disabled={waitingList.length === 0 || currentPatient !== null || callNextMutation.isPending}
            className="btn-primary py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {callNextMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Volume2 className="w-6 h-6" />
            )}
            Call Next Patient
            {waitingList.length > 0 && (
              <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
                {waitingList.length} waiting
              </span>
            )}
          </button>

          {/* Recently Called */}
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Recently Called</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {recentlyCalled.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No recent calls</p>
              ) : (
                recentlyCalled.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-mono text-sm font-medium">{item.patient.ticketNumber}</p>
                      <p className="text-xs text-gray-500">{item.patient.patient?.fullName || ''}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Waiting List */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Waiting Queue ({waitingList.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : waitingList.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Queue is empty!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {waitingList.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      idx === 0 ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600">{entry.ticketNumber}</span>
                          {getPriorityBadge(String(entry.priority))}
                        </div>
                        <p className="text-sm text-gray-900">{entry.patient?.fullName || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{entry.patient?.mrn || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{getWaitTime(entry)} min</p>
                        <p className="text-xs text-gray-500">waiting</p>
                      </div>
                      <button
                        onClick={() => skipPatient(entry)}
                        className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                        title="Skip to end"
                        disabled={skipMutation.isPending}
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
