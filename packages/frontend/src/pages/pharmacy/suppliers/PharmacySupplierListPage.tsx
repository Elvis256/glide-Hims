import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  Loader2,
  X,
  Eye,
  Trash2,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { pharmacyService, type Supplier as ApiSupplier, type CreateSupplierDto } from '../../../services/pharmacy';
import { useFacilityId } from '../../../lib/facility';

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

export default function PharmacySupplierListPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.suppliers')) {
    return <AccessDenied />;
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [showPreferredOnly, setShowPreferredOnly] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [preferredIds, setPreferredIds] = useState<Set<string>>(new Set());
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: '', contactPerson: '', email: '', phone: '', address: '', taxId: '',
    type: 'pharmaceutical' as CreateSupplierDto['type'],
  });

  const resetForm = () => setFormData({
    name: '', contactPerson: '', email: '', phone: '', address: '', taxId: '',
    type: 'pharmaceutical',
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const createMutation = useMutation({
    mutationFn: (data: CreateSupplierDto) => pharmacyService.suppliers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'suppliers'] });
      toast.success('Supplier created successfully');
      setShowAddModal(false);
      resetForm();
    },
    onError: () => toast.error('Failed to create supplier'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSupplierDto> }) =>
      pharmacyService.suppliers.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'suppliers'] });
      toast.success('Supplier updated successfully');
      setEditingSupplier(null);
      resetForm();
    },
    onError: () => toast.error('Failed to update supplier'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.suppliers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'suppliers'] });
      toast.success('Supplier deleted');
    },
    onError: () => toast.error('Failed to delete supplier'),
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) { toast.error('Supplier name is required'); return; }
    const code = formData.name.substring(0, 3).toUpperCase() + Date.now().toString().slice(-4);
    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: { ...formData, facilityId, code } });
    } else {
      createMutation.mutate({ ...formData, facilityId, code });
    }
  };

  const openEditModal = (supplier: Supplier) => {
    setFormData({
      name: supplier.name, contactPerson: supplier.contactPerson, email: supplier.email,
      phone: supplier.phone, address: supplier.address, taxId: '',
      type: (supplier.products[0] as CreateSupplierDto['type']) || 'pharmaceutical',
    });
    setEditingSupplier(supplier);
  };

  const togglePreferred = (id: string) => {
    setPreferredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast.success('Removed from preferred'); }
      else { next.add(id); toast.success('Marked as preferred'); }
      return next;
    });
  };

  const { data: suppliersData, isLoading } = useQuery({
    queryKey: ['pharmacy', 'suppliers'],
    queryFn: () => pharmacyService.suppliers.list(),
  });

  // Transform API suppliers to UI format
  const suppliers: Supplier[] = useMemo(() => {
    if (!suppliersData?.data) return [];
    return suppliersData.data.map((s: ApiSupplier) => ({
      id: s.id,
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: `${s.address || ''} ${s.city || ''}`.trim(),
      products: s.type ? [s.type] : [],
      rating: 4.0, // Default rating since API doesn't have this
      status: s.status === 'active' ? 'Active' : 'Inactive',
      isPreferred: preferredIds.has(s.id),
      lastOrder: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A',
      totalOrders: 0, // Default since API doesn't have this
    }));
  }, [suppliersData, preferredIds]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesSearch =
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.products.some((p) => p.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || supplier.status === statusFilter;
      const matchesPreferred = !showPreferredOnly || supplier.isPreferred;
      return matchesSearch && matchesStatus && matchesPreferred;
    });
  }, [suppliers, searchTerm, statusFilter, showPreferredOnly]);

  const stats = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter((s) => s.status === 'Active').length;
    const preferred = suppliers.filter((s) => s.isPreferred).length;
    const avgRating = total > 0 ? suppliers.reduce((sum, s) => sum + s.rating, 0) / total : 0;
    return { total, active, preferred, avgRating };
  }, [suppliers]);

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
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
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
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                      <p className="text-gray-500">Loading suppliers...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Building2 className="w-12 h-12 text-gray-300" />
                      <div>
                        <p className="text-gray-900 font-medium">No suppliers found</p>
                        <p className="text-gray-500 text-sm">Get started by adding your first supplier</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((supplier) => (
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
                          onClick={(e) => { e.stopPropagation(); togglePreferred(supplier.id); }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title={supplier.isPreferred ? 'Remove from preferred' : 'Mark as preferred'}
                        >
                          {supplier.isPreferred ? (
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          ) : (
                            <StarOff className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(supplier); }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4 text-gray-400" />
                        </button>
                        <div className="relative" ref={openMenuId === supplier.id ? menuRef : undefined}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === supplier.id ? null : supplier.id); }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                          {openMenuId === supplier.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setDetailSupplier(supplier); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this supplier?')) deleteMutation.mutate(supplier.id);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Supplier Modal */}
      {(showAddModal || editingSupplier) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
              </h2>
              <button onClick={() => { setShowAddModal(false); setEditingSupplier(null); resetForm(); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input value={formData.contactPerson} onChange={e => setFormData(f => ({ ...f, contactPerson: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={formData.phone} onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                  <input value={formData.taxId} onChange={e => setFormData(f => ({ ...f, taxId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input value={formData.address} onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={formData.type} onChange={e => setFormData(f => ({ ...f, type: e.target.value as CreateSupplierDto['type'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="pharmaceutical">Pharmaceutical</option>
                  <option value="medical_supplies">Medical Supplies</option>
                  <option value="equipment">Equipment</option>
                  <option value="consumables">Consumables</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowAddModal(false); setEditingSupplier(null); resetForm(); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingSupplier ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {detailSupplier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Supplier Details</h2>
              <button onClick={() => setDetailSupplier(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="font-medium text-gray-600">Name:</span> <span className="text-gray-900">{detailSupplier.name}</span></div>
              <div><span className="font-medium text-gray-600">Contact:</span> <span className="text-gray-900">{detailSupplier.contactPerson}</span></div>
              <div><span className="font-medium text-gray-600">Phone:</span> <span className="text-gray-900">{detailSupplier.phone}</span></div>
              <div><span className="font-medium text-gray-600">Email:</span> <span className="text-gray-900">{detailSupplier.email}</span></div>
              <div><span className="font-medium text-gray-600">Address:</span> <span className="text-gray-900">{detailSupplier.address}</span></div>
              <div><span className="font-medium text-gray-600">Status:</span> <span className="text-gray-900">{detailSupplier.status}</span></div>
              <div><span className="font-medium text-gray-600">Last Order:</span> <span className="text-gray-900">{detailSupplier.lastOrder}</span></div>
              <div><span className="font-medium text-gray-600">Total Orders:</span> <span className="text-gray-900">{detailSupplier.totalOrders}</span></div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setDetailSupplier(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
