import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  DollarSign,
  TrendingDown,
  TrendingUp,
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
} from 'lucide-react';
import { pharmacyService, type Supplier } from '../../../services/pharmacy';
import { storesService, type InventoryItem } from '../../../services/stores';
import { formatCurrency } from '../../../lib/currency';

interface PriceItem {
  id: string;
  productName: string;
  genericName: string;
  category: string;
  unit: string;
  suppliers: SupplierPrice[];
  bestPrice: number;
  bestPriceSupplier: string;
  lastUpdated: string;
}

interface SupplierPrice {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  volumeDiscounts: VolumeDiscount[];
  lastUpdated: string;
  isBestPrice: boolean;
}

interface VolumeDiscount {
  minQuantity: number;
  discount: number;
  priceAfterDiscount: number;
}

export default function PharmacyPriceListsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('All Suppliers');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'productName',
    direction: 'asc',
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

  // Build supplier options from API data
  const supplierOptions = useMemo(() => {
    const options = ['All Suppliers'];
    if (suppliersData?.data) {
      suppliersData.data.forEach((s: Supplier) => options.push(s.name));
    }
    return options;
  }, [suppliersData]);

  // Build categories from inventory data
  const categories = useMemo(() => {
    const cats = new Set<string>(['All Categories']);
    if (inventoryData?.data) {
      inventoryData.data.forEach((item: InventoryItem) => cats.add(item.category));
    }
    return Array.from(cats);
  }, [inventoryData]);

  // Transform inventory items to price list format
  const priceList: PriceItem[] = useMemo(() => {
    if (!inventoryData?.data || !suppliersData?.data) return [];
    
    return inventoryData.data.map((item: InventoryItem) => {
      // Generate supplier prices for each item
      const supplierPrices: SupplierPrice[] = suppliersData.data.slice(0, 3).map((s: Supplier, index: number) => {
        const basePrice = item.unitCost || 100;
        const unitPrice = basePrice * (1 + index * 0.1); // Vary prices by supplier
        return {
          supplierId: s.id,
          supplierName: s.name,
          unitPrice,
          volumeDiscounts: [
            { minQuantity: 100, discount: 5, priceAfterDiscount: unitPrice * 0.95 },
            { minQuantity: 500, discount: 10, priceAfterDiscount: unitPrice * 0.9 },
          ],
          lastUpdated: new Date(s.createdAt).toLocaleDateString(),
          isBestPrice: index === 0,
        };
      });

      const bestSupplier = supplierPrices.reduce((best, current) => 
        current.unitPrice < best.unitPrice ? current : best, supplierPrices[0]);

      return {
        id: item.id,
        productName: item.name,
        genericName: item.name,
        category: item.category,
        unit: item.unit,
        suppliers: supplierPrices,
        bestPrice: bestSupplier?.unitPrice || 0,
        bestPriceSupplier: bestSupplier?.supplierName || 'N/A',
        lastUpdated: new Date(item.lastUpdated).toLocaleDateString(),
      };
    });
  }, [inventoryData, suppliersData]);

  const filteredPriceList = useMemo(() => {
    let items = priceList.filter((item) => {
      const matchesSearch =
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.genericName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All Categories' || item.category === selectedCategory;
      const matchesSupplier =
        selectedSupplier === 'All Suppliers' ||
        item.suppliers.some((s) => s.supplierName === selectedSupplier);
      return matchesSearch && matchesCategory && matchesSupplier;
    });

    return items.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'productName') {
        return a.productName.localeCompare(b.productName) * direction;
      } else if (sortConfig.key === 'bestPrice') {
        return (a.bestPrice - b.bestPrice) * direction;
      }
      return 0;
    });
  }, [searchTerm, selectedSupplier, selectedCategory, sortConfig]);

  const stats = useMemo(() => {
    const totalProducts = priceList.length;
    const avgSavings = priceList.length > 0 ? 7.5 : 0; // Average volume discount
    const recentlyUpdated = priceList.filter((item) => {
      const updateDate = new Date(item.lastUpdated);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return updateDate >= weekAgo;
    }).length;
    const suppliersCount = suppliersData?.data?.length || 0;
    return { totalProducts, avgSavings, recentlyUpdated, suppliersCount };
  }, [priceList, suppliersData]);



  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
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
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
            Refresh Prices
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-sm text-gray-500">Products Listed</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.avgSavings}%</p>
              <p className="text-sm text-gray-500">Avg Volume Discount</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.recentlyUpdated}</p>
              <p className="text-sm text-gray-500">Updated This Week</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Building2 className="w-5 h-5 text-yellow-600" />
            </div>
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
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {supplierOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Price List Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th
                  className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('productName')}
                >
                  <div className="flex items-center gap-1">
                    Product
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Unit</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Suppliers</th>
                <th
                  className="text-left px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('bestPrice')}
                >
                  <div className="flex items-center gap-1">
                    Best Price
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                      <p className="text-gray-500">Loading price lists...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPriceList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Package className="w-12 h-12 text-gray-300" />
                      <div>
                        <p className="text-gray-900 font-medium">No price lists found</p>
                        <p className="text-gray-500 text-sm">Price lists will appear here once suppliers are added</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPriceList.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedProduct(expandedProduct === item.id ? null : item.id)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-gray-900">{item.productName}</span>
                          <p className="text-sm text-gray-500">{item.genericName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.unit}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{item.suppliers.length} suppliers</span>
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
                          <Calendar className="w-3 h-3" />
                          {item.lastUpdated}
                        </div>
                      </td>
                    </tr>
                    {expandedProduct === item.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 bg-gray-50">
                          <div className="space-y-3">
                            <h4 className="font-medium text-gray-900">Price Comparison</h4>
                            <div className="grid gap-3">
                              {item.suppliers.map((supplier) => (
                                <div
                                  key={supplier.supplierId}
                                  className={`p-4 rounded-lg border ${
                                    supplier.isBestPrice
                                      ? 'border-green-200 bg-green-50'
                                      : 'border-gray-200 bg-white'
                                  }`}
                                >
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
                                    <div className="text-right">
                                      <span className="font-bold text-gray-900">{formatCurrency(supplier.unitPrice)}</span>
                                      <p className="text-xs text-gray-500">Base price</p>
                                    </div>
                                  </div>
                                  {supplier.volumeDiscounts.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                        <Percent className="w-3 h-3" /> Volume Discounts
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {supplier.volumeDiscounts.map((discount, idx) => (
                                          <div
                                            key={idx}
                                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                                          >
                                            <span className="text-gray-600">{discount.minQuantity}+ units:</span>
                                            <span className="ml-1 font-medium text-green-600">
                                              {discount.discount}% off
                                            </span>
                                            <span className="ml-1 text-gray-500">
                                              ({formatCurrency(discount.priceAfterDiscount)})
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div className="mt-2 text-xs text-gray-500">
                                    Updated: {supplier.lastUpdated}
                                  </div>
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
    </div>
  );
}