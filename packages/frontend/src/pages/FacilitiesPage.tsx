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
  Building2,
  X,
  ChevronRight,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  GitBranch,
  Home,
} from 'lucide-react';

interface CreateFacilityData {
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy' | 'laboratory' | 'health_center';
  location?: string;
  tenantId?: string;
  parentFacilityId?: string;
  contact?: {
    phone?: string;
    email?: string;
  };
}

export default function FacilitiesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [addingBranchTo, setAddingBranchTo] = useState<Facility | null>(null);
  const [expandedFacilities, setExpandedFacilities] = useState<Set<string>>(new Set());

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
      setAddingBranchTo(null);
    },
  });

  // Delete facility mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/facilities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });

  // Build facility tree (parent-child hierarchy)
  const buildFacilityTree = (facilities: Facility[] | undefined): { mainFacilities: Facility[]; childMap: Map<string, Facility[]> } => {
    if (!facilities) return { mainFacilities: [], childMap: new Map() };
    const mainFacilities = facilities.filter(f => !f.parentFacilityId);
    const childMap = new Map<string, Facility[]>();
    
    facilities.forEach((f: Facility) => {
      if (f.parentFacilityId) {
        const children = childMap.get(f.parentFacilityId) || [];
        children.push(f);
        childMap.set(f.parentFacilityId, children);
      }
    });

    return { mainFacilities, childMap };
  };

  const { mainFacilities, childMap } = buildFacilityTree(facilities);

  const filteredMainFacilities = mainFacilities.filter(
    (f: Facility) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.location?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpanded = (facilityId: string) => {
    const newExpanded = new Set(expandedFacilities);
    if (newExpanded.has(facilityId)) {
      newExpanded.delete(facilityId);
    } else {
      newExpanded.add(facilityId);
    }
    setExpandedFacilities(newExpanded);
  };

  const getChildFacilities = (parentId: string) => childMap?.get(parentId) || [];

  const getFacilityIcon = (type: string, isMain: boolean) => {
    if (isMain) return Building2;
    return Building;
  };

  const getFacilityColor = (type: string) => {
    switch (type) {
      case 'hospital': return { bg: 'bg-blue-100', text: 'text-blue-600' };
      case 'clinic': return { bg: 'bg-green-100', text: 'text-green-600' };
      case 'pharmacy': return { bg: 'bg-purple-100', text: 'text-purple-600' };
      case 'laboratory': return { bg: 'bg-orange-100', text: 'text-orange-600' };
      case 'health_center': return { bg: 'bg-teal-100', text: 'text-teal-600' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-600' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facilities & Branches</h1>
          <p className="text-gray-500 mt-1">Manage your organization's facilities, branches, and departments</p>
        </div>
        <button
          onClick={() => {
            setEditingFacility(null);
            setAddingBranchTo(null);
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Facility
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{mainFacilities?.length || 0}</p>
              <p className="text-sm text-gray-500">Main Facilities</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <GitBranch className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {facilities ? facilities.length - (mainFacilities?.length || 0) : 0}
              </p>
              <p className="text-sm text-gray-500">Branches</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Building className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{facilities?.length || 0}</p>
              <p className="text-sm text-gray-500">Total Facilities</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Home className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{departments?.length || 0}</p>
              <p className="text-sm text-gray-500">Departments</p>
            </div>
          </div>
        </div>
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
          ) : !filteredMainFacilities?.length ? (
            <div className="text-center py-12">
              <Building className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No facilities found</p>
              <p className="text-sm text-gray-400 mt-1">Create your first facility to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMainFacilities.map((facility: Facility) => {
                const children = getChildFacilities(facility.id);
                const hasChildren = children.length > 0;
                const isExpanded = expandedFacilities.has(facility.id);
                const colors = getFacilityColor(facility.type);
                const Icon = getFacilityIcon(facility.type, true);

                return (
                  <div key={facility.id}>
                    {/* Main Facility */}
                    <div
                      onClick={() => setSelectedFacility(facility)}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedFacility?.id === facility.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {hasChildren && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(facility.id);
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        )}
                        {!hasChildren && <div className="w-6" />}
                        <div className={`p-2 rounded-lg ${colors.bg}`}>
                          <Icon className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900">{facility.name}</p>
                            {hasChildren && (
                              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                {children.length} {children.length === 1 ? 'branch' : 'branches'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="capitalize">{facility.type.replace('_', ' ')}</span>
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
                            setAddingBranchTo(facility);
                            setEditingFacility(null);
                            setShowModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-green-600"
                          title="Add Branch"
                        >
                          <GitBranch className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFacility(facility);
                            setAddingBranchTo(null);
                            setShowModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasChildren) {
                              alert('Cannot delete facility with branches. Delete branches first.');
                              return;
                            }
                            if (confirm('Are you sure you want to delete this facility?')) {
                              deleteMutation.mutate(facility.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Child Facilities (Branches) */}
                    {isExpanded && hasChildren && (
                      <div className="ml-8 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                        {children.map((child: Facility) => {
                          const childColors = getFacilityColor(child.type);
                          return (
                            <div
                              key={child.id}
                              onClick={() => setSelectedFacility(child)}
                              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                selectedFacility?.id === child.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'hover:bg-gray-50 border-gray-100'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${childColors.bg}`}>
                                  <Building className={`w-4 h-4 ${childColors.text}`} />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{child.name}</p>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="capitalize">{child.type.replace('_', ' ')}</span>
                                    {child.location && (
                                      <>
                                        <span>•</span>
                                        <span>{child.location}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFacility(child);
                                    setAddingBranchTo(null);
                                    setShowModal(true);
                                  }}
                                  className="p-1 text-gray-400 hover:text-blue-600"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to delete this branch?')) {
                                      deleteMutation.mutate(child.id);
                                    }
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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
          parentFacility={addingBranchTo}
          onClose={() => {
            setShowModal(false);
            setAddingBranchTo(null);
          }}
          onSave={(data) => {
            if (editingFacility) {
              api.patch(`/facilities/${editingFacility.id}`, data).then(() => {
                queryClient.invalidateQueries({ queryKey: ['facilities'] });
                setShowModal(false);
                setAddingBranchTo(null);
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
  parentFacility: Facility | null;
  onClose: () => void;
  onSave: (data: CreateFacilityData) => void;
  isLoading: boolean;
}

function FacilityModal({ facility, parentFacility, onClose, onSave, isLoading }: FacilityModalProps) {
  const [formData, setFormData] = useState<CreateFacilityData>({
    name: facility?.name || '',
    type: facility?.type || (parentFacility ? 'clinic' : 'hospital'),
    location: facility?.location || '',
    parentFacilityId: parentFacility?.id,
    contact: {
      phone: (facility as any)?.contact?.phone || '',
      email: (facility as any)?.contact?.email || '',
    },
  });

  const modalTitle = facility
    ? 'Edit Facility'
    : parentFacility
    ? `Add Branch to ${parentFacility.name}`
    : 'Create Facility';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold">{modalTitle}</h2>
            {parentFacility && !facility && (
              <p className="text-sm text-gray-500">This will be a branch under {parentFacility.name}</p>
            )}
          </div>
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
              placeholder={parentFacility ? "e.g., Downtown Branch" : "e.g., Main Hospital"}
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
                  type: e.target.value as 'hospital' | 'clinic' | 'pharmacy' | 'laboratory' | 'health_center',
                })
              }
              className="input"
              required
            >
              <option value="hospital">Hospital</option>
              <option value="clinic">Clinic</option>
              <option value="health_center">Health Center</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="laboratory">Laboratory</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="input pl-10"
                placeholder="e.g., Kampala, Uganda"
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Contact Information</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.contact?.phone || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      contact: { ...formData.contact, phone: e.target.value }
                    })}
                    className="input pl-10"
                    placeholder="+256 xxx xxx xxx"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={formData.contact?.email || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      contact: { ...formData.contact, email: e.target.value }
                    })}
                    className="input pl-10"
                    placeholder="contact@facility.com"
                  />
                </div>
              </div>
            </div>
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
              ) : parentFacility ? (
                'Add Branch'
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
