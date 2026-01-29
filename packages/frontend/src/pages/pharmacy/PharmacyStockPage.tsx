import React, { useState, useMemo } from 'react';
import {
  Search,
  Package,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  DollarSign,
  Filter,
  Calendar,
  Pill,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

type Category = 'All' | 'Antibiotics' | 'Analgesics' | 'Cardiovascular' | 'Diabetes' | 'Respiratory';

interface StockItem {
  id: string;
  name: string;
  genericName: string;
  category: Category;
  currentStock: number;
  reorderLevel: number;
  maxStock: number;
  unitPrice: number;
  expiryDate: string;
  batchNumber: string;
  supplier: string;
  lastRestocked: string;
}

const mockStockData: StockItem[] = [];

const categories: Category[] = ['All', 'Antibiotics', 'Analgesics', 'Cardiovascular', 'Diabetes', 'Respiratory'];

export default function PharmacyStockPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiring, setShowExpiring] = useState(false);

  const filteredStock = useMemo(() => {
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    return mockStockData.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const isLowStock = item.currentStock <= item.reorderLevel;
      const isExpiring = new Date(item.expiryDate) <= thirtyDaysLater;
      
      if (showLowStock && !isLowStock) return false;
      if (showExpiring && !isExpiring) return false;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, showLowStock, showExpiring]);

  const stockStats = useMemo(() => {
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    return {
      totalItems: mockStockData.length,
      lowStock: mockStockData.filter((i) => i.currentStock <= i.reorderLevel).length,
      outOfStock: mockStockData.filter((i) => i.currentStock === 0).length,
      expiringSoon: mockStockData.filter((i) => new Date(i.expiryDate) <= thirtyDaysLater).length,
      totalValue: mockStockData.reduce((acc, i) => acc + i.currentStock * i.unitPrice, 0),
    };
  }, []);

  const getStockStatus = (item: StockItem) => {
    if (item.currentStock === 0) return 'out';
    if (item.currentStock <= item.reorderLevel) return 'low';
    if (item.currentStock <= item.reorderLevel * 1.5) return 'warning';
    return 'good';
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'out':
        return 'bg-red-100 text-red-800';
      case 'low':
        return 'bg-orange-100 text-orange-800';
      case 'warning':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const isExpiringSoon = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry <= thirtyDaysLater;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Stock</h1>
          <p className="text-gray-600">Monitor inventory levels and alerts</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <RefreshCw className="w-4 h-4" />
          Sync Stock
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">{stockStats.totalItems}</p>
            </div>
          </div>
        </div>
        <div
          className={`bg-white p-4 rounded-xl shadow-sm border cursor-pointer transition-colors ${
            showLowStock ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200'
          }`}
          onClick={() => setShowLowStock(!showLowStock)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-orange-600">{stockStats.lowStock}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{stockStats.outOfStock}</p>
            </div>
          </div>
        </div>
        <div
          className={`bg-white p-4 rounded-xl shadow-sm border cursor-pointer transition-colors ${
            showExpiring ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200'
          }`}
          onClick={() => setShowExpiring(!showExpiring)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-amber-600">{stockStats.expiringSoon}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Value</p>
              <p className="text-2xl font-bold text-green-600">
                KES {stockStats.totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search medications by name, generic name, or batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as Category)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Medication</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Stock Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reorder Point</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStock.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <Package className="w-12 h-12 mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No stock items found</p>
                      <p className="text-sm">Stock items will appear here when added</p>
                    </div>
                  </td>
                </tr>
              )}
              {filteredStock.map((item) => {
                const stockStatus = getStockStatus(item);
                const stockPercentage = Math.min((item.currentStock / item.maxStock) * 100, 100);

                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <Pill className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-500">{item.genericName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-32">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-medium ${getStockColor(stockStatus).replace('bg-', 'text-').replace('100', '700')}`}>
                            {item.currentStock}
                          </span>
                          <span className="text-xs text-gray-500">/ {item.maxStock}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              stockStatus === 'out'
                                ? 'bg-red-500'
                                : stockStatus === 'low'
                                ? 'bg-orange-500'
                                : stockStatus === 'warning'
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                            }`}
                            style={{ width: `${stockPercentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{item.reorderLevel}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">KES {item.unitPrice}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        KES {(item.currentStock * item.unitPrice).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span
                          className={`text-sm ${
                            isExpired(item.expiryDate)
                              ? 'text-red-600 font-medium'
                              : isExpiringSoon(item.expiryDate)
                              ? 'text-amber-600 font-medium'
                              : 'text-gray-700'
                          }`}
                        >
                          {item.expiryDate}
                        </span>
                        {isExpired(item.expiryDate) && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Expired</span>
                        )}
                        {!isExpired(item.expiryDate) && isExpiringSoon(item.expiryDate) && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Soon</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 font-mono">{item.batchNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}