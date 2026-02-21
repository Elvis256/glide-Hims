import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Layers,
  Plus,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { facilitiesService } from '../../../services/facilities';
import type { Department, Unit } from '../../../services/facilities';
import { useFacilityId } from '../../../lib/facility';

export default function BuildingsFloorsPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [selectedView, setSelectedView] = useState<'tree' | 'grid'>('tree');

  // Fetch departments (buildings/wings)
  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments', facilityId],
    queryFn: () => facilitiesService.departments.list(facilityId),
    staleTime: 60000,
  });

  // Fetch units (floors/rooms) for the facility
  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['units', facilityId],
    queryFn: () => facilitiesService.units.listByFacility(facilityId),
    staleTime: 60000,
  });

  const isLoading = loadingDepts || loadingUnits;

  // Group units by departmentId
  const unitsByDepartment = useMemo(() => {
    const map: Record<string, Unit[]> = {};
    units.forEach((u) => {
      if (!map[u.departmentId]) map[u.departmentId] = [];
      map[u.departmentId].push(u);
    });
    return map;
  }, [units]);

  // --- Mutations ---
  const createDeptMutation = useMutation({
    mutationFn: (data: { name: string; code: string; description?: string }) =>
      facilitiesService.departments.create(facilityId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments', facilityId] }),
  });

  const updateDeptMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; code?: string; description?: string } }) =>
      facilitiesService.departments.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments', facilityId] }),
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => facilitiesService.departments.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments', facilityId] }),
  });

  const createUnitMutation = useMutation({
    mutationFn: ({ departmentId, data }: { departmentId: string; data: { name: string; description?: string } }) =>
      facilitiesService.units.create(departmentId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['units', facilityId] }),
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) =>
      facilitiesService.units.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['units', facilityId] }),
  });

  const deleteUnitMutation = useMutation({
    mutationFn: (id: string) => facilitiesService.units.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['units', facilityId] }),
  });

  // --- Handlers ---
  const handleAddDepartment = () => {
    const name = prompt('Enter department name:');
    if (!name) return;
    const code = prompt('Enter department code:');
    if (!code) return;
    const description = prompt('Enter description (optional):') || undefined;
    createDeptMutation.mutate({ name, code, description });
  };

  const handleEditDepartment = (dept: Department) => {
    const name = prompt('Enter department name:', dept.name);
    if (!name) return;
    const code = prompt('Enter department code:', dept.code);
    if (!code) return;
    updateDeptMutation.mutate({ id: dept.id, data: { name, code } });
  };

  const handleDeleteDepartment = (id: string) => {
    if (confirm('Are you sure you want to delete this department and all its units?')) {
      deleteDeptMutation.mutate(id);
    }
  };

  const handleAddUnit = (departmentId: string) => {
    const name = prompt('Enter unit name:');
    if (!name) return;
    const description = prompt('Enter description (optional):') || undefined;
    createUnitMutation.mutate({ departmentId, data: { name, description } });
  };

  const handleEditUnit = (unit: Unit) => {
    const name = prompt('Enter unit name:', unit.name);
    if (!name) return;
    updateUnitMutation.mutate({ id: unit.id, data: { name } });
  };

  const handleDeleteUnit = (id: string) => {
    if (confirm('Are you sure you want to delete this unit?')) {
      deleteUnitMutation.mutate(id);
    }
  };

  const toggleDepartment = (id: string) => {
    const next = new Set(expandedDepartments);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedDepartments(next);
  };

  // --- Stats ---
  const stats = useMemo(() => {
    const activeDepts = departments.filter((d) => d.isActive).length;
    const activeUnits = units.filter((u) => u.isActive).length;
    return { departments: activeDepts, units: activeUnits, total: departments.length + units.length };
  }, [departments, units]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buildings & Floors</h1>
          <p className="text-gray-600">Manage facility departments and units</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedView('tree')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'tree' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setSelectedView('grid')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'grid' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              Grid View
            </button>
          </div>
          <button
            onClick={handleAddDepartment}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Department
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Departments</p>
          <p className="text-2xl font-bold text-gray-900">{stats.departments}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Units</p>
          <p className="text-2xl font-bold text-gray-900">{stats.units}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Entities</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedView === 'tree' ? (
          <div className="space-y-4">
            {departments.map((dept) => {
              const deptUnits = unitsByDepartment[dept.id] || [];
              return (
                <div key={dept.id} className="bg-white rounded-lg border border-gray-200">
                  {/* Department Header */}
                  <div
                    onClick={() => toggleDepartment(dept.id)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {expandedDepartments.has(dept.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                        <p className="text-sm text-gray-500">
                          Code: {dept.code}
                          {!dept.isActive && (
                            <span className="ml-2 text-xs text-red-500">(Inactive)</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {deptUnits.length} unit{deptUnits.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditDepartment(dept);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <Edit2 className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDepartment(dept.id);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Units */}
                  {expandedDepartments.has(dept.id) && (
                    <div className="border-t border-gray-200">
                      <div className="ml-6 border-l border-gray-200">
                        {deptUnits.map((unit) => (
                          <div
                            key={unit.id}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50"
                          >
                            <Layers className="w-4 h-4 text-gray-400" />
                            <div className="flex-1">
                              <span className="text-gray-700">{unit.name}</span>
                              {unit.description && (
                                <span className="ml-2 text-sm text-gray-400">{unit.description}</span>
                              )}
                              {!unit.isActive && (
                                <span className="ml-2 text-xs text-red-500">(Inactive)</span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditUnit(unit)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUnit(unit.id)}
                                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => handleAddUnit(dept.id)}
                          className="flex items-center gap-2 p-3 text-gray-400 hover:text-blue-500"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="text-sm">Add Unit</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {departments.map((dept) => {
              const deptUnits = unitsByDepartment[dept.id] || [];
              return (
                <div key={dept.id} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                      <p className="text-sm text-gray-500">{dept.code}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-500">Units</p>
                      <p className="text-xl font-bold text-gray-900">{deptUnits.length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-500">Status</p>
                      <p className="text-xl font-bold text-blue-600">
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  {dept.description && (
                    <p className="text-sm text-gray-500">{dept.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
