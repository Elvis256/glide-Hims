import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { api } from '../../../services/api';
import type { Currency, CreateCurrencyDto } from '../../../services';
import {
  Button,
  Input,
  Select,
  Card,
  Badge,
  StatCard,
  PageHeader,
  EmptyState,
  SkeletonTable,
  cn,
} from '../../../components/ui';

interface CurrenciesConfig {
  currencies: Currency[];
}

const SETTINGS_KEY = '/settings/currencies';

const initialFormState: CreateCurrencyDto = {
  code: '',
  name: '',
  symbol: '',
  decimalPlaces: 2,
  country: '',
};

const saveCurrenciesConfig = async (currencies: Currency[]) => {
  const payload: CurrenciesConfig = { currencies };
  await api.put(SETTINGS_KEY, { value: payload, description: 'Currencies configuration' });
};

export default function CurrenciesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [formData, setFormData] = useState<CreateCurrencyDto>(initialFormState);

  // Fetch currencies config from settings API
  const { data: currencies = [], isLoading } = useQuery({
    queryKey: ['settings', 'currencies'],
    queryFn: async (): Promise<Currency[]> => {
      try {
        const response = await api.get<{ value: CurrenciesConfig }>(SETTINGS_KEY);
        return response.data.value?.currencies ?? [];
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosErr = err as { response?: { status?: number } };
          if (axiosErr.response?.status === 404) return [];
        }
        throw err;
      }
    },
    staleTime: 60000,
  });

  // Toggle currency status mutation
  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = currencies.map(c =>
        c.id === id ? { ...c, isActive: !c.isActive } : c
      );
      await saveCurrenciesConfig(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'currencies'] });
    },
  });

  // Set default currency mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const updated = currencies.map(c => ({
        ...c,
        isDefault: c.id === id,
      }));
      await saveCurrenciesConfig(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'currencies'] });
    },
  });

  // Create currency mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateCurrencyDto) => {
      const newCurrency: Currency = {
        id: crypto.randomUUID(),
        ...data,
        isActive: true,
        isDefault: currencies.length === 0,
        createdAt: new Date().toISOString(),
      };
      const updated = [...currencies, newCurrency];
      await saveCurrenciesConfig(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'currencies'] });
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

  const thClass = 'px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wide';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Currencies"
        subtitle="Manage supported currencies and settings"
        actions={
          <Button icon={Plus} onClick={() => setShowAddModal(true)}>
            Add Currency
          </Button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={Globe} label="Total Currencies" value={stats.total} />
          <StatCard icon={Check} label="Active Currencies" value={stats.active} tone="success" />
          <StatCard
            icon={Star}
            label="Default Currency"
            value={stats.defaultCurrency?.code || 'Not Set'}
            tone="warning"
          />
        </div>
      </PageHeader>

      <Card flush>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 p-4 border-b border-surface-200/70">
          <div className="flex-1 min-w-56 max-w-md">
            <Input
              icon={Search}
              placeholder="Search currencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-surface-500">Status:</span>
            {(['all', 'active', 'inactive'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm capitalize transition-colors',
                  filterStatus === status
                    ? 'bg-brand-100 text-brand-700 font-medium'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200',
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-6">
            <SkeletonTable rows={5} cols={6} />
          </div>
        ) : filteredCurrencies.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title={currencies.length === 0 ? 'No currencies configured' : 'No currencies match your filters'}
            description={
              currencies.length === 0
                ? 'Add your first currency to define how amounts are displayed and billed.'
                : 'Try adjusting the search or status filter.'
            }
            action={
              currencies.length === 0 ? (
                <Button icon={Plus} onClick={() => setShowAddModal(true)}>
                  Add Currency
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th className={cn(thClass, 'text-left')}>Currency</th>
                  <th className={cn(thClass, 'text-left')}>Code</th>
                  <th className={cn(thClass, 'text-center')}>Symbol</th>
                  <th className={cn(thClass, 'text-center')}>Decimals</th>
                  <th className={cn(thClass, 'text-left')}>Country</th>
                  <th className={cn(thClass, 'text-center')}>Default</th>
                  <th className={cn(thClass, 'text-center')}>Status</th>
                  <th className={cn(thClass, 'text-center')}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {filteredCurrencies.map(currency => (
                  <tr
                    key={currency.id}
                    className={cn('hover:bg-surface-50 transition-colors', !currency.isActive && 'opacity-60')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-1.5 rounded-lg', currency.isDefault ? 'bg-amber-50' : 'bg-surface-100')}>
                          <DollarSign className={cn('w-4 h-4', currency.isDefault ? 'text-amber-600' : 'text-surface-500')} />
                        </div>
                        <span className="font-medium text-surface-900">{currency.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm bg-surface-100 px-2 py-1 rounded-md font-mono">{currency.code}</code>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-lg font-semibold text-surface-700">{currency.symbol}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-surface-600">
                        <Hash className="w-3 h-3 text-surface-400" />
                        {currency.decimalPlaces}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-surface-600">{currency.country}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {currency.isDefault ? (
                        <Badge tone="warning" icon={Star}>Default</Badge>
                      ) : (
                        <button
                          onClick={() => setDefaultCurrency(currency.id)}
                          className="text-xs text-surface-500 hover:text-brand-600 hover:underline"
                        >
                          Set as default
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={currency.isActive ? 'success' : 'neutral'} dot>
                        {currency.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {editingId === currency.id ? (
                          <>
                            <Button variant="ghost" size="sm" icon={Save} onClick={() => setEditingId(null)} className="text-emerald-600 hover:bg-emerald-50" />
                            <Button variant="ghost" size="sm" icon={X} onClick={() => setEditingId(null)} />
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" icon={Edit2} onClick={() => setEditingId(currency.id)} />
                            {!currency.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={currency.isActive ? ToggleRight : ToggleLeft}
                                onClick={() => toggleCurrencyStatus(currency.id)}
                                loading={toggleMutation.isPending && toggleMutation.variables === currency.id}
                                className={currency.isActive ? 'hover:text-rose-600 hover:bg-rose-50' : 'hover:text-emerald-600 hover:bg-emerald-50'}
                              />
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
        )}
      </Card>

      {/* Add Currency Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center z-50 p-4">
          <Card flush className="w-full max-w-md shadow-xl animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-surface-200/70">
              <h3 className="text-base font-semibold text-surface-900">Add New Currency</h3>
              <Button variant="ghost" size="sm" icon={X} onClick={() => setShowAddModal(false)} />
            </div>
            <div className="p-4 space-y-4">
              <Input
                label="Currency Code"
                placeholder="e.g., USD"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                maxLength={3}
                required
              />
              <Input
                label="Currency Name"
                placeholder="e.g., US Dollar"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Symbol"
                  placeholder="e.g., $"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  maxLength={5}
                  required
                />
                <Select
                  label="Decimal Places"
                  value={formData.decimalPlaces}
                  onChange={(e) => setFormData({ ...formData, decimalPlaces: Number(e.target.value) })}
                >
                  <option value="0">0</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </Select>
              </div>
              <Input
                label="Country/Region"
                placeholder="e.g., United States"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-surface-200/70 bg-surface-50 rounded-b-2xl">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowAddModal(false);
                  setFormData(initialFormState);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCurrency}
                loading={createMutation.isPending}
                disabled={!formData.code || !formData.name || !formData.symbol}
              >
                Add Currency
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
