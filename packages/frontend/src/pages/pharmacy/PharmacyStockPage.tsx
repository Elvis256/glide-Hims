import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  Loader2,
  Plus,
  Minus,
  History,
  ShoppingCart,
  X,
  Check,
} from 'lucide-react';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { storesService } from '../../services/stores';
import type { InventoryItem, StockAdjustmentDto } from '../../services/stores';
import { formatCurrency } from '../../lib/currency';

type Category = 'All' | 'Antibiotics' | 'Analgesics' | 'Cardiovascular' | 'Diabetes' | 'Respiratory' | 'Gastrointestinal' | 'Dermatology' | 'Vitamins' | 'Emergency' | string;

interface StockItem {
  id: string;
  name: string;
  genericName: string;
  category: Category;
  currentStock: number;
  reorderLevel: number;
  maxStock: number;
  unitPrice: number;
  expiryDate: string | null;
  batchNumber: string | null;
  isLowStock: boolean;
}

const categories: Category[] = [
  'All',
  'Antibiotics',
  'Analgesics',
  'Cardiovascular',
  'Diabetes',
  'Respiratory',
  'Gastrointestinal',
  'Dermatology',
  'Vitamins',
  'Emergency',
  'Uncategorized',
];

// Common fast-moving items for quick reorder
const fastMovingItems = [
  { name: 'Paracetamol 500mg', category: 'Analgesics', reorderQty: 1000 },
  { name: 'Amoxicillin 500mg', category: 'Antibiotics', reorderQty: 500 },
  { name: 'Metformin 500mg', category: 'Diabetes', reorderQty: 500 },
  { name: 'Omeprazole 20mg', category: 'Gastrointestinal', reorderQty: 300 },
  { name: 'Amlodipine 5mg', category: 'Cardiovascular', reorderQty: 200 },
  { name: 'Salbutamol Inhaler', category: 'Respiratory', reorderQty: 50 },
  { name: 'Diclofenac 50mg', category: 'Analgesics', reorderQty: 300 },
  { name: 'Ciprofloxacin 500mg', category: 'Antibiotics', reorderQty: 200 },
];

export default function PharmacyStockPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.inventory')) {
    return <AccessDenied />;
  }

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showExpiring, setShowExpiring] = useState(false);
  
  // Modal states
  const [adjustModal, setAdjustModal] = useState<{ item: StockItem; type: 'in' | 'out' } | null>(null);
  const [historyModal, setHistoryModal] = useState<StockItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBatch, setAdjustBatch] = useState('');
  const [adjustExpiry, setAdjustExpiry] = useState('');

  // Fetch inventory data
  const { data: inventoryData, isLoading, refetch } = useQuery({
    queryKey: ['pharmacy-stock', { category: selectedCategory !== 'All' ? selectedCategory : undefined, lowStock: showLowStock, search: searchTerm }],
    queryFn: () => storesService.inventory.list({
      category: selectedCategory !== 'All' ? selectedCategory : undefined,
      lowStock: showLowStock || undefined,
      search: searchTerm || undefined,
    }),
  });

  // Fetch stock movements for history modal
  const { data: movementsData } = useQuery({
    queryKey: ['stock-movements', historyModal?.id],
    queryFn: () => storesService.inventory.getMovements(historyModal!.id, 20),
    enabled: !!historyModal,
  });

  // Stock adjustment mutation
  const adjustMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: StockAdjustmentDto }) =>
      storesService.movements.adjust(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy-stock'] });
      setAdjustModal(null);
      setAdjustQuantity(1);
      setAdjustReason('');
      setAdjustBatch('');
      setAdjustExpiry('');
    },
  });

  // Transform inventory items to stock items
  const stockData: StockItem[] = useMemo(() => {
    if (!inventoryData?.data) return [];
    return inventoryData.data.map((item: InventoryItem) => ({
      id: item.id,
      name: item.name,
      genericName: item.genericName || item.name,
      category: (item.category || 'Uncategorized') as Category,
      currentStock: item.currentStock || 0,
      reorderLevel: item.minStock || 0,
      maxStock: item.maxStock || 100,
      unitPrice: item.sellingPrice || item.unitCost || 0,
      expiryDate: item.expiryDate || null,
      batchNumber: item.batchNumber || item.sku || null,
      isLowStock: item.isLowStock || false,
    }));
  }, [inventoryData]);

  // Use stats from API response
  const stockStats = useMemo(() => {
    if (inventoryData?.stats) {
      return {
        totalItems: inventoryData.stats.totalItems,
        lowStock: inventoryData.stats.lowStockCount,
        expiringSoon: inventoryData.stats.expiringCount,
        expired: inventoryData.stats.expiredCount,
        totalValue: inventoryData.stats.totalValue,
      };
    }
    // Fallback calculation
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return {
      totalItems: stockData.length,
      lowStock: stockData.filter((i) => i.isLowStock).length,
      expiringSoon: stockData.filter((i) => i.expiryDate && new Date(i.expiryDate) <= thirtyDaysLater && new Date(i.expiryDate) >= today).length,
      expired: stockData.filter((i) => i.expiryDate && new Date(i.expiryDate) < today).length,
      totalValue: stockData.reduce((acc, i) => acc + i.currentStock * i.unitPrice, 0),
    };
  }, [inventoryData, stockData]);

  const filteredStock = useMemo(() => {
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    return stockData.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.batchNumber && item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const isExpiring = item.expiryDate && new Date(item.expiryDate) <= thirtyDaysLater && new Date(item.expiryDate) >= today;
      
      if (showLowStock && !item.isLowStock) return false;
      if (showExpiring && !isExpiring) return false;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory, showLowStock, showExpiring, stockData]);

  const getStockStatus = (item: StockItem) => {
    if (item.currentStock === 0) return 'out';
    if (item.currentStock <= item.reorderLevel) return 'low';
    if (item.currentStock <= item.reorderLevel * 1.5) return 'warning';
    return 'good';
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'out': return 'bg-red-100 text-red-800';
      case 'low': return 'bg-orange-100 text-orange-800';
      case 'warning': return 'bg-amber-100 text-amber-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const isExpiringSoon = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return expiry <= thirtyDaysLater && expiry >= today;
  };

  const isExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const handleAdjust = () => {
    if (!adjustModal || adjustQuantity <= 0 || !adjustReason) return;
    adjustMutation.mutate({
      itemId: adjustModal.item.id,
      data: {
        quantity: adjustQuantity,
        type: adjustModal.type,
        reason: adjustReason,
        reference: adjustBatch || undefined,
      },
    });
  };

  const handleReorder = (item: StockItem) => {
    // Navigate to procurement with item pre-selected
    navigate(`/procurement/requisitions?item=${item.id}&name=${encodeURIComponent(item.name)}`);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Stock</h1>
          <p className="text-gray-600">Monitor inventory levels and alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/procurement/requisitions')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" />
            New Requisition
          </button>
          <button 
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Stock
          </button>
        </div>
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
              <p className="text-2xl font-bold text-blue-600">{stockStats.totalItems}</p>
            </div>
          </div>
        </div>
        <div 
          className={`bg-white p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${
            showLowStock ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-orange-300'
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
        <div 
          className={`bg-white p-4 rounded-xl shadow-sm border cursor-pointer transition-all ${
            showExpiring ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-200 hover:border-amber-300'
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
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expired</p>
              <p className="text-2xl font-bold text-red-600">{stockStats.expired}</p>
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
              <p className="text-xl font-bold text-green-600">{formatCurrency(stockStats.totalValue)}</p>
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
          {(showLowStock || showExpiring) && (
            <button
              onClick={() => { setShowLowStock(false); setShowExpiring(false); }}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <X className="w-4 h-4" />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Stock Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Medication</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Stock Level</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reorder</th>
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
                  const stockPercentage = item.maxStock > 0 ? Math.min((item.currentStock / item.maxStock) * 100, 100) : 0;

                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.isLowStock ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            stockStatus === 'out' ? 'bg-red-100' : stockStatus === 'low' ? 'bg-orange-100' : 'bg-blue-100'
                          }`}>
                            <Pill className={`w-4 h-4 ${
                              stockStatus === 'out' ? 'text-red-600' : stockStatus === 'low' ? 'text-orange-600' : 'text-blue-600'
                            }`} />
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
                            <span className={`text-sm font-bold ${
                              stockStatus === 'out' ? 'text-red-600' : 
                              stockStatus === 'low' ? 'text-orange-600' : 
                              stockStatus === 'warning' ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              {item.currentStock}
                            </span>
                            <span className="text-xs text-gray-500">/ {item.maxStock}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                stockStatus === 'out' ? 'bg-red-500' :
                                stockStatus === 'low' ? 'bg-orange-500' :
                                stockStatus === 'warning' ? 'bg-amber-500' : 'bg-green-500'
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
                        <span className="text-gray-700">{formatCurrency(item.unitPrice)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {formatCurrency(item.currentStock * item.unitPrice)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${
                            isExpired(item.expiryDate) ? 'text-red-600 font-medium' :
                            isExpiringSoon(item.expiryDate) ? 'text-amber-600 font-medium' : 'text-gray-700'
                          }`}>
                            {formatDate(item.expiryDate)}
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
                        <span className="text-sm text-gray-600 font-mono">{item.batchNumber || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setAdjustModal({ item, type: 'in' })}
                            className="p-1.5 hover:bg-green-100 rounded text-green-600 transition-colors"
                            title="Add Stock"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setAdjustModal({ item, type: 'out' })}
                            className="p-1.5 hover:bg-red-100 rounded text-red-600 transition-colors"
                            title="Remove Stock"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setHistoryModal(item)}
                            className="p-1.5 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {item.isLowStock && (
                            <button
                              onClick={() => handleReorder(item)}
                              className="p-1.5 hover:bg-purple-100 rounded text-purple-600 transition-colors"
                              title="Reorder"
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {adjustModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {adjustModal.type === 'in' ? 'Add Stock' : 'Remove Stock'}
              </h3>
              <button onClick={() => setAdjustModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium text-gray-900">{adjustModal.item.name}</p>
              <p className="text-sm text-gray-500">Current Stock: {adjustModal.item.currentStock}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select reason...</option>
                  {adjustModal.type === 'in' ? (
                    <>
                      <option value="Purchase received">Purchase received</option>
                      <option value="Stock return">Stock return</option>
                      <option value="Transfer in">Transfer in</option>
                      <option value="Correction">Correction</option>
                    </>
                  ) : (
                    <>
                      <option value="Damaged">Damaged</option>
                      <option value="Expired">Expired</option>
                      <option value="Theft/Loss">Theft/Loss</option>
                      <option value="Transfer out">Transfer out</option>
                      <option value="Correction">Correction</option>
                    </>
                  )}
                </select>
              </div>

              {adjustModal.type === 'in' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                    <input
                      type="text"
                      value={adjustBatch}
                      onChange={(e) => setAdjustBatch(e.target.value)}
                      placeholder="e.g., BATCH-2026-001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={adjustExpiry}
                      onChange={(e) => setAdjustExpiry(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setAdjustModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                disabled={!adjustReason || adjustQuantity <= 0 || adjustMutation.isPending}
                className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 ${
                  adjustModal.type === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {adjustMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {adjustModal.type === 'in' ? 'Add Stock' : 'Remove Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Stock History</h3>
                <p className="text-sm text-gray-500">{historyModal.name}</p>
              </div>
              <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto">
              {!movementsData || movementsData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No movement history available</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Qty</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Balance</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movementsData.map((m: any) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 text-gray-700">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            m.quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {m.movementType}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-medium ${
                          m.quantity > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{m.balanceAfter}</td>
                        <td className="px-3 py-2 text-gray-500">{m.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
