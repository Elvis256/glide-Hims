import { useState, useMemo } from 'react';
import {
  Clock,
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  Building2,
  Sun,
  Moon,
  Sunset,
  Calendar,
  RefreshCw,
  Filter,
  MoreVertical,
  UserPlus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Shift {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  duration: number;
  type: 'Morning' | 'Evening' | 'Night';
  departments: string[];
  staffCount: number;
  status: 'Active' | 'Inactive';
}

interface StaffAssignment {
  id: string;
  staffName: string;
  staffId: string;
  department: string;
  shift: string;
  date: string;
  status: 'Scheduled' | 'On Duty' | 'Completed' | 'Absent';
}

const mockShifts: Shift[] = [
  { id: '1', name: 'Morning Shift', code: 'MS', startTime: '06:00', endTime: '14:00', duration: 8, type: 'Morning', departments: ['Emergency', 'ICU', 'General Ward'], staffCount: 45, status: 'Active' },
  { id: '2', name: 'Day Shift', code: 'DS', startTime: '08:00', endTime: '16:00', duration: 8, type: 'Morning', departments: ['OPD', 'Radiology', 'Laboratory'], staffCount: 60, status: 'Active' },
  { id: '3', name: 'Evening Shift', code: 'ES', startTime: '14:00', endTime: '22:00', duration: 8, type: 'Evening', departments: ['Emergency', 'ICU', 'General Ward'], staffCount: 40, status: 'Active' },
  { id: '4', name: 'Night Shift', code: 'NS', startTime: '22:00', endTime: '06:00', duration: 8, type: 'Night', departments: ['Emergency', 'ICU'], staffCount: 25, status: 'Active' },
  { id: '5', name: 'Extended Day', code: 'ED', startTime: '07:00', endTime: '19:00', duration: 12, type: 'Morning', departments: ['Surgery', 'Cardiology'], staffCount: 20, status: 'Active' },
  { id: '6', name: 'Extended Night', code: 'EN', startTime: '19:00', endTime: '07:00', duration: 12, type: 'Night', departments: ['Surgery', 'ICU'], staffCount: 15, status: 'Active' },
];

const mockAssignments: StaffAssignment[] = [
  { id: '1', staffName: 'Nurse Emily Davis', staffId: 'EMP003', department: 'Emergency', shift: 'Morning Shift', date: '2024-01-15', status: 'On Duty' },
  { id: '2', staffName: 'Dr. Sarah Johnson', staffId: 'EMP001', department: 'Cardiology', shift: 'Day Shift', date: '2024-01-15', status: 'On Duty' },
  { id: '3', staffName: 'Nurse Amanda White', staffId: 'EMP007', department: 'ICU', shift: 'Evening Shift', date: '2024-01-15', status: 'Scheduled' },
  { id: '4', staffName: 'Dr. Michael Chen', staffId: 'EMP002', department: 'Neurology', shift: 'Day Shift', date: '2024-01-15', status: 'Completed' },
  { id: '5', staffName: 'Dr. James Wilson', staffId: 'EMP004', department: 'Orthopedics', shift: 'Extended Day', date: '2024-01-15', status: 'On Duty' },
];

const shiftTypeConfig = {
  Morning: { color: 'bg-yellow-100 text-yellow-800', icon: Sun },
  Evening: { color: 'bg-orange-100 text-orange-800', icon: Sunset },
  Night: { color: 'bg-indigo-100 text-indigo-800', icon: Moon },
};

const statusConfig = {
  Scheduled: 'bg-blue-100 text-blue-800',
  'On Duty': 'bg-green-100 text-green-800',
  Completed: 'bg-gray-100 text-gray-800',
  Absent: 'bg-red-100 text-red-800',
};

export default function ShiftManagementPage() {
  const [activeTab, setActiveTab] = useState<'shifts' | 'assignments' | 'rotation'>('shifts');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(new Date());

  const filteredShifts = useMemo(() => {
    return mockShifts.filter((shift) => {
      const matchesSearch =
        shift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shift.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || shift.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [searchTerm, typeFilter]);

  const stats = useMemo(() => ({
    totalShifts: mockShifts.length,
    morningShifts: mockShifts.filter((s) => s.type === 'Morning').length,
    eveningShifts: mockShifts.filter((s) => s.type === 'Evening').length,
    nightShifts: mockShifts.filter((s) => s.type === 'Night').length,
  }), []);

  const weekDays = useMemo(() => {
    const start = new Date(selectedWeek);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [selectedWeek]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-7 w-7 text-blue-600" />
              Shift Management
            </h1>
            <p className="text-gray-600 mt-1">Manage shifts, assignments, and rotation schedules</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Shift
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Shifts</span>
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalShifts}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Morning</span>
              <Sun className="h-5 w-5 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.morningShifts}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Evening</span>
              <Sunset className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.eveningShifts}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Night</span>
              <Moon className="h-5 w-5 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.nightShifts}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-1 mb-4 flex gap-1 w-fit">
        <button
          onClick={() => setActiveTab('shifts')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'shifts' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="h-4 w-4 inline mr-2" />
          Shift Definitions
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'assignments' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <UserPlus className="h-4 w-4 inline mr-2" />
          Staff Assignments
        </button>
        <button
          onClick={() => setActiveTab('rotation')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'rotation' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <RefreshCw className="h-4 w-4 inline mr-2" />
          Rotation Schedule
        </button>
      </div>

      {/* Content */}
      {activeTab === 'shifts' && (
        <>
          {/* Filters */}
          <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search shifts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="Morning">Morning</option>
                  <option value="Evening">Evening</option>
                  <option value="Night">Night</option>
                </select>
              </div>
            </div>
          </div>

          {/* Shifts Table */}
          <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Shift</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Code</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Timing</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Duration</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Departments</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredShifts.map((shift) => {
                    const TypeIcon = shiftTypeConfig[shift.type].icon;
                    return (
                      <tr key={shift.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${shiftTypeConfig[shift.type].color}`}>
                              <TypeIcon className="h-5 w-5" />
                            </div>
                            <span className="font-medium text-gray-900">{shift.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{shift.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700">{shift.startTime} - {shift.endTime}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-600">{shift.duration} hours</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {shift.departments.slice(0, 2).map((dept) => (
                              <span key={dept} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{dept}</span>
                            ))}
                            {shift.departments.length > 2 && (
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">+{shift.departments.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{shift.staffCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            shift.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {shift.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                              <Edit className="h-4 w-4 text-gray-500" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded" title="Delete">
                              <Trash2 className="h-4 w-4 text-gray-500" />
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded" title="More">
                              <MoreVertical className="h-4 w-4 text-gray-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'assignments' && (
        <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Today's Assignments</h3>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <UserPlus className="h-4 w-4" />
              Assign Staff
            </button>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Employee ID</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Shift</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{assignment.staffName}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">{assignment.staffId}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">{assignment.department}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{assignment.shift}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">{assignment.date}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[assignment.status]}`}>
                        {assignment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
                        <Edit className="h-4 w-4 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rotation' && (
        <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const prev = new Date(selectedWeek);
                  prev.setDate(prev.getDate() - 7);
                  setSelectedWeek(prev);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="font-semibold">
                Week of {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </h3>
              <button
                onClick={() => {
                  const next = new Date(selectedWeek);
                  next.setDate(next.getDate() + 7);
                  setSelectedWeek(next);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <RefreshCw className="h-4 w-4" />
              Generate Rotation
            </button>
          </div>
          <div className="overflow-auto flex-1 p-4">
            <div className="grid grid-cols-8 gap-2">
              <div className="font-medium text-gray-600 py-2">Staff</div>
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="text-center font-medium text-gray-600 py-2">
                  <div className="text-xs text-gray-400">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div>{day.getDate()}</div>
                </div>
              ))}
              {/* Sample rotation data */}
              {['Nurse Emily Davis', 'Dr. Sarah Johnson', 'Nurse Amanda White', 'Dr. Michael Chen'].map((staff) => (
                <>
                  <div key={staff} className="py-3 text-sm font-medium text-gray-900">{staff}</div>
                  {weekDays.map((day, i) => {
                    const shifts = ['MS', 'DS', 'ES', 'NS', 'OFF'];
                    const randomShift = shifts[Math.floor((i + staff.length) % shifts.length)];
                    const colors: Record<string, string> = {
                      MS: 'bg-yellow-100 text-yellow-800',
                      DS: 'bg-blue-100 text-blue-800',
                      ES: 'bg-orange-100 text-orange-800',
                      NS: 'bg-indigo-100 text-indigo-800',
                      OFF: 'bg-gray-100 text-gray-500',
                    };
                    return (
                      <div key={day.toISOString()} className="py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${colors[randomShift]}`}>
                          {randomShift}
                        </span>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Add New Shift</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift Name</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="e.g., Morning Shift" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="MS" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select className="w-full border rounded-lg px-3 py-2">
                    <option>Morning</option>
                    <option>Evening</option>
                    <option>Night</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departments</label>
                <select className="w-full border rounded-lg px-3 py-2" multiple>
                  <option>Emergency</option>
                  <option>ICU</option>
                  <option>General Ward</option>
                  <option>OPD</option>
                  <option>Surgery</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Shift</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}