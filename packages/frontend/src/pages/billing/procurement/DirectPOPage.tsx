import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth';
import { api } from '../../../services/api';
import {
  AlertCircle,
  Plus,
  Trash2,
  DollarSign,
  ShoppingCart,
  ClipboardList,
  Receipt,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/currency';
import SearchableSelect, { SelectOption } from '../../../components/SearchableSelect';
import {
  CategoryContextBanner,
  useProcurementCategory,
} from '../../../components/procurement/CategoryContextBanner';

interface PurchaseOrderItem {
  id?: string;
  itemId: string;
  itemName: string;
  itemCode?: string;
  quantityOrdered: number;
  unitPrice: number;
  taxRate: number;
  discountPercent: number;
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

const lineTotalOf = (i: Pick<PurchaseOrderItem, 'quantityOrdered' | 'unitPrice' | 'taxRate' | 'discountPercent'>) =>
  i.quantityOrdered * i.unitPrice * (1 - i.discountPercent / 100) * (1 + i.taxRate / 100);

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
    itemCode: '',
    quantityOrdered: 1,
    unitPrice: 0,
    taxRate: 0,
    discountPercent: 0,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const { data: suppliers = [], isLoading: suppliersLoading, isError: suppliersError } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await api.get('/suppliers');
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return list;
    },
    retry: 1,
    enabled: !!user,
  });

  const { isDrug } = useProcurementCategory();

  const { data: items = [], isLoading: itemsLoading, isError: itemsError } = useQuery({
    queryKey: ['items', { isDrug }],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (isDrug !== undefined) qs.set('isDrug', String(isDrug));
      const url = qs.toString() ? `/inventory/items?${qs}` : '/inventory/items';
      const { data } = await api.get(url);
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return list;
    },
    retry: 1,
    enabled: !!user,
  });

  const { data: departments = [], isLoading: departmentsLoading, isError: departmentsError } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get('/departments');
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      return list;
    },
    retry: 1,
    enabled: !!user,
  });

  const { data: budget } = useQuery({
    queryKey: ['procurement/budget'],
    queryFn: async () => {
      const { data } = await api.get('/procurement/approvals/summary');
      return data || {};
    },
    retry: 1,
    enabled: !!user,
  });

  const isLoading = suppliersLoading || itemsLoading || departmentsLoading;
  const hasErrors = suppliersError || itemsError || departmentsError;

  const supplierOptions: SelectOption[] = useMemo(
    () =>
      (suppliers as any[]).map((s) => ({
        value: s.id,
        label: s.name,
        prefix: s.code ? `[${s.code}]` : undefined,
      })),
    [suppliers],
  );

  const departmentOptions: SelectOption[] = useMemo(
    () => (departments as any[]).map((d) => ({ value: d.id, label: d.name })),
    [departments],
  );

  const itemOptions: SelectOption[] = useMemo(
    () =>
      (items as any[]).map((i) => ({
        value: i.id,
        label: i.name,
        prefix: i.code ? `[${i.code}]` : undefined,
      })),
    [items],
  );

  const createPOMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/procurement/purchase-orders', {
        ...payload,
        type: 'DIRECT',
      });
      return data;
    },
    onSuccess: (data) => {
      setSubmitMessage({ kind: 'success', text: `Direct PO ${data?.id ?? ''} created. Redirecting…` });
      setTimeout(() => {
        window.location.href = `/procurement/approvals`;
      }, 1200);
    },
    onError: (error: any) => {
      setSubmitMessage({
        kind: 'error',
        text: error?.response?.data?.message || error?.message || 'Failed to create PO',
      });
    },
  });

  const subtotal = useMemo(
    () =>
      formData.items.reduce(
        (sum, item) => sum + item.quantityOrdered * item.unitPrice * (1 - item.discountPercent / 100),
        0,
      ),
    [formData.items],
  );
  const tax = useMemo(() => subtotal * (formData.taxRate / 100), [subtotal, formData.taxRate]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);

  const newItemLineTotal = useMemo(() => (newItem.itemId ? lineTotalOf(newItem) : 0), [newItem]);

  const approvalLevel = useMemo(() => {
    if (total < 500) return 'Manager';
    if (total < 5000) return 'Finance Officer';
    if (total < 50000) return 'Director';
    return 'CFO';
  }, [total]);

  const handleAddItem = () => {
    if (!newItem.itemId) {
      setFormError('Select an item before adding');
      return;
    }
    if (!newItem.quantityOrdered || newItem.quantityOrdered <= 0) {
      setFormError('Quantity must be greater than zero');
      return;
    }
    if (newItem.unitPrice <= 0) {
      setFormError('Unit price must be greater than zero');
      return;
    }
    setFormError(null);

    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { ...newItem, id: Math.random().toString(36).slice(2) }],
    }));

    setNewItem({
      itemId: '',
      itemName: '',
      itemCode: '',
      quantityOrdered: 1,
      unitPrice: 0,
      taxRate: 0,
      discountPercent: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);

    if (!formData.supplierId) {
      setFormError('Please select a supplier');
      return;
    }
    if (formData.items.length === 0) {
      setFormError('Add at least one item to the order');
      return;
    }
    if (total > 50000 && !formData.emergencyJustification?.trim()) {
      setFormError('Emergency justification is required for orders over 50,000');
      return;
    }
    setFormError(null);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto text-blue-600 animate-spin" />
          <p className="mt-4 text-gray-600">Loading data…</p>
        </div>
      </div>
    );
  }

  if (hasErrors) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Data</h2>
          <p className="text-gray-600 mb-6">
            There was an error loading suppliers, items or departments. Please try again or contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  const noItemsAvailable = (items as any[]).length === 0;
  const noSuppliersAvailable = (suppliers as any[]).length === 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <CategoryContextBanner />
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="text-blue-600" size={28} />
              Quick Purchase Order
            </h1>
            <p className="text-gray-600 mt-1">Create a direct purchase order and submit it for approval</p>
          </div>
          {budget && (
            <div className="bg-white border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm">
              <DollarSign className="text-blue-600 shrink-0" size={20} />
              <div className="text-sm">
                <div className="font-medium text-gray-900">Budget</div>
                <div className="text-gray-600">
                  Available <span className="font-semibold text-blue-700">{formatCurrency(budget.budgetAvailable || 0)}</span>{' '}
                  / {formatCurrency(budget.budgetAllocated || 0)}
                </div>
              </div>
            </div>
          )}
        </div>

        {(noItemsAvailable || noSuppliersAvailable) && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-amber-800">
              {noSuppliersAvailable && <div>No suppliers found. Add suppliers in the Procurement → Suppliers page first.</div>}
              {noItemsAvailable && <div>No inventory items found. Add items in Stores → Inventory before creating an order.</div>}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200">
            <header className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <ClipboardList size={18} className="text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Supplier &amp; Department</h2>
            </header>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={supplierOptions}
                  value={formData.supplierId}
                  onChange={(v) => setFormData({ ...formData, supplierId: v })}
                  placeholder="Search suppliers…"
                  noOptionsText="No suppliers match"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <SearchableSelect
                  options={departmentOptions}
                  value={formData.departmentId || ''}
                  onChange={(v) => setFormData({ ...formData, departmentId: v || undefined })}
                  placeholder="Search departments…"
                  noOptionsText="No departments match"
                />
              </div>
            </div>
          </section>

          {/* Items */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200">
            <header className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-gray-500" />
                <h2 className="text-base font-semibold text-gray-900">Items</h2>
              </div>
              <span className="text-xs text-gray-500">
                {formData.items.length} item{formData.items.length === 1 ? '' : 's'} added
              </span>
            </header>

            <div className="p-6 space-y-4">
              {/* Add row */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Item <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={itemOptions}
                      value={newItem.itemId}
                      onChange={(v) => {
                        const item = (items as any[]).find((i) => i.id === v);
                        setNewItem({
                          ...newItem,
                          itemId: v,
                          itemName: item?.name || '',
                          itemCode: item?.code || '',
                          unitPrice:
                            newItem.unitPrice ||
                            Number(item?.lastPurchasePrice ?? item?.unitPrice ?? 0) ||
                            0,
                        });
                      }}
                      placeholder="Search items by name or code…"
                      noOptionsText="No items match"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Qty <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={newItem.quantityOrdered}
                      onChange={(e) =>
                        setNewItem({ ...newItem, quantityOrdered: parseInt(e.target.value) || 0 })
                      }
                      min={1}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Unit Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={newItem.unitPrice}
                      onChange={(e) =>
                        setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })
                      }
                      step="0.01"
                      min={0}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tax %</label>
                    <input
                      type="number"
                      value={newItem.taxRate}
                      onChange={(e) =>
                        setNewItem({ ...newItem, taxRate: parseFloat(e.target.value) || 0 })
                      }
                      min={0}
                      max={100}
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Disc %</label>
                    <input
                      type="number"
                      value={newItem.discountPercent}
                      onChange={(e) =>
                        setNewItem({ ...newItem, discountPercent: parseFloat(e.target.value) || 0 })
                      }
                      min={0}
                      max={100}
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Line Total</label>
                    <div className="px-2 py-1.5 border border-dashed border-gray-300 rounded text-sm bg-white text-gray-700 font-medium truncate">
                      {formatCurrency(newItemLineTotal)}
                    </div>
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!newItem.itemId}
                      className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                </div>
                {formError && (
                  <div className="mt-3 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {formError}
                  </div>
                )}
              </div>

              {/* Items list */}
              {formData.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm border border-dashed border-gray-300 rounded-lg">
                  No items added yet. Use the form above to add line items.
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Item</th>
                        <th className="px-4 py-2 text-right font-medium">Qty</th>
                        <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                        <th className="px-4 py-2 text-right font-medium">Tax %</th>
                        <th className="px-4 py-2 text-right font-medium">Disc %</th>
                        <th className="px-4 py-2 text-right font-medium">Line Total</th>
                        <th className="px-4 py-2 text-center font-medium w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item) => (
                        <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-900">{item.itemName}</div>
                            {item.itemCode && <div className="text-xs text-gray-500">{item.itemCode}</div>}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{item.quantityOrdered}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{item.taxRate}%</td>
                          <td className="px-4 py-2 text-right tabular-nums">{item.discountPercent}%</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">
                            {formatCurrency(lineTotalOf(item))}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id!)}
                              className="text-red-600 hover:text-red-800"
                              aria-label="Remove item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Charges */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200">
            <header className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Charges &amp; Notes</h2>
            </header>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                    min={0}
                    max={100}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onFocus={(e) => e.currentTarget.select()}
                    />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount (%)</label>
                  <input
                    type="number"
                    value={formData.discountPercent}
                    onChange={(e) =>
                      setFormData({ ...formData, discountPercent: parseFloat(e.target.value) || 0 })
                    }
                    min={0}
                    max={100}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onFocus={(e) => e.currentTarget.select()}
                    />
                </div>
              </div>

              {total > 50000 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Justification <span className="text-red-600">(required for orders over 50,000)</span>
                  </label>
                  <textarea
                    value={formData.emergencyJustification || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyJustification: e.target.value })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Explain why this purchase is urgent…"
                    required={total > 50000}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes (optional)…"
                />
              </div>
            </div>
          </section>

          {/* Summary */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200">
            <header className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Order Summary</h2>
            </header>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax ({formData.taxRate}%)</span>
                  <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(tax)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between text-lg">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-blue-600 tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Approval required from</p>
                <p className="text-lg font-semibold text-blue-900">{approvalLevel}</p>
                {total >= 50000 && (
                  <p className="text-xs text-gray-600 mt-2">
                    💡 Approval chain: Manager → Finance → Director → CFO
                  </p>
                )}
              </div>
            </div>
          </section>

          {submitMessage && (
            <div
              className={`p-4 rounded-lg border flex items-start gap-2 ${
                submitMessage.kind === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {submitMessage.kind === 'success' ? (
                <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
              )}
              <span className="text-sm">{submitMessage.text}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createPOMutation.isPending || formData.items.length === 0 || !formData.supplierId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {createPOMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {createPOMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DirectPOPage;
