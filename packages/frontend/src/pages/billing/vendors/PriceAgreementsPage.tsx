import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
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
  Loader2,
} from 'lucide-react';
import { priceAgreementsService, type PriceAgreement, type PriceAgreementStatus as PriceAgreementStatusType, type CreatePriceAgreementDto } from '../../../services/price-agreements';
import { useAuthStore } from '../../../store/auth';

type AgreementStatus = 'active' | 'expired' | 'pending' | 'draft' | 'terminated';

const statusConfig: Record<AgreementStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  expired: { label: 'Expired', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  terminated: { label: 'Terminated', color: 'bg-red-100 text-red-700', icon: X },
};

export default function PriceAgreementsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgreementStatus | 'all'>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingAgreement, setViewingAgreement] = useState<PriceAgreement | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Fetch price agreements
  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ['price-agreements', facilityId, statusFilter],
    queryFn: () => priceAgreementsService.list(facilityId, { status: statusFilter === 'all' ? undefined : statusFilter as PriceAgreementStatusType }),
    enabled: !!facilityId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['price-agreements-stats', facilityId],
    queryFn: () => priceAgreementsService.getStats(facilityId),
    enabled: !!facilityId,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePriceAgreementDto) => priceAgreementsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-agreements'] });
      setShowCreateModal(false);
    },
  });

  // Activate mutation
  const activateMutation = useMutation({
    mutationFn: (id: string) => priceAgreementsService.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-agreements'] });
    },
  });

  const vendors = useMemo(() => {
    const unique = [...new Set(agreements.map((a) => a.supplier?.name).filter(Boolean))];
    return unique.sort() as string[];
  }, [agreements]);

  const categories = useMemo(() => {
    const unique = [...new Set(agreements.map((a) => a.itemCode?.split('-')[0]).filter(Boolean))];
    return unique.sort() as string[];
  }, [agreements]);

  const filteredAgreements = useMemo(() => {
    return agreements.filter((agreement) => {
      const matchesSearch =
        agreement.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agreement.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (agreement.supplier?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [agreements, searchQuery]);

  const priceComparison = useMemo(() => {
    const itemGroups: Record<string, PriceAgreement[]> = {};
    agreements.filter((a) => a.status === 'active').forEach((agreement) => {
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
        vendors: items.sort((a, b) => Number(a.unitPrice) - Number(b.unitPrice)),
      }));
  }, [agreements]);

  const summaryStats = useMemo(() => {
    return {
      total: stats?.total || 0,
      active: stats?.active || 0,
      uniqueItems: stats?.uniqueItemsCovered || 0,
      expiring: stats?.expired || 0,
    };
  }, [stats]);

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
                <p className="font-medium">No price agreements found</p>
                <p className="text-sm mt-1">Create your first price agreement to get started</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Agreement
                </button>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ({CURRENCY_SYMBOL})</label>
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