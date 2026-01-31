import { useState, useMemo, useEffect } from 'react';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
import {
  Search,
  Plus,
  Edit2,
  Download,
  Upload,
  Filter,
  Package,
  AlertTriangle,
  Calendar,
  TrendingDown,
  Truck,
  BarChart3,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';

interface Reagent {
  id: string;
  code: string;
  name: string;
  category: string;
  manufacturer: string;
  lotNumber: string;
  expiryDate: string;
  currentStock: number;
  reorderPoint: number;
  unit: string;
  unitCost: number;
  supplier: string;
  lastReceived: string;
  usagePerMonth: number;
}

const STORAGE_KEY = 'reagents-inventory';

const defaultReagents: Reagent[] = [
  { id: '1', code: 'RGT001', name: 'Hemoglobin Reagent', category: 'Hematology', manufacturer: 'Sysmex', lotNumber: 'LOT2024-001', expiryDate: '2024-12-31', currentStock: 45, reorderPoint: 20, unit: 'vials', unitCost: 2500, supplier: 'MedSupply Kenya', lastReceived: '2024-01-10', usagePerMonth: 15 },
  { id: '2', code: 'RGT002', name: 'Glucose Reagent', category: 'Biochemistry', manufacturer: 'Roche', lotNumber: 'LOT2024-015', expiryDate: '2024-09-30', currentStock: 12, reorderPoint: 25, unit: 'kits', unitCost: 8500, supplier: 'Roche Diagnostics', lastReceived: '2024-01-05', usagePerMonth: 20 },
  { id: '3', code: 'RGT003', name: 'TSH Calibrator', category: 'Immunology', manufacturer: 'Abbott', lotNumber: 'LOT2023-089', expiryDate: '2024-06-15', currentStock: 8, reorderPoint: 5, unit: 'sets', unitCost: 15000, supplier: 'Abbott Laboratories', lastReceived: '2023-12-20', usagePerMonth: 3 },
  { id: '4', code: 'RGT004', name: 'Urine Dipsticks', category: 'Clinical Pathology', manufacturer: 'Siemens', lotNumber: 'LOT2024-022', expiryDate: '2025-03-31', currentStock: 150, reorderPoint: 100, unit: 'strips', unitCost: 50, supplier: 'Siemens Healthcare', lastReceived: '2024-01-12', usagePerMonth: 80 },
  { id: '5', code: 'RGT005', name: 'Blood Culture Bottles', category: 'Microbiology', manufacturer: 'bioMérieux', lotNumber: 'LOT2024-008', expiryDate: '2024-11-30', currentStock: 5, reorderPoint: 30, unit: 'bottles', unitCost: 1200, supplier: 'MedTech Supplies', lastReceived: '2024-01-08', usagePerMonth: 25 },
  { id: '6', code: 'RGT006', name: 'Lipid Profile Reagent', category: 'Biochemistry', manufacturer: 'Roche', lotNumber: 'LOT2024-003', expiryDate: '2024-10-15', currentStock: 28, reorderPoint: 15, unit: 'kits', unitCost: 12000, supplier: 'Roche Diagnostics', lastReceived: '2024-01-11', usagePerMonth: 10 },
  { id: '7', code: 'RGT007', name: 'PT/INR Reagent', category: 'Coagulation', manufacturer: 'Stago', lotNumber: 'LOT2023-156', expiryDate: '2024-04-30', currentStock: 18, reorderPoint: 10, unit: 'vials', unitCost: 6500, supplier: 'Diagnostica Stago', lastReceived: '2023-12-28', usagePerMonth: 8 },
  { id: '8', code: 'RGT008', name: 'CRP Latex Reagent', category: 'Immunology', manufacturer: 'Beckman', lotNumber: 'LOT2024-011', expiryDate: '2024-08-20', currentStock: 22, reorderPoint: 12, unit: 'kits', unitCost: 4500, supplier: 'Beckman Coulter', lastReceived: '2024-01-09', usagePerMonth: 6 },
  { id: '9', code: 'RGT009', name: 'Blood Gas Cartridges', category: 'POCT', manufacturer: 'Radiometer', lotNumber: 'LOT2024-005', expiryDate: '2024-05-31', currentStock: 35, reorderPoint: 40, unit: 'cartridges', unitCost: 3500, supplier: 'Radiometer Medical', lastReceived: '2024-01-14', usagePerMonth: 30 },
  { id: '10', code: 'RGT010', name: 'HbA1c Reagent', category: 'Biochemistry', manufacturer: 'Bio-Rad', lotNumber: 'LOT2024-018', expiryDate: '2024-07-25', currentStock: 15, reorderPoint: 8, unit: 'kits', unitCost: 9800, supplier: 'Bio-Rad Laboratories', lastReceived: '2024-01-06', usagePerMonth: 5 },
];

const loadReagentsFromStorage = (): Reagent[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultReagents;
  } catch {
    return defaultReagents;
  }
};

const saveReagentsToStorage = (reagents: Reagent[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reagents));
};

const emptyReagent: Omit<Reagent, 'id'> = {
  code: '',
  name: '',
  category: 'Hematology',
  manufacturer: '',
  lotNumber: '',
  expiryDate: '',
  currentStock: 0,
  reorderPoint: 0,
  unit: 'vials',
  unitCost: 0,
  supplier: '',
  lastReceived: new Date().toISOString().split('T')[0],
  usagePerMonth: 0,
};

const categories = ['All', 'Hematology', 'Biochemistry', 'Immunology', 'Microbiology', 'Clinical Pathology', 'Coagulation', 'POCT'];

const getStockStatus = (current: number, reorderPoint: number) => {
  const ratio = current / reorderPoint;
  if (ratio <= 0.5) return 'critical';
  if (ratio <= 1) return 'low';
  return 'adequate';
};

const getExpiryStatus = (expiryDate: string) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiry <= 30) return 'expiring-soon';
  if (daysUntilExpiry <= 90) return 'expiring';
  return 'valid';
};

export default function ReagentsInventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [reagents, setReagents] = useState<Reagent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReagent, setEditingReagent] = useState<Reagent | null>(null);
  const [formData, setFormData] = useState<Omit<Reagent, 'id'>>(emptyReagent);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setReagents(loadReagentsFromStorage());
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading && reagents.length > 0) {
      saveReagentsToStorage(reagents);
    }
  }, [reagents, isLoading]);

  const handleAddReagent = () => {
    setEditingReagent(null);
    setFormData(emptyReagent);
    setShowModal(true);
  };

  const handleEditReagent = (reagent: Reagent) => {
    setEditingReagent(reagent);
    const { id, ...rest } = reagent;
    setFormData(rest);
    setShowModal(true);
  };

  const handleDeleteReagent = (id: string) => {
    if (window.confirm('Are you sure you want to delete this reagent?')) {
      setReagents(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleSaveReagent = () => {
    if (!formData.name || !formData.code) {
      alert('Please fill in required fields (Name, Code)');
      return;
    }

    if (editingReagent) {
      setReagents(prev => prev.map(r => 
        r.id === editingReagent.id ? { ...formData, id: editingReagent.id } : r
      ));
    } else {
      const newReagent: Reagent = {
        ...formData,
        id: Date.now().toString(),
      };
      setReagents(prev => [...prev, newReagent]);
    }
    setShowModal(false);
    setEditingReagent(null);
    setFormData(emptyReagent);
  };

  const handleReceiveStock = (reagent: Reagent) => {
    const amount = window.prompt(`Enter quantity to add to ${reagent.name}:`, '10');
    if (amount && !isNaN(Number(amount))) {
      setReagents(prev => prev.map(r => 
        r.id === reagent.id 
          ? { ...r, currentStock: r.currentStock + Number(amount), lastReceived: new Date().toISOString().split('T')[0] }
          : r
      ));
    }
  };

  const filteredReagents = useMemo(() => {
    return reagents.filter(reagent => {
      const matchesSearch = reagent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reagent.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reagent.lotNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || reagent.category === selectedCategory;
      
      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = getStockStatus(reagent.currentStock, reagent.reorderPoint) !== 'adequate';
      } else if (stockFilter === 'expiring') {
        matchesStock = getExpiryStatus(reagent.expiryDate) !== 'valid';
      }
      
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [reagents, searchTerm, selectedCategory, stockFilter]);

  const stats = useMemo(() => ({
    total: reagents.length,
    lowStock: reagents.filter(r => getStockStatus(r.currentStock, r.reorderPoint) !== 'adequate').length,
    expiringSoon: reagents.filter(r => getExpiryStatus(r.expiryDate) !== 'valid').length,
    totalValue: reagents.reduce((acc, r) => acc + (r.currentStock * r.unitCost), 0),
  }), [reagents]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reagents Inventory</h1>
            <p className="text-sm text-gray-500">Track reagents, consumables, and stock levels</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Upload className="w-4 h-4" />
              Import Stock
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button 
              onClick={handleAddReagent}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Reagent
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total Items:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-500">Low Stock:</span>
            <span className="font-semibold text-red-600">{stats.lowStock}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-gray-500">Expiring Soon:</span>
            <span className="font-semibold text-orange-600">{stats.expiringSoon}</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Total Value:</span>
            <span className="font-semibold text-blue-600">{formatCurrency(stats.totalValue)}</span>
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
              placeholder="Search by name, code, or lot number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Stock Levels</option>
              <option value="low">Low Stock Only</option>
              <option value="expiring">Expiring Soon</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-600">Loading reagents...</span>
          </div>
        ) : (
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reagent Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Lot Number</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Expiry Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Unit Cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usage/Month</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredReagents.map(reagent => {
                const stockStatus = getStockStatus(reagent.currentStock, reagent.reorderPoint);
                const expiryStatus = getExpiryStatus(reagent.expiryDate);
                
                return (
                  <tr key={reagent.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{reagent.code}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{reagent.name}</span>
                        <p className="text-xs text-gray-500">{reagent.manufacturer} • {reagent.category}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{reagent.lotNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-sm ${
                        expiryStatus === 'expiring-soon' ? 'text-red-600' :
                        expiryStatus === 'expiring' ? 'text-orange-600' : 'text-gray-600'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        {new Date(reagent.expiryDate).toLocaleDateString()}
                        {expiryStatus === 'expiring-soon' && (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              stockStatus === 'critical' ? 'bg-red-500' :
                              stockStatus === 'low' ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((reagent.currentStock / reagent.reorderPoint) * 50, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${
                          stockStatus === 'critical' ? 'text-red-600' :
                          stockStatus === 'low' ? 'text-orange-600' : 'text-gray-700'
                        }`}>
                          {reagent.currentStock} {reagent.unit}
                        </span>
                        {stockStatus !== 'adequate' && (
                          <span className="text-xs text-gray-500">(min: {reagent.reorderPoint})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Truck className="w-3 h-3 text-gray-400" />
                        {reagent.supplier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(reagent.unitCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {reagent.usagePerMonth} {reagent.unit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => handleEditReagent(reagent)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" 
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleReceiveStock(reagent)}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded" 
                          title="Receive Stock"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteReagent(reagent.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Alert Bar for Low Stock */}
      {stats.lowStock > 0 && (
        <div className="bg-red-50 border-t border-red-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">{stats.lowStock} items are below reorder point</span>
            </div>
            <button className="px-4 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-100">
              Generate Purchase Order
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingReagent ? 'Edit Reagent' : 'Add New Reagent'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="RGT001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Reagent Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Manufacturer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
                <input
                  type="text"
                  value={formData.lotNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, lotNumber: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="LOT2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                <input
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentStock: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                <input
                  type="number"
                  value={formData.reorderPoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, reorderPoint: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="vials, kits, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost ({CURRENCY_SYMBOL})</label>
                <input
                  type="number"
                  value={formData.unitCost}
                  onChange={(e) => setFormData(prev => ({ ...prev, unitCost: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Supplier Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usage Per Month</label>
                <input
                  type="number"
                  value={formData.usagePerMonth}
                  onChange={(e) => setFormData(prev => ({ ...prev, usagePerMonth: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReagent}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {editingReagent ? 'Update Reagent' : 'Add Reagent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}