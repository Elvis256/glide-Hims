import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Building2,
  Phone,
  Mail,
  Package,
  Star,
  StarOff,
  CheckCircle,
  XCircle,
  Filter,
  MoreVertical,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  products: string[];
  rating: number;
  status: 'Active' | 'Inactive';
  isPreferred: boolean;
  lastOrder: string;
  totalOrders: number;
}

const mockSuppliers: Supplier[] = [
  {
    id: 'SUP001',
    name: 'PharmaCorp Kenya',
    contactPerson: 'John Mwangi',
    phone: '+254 722 123 456',
    email: 'orders@pharmacorp.co.ke',
    address: 'Industrial Area, Nairobi',
    products: ['Antibiotics', 'Analgesics', 'Cardiovascular'],
    rating: 4.8,
    status: 'Active',
    isPreferred: true,
    lastOrder: '2024-01-15',
    totalOrders: 156,
  },
  {
    id: 'SUP002',
    name: 'MediSupply Ltd',
    contactPerson: 'Sarah Ochieng',
    phone: '+254 733 456 789',
    email: 'sales@medisupply.co.ke',
    address: 'Mombasa Road, Nairobi',
    products: ['Diabetes', 'Respiratory', 'Vitamins'],
    rating: 4.5,
    status: 'Active',
    isPreferred: true,
    lastOrder: '2024-01-12',
    totalOrders: 89,
  },
  {
    id: 'SUP003',
    name: 'HealthCare Distributors',
    contactPerson: 'Peter Kamau',
    phone: '+254 711 789 012',
    email: 'info@hcdistributors.co.ke',
    address: 'Westlands, Nairobi',
    products: ['Surgical Supplies', 'Antibiotics'],
    rating: 4.2,
    status: 'Active',
    isPreferred: false,
    lastOrder: '2024-01-08',
    totalOrders: 45,
  },
  {
    id: 'SUP004',
    name: 'Global Pharma EA',
    contactPerson: 'Mary Wanjiku',
    phone: '+254 700 111 222',
    email: 'orders@globalpharma.co.ke',
    address: 'Kilimani, Nairobi',
    products: ['Oncology', 'Specialty Drugs'],
    rating: 4.6,
    status: 'Active',
    isPreferred: false,
    lastOrder: '2024-01-10',
    totalOrders: 28,
  },
  {
    id: 'SUP005',
    name: 'AfriMed Solutions',
    contactPerson: 'David Otieno',
    phone: '+254 722 333 444',
    email: 'contact@afrimed.co.ke',
    address: 'Thika Road, Nairobi',
    products: ['Generic Medicines', 'OTC'],
    rating: 3.8,
    status: 'Inactive',
    isPreferred: false,
    lastOrder: '2023-11-20',
    totalOrders: 12,
  },
];

export default function PharmacySupplierListPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [showPreferredOnly, setShowPreferredOnly] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const filteredSuppliers = useMemo(() => {
    return mockSuppliers.filter((supplier) => {
      const matchesSearch =
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.products.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || supplier.status === statusFilter;
      const matchesPreferred = !showPreferredOnly || supplier.isPreferred;
      return matchesSearch && matchesStatus && matchesPreferred;
    });
  }, [searchTerm, statusFilter, showPreferredOnly]);

  const stats = useMemo(() => {
    const active = mockSuppliers.filter((s) => s.status === 'Active').length;
    const preferred = mockSuppliers.filter((s) => s.isPreferred).length;
    const avgRating = mockSuppliers.reduce((sum, s) => sum + s.rating, 0) / mockSuppliers.length;
    return { total: mockSuppliers.length, active, preferred, avgRating };
  }, []);

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      );
    }
    return stars;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Directory</h1>
          <p className="text-gray-500">Manage pharmaceutical suppliers and vendors</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Suppliers</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
              <p className="text-sm text-gray-500">Active Suppliers</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.preferred}</p>
              <p className="text-sm text-gray-500">Preferred Suppliers</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Star className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.avgRating.toFixed(1)}</p>
              <p className="text-sm text-gray-500">Avg Rating</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers, contacts, or products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showPreferredOnly}
            onChange={(e) => setShowPreferredOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Preferred only</span>
        </label>
      </div>

      {/* Suppliers Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Supplier</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Products</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Rating</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Last Order</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSuppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className={`hover:bg-gray-50 cursor-pointer ${selectedSupplier === supplier.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedSupplier(supplier.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{supplier.name}</span>
                          {supplier.isPreferred && (
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{supplier.address}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900">{supplier.contactPerson}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Phone className="w-3 h-3" />
                        {supplier.phone}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Mail className="w-3 h-3" />
                        {supplier.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {supplier.products.slice(0, 2).map((product) => (
                        <span
                          key={product}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {product}
                        </span>
                      ))}
                      {supplier.products.length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          +{supplier.products.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {renderStars(Math.round(supplier.rating))}
                      <span className="ml-1 text-sm text-gray-600">{supplier.rating}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        supplier.status === 'Active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {supplier.status === 'Active' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {supplier.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm text-gray-900">{supplier.lastOrder}</p>
                      <p className="text-xs text-gray-500">{supplier.totalOrders} total orders</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title={supplier.isPreferred ? 'Remove from preferred' : 'Mark as preferred'}
                      >
                        {supplier.isPreferred ? (
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        ) : (
                          <StarOff className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
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
