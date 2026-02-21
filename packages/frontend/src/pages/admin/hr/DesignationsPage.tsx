import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { formatCurrency } from '../../../lib/currency';
import {
  Briefcase,
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Building2,
  DollarSign,
  Users,
  ArrowUpRight,
  Filter,
  MoreVertical,
  Loader2,
} from 'lucide-react';

interface Designation {
  id: string;
  title: string;
  level: number;
  grade: string;
  department: string;
  payScaleMin: number;
  payScaleMax: number;
  reportsTo: string | null;
  staffCount: number;
  status: 'Active' | 'Inactive';
}

interface DesignationsConfig {
  designations: Designation[];
}

const SETTINGS_KEY = '/settings/designations';

const saveDesignationsConfig = async (designations: Designation[]) => {
  const payload: DesignationsConfig = { designations };
  await api.put(SETTINGS_KEY, { value: payload, description: 'Designations configuration' });
};

const gradeColors: Record<string, string> = {
  E1: 'bg-purple-100 text-purple-800',
  E2: 'bg-purple-100 text-purple-800',
  M1: 'bg-blue-100 text-blue-800',
  M2: 'bg-blue-100 text-blue-800',
  M3: 'bg-blue-100 text-blue-800',
  N1: 'bg-green-100 text-green-800',
  N2: 'bg-green-100 text-green-800',
  N3: 'bg-green-100 text-green-800',
  T1: 'bg-orange-100 text-orange-800',
};

export default function DesignationsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDesignation, setEditingDesignation] = useState<Designation | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    level: 1,
    grade: '',
    department: '',
    payScaleMin: 0,
    payScaleMax: 0,
    reportsTo: null as string | null,
    staffCount: 0,
    status: 'Active' as 'Active' | 'Inactive',
  });

  // Fetch designations config from settings API
  const { data: designations = [], isLoading } = useQuery({
    queryKey: ['settings', 'designations'],
    queryFn: async (): Promise<Designation[]> => {
      try {
        const response = await api.get<{ value: DesignationsConfig }>(SETTINGS_KEY);
        return response.data.value?.designations ?? [];
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { status?: number } };
          if (axiosErr.response?.status === 404) return [];
        }
        throw err;
      }
    },
    staleTime: 60000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: Omit<Designation, 'id'>) => {
      const newDesignation: Designation = { ...data, id: crypto.randomUUID() };
      await saveDesignationsConfig([...designations, newDesignation]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'designations'] });
      setShowAddModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Designation> }) => {
      const updated = designations.map((d) => (d.id === id ? { ...d, ...data } : d));
      await saveDesignationsConfig(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'designations'] });
      setEditingDesignation(null);
      setShowAddModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const filtered = designations.filter((d) => d.id !== id);
      await saveDesignationsConfig(filtered);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'designations'] });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      level: 1,
      grade: '',
      department: '',
      payScaleMin: 0,
      payScaleMax: 0,
      reportsTo: null,
      staffCount: 0,
      status: 'Active',
    });
  };

  const handleAdd = () => {
    createMutation.mutate({
      title: formData.title,
      level: formData.level,
      grade: formData.grade,
      department: formData.department,
      payScaleMin: formData.payScaleMin,
      payScaleMax: formData.payScaleMax,
      reportsTo: formData.reportsTo,
      staffCount: formData.staffCount,
      status: formData.status,
    });
  };

  const handleEdit = (designation: Designation) => {
    setEditingDesignation(designation);
    setFormData({
      title: designation.title,
      level: designation.level,
      grade: designation.grade,
      department: designation.department,
      payScaleMin: designation.payScaleMin,
      payScaleMax: designation.payScaleMax,
      reportsTo: designation.reportsTo,
      staffCount: designation.staffCount,
      status: designation.status,
    });
    setShowAddModal(true);
  };

  const handleUpdate = () => {
    if (!editingDesignation) return;
    updateMutation.mutate({
      id: editingDesignation.id,
      data: formData,
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this designation?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingDesignation(null);
    resetForm();
  };

  const departments = useMemo(() => [...new Set(designations.map((d) => d.department))], [designations]);

  const filteredDesignations = useMemo(() => {
    return designations.filter((designation) => {
      const matchesSearch =
        designation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        designation.grade.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDept = departmentFilter === 'all' || designation.department === departmentFilter;
      return matchesSearch && matchesDept;
    });
  }, [designations, searchTerm, departmentFilter]);

  const stats = useMemo(() => ({
    totalDesignations: designations.length,
    executiveLevel: designations.filter((d) => d.level <= 2).length,
    medicalRoles: designations.filter((d) => d.grade.startsWith('M')).length,
    nursingRoles: designations.filter((d) => d.grade.startsWith('N')).length,
  }), [designations]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Briefcase className="h-7 w-7 text-blue-600" />
              Designations
            </h1>
            <p className="text-gray-600 mt-1">Manage job titles, grades, and reporting structure</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Designation
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Designations</span>
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalDesignations}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Executive Level</span>
              <ArrowUpRight className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.executiveLevel}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Medical Roles</span>
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.medicalRoles}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Nursing Roles</span>
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.nursingRoles}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search designations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Designation</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Level/Grade</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Pay Scale</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Reports To</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDesignations.map((designation) => (
                <tr key={designation.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-gray-600" />
                      </div>
                      <span className="font-medium text-gray-900">{designation.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">L{designation.level}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${gradeColors[designation.grade] || 'bg-gray-100 text-gray-800'}`}>
                        {designation.grade}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-600">{designation.department}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {formatCurrency(designation.payScaleMin)} - {formatCurrency(designation.payScaleMax)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {designation.reportsTo ? (
                      <div className="flex items-center gap-1 text-gray-600">
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                        {designation.reportsTo}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{designation.staffCount}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      designation.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {designation.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Edit"
                        onClick={() => handleEdit(designation)}
                      >
                        <Edit className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Delete"
                        onClick={() => handleDelete(designation.id)}
                      >
                        <Trash2 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded" title="More">
                        <MoreVertical className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex-shrink-0 border-t px-4 py-3 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">Showing {filteredDesignations.length} designations</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingDesignation ? 'Edit Designation' : 'Add New Designation'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Enter job title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                  >
                    <option value={1}>Level 1 (Executive)</option>
                    <option value={2}>Level 2 (Director)</option>
                    <option value={3}>Level 3 (Senior)</option>
                    <option value={4}>Level 4 (Mid)</option>
                    <option value={5}>Level 5 (Entry)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="E1, M1, N1, etc."
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Pay Scale</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="50000"
                    value={formData.payScaleMin || ''}
                    onChange={(e) => setFormData({ ...formData, payScaleMin: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Pay Scale</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="80000"
                    value={formData.payScaleMax || ''}
                    onChange={(e) => setFormData({ ...formData, payScaleMax: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reports To</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={formData.reportsTo || ''}
                  onChange={(e) => setFormData({ ...formData, reportsTo: e.target.value || null })}
                >
                  <option value="">None (Top Level)</option>
                  {designations
                    .filter((d) => d.id !== editingDesignation?.id)
                    .map((d) => (
                      <option key={d.id} value={d.title}>{d.title}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={handleCloseModal} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={editingDesignation ? handleUpdate : handleAdd}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingDesignation ? 'Update Designation' : 'Add Designation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
