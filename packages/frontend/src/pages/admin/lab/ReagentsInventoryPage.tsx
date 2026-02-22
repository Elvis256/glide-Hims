import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../../services/api';
import { labSuppliesService } from '../../../services';
import { useFacilityId } from '../../../lib/facility';
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
  TrendingDown,
  BarChart3,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';

type ReagentCategory =
  | 'CHEMISTRY' | 'HEMATOLOGY' | 'MICROBIOLOGY' | 'SEROLOGY'
  | 'IMMUNOLOGY' | 'MOLECULAR' | 'URINALYSIS' | 'COAGULATION'
  | 'BLOOD_BANK' | 'HISTOLOGY' | 'CYTOLOGY' | 'GENERAL' | 'OTHER';

interface Reagent {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  description?: string;
  category: ReagentCategory;
  manufacturer?: string;
  catalogNumber?: string;
  unit: string;
  unitSize: number;
  stockQuantity: number;
  reorderLevel: number;
  maxStockLevel?: number;
  unitCost: number;
  storageTemperature?: string;
  storageConditions?: string;
  expiryDate?: string;
  isActive: boolean;
}

interface ReceiveStockForm {
  lotNumber: string;
  quantity: string;
  expiryDate: string;
  costPerUnit: string;
  supplier: string;
}

interface ReagentFormData {
  code: string;
  name: string;
  description: string;
  category: ReagentCategory;
  manufacturer: string;
  catalogNumber: string;
  unit: string;
  unitSize: number;
  stockQuantity: number;
  reorderLevel: number;
  maxStockLevel: number;
  unitCost: number;
  storageTemperature: string;
  storageConditions: string;
  isActive: boolean;
}

const emptyFormData: ReagentFormData = {
  code: '',
  name: '',
  description: '',
  category: 'HEMATOLOGY',
  manufacturer: '',
  catalogNumber: '',
  unit: 'vials',
  unitSize: 1,
  stockQuantity: 0,
  reorderLevel: 0,
  maxStockLevel: 0,
  unitCost: 0,
  storageTemperature: '',
  storageConditions: '',
  isActive: true,
};

const API_PATH = '/lab-supplies/reagents';

const categoryOptions: ReagentCategory[] = [
  'CHEMISTRY', 'HEMATOLOGY', 'MICROBIOLOGY', 'SEROLOGY',
  'IMMUNOLOGY', 'MOLECULAR', 'URINALYSIS', 'COAGULATION',
  'BLOOD_BANK', 'HISTOLOGY', 'CYTOLOGY', 'GENERAL', 'OTHER',
];

const categories = ['All', ...categoryOptions];

const getStockStatus = (current: number, reorderLevel: number) => {
  if (reorderLevel === 0) return 'adequate';
  const ratio = current / reorderLevel;
  if (ratio <= 0.5) return 'critical';
  if (ratio <= 1) return 'low';
  return 'adequate';
};

export default function ReagentsInventoryPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingReagent, setEditingReagent] = useState<Reagent | null>(null);
  const [formData, setFormData] = useState<ReagentFormData>(emptyFormData);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; reagent: Reagent | null }>({ open: false, reagent: null });
  const [receiveModal, setReceiveModal] = useState<{ open: boolean; reagent: Reagent | null }>({ open: false, reagent: null });
  const [receiveForm, setReceiveForm] = useState<ReceiveStockForm>({ lotNumber: '', quantity: '', expiryDate: '', costPerUnit: '', supplier: '' });
  const importInputRef = useRef<HTMLInputElement>(null);

  const { data: reagents = [], isLoading } = useQuery<Reagent[]>({
    queryKey: ['reagents', facilityId],
    queryFn: async () => {
      const res = await api.get(API_PATH, { params: { facilityId } });
      return res.data;
    },
  });

  const { data: expiringItems = [] } = useQuery<Reagent[]>({
    queryKey: ['reagents-expiring', facilityId],
    queryFn: async () => {
      try {
        return await labSuppliesService.reagents.getExpiring(facilityId, 30) as unknown as Reagent[];
      } catch { return []; }
    },
  });

  const receiveMutation = useMutation({
    mutationFn: ({ reagentId, data }: { reagentId: string; data: object }) =>
      labSuppliesService.reagentLots.receive(reagentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reagents'] });
      toast.success('Stock received successfully');
      setReceiveModal({ open: false, reagent: null });
      setReceiveForm({ lotNumber: '', quantity: '', expiryDate: '', costPerUnit: '', supplier: '' });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: (data: ReagentFormData) =>
      api.post(API_PATH, { facilityId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reagents'] });
      toast.success('Reagent added successfully');
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReagentFormData }) =>
      api.put(`${API_PATH}/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reagents'] });
      toast.success('Reagent updated successfully');
      closeModal();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingReagent(null);
    setFormData(emptyFormData);
  };

  const handleAddReagent = () => {
    setEditingReagent(null);
    setFormData(emptyFormData);
    setShowModal(true);
  };

  const handleEditReagent = (reagent: Reagent) => {
    setEditingReagent(reagent);
    setFormData({
      code: reagent.code,
      name: reagent.name,
      description: reagent.description ?? '',
      category: reagent.category,
      manufacturer: reagent.manufacturer ?? '',
      catalogNumber: reagent.catalogNumber ?? '',
      unit: reagent.unit,
      unitSize: reagent.unitSize,
      stockQuantity: reagent.stockQuantity,
      reorderLevel: reagent.reorderLevel,
      maxStockLevel: reagent.maxStockLevel ?? 0,
      unitCost: reagent.unitCost,
      storageTemperature: reagent.storageTemperature ?? '',
      storageConditions: reagent.storageConditions ?? '',
      isActive: reagent.isActive,
    });
    setShowModal(true);
  };

  const handleDeleteReagent = (reagent: Reagent) => {
    setDeleteModal({ open: true, reagent });
  };

  const confirmDelete = () => {
    if (!deleteModal.reagent) return;
    const r = deleteModal.reagent;
    updateMutation.mutate({
      id: r.id,
      data: {
        code: r.code, name: r.name, description: r.description ?? '', category: r.category,
        manufacturer: r.manufacturer ?? '', catalogNumber: r.catalogNumber ?? '', unit: r.unit,
        unitSize: r.unitSize, stockQuantity: r.stockQuantity, reorderLevel: r.reorderLevel,
        maxStockLevel: r.maxStockLevel ?? 0, unitCost: r.unitCost,
        storageTemperature: r.storageTemperature ?? '', storageConditions: r.storageConditions ?? '', isActive: false,
      },
    });
    setDeleteModal({ open: false, reagent: null });
  };

  const handleSaveReagent = () => {
    if (!formData.name || !formData.code) {
      toast.error('Please fill in required fields (Name, Code)');
      return;
    }

    if (editingReagent) {
      updateMutation.mutate({ id: editingReagent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleReceiveStock = (reagent: Reagent) => {
    setReceiveForm({ lotNumber: '', quantity: '', expiryDate: '', costPerUnit: String(reagent.unitCost), supplier: reagent.manufacturer ?? '' });
    setReceiveModal({ open: true, reagent });
  };

  const submitReceiveStock = () => {
    if (!receiveModal.reagent) return;
    const qty = Number(receiveForm.quantity);
    if (!receiveForm.lotNumber || isNaN(qty) || qty <= 0) {
      toast.error('Lot number and valid quantity are required');
      return;
    }
    receiveMutation.mutate({
      reagentId: receiveModal.reagent.id,
      data: {
        lotNumber: receiveForm.lotNumber,
        quantity: qty,
        expiryDate: receiveForm.expiryDate || undefined,
        costPerUnit: receiveForm.costPerUnit ? Number(receiveForm.costPerUnit) : undefined,
        supplier: receiveForm.supplier || undefined,
      },
    });
  };

  const handleExportCSV = () => {
    const header = ['Name', 'Category', 'Unit', 'Stock', 'Reorder Level', 'Expiry Date'];
    const rows = reagents.map(r => [r.name, r.category, r.unit, r.stockQuantity, r.reorderLevel, r.expiryDate ?? '']);
    const csv = [header, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reagents-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(Boolean);
      const [, ...dataRows] = lines; // skip header
      let imported = 0;
      for (const line of dataRows) {
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        if (!cols[0]) continue;
        try {
          await api.post(API_PATH, {
            facilityId, name: cols[0], category: cols[1] || 'OTHER', unit: cols[2] || 'units',
            stockQuantity: Number(cols[3]) || 0, reorderLevel: Number(cols[4]) || 0,
            expiryDate: cols[5] || undefined, code: cols[0].toUpperCase().replace(/\s+/g, '_').slice(0, 20),
            unitSize: 1, unitCost: 0, isActive: true,
          });
          imported++;
        } catch { /* skip bad rows */ }
      }
      queryClient.invalidateQueries({ queryKey: ['reagents'] });
      toast.success(`Imported ${imported} reagent(s)`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getExpiryColor = (expiryDate?: string) => {
    if (!expiryDate) return '';
    const daysUntil = (new Date(expiryDate).getTime() - Date.now()) / 86400000;
    if (daysUntil < 7) return 'text-red-600 font-semibold';
    if (daysUntil < 30) return 'text-orange-500';
    return 'text-green-600';
  };

  const filteredReagents = useMemo(() => {
    return reagents.filter(reagent => {
      const matchesSearch = reagent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        reagent.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || reagent.category === selectedCategory;
      
      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = getStockStatus(reagent.stockQuantity, reagent.reorderLevel) !== 'adequate';
      }
      
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [reagents, searchTerm, selectedCategory, stockFilter]);

  const stats = useMemo(() => ({
    total: reagents.length,
    lowStock: reagents.filter(r => getStockStatus(r.stockQuantity, r.reorderLevel) !== 'adequate').length,
    totalValue: reagents.reduce((acc, r) => acc + (r.stockQuantity * r.unitCost), 0),
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
            <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              <Upload className="w-4 h-4" />
              Import Stock
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
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
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Total Value:</span>
            <span className="font-semibold text-blue-600">{formatCurrency(stats.totalValue)}</span>
          </div>
        </div>
      </div>

      {/* Expiry Warning Banner */}
      {expiringItems.length > 0 && (
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-3">
          <div className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">{expiringItems.length} item{expiringItems.length > 1 ? 's' : ''} expiring within 30 days</span>
          </div>
        </div>
      )}

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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock Level</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Manufacturer</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Unit Cost</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Expiry</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredReagents.map(reagent => {
                const stockStatus = getStockStatus(reagent.stockQuantity, reagent.reorderLevel);
                
                return (
                  <tr key={reagent.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{reagent.code}</code>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{reagent.name}</span>
                        {reagent.catalogNumber && (
                          <p className="text-xs text-gray-500">Cat# {reagent.catalogNumber}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{reagent.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              stockStatus === 'critical' ? 'bg-red-500' :
                              stockStatus === 'low' ? 'bg-orange-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(reagent.reorderLevel > 0 ? (reagent.stockQuantity / reagent.reorderLevel) * 50 : 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-medium ${
                          stockStatus === 'critical' ? 'text-red-600' :
                          stockStatus === 'low' ? 'text-orange-600' : 'text-gray-700'
                        }`}>
                          {reagent.stockQuantity} {reagent.unit}
                        </span>
                        {stockStatus !== 'adequate' && (
                          <span className="text-xs text-gray-500">(min: {reagent.reorderLevel})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{reagent.manufacturer || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(reagent.unitCost)}
                    </td>
                    <td className="px-4 py-3">
                      {reagent.expiryDate ? (
                        <span className={`text-sm ${getExpiryColor(reagent.expiryDate)}`}>
                          {new Date(reagent.expiryDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        reagent.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {reagent.isActive ? 'Active' : 'Inactive'}
                      </span>
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
                          onClick={() => handleDeleteReagent(reagent)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Deactivate"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as ReagentCategory }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categoryOptions.map(cat => (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Catalog Number</label>
                <input
                  type="text"
                  value={formData.catalogNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, catalogNumber: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="CAT-12345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="vials, kits, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Size *</label>
                <input
                  type="number"
                  value={formData.unitSize}
                  onChange={(e) => setFormData(prev => ({ ...prev, unitSize: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                <input
                  type="number"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, stockQuantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                <input
                  type="number"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, reorderLevel: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Stock Level</label>
                <input
                  type="number"
                  value={formData.maxStockLevel}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxStockLevel: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Storage Temperature</label>
                <input
                  type="text"
                  value={formData.storageTemperature}
                  onChange={(e) => setFormData(prev => ({ ...prev, storageTemperature: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2-8°C"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description"
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
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editingReagent ? 'Update Reagent' : 'Add Reagent'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.open && deleteModal.reagent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Deactivate Reagent</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to deactivate <strong>{deleteModal.reagent.name}</strong>? This will mark it as inactive.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, reagent: null })}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Stock Modal */}
      {receiveModal.open && receiveModal.reagent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Receive Stock — {receiveModal.reagent.name}</h2>
              <button onClick={() => setReceiveModal({ open: false, reagent: null })} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number *</label>
                <input
                  type="text"
                  value={receiveForm.lotNumber}
                  onChange={e => setReceiveForm(p => ({ ...p, lotNumber: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="LOT-2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  value={receiveForm.quantity}
                  onChange={e => setReceiveForm(p => ({ ...p, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={receiveForm.expiryDate}
                  onChange={e => setReceiveForm(p => ({ ...p, expiryDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Per Unit ({CURRENCY_SYMBOL})</label>
                <input
                  type="number"
                  value={receiveForm.costPerUnit}
                  onChange={e => setReceiveForm(p => ({ ...p, costPerUnit: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={receiveForm.supplier}
                  onChange={e => setReceiveForm(p => ({ ...p, supplier: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Supplier name"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button
                onClick={() => setReceiveModal({ open: false, reagent: null })}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submitReceiveStock}
                disabled={receiveMutation.isPending}
                className="px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {receiveMutation.isPending ? 'Saving...' : 'Receive Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}