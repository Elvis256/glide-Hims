import { useState, useMemo, useRef, useCallback } from 'react';
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
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { servicesService, type Service, labService } from '../../../services';
import { formatCurrency, CURRENCY_SYMBOL } from '../../../lib/currency';
import {
  getInsurancePriceLists, createInsurancePriceList, updateInsurancePriceList,
  bulkCreateInsurancePriceLists,
  type InsurancePriceList,
} from '../../../services/pricing';
import { insuranceService, type InsuranceProvider } from '../../../services/insurance';

interface ImportRow {
  type: 'service' | 'lab';
  code: string;
  name: string;
  category: string;
  cashPrice: number;
  currentInsPrice: number;
  newInsPrice: number;
  matchedId?: string;
  existingPriceListId?: string;
  status: 'new' | 'update' | 'unmatched' | 'skipped';
}

export default function PricingManagementPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCash, setEditCash] = useState(0);
  const [editInsurance, setEditInsurance] = useState<Record<string, string>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [localHistory, setLocalHistory] = useState<Array<{ date: string; service: string; field: string; oldVal: number; newVal: number }>>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProviderId, setImportProviderId] = useState('');
  const [importPreview, setImportPreview] = useState<ImportRow[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'previewing' | 'uploading' | 'done' | 'error'>('idle');
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState({ created: 0, updated: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: labTests } = useQuery({
    queryKey: ['labTests-pricing'],
    queryFn: () => labService.tests.list(),
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

  // ---- Insurance Excel Import/Export ----

  const resetImportModal = () => {
    setShowImportModal(false);
    setImportProviderId('');
    setImportPreview([]);
    setImportStatus('idle');
    setImportError('');
    setImportResult({ created: 0, updated: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = useCallback((providerId: string) => {
    const provider = provs.find(p => p.id === providerId);
    if (!provider) return;

    const providerPrices = priceListData.filter(
      (p: InsurancePriceList) => p.insuranceProviderId === providerId
    );

    const headerRow = ['Type', 'Code', 'Name', 'Category', 'Cash Price (Reference)', `Insurance Price (${provider.name})`, '', 'Item ID (DO NOT EDIT)'];
    const rows: any[][] = [headerRow];

    (services || []).forEach(svc => {
      const existing = providerPrices.find((p: InsurancePriceList) => p.serviceId === svc.id);
      rows.push([
        'Service', svc.code, svc.name, svc.category?.name || '',
        svc.basePrice || 0,
        existing ? Number(existing.agreedPrice) : '',
        '', svc.id,
      ]);
    });

    const labTestsList = Array.isArray(labTests) ? labTests : (labTests as any)?.data || [];
    labTestsList.forEach((test: any) => {
      const existing = providerPrices.find((p: InsurancePriceList) => p.labTestId === test.id);
      rows.push([
        'Lab Test', test.code, test.name, test.category || '',
        test.price || 0,
        existing ? Number(existing.agreedPrice) : '',
        '', test.id,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 10 }, { wch: 16 }, { wch: 38 }, { wch: 20 },
      { wch: 18 }, { wch: 24 }, { wch: 2 }, { wch: 40 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Price List');
    XLSX.writeFile(wb, `Insurance_Prices_${provider.name.replace(/\s+/g, '_')}_Template.xlsx`);
  }, [provs, priceListData, services, labTests]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!importProviderId) return;
    setImportStatus('parsing');
    setImportError('');

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const dataRows = rows.slice(1); // skip header

      const providerPrices = priceListData.filter(
        (p: InsurancePriceList) => p.insuranceProviderId === importProviderId
      );
      const labTestsList = Array.isArray(labTests) ? labTests : (labTests as any)?.data || [];
      const preview: ImportRow[] = [];

      for (const row of dataRows) {
        const [type, code, name, category, cashPrice, insPrice, , itemId] = row;
        if (insPrice === '' || insPrice === undefined || insPrice === null) continue;

        const price = Number(insPrice);
        if (isNaN(price) || price <= 0) continue;

        let matchedId: string | undefined;
        let existingPriceListId: string | undefined;
        let currentInsPrice = 0;

        if (String(type).trim() === 'Service') {
          const svc = itemId
            ? (services || []).find(s => s.id === String(itemId).trim())
            : (services || []).find(s => s.code === String(code).trim());
          if (svc) {
            matchedId = svc.id;
            const existing = providerPrices.find((p: InsurancePriceList) => p.serviceId === svc.id);
            if (existing) {
              existingPriceListId = existing.id;
              currentInsPrice = Number(existing.agreedPrice);
            }
          }
        } else if (String(type).trim() === 'Lab Test') {
          const test = itemId
            ? labTestsList.find((t: any) => t.id === String(itemId).trim())
            : labTestsList.find((t: any) => t.code === String(code).trim());
          if (test) {
            matchedId = test.id;
            const existing = providerPrices.find((p: InsurancePriceList) => p.labTestId === test.id);
            if (existing) {
              existingPriceListId = existing.id;
              currentInsPrice = Number(existing.agreedPrice);
            }
          }
        }

        // Skip rows where price hasn't changed
        if (existingPriceListId && currentInsPrice === price) continue;

        preview.push({
          type: String(type).trim() === 'Lab Test' ? 'lab' : 'service',
          code: String(code || ''),
          name: String(name || ''),
          category: String(category || ''),
          cashPrice: Number(cashPrice) || 0,
          currentInsPrice,
          newInsPrice: price,
          matchedId,
          existingPriceListId,
          status: matchedId ? (existingPriceListId ? 'update' : 'new') : 'unmatched',
        });
      }

      if (preview.length === 0) {
        setImportError('No price changes found in the uploaded file. Fill in the "Insurance Price" column and re-upload.');
        setImportStatus('idle');
        return;
      }

      setImportPreview(preview);
      setImportStatus('previewing');
    } catch (err: any) {
      setImportError(`Failed to parse file: ${err.message || 'Unknown error'}`);
      setImportStatus('idle');
    }
  }, [importProviderId, priceListData, services, labTests]);

  const handleSubmitImport = useCallback(async () => {
    if (!importProviderId) return;
    setImportStatus('uploading');
    setImportError('');

    const matched = importPreview.filter(r => r.status === 'new' || r.status === 'update');
    const toCreate = matched.filter(r => r.status === 'new');
    const toUpdate = matched.filter(r => r.status === 'update');

    try {
      if (toCreate.length > 0) {
        await bulkCreateInsurancePriceLists({
          insuranceProviderId: importProviderId,
          items: toCreate.map(r => ({
            ...(r.type === 'service' ? { serviceId: r.matchedId } : { labTestId: r.matchedId }),
            agreedPrice: r.newInsPrice,
          })),
        });
      }

      for (const row of toUpdate) {
        await updateInsurancePriceList(row.existingPriceListId!, { agreedPrice: row.newInsPrice });
      }

      queryClient.invalidateQueries({ queryKey: ['insurancePriceLists'] });
      setImportResult({ created: toCreate.length, updated: toUpdate.length });
      setImportStatus('done');
    } catch (err: any) {
      setImportError(`Import failed: ${err?.response?.data?.message || err.message || 'Unknown error'}`);
      setImportStatus('error');
    }
  }, [importProviderId, importPreview, queryClient]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pricing Management</h1>
            <p className="text-sm text-gray-500">Configure cash and insurance prices for all services</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              disabled={provs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />Import Excel
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm ${
                showHistory ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <History className="w-4 h-4" />Price History
            </button>
          </div>
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Import Insurance Prices</h2>
                  <p className="text-sm text-gray-500">Upload Excel file with insurance prices</p>
                </div>
              </div>
              <button onClick={resetImportModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              {/* Step 1: Select Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Insurance Provider</label>
                <select
                  value={importProviderId}
                  onChange={e => { setImportProviderId(e.target.value); setImportPreview([]); setImportStatus('idle'); setImportError(''); }}
                  disabled={importStatus === 'uploading'}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select an insurance provider...</option>
                  {provs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {importProviderId && importStatus !== 'done' && (
                <>
                  {/* Step 2: Download Template */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Download className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Step 1: Download the template</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Download the Excel template pre-populated with all services and lab tests.
                          Fill in the &quot;Insurance Price&quot; column and leave rows blank to skip them.
                        </p>
                        <button
                          onClick={() => handleDownloadTemplate(importProviderId)}
                          className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          <Download className="w-3.5 h-3.5" />Download Template
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Upload File */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Upload className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Step 2: Upload filled template</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Upload the filled Excel file. Only rows with an insurance price will be imported.
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          disabled={importStatus === 'uploading'}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file);
                          }}
                          className="mt-2 block text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {importStatus === 'parsing' && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-green-600 mr-2" />
                  <span className="text-sm text-gray-600">Parsing file...</span>
                </div>
              )}

              {importError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-700">{importError}</span>
                </div>
              )}

              {/* Preview Table */}
              {importStatus === 'previewing' && importPreview.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Preview ({importPreview.length} items)</h3>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />{importPreview.filter(r => r.status === 'new').length} new
                      </span>
                      <span className="flex items-center gap-1 text-blue-700">
                        <Edit2 className="w-3.5 h-3.5" />{importPreview.filter(r => r.status === 'update').length} updates
                      </span>
                      {importPreview.some(r => r.status === 'unmatched') && (
                        <span className="flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="w-3.5 h-3.5" />{importPreview.filter(r => r.status === 'unmatched').length} unmatched
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Status</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Type</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Code</th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Name</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Current</th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">New Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {importPreview.map((row, idx) => (
                          <tr key={idx} className={row.status === 'unmatched' ? 'bg-amber-50' : ''}>
                            <td className="px-3 py-2">
                              {row.status === 'new' && <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-1.5 py-0.5 rounded"><CheckCircle2 className="w-3 h-3" />New</span>}
                              {row.status === 'update' && <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded"><Edit2 className="w-3 h-3" />Update</span>}
                              {row.status === 'unmatched' && <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded"><XCircle className="w-3 h-3" />No match</span>}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">{row.type === 'lab' ? 'Lab' : 'Svc'}</td>
                            <td className="px-3 py-2 text-xs font-mono">{row.code}</td>
                            <td className="px-3 py-2 text-sm truncate max-w-48">{row.name}</td>
                            <td className="px-3 py-2 text-right text-xs text-gray-500">
                              {row.currentInsPrice > 0 ? formatCurrency(row.currentInsPrice) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-green-700">{formatCurrency(row.newInsPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importPreview.some(r => r.status === 'unmatched') && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Unmatched rows will be skipped. Ensure item codes or IDs match the system records.
                    </p>
                  )}
                </div>
              )}

              {importStatus === 'uploading' && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-green-600 mr-2" />
                  <span className="text-sm text-gray-600">Importing prices...</span>
                </div>
              )}

              {/* Done */}
              {importStatus === 'done' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-green-900 mb-1">Import Complete!</h3>
                  <p className="text-sm text-green-700">
                    {importResult.created > 0 && <>{importResult.created} new price{importResult.created > 1 ? 's' : ''} created</>}
                    {importResult.created > 0 && importResult.updated > 0 && ', '}
                    {importResult.updated > 0 && <>{importResult.updated} price{importResult.updated > 1 ? 's' : ''} updated</>}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              {importStatus === 'done' || importStatus === 'error' ? (
                <button onClick={resetImportModal} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800">
                  Close
                </button>
              ) : (
                <>
                  <button onClick={resetImportModal} className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                    Cancel
                  </button>
                  {importStatus === 'previewing' && (
                    <button
                      onClick={handleSubmitImport}
                      disabled={importPreview.filter(r => r.status === 'new' || r.status === 'update').length === 0}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Import {importPreview.filter(r => r.status === 'new' || r.status === 'update').length} Price{importPreview.filter(r => r.status === 'new' || r.status === 'update').length !== 1 ? 's' : ''}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
