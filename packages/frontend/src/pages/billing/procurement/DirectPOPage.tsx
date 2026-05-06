import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';
import { api } from '../../../services/api';
import { AlertCircle, Plus, Trash2, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../../lib/currency';

interface PurchaseOrderItem {
  id?: string;
  itemId: string;
  itemName: string;
  quantityOrdered: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
  lineTotal?: number;
}

interface DirectPOFormData {
  supplierId: string;
  departmentId?: string;
  costCenterId?: string;
  items: PurchaseOrderItem[];
  taxRate: number;
  discountPercent: number;
  emergencyJustification?: string;
  notes?: string;
}

export function DirectPOPage() {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState<DirectPOFormData>({
    supplierId: '',
    items: [],
      taxRate: 0,
      discountPercent: 0,
    });

    const [newItem, setNewItem] = useState<Omit<PurchaseOrderItem, 'id'>>({
      itemId: '',
      itemName: '',
      quantityOrdered: 1,
      unitPrice: 0,
      taxRate: 0,
      discountPercent: 0,
    });

    // Fetch suppliers
    const { data: suppliers = [], isLoading: suppliersLoading, isError: suppliersError } = useQuery({
      queryKey: ['suppliers'],
      queryFn: async () => {
        const { data } = await api.get('/suppliers');
        return Array.isArray(data) ? data : [];
      },
      retry: 1,
      enabled: !!user,
    });

    // Fetch items
    const { data: items = [], isLoading: itemsLoading, isError: itemsError } = useQuery({
      queryKey: ['items'],
      queryFn: async () => {
        const { data } = await api.get('/inventory/items');
        return Array.isArray(data) ? data : [];
      },
      retry: 1,
      enabled: !!user,
    });

    // Fetch departments
    const { data: departments = [], isLoading: departmentsLoading, isError: departmentsError } = useQuery({
      queryKey: ['departments'],
      queryFn: async () => {
        const { data } = await api.get('/departments');
        return Array.isArray(data) ? data : [];
      },
      retry: 1,
      enabled: !!user,
    });

    // Fetch budget
    const { data: budget, isLoading: budgetLoading, isError: budgetError } = useQuery({
      queryKey: ['procurement/budget'],
      queryFn: async () => {
        const { data } = await api.get('/procurement/approvals/summary');
        return data || {};
      },
      retry: 1,
      enabled: !!user,
    });

    const isLoading = suppliersLoading || itemsLoading || departmentsLoading || budgetLoading;
    const hasErrors = suppliersError || itemsError || departmentsError || budgetError;

  // Create Direct PO mutation
  const createPOMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/procurement/purchase-orders', {
        ...payload,
        type: 'DIRECT',
      });
      return data;
    },
    onSuccess: (data) => {
      alert(`Direct PO created: ${data.id}`);
      // Redirect to approval dashboard
      window.location.href = `/procurement/approvals`;
    },
    onError: (error: any) => {
      alert(`Error: ${error.response?.data?.message || error.message}`);
    },
  });

  // Calculate totals
  const subtotal = useMemo(() => {
    return formData.items.reduce((sum, item) => {
      return sum + (item.quantityOrdered * item.unitPrice * (1 - item.discountPercent / 100));
    }, 0);
  }, [formData.items]);

  const tax = useMemo(() => {
    return subtotal * (formData.taxRate / 100);
  }, [subtotal, formData.taxRate]);

  const total = useMemo(() => {
    return subtotal + tax;
  }, [subtotal, tax]);

  const handleAddItem = () => {
    if (!newItem.itemId || !newItem.quantityOrdered || !newItem.unitPrice) {
      alert('Please fill in all item fields');
      return;
    }

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          ...newItem,
          id: Math.random().toString(),
        },
      ],
    });

    setNewItem({
      itemId: '',
      itemName: '',
      quantityOrdered: 1,
      unitPrice: 0,
      taxRate: 0,
      discountPercent: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((item) => item.id !== id),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplierId) {
      alert('Please select a supplier');
      return;
    }

    if (formData.items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    if (total > 50000 && !formData.emergencyJustification) {
      alert('Emergency justification required for orders > $50,000');
      return;
    }

    createPOMutation.mutate({
      supplierId: formData.supplierId,
      departmentId: formData.departmentId,
      costCenterId: formData.costCenterId,
      items: formData.items,
      taxRate: formData.taxRate,
      discountPercent: formData.discountPercent,
      emergencyJustification: formData.emergencyJustification,
      notes: formData.notes,
    });
  };

  const approvalLevel = useMemo(() => {
    if (total < 500) return 'Manager';
    if (total < 5000) return 'Finance Officer';
    if (total < 50000) return 'Director';
    return 'CFO';
  }, [total]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (hasErrors) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Data</h2>
          <p className="text-gray-600 mb-6">
            There was an error loading the necessary data. Please try again or contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quick Purchase Order</h1>
          <p className="text-gray-600">Create a direct purchase order and submit for approval</p>
        </div>

        {/* Budget Alert */}
        {budget && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <DollarSign className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-blue-900">Budget Status</p>
              <p className="text-sm text-blue-700">
                Available: {formatCurrency(budget.budgetAvailable || 0)} / 
                Allocated: {formatCurrency(budget.budgetAllocated || 0)}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow">
          {/* Supplier Section */}
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Supplier</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier *
                </label>
                <select
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <select
                  value={formData.departmentId || ''}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select department...</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items</h2>

            {/* Add Item Form */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Item *</label>
                  <select
                    value={newItem.itemId}
                    onChange={(e) => {
                      const item = items.find((i: any) => i.id === e.target.value);
                      setNewItem({
                        ...newItem,
                        itemId: e.target.value,
                        itemName: item?.name || '',
                      });
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Select...</option>
                    {items.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Qty *</label>
                  <input
                    type="number"
                    value={newItem.quantityOrdered}
                    onChange={(e) =>
                      setNewItem({ ...newItem, quantityOrdered: parseInt(e.target.value) || 0 })
                    }
                    min="1"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit Price *</label>
                  <input
                    type="number"
                    value={newItem.unitPrice}
                    onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                    min="0"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tax %</label>
                  <input
                    type="number"
                    value={newItem.taxRate}
                    onChange={(e) => setNewItem({ ...newItem, taxRate: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    value={newItem.discountPercent}
                    onChange={(e) => setNewItem({ ...newItem, discountPercent: parseFloat(e.target.value) || 0 })}
                    min="0"
                    max="100"
                    step="0.01"
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    <Plus size={16} className="inline mr-1" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Items List */}
            {formData.items.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-900">Item</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-900">Qty</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-900">Unit Price</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-900">Tax %</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-900">Discount %</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-900">Line Total</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item) => {
                      const lineTotal = item.quantityOrdered * item.unitPrice * (1 - item.discountPercent / 100) * (1 + item.taxRate / 100);
                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-2">{item.itemName}</td>
                          <td className="px-4 py-2 text-right">{item.quantityOrdered}</td>
                          <td className="px-4 py-2 text-right">${item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{item.taxRate}%</td>
                          <td className="px-4 py-2 text-right">{item.discountPercent}%</td>
                          <td className="px-4 py-2 text-right font-medium">${lineTotal.toFixed(2)}</td>
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id!)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Charges & Justification Section */}
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Charges & Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tax Rate (%) *
                </label>
                <input
                  type="number"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount (%) *
                </label>
                <input
                  type="number"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {total > 50000 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emergency Justification * <span className="text-red-600">(Required for orders {'>'} $50,000)</span>
                </label>
                <textarea
                  value={formData.emergencyJustification || ''}
                  onChange={(e) => setFormData({ ...formData, emergencyJustification: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Explain why this purchase is urgent..."
                  required={total > 50000}
                />
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Additional notes (optional)..."
              />
            </div>
          </div>

          {/* Summary & Approval Level */}
          <div className="p-6 bg-gray-50 border-b">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h2>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax ({formData.taxRate}%):</span>
                <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-lg">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="font-bold text-blue-600">${total.toFixed(2)}</span>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">This order will require approval from:</p>
              <p className="text-lg font-semibold text-blue-900">{approvalLevel}</p>
              {total >= 50000 && (
                <p className="text-xs text-gray-600 mt-2">💡 Approval chain: Manager → Finance → Director → CFO</p>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="p-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPOMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {createPOMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
