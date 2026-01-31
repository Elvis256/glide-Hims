import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  User,
  Receipt,
  Percent,
  X,
  CheckCircle,
  Package,
  TrendingUp,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { pharmacyService } from '../../../services/pharmacy';
import type { CreatePharmacySaleDto, CreateSaleItemDto, PharmacySale } from '../../../services/pharmacy';
import { storesService } from '../../../services/stores';
import type { InventoryItem } from '../../../services/stores';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';

interface Product {
  id: string;
  name: string;
  genericName: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
}

interface CartItem extends Product {
  quantity: number;
  discount: number;
}

export default function RetailSalesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);

  // Fetch products from inventory
  const { data: inventoryData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['retail-products', searchTerm],
    queryFn: () => storesService.inventory.list({ search: searchTerm || undefined }),
  });

  // Fetch recent sales
  const { data: salesData, isLoading: isLoadingSales } = useQuery({
    queryKey: ['retail-sales'],
    queryFn: () => pharmacyService.sales.list({ limit: 10 }),
  });

  // Fetch daily summary
  const { data: dailySummaryData } = useQuery({
    queryKey: ['daily-sales-summary'],
    queryFn: () => pharmacyService.sales.getDailySummary(),
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: (data: CreatePharmacySaleDto) => pharmacyService.sales.create(data),
    onSuccess: (sale) => {
      // Complete the sale immediately
      completeSaleMutation.mutate({
        saleId: sale.id,
        data: {
          amountPaid: grandTotal,
          paymentMethod: paymentMethod === 'mobile' ? 'mobile_money' : paymentMethod,
        },
      });
    },
  });

  // Complete sale mutation
  const completeSaleMutation = useMutation({
    mutationFn: ({ saleId, data }: { saleId: string; data: { amountPaid: number; paymentMethod: 'cash' | 'card' | 'mobile_money' | 'insurance' | 'credit' } }) =>
      pharmacyService.sales.complete(saleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retail-sales'] });
      queryClient.invalidateQueries({ queryKey: ['daily-sales-summary'] });
      setShowReceipt(true);
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
      price: item.unitCost || 0,
      stock: item.currentStock,
      unit: item.unit,
    }));
  }, [inventoryData]);

  // Transform sales data
  const recentSales = useMemo(() => {
    if (!salesData) return [];
    return salesData.map((sale: PharmacySale) => ({
      id: sale.saleNumber,
      items: sale.items.length,
      total: sale.totalAmount,
      paymentMethod: sale.paymentMethod || 'Cash',
      time: new Date(sale.createdAt).toLocaleTimeString(),
      customer: sale.customerName,
    }));
  }, [salesData]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const search = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.genericName.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search)
    );
  }, [searchTerm, products]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const updateItemDiscount = (id: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, discount: Math.min(100, Math.max(0, discount)) } : item))
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const itemDiscount = (itemTotal * item.discount) / 100;
      return sum + (itemTotal - itemDiscount);
    }, 0);
  }, [cart]);

  const totalDiscount = useMemo(() => (subtotal * globalDiscount) / 100, [subtotal, globalDiscount]);
  const grandTotal = useMemo(() => subtotal - totalDiscount, [subtotal, totalDiscount]);

  const handleCheckout = () => {
    if (cart.length === 0) return;
    
    const saleItems: CreateSaleItemDto[] = cart.map((item) => ({
      itemId: item.id,
      itemCode: item.id,
      itemName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      discountPercent: item.discount,
    }));

    const saleData: CreatePharmacySaleDto = {
      storeId: 'default-store',
      saleType: 'walk-in',
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      discountAmount: totalDiscount,
      items: saleItems,
    };

    createSaleMutation.mutate(saleData);
  };

  const handleNewSale = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setGlobalDiscount(0);
    setShowReceipt(false);
  };

  // Daily summary calculations
  const dailySummary = useMemo(() => {
    if (dailySummaryData) {
      return {
        totalSales: dailySummaryData.totalAmount || 0,
        cashSales: dailySummaryData.byPaymentMethod?.cash || 0,
        cardSales: dailySummaryData.byPaymentMethod?.card || 0,
        mobileSales: dailySummaryData.byPaymentMethod?.mobile_money || 0,
        transactionCount: dailySummaryData.totalSales || 0,
      };
    }
    const totalSales = recentSales.reduce((sum, sale) => sum + sale.total, 0);
    const cashSales = recentSales.filter((s) => s.paymentMethod === 'Cash' || s.paymentMethod === 'cash').reduce((sum, s) => sum + s.total, 0);
    const cardSales = recentSales.filter((s) => s.paymentMethod === 'Card' || s.paymentMethod === 'card').reduce((sum, s) => sum + s.total, 0);
    const mobileSales = recentSales.filter((s) => s.paymentMethod === 'Mobile' || s.paymentMethod === 'mobile_money').reduce((sum, s) => sum + s.total, 0);
    return { totalSales, cashSales, cardSales, mobileSales, transactionCount: recentSales.length };
  }, [dailySummaryData, recentSales]);

  const isProcessing = createSaleMutation.isPending || completeSaleMutation.isPending;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retail Sales</h1>
          <p className="text-gray-600">Over-the-counter sales</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="text-xs text-green-700">Today's Sales</p>
            <p className="text-lg font-bold text-green-900">{formatCurrency(dailySummary.totalSales)}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <p className="text-xs text-blue-700">Transactions</p>
            <p className="text-lg font-bold text-blue-900">{dailySummary.transactionCount}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* Products Panel */}
        <div className="col-span-5 bg-white rounded-lg shadow flex flex-col min-h-0">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="grid grid-cols-2 gap-2">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.genericName}</p>
                      </div>
                      <Plus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(product.price)}</span>
                      <span className="text-xs text-gray-500">{product.stock} in stock</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="col-span-4 bg-white rounded-lg shadow flex flex-col min-h-0">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <h2 className="font-semibold text-gray-900">Cart ({cart.length})</h2>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-red-600 text-sm hover:underline">
                Clear
              </button>
            )}
          </div>

          {/* Customer Info */}
          <div className="p-3 border-b bg-gray-50">
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <User className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Customer name (optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Phone (optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ShoppingCart className="w-12 h-12 mb-2" />
                <p>Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="p-2 border rounded-lg bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(item.price)} / {item.unit}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-500 p-1 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
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
                            max="100"
                            value={item.discount}
                            onChange={(e) => updateItemDiscount(item.id, parseInt(e.target.value) || 0)}
                            className="w-12 px-1 py-0.5 text-xs border rounded text-center"
                          />
                        </div>
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency((item.price * item.quantity) * (1 - item.discount / 100))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Totals */}
          {cart.length > 0 && (
            <div className="p-3 border-t bg-gray-50">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-2">
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">Discount</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(parseInt(e.target.value) || 0)}
                    className="w-12 px-1 py-0.5 text-xs border rounded text-center"
                  />
                  <span className="text-gray-600">%</span>
                </div>
                <span className="text-red-600">-{formatCurrency(totalDiscount)}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span className="text-green-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment & Summary Panel */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          {/* Payment Methods */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'cash' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Banknote className={`w-6 h-6 ${paymentMethod === 'cash' ? 'text-green-600' : 'text-gray-500'}`} />
                <span className="text-xs font-medium">Cash</span>
              </button>
              <button
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'card' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <CreditCard className={`w-6 h-6 ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="text-xs font-medium">Card</span>
              </button>
              <button
                onClick={() => setPaymentMethod('mobile')}
                className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'mobile' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Smartphone className={`w-6 h-6 ${paymentMethod === 'mobile' ? 'text-purple-600' : 'text-gray-500'}`} />
                <span className="text-xs font-medium">Mobile</span>
              </button>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="w-full mt-4 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
              {isProcessing ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>

          {/* Daily Summary */}
          <div className="bg-white rounded-lg shadow p-4 flex-1 overflow-hidden flex flex-col min-h-0">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Daily Summary
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <Banknote className="w-4 h-4 text-green-600 mx-auto" />
                <p className="text-xs text-green-700 mt-1">Cash</p>
                <p className="font-semibold text-green-900 text-sm">{formatCurrency(dailySummary.cashSales)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <CreditCard className="w-4 h-4 text-blue-600 mx-auto" />
                <p className="text-xs text-blue-700 mt-1">Card</p>
                <p className="font-semibold text-blue-900 text-sm">{formatCurrency(dailySummary.cardSales)}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <Smartphone className="w-4 h-4 text-purple-600 mx-auto" />
                <p className="text-xs text-purple-700 mt-1">Mobile</p>
                <p className="font-semibold text-purple-900 text-sm">{formatCurrency(dailySummary.mobileSales)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <DollarSign className="w-4 h-4 text-gray-600 mx-auto" />
                <p className="text-xs text-gray-700 mt-1">Total</p>
                <p className="font-semibold text-gray-900 text-sm">{formatCurrency(dailySummary.totalSales)}</p>
              </div>
            </div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Sales</h4>
            <div className="flex-1 overflow-y-auto space-y-1">
              {isLoadingSales ? (
                <div className="flex flex-col items-center justify-center py-4 text-gray-400">
                  <Loader2 className="w-8 h-8 mb-1 animate-spin" />
                  <p className="text-xs">Loading sales...</p>
                </div>
              ) : recentSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-gray-400">
                  <Receipt className="w-8 h-8 mb-1" />
                  <p className="text-xs">No sales yet</p>
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                    <div>
                      <span className="font-medium">{sale.id}</span>
                      <span className="text-gray-500 ml-2">{sale.time}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(sale.total)}</p>
                      <p className="text-gray-500">{sale.paymentMethod}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-96 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Receipt</h3>
              <button onClick={() => setShowReceipt(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="text-center mb-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                <p className="font-bold text-lg">Sale Complete!</p>
                <p className="text-gray-600 text-sm">Receipt #REC-{Date.now().toString().slice(-6)}</p>
              </div>
              <div className="border-t border-dashed pt-3 mb-3">
                {customerName && <p className="text-sm">Customer: {customerName}</p>}
                {customerPhone && <p className="text-sm text-gray-600">Phone: {customerPhone}</p>}
                <p className="text-sm text-gray-600">{new Date().toLocaleString()}</p>
              </div>
              <div className="border-t border-dashed pt-3 space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{formatCurrency((item.price * item.quantity) * (1 - item.discount / 100))}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed mt-3 pt-3">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Discount ({globalDiscount}%)</span>
                    <span>-{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
                <p className="text-center text-sm text-gray-600 mt-2">
                  Paid via {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={handleNewSale}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                >
                  New Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
