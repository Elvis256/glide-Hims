import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { facilitiesService } from '../services/facilities';
import { usersService } from '../services/users';

interface DoctorSchedule {
  id: string;
  name: string;
  department: string;
  specialization: string;
  schedule: {
    day: string;
    startTime: string;
    endTime: string;
    slots: number;
    booked: number;
  }[];
}

const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Default schedule for doctors (placeholder until real schedule API is available)
const defaultSchedule = [
  { day: 'Monday', startTime: '08:00', endTime: '16:00', slots: 16, booked: 0 },
  { day: 'Tuesday', startTime: '08:00', endTime: '16:00', slots: 16, booked: 0 },
  { day: 'Wednesday', startTime: '08:00', endTime: '16:00', slots: 16, booked: 0 },
  { day: 'Thursday', startTime: '08:00', endTime: '16:00', slots: 16, booked: 0 },
  { day: 'Friday', startTime: '08:00', endTime: '16:00', slots: 16, booked: 0 },
];

export default function DoctorSchedulesPage() {
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [currentWeek, setCurrentWeek] = useState(0);

  // Fetch departments from API
  const { data: departmentsData = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => facilitiesService.departments.listAll(),
  });

  // Fetch users (doctors) from API
  const { data: usersData, isLoading: doctorsLoading } = useQuery({
    queryKey: ['users-doctors'],
    queryFn: () => usersService.list({ status: 'active', limit: 100 }),
  });

  const isLoading = departmentsLoading || doctorsLoading;

  // Transform users into DoctorSchedule format
  const doctors: DoctorSchedule[] = useMemo(() => {
    const users = usersData?.data || [];
    return users.map((user, index) => {
      // Assign department based on user index to distribute across departments
      const deptName = departmentsData.length > 0
        ? departmentsData[index % departmentsData.length]?.name || 'General'
        : 'General';
      
      return {
        id: user.id,
        name: user.fullName.startsWith('Dr.') ? user.fullName : `Dr. ${user.fullName}`,
        department: deptName,
        specialization: deptName,
        schedule: defaultSchedule,
      };
    });
  }, [usersData, departmentsData]);

  const departments = useMemo(() => {
    return departmentsData.map((d) => d.name);
  }, [departmentsData]);

  const filteredDoctors = selectedDept === 'all'
    ? doctors
    : doctors.filter(d => d.department === selectedDept);

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

  const getAvailability = (slots: number, booked: number) => {
    const available = slots - booked;
    const percentage = (available / slots) * 100;
    if (percentage > 50) return 'bg-green-100 text-green-700 border-green-200';
    if (percentage > 20) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

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

      {/* Filters & Week Navigation */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              selectedDept === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            All Departments
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                selectedDept === dept ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
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

        {/* Doctor Rows */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              Loading schedules...
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              No doctors found
            </div>
          ) : (
            filteredDoctors.map((doctor) => (
            <div key={doctor.id} className="grid grid-cols-8 border-b hover:bg-gray-50">
              {/* Doctor Info */}
              <div className="p-3 border-r">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Stethoscope className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">{doctor.name}</p>
                    <p className="text-xs text-gray-500">{doctor.department}</p>
                  </div>
                </div>
              </div>

              {/* Schedule Cells */}
              {weekDays.map((day) => {
                const schedule = doctor.schedule.find(s => s.day === day);
                return (
                  <div key={day} className="p-1 border-r last:border-r-0 flex items-center justify-center">
                    {schedule ? (
                      <div className={`w-full h-full p-1.5 rounded border text-center ${getAvailability(schedule.slots, schedule.booked)}`}>
                        <p className="text-xs font-medium">
                          {schedule.startTime}-{schedule.endTime}
                        </p>
                        <p className="text-xs">
                          {schedule.slots - schedule.booked}/{schedule.slots} free
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">Off</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
          )}
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
