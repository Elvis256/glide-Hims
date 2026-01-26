import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Filter,
  ChevronRight,
  Clock,
  Loader2,
} from 'lucide-react';
import { servicesService, type Service } from '../../../services';

interface PriceTier {
  cash: number;
  insurance: number;
  corporate: number;
}

interface ServicePrice {
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

const mockPrices: ServicePrice[] = [
  { id: '1', code: 'CON001', name: 'General Consultation', category: 'Consultation', prices: { cash: 500, insurance: 600, corporate: 450 }, effectiveFrom: '2024-01-01', effectiveTo: null, lastUpdated: '2024-01-15', priceChange: 5 },
  { id: '2', code: 'CON002', name: 'Specialist Consultation', category: 'Consultation', prices: { cash: 1500, insurance: 1800, corporate: 1350 }, effectiveFrom: '2024-01-01', effectiveTo: null, lastUpdated: '2024-01-15', priceChange: 10 },
  { id: '3', code: 'LAB001', name: 'Complete Blood Count', category: 'Lab', prices: { cash: 350, insurance: 420, corporate: 315 }, effectiveFrom: '2024-02-01', effectiveTo: null, lastUpdated: '2024-01-20', priceChange: 0 },
  { id: '4', code: 'LAB002', name: 'Lipid Profile', category: 'Lab', prices: { cash: 800, insurance: 960, corporate: 720 }, effectiveFrom: '2024-01-15', effectiveTo: null, lastUpdated: '2024-01-10', priceChange: -2 },
  { id: '5', code: 'RAD001', name: 'Chest X-Ray', category: 'Radiology', prices: { cash: 600, insurance: 720, corporate: 540 }, effectiveFrom: '2024-01-01', effectiveTo: null, lastUpdated: '2024-01-05', priceChange: 8 },
  { id: '6', code: 'RAD002', name: 'CT Scan - Head', category: 'Radiology', prices: { cash: 5000, insurance: 6000, corporate: 4500 }, effectiveFrom: '2024-01-01', effectiveTo: null, lastUpdated: '2024-01-05', priceChange: 0 },
  { id: '7', code: 'PRO001', name: 'Minor Surgery', category: 'Procedures', prices: { cash: 3000, insurance: 3600, corporate: 2700 }, effectiveFrom: '2024-01-01', effectiveTo: null, lastUpdated: '2024-01-12', priceChange: 15 },
];

const mockHistory = [
  { date: '2024-01-15', service: 'General Consultation', tier: 'Cash', oldPrice: 475, newPrice: 500, updatedBy: 'Admin' },
  { date: '2024-01-15', service: 'Specialist Consultation', tier: 'All Tiers', oldPrice: null, newPrice: null, updatedBy: 'Admin', note: 'Bulk update +10%' },
  { date: '2024-01-10', service: 'Lipid Profile', tier: 'Insurance', oldPrice: 980, newPrice: 960, updatedBy: 'Finance' },
];

export default function PricingManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<'all' | 'cash' | 'insurance' | 'corporate'>('all');
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch services from API
  const { data: apiServices, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesService.list(),
    staleTime: 60000,
  });

  // Transform API services to local ServicePrice format
  const prices: ServicePrice[] = useMemo(() => {
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
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: null,
      lastUpdated: new Date().toISOString().split('T')[0],
      priceChange: 0,
    }));
  }, [apiServices]);

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
            <div className="text-xl font-bold text-gray-900">KES {stats.avgCashPrice.toLocaleString()}</div>
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
                {filteredPrices.map(service => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{service.name}</div>
                        <div className="text-xs text-gray-500">{service.code} • {service.category}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === service.id ? (
                        <input
                          type="number"
                          defaultValue={service.prices.cash}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      ) : (
                        <span className="font-medium">KES {service.prices.cash.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === service.id ? (
                        <input
                          type="number"
                          defaultValue={service.prices.insurance}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      ) : (
                        <span className="font-medium text-blue-600">KES {service.prices.insurance.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === service.id ? (
                        <input
                          type="number"
                          defaultValue={service.prices.corporate}
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      ) : (
                        <span className="font-medium text-purple-600">KES {service.prices.corporate.toLocaleString()}</span>
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
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingId(service.id)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="w-1/3 border-l bg-white overflow-auto">
            <div className="p-4 border-b sticky top-0 bg-white">
              <h3 className="font-semibold text-gray-900">Price History</h3>
              <p className="text-sm text-gray-500">Recent price changes</p>
            </div>
            <div className="p-4 space-y-3">
              {mockHistory.map((item, idx) => (
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
                      <span className="text-red-500 line-through">KES {item.oldPrice}</span>
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      <span className="text-green-600">KES {item.newPrice}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">{item.note}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">by {item.updatedBy}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
