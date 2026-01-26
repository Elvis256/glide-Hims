import { useState, useMemo } from 'react';
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
} from 'lucide-react';

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
}

const mockBranches: Branch[] = [
  {
    id: '1',
    name: 'Main Campus',
    code: 'BR-001',
    address: '123 Medical Center Drive',
    city: 'Nairobi',
    phone: '+254 700 123 456',
    manager: 'Dr. Jane Wanjiku',
    managerEmail: 'jane.wanjiku@hospital.com',
    services: ['Emergency', 'OPD', 'IPD', 'Surgery', 'Radiology', 'Laboratory', 'Pharmacy'],
    status: 'active',
    employeeCount: 250,
    bedCount: 150,
    openDate: '2010-01-15',
  },
  {
    id: '2',
    name: 'Westlands Branch',
    code: 'BR-002',
    address: '45 Westlands Road',
    city: 'Nairobi',
    phone: '+254 700 234 567',
    manager: 'Dr. Peter Otieno',
    managerEmail: 'peter.otieno@hospital.com',
    services: ['OPD', 'Laboratory', 'Pharmacy', 'Dental', 'Optical'],
    status: 'active',
    employeeCount: 45,
    bedCount: 20,
    openDate: '2018-06-01',
  },
  {
    id: '3',
    name: 'Karen Medical Center',
    code: 'BR-003',
    address: '78 Karen Road',
    city: 'Nairobi',
    phone: '+254 700 345 678',
    manager: 'Dr. Sarah Mutua',
    managerEmail: 'sarah.mutua@hospital.com',
    services: ['OPD', 'IPD', 'Maternity', 'Pediatrics', 'Laboratory'],
    status: 'active',
    employeeCount: 80,
    bedCount: 50,
    openDate: '2020-03-15',
  },
  {
    id: '4',
    name: 'Mombasa Branch',
    code: 'BR-004',
    address: '22 Nyali Road',
    city: 'Mombasa',
    phone: '+254 700 456 789',
    manager: 'Dr. Ali Hassan',
    managerEmail: 'ali.hassan@hospital.com',
    services: ['Emergency', 'OPD', 'IPD', 'Surgery', 'Laboratory'],
    status: 'maintenance',
    employeeCount: 120,
    bedCount: 80,
    openDate: '2015-09-01',
  },
  {
    id: '5',
    name: 'Kisumu Clinic',
    code: 'BR-005',
    address: '15 Oginga Odinga Street',
    city: 'Kisumu',
    phone: '+254 700 567 890',
    manager: 'Dr. Mercy Achieng',
    managerEmail: 'mercy.achieng@hospital.com',
    services: ['OPD', 'Pharmacy', 'Laboratory'],
    status: 'inactive',
    employeeCount: 25,
    bedCount: 0,
    openDate: '2022-01-10',
  },
];

export default function BranchesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);

  const filteredBranches = useMemo(() => {
    return mockBranches.filter((branch) => {
      const matchesSearch =
        branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        branch.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || branch.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

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
      total: mockBranches.length,
      active: mockBranches.filter((b) => b.status === 'active').length,
      totalBeds: mockBranches.reduce((sum, b) => sum + b.bedCount, 0),
      totalStaff: mockBranches.reduce((sum, b) => sum + b.employeeCount, 0),
    };
  }, []);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-600">Manage hospital branches and locations</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50">
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
    </div>
  );
}
