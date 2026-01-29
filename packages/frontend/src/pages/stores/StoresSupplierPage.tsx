import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  MapPin,
  Star,
  StarOff,
  Edit2,
  MoreVertical,
  TrendingUp,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Globe,
  FileText,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  category: string[];
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  website?: string;
  rating: number;
  status: 'active' | 'inactive' | 'pending';
  totalOrders: number;
  lastOrderDate: string;
  onTimeDelivery: number;
  qualityScore: number;
  paymentTerms: string;
}

const suppliers: Supplier[] = [];

const categories = ['All', 'Medical Supplies', 'Medical Equipment', 'Consumables', 'Laboratory Equipment', 'Surgical Supplies', 'Linen', 'Stationery'];

export default function StoresSupplierPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesSearch = 
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || supplier.category.includes(selectedCategory);
      const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchTerm, selectedCategory, statusFilter]);

  const renderRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case 'inactive':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
            <XCircle className="w-3 h-3" />
            Inactive
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers Directory</h1>
          <p className="text-gray-600">Manage equipment and supplies vendors</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />
          Add Supplier
        </button>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Suppliers</p>
              <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Suppliers</p>
              <p className="text-2xl font-bold text-green-600">
                {suppliers.filter((s) => s.status === 'active').length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. On-Time Delivery</p>
              <p className="text-2xl font-bold text-purple-600">0%</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. Quality Score</p>
              <p className="text-2xl font-bold text-orange-600">0%</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
        <div className="flex border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Suppliers Grid/List */}
      <div className="flex-1 overflow-auto min-h-0">
        {filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white border rounded-lg">
            <Building2 className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium">No suppliers found</p>
            <p className="text-sm">Add a supplier to get started</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4 pb-4">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                      <p className="text-sm text-gray-500">{supplier.category.join(', ')}</p>
                    </div>
                  </div>
                  <button className="p-1 hover:bg-gray-100 rounded">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {supplier.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {supplier.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {supplier.address}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  {renderRating(supplier.rating)}
                  {getStatusBadge(supplier.status)}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{supplier.totalOrders}</p>
                    <p className="text-xs text-gray-500">Orders</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-green-600">{supplier.onTimeDelivery}%</p>
                    <p className="text-xs text-gray-500">On-Time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-blue-600">{supplier.qualityScore}%</p>
                    <p className="text-xs text-gray-500">Quality</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button className="flex-1 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-1">
                    <FileText className="w-4 h-4" />
                    View
                  </button>
                  <button className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1">
                    <Package className="w-4 h-4" />
                    Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Supplier</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Contact</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Categories</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Rating</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Performance</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{supplier.name}</p>
                          <p className="text-sm text-gray-500">{supplier.address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{supplier.contactPerson}</p>
                      <p className="text-sm text-gray-500">{supplier.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {supplier.category.map((cat) => (
                          <span key={cat} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">{renderRating(supplier.rating)}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">On-Time:</span>
                          <span className="font-medium text-green-600">{supplier.onTimeDelivery}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-500">Quality:</span>
                          <span className="font-medium text-blue-600">{supplier.qualityScore}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(supplier.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                          Order
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
