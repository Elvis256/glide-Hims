import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Filter,
  ChevronDown,
  Loader2,
  UserCheck,
  Stethoscope,
  Building2,
  Phone,
  Mail,
  Award,
  Clock,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface Provider {
  id: string;
  userId: string;
  providerType: 'DOCTOR' | 'NURSE' | 'LAB_TECHNICIAN' | 'PHARMACIST' | 'RADIOLOGIST' | 'SURGEON';
  specialty: string;
  licenseNumber: string;
  licenseExpiryDate: string;
  qualifications: string[];
  departmentId: string;
  departmentName: string;
  facilityId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED';
  user: {
    fullName: string;
    email: string;
    phone: string;
  };
  createdAt: string;
}

// Empty data - to be populated from API
const mockProviders: Provider[] = [];

const providerTypes = ['All', 'DOCTOR', 'SURGEON', 'NURSE', 'LAB_TECHNICIAN', 'PHARMACIST', 'RADIOLOGIST'];
const statuses = ['All', 'ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED'];

export default function ProviderDirectoryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const { data: providers, isLoading } = useQuery({
    queryKey: ['providers', searchTerm, selectedType, selectedStatus],
    queryFn: async () => mockProviders,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Provider>) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowAddModal(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const items = providers || mockProviders;

  const filteredProviders = items.filter((provider) => {
    const matchesSearch = 
      provider.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'All' || provider.providerType === selectedType;
    const matchesStatus = selectedStatus === 'All' || provider.status === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-700';
      case 'INACTIVE': return 'bg-gray-100 text-gray-700';
      case 'ON_LEAVE': return 'bg-yellow-100 text-yellow-700';
      case 'SUSPENDED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DOCTOR':
      case 'SURGEON':
        return <Stethoscope className="w-4 h-4" />;
      default:
        return <UserCheck className="w-4 h-4" />;
    }
  };

  const isLicenseExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isLicenseExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Provider Directory</h1>
          <p className="text-gray-600">Manage healthcare providers and their credentials</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Providers</p>
              <p className="text-xl font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-xl font-bold text-green-600">
                {items.filter(p => p.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">License Expiring</p>
              <p className="text-xl font-bold text-orange-600">
                {items.filter(p => isLicenseExpiringSoon(p.licenseExpiryDate)).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">License Expired</p>
              <p className="text-xl font-bold text-red-600">
                {items.filter(p => isLicenseExpired(p.licenseExpiryDate)).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, license, specialty..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              {selectedType}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showTypeDropdown && (
              <div className="absolute top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
                {providerTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type);
                      setShowTypeDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50"
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Providers Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Provider</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Specialty</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Department</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">License</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredProviders.map((provider) => (
              <tr key={provider.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      {getTypeIcon(provider.providerType)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{provider.user.fullName}</p>
                      <p className="text-xs text-gray-500">{provider.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {provider.providerType.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{provider.specialty}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-sm text-gray-700">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {provider.departmentName}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm text-gray-700">{provider.licenseNumber}</p>
                    <p className={`text-xs ${
                      isLicenseExpired(provider.licenseExpiryDate)
                        ? 'text-red-600'
                        : isLicenseExpiringSoon(provider.licenseExpiryDate)
                        ? 'text-orange-600'
                        : 'text-gray-500'
                    }`}>
                      Expires: {new Date(provider.licenseExpiryDate).toLocaleDateString()}
                      {isLicenseExpired(provider.licenseExpiryDate) && ' (EXPIRED)'}
                      {isLicenseExpiringSoon(provider.licenseExpiryDate) && ' (EXPIRING SOON)'}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(provider.status)}`}>
                    {provider.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingProvider(provider)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => {
                        const newStatus = provider.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                        updateStatusMutation.mutate({ id: provider.id, status: newStatus });
                      }}
                      className="p-1 hover:bg-gray-100 rounded"
                      title={provider.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    >
                      {provider.status === 'ACTIVE' ? (
                        <X className="w-4 h-4 text-red-500" />
                      ) : (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredProviders.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No providers found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingProvider) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProvider ? 'Edit Provider' : 'Add New Provider'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProvider(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select type</option>
                  {providerTypes.filter(t => t !== 'All').map(type => (
                    <option key={type} value={type}>{type.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <input
                  type="text"
                  placeholder="e.g., Internal Medicine"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                <input
                  type="text"
                  placeholder="e.g., MD-2024-001"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Expiry Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select department</option>
                  <option value="d1">General Medicine</option>
                  <option value="d2">Surgery</option>
                  <option value="d3">ICU</option>
                  <option value="d4">Laboratory</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualifications</label>
                <input
                  type="text"
                  placeholder="e.g., MBBS, MD (comma separated)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProvider(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({})}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingProvider ? 'Save Changes' : 'Add Provider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
