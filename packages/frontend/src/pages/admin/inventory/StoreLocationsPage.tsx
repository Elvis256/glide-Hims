import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Warehouse,
  Search,
  Plus,
  Edit2,
  MapPin,
  Clock,
  User,
  ArrowRightLeft,
  Building2,
  Phone,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  Power,
} from 'lucide-react';
import { storesService, type Store } from '../../../services';

interface StoreLocation {
  id: string;
  code: string;
  name: string;
  type: 'main' | 'sub-store' | 'pharmacy';
  address: string;
  phone: string;
  manager: string;
  operatingHours: string;
  isActive: boolean;
  parentStore?: string;
  transfersTo: string[];
}

interface LocationFormData {
  name: string;
  code: string;
  type: 'main' | 'sub-store' | 'pharmacy';
  location: string;
  managerId: string;
  isActive: boolean;
}

const defaultFormData: LocationFormData = {
  name: '',
  code: '',
  type: 'sub-store',
  location: '',
  managerId: '',
  isActive: true,
};

export default function StoreLocationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StoreLocation | null>(null);
  const [formData, setFormData] = useState<LocationFormData>(defaultFormData);

  const queryClient = useQueryClient();

  // Fetch stores from API
  const { data: apiStores, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesService.stores.list(),
    staleTime: 60000,
  });

  // Transform API data with fallback
  const locations: StoreLocation[] = useMemo(() => {
    if (!apiStores) return [];
    return apiStores.map((s: Store) => ({
      id: s.id,
      code: s.code || s.id.slice(0, 8).toUpperCase(),
      name: s.name,
      type: (s.type as 'main' | 'sub-store' | 'pharmacy') || 'sub-store',
      address: s.location || 'N/A',
      phone: 'N/A',
      manager: s.managerId || 'Unassigned',
      operatingHours: '8:00 AM - 5:00 PM',
      isActive: s.isActive !== false,
      parentStore: undefined,
      transfersTo: [],
    }));
  }, [apiStores]);

  const filteredLocations = useMemo(() => {
    return locations.filter((location) => {
      const matchesSearch =
        location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        location.manager.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || location.type === typeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && location.isActive) ||
        (statusFilter === 'inactive' && !location.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [locations, searchTerm, typeFilter, statusFilter]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<Store>) => storesService.stores.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      handleCloseModal();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Store> }) =>
      storesService.stores.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      handleCloseModal();
    },
  });

  const handleOpenModal = (location?: StoreLocation) => {
    if (location) {
      setEditingLocation(location);
      setFormData({
        name: location.name,
        code: location.code,
        type: location.type,
        location: location.address,
        managerId: location.manager,
        isActive: location.isActive,
      });
    } else {
      setEditingLocation(null);
      setFormData(defaultFormData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLocation(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const storeData: Partial<Store> = {
      name: formData.name,
      code: formData.code,
      type: formData.type === 'sub-store' ? 'department' : formData.type,
      location: formData.location,
      managerId: formData.managerId,
      isActive: formData.isActive,
    };

    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data: storeData });
    } else {
      createMutation.mutate(storeData);
    }
  };

  const handleToggleStatus = (location: StoreLocation) => {
    updateMutation.mutate({
      id: location.id,
      data: { isActive: !location.isActive },
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'main':
        return 'bg-blue-100 text-blue-800';
      case 'sub-store':
        return 'bg-purple-100 text-purple-800';
      case 'pharmacy':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'main':
        return 'Main Store';
      case 'sub-store':
        return 'Sub-Store';
      case 'pharmacy':
        return 'Pharmacy';
      default:
        return type;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Warehouse className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Store Locations</h1>
            <p className="text-sm text-gray-500">Manage store and warehouse locations</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="main">Main Store</option>
          <option value="sub-store">Sub-Store</option>
          <option value="pharmacy">Pharmacy</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{locations.length}</div>
          <div className="text-sm text-gray-500">Total Locations</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">
            {locations.filter((l) => l.type === 'main').length}
          </div>
          <div className="text-sm text-gray-500">Main Stores</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">
            {locations.filter((l) => l.type === 'sub-store').length}
          </div>
          <div className="text-sm text-gray-500">Sub-Stores</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {locations.filter((l) => l.type === 'pharmacy').length}
          </div>
          <div className="text-sm text-gray-500">Pharmacies</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Manager
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Hours
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Transfers To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLocations.map((location) => (
                <tr key={location.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{location.name}</div>
                        <div className="text-sm text-gray-500">{location.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(location.type)}`}>
                      {getTypeLabel(location.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      {location.address}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone className="w-3 h-3" />
                      {location.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <User className="w-4 h-4" />
                      {location.manager}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      {location.operatingHours}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {location.transfersTo.length > 0 ? (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <ArrowRightLeft className="w-4 h-4" />
                        <span>{location.transfersTo.join(', ')}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {location.isActive ? (
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
                        onClick={() => handleOpenModal(location)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                        title="Edit location"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(location)}
                        className={`p-1 ${location.isActive ? 'text-gray-400 hover:text-red-600' : 'text-gray-400 hover:text-green-600'}`}
                        title={location.isActive ? 'Deactivate' : 'Activate'}
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as LocationFormData['type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="main">Main Store</option>
                  <option value="sub-store">Sub-Store</option>
                  <option value="pharmacy">Pharmacy</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location/Address
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manager ID
                </label>
                <input
                  type="text"
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Active
                </label>
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
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {editingLocation ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
