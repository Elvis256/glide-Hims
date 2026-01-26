import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  MoreVertical,
  CheckCircle,
  XCircle,
  Loader2,
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

const mockLocations: StoreLocation[] = [
  {
    id: '1',
    code: 'MAIN-001',
    name: 'Central Medical Store',
    type: 'main',
    address: 'Building A, Ground Floor',
    phone: '+254 700 100 001',
    manager: 'John Kamau',
    operatingHours: '24/7',
    isActive: true,
    transfersTo: ['SUB-001', 'SUB-002', 'PHARM-001'],
  },
  {
    id: '2',
    code: 'SUB-001',
    name: 'Surgery Sub-Store',
    type: 'sub-store',
    address: 'Building B, 2nd Floor',
    phone: '+254 700 100 002',
    manager: 'Mary Wanjiku',
    operatingHours: '8:00 AM - 6:00 PM',
    isActive: true,
    parentStore: 'MAIN-001',
    transfersTo: ['PHARM-001'],
  },
  {
    id: '3',
    code: 'SUB-002',
    name: 'Emergency Sub-Store',
    type: 'sub-store',
    address: 'Building A, 1st Floor',
    phone: '+254 700 100 003',
    manager: 'Peter Ochieng',
    operatingHours: '24/7',
    isActive: true,
    parentStore: 'MAIN-001',
    transfersTo: [],
  },
  {
    id: '4',
    code: 'PHARM-001',
    name: 'Main Pharmacy',
    type: 'pharmacy',
    address: 'Building A, Ground Floor',
    phone: '+254 700 100 004',
    manager: 'Dr. Sarah Muthoni',
    operatingHours: '7:00 AM - 10:00 PM',
    isActive: true,
    parentStore: 'MAIN-001',
    transfersTo: ['PHARM-002'],
  },
  {
    id: '5',
    code: 'PHARM-002',
    name: 'Outpatient Pharmacy',
    type: 'pharmacy',
    address: 'Outpatient Block',
    phone: '+254 700 100 005',
    manager: 'James Kiprop',
    operatingHours: '8:00 AM - 5:00 PM',
    isActive: true,
    parentStore: 'PHARM-001',
    transfersTo: [],
  },
  {
    id: '6',
    code: 'SUB-003',
    name: 'Maternity Sub-Store',
    type: 'sub-store',
    address: 'Maternity Wing',
    phone: '+254 700 100 006',
    manager: 'Grace Akinyi',
    operatingHours: '24/7',
    isActive: false,
    parentStore: 'MAIN-001',
    transfersTo: [],
  },
];

export default function StoreLocationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
          <div className="text-2xl font-bold text-gray-900">{mockLocations.length}</div>
          <div className="text-sm text-gray-500">Total Locations</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">
            {mockLocations.filter((l) => l.type === 'main').length}
          </div>
          <div className="text-sm text-gray-500">Main Stores</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">
            {mockLocations.filter((l) => l.type === 'sub-store').length}
          </div>
          <div className="text-sm text-gray-500">Sub-Stores</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {mockLocations.filter((l) => l.type === 'pharmacy').length}
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
                      <button className="p-1 text-gray-400 hover:text-blue-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
