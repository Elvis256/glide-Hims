import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Search,
  Plus,
  Edit,
  Trash2,
  Users,
  MapPin,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  FolderTree,
  UserCircle,
  Loader2,
} from 'lucide-react';
import { facilitiesService, type Department as APIDept } from '../../../services';

interface SubDepartment {
  id: string;
  name: string;
  code: string;
  staffCount: number;
}

interface Department {
  id: string;
  name: string;
  code: string;
  head: string;
  location: string;
  building: string;
  staffCount: number;
  parentId?: string;
  subDepartments: SubDepartment[];
  status: 'Active' | 'Inactive';
}

export default function DepartmentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [parentDeptId, setParentDeptId] = useState<string | null>(null);
  const [newDept, setNewDept] = useState({ name: '', code: '', building: '', location: '', parentId: '' });
  const [error, setError] = useState('');
  
  const queryClient = useQueryClient();

  // Fetch facilities to get the default facility
  const { data: facilities } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesService.list(),
    staleTime: 60000,
  });

  const defaultFacilityId = facilities?.[0]?.id;

  // Fetch departments from API
  const { data: apiDepts, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => facilitiesService.departments.listAll(),
    staleTime: 60000,
  });

  // Create department mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; code: string; description?: string; parentId?: string }) => {
      if (!defaultFacilityId) throw new Error('No facility found');
      return facilitiesService.departments.create(defaultFacilityId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowAddModal(false);
      setNewDept({ name: '', code: '', building: '', location: '', parentId: '' });
      setParentDeptId(null);
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to create department');
    },
  });

  // Update department mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; code?: string; description?: string; parentId?: string | null } }) => {
      return facilitiesService.departments.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setShowEditModal(false);
      setEditingDept(null);
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to update department');
    },
  });

  // Delete department mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return facilitiesService.departments.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete department');
    },
  });

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setNewDept({
      name: dept.name,
      code: dept.code,
      building: dept.building,
      location: dept.location,
      parentId: dept.parentId || '',
    });
    setShowEditModal(true);
  };

  const handleDelete = (dept: Department) => {
    if (window.confirm(`Are you sure you want to delete "${dept.name}" department?`)) {
      deleteMutation.mutate(dept.id);
    }
  };

  const handleUpdateSubmit = () => {
    if (!editingDept || !newDept.name || !newDept.code) {
      setError('Name and Code are required');
      return;
    }
    // Prevent circular reference - can't set parent to self
    if (newDept.parentId === editingDept.id) {
      setError('A department cannot be its own parent');
      return;
    }
    updateMutation.mutate({
      id: editingDept.id,
      data: {
        name: newDept.name,
        code: newDept.code.toUpperCase(),
        description: `${newDept.building} - ${newDept.location}`.trim() || undefined,
        parentId: newDept.parentId || null,
      },
    });
  };

  const handleAddSubDepartment = (parentDept: Department) => {
    setParentDeptId(parentDept.id);
    setNewDept({ name: '', code: '', building: parentDept.building, location: parentDept.location, parentId: '' });
    setShowAddModal(true);
  };

  // Transform API data with fallback - only show root departments (no parentId)
  const departments: Department[] = useMemo(() => {
    if (!apiDepts) return [];
    // Filter to only root departments (those without a parent)
    const rootDepts = apiDepts.filter((d: APIDept) => !d.parentId);
    return rootDepts.map((d: APIDept) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      head: 'Department Head',
      location: d.description || 'Building A',
      building: 'Main Building',
      staffCount: (d as any).staffCount || 0,
      parentId: d.parentId,
      status: d.isActive !== false ? 'Active' as const : 'Inactive' as const,
      subDepartments: (d.children || []).map((child: APIDept) => ({
        id: child.id,
        name: child.name,
        code: child.code,
        staffCount: (child as any).staffCount || 0,
      })),
    }));
  }, [apiDepts]);

  // All departments (including sub-departments) for parent dropdown
  const allDepartments = useMemo(() => {
    if (!apiDepts) return [];
    return apiDepts.map((d: APIDept) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      parentId: d.parentId,
    }));
  }, [apiDepts]);

  const filteredDepartments = useMemo(() => {
    return departments.filter(
      (dept) =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.head.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [departments, searchTerm]);

  const toggleExpand = (deptId: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  const stats = useMemo(() => ({
    totalDepartments: departments.length,
    totalSubDepartments: departments.reduce((acc, d) => acc + d.subDepartments.length, 0),
    totalStaff: departments.reduce((acc, d) => acc + d.staffCount, 0),
    activeDepartments: departments.filter((d) => d.status === 'Active').length,
  }), [departments]);

  const handleSubmit = () => {
    if (!newDept.name || !newDept.code) {
      setError('Name and Code are required');
      return;
    }
    createMutation.mutate({
      name: newDept.name,
      code: newDept.code.toUpperCase(),
      description: `${newDept.building} - ${newDept.location}`.trim() || undefined,
      parentId: parentDeptId || undefined,
    });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-7 w-7 text-blue-600" />
              Departments
            </h1>
            <p className="text-gray-600 mt-1">Manage hospital departments and organizational structure</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Department
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Departments</span>
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalDepartments}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Sub-Departments</span>
              <FolderTree className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalSubDepartments}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Total Staff</span>
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalStaff}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">Active</span>
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold mt-1">{stats.activeDepartments}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 bg-white rounded-lg border p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Departments List */}
      <div className="flex-1 bg-white rounded-lg border overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600 w-8"></th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Department</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Code</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Head</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Location</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Staff</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDepartments.map((dept) => (
                <>
                  <tr key={dept.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {dept.subDepartments.length > 0 && (
                        <button
                          onClick={() => toggleExpand(dept.id)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {expandedDepts.has(dept.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{dept.name}</p>
                          <p className="text-sm text-gray-500">{dept.subDepartments.length} sub-departments</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">{dept.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-700">{dept.head}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-gray-700 text-sm">{dept.location}</p>
                          <p className="text-gray-500 text-xs">{dept.building}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{dept.staffCount}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        dept.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {dept.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          className="p-1 hover:bg-green-100 rounded transition-colors" 
                          title="Add Sub-Department"
                          onClick={() => handleAddSubDepartment(dept)}
                        >
                          <Plus className="h-4 w-4 text-green-600" />
                        </button>
                        <button 
                          className="p-1 hover:bg-blue-100 rounded transition-colors" 
                          title="Edit"
                          onClick={() => handleEdit(dept)}
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </button>
                        <button 
                          className="p-1 hover:bg-red-100 rounded transition-colors" 
                          title="Delete"
                          onClick={() => handleDelete(dept)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Sub-departments */}
                  {expandedDepts.has(dept.id) &&
                    dept.subDepartments.map((sub) => (
                      <tr key={sub.id} className="bg-gray-50">
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 pl-16">
                          <div className="flex items-center gap-2">
                            <FolderTree className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-700">{sub.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-500 text-sm">—</td>
                        <td className="px-4 py-2 text-gray-500 text-sm">—</td>
                        <td className="px-4 py-2 text-gray-500 text-sm">—</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-gray-400" />
                            <span className="text-sm text-gray-600">{sub.staffCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2">
                          <button className="p-1 hover:bg-gray-200 rounded" title="Edit">
                            <Edit className="h-3 w-3 text-gray-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">
              {parentDeptId ? 'Add Sub-Department' : 'Add New Department'}
            </h2>
            {parentDeptId && (
              <p className="text-sm text-gray-500 mb-4">
                Adding sub-department under: <span className="font-medium">{departments.find(d => d.id === parentDeptId)?.name}</span>
              </p>
            )}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {parentDeptId ? 'Sub-Department Name *' : 'Department Name *'}
                </label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder={parentDeptId ? 'Enter sub-department name' : 'Enter department name'}
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg px-3 py-2" 
                    placeholder="DEPT"
                    value={newDept.code}
                    onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Head</label>
                  <select className="w-full border rounded-lg px-3 py-2">
                    <option>Select Head</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg px-3 py-2" 
                    placeholder="Building name"
                    value={newDept.building}
                    onChange={(e) => setNewDept({ ...newDept, building: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg px-3 py-2" 
                    placeholder="Wing A, Floor 1"
                    value={newDept.location}
                    onChange={(e) => setNewDept({ ...newDept, location: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => { setShowAddModal(false); setError(''); setParentDeptId(null); setNewDept({ name: '', code: '', building: '', location: '' }); }} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {parentDeptId ? 'Add Sub-Department' : 'Add Department'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Edit Department</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Name *</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg px-3 py-2" 
                  placeholder="Enter department name"
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg px-3 py-2" 
                    placeholder="DEPT"
                    value={newDept.code}
                    onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department Head</label>
                  <select className="w-full border rounded-lg px-3 py-2">
                    <option>Select Head</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg px-3 py-2" 
                    placeholder="Building name"
                    value={newDept.building}
                    onChange={(e) => setNewDept({ ...newDept, building: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg px-3 py-2" 
                    placeholder="Wing A, Floor 1"
                    value={newDept.location}
                    onChange={(e) => setNewDept({ ...newDept, location: e.target.value })}
                  />
                </div>
              </div>
              {/* Parent Department Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Department</label>
                <select 
                  className="w-full border rounded-lg px-3 py-2"
                  value={newDept.parentId}
                  onChange={(e) => setNewDept({ ...newDept, parentId: e.target.value })}
                >
                  <option value="">None (Root Department)</option>
                  {allDepartments
                    .filter(d => d.id !== editingDept?.id) // Can't be parent of itself
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                    ))
                  }
                </select>
                <p className="text-xs text-gray-500 mt-1">Select a parent to make this a sub-department</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => { setShowEditModal(false); setEditingDept(null); setError(''); setNewDept({ name: '', code: '', building: '', location: '', parentId: '' }); }} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateSubmit}
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Update Department
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
