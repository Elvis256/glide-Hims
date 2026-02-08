import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  X,
  Trash2,
  Edit2,
  Loader2,
} from 'lucide-react';
import { schedulesService, type DoctorSchedule, type CreateScheduleDto } from '../services/schedules';
import { usersService, type User } from '../services/users';
import ErrorDisplay from '../components/ErrorDisplay';

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekDaysMondayFirst = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function DoctorSchedulesPage() {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DoctorSchedule | null>(null);
  const queryClient = useQueryClient();

  const { data: schedulesData, isLoading, error, refetch } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesService.getAll(),
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors-for-schedule'],
    queryFn: async () => {
      const response = await usersService.list({ search: 'Doctor' });
      return response.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateScheduleDto) => schedulesService.create(data),
    onSuccess: () => {
      toast.success('Schedule created successfully');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setShowAddModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateScheduleDto> }) =>
      schedulesService.update(id, data),
    onSuccess: () => {
      toast.success('Schedule updated successfully');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setEditingSchedule(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulesService.delete(id),
    onSuccess: () => {
      toast.success('Schedule deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const getWeekDates = (offset: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
    return weekDaysMondayFirst.map((_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  };

  const weekDates = getWeekDates(currentWeek);

  const getScheduleForDoctorDay = (doctorId: string, dayOfWeek: number) => {
    return schedulesData?.data?.find(
      (s) => s.doctorId === doctorId && s.dayOfWeek === dayOfWeek
    );
  };

  // Map Monday-first index to Sunday-first (0-6)
  const dayIndexToSundayFirst = (mondayFirstIdx: number) => {
    return mondayFirstIdx === 6 ? 0 : mondayFirstIdx + 1;
  };

  if (error) {
    return <ErrorDisplay error={error} title="Failed to load schedules" onRetry={refetch} />;
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Doctor Schedules</h1>
            <p className="text-gray-500 text-sm">View and manage doctor availability</p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Schedule
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-end mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek(currentWeek - 1)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium px-3">
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
            {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            onClick={() => setCurrentWeek(currentWeek + 1)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {currentWeek !== 0 && (
            <button
              onClick={() => setCurrentWeek(0)}
              className="text-sm text-blue-600 hover:underline ml-2"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="flex-1 card min-h-0 flex flex-col overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-8 border-b bg-gray-50 flex-shrink-0">
          <div className="p-3 font-medium text-sm text-gray-700 border-r">Doctor</div>
          {weekDaysMondayFirst.map((day, idx) => (
            <div key={day} className="p-2 text-center border-r last:border-r-0">
              <p className="text-xs text-gray-500">{day.slice(0, 3)}</p>
              <p className="text-sm font-medium">
                {weekDates[idx].getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* Schedule Rows */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : schedulesData?.grouped && schedulesData.grouped.length > 0 ? (
            schedulesData.grouped.map(({ doctor, schedules }) => (
              <div key={doctor.id} className="grid grid-cols-8 border-b hover:bg-gray-50">
                <div className="p-3 border-r font-medium text-sm">
                  Dr. {doctor.firstName} {doctor.lastName}
                </div>
                {weekDaysMondayFirst.map((_, idx) => {
                  const dayOfWeek = dayIndexToSundayFirst(idx);
                  const schedule = schedules.find((s) => s.dayOfWeek === dayOfWeek);
                  return (
                    <div key={idx} className="p-2 border-r last:border-r-0 min-h-[60px]">
                      {schedule ? (
                        <div 
                          className="bg-green-100 border border-green-200 rounded p-1 text-xs cursor-pointer hover:bg-green-200"
                          onClick={() => setEditingSchedule(schedule)}
                        >
                          <p className="font-medium text-green-800">
                            {schedule.startTime.slice(0, 5)} - {schedule.endTime.slice(0, 5)}
                          </p>
                          <p className="text-green-600">{schedule.maxPatients} slots</p>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-300 text-xs">
                          -
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Calendar className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-600">No schedules configured</p>
              <p className="text-sm text-gray-400 mt-1">Click "Add Schedule" to create doctor schedules</p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-shrink-0 text-xs">
        <span className="text-gray-500">Availability:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          Available
        </span>
        <span className="text-gray-400">Click on a schedule to edit</span>
      </div>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <ScheduleModal
          doctors={doctors || []}
          onClose={() => setShowAddModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Schedule Modal */}
      {editingSchedule && (
        <ScheduleModal
          doctors={doctors || []}
          schedule={editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingSchedule.id, data })}
          onDelete={() => {
            if (confirm('Are you sure you want to delete this schedule?')) {
              deleteMutation.mutate(editingSchedule.id);
              setEditingSchedule(null);
            }
          }}
          isLoading={updateMutation.isPending}
        />
      )}
    </div>
  );
}

interface ScheduleModalProps {
  doctors: User[];
  schedule?: DoctorSchedule;
  onClose: () => void;
  onSubmit: (data: CreateScheduleDto) => void;
  onDelete?: () => void;
  isLoading: boolean;
}

function ScheduleModal({ doctors, schedule, onClose, onSubmit, onDelete, isLoading }: ScheduleModalProps) {
  const [form, setForm] = useState({
    doctorId: schedule?.doctorId || '',
    dayOfWeek: schedule?.dayOfWeek ?? 1,
    startTime: schedule?.startTime?.slice(0, 5) || '08:00',
    endTime: schedule?.endTime?.slice(0, 5) || '17:00',
    slotDuration: schedule?.slotDuration || 15,
    maxPatients: schedule?.maxPatients || 20,
    department: schedule?.department || '',
    notes: schedule?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doctorId) {
      toast.error('Please select a doctor');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {schedule ? 'Edit Schedule' : 'Add Doctor Schedule'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
            <select
              value={form.doctorId}
              onChange={(e) => setForm({ ...form, doctorId: e.target.value })}
              className="input w-full"
              disabled={!!schedule}
            >
              <option value="">Select a doctor</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  Dr. {doc.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week *</label>
            <select
              value={form.dayOfWeek}
              onChange={(e) => setForm({ ...form, dayOfWeek: parseInt(e.target.value) })}
              className="input w-full"
              disabled={!!schedule}
            >
              {weekDays.map((day, idx) => (
                <option key={day} value={idx}>{day}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slot Duration (min)</label>
              <input
                type="number"
                value={form.slotDuration}
                onChange={(e) => setForm({ ...form, slotDuration: parseInt(e.target.value) })}
                className="input w-full"
                min={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Patients</label>
              <input
                type="number"
                value={form.maxPatients}
                onChange={(e) => setForm({ ...form, maxPatients: parseInt(e.target.value) })}
                className="input w-full"
                min={1}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <input
              type="text"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="input w-full"
              placeholder="e.g., General Medicine"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input w-full"
              rows={2}
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex justify-between pt-4 border-t">
            {schedule && onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : schedule ? (
                  'Update'
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
