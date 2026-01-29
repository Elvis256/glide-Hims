import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  Plus,
  Search,
  MapPin,
  Phone,
  User,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  X,
} from 'lucide-react';
import { facilitiesService, type Facility } from '../../../services';

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  manager: string;
  managerEmail: string;
  services: string[];
  status: 'active' | 'inactive' | 'maintenance';
  employeeCount: number;
  bedCount: number;
  openDate: string;
  type: string;
}

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: '',
    type: 'clinic' as 'hospital' | 'clinic' | 'pharmacy' | 'lab',
    location: '',
    phone: '',
    email: '',
    address: '',
  });

  // Fetch facilities (branches) from API
  const { data: facilities = [], isLoading } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => facilitiesService.list(),
    staleTime: 60000,
  });

  // Transform facilities to branches
  const branches: Branch[] = useMemo(() => {
    return facilities.map((f: Facility) => ({
      id: f.id,
      name: f.name,
      code: `BR-${f.id.slice(0, 3).toUpperCase()}`,
      address: f.contact?.address || f.location || '',
      city: f.location || '',
      phone: f.contact?.phone || '',
      manager: '',
      managerEmail: f.contact?.email || '',
      services: [],
      status: f.isActive ? 'active' : 'inactive' as const,
      employeeCount: 0,
      bedCount: 0,
      openDate: f.createdAt?.split('T')[0] || '',
      type: f.type,
    }));
  }, [facilities]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof newBranch) => facilitiesService.create({
      name: data.name,
      type: data.type,
      tenantId: 'default',
      location: data.location,
      contact: {
        phone: data.phone,
        email: data.email,
        address: data.address,
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setShowAddModal(false);
      setNewBranch({ name: '', type: 'clinic', location: '', phone: '', email: '', address: '' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => facilitiesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
    },
  });

  const handleAddBranch = () => {
    if (!newBranch.name.trim()) return;
    createMutation.mutate(newBranch);
  };

  const filteredBranches = useMemo(() => {
    return branches.filter((branch) => {
      const matchesSearch =
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || branch.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [branches, searchTerm, statusFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'inactive':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'maintenance':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = useMemo(() => {
    return {
      total: branches.length,
      active: branches.filter((b) => b.status === 'active').length,
      totalBeds: branches.reduce((sum, b) => sum + b.bedCount, 0),
      totalStaff: branches.reduce((sum, b) => sum + b.employeeCount, 0),
    };
  }, [branches]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-600">Manage hospital branches and locations</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Branch
        </button>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Branches</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Beds</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalBeds}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Staff</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalStaff}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search branches..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
        </select>
      </div>

      {/* Branches Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{branch.name}</h3>
                    <p className="text-sm text-gray-500">{branch.code}</p>
                  </div>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(showMenu === branch.id ? null : branch.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                  {showMenu === branch.id && (
                    <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                      <button
                        onClick={() => {
                          setSelectedBranch(branch);
                          setShowMenu(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="w-4 h-4" /> View Details
                      </button>
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        <Edit2 className="w-4 h-4" /> Edit
                      </button>
                      <button 
                        onClick={() => {
                          deleteMutation.mutate(branch.id);
                          setShowMenu(null);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {branch.address}, {branch.city}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {branch.phone}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4 text-gray-400" />
                  {branch.manager}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {branch.services.slice(0, 4).map((service) => (
                  <span
                    key={service}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {service}
                  </span>
                ))}
                {branch.services.length > 4 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                    +{branch.services.length - 4} more
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{branch.employeeCount} Staff</span>
                  <span>{branch.bedCount} Beds</span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${getStatusColor(branch.status)}`}>
                  {getStatusIcon(branch.status)}
                  <span className="capitalize">{branch.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Branch Details Modal */}
      {selectedBranch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedBranch.name}</h2>
                    <p className="text-sm text-gray-500">{selectedBranch.code}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBranch(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Location</h4>
                  <p className="text-gray-900">{selectedBranch.address}</p>
                  <p className="text-gray-600">{selectedBranch.city}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Contact</h4>
                  <p className="text-gray-900">{selectedBranch.phone}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Branch Manager</h4>
                  <p className="text-gray-900">{selectedBranch.manager}</p>
                  <p className="text-sm text-gray-500">{selectedBranch.managerEmail}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Opened</h4>
                  <p className="text-gray-900">{selectedBranch.openDate}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Services Offered</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedBranch.services.map((service) => (
                    <span
                      key={service}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedBranch.employeeCount}</p>
                  <p className="text-sm text-gray-500">Employees</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{selectedBranch.bedCount}</p>
                  <p className="text-sm text-gray-500">Beds</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${getStatusColor(selectedBranch.status)}`}>
                    {getStatusIcon(selectedBranch.status)}
                    <span className="capitalize">{selectedBranch.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Status</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md m-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add New Branch</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input
                  type="text"
                  value={newBranch.name}
                  onChange={(e) => setNewBranch(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Main Campus"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={newBranch.type}
                  onChange={(e) => setNewBranch(prev => ({ ...prev, type: e.target.value as typeof newBranch.type }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="hospital">Hospital</option>
                  <option value="clinic">Clinic</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="lab">Laboratory</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newBranch.location}
                  onChange={(e) => setNewBranch(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g., Kampala"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={newBranch.phone}
                  onChange={(e) => setNewBranch(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+256 700 123 456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newBranch.email}
                  onChange={(e) => setNewBranch(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="branch@hospital.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={newBranch.address}
                  onChange={(e) => setNewBranch(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Full address"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBranch}
                disabled={!newBranch.name.trim() || createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Branch
              </button>
            </div>
            {createMutation.isError && (
              <p className="text-sm text-red-600 mt-2">Failed to add branch. Please try again.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
