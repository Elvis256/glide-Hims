import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  ShoppingCart,
  X,
  CheckCircle,
  Loader2,
  Keyboard,
  ArrowLeft,
  Package,
  AlertTriangle,
  XCircle,
  PauseCircle,
  ScanBarcode,
  User,
  Phone,
  Star,
  Ban,
  Tag,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency, CURRENCY_SYMBOL } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

interface Product {
  id: string;
  name: string;
  genericName?: string;
  price: number;
  currentStock: number;
  unit: string;
  code?: string;
  sku?: string;
  category?: string;
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  maxStock: number;
  unit: string;
}

interface DrugInteraction {
  drug1Id: string;
  drug2Id: string;
  severity: string;
  description: string;
  management?: string;
}

type PaymentMethod = 'cash' | 'mobile_money' | 'card';

interface QuickKey {
  id: string;
  position: number;
  itemId: string;
  label: string;
  color?: string;
}

interface RetailCustomer {
  id: string;
  phone: string;
  name?: string;
  totalVisits: number;
  totalSpend: number;
  lastSeenAt?: string;
}

export default function POSSalePage() {
  const navigate = useNavigate();
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showPayment, setShowPayment] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [completedSaleNumber, setCompletedSaleNumber] = useState('');
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [interactionDismissed, setInteractionDismissed] = useState(false);

  // B3: Hold sale
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [showRecallModal, setShowRecallModal] = useState(false);

  // B2: Void
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidSaleId, setVoidSaleId] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [voidPin, setVoidPin] = useState('');

  // B4: Discount with PIN
  const [discountPin, setDiscountPin] = useState('');
  const [showDiscountPinModal, setShowDiscountPinModal] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState(0);

  // B5: Barcode
  const [barcodeInput, setBarcodeInput] = useState('');

  // B8: Customer phone
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerData, setCustomerData] = useState<RetailCustomer | null>(null);
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);

  // B7: Quick keys
  const [showQuickKeys, setShowQuickKeys] = useState(true);

  // Current shift/register info
  const [currentShiftId, setCurrentShiftId] = useState<string | undefined>();
  const [currentRegisterId, setCurrentRegisterId] = useState<string | undefined>();

  // Load current shift
  useEffect(() => {
    api.get('/pos/shifts/current').then((res) => {
      if (res.data?.id) {
        setCurrentShiftId(res.data.id);
        setCurrentRegisterId(res.data.registerId);
      }
    }).catch(() => {});
  }, []);

  // B7: Quick keys query
  const quickKeysQuery = useQuery({
    queryKey: ['pos-quick-keys', currentRegisterId],
    queryFn: async () => {
      const res = await api.get('/pos/quick-keys', {
        params: { registerId: currentRegisterId },
      });
      return asList(res.data) as QuickKey[];
    },
    enabled: !!currentRegisterId,
  });

  // B3: Held sales query
  const heldSalesQuery = useQuery({
    queryKey: ['pos-held-sales', currentRegisterId, currentShiftId],
    queryFn: async () => {
      const res = await api.get('/pos/sales/held', {
        params: { registerId: currentRegisterId, shiftId: currentShiftId },
      });
      return asList(res.data);
    },
    enabled: showRecallModal,
  });

  // B5: Barcode handler
  const handleBarcodeSubmit = useCallback(async (code: string) => {
    if (!code.trim()) return;
    try {
      const res = await api.get(`/pharmacy/items/by-barcode/${encodeURIComponent(code.trim())}`, {
        params: { facilityId },
      });
      const item = res.data;
      if (!item) { toast.error('Item not found for barcode'); return; }
      const product: Product = {
        id: item.id,
        name: item.name,
        price: item.sellingPrice || item.price || 0,
        currentStock: item.availableQty ?? item.availableQuantity ?? 0,
        unit: item.unit || 'pcs',
        code: item.code,
      };
      // Check if already in cart — increment qty
      setCart((prev) => {
        const existing = prev.find((c) => c.productId === product.id);
        if (existing) {
          return prev.map((c) =>
            c.productId === product.id
              ? { ...c, quantity: Math.min(c.quantity + 1, c.maxStock) }
              : c,
          );
        }
        if (product.currentStock < 1) { toast.error(`${product.name}: Out of stock`); return prev; }
        return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1, maxStock: product.currentStock, unit: product.unit }];
      });
      toast.success(`Added: ${item.name}`);
    } catch {
      toast.error(`Barcode not found: ${code}`);
    }
    setBarcodeInput('');
  }, [facilityId]);

  // B8: Customer phone lookup on blur
  const handlePhoneBlur = useCallback(async () => {
    if (!customerPhone || customerPhone.length < 9) return;
    setLookingUpCustomer(true);
    try {
      const res = await api.get(`/pos/retail-customers/by-phone/${customerPhone}`);
      setCustomerData(res.data.customer);
      if (res.data.customer?.name && !customerName) {
        setCustomerName(res.data.customer.name);
      }
    } catch {
      setCustomerData(null);
    } finally {
      setLookingUpCustomer(false);
    }
  }, [customerPhone, customerName]);

  // B3: Hold sale mutation
  const holdMutation = useMutation({
    mutationFn: async () => {
      return api.post('/pos/sales/hold', {
        posShiftId: currentShiftId,
        posRegisterId: currentRegisterId,
        customerName,
        customerPhone,
        cartSnapshot: { items: cart, discount },
        holdReason,
      });
    },
    onSuccess: () => {
      toast.success('Sale held — cart cleared');
      setCart([]);
      setDiscount(0);
      setCustomerPhone('');
      setCustomerName('');
      setCustomerData(null);
      setShowHoldModal(false);
      setHoldReason('');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to hold sale')),
  });

  // B3: Recall mutation
  const recallMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/pos/sales/recall/${id}`);
      return res.data;
    },
    onSuccess: (data) => {
      const snap = data.cartSnapshot as any;
      if (snap?.items) {
        setCart(snap.items);
        if (typeof snap.discount === 'number') setDiscount(snap.discount);
      }
      if (data.customerPhone) setCustomerPhone(data.customerPhone);
      if (data.customerName) setCustomerName(data.customerName);
      setShowRecallModal(false);
      queryClient.invalidateQueries({ queryKey: ['pos-held-sales'] });
      toast.success('Sale recalled');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to recall sale')),
  });

  // B2: Void mutation
  const voidMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/pos/sales/${voidSaleId}/void`, {
        managerPin: voidPin,
        reason: voidReason,
        posShiftId: currentShiftId,
      });
    },
    onSuccess: () => {
      toast.success('Sale voided successfully');
      setShowVoidModal(false);
      setVoidPin('');
      setVoidReason('');
      setVoidSaleId('');
      queryClient.invalidateQueries({ queryKey: ['pos-recent-sales'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to void sale')),
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (cart.length > 0) setShowPayment(true);
      } else if (e.key === 'Escape') {
        if (showPayment) {
          setShowPayment(false);
        } else if (saleComplete) {
          handleNewSale();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cart.length, showPayment, saleComplete]);

  // Search products
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['pos-products', searchTerm, facilityId],
    queryFn: async () => {
      const res = await api.get('/inventory', {
        params: { search: searchTerm || undefined, limit: 50 },
      });
      return res.data;
    },
    enabled: true,
  });

  const products = useMemo(() => {
    const items = asList<Product>(productsData);
    return items.map((item: any) => ({
      id: item.id,
      name: item.name,
      genericName: item.genericName,
      price: item.retailPrice || item.sellingPrice || item.unitCost || 0,
      currentStock: item.currentStock ?? 0,
      unit: item.unit || 'unit',
      code: item.code,
      sku: item.sku,
      category: item.category,
    }));
  }, [productsData]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.genericName && p.genericName.toLowerCase().includes(term)) ||
        (p.code && p.code.toLowerCase().includes(term)) ||
        (p.sku && p.sku.toLowerCase().includes(term))
    );
  }, [products, searchTerm]);

  // Cart operations
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) {
          toast.error('Insufficient stock');
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (product.currentStock < 1) {
        toast.error('Item out of stock');
        return prev;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          maxStock: product.currentStock,
          unit: product.unit,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty > item.maxStock) {
            toast.error('Insufficient stock');
            return item;
          }
          return { ...item, quantity: Math.max(0, newQty) };
        })
        .filter((item) => item.quantity > 0)
    );
  }, []);

  // Check drug interactions whenever cart changes
  useEffect(() => {
    const checkInteractions = async () => {
      const drugIds = cart.map((item) => item.productId);
      if (drugIds.length < 2) {
        setInteractions([]);
        return;
      }
      try {
        const res = await api.post('/drug-management/interactions/check', { drugIds });
        const data = res.data;
        if (data.hasInteractions) {
          setInteractions(data.interactions);
          setInteractionDismissed(false);
          const severe = data.interactions.filter(
            (i: DrugInteraction) => i.severity === 'major' || i.severity === 'contraindicated'
          );
          if (severe.length > 0) {
            toast.warning(`⚠️ ${severe.length} serious drug interaction(s) detected!`);
          }
        } else {
          setInteractions([]);
        }
      } catch (error) {
        console.error('Drug interaction check failed:', error);
        toast.warning('⚠️ Drug interaction check unavailable — proceed with caution');
      }
    };
    checkInteractions();
  }, [cart.map((i) => i.productId).join(',')]);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const discountAmount = (subtotal * discount) / 100;
  const grandTotal = subtotal - discountAmount;

  // Create and complete sale
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      const saleData = {
        saleType: 'otc' as const,
        items: cart.map((item) => ({
          inventoryItemId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        discountPercent: discount,
        paymentMethod,
        customerPhone: customerPhone || undefined,
        customerName: customerName || undefined,
        posShiftId: currentShiftId,
        posRegisterId: currentRegisterId,
      };
      const res = await api.post('/pharmacy/sales', saleData);
      return res.data;
    },
    onSuccess: async (sale: any) => {
      try {
        await api.post(`/pharmacy/sales/${sale.id}/complete`, {
          amountPaid: grandTotal,
          paymentMethod,
        });
        queryClient.invalidateQueries({ queryKey: ['pos-recent-sales'] });
        queryClient.invalidateQueries({ queryKey: ['pos-products'] });
        setCompletedSaleNumber(sale.saleNumber || sale.id);
        setSaleComplete(true);
        setShowPayment(false);
        toast.success('Sale completed successfully');
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to complete sale'));
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to create sale'));
    },
  });

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    const contraindicated = interactions.filter((i) => i.severity === 'contraindicated');
    if (contraindicated.length > 0 && !interactionDismissed) {
      toast.error('Cannot complete sale — contraindicated drug interaction detected. Review and dismiss the alert to override.');
      return;
    }
    createSaleMutation.mutate();
  };

  const handleNewSale = () => {
    setCart([]);
    setDiscount(0);
    setPaymentMethod('cash');
    setShowPayment(false);
    setSaleComplete(false);
    setCustomerPhone('');
    setCustomerName('');
    setCustomerData(null);
    setCompletedSaleNumber('');
    setSearchTerm('');
    setInteractions([]);
    setInteractionDismissed(false);
  };

  // Sale complete screen
  if (saleComplete) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">Sale Complete!</h2>
          <p className="mb-1 text-gray-600">Sale #{completedSaleNumber}</p>
          <p className="mb-6 text-xl font-semibold text-green-600">{formatCurrency(grandTotal)}</p>
          <div className="flex gap-3">
            <button
              onClick={handleNewSale}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              New Sale
            </button>
            <button
              onClick={() => navigate('/pharmacy/pos')}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-400">Press Esc for new sale</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Dark header bar */}
      <div className="flex items-center justify-between bg-gray-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pharmacy/pos')}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-white">POS Register</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Keyboard className="h-4 w-4" />
            F2: Search &middot; F5: Pay &middot; Esc: Cancel
          </span>
          {/* B3: Hold/Recall buttons */}
          <button
            onClick={() => { if (cart.length > 0) setShowHoldModal(true); }}
            disabled={cart.length === 0}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-40"
            title="Hold sale (park)"
          >
            <PauseCircle className="h-4 w-4" />
            Hold
          </button>
          <button
            onClick={() => setShowRecallModal(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
            title="Recall held sale"
          >
            Recall
          </button>
          {/* B7: Quick-keys toggle */}
          <button
            onClick={() => setShowQuickKeys((v) => !v)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
          >
            <Zap className="h-4 w-4" />
            {showQuickKeys ? 'Hide Keys' : 'Quick Keys'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Products (70%) */}
        <div className="flex w-[70%] flex-col border-r border-gray-200 bg-white">
          {/* Search bar */}
          <div className="border-b border-gray-200 p-4 space-y-2">
            {/* B5: Hidden barcode input (captures HID scanner input) */}
            <input
              ref={barcodeRef}
              type="text"
              className="sr-only"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleBarcodeSubmit(barcodeInput);
                }
              }}
              aria-label="Barcode scanner input"
            />
            {/* B8: Customer phone input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  placeholder="Customer phone (optional)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onBlur={handlePhoneBlur}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <input
                type="text"
                placeholder="Name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-40 rounded-lg border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none"
              />
              {lookingUpCustomer && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              {customerData && (
                <div className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1 whitespace-nowrap">
                  <Star className="h-3 w-3 fill-purple-500 text-purple-500" />
                  {customerData.totalVisits} visit{customerData.totalVisits !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search products by name, code, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* B7: Quick keys panel */}
          {showQuickKeys && (
            <div className="border-b border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-1 mb-2">
                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                <span className="text-xs font-medium text-gray-600">Quick Keys</span>
              </div>
              {quickKeysQuery.data && quickKeysQuery.data.length > 0 ? (
                <div className="grid grid-cols-6 gap-1.5">
                  {quickKeysQuery.data.slice(0, 24).map((qk) => (
                    <button
                      key={qk.id}
                      onClick={async () => {
                        try {
                          const res = await api.get(`/pharmacy/items/${qk.itemId}`, { params: { facilityId } });
                          const item = res.data;
                          if (item) {
                            addToCart({ id: item.id, name: item.name, price: item.sellingPrice || item.price || 0, currentStock: item.availableQty ?? item.availableQuantity ?? 0, unit: item.unit || 'pcs', code: item.code, genericName: item.genericName, sku: item.sku });
                          }
                        } catch { toast.error('Quick key item not found'); }
                      }}
                      className="rounded px-1 py-1.5 text-xs font-medium text-white text-center truncate"
                      style={{ backgroundColor: qk.color || '#2563eb' }}
                      title={qk.label}
                    >
                      {qk.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No quick keys configured. Set them up in POS settings.</p>
              )}
            </div>
          )}

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {productsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-20 text-center text-gray-500">
                <Package className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-lg font-medium">No products found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.currentStock < 1}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      product.currentStock < 1
                        ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-50'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{product.name}</p>
                    <p className="mt-1 text-lg font-bold text-blue-600">{formatCurrency(product.price)}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Stock: {product.currentStock} {product.unit}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Cart (30%) */}
        <div className="flex w-[30%] flex-col bg-gray-50">
          <div className="border-b border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-gray-700" />
              <h2 className="font-semibold text-gray-900">Cart</h2>
              <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                {cart.length} items
              </span>
            </div>
          </div>

          {/* Drug interaction alerts */}
          {interactions.length > 0 && !interactionDismissed && (
            <div className="border-b border-yellow-200 bg-yellow-50 px-4 py-2">
              <div className="flex items-start gap-2">
                {interactions.some((i) => i.severity === 'contraindicated') ? (
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                )}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-yellow-800">
                    {interactions.length} Drug Interaction{interactions.length > 1 ? 's' : ''} Detected
                  </p>
                  {interactions.map((ix, idx) => (
                    <div key={idx} className="mt-1">
                      <span className={`inline-block rounded px-1 py-0.5 text-[10px] font-bold uppercase ${
                        ix.severity === 'contraindicated' ? 'bg-red-100 text-red-700' :
                        ix.severity === 'major' ? 'bg-orange-100 text-orange-700' :
                        ix.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {ix.severity}
                      </span>
                      <p className="mt-0.5 text-[11px] text-yellow-700">{ix.description}</p>
                      {ix.management && (
                        <p className="text-[10px] italic text-yellow-600">→ {ix.management}</p>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setInteractionDismissed(true)}
                  className="flex-shrink-0 rounded p-0.5 text-yellow-500 hover:bg-yellow-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <ShoppingCart className="mx-auto mb-2 h-10 w-10" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs">Click products to add</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</p>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="ml-2 rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.productId, -1)}
                          className="rounded bg-gray-100 p-1 hover:bg-gray-200"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[2rem] text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, 1)}
                          className="rounded bg-gray-100 p-1 hover:bg-gray-200"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                    {/* B4: Per-line discount */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <Tag className="h-3 w-3 text-gray-400" />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="Line disc %"
                        className="w-24 rounded border border-gray-200 px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-400"
                        onChange={(e) => {
                          const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                          setCart((prev) =>
                            prev.map((ci) =>
                              ci.productId === item.productId
                                ? { ...ci, discountPct: pct }
                                : ci,
                            ),
                          );
                        }}
                        defaultValue={(item as any).discountPct || ''}
                      />
                      <p className="text-xs text-gray-400">
                        {formatCurrency(item.price)} × {item.quantity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart footer */}
          <div className="border-t border-gray-200 bg-white p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Discount %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => {
                    const newDiscount = Math.min(100, Math.max(0, Number(e.target.value)));
                    const newDiscountAmount = (subtotal * newDiscount) / 100;
                    // B4: if > 10% or > 50,000 UGX require manager PIN
                    if (newDiscount > 10 || newDiscountAmount > 50000) {
                      setPendingDiscount(newDiscount);
                      setShowDiscountPinModal(true);
                    } else {
                      setDiscount(newDiscount);
                    }
                  }}
                  className="ml-auto w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-sm text-red-500">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-blue-600">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Payment method */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {([
                { key: 'cash' as PaymentMethod, icon: Banknote, label: 'Cash' },
                { key: 'mobile_money' as PaymentMethod, icon: Smartphone, label: 'Mobile' },
                { key: 'card' as PaymentMethod, icon: CreditCard, label: 'Card' },
              ]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors ${
                    paymentMethod === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || createSaleMutation.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {createSaleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Complete Sale
            </button>
          </div>
        </div>
      </div>

      {/* B3: Hold sale modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-yellow-500" />
              Hold Sale
            </h3>
            <p className="text-sm text-gray-500">The cart will be saved and cleared. You can recall it later.</p>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Reason (optional)"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-yellow-500 text-white py-2 text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
                onClick={() => holdMutation.mutate()}
                disabled={holdMutation.isPending}
              >
                {holdMutation.isPending ? 'Saving...' : 'Hold Sale'}
              </button>
              <button
                className="flex-1 rounded-lg border py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { setShowHoldModal(false); setHoldReason(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B3: Recall held sale modal */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900">Recall Held Sale</h3>
            {heldSalesQuery.isLoading && <p className="text-sm text-gray-500">Loading...</p>}
            {heldSalesQuery.data?.length === 0 && <p className="text-sm text-gray-500">No held sales for this shift.</p>}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(heldSalesQuery.data || []).map((held: any) => (
                <button
                  key={held.id}
                  className="w-full text-left border rounded-lg px-3 py-2 hover:bg-blue-50 text-sm"
                  onClick={() => recallMutation.mutate(held.id)}
                  disabled={recallMutation.isPending}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{held.customerName || 'No name'}</span>
                    <span className="text-gray-500 text-xs">
                      {new Date(held.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  {held.holdReason && <p className="text-xs text-gray-500 mt-0.5">{held.holdReason}</p>}
                  <p className="text-xs text-gray-500">{held.customerPhone || ''}</p>
                </button>
              ))}
            </div>
            <button
              className="w-full border rounded-lg py-2 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setShowRecallModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* B2: Void sale modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Ban className="h-5 w-5 text-red-500" />
              Void Sale
            </h3>
            <p className="text-sm text-gray-500">Enter sale ID/number and manager PIN to void.</p>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Sale ID or number"
              value={voidSaleId}
              onChange={(e) => setVoidSaleId(e.target.value)}
            />
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Void reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Manager PIN"
              value={voidPin}
              onChange={(e) => setVoidPin(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                onClick={() => voidMutation.mutate()}
                disabled={voidMutation.isPending || !voidSaleId || !voidPin || !voidReason}
              >
                {voidMutation.isPending ? 'Voiding...' : 'Void Sale'}
              </button>
              <button
                className="flex-1 rounded-lg border py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { setShowVoidModal(false); setVoidPin(''); setVoidReason(''); setVoidSaleId(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B4: Discount PIN modal */}
      {showDiscountPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Tag className="h-5 w-5 text-blue-500" />
              Manager Approval Required
            </h3>
            <p className="text-sm text-gray-500">
              Discount of <strong>{pendingDiscount}%</strong> requires manager approval.
            </p>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Manager PIN"
              value={discountPin}
              onChange={(e) => setDiscountPin(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                disabled={!discountPin}
                onClick={async () => {
                  try {
                    await api.post('/pos/discounts', {
                      saleId: 'pending',
                      discountType: 'percent',
                      discountValue: pendingDiscount,
                      managerPin: discountPin,
                      reason: `Cart discount ${pendingDiscount}%`,
                      posShiftId: currentShiftId,
                    });
                    setDiscount(pendingDiscount);
                    setShowDiscountPinModal(false);
                    setDiscountPin('');
                    toast.success('Discount approved');
                  } catch (err) {
                    toast.error(getApiErrorMessage(err, 'Invalid PIN or approval failed'));
                  }
                }}
              >
                Approve
              </button>
              <button
                className="flex-1 rounded-lg border py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { setShowDiscountPinModal(false); setDiscountPin(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Needed for the dark header's icon reference
function Monitor(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}
