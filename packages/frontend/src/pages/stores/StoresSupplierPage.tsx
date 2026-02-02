import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Edit2,
  MoreVertical,
  TrendingUp,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  X,
  Loader2,
} from 'lucide-react';
import { useFacilityId } from '../../lib/facility';
import supplierService, {
  type Supplier,
  type CreateSupplierDto,
  SupplierType,
  SupplierStatus,
} from '../../services/suppliers';

const supplierTypeLabels: Record<SupplierType, string> = {
  [SupplierType.PHARMACEUTICAL]: 'Pharmaceutical',
  [SupplierType.MEDICAL_EQUIPMENT]: 'Medical Equipment',
  [SupplierType.CONSUMABLES]: 'Consumables',
  [SupplierType.GENERAL]: 'General',
};

export default function StoresSupplierPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<SupplierType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch suppliers
  const { data: suppliersData, isLoading, error } = useQuery({
    queryKey: ['suppliers', facilityId, selectedType, statusFilter, searchTerm],
    queryFn: () => supplierService.list(facilityId, {
      type: selectedType === 'all' ? undefined : selectedType,
      status: statusFilter === 'all' ? undefined : statusFilter,
      search: searchTerm || undefined,
    }),
  });

  const suppliers = suppliersData?.data || [];

  // Create supplier mutation
  const createMutation = useMutation({
    mutationFn: supplierService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setShowAddModal(false);
    },
  });

  const getStatusBadge = (status: SupplierStatus) => {
    switch (status) {
      case SupplierStatus.ACTIVE:
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Active
          </span>
        );
      case SupplierStatus.INACTIVE:
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
            <XCircle className="w-3 h-3" />
            Inactive
          </span>
        );
      case SupplierStatus.SUSPENDED:
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Suspended
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Failed to load suppliers: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Add Supplier Modal */}
      {showAddModal && (
        <AddSupplierModal
          facilityId={facilityId}
          onClose={() => setShowAddModal(false)}
          onSubmit={(dto) => createMutation.mutate(dto)}
          isLoading={createMutation.isPending}
          error={createMutation.error?.message}
        />
      )}

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suppliers Directory</h1>
          <p className="text-gray-600">Manage equipment and supplies vendors</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
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
              <p className="text-2xl font-bold text-gray-900">{suppliersData?.total || 0}</p>
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
                {suppliers.filter((s) => s.status === SupplierStatus.ACTIVE).length}
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
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as SupplierType | 'all')}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          {Object.entries(supplierTypeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SupplierStatus | 'all')}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value={SupplierStatus.ACTIVE}>Active</option>
          <option value={SupplierStatus.INACTIVE}>Inactive</option>
          <option value={SupplierStatus.SUSPENDED}>Suspended</option>
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
        {suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white border rounded-lg">
            <Building2 className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium">No suppliers found</p>
            <p className="text-sm">Add a supplier to get started</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Supplier
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4 pb-4">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                      <p className="text-sm text-gray-500">{supplierTypeLabels[supplier.type]}</p>
                    </div>
                  </div>
                  <button className="p-1 hover:bg-gray-100 rounded">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-2 mb-3">
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {supplier.email}
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {supplier.phone}
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {supplier.address}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-sm text-gray-500">Code: {supplier.code}</span>
                  {getStatusBadge(supplier.status)}
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Payment Terms</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{supplier.name}</p>
                          <p className="text-sm text-gray-500">{supplier.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{supplier.contactPerson || '-'}</p>
                      <p className="text-sm text-gray-500">{supplier.phone || supplier.email || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {supplierTypeLabels[supplier.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{supplier.paymentTerms || '-'}</p>
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

// Add Supplier Modal Component
function AddSupplierModal({
  facilityId,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  facilityId: string;
  onClose: () => void;
  onSubmit: (dto: CreateSupplierDto) => void;
  isLoading: boolean;
  error?: string;
}) {
  const [formData, setFormData] = useState<Partial<CreateSupplierDto>>({
    facilityId,
    type: SupplierType.GENERAL,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) return;
    onSubmit(formData as CreateSupplierDto);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Add New Supplier</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., SUP001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Company name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as SupplierType })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(supplierTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input
                type="text"
                value={formData.contactPerson || ''}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={formData.country || ''}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <input
                type="text"
                value={formData.paymentTerms || ''}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Net 30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit</label>
              <input
                type="number"
                value={formData.creditLimit || ''}
                onChange={(e) => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.code || !formData.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Supplier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
