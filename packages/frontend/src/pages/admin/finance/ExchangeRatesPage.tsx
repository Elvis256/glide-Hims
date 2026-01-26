import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Save,
  X,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
  History,
  Clock,
  ArrowRightLeft,
  Settings,
  Check,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from 'lucide-react';
import { financeService, type ExchangeRate as APIExchangeRate } from '../../../services';

interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  previousRate: number;
  effectiveDate: string;
  lastUpdated: string;
  source: 'Manual' | 'API' | 'Bank';
}

interface RateHistory {
  date: string;
  rate: number;
  source: string;
}

const mockRates: ExchangeRate[] = [
  { id: '1', fromCurrency: 'UGX', toCurrency: 'USD', rate: 0.000267, previousRate: 0.000265, effectiveDate: '2024-01-20', lastUpdated: '2024-01-20 09:00', source: 'API' },
  { id: '2', fromCurrency: 'UGX', toCurrency: 'EUR', rate: 0.000245, previousRate: 0.000248, effectiveDate: '2024-01-20', lastUpdated: '2024-01-20 09:00', source: 'API' },
  { id: '3', fromCurrency: 'UGX', toCurrency: 'GBP', rate: 0.000212, previousRate: 0.000210, effectiveDate: '2024-01-20', lastUpdated: '2024-01-20 09:00', source: 'API' },
  { id: '4', fromCurrency: 'UGX', toCurrency: 'KES', rate: 0.0426, previousRate: 0.0424, effectiveDate: '2024-01-20', lastUpdated: '2024-01-20 09:00', source: 'API' },
  { id: '5', fromCurrency: 'UGX', toCurrency: 'TZS', rate: 0.672, previousRate: 0.670, effectiveDate: '2024-01-20', lastUpdated: '2024-01-20 09:00', source: 'Manual' },
  { id: '6', fromCurrency: 'UGX', toCurrency: 'RWF', rate: 0.343, previousRate: 0.341, effectiveDate: '2024-01-20', lastUpdated: '2024-01-20 09:00', source: 'Manual' },
  { id: '7', fromCurrency: 'UGX', toCurrency: 'ZAR', rate: 0.00502, previousRate: 0.00498, effectiveDate: '2024-01-20', lastUpdated: '2024-01-20 09:00', source: 'Bank' },
];

const mockRateHistory: Record<string, RateHistory[]> = {
  '1': [
    { date: '2024-01-20', rate: 0.000267, source: 'API' },
    { date: '2024-01-19', rate: 0.000265, source: 'API' },
    { date: '2024-01-18', rate: 0.000266, source: 'API' },
    { date: '2024-01-17', rate: 0.000264, source: 'API' },
    { date: '2024-01-16', rate: 0.000263, source: 'API' },
  ],
};

const autoUpdateSettings = {
  enabled: true,
  frequency: 'Daily',
  lastSync: '2024-01-20 09:00:00',
  source: 'Open Exchange Rates API',
};

export default function ExchangeRatesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRate, setSelectedRate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rates' | 'settings'>('rates');
  const [autoUpdate, setAutoUpdate] = useState(autoUpdateSettings.enabled);

  const baseCurrency = 'UGX';

  // Fetch exchange rates from API
  const { data: apiRates, isLoading, refetch } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => financeService.exchangeRates.list(),
    staleTime: 30000,
  });

  // Transform API data to local format
  const rates: ExchangeRate[] = useMemo(() => {
    if (!apiRates) return [];
    return apiRates.map((r: APIExchangeRate) => ({
      id: r.id,
      fromCurrency: r.fromCurrency?.code || 'UGX',
      toCurrency: r.toCurrency?.code || 'USD',
      rate: r.rate,
      previousRate: r.rate * 0.99, // Simulate previous rate
      effectiveDate: r.effectiveDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      lastUpdated: r.effectiveDate || new Date().toISOString(),
      source: 'API' as const,
    }));
  }, [apiRates]);

  // Update rate mutation
  const updateRateMutation = useMutation({
    mutationFn: ({ id, rate }: { id: string; rate: number }) =>
      financeService.exchangeRates.update(id, rate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      setEditingId(null);
    },
  });

  const filteredRates = useMemo(() => {
    return rates.filter(r =>
      r.toCurrency.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rates, searchTerm]);

  const stats = useMemo(() => {
    const increases = rates.filter(r => r.rate > r.previousRate).length;
    const decreases = rates.filter(r => r.rate < r.previousRate).length;
    return {
      total: rates.length,
      increases,
      decreases,
      unchanged: rates.length - increases - decreases,
    };
  }, [rates]);

  const calculateChange = (rate: ExchangeRate) => {
    const change = ((rate.rate - rate.previousRate) / rate.previousRate) * 100;
    return change.toFixed(2);
  };

  const handleRefreshRates = () => {
    refetch();
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Exchange Rates</h1>
            <p className="text-sm text-gray-500">
              Base Currency: <span className="font-semibold text-blue-600">{baseCurrency}</span> • 
              Last synced: {autoUpdateSettings.lastSync}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshRates}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Sync Rates
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Rate
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Currency Pairs</div>
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Increased</div>
              <div className="text-xl font-bold text-green-600">{stats.increases}</div>
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Decreased</div>
              <div className="text-xl font-bold text-red-600">{stats.decreases}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-gray-200 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Auto-Update</div>
              <div className="text-xl font-bold text-gray-900">{autoUpdate ? 'On' : 'Off'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-6">
          {[
            { id: 'rates', label: 'Exchange Rates', icon: ArrowRightLeft },
            { id: 'settings', label: 'Auto-Update Settings', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'rates' && (
        <>
          {/* Search */}
          <div className="bg-white border-b px-6 py-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search currency..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Table */}
            <div className={`flex-1 overflow-auto p-6 ${selectedRate ? 'w-2/3' : 'w-full'}`}>
              <div className="bg-white rounded-lg border">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Currency Pair</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Change</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Effective Date</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Source</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRates.map(rate => {
                      const change = parseFloat(calculateChange(rate));
                      const isIncrease = change > 0;
                      const isDecrease = change < 0;
                      
                      return (
                        <tr
                          key={rate.id}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedRate === rate.id ? 'bg-blue-50' : ''}`}
                          onClick={() => setSelectedRate(rate.id === selectedRate ? null : rate.id)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-blue-100 rounded">
                                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {rate.fromCurrency} → {rate.toCurrency}
                                </div>
                                <div className="text-xs text-gray-500">
                                  1 {rate.fromCurrency} = {rate.rate} {rate.toCurrency}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {editingId === rate.id ? (
                              <input
                                type="number"
                                step="0.000001"
                                defaultValue={rate.rate}
                                className="w-28 px-2 py-1 border rounded text-right"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className="font-mono font-medium text-gray-900">{rate.rate}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center gap-0.5 font-medium ${
                              isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {isIncrease && <TrendingUp className="w-3 h-3" />}
                              {isDecrease && <TrendingDown className="w-3 h-3" />}
                              {change !== 0 ? `${isIncrease ? '+' : ''}${change}%` : '0%'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                              <Calendar className="w-3 h-3" />
                              {rate.effectiveDate}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              rate.source === 'API' ? 'bg-blue-100 text-blue-700' :
                              rate.source === 'Bank' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {rate.source}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {editingId === rate.id ? (
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
                                <>
                                  <button
                                    onClick={() => setEditingId(rate.id)}
                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setSelectedRate(rate.id)}
                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                  >
                                    <History className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* History Panel */}
            {selectedRate && (
              <div className="w-1/3 border-l bg-white overflow-auto">
                <div className="p-4 border-b sticky top-0 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">Rate History</h3>
                      <p className="text-sm text-gray-500">
                        {rates.find(r => r.id === selectedRate)?.fromCurrency} → {rates.find(r => r.id === selectedRate)?.toCurrency}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedRate(null)}
                      className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {(mockRateHistory[selectedRate] || mockRateHistory['1']).map((history, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {history.date}
                        </div>
                        <div className="font-mono font-medium text-gray-900">{history.rate}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        history.source === 'API' ? 'bg-blue-100 text-blue-700' :
                        history.source === 'Bank' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {history.source}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'settings' && (
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl space-y-4">
            {/* Auto-Update Toggle */}
            <div className="bg-white rounded-lg border">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Automatic Rate Updates</div>
                    <div className="text-sm text-gray-500">Automatically fetch latest exchange rates</div>
                  </div>
                </div>
                <button
                  onClick={() => setAutoUpdate(!autoUpdate)}
                  className={`p-1 rounded-full ${autoUpdate ? 'text-blue-600' : 'text-gray-400'}`}
                >
                  {autoUpdate ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>
            </div>

            {/* Settings Form */}
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Update Configuration</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Update Frequency</label>
                    <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Hourly</option>
                      <option selected>Daily</option>
                      <option>Weekly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Update Time</label>
                    <input
                      type="time"
                      defaultValue="09:00"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
                  <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Open Exchange Rates API</option>
                    <option>Fixer.io</option>
                    <option>XE.com</option>
                    <option>Central Bank of Uganda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="password"
                    placeholder="Enter your API key"
                    defaultValue="••••••••••••••••"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Last Sync Info */}
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Sync Status</h3>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Check className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-700">Last successful sync</div>
                    <div className="text-sm text-green-600">{autoUpdateSettings.lastSync}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button className="flex items-center gap-2 px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Save className="w-4 h-4" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
