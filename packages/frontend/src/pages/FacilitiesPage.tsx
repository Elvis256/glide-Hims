import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type { Facility, Department } from '../types';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  Building,
  X,
  ChevronRight,
  MapPin,
} from 'lucide-react';

interface CreateFacilityData {
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy' | 'laboratory';
  location?: string;
  tenantId?: string;
}

export default function FacilitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  // Fetch facilities
  const { data: facilities, isLoading } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const response = await api.get('/facilities');
      return response.data as Facility[];
    },
  });

  // Fetch departments for selected facility
  const { data: departments } = useQuery({
    queryKey: ['departments', selectedFacility?.id],
    queryFn: async () => {
      const response = await api.get(`/facilities/${selectedFacility?.id}/departments`);
      return response.data as Department[];
    },
    enabled: !!selectedFacility,
  });

  // Create facility mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateFacilityData) => api.post('/facilities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setShowModal(false);
    },
  });

  // Delete facility mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/facilities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });

  const filteredFacilities = facilities?.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facilities</h1>
          <p className="text-gray-500 mt-1">Manage hospitals, clinics, and departments</p>
        </div>
        <button
          onClick={() => {
            setEditingFacility(null);
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Facility
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Facilities List */}
        <div className="lg:col-span-2 card">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search facilities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : !filteredFacilities?.length ? (
            <div className="text-center py-12">
              <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No facilities found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFacilities.map((facility) => (
                <div
                  key={facility.id}
                  onClick={() => setSelectedFacility(facility)}
                  className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedFacility?.id === facility.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        facility.type === 'hospital'
                          ? 'bg-blue-100'
                          : facility.type === 'clinic'
                          ? 'bg-green-100'
                          : facility.type === 'pharmacy'
                          ? 'bg-purple-100'
                          : 'bg-orange-100'
                      }`}
                    >
                      <Building
                        className={`w-5 h-5 ${
                          facility.type === 'hospital'
                            ? 'text-blue-600'
                            : facility.type === 'clinic'
                            ? 'text-green-600'
                            : facility.type === 'pharmacy'
                            ? 'text-purple-600'
                            : 'text-orange-600'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{facility.name}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span className="capitalize">{facility.type}</span>
                        {facility.location && (
                          <>
                            <span>•</span>
                            <MapPin className="w-3 h-3" />
                            <span>{facility.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFacility(facility);
                        setShowModal(true);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this facility?')) {
                          deleteMutation.mutate(facility.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Departments Panel */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">
            {selectedFacility ? `${selectedFacility.name} - Departments` : 'Select a Facility'}
          </h3>

          {selectedFacility ? (
            departments?.length ? (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{dept.name}</p>
                      <p className="text-sm text-gray-500">{dept.code}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No departments yet</p>
            )
          ) : (
            <p className="text-gray-500 text-center py-8">
              Click on a facility to view its departments
            </p>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <FacilityModal
          facility={editingFacility}
          onClose={() => setShowModal(false)}
          onSave={(data) => {
            if (editingFacility) {
              api.patch(`/facilities/${editingFacility.id}`, data).then(() => {
                queryClient.invalidateQueries({ queryKey: ['facilities'] });
                setShowModal(false);
              });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending}
        />
      )}
    </div>
  );
}

interface FacilityModalProps {
  facility: Facility | null;
  onClose: () => void;
  onSave: (data: CreateFacilityData) => void;
  isLoading: boolean;
}

function FacilityModal({ facility, onClose, onSave, isLoading }: FacilityModalProps) {
  const [formData, setFormData] = useState<CreateFacilityData>({
    name: facility?.name || '',
    type: facility?.type || 'hospital',
    location: facility?.location || '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {facility ? 'Edit Facility' : 'Create Facility'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as 'hospital' | 'clinic' | 'pharmacy' | 'laboratory',
                })
              }
              className="input"
              required
            >
              <option value="hospital">Hospital</option>
              <option value="clinic">Clinic</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="laboratory">Laboratory</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input"
              placeholder="e.g., Kampala, Uganda"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : facility ? (
                'Update'
              ) : (
                'Create'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
