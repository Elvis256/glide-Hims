import { useState, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  X,
  Building2,
  Calendar,
  TrendingDown,
  TrendingUp,
  ChevronDown,
  Award,
  Package,
  History,
  Percent,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
} from 'lucide-react';

type AgreementStatus = 'active' | 'expired' | 'pending' | 'draft';

interface VolumeDiscount {
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number;
}

interface PriceHistory {
  date: string;
  price: number;
  changePercent: number;
}

interface PriceAgreement {
  id: string;
  vendorId: string;
  vendorName: string;
  itemCode: string;
  itemName: string;
  category: string;
  unitPrice: number;
  unit: string;
  validFrom: string;
  validTo: string;
  status: AgreementStatus;
  volumeDiscounts: VolumeDiscount[];
  priceHistory: PriceHistory[];
  isBestPrice: boolean;
}

const mockPriceAgreements: PriceAgreement[] = [
  {
    id: '1',
    vendorId: '1',
    vendorName: 'MediSupply Kenya Ltd',
    itemCode: 'SYR-001',
    itemName: 'Disposable Syringes 5ml',
    category: 'Medical Supplies',
    unitPrice: 15,
    unit: 'piece',
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    status: 'active',
    volumeDiscounts: [
      { minQuantity: 100, maxQuantity: 499, discountPercent: 5 },
      { minQuantity: 500, maxQuantity: 999, discountPercent: 10 },
      { minQuantity: 1000, maxQuantity: null, discountPercent: 15 },
    ],
    priceHistory: [
      { date: '2023-01-01', price: 12, changePercent: 0 },
      { date: '2023-07-01', price: 13, changePercent: 8.3 },
      { date: '2024-01-01', price: 15, changePercent: 15.4 },
    ],
    isBestPrice: true,
  },
  {
    id: '2',
    vendorId: '2',
    vendorName: 'PharmaCare Distributors',
    itemCode: 'SYR-001',
    itemName: 'Disposable Syringes 5ml',
    category: 'Medical Supplies',
    unitPrice: 18,
    unit: 'piece',
    validFrom: '2024-01-01',
    validTo: '2024-06-30',
    status: 'active',
    volumeDiscounts: [
      { minQuantity: 200, maxQuantity: 999, discountPercent: 8 },
      { minQuantity: 1000, maxQuantity: null, discountPercent: 12 },
    ],
    priceHistory: [
      { date: '2023-01-01', price: 16, changePercent: 0 },
      { date: '2024-01-01', price: 18, changePercent: 12.5 },
    ],
    isBestPrice: false,
  },
  {
    id: '3',
    vendorId: '1',
    vendorName: 'MediSupply Kenya Ltd',
    itemCode: 'GLV-002',
    itemName: 'Latex Gloves (Box of 100)',
    category: 'Medical Supplies',
    unitPrice: 850,
    unit: 'box',
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    status: 'active',
    volumeDiscounts: [
      { minQuantity: 10, maxQuantity: 49, discountPercent: 5 },
      { minQuantity: 50, maxQuantity: null, discountPercent: 10 },
    ],
    priceHistory: [
      { date: '2023-06-01', price: 900, changePercent: 0 },
      { date: '2024-01-01', price: 850, changePercent: -5.6 },
    ],
    isBestPrice: true,
  },
  {
    id: '4',
    vendorId: '5',
    vendorName: 'Lab Consumables Ltd',
    itemCode: 'TUB-003',
    itemName: 'Blood Collection Tubes',
    category: 'Lab Consumables',
    unitPrice: 45,
    unit: 'piece',
    validFrom: '2024-01-15',
    validTo: '2025-01-14',
    status: 'active',
    volumeDiscounts: [
      { minQuantity: 500, maxQuantity: null, discountPercent: 7 },
    ],
    priceHistory: [
      { date: '2023-01-15', price: 42, changePercent: 0 },
      { date: '2024-01-15', price: 45, changePercent: 7.1 },
    ],
    isBestPrice: true,
  },
  {
    id: '5',
    vendorId: '3',
    vendorName: 'EquipMed Africa',
    itemCode: 'MON-001',
    itemName: 'Patient Monitor Cables',
    category: 'Equipment',
    unitPrice: 2500,
    unit: 'piece',
    validFrom: '2023-06-01',
    validTo: '2024-01-31',
    status: 'expired',
    volumeDiscounts: [],
    priceHistory: [
      { date: '2023-06-01', price: 2500, changePercent: 0 },
    ],
    isBestPrice: false,
  },
  {
    id: '6',
    vendorId: '2',
    vendorName: 'PharmaCare Distributors',
    itemCode: 'MED-101',
    itemName: 'Paracetamol 500mg (100 tablets)',
    category: 'Pharmaceuticals',
    unitPrice: 350,
    unit: 'pack',
    validFrom: '2024-02-01',
    validTo: '2024-12-31',
    status: 'pending',
    volumeDiscounts: [
      { minQuantity: 50, maxQuantity: 199, discountPercent: 5 },
      { minQuantity: 200, maxQuantity: null, discountPercent: 12 },
    ],
    priceHistory: [],
    isBestPrice: false,
  },
];

const statusConfig: Record<AgreementStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
};

export default function PriceAgreementsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<AgreementStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingAgreement, setViewingAgreement] = useState<PriceAgreement | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const vendors = useMemo(() => {
    const unique = [...new Set(mockPriceAgreements.map((a) => a.vendorName))];
    return unique.sort();
  }, []);

  const categories = useMemo(() => {
    const unique = [...new Set(mockPriceAgreements.map((a) => a.category))];
    return unique.sort();
  }, []);

  const filteredAgreements = useMemo(() => {
    return mockPriceAgreements.filter((agreement) => {
      const matchesSearch =
        agreement.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agreement.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agreement.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVendor = vendorFilter === 'all' || agreement.vendorName === vendorFilter;
      const matchesCategory = categoryFilter === 'all' || agreement.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || agreement.status === statusFilter;
      return matchesSearch && matchesVendor && matchesCategory && matchesStatus;
    });
  }, [searchQuery, vendorFilter, categoryFilter, statusFilter]);

  const priceComparison = useMemo(() => {
    const itemGroups: Record<string, PriceAgreement[]> = {};
    mockPriceAgreements.filter((a) => a.status === 'active').forEach((agreement) => {
      if (!itemGroups[agreement.itemCode]) {
        itemGroups[agreement.itemCode] = [];
      }
      itemGroups[agreement.itemCode].push(agreement);
    });
    return Object.entries(itemGroups)
      .filter(([_, items]) => items.length > 1)
      .map(([code, items]) => ({
        itemCode: code,
        itemName: items[0].itemName,
        vendors: items.sort((a, b) => a.unitPrice - b.unitPrice),
      }));
  }, []);

  const summaryStats = useMemo(() => {
    const active = mockPriceAgreements.filter((a) => a.status === 'active');
    return {
      total: mockPriceAgreements.length,
      active: active.length,
      bestPrices: mockPriceAgreements.filter((a) => a.isBestPrice).length,
      expiringSoon: active.filter((a) => {
        const daysLeft = Math.ceil((new Date(a.validTo).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 30 && daysLeft > 0;
      }).length,
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Price Agreements</h1>
            <p className="text-sm text-gray-500 mt-1">Manage vendor pricing and discounts</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Agreement
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <DollarSign className="w-4 h-4" />
              Total Agreements
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
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <Award className="w-4 h-4" />
              Best Prices
            </div>
            <p className="text-xl font-bold text-blue-700 mt-1">{summaryStats.bestPrices}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <Clock className="w-4 h-4" />
              Expiring Soon
            </div>
            <p className="text-xl font-bold text-orange-700 mt-1">{summaryStats.expiringSoon}</p>
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
              placeholder="Search items or vendors..."
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

          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 ${compareMode ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}`}
          >
            <TrendingDown className="w-4 h-4" />
            Compare Prices
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vendor</label>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AgreementStatus | 'all')}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="pending">Pending</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            {(vendorFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setVendorFilter('all');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
                className="text-sm text-blue-600 hover:underline mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {compareMode ? (
          /* Price Comparison View */
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Price Comparison Across Vendors</h2>
            {priceComparison.length > 0 ? (
              priceComparison.map((item) => (
                <div key={item.itemCode} className="bg-white rounded-lg border p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Package className="w-5 h-5 text-gray-400" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.itemName}</h3>
                      <p className="text-sm text-gray-500">{item.itemCode}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {item.vendors.map((vendor, idx) => (
                      <div
                        key={vendor.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${idx === 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-3">
                          {idx === 0 && <Award className="w-5 h-5 text-green-600" />}
                          <Building2 className={`w-4 h-4 ${idx === 0 ? 'text-green-600' : 'text-gray-400'}`} />
                          <span className={idx === 0 ? 'font-medium text-green-700' : 'text-gray-700'}>
                            {vendor.vendorName}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${idx === 0 ? 'text-green-700' : 'text-gray-900'}`}>
                            {formatCurrency(vendor.unitPrice)} / {vendor.unit}
                          </p>
                          {idx > 0 && (
                            <p className="text-xs text-red-500">
                              +{((vendor.unitPrice - item.vendors[0].unitPrice) / item.vendors[0].unitPrice * 100).toFixed(1)}% more
                            </p>
                          )}
                          {idx === 0 && (
                            <p className="text-xs text-green-600">Best price</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500 bg-white rounded-lg border">
                <TrendingDown className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No items with multiple vendor prices</p>
                <p className="text-sm">Add more price agreements to compare</p>
              </div>
            )}
          </div>
        ) : (
          /* Price Agreements Table */
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit Price</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Discounts</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Validity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAgreements.map((agreement) => {
                  const StatusIcon = statusConfig[agreement.status].icon;
                  const lastPrice = agreement.priceHistory[agreement.priceHistory.length - 1];
                  const prevPrice = agreement.priceHistory[agreement.priceHistory.length - 2];
                  return (
                    <tr key={agreement.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {agreement.isBestPrice && (
                            <Award className="w-4 h-4 text-green-500" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{agreement.itemName}</p>
                            <p className="text-xs text-gray-500">{agreement.itemCode} • {agreement.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{agreement.vendorName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(agreement.unitPrice)}</p>
                        <p className="text-xs text-gray-500">per {agreement.unit}</p>
                        {prevPrice && (
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {lastPrice.changePercent > 0 ? (
                              <TrendingUp className="w-3 h-3 text-red-500" />
                            ) : lastPrice.changePercent < 0 ? (
                              <TrendingDown className="w-3 h-3 text-green-500" />
                            ) : null}
                            <span className={`text-xs ${lastPrice.changePercent > 0 ? 'text-red-500' : lastPrice.changePercent < 0 ? 'text-green-500' : 'text-gray-500'}`}>
                              {lastPrice.changePercent > 0 ? '+' : ''}{lastPrice.changePercent.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {agreement.volumeDiscounts.length > 0 ? (
                          <div className="flex items-center justify-center gap-1">
                            <Percent className="w-4 h-4 text-purple-500" />
                            <span className="text-sm text-purple-600">
                              Up to {Math.max(...agreement.volumeDiscounts.map((d) => d.discountPercent))}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{agreement.validFrom} - {agreement.validTo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[agreement.status].color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[agreement.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewingAgreement(agreement)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                            title="Price History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredAgreements.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No price agreements found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Agreement Modal */}
      {viewingAgreement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{viewingAgreement.itemName}</h2>
                <p className="text-sm text-gray-500">{viewingAgreement.itemCode}</p>
              </div>
              <button onClick={() => setViewingAgreement(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(80vh-140px)] space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Vendor</p>
                  <p className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {viewingAgreement.vendorName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[viewingAgreement.status].color}`}>
                    {statusConfig[viewingAgreement.status].label}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Unit Price</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(viewingAgreement.unitPrice)} / {viewingAgreement.unit}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Validity Period</p>
                  <p className="font-medium">{viewingAgreement.validFrom} - {viewingAgreement.validTo}</p>
                </div>
              </div>

              {viewingAgreement.volumeDiscounts.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-purple-500" />
                    Volume Discounts
                  </h3>
                  <div className="space-y-2">
                    {viewingAgreement.volumeDiscounts.map((discount, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-purple-50 rounded-lg px-4 py-2">
                        <span className="text-sm">
                          {discount.minQuantity} - {discount.maxQuantity || '∞'} units
                        </span>
                        <span className="font-medium text-purple-700">{discount.discountPercent}% off</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewingAgreement.priceHistory.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-500" />
                    Price History
                  </h3>
                  <div className="space-y-2">
                    {viewingAgreement.priceHistory.map((history, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                        <span className="text-sm text-gray-600">{history.date}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(history.price)}</span>
                          {history.changePercent !== 0 && (
                            <span className={`text-xs ${history.changePercent > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {history.changePercent > 0 ? '+' : ''}{history.changePercent.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setViewingAgreement(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Close
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Edit Agreement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Agreement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Create Price Agreement</h2>
                <p className="text-sm text-gray-500">Set up vendor pricing</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <select className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Vendor</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                  <input type="text" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (KES)</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="piece">Piece</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="kg">Kilogram</option>
                    <option value="liter">Liter</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid To</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Agreement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}