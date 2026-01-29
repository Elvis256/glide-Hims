import { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Download,
  X,
  Eye,
  Phone,
  Mail,
  MapPin,
  Star,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

type VendorStatus = 'active' | 'inactive' | 'pending';
type VendorCategory = 'medical_supplies' | 'pharmaceuticals' | 'equipment' | 'services' | 'consumables';

interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  rating: number;
  status: VendorStatus;
  totalOrders: number;
  lastOrderDate: string;
}

const mockVendors: Vendor[] = [];

const statusConfig: Record<VendorStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-700', icon: XCircle },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
};

const categoryConfig: Record<VendorCategory, { label: string; color: string }> = {
  medical_supplies: { label: 'Medical Supplies', color: 'bg-blue-100 text-blue-700' },
  pharmaceuticals: { label: 'Pharmaceuticals', color: 'bg-purple-100 text-purple-700' },
  equipment: { label: 'Equipment', color: 'bg-orange-100 text-orange-700' },
  services: { label: 'Services', color: 'bg-teal-100 text-teal-700' },
  consumables: { label: 'Consumables', color: 'bg-pink-100 text-pink-700' },
};

export default function VendorListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<VendorCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<VendorStatus | 'all'>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>(mockVendors);

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const matchesSearch =
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.contactPerson.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || vendor.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
      const matchesRating =
        ratingFilter === 'all' ||
        (ratingFilter === '4plus' && vendor.rating >= 4) ||
        (ratingFilter === '3plus' && vendor.rating >= 3) ||
        (ratingFilter === 'below3' && vendor.rating < 3);
      return matchesSearch && matchesCategory && matchesStatus && matchesRating;
    });
  }, [vendors, searchQuery, categoryFilter, statusFilter, ratingFilter]);

  const summaryStats = useMemo(() => {
    return {
      total: vendors.length,
      active: vendors.filter((v) => v.status === 'active').length,
      inactive: vendors.filter((v) => v.status === 'inactive').length,
      avgRating: vendors.length > 0 ? (vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length).toFixed(1) : '0.0',
    };
  }, [vendors]);

  const toggleVendorStatus = (id: string) => {
    setVendors((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, status: v.status === 'active' ? 'inactive' : 'active' } : v
      )
    );
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Directory</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your supplier relationships</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Building2 className="w-4 h-4" />
              Total Vendors
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{summaryStats.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Active
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">{summaryStats.active}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <XCircle className="w-4 h-4" />
              Inactive
            </div>
            <p className="text-xl font-bold text-gray-700 mt-1">{summaryStats.inactive}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <Star className="w-4 h-4" />
              Avg Rating
            </div>
            <p className="text-xl font-bold text-yellow-700 mt-1">{summaryStats.avgRating}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as VendorCategory | 'all')}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="medical_supplies">Medical Supplies</option>
                <option value="pharmaceuticals">Pharmaceuticals</option>
                <option value="equipment">Equipment</option>
                <option value="services">Services</option>
                <option value="consumables">Consumables</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as VendorStatus | 'all')}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rating</label>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Ratings</option>
                <option value="4plus">4+ Stars</option>
                <option value="3plus">3+ Stars</option>
                <option value="below3">Below 3 Stars</option>
              </select>
            </div>
            {(categoryFilter !== 'all' || statusFilter !== 'all' || ratingFilter !== 'all') && (
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setRatingFilter('all');
                }}
                className="text-sm text-blue-600 hover:underline mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Vendor List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filteredVendors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No vendors found</p>
            <p className="text-sm mt-1">Add your first vendor to get started</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => {
            const StatusIcon = statusConfig[vendor.status].icon;
            return (
              <div key={vendor.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${categoryConfig[vendor.category].color}`}>
                        {categoryConfig[vendor.category].label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleVendorStatus(vendor.id)}
                    className="text-gray-400 hover:text-gray-600"
                    title={vendor.status === 'active' ? 'Deactivate' : 'Activate'}
                  >
                    {vendor.status === 'active' ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{vendor.contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4" />
                    <span>{vendor.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{vendor.address}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  {renderStars(vendor.rating)}
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[vendor.status].color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig[vendor.status].label}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => setViewingVendor(vendor)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
                  >
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Quick View Modal */}
      {viewingVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{viewingVendor.name}</h2>
                <p className="text-sm text-gray-500">Vendor Details</p>
              </div>
              <button onClick={() => setViewingVendor(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${categoryConfig[viewingVendor.category].color}`}>
                    {categoryConfig[viewingVendor.category].label}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${statusConfig[viewingVendor.status].color}`}>
                    {statusConfig[viewingVendor.status].label}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contact Person</p>
                <p className="font-medium">{viewingVendor.contactPerson}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium flex items-center gap-1">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {viewingVendor.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium flex items-center gap-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {viewingVendor.phone}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {viewingVendor.address}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{viewingVendor.totalOrders}</p>
                  <p className="text-xs text-gray-500">Total Orders</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{viewingVendor.rating}</p>
                  <p className="text-xs text-gray-500">Rating</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{viewingVendor.lastOrderDate || 'N/A'}</p>
                  <p className="text-xs text-gray-500">Last Order</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setViewingVendor(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Close
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Edit Vendor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add New Vendor</h2>
                <p className="text-sm text-gray-500">Enter vendor details</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Category</option>
                  <option value="medical_supplies">Medical Supplies</option>
                  <option value="pharmaceuticals">Pharmaceuticals</option>
                  <option value="equipment">Equipment</option>
                  <option value="services">Services</option>
                  <option value="consumables">Consumables</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Add Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
