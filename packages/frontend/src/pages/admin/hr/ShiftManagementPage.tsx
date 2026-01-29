import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Loader2,
  X,
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

const SHIFTS_STORAGE_KEY = 'hr_shifts';
const ASSIGNMENTS_STORAGE_KEY = 'hr_shift_assignments';

const defaultShifts: Shift[] = [
  { id: '1', name: 'Morning Shift', code: 'MS', startTime: '06:00', endTime: '14:00', duration: 8, type: 'Morning', departments: ['Emergency', 'ICU', 'General Ward'], staffCount: 45, status: 'Active' },
  { id: '2', name: 'Day Shift', code: 'DS', startTime: '08:00', endTime: '16:00', duration: 8, type: 'Morning', departments: ['OPD', 'Radiology', 'Laboratory'], staffCount: 60, status: 'Active' },
  { id: '3', name: 'Evening Shift', code: 'ES', startTime: '14:00', endTime: '22:00', duration: 8, type: 'Evening', departments: ['Emergency', 'ICU', 'General Ward'], staffCount: 40, status: 'Active' },
  { id: '4', name: 'Night Shift', code: 'NS', startTime: '22:00', endTime: '06:00', duration: 8, type: 'Night', departments: ['Emergency', 'ICU'], staffCount: 25, status: 'Active' },
  { id: '5', name: 'Extended Day', code: 'ED', startTime: '07:00', endTime: '19:00', duration: 12, type: 'Morning', departments: ['Surgery', 'Cardiology'], staffCount: 20, status: 'Active' },
  { id: '6', name: 'Extended Night', code: 'EN', startTime: '19:00', endTime: '07:00', duration: 12, type: 'Night', departments: ['Surgery', 'ICU'], staffCount: 15, status: 'Active' },
];

const defaultAssignments: StaffAssignment[] = [
  { id: '1', staffName: 'Nurse Emily Davis', staffId: 'EMP003', department: 'Emergency', shift: 'Morning Shift', date: '2024-01-15', status: 'On Duty' },
  { id: '2', staffName: 'Dr. Sarah Johnson', staffId: 'EMP001', department: 'Cardiology', shift: 'Day Shift', date: '2024-01-15', status: 'On Duty' },
  { id: '3', staffName: 'Nurse Amanda White', staffId: 'EMP007', department: 'ICU', shift: 'Evening Shift', date: '2024-01-15', status: 'Scheduled' },
  { id: '4', staffName: 'Dr. Michael Chen', staffId: 'EMP002', department: 'Neurology', shift: 'Day Shift', date: '2024-01-15', status: 'Completed' },
  { id: '5', staffName: 'Dr. James Wilson', staffId: 'EMP004', department: 'Orthopedics', shift: 'Extended Day', date: '2024-01-15', status: 'On Duty' },
];

const getShiftsFromStorage = (): Shift[] => {
  const stored = localStorage.getItem(SHIFTS_STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(defaultShifts));
  return defaultShifts;
};

const saveShiftsToStorage = (shifts: Shift[]): void => {
  localStorage.setItem(SHIFTS_STORAGE_KEY, JSON.stringify(shifts));
};

const getAssignmentsFromStorage = (): StaffAssignment[] => {
  const stored = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(defaultAssignments));
  return defaultAssignments;
};

const saveAssignmentsToStorage = (assignments: StaffAssignment[]): void => {
  localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignments));
};

const DEPARTMENTS = ['Emergency', 'ICU', 'General Ward', 'OPD', 'Radiology', 'Laboratory', 'Surgery', 'Cardiology', 'Neurology', 'Orthopedics'];

type ShiftFormData = Omit<Shift, 'id' | 'duration' | 'staffCount'>;
type AssignmentFormData = Omit<StaffAssignment, 'id'>;

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
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'shifts' | 'assignments' | 'rotation'>('shifts');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<StaffAssignment | null>(null);

  const [shiftForm, setShiftForm] = useState<ShiftFormData>({
    name: '',
    code: '',
    startTime: '08:00',
    endTime: '16:00',
    type: 'Morning',
    departments: [],
    status: 'Active',
  });

  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormData>({
    staffName: '',
    staffId: '',
    department: '',
    shift: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Scheduled',
  });

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts'],
    queryFn: getShiftsFromStorage,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['shiftAssignments'],
    queryFn: getAssignmentsFromStorage,
  });

  const calculateDuration = (start: string, end: string): number => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let hours = endH - startH;
    if (hours < 0) hours += 24;
    const minutes = endM - startM;
    return hours + minutes / 60;
  };

  const createShiftMutation = useMutation({
    mutationFn: async (data: ShiftFormData) => {
      const currentShifts = getShiftsFromStorage();
      const newShift: Shift = {
        ...data,
        id: Date.now().toString(),
        duration: calculateDuration(data.startTime, data.endTime),
        staffCount: 0,
      };
      const updated = [...currentShifts, newShift];
      saveShiftsToStorage(updated);
      return newShift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setShowAddModal(false);
      resetShiftForm();
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ShiftFormData }) => {
      const currentShifts = getShiftsFromStorage();
      const updated = currentShifts.map((s) =>
        s.id === id
          ? { ...s, ...data, duration: calculateDuration(data.startTime, data.endTime) }
          : s
      );
      saveShiftsToStorage(updated);
      return updated.find((s) => s.id === id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setEditingShift(null);
      resetShiftForm();
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const currentShifts = getShiftsFromStorage();
      const updated = currentShifts.filter((s) => s.id !== id);
      saveShiftsToStorage(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: AssignmentFormData) => {
      const currentAssignments = getAssignmentsFromStorage();
      const newAssignment: StaffAssignment = {
        ...data,
        id: Date.now().toString(),
      };
      const updated = [...currentAssignments, newAssignment];
      saveAssignmentsToStorage(updated);
      return newAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftAssignments'] });
      setShowAssignModal(false);
      resetAssignmentForm();
    },
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AssignmentFormData }) => {
      const currentAssignments = getAssignmentsFromStorage();
      const updated = currentAssignments.map((a) =>
        a.id === id ? { ...a, ...data } : a
      );
      saveAssignmentsToStorage(updated);
      return updated.find((a) => a.id === id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shiftAssignments'] });
      setEditingAssignment(null);
      resetAssignmentForm();
    },
  });

  const resetShiftForm = useCallback(() => {
    setShiftForm({
      name: '',
      code: '',
      startTime: '08:00',
      endTime: '16:00',
      type: 'Morning',
      departments: [],
      status: 'Active',
    });
  }, []);

  const resetAssignmentForm = useCallback(() => {
    setAssignmentForm({
      staffName: '',
      staffId: '',
      department: '',
      shift: '',
      date: new Date().toISOString().split('T')[0],
      status: 'Scheduled',
    });
  }, []);

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftForm({
      name: shift.name,
      code: shift.code,
      startTime: shift.startTime,
      endTime: shift.endTime,
      type: shift.type,
      departments: shift.departments,
      status: shift.status,
    });
  };

  const handleDeleteShift = (id: string) => {
    if (window.confirm('Are you sure you want to delete this shift?')) {
      deleteShiftMutation.mutate(id);
    }
  };

  const handleEditAssignment = (assignment: StaffAssignment) => {
    setEditingAssignment(assignment);
    setAssignmentForm({
      staffName: assignment.staffName,
      staffId: assignment.staffId,
      department: assignment.department,
      shift: assignment.shift,
      date: assignment.date,
      status: assignment.status,
    });
  };

  const handleShiftSubmit = () => {
    if (!shiftForm.name || !shiftForm.code) return;
    if (editingShift) {
      updateShiftMutation.mutate({ id: editingShift.id, data: shiftForm });
    } else {
      createShiftMutation.mutate(shiftForm);
    }
  };

  const handleAssignmentSubmit = () => {
    if (!assignmentForm.staffName || !assignmentForm.shift) return;
    if (editingAssignment) {
      updateAssignmentMutation.mutate({ id: editingAssignment.id, data: assignmentForm });
    } else {
      createAssignmentMutation.mutate(assignmentForm);
    }
  };

  const handleDepartmentToggle = (dept: string) => {
    setShiftForm((prev) => ({
      ...prev,
      departments: prev.departments.includes(dept)
        ? prev.departments.filter((d) => d !== dept)
        : [...prev.departments, dept],
    }));
  };

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const matchesSearch =
        shift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shift.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || shift.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [shifts, searchTerm, typeFilter]);

  const stats = useMemo(() => ({
    totalShifts: shifts.length,
    morningShifts: shifts.filter((s) => s.type === 'Morning').length,
    eveningShifts: shifts.filter((s) => s.type === 'Evening').length,
    nightShifts: shifts.filter((s) => s.type === 'Night').length,
  }), [shifts]);

  const weekDays = useMemo(() => {
    const start = new Date(selectedWeek);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      return day;
    });
  }, [selectedWeek]);

  if (shiftsLoading || assignmentsLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

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
                            <button onClick={() => handleEditShift(shift)} className="p-1 hover:bg-gray-100 rounded" title="Edit">
                              <Edit className="h-4 w-4 text-gray-500" />
                            </button>
                            <button onClick={() => handleDeleteShift(shift.id)} className="p-1 hover:bg-gray-100 rounded" title="Delete">
                              <Trash2 className="h-4 w-4 text-red-500" />
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
            <button 
              onClick={() => setShowAssignModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
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
                {assignments.map((assignment) => (
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
                      <button onClick={() => handleEditAssignment(assignment)} className="p-1 hover:bg-gray-100 rounded" title="Edit">
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

      {/* Add/Edit Shift Modal */}
      {(showAddModal || editingShift) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingShift ? 'Edit Shift' : 'Add New Shift'}</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingShift(null);
                  resetShiftForm();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shift Name</label>
                <input
                  type="text"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Morning Shift"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={shiftForm.code}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, code: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="MS"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={shiftForm.type}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, type: e.target.value as Shift['type'] }))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={shiftForm.status}
                  onChange={(e) => setShiftForm((prev) => ({ ...prev, status: e.target.value as Shift['status'] }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departments</label>
                <div className="flex flex-wrap gap-2 border rounded-lg p-3 max-h-32 overflow-y-auto">
                  {DEPARTMENTS.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => handleDepartmentToggle(dept)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        shiftForm.departments.includes(dept)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingShift(null);
                  resetShiftForm();
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleShiftSubmit}
                disabled={createShiftMutation.isPending || updateShiftMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {(createShiftMutation.isPending || updateShiftMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingShift ? 'Update Shift' : 'Add Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {(showAssignModal || editingAssignment) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingAssignment ? 'Edit Assignment' : 'Assign Staff'}</h2>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setEditingAssignment(null);
                  resetAssignmentForm();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Name</label>
                <input
                  type="text"
                  value={assignmentForm.staffName}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, staffName: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Dr. John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={assignmentForm.staffId}
                  onChange={(e) => setAssignmentForm((prev) => ({ ...prev, staffId: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., EMP001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={assignmentForm.department}
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, department: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                  <select
                    value={assignmentForm.shift}
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, shift: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">Select Shift</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={assignmentForm.date}
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={assignmentForm.status}
                    onChange={(e) => setAssignmentForm((prev) => ({ ...prev, status: e.target.value as StaffAssignment['status'] }))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="On Duty">On Duty</option>
                    <option value="Completed">Completed</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setEditingAssignment(null);
                  resetAssignmentForm();
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignmentSubmit}
                disabled={createAssignmentMutation.isPending || updateAssignmentMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {(createAssignmentMutation.isPending || updateAssignmentMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingAssignment ? 'Update Assignment' : 'Assign Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}