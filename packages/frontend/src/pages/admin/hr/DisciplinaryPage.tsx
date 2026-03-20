import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import hrService from '../../../services/hr';
import { useAuthStore } from '../../../store/auth';
import { toast } from 'sonner';
import {
  Plus,
  AlertTriangle,
  Shield,
  CheckCircle,
  Clock,
  Eye,
  Edit2,
  Search,
  Filter,
  X,
  FileText,
  UserCheck,
  ChevronDown,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Employee {
  id: string;
  fullName: string;
  employeeNumber?: string;
  jobTitle?: string;
}

interface DisciplinaryAction {
  id: string;
  employeeId: string;
  employee: { fullName: string; employeeNumber?: string; jobTitle?: string };
  type: string;
  status: string;
  reason: string;
  incidentDate: string;
  details?: string;
  expectedImprovement?: string;
  consequences?: string;
  issuedBy?: { fullName: string };
  acknowledgedAt?: string;
  resolutionNotes?: string;
  resolutionDate?: string;
  appealNotes?: string;
  followUpDate?: string;
  facilityId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISCIPLINARY_TYPES = [
  { value: 'verbal', label: 'Verbal Warning' },
  { value: 'first_written', label: 'First Written Warning' },
  { value: 'second_written', label: 'Second Written Warning' },
  { value: 'final_warning', label: 'Final Warning' },
  { value: 'suspension', label: 'Suspension' },
  { value: 'termination', label: 'Termination' },
] as const;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'expired', label: 'Expired' },
  { value: 'appealed', label: 'Appealed' },
] as const;

const TYPE_BADGE_COLORS: Record<string, string> = {
  verbal: 'bg-blue-100 text-blue-800',
  first_written: 'bg-yellow-100 text-yellow-800',
  second_written: 'bg-orange-100 text-orange-800',
  final_warning: 'bg-red-100 text-red-800',
  suspension: 'bg-purple-100 text-purple-800',
  termination: 'bg-gray-100 text-gray-800',
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  active: 'bg-red-100 text-red-800',
  resolved: 'bg-green-100 text-green-800',
  escalated: 'bg-orange-100 text-orange-800',
  expired: 'bg-gray-100 text-gray-800',
  appealed: 'bg-blue-100 text-blue-800',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeLabel(value: string): string {
  return DISCIPLINARY_TYPES.find((t) => t.value === value)?.label ?? value;
}

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((s) => s.value === value)?.label ?? value;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function truncate(text: string, max = 48): string {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ---------------------------------------------------------------------------
// Initial form state
// ---------------------------------------------------------------------------

interface CreateForm {
  employeeId: string;
  type: string;
  reason: string;
  incidentDate: string;
  details: string;
  expectedImprovement: string;
  consequences: string;
  followUpDate: string;
}

const INITIAL_CREATE_FORM: CreateForm = {
  employeeId: '',
  type: 'verbal',
  reason: '',
  incidentDate: new Date().toISOString().split('T')[0],
  details: '',
  expectedImprovement: '',
  consequences: '',
  followUpDate: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DisciplinaryPage() {
  const { user } = useAuthStore();
  const facilityId = user?.facilityId;
  const queryClient = useQueryClient();

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<DisciplinaryAction | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(INITIAL_CREATE_FORM);

  // Detail/edit form state
  const [editStatus, setEditStatus] = useState('');
  const [editResolutionNotes, setEditResolutionNotes] = useState('');
  const [editAppealNotes, setEditAppealNotes] = useState('');
  const [editFollowUpDate, setEditFollowUpDate] = useState('');

  // Filters
  const [searchEmployee, setSearchEmployee] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  const {
    data: disciplinaryActions = [],
    isLoading,
    isError,
  } = useQuery<DisciplinaryAction[]>({
    queryKey: ['disciplinary', facilityId],
    queryFn: () => hrService.disciplinary.list({ facilityId: facilityId! }),
    enabled: !!facilityId,
  });

  const { data: staffResponse } = useQuery({
    queryKey: ['staff-list', facilityId],
    queryFn: () => hrService.staff.list({ facilityId: facilityId! }),
    enabled: !!facilityId,
  });

  const staffList: Employee[] = useMemo(
    () => (staffResponse as any)?.data ?? [],
    [staffResponse],
  );

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => hrService.disciplinary.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disciplinary'] });
      toast.success('Disciplinary action created successfully');
      closeCreateModal();
    },
    onError: () => {
      toast.error('Failed to create disciplinary action');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      hrService.disciplinary.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disciplinary'] });
      toast.success('Disciplinary action updated successfully');
      closeDetailModal();
    },
    onError: () => {
      toast.error('Failed to update disciplinary action');
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => hrService.disciplinary.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disciplinary'] });
      toast.success('Action acknowledged');
    },
    onError: () => {
      toast.error('Failed to acknowledge action');
    },
  });

  // -----------------------------------------------------------------------
  // Filtered data + stats
  // -----------------------------------------------------------------------

  const filteredActions = useMemo(() => {
    return disciplinaryActions.filter((a) => {
      if (searchEmployee) {
        const term = searchEmployee.toLowerCase();
        const nameMatch = a.employee?.fullName?.toLowerCase().includes(term);
        const numMatch = a.employee?.employeeNumber?.toLowerCase().includes(term);
        if (!nameMatch && !numMatch) return false;
      }
      if (filterType && a.type !== filterType) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    });
  }, [disciplinaryActions, searchEmployee, filterType, filterStatus]);

  const stats = useMemo(() => {
    const total = disciplinaryActions.length;
    const active = disciplinaryActions.filter((a) => a.status === 'active').length;
    const resolved = disciplinaryActions.filter((a) => a.status === 'resolved').length;
    const pendingFollowUp = disciplinaryActions.filter((a) => {
      if (!a.followUpDate) return false;
      return new Date(a.followUpDate) <= new Date() && a.status === 'active';
    }).length;
    return { total, active, resolved, pendingFollowUp };
  }, [disciplinaryActions]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function openCreateModal() {
    setCreateForm(INITIAL_CREATE_FORM);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreateForm(INITIAL_CREATE_FORM);
  }

  function handleCreate() {
    if (!createForm.employeeId) {
      toast.error('Please select an employee');
      return;
    }
    if (!createForm.reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    createMutation.mutate({
      ...createForm,
      facilityId,
      followUpDate: createForm.followUpDate || undefined,
    });
  }

  function openDetailModal(action: DisciplinaryAction, edit = false) {
    setSelectedAction(action);
    setEditMode(edit);
    setEditStatus(action.status);
    setEditResolutionNotes(action.resolutionNotes ?? '');
    setEditAppealNotes(action.appealNotes ?? '');
    setEditFollowUpDate(action.followUpDate?.split('T')[0] ?? '');
  }

  function closeDetailModal() {
    setSelectedAction(null);
    setEditMode(false);
  }

  function handleUpdate() {
    if (!selectedAction) return;
    updateMutation.mutate({
      id: selectedAction.id,
      data: {
        status: editStatus,
        resolutionNotes: editResolutionNotes || undefined,
        appealNotes: editAppealNotes || undefined,
        followUpDate: editFollowUpDate || undefined,
        resolutionDate: editStatus === 'resolved' ? new Date().toISOString() : undefined,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disciplinary Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track and manage employee disciplinary actions
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Action
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total Actions" value={stats.total} color="gray" />
        <StatCard icon={AlertTriangle} label="Active" value={stats.active} color="red" />
        <StatCard icon={CheckCircle} label="Resolved" value={stats.resolved} color="green" />
        <StatCard icon={Clock} label="Pending Follow-up" value={stats.pendingFollowUp} color="yellow" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee name or number…"
            value={searchEmployee}
            onChange={(e) => setSearchEmployee(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="relative min-w-[160px]">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full appearance-none rounded-md border border-gray-300 py-2 pl-10 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Types</option>
            {DISCIPLINARY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="relative min-w-[160px]">
          <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full appearance-none rounded-md border border-gray-300 py-2 pl-10 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        {(searchEmployee || filterType || filterStatus) && (
          <button
            onClick={() => {
              setSearchEmployee('');
              setFilterType('');
              setFilterStatus('');
            }}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-sm text-gray-500">Loading disciplinary actions…</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-red-500">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p className="text-sm">Failed to load disciplinary actions. Please try again.</p>
          </div>
        ) : filteredActions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Shield className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium text-gray-500">No disciplinary actions found</p>
            <p className="mt-1 text-xs text-gray-400">
              {disciplinaryActions.length > 0
                ? 'Try adjusting your filters'
                : 'Click "New Action" to create one'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Incident Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Follow-up
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredActions.map((action) => (
                  <tr key={action.id} className="hover:bg-gray-50 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {action.employee?.fullName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {action.employee?.employeeNumber}
                        {action.employee?.jobTitle && ` · ${action.employee.jobTitle}`}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          TYPE_BADGE_COLORS[action.type] ?? 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {typeLabel(action.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[220px]">
                      {truncate(action.reason)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatDate(action.incidentDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_BADGE_COLORS[action.status] ?? 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {statusLabel(action.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatDate(action.followUpDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetailModal(action)}
                          title="View"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-indigo-600 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDetailModal(action, true)}
                          title="Edit"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-yellow-600 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {!action.acknowledgedAt && (
                          <button
                            onClick={() => acknowledgeMutation.mutate(action.id)}
                            title="Acknowledge"
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-green-600 transition-colors"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Create Modal                                                        */}
      {/* ------------------------------------------------------------------ */}
      {showCreateModal && (
        <ModalBackdrop onClose={closeCreateModal}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Disciplinary Action</h2>
              <button
                onClick={closeCreateModal}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Employee */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Employee <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.employeeId}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, employeeId: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select employee…</option>
                  {staffList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName}
                      {emp.employeeNumber ? ` (${emp.employeeNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {DISCIPLINARY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Incident Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Incident Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={createForm.incidentDate}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, incidentDate: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Reason */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.reason}
                  onChange={(e) => setCreateForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Brief reason for disciplinary action"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Details */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Details</label>
                <textarea
                  rows={3}
                  value={createForm.details}
                  onChange={(e) => setCreateForm((f) => ({ ...f, details: e.target.value }))}
                  placeholder="Detailed description of the incident…"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Expected Improvement */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Expected Improvement
                </label>
                <textarea
                  rows={2}
                  value={createForm.expectedImprovement}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, expectedImprovement: e.target.value }))
                  }
                  placeholder="What improvement is expected from the employee…"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Consequences */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Consequences</label>
                <textarea
                  rows={2}
                  value={createForm.consequences}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, consequences: e.target.value }))
                  }
                  placeholder="Consequences if improvement is not observed…"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Follow-up Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Follow-up Date <span className="text-xs text-gray-400">(optional)</span>
                </label>
                <input
                  type="date"
                  value={createForm.followUpDate}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, followUpDate: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                onClick={closeCreateModal}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Action
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Detail / Edit Modal                                                 */}
      {/* ------------------------------------------------------------------ */}
      {selectedAction && (
        <ModalBackdrop onClose={closeDetailModal}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editMode ? 'Edit Disciplinary Action' : 'Disciplinary Action Details'}
                </h2>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    STATUS_BADGE_COLORS[selectedAction.status] ?? 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {statusLabel(selectedAction.status)}
                </span>
              </div>
              <button
                onClick={closeDetailModal}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Summary grid */}
              <div className="grid grid-cols-2 gap-4">
                <DetailField label="Employee" value={selectedAction.employee?.fullName} />
                <DetailField
                  label="Employee Number"
                  value={selectedAction.employee?.employeeNumber ?? '—'}
                />
                <DetailField label="Job Title" value={selectedAction.employee?.jobTitle ?? '—'} />
                <DetailField label="Type">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      TYPE_BADGE_COLORS[selectedAction.type] ?? 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {typeLabel(selectedAction.type)}
                  </span>
                </DetailField>
                <DetailField
                  label="Incident Date"
                  value={formatDate(selectedAction.incidentDate)}
                />
                <DetailField
                  label="Issued By"
                  value={selectedAction.issuedBy?.fullName ?? '—'}
                />
                <DetailField
                  label="Acknowledged"
                  value={
                    selectedAction.acknowledgedAt
                      ? formatDate(selectedAction.acknowledgedAt)
                      : 'Not yet'
                  }
                />
                <DetailField label="Created" value={formatDate(selectedAction.createdAt)} />
              </div>

              {/* Text sections */}
              <DetailSection label="Reason" value={selectedAction.reason} />
              <DetailSection label="Details" value={selectedAction.details} />
              <DetailSection
                label="Expected Improvement"
                value={selectedAction.expectedImprovement}
              />
              <DetailSection label="Consequences" value={selectedAction.consequences} />

              {selectedAction.resolutionNotes && !editMode && (
                <DetailSection label="Resolution Notes" value={selectedAction.resolutionNotes} />
              )}
              {selectedAction.appealNotes && !editMode && (
                <DetailSection label="Appeal Notes" value={selectedAction.appealNotes} />
              )}
              {selectedAction.resolutionDate && !editMode && (
                <DetailField
                  label="Resolution Date"
                  value={formatDate(selectedAction.resolutionDate)}
                />
              )}

              {/* Edit fields */}
              {editMode && (
                <div className="space-y-4 rounded-lg border border-indigo-200 bg-indigo-50/30 p-4">
                  <h3 className="text-sm font-semibold text-indigo-900">Update Action</h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Follow-up Date
                      </label>
                      <input
                        type="date"
                        value={editFollowUpDate}
                        onChange={(e) => setEditFollowUpDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Resolution Notes
                      </label>
                      <textarea
                        rows={3}
                        value={editResolutionNotes}
                        onChange={(e) => setEditResolutionNotes(e.target.value)}
                        placeholder="Notes about how this was resolved…"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Appeal Notes
                      </label>
                      <textarea
                        rows={3}
                        value={editAppealNotes}
                        onChange={(e) => setEditAppealNotes(e.target.value)}
                        placeholder="Notes regarding any appeal…"
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              {!editMode ? (
                <>
                  <button
                    onClick={closeDetailModal}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setEditMode(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditMode(false)}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={updateMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'gray' | 'red' | 'green' | 'yellow';
}) {
  const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
    gray: { bg: 'bg-gray-50', icon: 'text-gray-500', text: 'text-gray-900' },
    red: { bg: 'bg-red-50', icon: 'text-red-500', text: 'text-red-900' },
    green: { bg: 'bg-green-50', icon: 'text-green-500', text: 'text-green-900' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-500', text: 'text-yellow-900' },
  };
  const c = colorMap[color];

  return (
    <div className={`rounded-lg border border-gray-200 ${c.bg} p-4 shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-white p-2 shadow-sm`}>
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className={`text-xl font-bold ${c.text}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 mx-4 w-full max-w-2xl">{children}</div>
    </div>
  );
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{children ?? value ?? '—'}</dd>
    </div>
  );
}

function DetailSection({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500">{label}</h4>
      <p className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-700">
        {value}
      </p>
    </div>
  );
}
