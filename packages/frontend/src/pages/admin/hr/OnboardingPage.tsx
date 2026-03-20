import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import hrService from '../../../services/hr';
import { useAuthStore } from '../../../store/auth';
import { toast } from 'sonner';
import {
  UserPlus,
  CheckCircle2,
  Clock,
  AlertCircle,
  ListChecks,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  X,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OnboardingTask {
  id: string;
  employeeId: string;
  taskName: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  dueDate: string;
  completedAt: string | null;
  completedBy: string | null;
  assignedTo: string | null;
  sortOrder: number;
  notes: string | null;
}

interface OnboardingProgress {
  total: number;
  completed: number;
  percentage: number;
}

interface Employee {
  id: string;
  fullName: string;
  employeeNumber: string;
  jobTitle: string;
  department: string | { name: string };
  hireDate: string;
  status: string;
}

type TaskCategory =
  | 'documentation'
  | 'it_setup'
  | 'orientation'
  | 'training'
  | 'compliance'
  | 'equipment'
  | 'access'
  | 'other';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<TaskCategory, { label: string; color: string; bg: string }> = {
  documentation: { label: 'Documentation', color: 'text-blue-700', bg: 'bg-blue-100' },
  it_setup: { label: 'IT Setup', color: 'text-purple-700', bg: 'bg-purple-100' },
  orientation: { label: 'Orientation', color: 'text-green-700', bg: 'bg-green-100' },
  training: { label: 'Training', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  compliance: { label: 'Compliance', color: 'text-red-700', bg: 'bg-red-100' },
  equipment: { label: 'Equipment', color: 'text-gray-700', bg: 'bg-gray-200' },
  access: { label: 'Access', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  other: { label: 'Other', color: 'text-slate-700', bg: 'bg-slate-100' },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-gray-700', bg: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  skipped: { label: 'Skipped', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  overdue: { label: 'Overdue', color: 'text-red-700', bg: 'bg-red-100' },
};

const CATEGORY_ORDER: TaskCategory[] = [
  'documentation',
  'it_setup',
  'orientation',
  'training',
  'compliance',
  'equipment',
  'access',
  'other',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDepartmentName(dept: string | { name: string } | undefined): string {
  if (!dept) return '—';
  if (typeof dept === 'string') return dept;
  return dept.name ?? '—';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date().toDateString();
  return new Date(dateStr).toDateString() === today;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId;

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [addTaskEmployeeId, setAddTaskEmployeeId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Initiate modal state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Add task form state
  const [newTask, setNewTask] = useState({
    taskName: '',
    description: '',
    category: 'other' as TaskCategory,
    dueDate: '',
    assignedTo: '',
    notes: '',
  });

  // ─── Queries ────────────────────────────────────────────────────────────

  const {
    data: employeesRaw = [],
    isLoading: isLoadingEmployees,
    isError: isEmployeesError,
  } = useQuery({
    queryKey: ['onboarding-employees', facilityId],
    queryFn: async () => {
      try {
        const res = await hrService.staff.list({ facilityId });
        return Array.isArray(res) ? res : res?.data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!facilityId,
    staleTime: 60_000,
  });

  const employees: Employee[] = employeesRaw;

  // Fetch tasks for expanded employee
  const {
    data: expandedTasks = [],
    isLoading: isLoadingTasks,
  } = useQuery<OnboardingTask[]>({
    queryKey: ['onboarding-tasks', expandedEmployeeId],
    queryFn: async () => {
      if (!expandedEmployeeId) return [];
      try {
        const tasks = await hrService.onboarding.getTasks(expandedEmployeeId);
        return Array.isArray(tasks) ? tasks : [];
      } catch {
        return [];
      }
    },
    enabled: !!expandedEmployeeId,
  });

  // Fetch progress for expanded employee
  const { data: expandedProgress } = useQuery<OnboardingProgress>({
    queryKey: ['onboarding-progress', expandedEmployeeId],
    queryFn: async () => {
      if (!expandedEmployeeId) return { total: 0, completed: 0, percentage: 0 };
      try {
        return await hrService.onboarding.getProgress(expandedEmployeeId);
      } catch {
        return { total: 0, completed: 0, percentage: 0 };
      }
    },
    enabled: !!expandedEmployeeId,
  });

  // Batch-fetch progress for all employees to compute overview stats
  const { data: allProgressMap = {} } = useQuery<Record<string, OnboardingProgress>>({
    queryKey: ['onboarding-all-progress', employees.map((e) => e.id).join(',')],
    queryFn: async () => {
      const map: Record<string, OnboardingProgress> = {};
      await Promise.all(
        employees.map(async (emp) => {
          try {
            map[emp.id] = await hrService.onboarding.getProgress(emp.id);
          } catch {
            map[emp.id] = { total: 0, completed: 0, percentage: 0 };
          }
        }),
      );
      return map;
    },
    enabled: employees.length > 0,
    staleTime: 60_000,
  });

  // ─── Mutations ──────────────────────────────────────────────────────────

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; notes?: string } }) =>
      hrService.onboarding.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks', expandedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', expandedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-all-progress'] });
      toast.success('Task updated');
    },
    onError: () => {
      toast.error('Failed to update task');
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: ({ employeeId, facilityId: fId }: { employeeId: string; facilityId: string }) =>
      hrService.onboarding.createFromTemplate({ employeeId, facilityId: fId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-all-progress'] });
      toast.success('Onboarding tasks created from template');
      setShowInitiateModal(false);
      setSelectedEmployeeId('');
      setEmployeeSearch('');
    },
    onError: () => {
      toast.error('Failed to create onboarding tasks');
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => hrService.onboarding.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress'] });
      queryClient.invalidateQueries({ queryKey: ['onboarding-all-progress'] });
      toast.success('Task added');
      setShowAddTaskModal(false);
      setNewTask({ taskName: '', description: '', category: 'other', dueDate: '', assignedTo: '', notes: '' });
    },
    onError: () => {
      toast.error('Failed to add task');
    },
  });

  // ─── Computed values ────────────────────────────────────────────────────

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(term) ||
        e.employeeNumber?.toLowerCase().includes(term) ||
        e.jobTitle?.toLowerCase().includes(term) ||
        getDepartmentName(e.department).toLowerCase().includes(term),
    );
  }, [employees, searchTerm]);

  const overviewStats = useMemo(() => {
    const entries = Object.entries(allProgressMap);
    const inOnboarding = entries.filter(([, p]) => p.total > 0 && p.percentage < 100).length;
    const totalCompleted = entries.reduce((sum, [, p]) => sum + p.completed, 0);
    const totalTasks = entries.reduce((sum, [, p]) => sum + p.total, 0);
    const avgCompletion =
      entries.length > 0
        ? Math.round(entries.reduce((sum, [, p]) => sum + p.percentage, 0) / Math.max(entries.length, 1))
        : 0;

    // Approximate "completed today" and "overdue" from expanded tasks if available
    let completedToday = 0;
    let overdueTasks = 0;
    if (expandedTasks.length > 0) {
      completedToday = expandedTasks.filter(
        (t) => t.status === 'completed' && isToday(t.completedAt),
      ).length;
      overdueTasks = expandedTasks.filter(
        (t) => t.status !== 'completed' && t.status !== 'skipped' && isOverdue(t.dueDate),
      ).length;
    }

    return { inOnboarding, completedToday, overdueTasks, avgCompletion, totalCompleted, totalTasks };
  }, [allProgressMap, expandedTasks]);

  const groupedTasks = useMemo(() => {
    const groups: Record<TaskCategory, OnboardingTask[]> = {
      documentation: [],
      it_setup: [],
      orientation: [],
      training: [],
      compliance: [],
      equipment: [],
      access: [],
      other: [],
    };
    expandedTasks.forEach((task) => {
      const cat = groups[task.category] ? task.category : 'other';
      groups[cat].push(task);
    });
    // Sort within each group by sortOrder
    Object.values(groups).forEach((arr) => arr.sort((a, b) => a.sortOrder - b.sortOrder));
    return groups;
  }, [expandedTasks]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const toggleEmployee = useCallback(
    (empId: string) => {
      setExpandedEmployeeId((prev) => (prev === empId ? null : empId));
      setCollapsedCategories(new Set());
    },
    [],
  );

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleToggleTaskComplete = useCallback(
    (task: OnboardingTask) => {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      updateTaskMutation.mutate({ id: task.id, data: { status: newStatus } });
    },
    [updateTaskMutation],
  );

  const handleInitiateOnboarding = useCallback(() => {
    if (!selectedEmployeeId || !facilityId) return;
    createFromTemplateMutation.mutate({ employeeId: selectedEmployeeId, facilityId });
  }, [selectedEmployeeId, facilityId, createFromTemplateMutation]);

  const handleAddTask = useCallback(() => {
    if (!newTask.taskName || !addTaskEmployeeId) return;
    createTaskMutation.mutate({
      employeeId: addTaskEmployeeId,
      taskName: newTask.taskName,
      description: newTask.description,
      category: newTask.category,
      dueDate: newTask.dueDate || undefined,
      assignedTo: newTask.assignedTo || undefined,
      notes: newTask.notes || undefined,
      status: 'pending',
    });
  }, [newTask, addTaskEmployeeId, createTaskMutation]);

  const openAddTaskModal = useCallback((empId: string) => {
    setAddTaskEmployeeId(empId);
    setNewTask({ taskName: '', description: '', category: 'other', dueDate: '', assignedTo: '', notes: '' });
    setShowAddTaskModal(true);
  }, []);

  const modalFilteredEmployees = useMemo(() => {
    const term = employeeSearch.toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(term) ||
        e.employeeNumber?.toLowerCase().includes(term),
    );
  }, [employees, employeeSearch]);

  // ─── Render helpers ─────────────────────────────────────────────────────

  const getProgressForEmployee = (empId: string): OnboardingProgress =>
    allProgressMap[empId] ?? { total: 0, completed: 0, percentage: 0 };

  const renderProgressBar = (percentage: number, size: 'sm' | 'md' = 'sm') => {
    const h = size === 'sm' ? 'h-2' : 'h-3';
    const color =
      percentage >= 100 ? 'bg-green-500' : percentage >= 50 ? 'bg-blue-500' : 'bg-yellow-500';
    return (
      <div className={`w-full bg-gray-200 rounded-full ${h}`}>
        <div
          className={`${color} ${h} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    );
  };

  const renderStatusBadge = (status: TaskStatus) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  const renderCategoryBadge = (category: TaskCategory) => {
    const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.other;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
        {cfg.label}
      </span>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (!facilityId) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No facility selected</p>
          <p className="text-sm mt-1">Please select a facility to view onboarding data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="h-7 w-7 text-blue-600" />
            Employee Onboarding
          </h1>
          <p className="text-gray-600 mt-1">
            Track and manage new employee onboarding progress
          </p>
        </div>
        <button
          onClick={() => setShowInitiateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Initiate Onboarding
        </button>
      </div>

      {/* ── Overview Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">In Onboarding</span>
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserPlus className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-blue-600">
            {overviewStats.inOnboarding}
          </p>
          <p className="text-xs text-gray-500 mt-1">Employees with incomplete tasks</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Completed Today</span>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-green-600">
            {overviewStats.completedToday}
          </p>
          <p className="text-xs text-gray-500 mt-1">Tasks marked done today</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Overdue Tasks</span>
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-red-600">
            {overviewStats.overdueTasks}
          </p>
          <p className="text-xs text-gray-500 mt-1">Tasks past due date</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Avg Completion</span>
            <div className="p-2 bg-indigo-100 rounded-lg">
              <ListChecks className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-indigo-600">
            {overviewStats.avgCompletion}%
          </p>
          <p className="text-xs text-gray-500 mt-1">Average completion rate</p>
        </div>
      </div>

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search employees by name, ID, job title, or department…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Employee List ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {isLoadingEmployees ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 mt-3">Loading employees…</p>
          </div>
        ) : isEmployeesError ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-red-300 mb-3" />
            <p className="text-red-600 font-medium">Failed to load employees</p>
            <p className="text-sm text-gray-500 mt-1">Please try refreshing the page.</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center">
            <UserPlus className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {searchTerm ? 'No employees match your search' : 'No employees found'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm
                ? 'Try adjusting your search terms.'
                : 'Add employees to the staff directory first.'}
            </p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-600">
              <div className="col-span-1" />
              <div className="col-span-3">Employee</div>
              <div className="col-span-2">Hire Date</div>
              <div className="col-span-2">Department</div>
              <div className="col-span-3">Onboarding Progress</div>
              <div className="col-span-1 text-center">Status</div>
            </div>

            {/* Employee rows */}
            {filteredEmployees.map((emp) => {
              const progress = getProgressForEmployee(emp.id);
              const isExpanded = expandedEmployeeId === emp.id;

              return (
                <div key={emp.id} className="border-b last:border-b-0">
                  {/* Row */}
                  <button
                    onClick={() => toggleEmployee(emp.id)}
                    className="w-full grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="col-span-1 flex justify-center">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="col-span-3">
                      <p className="font-medium text-gray-900">{emp.fullName}</p>
                      <p className="text-sm text-gray-500">
                        {emp.employeeNumber ? `#${emp.employeeNumber}` : ''}{' '}
                        {emp.jobTitle ? `· ${emp.jobTitle}` : ''}
                      </p>
                    </div>
                    <div className="col-span-2 text-sm text-gray-600">
                      {formatDate(emp.hireDate)}
                    </div>
                    <div className="col-span-2 text-sm text-gray-600">
                      {getDepartmentName(emp.department)}
                    </div>
                    <div className="col-span-3">
                      {progress.total > 0 ? (
                        <div className="space-y-1">
                          {renderProgressBar(progress.percentage)}
                          <p className="text-xs text-gray-500">
                            {progress.completed}/{progress.total} tasks ({progress.percentage}%)
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No tasks assigned</span>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {progress.total === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          New
                        </span>
                      ) : progress.percentage >= 100 ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Done
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Active
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded task checklist */}
                  {isExpanded && (
                    <div className="bg-gray-50 px-5 pb-5">
                      <div className="border rounded-lg bg-white overflow-hidden">
                        {/* Expanded header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
                          <div className="flex items-center gap-3">
                            <ListChecks className="w-5 h-5 text-blue-600" />
                            <span className="font-semibold text-gray-800">
                              Onboarding Checklist — {emp.fullName}
                            </span>
                            {expandedProgress && (
                              <span className="text-sm text-gray-500">
                                ({expandedProgress.completed}/{expandedProgress.total} complete)
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => openAddTaskModal(emp.id)}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Task
                          </button>
                        </div>

                        {/* Progress summary bar */}
                        {expandedProgress && expandedProgress.total > 0 && (
                          <div className="px-4 py-3 border-b">
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                {renderProgressBar(expandedProgress.percentage, 'md')}
                              </div>
                              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                {expandedProgress.percentage}% Complete
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Task loading state */}
                        {isLoadingTasks ? (
                          <div className="p-8 text-center">
                            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-gray-500 mt-2 text-sm">Loading tasks…</p>
                          </div>
                        ) : expandedTasks.length === 0 ? (
                          <div className="p-8 text-center">
                            <ListChecks className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                            <p className="text-gray-500">No onboarding tasks yet</p>
                            <p className="text-sm text-gray-400 mt-1">
                              Click "Initiate Onboarding" to create tasks from a template, or add tasks manually.
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y">
                            {CATEGORY_ORDER.map((cat) => {
                              const tasks = groupedTasks[cat];
                              if (tasks.length === 0) return null;

                              const catCfg = CATEGORY_CONFIG[cat];
                              const isCollapsed = collapsedCategories.has(cat);
                              const catCompleted = tasks.filter((t) => t.status === 'completed').length;

                              return (
                                <div key={cat}>
                                  {/* Category header */}
                                  <button
                                    onClick={() => toggleCategory(cat)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      {isCollapsed ? (
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                      )}
                                      {renderCategoryBadge(cat)}
                                      <span className="text-sm font-medium text-gray-700">
                                        {catCfg.label}
                                      </span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {catCompleted}/{tasks.length} complete
                                    </span>
                                  </button>

                                  {/* Task list within category */}
                                  {!isCollapsed &&
                                    tasks.map((task) => {
                                      const taskIsOverdue =
                                        task.status !== 'completed' &&
                                        task.status !== 'skipped' &&
                                        isOverdue(task.dueDate);

                                      return (
                                        <div
                                          key={task.id}
                                          className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                                            taskIsOverdue ? 'bg-red-50/50' : ''
                                          }`}
                                        >
                                          {/* Checkbox */}
                                          <button
                                            onClick={() => handleToggleTaskComplete(task)}
                                            disabled={updateTaskMutation.isPending}
                                            className="mt-0.5 flex-shrink-0"
                                          >
                                            {task.status === 'completed' ? (
                                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            ) : (
                                              <div className="w-5 h-5 border-2 border-gray-300 rounded-full hover:border-blue-400 transition-colors" />
                                            )}
                                          </button>

                                          {/* Task info */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span
                                                className={`text-sm font-medium ${
                                                  task.status === 'completed'
                                                    ? 'text-gray-400 line-through'
                                                    : 'text-gray-900'
                                                }`}
                                              >
                                                {task.taskName}
                                              </span>
                                              {renderStatusBadge(
                                                taskIsOverdue ? 'overdue' : task.status,
                                              )}
                                            </div>
                                            {task.description && (
                                              <p className="text-xs text-gray-500 mt-0.5">
                                                {task.description}
                                              </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                              {task.dueDate && (
                                                <span
                                                  className={`flex items-center gap-1 ${
                                                    taskIsOverdue ? 'text-red-500 font-medium' : ''
                                                  }`}
                                                >
                                                  <Clock className="w-3 h-3" />
                                                  Due {formatDate(task.dueDate)}
                                                </span>
                                              )}
                                              {task.assignedTo && (
                                                <span>Assigned to: {task.assignedTo}</span>
                                              )}
                                              {task.completedAt && (
                                                <span className="text-green-600">
                                                  Completed {formatDate(task.completedAt)}
                                                  {task.completedBy ? ` by ${task.completedBy}` : ''}
                                                </span>
                                              )}
                                            </div>
                                            {task.notes && (
                                              <p className="text-xs text-gray-400 mt-1 italic">
                                                Note: {task.notes}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Category completion summary */}
                        {expandedTasks.length > 0 && (
                          <div className="px-4 py-3 border-t bg-gray-50">
                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                              Category Completion
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {CATEGORY_ORDER.map((cat) => {
                                const tasks = groupedTasks[cat];
                                if (tasks.length === 0) return null;
                                const done = tasks.filter((t) => t.status === 'completed').length;
                                const pct = Math.round((done / tasks.length) * 100);
                                const cfg = CATEGORY_CONFIG[cat];

                                return (
                                  <div key={cat} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className={`text-xs font-medium ${cfg.color}`}>
                                        {cfg.label}
                                      </span>
                                      <span className="text-xs text-gray-500">{pct}%</span>
                                    </div>
                                    {renderProgressBar(pct)}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Initiate Onboarding Modal ───────────────────────────────────── */}
      {showInitiateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                Initiate Onboarding
              </h2>
              <button
                onClick={() => {
                  setShowInitiateModal(false);
                  setSelectedEmployeeId('');
                  setEmployeeSearch('');
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Employee search / select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Employee
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or employee number…"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {modalFilteredEmployees.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500 text-center">
                      No employees found
                    </div>
                  ) : (
                    modalFilteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => setSelectedEmployeeId(emp.id)}
                        className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors ${
                          selectedEmployeeId === emp.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{emp.fullName}</p>
                        <p className="text-xs text-gray-500">
                          {emp.employeeNumber ? `#${emp.employeeNumber}` : ''}{' '}
                          {emp.jobTitle ? `· ${emp.jobTitle}` : ''}{' '}
                          {emp.department ? `· ${getDepartmentName(emp.department)}` : ''}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedEmployeeId && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <p className="font-medium">
                    Selected: {employees.find((e) => e.id === selectedEmployeeId)?.fullName}
                  </p>
                  <p className="text-xs mt-1 text-blue-600">
                    This will create 14 default onboarding tasks from the template covering
                    documentation, IT setup, orientation, training, compliance, equipment, and access
                    provisioning.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowInitiateModal(false);
                  setSelectedEmployeeId('');
                  setEmployeeSearch('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateOnboarding}
                disabled={!selectedEmployeeId || createFromTemplateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {createFromTemplateMutation.isPending && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Create from Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Task Modal ──────────────────────────────────────────────── */}
      {showAddTaskModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Add Custom Task
              </h2>
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Complete tax withholding form"
                  value={newTask.taskName}
                  onChange={(e) => setNewTask({ ...newTask, taskName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional description…"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newTask.category}
                    onChange={(e) =>
                      setNewTask({ ...newTask, category: e.target.value as TaskCategory })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CATEGORY_ORDER.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_CONFIG[cat].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned To
                  </label>
                  <input
                    type="text"
                    placeholder="Person responsible"
                    value={newTask.assignedTo}
                    onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    placeholder="Optional notes"
                    value={newTask.notes}
                    onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddTaskModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                disabled={!newTask.taskName || createTaskMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
              >
                {createTaskMutation.isPending && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
