import { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  Edit2,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Filter,
  Download,
  Upload,
} from 'lucide-react';

interface MasterItem {
  id: string;
  itemCode: string;
  description: string;
  category: string;
  subCategory: string;
  unit: string;
  reorderLevel: number;
  reorderQuantity: number;
  currentStock: number;
  preferredVendors: string[];
  isActive: boolean;
  lastUpdated: string;
}

const mockItems: MasterItem[] = [
  {
    id: '1',
    itemCode: 'MED-SUP-001',
    description: 'Disposable Surgical Gloves (Large)',
    category: 'Medical Supplies',
    subCategory: 'Protective Equipment',
    unit: 'Box (100 pcs)',
    reorderLevel: 50,
    reorderQuantity: 200,
    currentStock: 45,
    preferredVendors: ['MedSupply Co.', 'HealthCare Distributors'],
    isActive: true,
    lastUpdated: '2024-01-15',
  },
  {
    id: '2',
    itemCode: 'MED-SUP-002',
    description: 'Sterile Gauze Pads 4x4',
    category: 'Medical Supplies',
    subCategory: 'Wound Care',
    unit: 'Pack (50 pcs)',
    reorderLevel: 100,
    reorderQuantity: 500,
    currentStock: 350,
    preferredVendors: ['MedSupply Co.'],
    isActive: true,
    lastUpdated: '2024-01-14',
  },
  {
    id: '3',
    itemCode: 'LAB-EQP-001',
    description: 'Blood Collection Tubes (EDTA)',
    category: 'Laboratory',
    subCategory: 'Collection Supplies',
    unit: 'Box (100 tubes)',
    reorderLevel: 30,
    reorderQuantity: 100,
    currentStock: 85,
    preferredVendors: ['Lab Essentials Ltd.', 'MedLab Supplies'],
    isActive: true,
    lastUpdated: '2024-01-13',
  },
  {
    id: '4',
    itemCode: 'OFF-SUP-001',
    description: 'Printer Paper A4',
    category: 'Office Supplies',
    subCategory: 'Stationery',
    unit: 'Ream (500 sheets)',
    reorderLevel: 20,
    reorderQuantity: 100,
    currentStock: 15,
    preferredVendors: ['Office Mart'],
    isActive: true,
    lastUpdated: '2024-01-12',
  },
  {
    id: '5',
    itemCode: 'MED-EQP-001',
    description: 'Digital Thermometer',
    category: 'Medical Equipment',
    subCategory: 'Diagnostic Devices',
    unit: 'Each',
    reorderLevel: 10,
    reorderQuantity: 30,
    currentStock: 25,
    preferredVendors: ['MedTech Solutions'],
    isActive: true,
    lastUpdated: '2024-01-11',
  },
  {
    id: '6',
    itemCode: 'MED-SUP-003',
    description: 'IV Cannula 18G',
    category: 'Medical Supplies',
    subCategory: 'IV Supplies',
    unit: 'Box (50 pcs)',
    reorderLevel: 40,
    reorderQuantity: 150,
    currentStock: 120,
    preferredVendors: ['MedSupply Co.', 'Hospital Supplies Inc.'],
    isActive: true,
    lastUpdated: '2024-01-10',
  },
  {
    id: '7',
    itemCode: 'CLN-SUP-001',
    description: 'Disinfectant Solution 5L',
    category: 'Cleaning Supplies',
    subCategory: 'Disinfectants',
    unit: 'Container',
    reorderLevel: 15,
    reorderQuantity: 50,
    currentStock: 8,
    preferredVendors: ['CleanCare Ltd.'],
    isActive: true,
    lastUpdated: '2024-01-09',
  },
  {
    id: '8',
    itemCode: 'MED-SUP-004',
    description: 'Syringes 5ml (Disposable)',
    category: 'Medical Supplies',
    subCategory: 'Injection Supplies',
    unit: 'Box (100 pcs)',
    reorderLevel: 60,
    reorderQuantity: 250,
    currentStock: 0,
    preferredVendors: ['MedSupply Co.'],
    isActive: false,
    lastUpdated: '2024-01-08',
  },
];

const categories = ['All Categories', 'Medical Supplies', 'Laboratory', 'Office Supplies', 'Medical Equipment', 'Cleaning Supplies'];

export default function ItemMasterPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');

  const filteredItems = useMemo(() => {
    return mockItems.filter((item) => {
      const matchesSearch =
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive);
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'low' && item.currentStock <= item.reorderLevel) ||
        (stockFilter === 'ok' && item.currentStock > item.reorderLevel);
      return matchesSearch && matchesCategory && matchesStatus && matchesStock;
    });
  }, [searchTerm, categoryFilter, statusFilter, stockFilter]);

  const getStockStatus = (current: number, reorderLevel: number) => {
    if (current === 0) return { color: 'text-red-600 bg-red-50', label: 'Out of Stock' };
    if (current <= reorderLevel) return { color: 'text-amber-600 bg-amber-50', label: 'Low Stock' };
    return { color: 'text-green-600 bg-green-50', label: 'In Stock' };
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Package className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Item Master</h1>
            <p className="text-sm text-gray-500">Master catalog of non-pharmaceutical items</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Upload className="w-4 h-4" />
            Import
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by item code or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Stock Levels</option>
          <option value="low">Low/Out of Stock</option>
          <option value="ok">Adequate Stock</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{mockItems.length}</div>
          <div className="text-sm text-gray-500">Total Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {mockItems.filter((i) => i.isActive).length}
          </div>
          <div className="text-sm text-gray-500">Active Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-amber-600">
            {mockItems.filter((i) => i.currentStock <= i.reorderLevel && i.currentStock > 0).length}
          </div>
          <div className="text-sm text-gray-500">Low Stock Items</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-red-600">
            {mockItems.filter((i) => i.currentStock === 0).length}
          </div>
          <div className="text-sm text-gray-500">Out of Stock</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendors</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const stockStatus = getStockStatus(item.currentStock, item.reorderLevel);
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-gray-900">{item.itemCode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.description}</div>
                      <div className="text-sm text-gray-500">{item.subCategory}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{item.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className="text-gray-900">Level: {item.reorderLevel}</div>
                        <div className="text-gray-500">Qty: {item.reorderQuantity}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.currentStock}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                          {stockStatus.label}
                        </span>
                        {item.currentStock <= item.reorderLevel && item.currentStock > 0 && (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {item.preferredVendors.slice(0, 2).join(', ')}
                        {item.preferredVendors.length > 2 && (
                          <span className="text-gray-400"> +{item.preferredVendors.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.isActive ? (
                        <span className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 text-sm">
                          <XCircle className="w-4 h-4" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-gray-400 hover:text-purple-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
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
