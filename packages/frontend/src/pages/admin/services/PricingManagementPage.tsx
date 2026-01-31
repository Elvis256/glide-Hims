import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  DollarSign,
  Calendar,
  History,
  Upload,
  Edit2,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react';
import { servicesService, type Service } from '../../../services';
import { formatCurrency } from '../../../lib/currency';

interface PriceTier {
  cash: number;
  insurance: number;
  corporate: number;
}

interface ServicePriceDisplay {
  id: string;
  code: string;
  name: string;
  category: string;
  prices: PriceTier;
  effectiveFrom: string;
  effectiveTo: string | null;
  lastUpdated: string;
  priceChange: number;
}

interface EditingPrices {
  cash: number;
  insurance: number;
  corporate: number;
}

interface PriceHistoryItem {
  date: string;
  service: string;
  tier: string;
  oldPrice: number | null;
  newPrice: number | null;
  updatedBy: string;
  note?: string;
}

export default function PricingManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<'all' | 'cash' | 'insurance' | 'corporate'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPrices, setEditingPrices] = useState<EditingPrices | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);

  const queryClient = useQueryClient();

  // Fetch services from API
  const { data: apiServices, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesService.list(),
    staleTime: 60000,
  });

  // Mutation for updating service price
  const updatePriceMutation = useMutation({
    mutationFn: async ({ serviceId, basePrice }: { serviceId: string; basePrice: number }) => {
      return servicesService.update(serviceId, { basePrice });
    },
    onSuccess: (updatedService, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      // Add to local price history
      const service = prices.find(p => p.id === variables.serviceId);
      if (service) {
        setPriceHistory(prev => [{
          date: new Date().toISOString().split('T')[0],
          service: service.name,
          tier: 'Cash',
          oldPrice: service.prices.cash,
          newPrice: variables.basePrice,
          updatedBy: 'Current User',
        }, ...prev]);
      }
      setEditingId(null);
      setEditingPrices(null);
    },
  });

  // Transform API services to local ServicePriceDisplay format
  const prices: ServicePriceDisplay[] = useMemo(() => {
    if (!apiServices) return [];
    return apiServices.map((s: Service) => ({
      id: s.id,
      code: s.code || s.id.slice(0, 6).toUpperCase(),
      name: s.name,
      category: s.category?.name || 'General',
      prices: {
        cash: s.basePrice || 0,
        insurance: Math.round((s.basePrice || 0) * 1.2),
        corporate: Math.round((s.basePrice || 0) * 0.9),
      },
      effectiveFrom: new Date(s.createdAt).toISOString().split('T')[0],
      effectiveTo: null,
      lastUpdated: new Date(s.createdAt).toISOString().split('T')[0],
      priceChange: 0,
    }));
  }, [apiServices]);

  const handleStartEdit = (service: ServicePriceDisplay) => {
    setEditingId(service.id);
    setEditingPrices({ ...service.prices });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingPrices(null);
  };

  const handleSaveEdit = (serviceId: string) => {
    if (!editingPrices) return;
    updatePriceMutation.mutate({ serviceId, basePrice: editingPrices.cash });
  };

  const handlePriceChange = (tier: keyof EditingPrices, value: number) => {
    if (!editingPrices) return;
    setEditingPrices(prev => prev ? { ...prev, [tier]: value } : null);
  };

  const filteredPrices = useMemo(() => {
    return prices.filter(price =>
      price.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      price.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [prices, searchTerm]);

  const stats = useMemo(() => ({
    totalServices: prices.length,
    avgCashPrice: Math.round(prices.reduce((sum, p) => sum + p.prices.cash, 0) / (prices.length || 1)),
    priceIncreases: prices.filter(p => p.priceChange > 0).length,
    priceDecreases: prices.filter(p => p.priceChange < 0).length,
  }), [prices]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
            <p className="text-sm text-gray-500">Configure service prices across different tiers</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${
                showHistory ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <History className="w-4 h-4" />
              Price History
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Upload className="w-4 h-4" />
              Bulk Update
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Total Services</div>
            <div className="text-xl font-bold text-gray-900">{stats.totalServices}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Avg. Cash Price</div>
            <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.avgCashPrice)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="w-4 h-4" />
              Price Increases
            </div>
            <div className="text-xl font-bold text-green-700">{stats.priceIncreases}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-red-600">
              <TrendingDown className="w-4 h-4" />
              Price Decreases
            </div>
            <div className="text-xl font-bold text-red-700">{stats.priceDecreases}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Tier:</span>
            {(['all', 'cash', 'insurance', 'corporate'] as const).map(tier => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize ${
                  selectedTier === tier
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Table */}
        <div className={`flex-1 overflow-auto p-6 ${showHistory ? 'w-2/3' : 'w-full'}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading services...</span>
            </div>
          ) : (
          <div className="bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Service</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cash</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Insurance</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Corporate</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Effective Date</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Change</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPrices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No services found
                    </td>
                  </tr>
                ) : (
                filteredPrices.map(service => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{service.name}</div>
                        <div className="text-xs text-gray-500">{service.code} • {service.category}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === service.id && editingPrices ? (
                        <input
                          type="number"
                          value={editingPrices.cash}
                          onChange={(e) => handlePriceChange('cash', Number(e.target.value))}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      ) : (
                        <span className="font-medium">{formatCurrency(service.prices.cash)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === service.id && editingPrices ? (
                        <input
                          type="number"
                          value={editingPrices.insurance}
                          onChange={(e) => handlePriceChange('insurance', Number(e.target.value))}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      ) : (
                        <span className="font-medium text-blue-600">{formatCurrency(service.prices.insurance)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === service.id && editingPrices ? (
                        <input
                          type="number"
                          value={editingPrices.corporate}
                          onChange={(e) => handlePriceChange('corporate', Number(e.target.value))}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      ) : (
                        <span className="font-medium text-purple-600">{formatCurrency(service.prices.corporate)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {service.effectiveFrom}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {service.priceChange !== 0 && (
                        <span className={`inline-flex items-center gap-0.5 text-sm font-medium ${
                          service.priceChange > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {service.priceChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(service.priceChange)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {editingId === service.id ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(service.id)}
                              disabled={updatePriceMutation.isPending}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            >
                              {updatePriceMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={updatePriceMutation.isPending}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(service)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="w-1/3 border-l bg-white overflow-auto">
            <div className="p-4 border-b sticky top-0 bg-white">
              <h3 className="font-semibold text-gray-900">Price History</h3>
              <p className="text-sm text-gray-500">Recent price changes</p>
            </div>
            <div className="p-4 space-y-3">
              {priceHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No price changes recorded yet
                </div>
              ) : (
              priceHistory.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{item.service}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.date}
                    </span>
                  </div>
                  {item.oldPrice && item.newPrice ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{item.tier}:</span>
                      <span className="text-red-500 line-through">{formatCurrency(item.oldPrice)}</span>
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      <span className="text-green-600">{formatCurrency(item.newPrice)}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">{item.note}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">by {item.updatedBy}</div>
                </div>
              ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
