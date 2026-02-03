import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '../../components/PermissionGate';
import { labSuppliesService } from '../../services';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import {
  Package,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Calendar,
  TrendingDown,
  Box,
  Beaker,
  ShoppingCart,
} from 'lucide-react';

interface Consumable {
  id: string;
  name: string;
  category: string;
  catalogNumber: string;
  unit: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  unitCost: number;
  supplier: string;
  location: string;
  expiryDate?: string;
  lastOrdered?: string;
  consumptionRate: number; // per day
  daysUntilReorder: number;
}

// Sample lab consumables data
const mockConsumables: Consumable[] = [
  { id: 'CON001', name: 'EDTA Tubes (Lavender)', category: 'Blood Collection', catalogNumber: 'BD-367844', unit: 'Box (100)', currentStock: 45, minStock: 20, maxStock: 200, reorderPoint: 50, unitCost: 2500, supplier: 'BD Vacutainer', location: 'Shelf A-1', expiryDate: new Date(Date.now() + 180 * 86400000).toISOString(), consumptionRate: 5, daysUntilReorder: 0 },
  { id: 'CON002', name: 'Red Top Tubes (Plain)', category: 'Blood Collection', catalogNumber: 'BD-366430', unit: 'Box (100)', currentStock: 120, minStock: 30, maxStock: 300, reorderPoint: 60, unitCost: 2200, supplier: 'BD Vacutainer', location: 'Shelf A-1', consumptionRate: 8, daysUntilReorder: 8 },
  { id: 'CON003', name: 'Gold SST Tubes', category: 'Blood Collection', catalogNumber: 'BD-367983', unit: 'Box (100)', currentStock: 85, minStock: 25, maxStock: 250, reorderPoint: 50, unitCost: 3100, supplier: 'BD Vacutainer', location: 'Shelf A-2', consumptionRate: 6, daysUntilReorder: 6 },
  { id: 'CON004', name: 'Light Blue Citrate Tubes', category: 'Blood Collection', catalogNumber: 'BD-363083', unit: 'Box (100)', currentStock: 15, minStock: 20, maxStock: 150, reorderPoint: 40, unitCost: 2800, supplier: 'BD Vacutainer', location: 'Shelf A-2', consumptionRate: 2, daysUntilReorder: -3 },
  { id: 'CON005', name: 'Micropipette Tips 1000µL', category: 'Pipettes', catalogNumber: 'EPP-022491067', unit: 'Pack (1000)', currentStock: 25, minStock: 10, maxStock: 100, reorderPoint: 20, unitCost: 8500, supplier: 'Eppendorf', location: 'Shelf B-1', consumptionRate: 2, daysUntilReorder: 3 },
  { id: 'CON006', name: 'Micropipette Tips 200µL', category: 'Pipettes', catalogNumber: 'EPP-022491504', unit: 'Pack (1000)', currentStock: 18, minStock: 10, maxStock: 100, reorderPoint: 20, unitCost: 7500, supplier: 'Eppendorf', location: 'Shelf B-1', consumptionRate: 3, daysUntilReorder: -1 },
  { id: 'CON007', name: 'Glucose Reagent Kit', category: 'Reagents', catalogNumber: 'ROC-04404483190', unit: 'Kit (500 tests)', currentStock: 8, minStock: 3, maxStock: 20, reorderPoint: 5, unitCost: 45000, supplier: 'Roche Diagnostics', location: 'Fridge R-1', expiryDate: new Date(Date.now() + 90 * 86400000).toISOString(), consumptionRate: 0.5, daysUntilReorder: 6 },
  { id: 'CON008', name: 'Creatinine Reagent Kit', category: 'Reagents', catalogNumber: 'ROC-04810716190', unit: 'Kit (400 tests)', currentStock: 6, minStock: 2, maxStock: 15, reorderPoint: 4, unitCost: 38000, supplier: 'Roche Diagnostics', location: 'Fridge R-1', expiryDate: new Date(Date.now() + 120 * 86400000).toISOString(), consumptionRate: 0.3, daysUntilReorder: 7 },
  { id: 'CON009', name: 'HbA1c Reagent Pack', category: 'Reagents', catalogNumber: 'BIO-12003869', unit: 'Pack (100 tests)', currentStock: 3, minStock: 2, maxStock: 10, reorderPoint: 3, unitCost: 55000, supplier: 'Bio-Rad', location: 'Fridge R-2', expiryDate: new Date(Date.now() + 25 * 86400000).toISOString(), consumptionRate: 0.2, daysUntilReorder: 0 },
  { id: 'CON010', name: 'Microscope Slides (Frosted)', category: 'Microscopy', catalogNumber: 'FIS-12-544-7', unit: 'Box (72)', currentStock: 35, minStock: 10, maxStock: 100, reorderPoint: 20, unitCost: 1800, supplier: 'Fisher Scientific', location: 'Shelf C-1', consumptionRate: 3, daysUntilReorder: 5 },
  { id: 'CON011', name: 'Cover Slips 22x22mm', category: 'Microscopy', catalogNumber: 'FIS-12-545-A', unit: 'Box (100)', currentStock: 42, minStock: 15, maxStock: 80, reorderPoint: 25, unitCost: 950, supplier: 'Fisher Scientific', location: 'Shelf C-1', consumptionRate: 2, daysUntilReorder: 9 },
  { id: 'CON012', name: 'Urine Dipsticks (10 Parameter)', category: 'Urinalysis', catalogNumber: 'SIE-2161', unit: 'Bottle (100)', currentStock: 22, minStock: 8, maxStock: 60, reorderPoint: 15, unitCost: 4200, supplier: 'Siemens', location: 'Shelf D-1', consumptionRate: 2, daysUntilReorder: 4 },
  { id: 'CON013', name: 'Cuvettes (Spectrophotometer)', category: 'Spectrophotometry', catalogNumber: 'FIS-14-385-999A', unit: 'Pack (500)', currentStock: 12, minStock: 5, maxStock: 30, reorderPoint: 8, unitCost: 12500, supplier: 'Fisher Scientific', location: 'Shelf E-1', consumptionRate: 0.5, daysUntilReorder: 8 },
  { id: 'CON014', name: 'Blood Agar Plates', category: 'Microbiology', catalogNumber: 'OXO-CM0055B', unit: 'Pack (10)', currentStock: 8, minStock: 5, maxStock: 40, reorderPoint: 10, unitCost: 3500, supplier: 'Oxoid', location: 'Fridge R-3', expiryDate: new Date(Date.now() + 14 * 86400000).toISOString(), consumptionRate: 1, daysUntilReorder: -2 },
  { id: 'CON015', name: 'MacConkey Agar Plates', category: 'Microbiology', catalogNumber: 'OXO-CM0007B', unit: 'Pack (10)', currentStock: 12, minStock: 5, maxStock: 40, reorderPoint: 10, unitCost: 3200, supplier: 'Oxoid', location: 'Fridge R-3', expiryDate: new Date(Date.now() + 21 * 86400000).toISOString(), consumptionRate: 0.8, daysUntilReorder: 3 },
];

const categories = ['All', 'Blood Collection', 'Pipettes', 'Reagents', 'Microscopy', 'Urinalysis', 'Spectrophotometry', 'Microbiology'];
const stockStatuses = ['All', 'Low Stock', 'Critical', 'Expiring Soon', 'Normal'];

export default function LabConsumablesPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Consumable | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderItem, setOrderItem] = useState<Consumable | null>(null);
  const [orderQuantity, setOrderQuantity] = useState(1);

  if (!hasPermission('labqc.view')) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view Lab Consumables.</p>
        </div>
      </div>
    );
  }

  const { data: consumables, isLoading } = useQuery({
    queryKey: ['lab-consumables', facilityId, selectedCategory],
    queryFn: async () => {
      try {
        const category = selectedCategory === 'All' ? undefined : selectedCategory;
        const apiReagents = await labSuppliesService.reagents.list(facilityId, category);
        if (apiReagents && apiReagents.length > 0) {
          return apiReagents.map((r: any) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            catalogNumber: r.code,
            unit: r.unit,
            currentStock: r.currentStock,
            minStock: r.minStock,
            maxStock: r.maxStock,
            reorderPoint: r.reorderPoint,
            unitCost: r.unitCost,
            supplier: r.manufacturer || 'Unknown',
            location: 'Shelf A-1',
            expiryDate: r.expiryDate,
            consumptionRate: 1,
            daysUntilReorder: Math.floor((r.currentStock - r.reorderPoint) / 1),
          }));
        }
      } catch (error) {
        console.log('Using sample consumables data');
      }
      return mockConsumables;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<Consumable>) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-consumables'] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const orderMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { itemId, quantity };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-consumables'] });
      setShowOrderModal(false);
      setOrderItem(null);
      setOrderQuantity(1);
    },
  });

  const getStockStatus = (item: Consumable) => {
    if (item.currentStock <= item.minStock) return 'CRITICAL';
    if (item.currentStock <= item.reorderPoint) return 'LOW';
    if (item.expiryDate && new Date(item.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) return 'EXPIRING';
    return 'NORMAL';
  };

  const filteredConsumables = consumables?.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.catalogNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
    const status = getStockStatus(c);
    const matchesStatus =
      selectedStatus === 'All' ||
      (selectedStatus === 'Low Stock' && status === 'LOW') ||
      (selectedStatus === 'Critical' && status === 'CRITICAL') ||
      (selectedStatus === 'Expiring Soon' && status === 'EXPIRING') ||
      (selectedStatus === 'Normal' && status === 'NORMAL');
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (item: Consumable) => {
    const status = getStockStatus(item);
    switch (status) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Critical
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <TrendingDown className="w-3 h-3" /> Low Stock
          </span>
        );
      case 'EXPIRING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
            <Calendar className="w-3 h-3" /> Expiring Soon
          </span>
        );
      case 'NORMAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" /> Normal
          </span>
        );
      default:
        return null;
    }
  };

  const lowStockCount = consumables?.filter((c) => getStockStatus(c) === 'LOW').length || 0;
  const criticalCount = consumables?.filter((c) => getStockStatus(c) === 'CRITICAL').length || 0;
  const expiringCount = consumables?.filter((c) => getStockStatus(c) === 'EXPIRING').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lab Consumables</h1>
          <p className="text-gray-600">Track and manage laboratory supplies and consumables</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-xl font-bold text-gray-900">{consumables?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-xl font-bold text-yellow-600">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Critical</p>
              <p className="text-xl font-bold text-red-600">{criticalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Expiring Soon</p>
              <p className="text-xl font-bold text-orange-600">{expiringCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or catalog number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {stockStatuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All Statuses' : status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Consumables Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredConsumables && filteredConsumables.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Item</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Stock</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Unit Cost</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Supplier</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Reorder</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredConsumables.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.catalogNumber} • {item.unit}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <p className="font-medium text-gray-900">{item.currentStock}</p>
                        <p className="text-xs text-gray-500">
                          Min: {item.minStock} / Max: {item.maxStock}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(item)}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatCurrency(item.unitCost)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.supplier}</td>
                    <td className="px-4 py-3">
                      {item.daysUntilReorder <= 0 ? (
                        <span className="text-sm text-red-600 font-medium">Overdue</span>
                      ) : (
                        <span className="text-sm text-gray-600">{item.daysUntilReorder} days</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setOrderItem(item);
                            setOrderQuantity(Math.ceil((item.maxStock - item.currentStock) / 2));
                            setShowOrderModal(true);
                          }}
                          className="p-1 hover:bg-blue-50 rounded"
                          title="Order"
                        >
                          <ShoppingCart className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setShowModal(true);
                          }}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No consumables found</p>
          </div>
        )}
      </div>

      {/* Order Modal */}
      {showOrderModal && orderItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Create Order</h2>
              <p className="text-gray-600">{orderItem.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Current Stock</p>
                    <p className="font-medium">{orderItem.currentStock} {orderItem.unit}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Max Stock</p>
                    <p className="font-medium">{orderItem.maxStock} {orderItem.unit}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Supplier</p>
                    <p className="font-medium">{orderItem.supplier}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Unit Cost</p>
                    <p className="font-medium">{formatCurrency(orderItem.unitCost)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Estimated Total</p>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(orderItem.unitCost * orderQuantity)}
                </p>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowOrderModal(false);
                  setOrderItem(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => orderMutation.mutate({ itemId: orderItem.id, quantity: orderQuantity })}
                disabled={orderMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {orderMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
