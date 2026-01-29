import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Save,
  X,
  DollarSign,
  Check,
  Star,
  ToggleLeft,
  ToggleRight,
  Globe,
  Hash,
  Loader2,
} from 'lucide-react';
import { financeService, type Currency, type CreateCurrencyDto } from '../../../services';

const STORAGE_KEY = 'glide_currencies';

const getStoredCurrencies = (): Currency[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveCurrenciesToStorage = (currencies: Currency[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currencies));
};

const initialFormState: CreateCurrencyDto = {
  code: '',
  name: '',
  symbol: '',
  decimalPlaces: 2,
  country: '',
};

export default function CurrenciesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [formData, setFormData] = useState<CreateCurrencyDto>(initialFormState);
  const [localCurrencies, setLocalCurrencies] = useState<Currency[]>([]);
  const [useLocalStorage, setUseLocalStorage] = useState(false);

  // Load local currencies on mount
  useEffect(() => {
    setLocalCurrencies(getStoredCurrencies());
  }, []);

  // Fetch currencies from API
  const { data: apiCurrencies, isLoading, isError } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => financeService.currencies.list(),
    staleTime: 60000,
    retry: 1,
  });

  // Use localStorage if API fails
  useEffect(() => {
    if (isError) {
      setUseLocalStorage(true);
    }
  }, [isError]);

  const currencies = useLocalStorage ? localCurrencies : (apiCurrencies || localCurrencies);

  // Toggle currency status mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => {
      if (useLocalStorage) {
        const updated = localCurrencies.map(c => 
          c.id === id ? { ...c, isActive: !c.isActive } : c
        );
        saveCurrenciesToStorage(updated);
        setLocalCurrencies(updated);
        return Promise.resolve(updated.find(c => c.id === id)!);
      }
      return financeService.currencies.toggleActive(id);
    },
    onSuccess: () => {
      if (!useLocalStorage) {
        queryClient.invalidateQueries({ queryKey: ['currencies'] });
      }
    },
  });

  // Set default currency mutation
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => {
      if (useLocalStorage) {
        const updated = localCurrencies.map(c => ({
          ...c,
          isDefault: c.id === id,
        }));
        saveCurrenciesToStorage(updated);
        setLocalCurrencies(updated);
        return Promise.resolve(updated.find(c => c.id === id)!);
      }
      return financeService.currencies.setDefault(id);
    },
    onSuccess: () => {
      if (!useLocalStorage) {
        queryClient.invalidateQueries({ queryKey: ['currencies'] });
      }
    },
  });

  // Create currency mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateCurrencyDto) => {
      if (useLocalStorage) {
        const newCurrency: Currency = {
          id: crypto.randomUUID(),
          ...data,
          isActive: true,
          isDefault: localCurrencies.length === 0,
          createdAt: new Date().toISOString(),
        };
        const updated = [...localCurrencies, newCurrency];
        saveCurrenciesToStorage(updated);
        setLocalCurrencies(updated);
        return Promise.resolve(newCurrency);
      }
      return financeService.currencies.create(data);
    },
    onSuccess: () => {
      if (!useLocalStorage) {
        queryClient.invalidateQueries({ queryKey: ['currencies'] });
      }
      setShowAddModal(false);
      setFormData(initialFormState);
    },
  });

  const handleAddCurrency = () => {
    if (!formData.code || !formData.name || !formData.symbol) {
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredCurrencies = useMemo(() => {
    return currencies.filter((c: Currency) => {
      const matchesSearch = 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.country || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        filterStatus === 'all' ||
        (filterStatus === 'active' && c.isActive) ||
        (filterStatus === 'inactive' && !c.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [currencies, searchTerm, filterStatus]);

  const toggleCurrencyStatus = (id: string) => {
    toggleMutation.mutate(id);
  };

  const setDefaultCurrency = (id: string) => {
    setDefaultMutation.mutate(id);
  };

  const stats = useMemo(() => ({
    total: currencies.length,
    active: currencies.filter((c: Currency) => c.isActive).length,
    defaultCurrency: currencies.find((c: Currency) => c.isDefault),
  }), [currencies]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Currencies</h1>
            <p className="text-sm text-gray-500">Manage supported currencies and settings</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Currency
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Currencies</div>
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active Currencies</div>
              <div className="text-xl font-bold text-green-600">{stats.active}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Default Currency</div>
              <div className="text-xl font-bold text-gray-900">
                {stats.defaultCurrency?.code || 'Not Set'}
              </div>
            </div>
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
              placeholder="Search currencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Status:</span>
            {(['all', 'active', 'inactive'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize ${
                  filterStatus === status
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Currency</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Symbol</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Decimals</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Country</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Default</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCurrencies.map(currency => (
                <tr key={currency.id} className={`hover:bg-gray-50 ${!currency.isActive ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded ${currency.isDefault ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                        <DollarSign className={`w-4 h-4 ${currency.isDefault ? 'text-yellow-600' : 'text-gray-600'}`} />
                      </div>
                      <span className="font-medium text-gray-900">{currency.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{currency.code}</code>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-lg font-semibold text-gray-700">{currency.symbol}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Hash className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-600">{currency.decimalPlaces}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{currency.country}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {currency.isDefault ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                        <Star className="w-3 h-3 fill-current" />
                        Default
                      </span>
                    ) : (
                      <button
                        onClick={() => setDefaultCurrency(currency.id)}
                        className="text-xs text-gray-500 hover:text-blue-600 hover:underline"
                      >
                        Set as default
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      currency.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {currency.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {editingId === currency.id ? (
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
                            onClick={() => setEditingId(currency.id)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {!currency.isDefault && (
                            <button
                              onClick={() => toggleCurrencyStatus(currency.id)}
                              className={`p-1.5 rounded ${
                                currency.isActive
                                  ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                                  : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                              }`}
                            >
                              {currency.isActive ? (
                                <ToggleRight className="w-4 h-4" />
                              ) : (
                                <ToggleLeft className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Currency Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Add New Currency</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency Code</label>
                <input
                  type="text"
                  placeholder="e.g., USD"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  maxLength={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency Name</label>
                <input
                  type="text"
                  placeholder="e.g., US Dollar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
                  <input
                    type="text"
                    placeholder="e.g., $"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                    maxLength={5}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Decimal Places</label>
                  <select 
                    value={formData.decimalPlaces}
                    onChange={(e) => setFormData({ ...formData, decimalPlaces: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="0">0</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country/Region</label>
                <input
                  type="text"
                  placeholder="e.g., United States"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormData(initialFormState);
                }}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCurrency}
                disabled={createMutation.isPending || !formData.code || !formData.name || !formData.symbol}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Currency
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
