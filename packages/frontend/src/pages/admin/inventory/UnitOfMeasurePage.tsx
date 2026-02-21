import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Ruler,
  Search,
  Plus,
  Edit2,
  Package,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Power,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';

interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  abbreviation?: string;
  description?: string;
  isBaseUnit: boolean;
  sortOrder: number;
  isActive: boolean;
  facilityId: string;
  createdAt: string;
  updatedAt: string;
}

interface UnitFormData {
  code: string;
  name: string;
  abbreviation: string;
  description: string;
  isBaseUnit: boolean;
  sortOrder: string;
  isActive: boolean;
}

const defaultFormData: UnitFormData = {
  code: '',
  name: '',
  abbreviation: '',
  description: '',
  isBaseUnit: false,
  sortOrder: '0',
  isActive: true,
};

const API_PATH = '/item-classifications/units';

export default function UnitOfMeasurePage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null);
  const [formData, setFormData] = useState<UnitFormData>(defaultFormData);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data: units = [], isLoading, error: fetchError } = useQuery<UnitOfMeasure[]>({
    queryKey: ['units-of-measure', facilityId],
    queryFn: async () => {
      const res = await api.get(API_PATH);
      return res.data;
    },
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: (data: UnitFormData) =>
      api.post(API_PATH, {
        facilityId,
        code: data.code,
        name: data.name,
        abbreviation: data.abbreviation || undefined,
        description: data.description || undefined,
        isBaseUnit: data.isBaseUnit,
        sortOrder: data.sortOrder ? Number(data.sortOrder) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-of-measure'] });
      handleCloseModal();
    },
    onError: (err) => setMutationError(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UnitFormData }) =>
      api.put(`${API_PATH}/${id}`, {
        name: data.name,
        abbreviation: data.abbreviation || undefined,
        description: data.description || undefined,
        isBaseUnit: data.isBaseUnit,
        sortOrder: data.sortOrder ? Number(data.sortOrder) : undefined,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-of-measure'] });
      handleCloseModal();
    },
    onError: (err) => setMutationError(getApiErrorMessage(err)),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`${API_PATH}/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units-of-measure'] });
    },
    onError: (err) => setMutationError(getApiErrorMessage(err)),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      const matchesSearch =
        unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && unit.isActive) ||
        (statusFilter === 'inactive' && !unit.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [units, searchTerm, statusFilter]);

  const handleOpenModal = (unit?: UnitOfMeasure) => {
    setMutationError(null);
    if (unit) {
      setEditingUnit(unit);
      setFormData({
        code: unit.code,
        name: unit.name,
        abbreviation: unit.abbreviation || '',
        description: unit.description || '',
        isBaseUnit: unit.isBaseUnit,
        sortOrder: unit.sortOrder?.toString() || '0',
        isActive: unit.isActive,
      });
    } else {
      setEditingUnit(null);
      setFormData(defaultFormData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUnit(null);
    setFormData(defaultFormData);
    setMutationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError(null);
    if (editingUnit) {
      updateMutation.mutate({ id: editingUnit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleToggleStatus = (unit: UnitOfMeasure) => {
    toggleStatusMutation.mutate({ id: unit.id, isActive: !unit.isActive });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-100 rounded-lg">
            <Ruler className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Units of Measure</h1>
            <p className="text-sm text-gray-500">Manage base units and conversion factors</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Unit
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search units..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{units.length}</div>
          <div className="text-sm text-gray-500">Total Units</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-teal-600">
            {units.filter((u) => u.isBaseUnit).length}
          </div>
          <div className="text-sm text-gray-500">Base Units</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {units.filter((u) => u.isActive).length}
          </div>
          <div className="text-sm text-gray-500">Active Units</div>
        </div>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="flex-shrink-0 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Failed to load units: {getApiErrorMessage(fetchError)}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Abbreviation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUnits.map((unit) => (
                <tr key={unit.id} className={`hover:bg-gray-50 ${!unit.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-bold text-teal-600">{unit.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{unit.name}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{unit.abbreviation || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${unit.isBaseUnit ? 'bg-gray-100 text-gray-800' : 'bg-purple-100 text-purple-800'}`}>
                      {unit.isBaseUnit ? <Ruler className="w-4 h-4 text-gray-500" /> : <Package className="w-4 h-4 text-purple-500" />}
                      {unit.isBaseUnit ? 'Base' : 'Pack'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{unit.description || '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {unit.isActive ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircle className="w-4 h-4" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(unit)}
                        className="p-1 text-gray-400 hover:text-teal-600"
                        title="Edit unit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(unit)}
                        className={`p-1 ${unit.isActive ? 'text-gray-400 hover:text-red-600' : 'text-gray-400 hover:text-green-600'}`}
                        title={unit.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingUnit ? 'Edit Unit of Measure' : 'Add New Unit of Measure'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {mutationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {mutationError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                    disabled={!!editingUnit}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abbreviation
                  </label>
                  <input
                    type="text"
                    value={formData.abbreviation}
                    onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
                    placeholder="e.g., pcs, tab"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isBaseUnit"
                    checked={formData.isBaseUnit}
                    onChange={(e) => setFormData({ ...formData, isBaseUnit: e.target.checked })}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="isBaseUnit" className="text-sm text-gray-700">
                    Base Unit
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingUnit ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
