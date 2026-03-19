import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Star, Users, TrendingUp, Calendar, Plus, Loader2, Eye, Edit, Search, Trash2, Download } from 'lucide-react';
import { hrService, type Appraisal, type CreateAppraisalDto, type BulkCreateAppraisalDto, type Employee } from '../../../services/hr';
import { facilitiesService } from '../../../services';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'self_review', label: 'Self Review' },
  { key: 'manager_review', label: 'Manager Review' },
  { key: 'completed', label: 'Completed' },
  { key: 'acknowledged', label: 'Acknowledged' },
];

const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'annual', 'probation'];

export default function AppraisalsPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState<Partial<CreateAppraisalDto>>({
    appraisalPeriod: 'Q1',
    year: new Date().getFullYear(),
  });
  const [bulkData, setBulkData] = useState<Partial<BulkCreateAppraisalDto>>({
    appraisalPeriod: 'Q1',
    year: new Date().getFullYear(),
  });
  const queryClient = useQueryClient();

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      try { return await facilitiesService.list(); }
      catch { return []; }
    },
  });
  const facilityId = facilities[0]?.id;

  const { data: employeesData } = useQuery({
    queryKey: ['employees', facilityId],
    queryFn: async () => {
      try {
        const res = await hrService.employees.list({ facilityId: facilityId! });
        return Array.isArray(res) ? res : (res as { data: Employee[] }).data || [];
      } catch { return []; }
    },
    enabled: !!facilityId,
  });
  const employees = employeesData || [];

  const { data: appraisals = [], isLoading } = useQuery({
    queryKey: ['appraisals', facilityId, selectedYear],
    queryFn: async () => {
      try {
        return await hrService.appraisals.list({ facilityId, year: selectedYear });
      } catch { return []; }
    },
    enabled: !!facilityId,
  });

  const { data: stats } = useQuery({
    queryKey: ['appraisal-stats', facilityId, selectedYear],
    queryFn: async () => {
      try {
        return await hrService.appraisals.getStats(facilityId!, selectedYear);
      } catch { return { total: 0, pending: 0, completed: 0, averageRating: null }; }
    },
    enabled: !!facilityId && !!selectedYear,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateAppraisalDto) => hrService.appraisals.create(data),
    onSuccess: () => {
      toast.success('Appraisal created');
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal-stats'] });
      setShowModal(false);
      setFormData({ appraisalPeriod: 'Q1', year: new Date().getFullYear() });
    },
    onError: () => toast.error('Failed to create appraisal'),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (data: BulkCreateAppraisalDto) => hrService.appraisals.bulkCreate(data),
    onSuccess: (result) => {
      toast.success(`Created ${result.created} appraisals (${result.skipped} skipped)`);
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal-stats'] });
      setShowBulkModal(false);
    },
    onError: () => toast.error('Failed to create bulk appraisals'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => hrService.appraisals.delete(id),
    onSuccess: () => {
      toast.success('Appraisal deleted');
      queryClient.invalidateQueries({ queryKey: ['appraisals'] });
      queryClient.invalidateQueries({ queryKey: ['appraisal-stats'] });
    },
    onError: () => toast.error('Only draft appraisals can be deleted'),
  });

  const handleCreate = () => {
    if (!formData.employeeId || !formData.reviewerId || !facilityId) return;
    createMutation.mutate({ ...formData, facilityId } as CreateAppraisalDto);
  };

  const handleBulkCreate = () => {
    if (!bulkData.department || !bulkData.reviewerId || !facilityId) return;
    bulkCreateMutation.mutate({ ...bulkData, facilityId } as BulkCreateAppraisalDto);
  };

  // Get unique departments from employees
  const departments = [...new Set(employees.map((e: Employee) => e.department).filter(Boolean))];

  // Filtered appraisals
  const filtered = appraisals.filter((a: Appraisal) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (periodFilter !== 'all' && a.appraisalPeriod !== periodFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = a.employee?.fullName?.toLowerCase() || '';
      const dept = a.employee?.department?.toLowerCase() || '';
      if (!name.includes(q) && !dept.includes(q)) return false;
    }
    return true;
  });

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    self_review: 'bg-yellow-100 text-yellow-800',
    manager_review: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    acknowledged: 'bg-purple-100 text-purple-800',
  };

  const renderStars = (rating: number | undefined) => {
    if (!rating) return <span className="text-gray-400">—</span>;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({Number(rating).toFixed(1)})</span>
      </div>
    );
  };

  if (!facilityId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Please configure a facility first</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Performance Appraisals</h1>
          <p className="text-gray-500">Manage staff performance reviews and evaluations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2 text-sm"
          >
            <Users className="w-4 h-4" />
            Bulk Create
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Appraisal
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Users className="w-6 h-6 text-blue-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Total Appraisals</p>
              <p className="text-2xl font-bold">{stats?.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Calendar className="w-6 h-6 text-yellow-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold">{stats?.pending || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><Star className="w-6 h-6 text-green-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold">{stats?.completed || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp className="w-6 h-6 text-purple-600" /></div>
            <div>
              <p className="text-sm text-gray-500">Avg. Rating</p>
              <p className="text-2xl font-bold">{stats?.averageRating || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        {/* Status Tabs */}
        <div className="flex border-b overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                statusFilter === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.key !== 'all' && (
                <span className="ml-1 text-xs">
                  ({appraisals.filter((a: Appraisal) => a.status === tab.key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search & Filters Row */}
        <div className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by employee name or department..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border rounded-lg text-sm"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          >
            <option value="all">All Periods</option>
            {PERIODS.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 border rounded-lg text-sm"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Employee</th>
                <th className="text-left p-4 font-medium text-gray-600">Department</th>
                <th className="text-left p-4 font-medium text-gray-600">Reviewer</th>
                <th className="text-left p-4 font-medium text-gray-600">Period</th>
                <th className="text-left p-4 font-medium text-gray-600">Rating</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <Star className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No appraisal records found</p>
                    <p className="text-sm">
                      {searchQuery || statusFilter !== 'all' || periodFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Create an appraisal to start evaluating staff performance'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((appraisal: Appraisal) => (
                  <tr
                    key={appraisal.id}
                    className="border-t hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/hr/appraisals/${appraisal.id}`)}
                  >
                    <td className="p-4">
                      <p className="font-medium">{appraisal.employee?.fullName || '—'}</p>
                    </td>
                    <td className="p-4 text-gray-600">{appraisal.employee?.department || '—'}</td>
                    <td className="p-4 text-gray-600">{appraisal.reviewer?.fullName || '—'}</td>
                    <td className="p-4 text-gray-600">{appraisal.appraisalPeriod} {appraisal.year}</td>
                    <td className="p-4">{renderStars(appraisal.overallRating)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[appraisal.status]}`}>
                        {appraisal.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigate(`/hr/appraisals/${appraisal.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {appraisal.status === 'draft' && (
                          <button
                            onClick={() => { if (confirm('Delete this draft?')) deleteMutation.mutate(appraisal.id); }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">New Performance Appraisal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Employee *</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.employeeId || ''}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                >
                  <option value="">Select employee</option>
                  {employees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reviewer *</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.reviewerId || ''}
                  onChange={(e) => setFormData({ ...formData, reviewerId: e.target.value })}
                >
                  <option value="">Select reviewer</option>
                  {employees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Period</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.appraisalPeriod}
                    onChange={(e) => setFormData({ ...formData, appraisalPeriod: e.target.value })}
                  >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                    <option value="annual">Annual</option>
                    <option value="probation">Probation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  >
                    {[2024, 2025, 2026, 2027].map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending || !formData.employeeId || !formData.reviewerId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Appraisal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Bulk Create Appraisals</h2>
            <p className="text-sm text-gray-500 mb-4">Create appraisals for all active employees in a department</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Department *</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={bulkData.department || ''}
                  onChange={(e) => setBulkData({ ...bulkData, department: e.target.value })}
                >
                  <option value="">Select department</option>
                  {departments.map((dept: string) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Reviewer *</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={bulkData.reviewerId || ''}
                  onChange={(e) => setBulkData({ ...bulkData, reviewerId: e.target.value })}
                >
                  <option value="">Select reviewer</option>
                  {employees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Period</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={bulkData.appraisalPeriod}
                    onChange={(e) => setBulkData({ ...bulkData, appraisalPeriod: e.target.value })}
                  >
                    {PERIODS.map((p) => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Year</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={bulkData.year}
                    onChange={(e) => setBulkData({ ...bulkData, year: parseInt(e.target.value) })}
                  >
                    {[2024, 2025, 2026, 2027].map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleBulkCreate}
                disabled={bulkCreateMutation.isPending || !bulkData.department || !bulkData.reviewerId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkCreateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create for Department
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
