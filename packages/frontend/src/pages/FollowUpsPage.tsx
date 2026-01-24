import { useState, useEffect } from 'react';
import api from '../services/api';

interface FollowUp {
  id: string;
  appointmentNumber: string;
  type: string;
  status: string;
  priority: string;
  scheduledDate: string;
  scheduledTime: string;
  reason: string;
  patient: {
    fullName: string;
    mrn: string;
    phone: string;
  };
  provider?: { fullName: string };
  department?: { name: string };
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
  checked_in: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-gray-100 text-gray-800',
  missed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  rescheduled: 'bg-orange-100 text-orange-800',
};

const typeLabels: Record<string, string> = {
  routine: 'Routine Follow-up',
  post_procedure: 'Post Procedure',
  lab_review: 'Lab Review',
  imaging_review: 'Imaging Review',
  medication_review: 'Medication Review',
  chronic_care: 'Chronic Care',
  wound_care: 'Wound Care',
  post_discharge: 'Post Discharge',
  vaccination: 'Vaccination',
  anc: 'ANC Visit',
  pnc: 'PNC Visit',
  immunization: 'Immunization',
};

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [todaysAppointments, setTodaysAppointments] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'today' | 'all'>('today');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [activeView]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeView === 'today') {
        const response = await api.get('/follow-ups/today');
        setTodaysAppointments(response.data);
      } else {
        const response = await api.get('/follow-ups');
        setFollowUps(response.data);
      }
      const statsResponse = await api.get('/follow-ups/stats');
      setStats(statsResponse.data);
    } catch (error) {
      console.error('Failed to load follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkIn = async (id: string) => {
    try {
      await api.post(`/follow-ups/${id}/check-in`);
      loadData();
    } catch (error) {
      console.error('Failed to check in:', error);
    }
  };

  const complete = async (id: string) => {
    try {
      await api.post(`/follow-ups/${id}/complete`, {});
      loadData();
    } catch (error) {
      console.error('Failed to complete:', error);
    }
  };

  const reschedule = async (id: string) => {
    const newDate = prompt('Enter new date (YYYY-MM-DD):');
    if (newDate) {
      try {
        await api.post(`/follow-ups/${id}/reschedule`, { newDate });
        loadData();
      } catch (error) {
        console.error('Failed to reschedule:', error);
      }
    }
  };

  const markMissed = async (id: string) => {
    try {
      await api.post(`/follow-ups/${id}/mark-missed`, { reason: 'Patient did not show' });
      loadData();
    } catch (error) {
      console.error('Failed to mark as missed:', error);
    }
  };

  const displayData = activeView === 'today' ? todaysAppointments : followUps;

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Follow-up Appointments</h1>
          <p className="text-gray-600">Manage scheduled follow-up visits</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + Schedule Follow-up
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-700">Total</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-green-700">Completed</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.missed}</div>
            <div className="text-sm text-red-700">Missed</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{stats.cancelled}</div>
            <div className="text-sm text-gray-700">Cancelled</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.completionRate}%</div>
            <div className="text-sm text-purple-700">Completion Rate</div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveView('today')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeView === 'today'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📅 Today's Appointments
        </button>
        <button
          onClick={() => setActiveView('all')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeView === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📋 All Appointments
        </button>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : displayData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No appointments found</div>
        ) : (
          <div className="divide-y">
            {displayData.map((appointment) => (
              <div key={appointment.id} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-blue-600">{appointment.appointmentNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[appointment.status]}`}>
                        {appointment.status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                        {typeLabels[appointment.type] || appointment.type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Patient</div>
                        <div className="font-medium">{appointment.patient?.fullName}</div>
                        <div className="text-gray-500">MRN: {appointment.patient?.mrn}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Date & Time</div>
                        <div className="font-medium">
                          {new Date(appointment.scheduledDate).toLocaleDateString()}
                        </div>
                        <div className="text-gray-500">{appointment.scheduledTime || 'Time TBD'}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Department</div>
                        <div className="font-medium">{appointment.department?.name || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Provider</div>
                        <div className="font-medium">{appointment.provider?.fullName || 'Any Available'}</div>
                      </div>
                    </div>
                    {appointment.reason && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Reason:</span> {appointment.reason}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 ml-4">
                    {appointment.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => checkIn(appointment.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Check In
                        </button>
                        <button
                          onClick={() => reschedule(appointment.id)}
                          className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                        >
                          Reschedule
                        </button>
                      </>
                    )}
                    {appointment.status === 'checked_in' && (
                      <button
                        onClick={() => complete(appointment.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Complete
                      </button>
                    )}
                    {['scheduled', 'confirmed'].includes(appointment.status) && (
                      <button
                        onClick={() => markMissed(appointment.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                      >
                        No Show
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
