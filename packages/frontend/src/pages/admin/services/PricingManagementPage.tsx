import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  DollarSign,
  Calendar,
  History,
  Edit2,
  Save,
  X,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Clock,
  Loader2,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { servicesService, type Service } from '../../../services';
import { formatCurrency, CURRENCY_SYMBOL } from '../../../lib/currency';
import {
  getInsurancePriceLists, createInsurancePriceList, updateInsurancePriceList,
  type InsurancePriceList,
} from '../../../services/pricing';
import { insuranceService, type InsuranceProvider } from '../../../services/insurance';

export default function PricingManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCash, setEditCash] = useState(0);
  const [editInsurance, setEditInsurance] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<Array<{ date: string; service: string; field: string; oldVal: number; newVal: number }>>([]);

  const queryClient = useQueryClient();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesService.list({ includeInactive: true }),
    staleTime: 30000,
  });

  const { data: providers } = useQuery({
    queryKey: ['insuranceProviders'],
    queryFn: () => insuranceService.providers.list(),
    staleTime: 60000,
  });

  const { data: priceLists } = useQuery({
    queryKey: ['insurancePriceLists'],
    queryFn: () => getInsurancePriceLists({ isActive: true }),
    staleTime: 30000,
  });

  const updateCashMutation = useMutation({
    mutationFn: ({ id, basePrice }: { id: string; basePrice: number }) =>
      servicesService.update(id, { basePrice }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });

  const provs = providers || [];
  const priceListData = (priceLists as any)?.data || priceLists || [];

  const getInsPrice = (serviceId: string, providerId: string): InsurancePriceList | undefined =>
    priceListData.find((p: InsurancePriceList) => p.serviceId === serviceId && p.insuranceProviderId === providerId);

  const filteredServices = useMemo(() => {
    if (!services) return [];
    return services.filter(s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [services, searchTerm]);

  const stats = useMemo(() => {
    const svcs = services || [];
    return {
      total: svcs.length,
      avgCash: Math.round(svcs.reduce((s, v) => s + (v.basePrice || 0), 0) / (svcs.length || 1)),
      withInsurance: svcs.filter(s => priceListData.some((p: InsurancePriceList) => p.serviceId === s.id)).length,
      providers: provs.length,
    };
  }, [services, priceListData, provs]);

  const handleStartEdit = (svc: Service) => {
    setEditingId(svc.id);
    setEditCash(svc.basePrice || 0);
    const map: Record<string, string> = {};
    provs.forEach(p => {
      const pl = getInsPrice(svc.id, p.id);
      map[p.id] = pl ? String(Number(pl.agreedPrice)) : '';
    });
    setEditInsurance(map);
  };

  const handleSave = async (svc: Service) => {
    // Save cash price
    if (editCash !== svc.basePrice) {
      await updateCashMutation.mutateAsync({ id: svc.id, basePrice: editCash });
      setLocalHistory(h => [{ date: new Date().toISOString().split('T')[0], service: svc.name, field: 'Cash', oldVal: svc.basePrice, newVal: editCash }, ...h]);
    }
    // Save insurance prices
    for (const prov of provs) {
      const val = parseFloat(editInsurance[prov.id] || '0');
      const existing = getInsPrice(svc.id, prov.id);
      if (val > 0 && existing) {
        if (val !== Number(existing.agreedPrice)) {
          await updateInsurancePriceList(existing.id, { agreedPrice: val });
          setLocalHistory(h => [{ date: new Date().toISOString().split('T')[0], service: svc.name, field: prov.name, oldVal: Number(existing.agreedPrice), newVal: val }, ...h]);
        }
      } else if (val > 0 && !existing) {
        await createInsurancePriceList({ insuranceProviderId: prov.id, serviceId: svc.id, agreedPrice: val });
        setLocalHistory(h => [{ date: new Date().toISOString().split('T')[0], service: svc.name, field: prov.name, oldVal: 0, newVal: val }, ...h]);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['insurancePriceLists'] });
    setEditingId(null);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
            <p className="text-sm text-gray-500">Configure cash and insurance prices for all services</p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm ${
              showHistory ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <History className="w-4 h-4" />Price History
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Services', value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
            { label: 'Avg. Cash Price', value: formatCurrency(stats.avgCash), color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'With Insurance Prices', value: stats.withInsurance, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Insurance Providers', value: stats.providers, color: 'text-purple-700', bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3`}>
              <div className="text-sm text-gray-500">{s.label}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search services..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 overflow-auto p-6 ${showHistory ? 'w-2/3' : 'w-full'}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-48">Service</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase min-w-28">💵 Cash</th>
                    {provs.map(p => (
                      <th key={p.id} className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase min-w-28">
                        <span className="inline-flex items-center gap-1 truncate max-w-28" title={p.name}>
                          <Shield className="w-3 h-3" />{p.name}
                        </span>
                      </th>
                    ))}
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredServices.length === 0 ? (
                    <tr><td colSpan={3 + provs.length} className="px-4 py-12 text-center text-gray-500 text-sm">
                      {(services?.length || 0) === 0 ? 'No services yet. Add services in Service Catalog first.' : 'No services match your search.'}
                    </td></tr>
                  ) : filteredServices.map(svc => {
                    const isEditing = editingId === svc.id;
                    return (
                      <tr key={svc.id} className="hover:bg-gray-50 group">
                        <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                          <div className="font-medium text-gray-900 text-sm">{svc.name}</div>
                          <div className="text-xs text-gray-400">{svc.code} · {svc.category?.name || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isEditing ? (
                            <input type="number" value={editCash} onChange={e => setEditCash(Number(e.target.value))}
                              className="w-28 px-2 py-1 border rounded text-right text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                          ) : (
                            <span className="font-semibold text-green-700 text-sm">{formatCurrency(svc.basePrice)}</span>
                          )}
                        </td>
                        {provs.map(p => {
                          const pl = getInsPrice(svc.id, p.id);
                          const price = pl ? Number(pl.agreedPrice) : 0;
                          const diff = price && svc.basePrice ? ((svc.basePrice - price) / svc.basePrice * 100) : 0;
                          return (
                            <td key={p.id} className="px-4 py-3 text-right">
                              {isEditing ? (
                                <input type="number" value={editInsurance[p.id] || ''}
                                  onChange={e => setEditInsurance(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  placeholder="—"
                                  className="w-28 px-2 py-1 border rounded text-right text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                              ) : price > 0 ? (
                                <div>
                                  <span className="font-medium text-gray-900 text-sm">{formatCurrency(price)}</span>
                                  {diff !== 0 && (
                                    <div className={`text-xs ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                      {diff > 0 ? `−${diff.toFixed(0)}%` : `+${Math.abs(diff).toFixed(0)}%`}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => handleSave(svc)} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                                <Save className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => handleStartEdit(svc)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {provs.length === 0 && (services?.length || 0) > 0 && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span><strong>No insurance providers configured.</strong> Go to Billing → Insurance → Providers to add insurance providers, then return here to set their prices.</span>
            </div>
          )}
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="w-1/3 border-l bg-white overflow-auto">
            <div className="p-4 border-b sticky top-0 bg-white">
              <h3 className="font-semibold text-gray-900">Price History</h3>
              <p className="text-sm text-gray-500">Changes made this session</p>
            </div>
            <div className="p-4 space-y-3">
              {localHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">No price changes yet</div>
              ) : localHistory.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{item.service}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{item.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{item.field}:</span>
                    <span className="text-red-500 line-through">{formatCurrency(item.oldVal)}</span>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                    <span className="text-green-600">{formatCurrency(item.newVal)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
