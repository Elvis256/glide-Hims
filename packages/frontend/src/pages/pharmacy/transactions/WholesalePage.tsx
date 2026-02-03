import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Building2,
  Package,
  Plus,
  Minus,
  Trash2,
  FileText,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  Percent,
  X,
  Send,
  DollarSign,
  Calendar,
  User,
  Phone,
  MapPin,
  TrendingUp,
  Eye,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import { pharmacyService } from '../../../services/pharmacy';
import type { CreatePharmacySaleDto, CreateSaleItemDto, PharmacySale } from '../../../services/pharmacy';
import { storesService } from '../../../services/stores';
import type { InventoryItem } from '../../../services/stores';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';

interface Facility {
  id: string;
  name: string;
  type: string;
  contact: string;
  phone: string;
  address: string;
  creditLimit: number;
  creditUsed: number;
  creditTerms: number; // days
}

interface Product {
  id: string;
  name: string;
  genericName: string;
  category: string;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  unit: string;
  minOrder: number;
}

interface OrderItem extends Product {
  quantity: number;
  discount: number;
}

interface Invoice {
  id: string;
  facility: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  dueDate: string;
  paidAmount: number;
}

const statusColors = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  overdue: 'bg-red-100 text-red-800',
};

export default function WholesalePage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.transactions')) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)] bg-gray-50">
        <div className="text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('credit');
  const [showInvoice, setShowInvoice] = useState(false);
  const [volumeDiscount, setVolumeDiscount] = useState(0);
  const [activeTab, setActiveTab] = useState<'order' | 'invoices'>('order');

  // Fetch products from inventory
  const { data: inventoryData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['wholesale-products', productSearch],
    queryFn: () => storesService.inventory.list({ search: productSearch || undefined }),
  });

  // Fetch wholesale sales (invoices)
  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ['wholesale-sales'],
    queryFn: () => pharmacyService.sales.list({ limit: 50 }),
    select: (data) => data.filter((sale: PharmacySale) => sale.saleType === 'wholesale'),
  });

  // Create wholesale sale mutation
  const createSaleMutation = useMutation({
    mutationFn: (data: CreatePharmacySaleDto) => pharmacyService.sales.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesale-sales'] });
      setShowInvoice(true);
    },
  });

  // Transform inventory to products
  const products: Product[] = useMemo(() => {
    if (!inventoryData?.data) return [];
    return inventoryData.data.map((item: InventoryItem) => ({
      id: item.id,
      name: item.name,
      genericName: item.name,
      category: item.category,
      retailPrice: (item.unitCost || 0) * 1.3,
      wholesalePrice: item.unitCost || 0,
      stock: item.currentStock,
      unit: item.unit,
      minOrder: 10,
    }));
  }, [inventoryData]);

  // Transform sales to invoices
  const invoices: Invoice[] = useMemo(() => {
    if (!salesData) return [];
    return salesData.map((sale: PharmacySale) => ({
      id: sale.saleNumber,
      facility: sale.customerName || 'Unknown Facility',
      date: new Date(sale.createdAt).toLocaleDateString(),
      amount: sale.totalAmount,
      status: sale.status === 'completed' ? 'paid' as const : 'pending' as const,
      dueDate: new Date(new Date(sale.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      paidAmount: sale.amountPaid,
    }));
  }, [salesData]);

  // Static facilities for now (could be fetched from an API)
  const mockFacilities: Facility[] = [];

  const filteredFacilities = useMemo(() => {
    if (!searchTerm) return mockFacilities;
    const search = searchTerm.toLowerCase();
    return mockFacilities.filter(
      (f) =>
        f.name.toLowerCase().includes(search) ||
        f.type.toLowerCase().includes(search) ||
        f.contact.toLowerCase().includes(search)
    );
  }, [searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const search = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.genericName.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search)
    );
  }, [productSearch, products]);

  const addToOrder = (product: Product) => {
    setOrderItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + product.minOrder } : item
        );
      }
      return [...prev, { ...product, quantity: product.minOrder, discount: 0 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(item.minOrder, item.quantity + delta) } : item
        )
    );
  };

  const updateItemDiscount = (id: string, discount: number) => {
    setOrderItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, discount: Math.min(30, Math.max(0, discount)) } : item))
    );
  };

  const removeFromOrder = (id: string) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const itemTotal = item.wholesalePrice * item.quantity;
      const itemDiscount = (itemTotal * item.discount) / 100;
      return sum + (itemTotal - itemDiscount);
    }, 0);
  }, [orderItems]);

  const totalVolumeDiscount = useMemo(() => (subtotal * volumeDiscount) / 100, [subtotal, volumeDiscount]);
  const grandTotal = useMemo(() => subtotal - totalVolumeDiscount, [subtotal, totalVolumeDiscount]);

  const handleGenerateInvoice = () => {
    if (!selectedFacility || orderItems.length === 0) return;
    
    const saleItems: CreateSaleItemDto[] = orderItems.map((item) => ({
      itemId: item.id,
      itemCode: item.id,
      itemName: item.name,
      quantity: item.quantity,
      unitPrice: item.wholesalePrice,
      discountPercent: item.discount,
    }));

    const saleData: CreatePharmacySaleDto = {
      storeId: 'default-store',
      saleType: 'wholesale',
      customerName: selectedFacility.name,
      customerPhone: selectedFacility.phone,
      paymentMethod: paymentType === 'credit' ? 'credit' : 'cash',
      discountAmount: totalVolumeDiscount,
      items: saleItems,
    };

    createSaleMutation.mutate(saleData);
  };

  const handleNewOrder = () => {
    setOrderItems([]);
    setSelectedFacility(null);
    setVolumeDiscount(0);
    setShowInvoice(false);
  };

  // Summary calculations
  const summary = useMemo(() => {
    const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
    const overdueAmount = invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
    return { totalOutstanding, overdueAmount, invoiceCount: invoices.length };
  }, [invoices]);

  const isProcessing = createSaleMutation.isPending;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wholesale Sales</h1>
          <p className="text-gray-600">Bulk sales to facilities</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
            <p className="text-xs text-orange-700">Outstanding</p>
            <p className="text-lg font-bold text-orange-900">{formatCurrency(summary.totalOutstanding)}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <p className="text-xs text-red-700">Overdue</p>
            <p className="text-lg font-bold text-red-900">{formatCurrency(summary.overdueAmount)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('order')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'order' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Package className="w-4 h-4 inline-block mr-2" />
          New Order
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'invoices' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4 inline-block mr-2" />
          Invoices & Payments
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'order' ? (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Facilities Panel */}
            <div className="col-span-3 bg-white rounded-lg shadow flex flex-col min-h-0">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Select Facility
                </h3>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search facilities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredFacilities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Building2 className="w-12 h-12 mb-2" />
                    <p>No facilities found</p>
                  </div>
                ) : (
                  filteredFacilities.map((facility) => (
                    <div
                      key={facility.id}
                      onClick={() => setSelectedFacility(facility)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedFacility?.id === facility.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{facility.name}</p>
                          <p className="text-xs text-gray-500">{facility.type}</p>
                        </div>
                        <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{facility.creditTerms}d</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Credit Used</span>
                          <span className="font-medium">
                            {((facility.creditUsed / facility.creditLimit) * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div
                            className={`h-1.5 rounded-full ${
                              facility.creditUsed / facility.creditLimit > 0.8 ? 'bg-red-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${(facility.creditUsed / facility.creditLimit) * 100}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatCurrency(facility.creditLimit - facility.creditUsed)} available
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Products Panel */}
            <div className="col-span-5 bg-white rounded-lg shadow flex flex-col min-h-0">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-gray-900 mb-2">Products (Wholesale Pricing)</h3>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {isLoadingProducts ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Loader2 className="w-12 h-12 mb-2 animate-spin" />
                    <p>Loading products...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Package className="w-12 h-12 mb-2" />
                    <p>No products available</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Product</th>
                        <th className="text-right p-2">Price</th>
                        <th className="text-right p-2">Stock</th>
                        <th className="text-center p-2">Min</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.unit}</p>
                          </td>
                          <td className="text-right p-2">
                            <p className="font-semibold text-green-600">{formatCurrency(product.wholesalePrice)}</p>
                            <p className="text-xs text-gray-400 line-through">{formatCurrency(product.retailPrice)}</p>
                          </td>
                          <td className="text-right p-2 text-gray-600">{product.stock.toLocaleString()}</td>
                          <td className="text-center p-2 text-gray-600">{product.minOrder}</td>
                          <td className="p-2">
                            <button
                              onClick={() => addToOrder(product)}
                              disabled={!selectedFacility}
                              className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Order Panel */}
            <div className="col-span-4 bg-white rounded-lg shadow flex flex-col min-h-0">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-gray-900">Order Summary</h3>
              </div>

              {/* Selected Facility Info */}
              {selectedFacility && (
                <div className="p-3 border-b bg-blue-50">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{selectedFacility.name}</p>
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <User className="w-3 h-3" /> {selectedFacility.contact}
                      </p>
                      <p className="text-xs text-gray-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {selectedFacility.phone}
                      </p>
                    </div>
                    <button onClick={() => setSelectedFacility(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div className="flex-1 overflow-y-auto p-2">
                {!selectedFacility ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Building2 className="w-12 h-12 mb-2" />
                    <p>Select a facility first</p>
                  </div>
                ) : orderItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Package className="w-12 h-12 mb-2" />
                    <p>Add products to order</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orderItems.map((item) => (
                      <div key={item.id} className="p-2 border rounded-lg bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                            <p className="text-xs text-gray-500">{formatCurrency(item.wholesalePrice)} / {item.unit}</p>
                          </div>
                          <button onClick={() => removeFromOrder(item.id)} className="text-red-500 p-1 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantity(item.id, -item.minOrder)}
                              className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.minOrder)}
                              className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Percent className="w-3 h-3 text-gray-400" />
                              <input
                                type="number"
                                min="0"
                                max="30"
                                value={item.discount}
                                onChange={(e) => updateItemDiscount(item.id, parseInt(e.target.value) || 0)}
                                className="w-10 px-1 py-0.5 text-xs border rounded text-center"
                              />
                            </div>
                            <span className="text-sm font-semibold text-green-600">
                              {formatCurrency((item.wholesalePrice * item.quantity) * (1 - item.discount / 100))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Type & Totals */}
              {orderItems.length > 0 && (
                <div className="p-3 border-t bg-gray-50">
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setPaymentType('credit')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${
                        paymentType === 'credit' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Clock className="w-4 h-4" /> Credit
                    </button>
                    <button
                      onClick={() => setPaymentType('cash')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${
                        paymentType === 'cash' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      <CreditCard className="w-4 h-4" /> Cash/Card
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Volume Discount</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={volumeDiscount}
                        onChange={(e) => setVolumeDiscount(parseInt(e.target.value) || 0)}
                        className="w-12 px-1 py-0.5 text-xs border rounded text-center"
                      />
                      <span className="text-gray-600">%</span>
                    </div>
                    <span className="text-red-600">-{formatCurrency(totalVolumeDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span className="text-green-600">{formatCurrency(grandTotal)}</span>
                  </div>
                  {paymentType === 'credit' && selectedFacility && (
                    <p className="text-xs text-gray-500 mt-1">
                      Due in {selectedFacility.creditTerms} days
                    </p>
                  )}
                  <button
                    onClick={handleGenerateInvoice}
                    disabled={isProcessing}
                    className="w-full mt-3 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                    {isProcessing ? 'Processing...' : 'Generate Invoice'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Invoices Tab */
          <div className="bg-white rounded-lg shadow h-full flex flex-col min-h-0">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Invoices & Payment Tracking</h3>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  <span>Paid</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  <span>Overdue</span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingSales ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Loader2 className="w-12 h-12 mb-2 animate-spin" />
                  <p>Loading invoices...</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FileText className="w-12 h-12 mb-2" />
                  <p>No invoices yet</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-4">Invoice #</th>
                      <th className="text-left p-4">Facility</th>
                      <th className="text-left p-4">Date</th>
                      <th className="text-left p-4">Due Date</th>
                      <th className="text-right p-4">Amount</th>
                      <th className="text-right p-4">Paid</th>
                      <th className="text-right p-4">Balance</th>
                      <th className="text-center p-4">Status</th>
                      <th className="text-center p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 font-medium">{invoice.id}</td>
                        <td className="p-4">{invoice.facility}</td>
                        <td className="p-4 text-gray-600">{invoice.date}</td>
                        <td className="p-4 text-gray-600">{invoice.dueDate}</td>
                        <td className="p-4 text-right font-medium">{formatCurrency(invoice.amount)}</td>
                        <td className="p-4 text-right text-green-600">{formatCurrency(invoice.paidAmount)}</td>
                        <td className="p-4 text-right font-medium text-orange-600">
                          {formatCurrency(invoice.amount - invoice.paidAmount)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${statusColors[invoice.status]}`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">
                              <Eye className="w-4 h-4" />
                            </button>
                            {invoice.status !== 'paid' && (
                              <button className="p-1.5 bg-green-100 text-green-600 rounded hover:bg-green-200">
                                <DollarSign className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {showInvoice && selectedFacility && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Invoice Generated</h3>
              <button onClick={() => setShowInvoice(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="text-center mb-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="font-bold text-lg">Invoice Created!</p>
                <p className="text-gray-600 text-sm">INV-{Date.now().toString().slice(-6)}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium">{selectedFacility.name}</p>
                    <p className="text-sm text-gray-600">{selectedFacility.address}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-dashed pt-3 space-y-2 mb-3">
                {orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{formatCurrency((item.wholesalePrice * item.quantity) * (1 - item.discount / 100))}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed pt-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalVolumeDiscount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Volume Discount ({volumeDiscount}%)</span>
                    <span>-{formatCurrency(totalVolumeDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <p className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Payment: {paymentType === 'credit' ? `Due in ${selectedFacility.creditTerms} days` : 'Immediate'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  Print Invoice
                </button>
                <button className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  Email
                </button>
              </div>
              <button
                onClick={handleNewOrder}
                className="w-full mt-2 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200"
              >
                New Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
