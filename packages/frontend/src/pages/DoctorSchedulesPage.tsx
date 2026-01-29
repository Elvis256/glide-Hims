import { useState } from 'react';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
} from 'lucide-react';

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function DoctorSchedulesPage() {
  const [currentWeek, setCurrentWeek] = useState(0);

  const getWeekDates = (offset: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
    return weekDays.map((_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    });
  };

  const weekDates = getWeekDates(currentWeek);

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
        <button className="btn-primary flex items-center gap-2">
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
          {weekDays.map((day, idx) => (
            <div key={day} className="p-2 text-center border-r last:border-r-0">
              <p className="text-xs text-gray-500">{day.slice(0, 3)}</p>
              <p className="text-sm font-medium">
                {weekDates[idx].getDate()}
              </p>
            </div>
          ))}
        </div>

        {/* Empty State */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Calendar className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-600">No schedules configured</p>
            <p className="text-sm text-gray-400 mt-1">Click "Add Schedule" to create doctor schedules</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 flex-shrink-0 text-xs">
        <span className="text-gray-500">Availability:</span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-200" />
          High ({'>'}50%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" />
          Medium (20-50%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          Low ({'<'}20%)
        </span>
      </div>
    </div>
  );
}
