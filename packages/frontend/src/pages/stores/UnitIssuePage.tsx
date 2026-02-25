import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Send,
  Search,
  Plus,
  Trash2,
  FileText,
  Building2,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  Minus,
  X,
  Loader2,
} from 'lucide-react';
import { CURRENCY_SYMBOL } from '../../lib/currency';
import { storesService } from '../../services/stores';
import { facilitiesService } from '../../services/facilities';
import { useFacilityId } from '../../lib/facility';

interface IssueItem {
  id: string;
  name: string;
  sku: string;
  available: number;
  unit: string;
  quantity: number;
}

export default function UnitIssuePage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<IssueItem[]>([]);
  const [activeTab, setActiveTab] = useState<'issue' | 'pending' | 'history'>('issue');
  const [recipientName, setRecipientName] = useState('');

  // Load departments from API
  const { data: departmentsData = [] } = useQuery({
    queryKey: ['departments-list'],
    queryFn: () => facilitiesService.departments.listAll(),
    staleTime: 120000,
  });
  const departments = useMemo(() => departmentsData.map((d: any) => d.name), [departmentsData]);

  const { data: inventoryResponse, isLoading } = useQuery({
    queryKey: ['inventory-for-issue', searchTerm],
    queryFn: () => storesService.inventory.list({ search: searchTerm || undefined, limit: 50 }),
    staleTime: 30000,
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery({
    queryKey: ['stock-movements-out', facilityId],
    queryFn: () => storesService.movements.list(),
    staleTime: 30000,
  });

  const issuedHistory = useMemo(() => movements.filter(m => m.type === 'out'), [movements]);
  const pendingRequests = useMemo(() => movements.filter(m => m.type === 'in' && m.reason?.toLowerCase().includes('request')), [movements]);

  const issueMutation = useMutation({
    mutationFn: (items: { itemId: string; quantity: number; reason: string }[]) =>
      Promise.all(items.map(item => storesService.movements.adjust(item.itemId, { quantity: -item.quantity, type: 'out', reason: item.reason }))),
    onSuccess: () => {
      toast.success('Items issued successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-for-issue'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements-out'] });
      setCart([]);
    },
    onError: () => toast.error('Failed to issue items'),
  });

  const items = useMemo(() => (inventoryResponse?.data || []).map(inv => ({
    id: inv.id,
    name: inv.name,
    sku: inv.sku,
    available: inv.currentStock,
    unit: inv.unit,
  })), [inventoryResponse]);

  // Build item name lookup for history display
  const itemNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (inventoryResponse?.data || []).forEach(inv => { map[inv.id] = inv.name; });
    return map;
  }, [inventoryResponse]);

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, items]);

  const addToCart = (item: typeof items[0]) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(cart.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map((c) => {
      if (c.id === id) {
        const newQty = Math.max(1, Math.min(c.available, c.quantity + delta));
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.id !== id));
  };

  const handleIssue = () => {
    if (!selectedDepartment || cart.length === 0) return;
    issueMutation.mutate(cart.map(item => ({
      itemId: item.id,
      quantity: item.quantity,
      reason: `Issued to ${selectedDepartment}${recipientName ? ` (${recipientName})` : ''}`,
    })));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Issue to Units</h1>
          <p className="text-gray-600">Issue inventory items to departments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('history')}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-4 h-4" />
            View Vouchers
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('issue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'issue' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Send className="w-4 h-4 inline mr-2" />
          Issue Items
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'pending' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Pending Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">{pendingRequests.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Issue History
        </button>
      </div>

      {activeTab === 'issue' && (
        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
          {/* Left Panel - Item Selection */}
          <div className="col-span-2 bg-white border rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b flex-shrink-0">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Enter recipient name"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search items to issue..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Package className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="font-medium">No items available</p>
                  <p className="text-sm">Items will appear here once added to inventory</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => addToCart(item)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Package className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        Available: {item.available} {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Cart */}
          <div className="bg-white border rounded-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-gray-600" />
                <span className="font-medium">Issue Cart</span>
              </div>
              <span className="text-sm text-gray-500">{cart.length} items</span>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Package className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  <p>No items in cart</p>
                  <p className="text-sm">Click items to add</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-medium text-sm text-gray-900">{item.name}</p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Max: {item.available}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 border rounded hover:bg-gray-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-12 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 border rounded hover:bg-gray-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex-shrink-0 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
              </div>
              <button
                disabled={cart.length === 0 || !selectedDepartment || issueMutation.isPending}
                onClick={handleIssue}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {issueMutation.isPending ? 'Issuing...' : 'Issue Items'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <div className="px-4 py-12 text-center text-gray-500">
              <Clock className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="font-medium">No pending requests</p>
              <p className="text-sm">Requests from departments will appear here</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            {movementsLoading ? (
              <div className="flex items-center justify-center h-full py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reference</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reason</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Performed By</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {issuedHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="font-medium">No issue history</p>
                      <p className="text-sm">Issued items will appear here</p>
                    </td>
                  </tr>
                ) : (
                  issuedHistory.map((movement) => (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-blue-600">{movement.reference || movement.id.slice(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{itemNameMap[movement.itemId] || movement.itemId.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-red-600">{movement.quantity}</td>
                      <td className="px-4 py-3 text-gray-600">{movement.reason || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{movement.performedBy}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(movement.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
