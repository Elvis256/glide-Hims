import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  DollarSign,
  TrendingDown,
  Calendar,
  Package,
  Building2,
  Check,
  ArrowUpDown,
  Filter,
  Download,
  RefreshCw,
  Award,
  Percent,
  Loader2,
  Plus,
  X,
  Save,
  Edit2,
  Trash2,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { pharmacyService, type Supplier } from '../../../services/pharmacy';
import { storesService, type InventoryItem } from '../../../services/stores';
import { formatCurrency } from '../../../lib/currency';

const STORAGE_KEY = 'glide_price_list_entries';

interface PriceEntry {
  id: string;
  productName: string;
  category: string;
  unit: string;
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  minQtyDiscount1: number;
  discount1Pct: number;
  minQtyDiscount2: number;
  discount2Pct: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface PriceItem {
  id: string;
  productName: string;
  category: string;
  unit: string;
  suppliers: SupplierPrice[];
  bestPrice: number;
  bestPriceSupplier: string;
  lastUpdated: string;
  source: 'manual' | 'inventory';
}

interface SupplierPrice {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  volumeDiscounts: VolumeDiscount[];
  lastUpdated: string;
  isBestPrice: boolean;
  entryId?: string;
}

interface VolumeDiscount {
  minQuantity: number;
  discount: number;
  priceAfterDiscount: number;
}

const CATEGORIES = ['Pharmaceuticals', 'Medical Supplies', 'Equipment', 'Consumables', 'Laboratory', 'Surgical', 'General'];
const UNITS = ['Tablet', 'Capsule', 'Bottle', 'Vial', 'Ampoule', 'Box', 'Pack', 'Piece', 'Kit', 'Roll', 'Pair', 'Litre', 'ml', 'kg', 'g'];

function loadEntries(): PriceEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveEntries(entries: PriceEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export default function PharmacyPriceListsPage() {
  const { hasPermission } = usePermissions();
  if (!hasPermission('pharmacy.suppliers')) return <AccessDenied />;

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('All Suppliers');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'productName', direction: 'asc' });
  const [entries, setEntries] = useState<PriceEntry[]>(loadEntries);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PriceEntry | null>(null);
  const [form, setForm] = useState({
    productName: '', category: 'Pharmaceuticals', unit: 'Tablet',
    supplierId: '', unitPrice: '', minQtyDiscount1: '100', discount1Pct: '5',
    minQtyDiscount2: '500', discount2Pct: '10', notes: '',
  });

  const { data: suppliersData, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['pharmacy', 'suppliers'],
    queryFn: () => pharmacyService.suppliers.list(),
  });

  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['stores', 'inventory'],
    queryFn: () => storesService.inventory.list(),
  });

  const isLoading = isLoadingSuppliers || isLoadingInventory;
  const suppliers: Supplier[] = suppliersData?.data || [];

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    suppliers.forEach((s) => names.add(s.name));
    entries.forEach((e) => names.add(e.supplierName));
    return ['All Suppliers', ...Array.from(names)];
  }, [suppliers, entries]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    entries.forEach((e) => cats.add(e.category));
    if (inventoryData?.data) {
      inventoryData.data.forEach((item: InventoryItem) => cats.add(item.category));
    }
    return ['All Categories', ...Array.from(cats)];
  }, [entries, inventoryData]);

  // Build unified price list from manual entries + inventory items
  const priceList: PriceItem[] = useMemo(() => {
    const productMap = new Map<string, PriceItem>();

    // 1. Manual entries grouped by product name
    entries.forEach((entry) => {
      const key = entry.productName.toLowerCase().trim();
      const price = entry.unitPrice;
      const supplierPrice: SupplierPrice = {
        supplierId: entry.supplierId,
        supplierName: entry.supplierName,
        unitPrice: price,
        volumeDiscounts: [],
        lastUpdated: new Date(entry.updatedAt).toLocaleDateString(),
        isBestPrice: false,
        entryId: entry.id,
      };
      if (entry.minQtyDiscount1 > 0 && entry.discount1Pct > 0) {
        supplierPrice.volumeDiscounts.push({
          minQuantity: entry.minQtyDiscount1,
          discount: entry.discount1Pct,
          priceAfterDiscount: price * (1 - entry.discount1Pct / 100),
        });
      }
      if (entry.minQtyDiscount2 > 0 && entry.discount2Pct > 0) {
        supplierPrice.volumeDiscounts.push({
          minQuantity: entry.minQtyDiscount2,
          discount: entry.discount2Pct,
          priceAfterDiscount: price * (1 - entry.discount2Pct / 100),
        });
      }

      if (productMap.has(key)) {
        productMap.get(key)!.suppliers.push(supplierPrice);
      } else {
        productMap.set(key, {
          id: `manual-${key}`,
          productName: entry.productName,
          category: entry.category,
          unit: entry.unit,
          suppliers: [supplierPrice],
          bestPrice: 0,
          bestPriceSupplier: '',
          lastUpdated: new Date(entry.updatedAt).toLocaleDateString(),
          source: 'manual',
        });
      }
    });

    // 2. Inventory items (if any exist)
    if (inventoryData?.data && suppliers.length > 0) {
      inventoryData.data.forEach((item: InventoryItem) => {
        const key = item.name.toLowerCase().trim();
        if (productMap.has(key)) return; // Manual entries take priority
        const basePrice = item.unitCost || 0;
        const supplierPrices: SupplierPrice[] = suppliers.map((s) => ({
          supplierId: s.id,
          supplierName: s.name,
          unitPrice: basePrice,
          volumeDiscounts: basePrice > 0 ? [
            { minQuantity: 100, discount: 5, priceAfterDiscount: basePrice * 0.95 },
            { minQuantity: 500, discount: 10, priceAfterDiscount: basePrice * 0.90 },
          ] : [],
          lastUpdated: new Date(s.createdAt).toLocaleDateString(),
          isBestPrice: false,
        }));
        productMap.set(key, {
          id: item.id,
          productName: item.name,
          category: item.category,
          unit: item.unit,
          suppliers: supplierPrices,
          bestPrice: 0,
          bestPriceSupplier: '',
          lastUpdated: new Date(item.lastUpdated || item.createdAt || Date.now()).toLocaleDateString(),
          source: 'inventory',
        });
      });
    }

    // Calculate best price per product
    productMap.forEach((product) => {
      if (product.suppliers.length > 0) {
        const best = product.suppliers.reduce((b, c) => (c.unitPrice > 0 && (b.unitPrice === 0 || c.unitPrice < b.unitPrice)) ? c : b, product.suppliers[0]);
        best.isBestPrice = true;
        product.bestPrice = best.unitPrice;
        product.bestPriceSupplier = best.supplierName;
      }
    });

    return Array.from(productMap.values());
  }, [entries, inventoryData, suppliers]);

  const filteredPriceList = useMemo(() => {
    let items = priceList.filter((item) => {
      const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
      const matchesSupplier = selectedSupplier === 'All Suppliers' || item.suppliers.some((s) => s.supplierName === selectedSupplier);
      return matchesSearch && matchesCategory && matchesSupplier;
    });
    return items.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'productName') return a.productName.localeCompare(b.productName) * dir;
      if (sortConfig.key === 'bestPrice') return (a.bestPrice - b.bestPrice) * dir;
      return 0;
    });
  }, [priceList, searchTerm, selectedSupplier, selectedCategory, sortConfig]);

  const stats = useMemo(() => {
    const totalProducts = priceList.length;
    const allDiscounts = entries.filter((e) => e.discount1Pct > 0);
    const avgDiscount = allDiscounts.length > 0
      ? allDiscounts.reduce((s, e) => s + e.discount1Pct, 0) / allDiscounts.length
      : 0;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const recentlyUpdated = entries.filter((e) => new Date(e.updatedAt) >= weekAgo).length;
    const suppliersCount = new Set([...suppliers.map((s) => s.id), ...entries.map((e) => e.supplierId)]).size;
    return { totalProducts, avgDiscount, recentlyUpdated, suppliersCount };
  }, [priceList, entries, suppliers]);

  const openAddModal = () => {
    setEditingEntry(null);
    setForm({
      productName: '', category: 'Pharmaceuticals', unit: 'Tablet',
      supplierId: suppliers[0]?.id || '', unitPrice: '', minQtyDiscount1: '100',
      discount1Pct: '5', minQtyDiscount2: '500', discount2Pct: '10', notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (entry: PriceEntry) => {
    setEditingEntry(entry);
    setForm({
      productName: entry.productName, category: entry.category, unit: entry.unit,
      supplierId: entry.supplierId, unitPrice: String(entry.unitPrice),
      minQtyDiscount1: String(entry.minQtyDiscount1), discount1Pct: String(entry.discount1Pct),
      minQtyDiscount2: String(entry.minQtyDiscount2), discount2Pct: String(entry.discount2Pct),
      notes: entry.notes,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.productName.trim()) { toast.error('Product name is required'); return; }
    if (!form.unitPrice || parseFloat(form.unitPrice) <= 0) { toast.error('Enter a valid unit price'); return; }
    if (!form.supplierId) { toast.error('Select a supplier'); return; }

    const supplier = suppliers.find((s) => s.id === form.supplierId);
    const now = new Date().toISOString();

    if (editingEntry) {
      const updated = entries.map((e) => e.id === editingEntry.id ? {
        ...e,
        productName: form.productName.trim(),
        category: form.category,
        unit: form.unit,
        supplierId: form.supplierId,
        supplierName: supplier?.name || editingEntry.supplierName,
        unitPrice: parseFloat(form.unitPrice),
        minQtyDiscount1: parseInt(form.minQtyDiscount1) || 0,
        discount1Pct: parseFloat(form.discount1Pct) || 0,
        minQtyDiscount2: parseInt(form.minQtyDiscount2) || 0,
        discount2Pct: parseFloat(form.discount2Pct) || 0,
        notes: form.notes,
        updatedAt: now,
      } : e);
      setEntries(updated);
      saveEntries(updated);
      toast.success('Price entry updated');
    } else {
      const newEntry: PriceEntry = {
        id: crypto.randomUUID(),
        productName: form.productName.trim(),
        category: form.category,
        unit: form.unit,
        supplierId: form.supplierId,
        supplierName: supplier?.name || 'Unknown',
        unitPrice: parseFloat(form.unitPrice),
        minQtyDiscount1: parseInt(form.minQtyDiscount1) || 0,
        discount1Pct: parseFloat(form.discount1Pct) || 0,
        minQtyDiscount2: parseInt(form.minQtyDiscount2) || 0,
        discount2Pct: parseFloat(form.discount2Pct) || 0,
        notes: form.notes,
        createdAt: now,
        updatedAt: now,
      };
      const updated = [...entries, newEntry];
      setEntries(updated);
      saveEntries(updated);
      toast.success('Price entry added');
    }
    setShowModal(false);
  };

  const handleDelete = (entryId: string) => {
    const updated = entries.filter((e) => e.id !== entryId);
    setEntries(updated);
    saveEntries(updated);
    toast.success('Price entry deleted');
  };

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pharmacy', 'suppliers'] });
    queryClient.invalidateQueries({ queryKey: ['stores', 'inventory'] });
    toast.success('Prices refreshed');
  }, [queryClient]);

  const handleExport = useCallback(() => {
    if (filteredPriceList.length === 0) { toast.info('No data to export'); return; }
    const header = 'Product,Category,Unit,Supplier,Unit Price,Discount 1,Discount 2,Best Price,Best Supplier';
    const rows: string[] = [];
    filteredPriceList.forEach((item) => {
      item.suppliers.forEach((sp) => {
        rows.push([
          `"${item.productName}"`, item.category, item.unit, `"${sp.supplierName}"`,
          sp.unitPrice.toFixed(2),
          sp.volumeDiscounts[0] ? `${sp.volumeDiscounts[0].discount}%` : '',
          sp.volumeDiscounts[1] ? `${sp.volumeDiscounts[1].discount}%` : '',
          item.bestPrice.toFixed(2), `"${item.bestPriceSupplier}"`,
        ].join(','));
      });
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `price-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} price entries`);
  }, [filteredPriceList]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Lists</h1>
          <p className="text-gray-500">Compare prices across suppliers and find best deals</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Price
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-sm text-gray-500">Products Listed</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><TrendingDown className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.avgDiscount > 0 ? stats.avgDiscount.toFixed(0) : 0}%</p>
              <p className="text-sm text-gray-500">Avg Volume Discount</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Calendar className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.recentlyUpdated}</p>
              <p className="text-sm text-gray-500">Updated This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Building2 className="w-5 h-5 text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.suppliersCount}</p>
              <p className="text-sm text-gray-500">Active Suppliers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search products..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            {supplierOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Price List Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('productName')}>
                  <div className="flex items-center gap-1">Product <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unit</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Suppliers</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('bestPrice')}>
                  <div className="flex items-center gap-1">Best Price <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-3" />
                    <p className="text-gray-500">Loading price lists...</p>
                  </td>
                </tr>
              ) : filteredPriceList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <DollarSign className="w-12 h-12 text-gray-300" />
                      <div>
                        <p className="text-gray-900 font-medium">No price lists yet</p>
                        <p className="text-gray-500 text-sm mb-3">Add supplier pricing to compare deals across suppliers</p>
                        <button onClick={openAddModal}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                          <Plus className="w-4 h-4" /> Add First Price Entry
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPriceList.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedProduct(expandedProduct === item.id ? null : item.id)}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{item.productName}</span>
                        {item.source === 'inventory' && (
                          <span className="ml-2 text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">Inventory</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">{item.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{item.suppliers.length} supplier{item.suppliers.length !== 1 ? 's' : ''}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-green-600">{formatCurrency(item.bestPrice)}</span>
                        </div>
                        <p className="text-xs text-gray-500">{item.bestPriceSupplier}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-3 h-3" /> {item.lastUpdated}
                        </div>
                      </td>
                    </tr>
                    {expandedProduct === item.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-gray-900">Price Comparison</h4>
                              <button onClick={(e) => { e.stopPropagation(); setForm((f) => ({ ...f, productName: item.productName, category: item.category, unit: item.unit })); openAddModal(); }}
                                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Add Supplier Price
                              </button>
                            </div>
                            <div className="grid gap-3">
                              {item.suppliers.map((supplier) => (
                                <div key={supplier.supplierId + (supplier.entryId || '')}
                                  className={`p-4 rounded-lg border ${supplier.isBestPrice ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Building2 className="w-4 h-4 text-gray-400" />
                                      <span className="font-medium text-gray-900">{supplier.supplierName}</span>
                                      {supplier.isBestPrice && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                          <Check className="w-3 h-3" /> Best Price
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <span className="font-bold text-gray-900">{formatCurrency(supplier.unitPrice)}</span>
                                        <p className="text-xs text-gray-500">per {item.unit}</p>
                                      </div>
                                      {supplier.entryId && (
                                        <div className="flex items-center gap-1">
                                          <button onClick={(e) => { e.stopPropagation(); const entry = entries.find((en) => en.id === supplier.entryId); if (entry) openEditModal(entry); }}
                                            className="p-1 hover:bg-gray-100 rounded" title="Edit">
                                            <Edit2 className="w-3 h-3 text-gray-400" />
                                          </button>
                                          <button onClick={(e) => { e.stopPropagation(); handleDelete(supplier.entryId!); }}
                                            className="p-1 hover:bg-red-100 rounded" title="Delete">
                                            <Trash2 className="w-3 h-3 text-red-400" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {supplier.volumeDiscounts.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                        <Percent className="w-3 h-3" /> Volume Discounts
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {supplier.volumeDiscounts.map((discount, idx) => (
                                          <div key={idx} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
                                            <span className="text-gray-600">{discount.minQuantity}+ units:</span>
                                            <span className="ml-1 font-medium text-green-600">{discount.discount}% off</span>
                                            <span className="ml-1 text-gray-500">({formatCurrency(discount.priceAfterDiscount)})</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="mt-2 text-xs text-gray-500">Updated: {supplier.lastUpdated}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Price Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingEntry ? 'Edit Price Entry' : 'Add Price Entry'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input type="text" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })}
                  placeholder="e.g. Paracetamol 500mg"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                {suppliers.length > 0 ? (
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select supplier...</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-red-500">No suppliers found. <a href="/pharmacy/suppliers" className="underline">Add a supplier first</a>.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (UGX) *</label>
                <input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  placeholder="0.00" min="0" step="100"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1"><Percent className="w-3 h-3" /> Volume Discounts (optional)</p>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min Qty (Tier 1)</label>
                    <input type="number" value={form.minQtyDiscount1} onChange={(e) => setForm({ ...form, minQtyDiscount1: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Discount %</label>
                    <input type="number" value={form.discount1Pct} onChange={(e) => setForm({ ...form, discount1Pct: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" min="0" max="100" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Min Qty (Tier 2)</label>
                    <input type="number" value={form.minQtyDiscount2} onChange={(e) => setForm({ ...form, minQtyDiscount2: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Discount %</label>
                    <input type="number" value={form.discount2Pct} onChange={(e) => setForm({ ...form, discount2Pct: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm" min="0" max="100" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Special terms, delivery conditions..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Save className="w-4 h-4" /> {editingEntry ? 'Update' : 'Add Price'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}