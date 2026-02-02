import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  Timer,
  Loader2,
} from 'lucide-react';
import { encountersService, type Encounter } from '../../../services/encounters';

type AppointmentStatus = 'scheduled' | 'in-progress' | 'completed' | 'no-show';

interface Appointment {
  id: string;
  patientName: string;
  time: string;
  duration: number; // minutes
  type: 'scheduled' | 'walk-in';
  status: AppointmentStatus;
  reason: string;
}

// Transform encounter status to appointment status
function mapEncounterStatus(status: Encounter['status']): AppointmentStatus {
  switch (status) {
    case 'waiting':
      return 'scheduled';
    case 'in_consultation':
      return 'in-progress';
    case 'completed':
    case 'discharged':
      return 'completed';
    case 'cancelled':
      return 'no-show';
    default:
      return 'scheduled';
  }
}

// Transform encounters to appointments
function transformEncounters(encounters: Encounter[]): Appointment[] {
  return encounters.map((encounter) => {
    const visitTime = new Date(encounter.visitDate);
    const time = visitTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    return {
      id: encounter.id,
      patientName: encounter.patient?.fullName || 'Unknown Patient',
      time,
      duration: 30, // Default duration
      type: encounter.type === 'emergency' ? 'walk-in' : 'scheduled',
      status: mapEncounterStatus(encounter.status),
      reason: encounter.chiefComplaint || encounter.department || 'Consultation',
    };
  });
}

const statusConfig: Record<AppointmentStatus, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock, label: 'Scheduled' },
  'in-progress': { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle, label: 'In Progress' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle, label: 'Completed' },
  'no-show': { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle, label: 'No Show' },
};

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00',
];

export default function TodaySchedulePage() {
  const { data: encounters = [], isLoading } = useQuery({
    queryKey: ['encounters', 'queue'],
    queryFn: () => encountersService.getQueue(),
  });

  const appointments = useMemo(() => transformEncounters(encounters), [encounters]);

  const stats = useMemo(() => {
    const total = appointments.length;
    const completed = appointments.filter((a) => a.status === 'completed').length;
    const remaining = appointments.filter((a) => a.status === 'scheduled' || a.status === 'in-progress').length;
    const noShow = appointments.filter((a) => a.status === 'no-show').length;
    const totalMinutes = appointments.filter((a) => a.status === 'completed').reduce((acc, a) => acc + a.duration, 0);
    const avgTime = completed > 0 ? Math.round(totalMinutes / completed) : 0;

    return { total, completed, remaining, noShow, avgTime };
  }, [appointments]);

  const getAppointmentForSlot = (slot: string) => {
    return appointments.find((a) => a.time === slot);
  };

  const currentTime = '10:45'; // Mock current time for demonstration

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Today's Schedule</h1>
            <p className="text-gray-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-4">
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-xs text-gray-500">Completed</p>
              <p className="text-lg font-bold text-green-600">{stats.completed}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border flex items-center gap-3">
            <Clock className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-xs text-gray-500">Remaining</p>
              <p className="text-lg font-bold text-orange-600">{stats.remaining}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border flex items-center gap-3">
            <Timer className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-xs text-gray-500">Avg Time</p>
              <p className="text-lg font-bold text-purple-600">{stats.avgTime}m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        {Object.entries(statusConfig).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <div className={`w-3 h-3 rounded-full ${config.bg.replace('100', '500')}`} />
              <span className="text-gray-600">{config.label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-sm ml-4">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-gray-600">Walk-in</span>
        </div>
      </div>

      {/* Timeline View */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Calendar className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-lg font-medium">No appointments scheduled</p>
            <p className="text-sm">Today's schedule is empty</p>
          </div>
        ) : (
        <div className="bg-white rounded-xl shadow-sm border">
          {timeSlots.map((slot, index) => {
            const appointment = getAppointmentForSlot(slot);
            const isCurrentSlot = slot === '10:30';
            const isPast = slot < currentTime;

            return (
              <div
                key={slot}
                className={`flex border-b last:border-b-0 ${
                  isCurrentSlot ? 'bg-yellow-50' : isPast ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                {/* Time Column */}
                <div className={`w-24 flex-shrink-0 px-4 py-3 border-r ${
                  isCurrentSlot ? 'bg-yellow-100' : 'bg-gray-50'
                }`}>
                  <span className={`font-mono text-sm ${isCurrentSlot ? 'font-bold text-yellow-700' : 'text-gray-600'}`}>
                    {slot}
                  </span>
                  {isCurrentSlot && (
                    <div className="text-xs text-yellow-600 font-medium">NOW</div>
                  )}
                </div>

                {/* Appointment Content */}
                <div className="flex-1 px-4 py-3">
                  {appointment ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-2 h-12 rounded-full ${
                            statusConfig[appointment.status].bg.replace('100', '500')
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {appointment.patientName}
                            </span>
                            {appointment.type === 'walk-in' && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                Walk-in
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{appointment.reason}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400">
                          {appointment.duration} min
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            statusConfig[appointment.status].bg
                          } ${statusConfig[appointment.status].text}`}
                        >
                          {(() => {
                            const Icon = statusConfig[appointment.status].icon;
                            return <Icon className="w-3 h-3" />;
                          })()}
                          {statusConfig[appointment.status].label}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-300 text-sm italic">Available</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
