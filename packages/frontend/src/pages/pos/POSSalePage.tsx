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
  UserPlus,
  FileText,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  ClipboardList,
  History,
  Monitor,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency, CURRENCY_SYMBOL } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';
// Phase D — offline mode + mobile money
import { v4 as uuidv4 } from 'uuid';
import { useOfflineMode } from '../../hooks/useOfflineMode';
import { OfflineBanner } from '../../components/OfflineBanner';
import { MobileMoneyModal } from '../../components/MobileMoneyModal';
import { offlineDb, getNextSequenceNumber } from '../../lib/offlineDb';
import { syncPendingSales } from '../../lib/offlineSync';

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
  prescriptionItemId?: string;
}

interface DrugInteraction {
  drug1Id: string;
  drug2Id: string;
  severity: string;
  description: string;
  management?: string;
}

// C3: DDI warning shape from backend
interface DdiWarning {
  severity: string;
  drug1: { id: string; name: string };
  drug2: { id: string; name: string; source: 'cart' | 'history' };
  mechanism: string;
  recommendation: string;
  requireOverride: boolean;
}

// C1: Linked patient
interface LinkedPatient {
  id: string;
  mrn: string;
  fullName: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
}

// C2: Prescription item for scan/display
interface RxItem {
  id: string;
  drugCode: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  quantityDispensed: number;
  remainingQty: number;
  isDispensed: boolean;
  instructions?: string;
}

interface RxPrescription {
  id: string;
  prescriptionNumber: string;
  status: string;
  patient: LinkedPatient | null;
  prescriber: { id: string; name: string } | null;
  items: RxItem[];
  fullyDispensed: boolean;
}

// C1: Recent purchase summary
interface RecentPurchase {
  id: string;
  saleNumber: string;
  date: string;
  totalAmount: number;
  itemCount: number;
  channel: string;
  paymentMethod: string;
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

  // C1: Linked patient
  const [linkedPatient, setLinkedPatient] = useState<LinkedPatient | null>(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState<LinkedPatient[]>([]);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [showRecentPurchases, setShowRecentPurchases] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  const [recentPurchasesLoading, setRecentPurchasesLoading] = useState(false);

  // C2: Rx scan
  const [showRxModal, setShowRxModal] = useState(false);
  const [rxCode, setRxCode] = useState('');
  const [rxData, setRxData] = useState<RxPrescription | null>(null);
  const [rxLoading, setRxLoading] = useState(false);
  const [rxError, setRxError] = useState('');
  const [rxSelections, setRxSelections] = useState<Record<string, number>>({});
  const rxInputRef = useRef<HTMLInputElement>(null);

  // C3: DDI warnings
  const [ddiWarnings, setDdiWarnings] = useState<DdiWarning[]>([]);
  const [showDdiOverrideModal, setShowDdiOverrideModal] = useState(false);
  const [ddiOverrideReason, setDdiOverrideReason] = useState('');
  const [ddiOverridePin, setDdiOverridePin] = useState('');
  const [ddiSaleId, setDdiSaleId] = useState<string | undefined>();

  // Phase D1: Mobile Money STK modal
  const [showMomoModal, setShowMomoModal] = useState(false);
  const [momoSaleId, setMomoSaleId] = useState<string | null>(null);

  // Phase D2: Offline mode
  const offlineModeState = useOfflineMode();
  const { isOnline } = offlineModeState;
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

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

  // D2: Load pending sync count
  useEffect(() => {
    offlineDb.pendingSales.where('status').anyOf(['pending', 'syncing', 'error']).count()
      .then(setPendingSyncCount).catch(() => {});
  }, []);

  // D2: Trigger background sync when we come back online
  useEffect(() => {
    if (isOnline) {
      syncPendingSales((synced, total) => {
        if (total > 0) toast.info(`Syncing offline sales: ${synced}/${total}`);
      }).then(() => {
        offlineDb.pendingSales.where('status').anyOf(['pending', 'syncing', 'error']).count()
          .then(setPendingSyncCount).catch(() => {});
      }).catch(() => {});
    }
  }, [isOnline]);

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

  // C3: DDI check (debounced) — fires when cart or linked patient changes
  useEffect(() => {
    const itemIds = cart.map((i) => i.productId);
    if (itemIds.length === 0) { setDdiWarnings([]); return; }

    const timer = setTimeout(async () => {
      try {
        const params: Record<string, string | string[]> = { 'itemIds[]': itemIds };
        if (linkedPatient) params.patientId = linkedPatient.id;
        const res = await api.get('/pharmacy/interaction-check', { params });
        const warnings: DdiWarning[] = res.data?.warnings ?? [];
        setDdiWarnings(warnings);
        const severeCount = warnings.filter((w) => w.requireOverride).length;
        if (severeCount > 0) {
          toast.warning(`⚠️ ${severeCount} severe drug interaction(s) — override required`);
        }
      } catch {
        // Non-blocking — DDI check failure doesn't block sale
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.map((i) => i.productId).join(','), linkedPatient?.id]);

  // C1: Search patients
  const handlePatientSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setPatientSearchResults([]); return; }
    setPatientSearchLoading(true);
    try {
      const res = await api.get('/patients', { params: { search: q, limit: 10 } });
      setPatientSearchResults(asList<LinkedPatient>(res.data));
    } catch {
      setPatientSearchResults([]);
    } finally {
      setPatientSearchLoading(false);
    }
  }, []);

  const handleLinkPatient = useCallback(async (patient: LinkedPatient) => {
    setLinkedPatient(patient);
    setShowPatientModal(false);
    setPatientSearch('');
    setPatientSearchResults([]);
    // Auto-populate customer name if not set
    if (!customerName) setCustomerName(patient.fullName);
    // Load recent purchases
    setRecentPurchasesLoading(true);
    try {
      const res = await api.get(`/pos/patients/${patient.id}/recent-purchases`, { params: { limit: 10 } });
      setRecentPurchases(asList<RecentPurchase>(res.data));
    } catch {
      setRecentPurchases([]);
    } finally {
      setRecentPurchasesLoading(false);
    }
  }, [customerName]);

  const handleUnlinkPatient = useCallback(() => {
    setLinkedPatient(null);
    setRecentPurchases([]);
    setDdiWarnings([]);
  }, []);

  // C2: Rx scan
  const handleRxLookup = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setRxLoading(true);
    setRxError('');
    setRxData(null);
    try {
      const res = await api.get(`/prescriptions/by-code/${encodeURIComponent(code.trim())}`);
      const rx: RxPrescription = res.data;
      if (rx.fullyDispensed) {
        setRxError('This prescription has already been fully dispensed.');
        return;
      }
      setRxData(rx);
      // Pre-select remaining qty for each undispensed item
      const defaults: Record<string, number> = {};
      rx.items.forEach((item) => {
        if (!item.isDispensed && item.remainingQty > 0) {
          defaults[item.id] = item.remainingQty;
        }
      });
      setRxSelections(defaults);
    } catch (err) {
      setRxError(getApiErrorMessage(err, 'Prescription not found'));
    } finally {
      setRxLoading(false);
    }
  }, []);

  const handleAddRxToCart = useCallback(async () => {
    if (!rxData) return;
    const itemSelections = Object.entries(rxSelections)
      .filter(([, qty]) => qty > 0)
      .map(([prescriptionItemId, qtyToDispense]) => ({ prescriptionItemId, qtyToDispense }));

    if (itemSelections.length === 0) {
      toast.error('Select at least one item to dispense');
      return;
    }

    try {
      const res = await api.post(`/prescriptions/from-prescription/${rxData.id}/draft-cart`, {
        itemSelections,
      });
      const draft = res.data;

      // Merge draft items into cart
      setCart((prev) => {
        const next = [...prev];
        for (const ci of draft.cartItems) {
          const existing = next.find((c) => c.productId === ci.productId);
          if (existing) {
            existing.quantity = Math.min(existing.quantity + ci.quantity, existing.maxStock || 9999);
          } else {
            next.push({
              productId: ci.productId,
              name: ci.name,
              price: ci.price,
              quantity: ci.quantity,
              maxStock: 9999,
              unit: ci.unit,
              prescriptionItemId: ci.prescriptionItemId,
            });
          }
        }
        return next;
      });

      // Auto-link patient from prescription
      if (draft.patientId && !linkedPatient) {
        const patient: LinkedPatient = {
          id: draft.patientId,
          mrn: draft.patientMrn,
          fullName: draft.patientName,
        };
        await handleLinkPatient(patient);
      }

      setShowRxModal(false);
      setRxCode('');
      setRxData(null);
      setRxSelections({});
      setRxError('');
      toast.success(`Added ${itemSelections.length} item(s) from prescription`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add prescription items'));
    }
  }, [rxData, rxSelections, linkedPatient, handleLinkPatient]);
  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const discountAmount = (subtotal * discount) / 100;
  const grandTotal = subtotal - discountAmount;

  // D2: Save sale offline (IndexedDB)
  const saveOfflineSale = useCallback(async () => {
    const clientSaleId = uuidv4();
    const now = new Date().toISOString();
    const seqNum = currentShiftId
      ? await getNextSequenceNumber(currentShiftId)
      : 1;
    const payload = {
      saleType: 'otc',
      saleChannel: 'retail_pos',
      taxPricingMode: 'inclusive',
      items: cart.map((item) => ({
        itemId: item.productId,
        itemCode: item.productId,
        itemName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        discountPercent: 0,
      })),
      discountAmount: (subtotal * discount) / 100,
      paymentMethod: 'cash',
      amountPaid: grandTotal,
      customerPhone: customerPhone || undefined,
      customerName: customerName || undefined,
      posShiftId: currentShiftId,
      posRegisterId: currentRegisterId,
      wasOffline: true as const,
      originalOfflineTimestamp: now,
      clientSaleId,
      clientSequenceNumber: seqNum,
    };
    await offlineDb.pendingSales.put({
      clientSaleId,
      clientSequenceNumber: seqNum,
      shiftId: currentShiftId,
      registerId: currentRegisterId,
      payload,
      createdAt: now,
      status: 'pending',
      attempts: 0,
    });
    setPendingSyncCount((c) => c + 1);
    return { clientSaleId, clientSequenceNumber: seqNum };
  }, [cart, discount, grandTotal, subtotal, customerPhone, customerName, currentShiftId, currentRegisterId]);

  // Create and complete sale
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      // D2: If offline, save to IndexedDB and return a pseudo-sale object
      if (!navigator.onLine) {
        const { clientSaleId, clientSequenceNumber } = await saveOfflineSale();
        return { id: clientSaleId, saleNumber: `OFFLINE-${clientSequenceNumber}`, offline: true };
      }

      const saleData = {
        saleType: 'otc' as const,
        items: cart.map((item) => ({
          inventoryItemId: item.productId,
          quantity: item.quantity,
          unitPrice: item.price,
          prescriptionItemId: item.prescriptionItemId,
        })),
        discountPercent: discount,
        paymentMethod,
        customerPhone: customerPhone || undefined,
        customerName: customerName || undefined,
        patientId: linkedPatient?.id,
        posShiftId: currentShiftId,
        posRegisterId: currentRegisterId,
      };
      const res = await api.post('/pharmacy/sales', saleData);
      return res.data;
    },
    onSuccess: async (sale: any) => {
      // D2: Offline sale — skip complete API call, show receipt with watermark
      if (sale.offline) {
        setCompletedSaleNumber(sale.saleNumber);
        setSaleComplete(true);
        setShowPayment(false);
        toast.success('Sale saved offline — will sync when connected');
        return;
      }

      // D1: Mobile money — open modal instead of completing immediately
      if (paymentMethod === 'mobile_money' && navigator.onLine) {
        setMomoSaleId(sale.id);
        setShowMomoModal(true);
        return;
      }

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
        setShowDdiOverrideModal(false);
        toast.success('Sale completed successfully');
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Failed to complete sale'));
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Failed to create sale'));
    },
  });

  // D1: Handle MoMo payment success (called by modal)
  const handleMomoSuccess = useCallback(async (_transactionRef: string) => {
    setShowMomoModal(false);
    queryClient.invalidateQueries({ queryKey: ['pos-recent-sales'] });
    queryClient.invalidateQueries({ queryKey: ['pos-products'] });
    const saleNumFromMutation = createSaleMutation.data?.saleNumber || momoSaleId || '';
    setCompletedSaleNumber(saleNumFromMutation);
    setSaleComplete(true);
    setShowPayment(false);
    toast.success('Mobile Money payment confirmed');
  }, [queryClient, createSaleMutation.data, momoSaleId]);

  // C3: Handle override confirm (manager PIN + reason) then re-trigger sale
  const handleDdiOverrideConfirm = useCallback(async () => {
    if (!ddiOverrideReason.trim() || !ddiOverridePin.trim()) {
      toast.error('Reason and manager PIN are required');
      return;
    }
    try {
      // Verify PIN — attempt to get a token; use same pattern as void-pin flow
      await api.post('/auth/verify-manager-pin', { pin: ddiOverridePin });
    } catch {
      toast.error('Invalid manager PIN');
      return;
    }
    // Record override (will be created after sale; pass warnings)
    // Proceed with sale creation
    createSaleMutation.mutate();
    setDdiOverridePin('');
    setDdiOverrideReason('');
  }, [ddiOverrideReason, ddiOverridePin, createSaleMutation]);

  const handleCompleteSale = () => {
    if (cart.length === 0) return;
    const requireOverride = ddiWarnings.filter((w) => w.requireOverride);
    if (requireOverride.length > 0) {
      setShowDdiOverrideModal(true);
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
    setLinkedPatient(null);
    setRecentPurchases([]);
    setDdiWarnings([]);
    setRxData(null);
    setRxCode('');
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
      {/* D2: Offline banner */}
      <OfflineBanner state={offlineModeState} />
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
          {/* C2: Scan Rx */}
          <button
            onClick={() => { setShowRxModal(true); setRxCode(''); setRxData(null); setRxError(''); }}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-300 hover:bg-gray-700 border border-green-700"
            title="Scan / enter prescription code"
          >
            <ClipboardList className="h-4 w-4" />
            Scan Rx
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
              {/* C1: Link patient */}
              {linkedPatient ? (
                <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1 whitespace-nowrap">
                  <User className="h-3 w-3 text-blue-500" />
                  <span className="max-w-[120px] truncate">{linkedPatient.fullName}</span>
                  {linkedPatient.mrn && <span className="text-blue-400">·{linkedPatient.mrn}</span>}
                  <button onClick={handleUnlinkPatient} className="ml-1 text-blue-400 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPatientModal(true)}
                  className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 whitespace-nowrap"
                  title="Link hospital patient"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Link Patient
                </button>
              )}
            </div>
            {/* C1: Recent purchases collapsible */}
            {linkedPatient && (
              <div className="rounded border border-blue-100 bg-blue-50">
                <button
                  onClick={() => setShowRecentPurchases((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-blue-700"
                >
                  <History className="h-3.5 w-3.5" />
                  Recent purchases ({recentPurchases.length})
                  {showRecentPurchases ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                </button>
                {showRecentPurchases && (
                  <div className="border-t border-blue-100 px-3 pb-2">
                    {recentPurchasesLoading ? (
                      <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                      </div>
                    ) : recentPurchases.length === 0 ? (
                      <p className="py-2 text-xs text-gray-400">No recent purchases found</p>
                    ) : (
                      <div className="space-y-1 pt-1">
                        {recentPurchases.map((rp) => (
                          <div key={rp.id} className="flex items-center justify-between text-xs text-gray-600">
                            <span>{new Date(rp.date).toLocaleDateString()}</span>
                            <span>{rp.itemCount} item{rp.itemCount !== 1 ? 's' : ''}</span>
                            <span className="font-medium text-gray-800">{formatCurrency(rp.totalAmount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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

          {/* C3: DDI warning banner */}
          {ddiWarnings.length > 0 && (
            <div className={`border-b px-4 py-2 ${
              ddiWarnings.some((w) => w.requireOverride)
                ? 'border-red-200 bg-red-50'
                : 'border-yellow-200 bg-yellow-50'
            }`}>
              <div className="flex items-start gap-2">
                {ddiWarnings.some((w) => w.requireOverride) ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${ddiWarnings.some((w) => w.requireOverride) ? 'text-red-800' : 'text-yellow-800'}`}>
                    {ddiWarnings.length} Drug Interaction{ddiWarnings.length > 1 ? 's' : ''} Detected
                    {linkedPatient && ' (incl. patient history)'}
                  </p>
                  {ddiWarnings.map((w, idx) => (
                    <div key={idx} className="mt-0.5">
                      <span className={`inline-block rounded px-1 py-0.5 text-[10px] font-bold uppercase ${
                        w.severity === 'contraindicated' ? 'bg-red-100 text-red-700' :
                        w.severity === 'major' ? 'bg-orange-100 text-orange-700' :
                        w.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{w.severity}</span>
                      <span className="ml-1 text-[11px] text-gray-700">
                        {w.drug1.name} ↔ {w.drug2.name}
                        {w.drug2.source === 'history' && <span className="ml-1 text-gray-400 italic">(from history)</span>}
                      </span>
                      {w.recommendation && (
                        <p className="text-[10px] italic text-gray-500 truncate">→ {w.recommendation}</p>
                      )}
                    </div>
                  ))}
                  {ddiWarnings.some((w) => w.requireOverride) && (
                    <p className="mt-1 text-[10px] font-medium text-red-700">Manager override required to complete sale</p>
                  )}
                </div>
                <button
                  onClick={() => setDdiWarnings([])}
                  className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100"
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
                      {item.prescriptionItemId && (
                        <span className="ml-auto flex items-center gap-0.5 rounded bg-green-50 border border-green-200 px-1 py-0.5 text-[10px] text-green-700">
                          <FileText className="h-2.5 w-2.5" /> Rx
                        </span>
                      )}
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
                { key: 'cash' as PaymentMethod, icon: Banknote, label: 'Cash', disabled: false },
                { key: 'mobile_money' as PaymentMethod, icon: Smartphone, label: 'Mobile', disabled: !isOnline },
                { key: 'card' as PaymentMethod, icon: CreditCard, label: 'Card', disabled: !isOnline },
              ]).map(({ key, icon: Icon, label, disabled }) => (
                <button
                  key={key}
                  onClick={() => { if (!disabled) setPaymentMethod(key); }}
                  disabled={disabled}
                  title={disabled ? 'Not available offline' : undefined}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors ${
                    disabled
                      ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                      : paymentMethod === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {disabled && <span className="text-[9px] text-gray-300">offline</span>}
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
              {!isOnline ? 'Complete Sale (Offline)' : 'Complete Sale'}
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

      {/* C1: Patient search modal */}
      {showPatientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-600" />
                Link Hospital Patient
              </h3>
              <button onClick={() => setShowPatientModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Search by name, MRN, or phone..."
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  handlePatientSearch(e.target.value);
                }}
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {patientSearchLoading && (
                <div className="flex items-center justify-center py-4 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {!patientSearchLoading && patientSearch.length >= 2 && patientSearchResults.length === 0 && (
                <p className="text-sm text-center text-gray-400 py-4">No patients found</p>
              )}
              {patientSearchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleLinkPatient(p)}
                  className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 hover:bg-blue-50 hover:border-blue-300"
                >
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.fullName}</p>
                      <p className="text-xs text-gray-500">
                        {p.mrn && <span className="mr-2">MRN: {p.mrn}</span>}
                        {p.gender && <span className="mr-2 capitalize">{p.gender}</span>}
                        {p.dateOfBirth && <span>{new Date(p.dateOfBirth).getFullYear()}</span>}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* C2: Rx scan modal */}
      {showRxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-green-600" />
                Scan Prescription
              </h3>
              <button onClick={() => { setShowRxModal(false); setRxData(null); setRxError(''); }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={rxInputRef}
                  autoFocus
                  type="text"
                  placeholder="Scan barcode or enter prescription number..."
                  value={rxCode}
                  onChange={(e) => setRxCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRxLookup(rxCode); }}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => handleRxLookup(rxCode)}
                disabled={rxLoading || !rxCode.trim()}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {rxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Lookup
              </button>
            </div>
            {rxError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
                <XCircle className="h-4 w-4 flex-shrink-0" />
                {rxError}
              </div>
            )}
            {rxData && (
              <div className="space-y-3">
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-green-900">{rxData.prescriptionNumber}</p>
                      {rxData.patient && (
                        <p className="text-green-700 text-xs">
                          Patient: {rxData.patient.fullName}
                          {rxData.patient.mrn && <span className="ml-1 text-green-500">· {rxData.patient.mrn}</span>}
                        </p>
                      )}
                      {rxData.prescriber && (
                        <p className="text-green-600 text-xs">Prescriber: {rxData.prescriber.name}</p>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      rxData.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>{rxData.status}</span>
                  </div>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {rxData.items.map((item) => (
                    <div key={item.id} className={`rounded border px-3 py-2 ${item.isDispensed ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 accent-green-600"
                          disabled={item.isDispensed || item.remainingQty <= 0}
                          checked={!!rxSelections[item.id]}
                          onChange={(e) => {
                            setRxSelections((prev) => {
                              const next = { ...prev };
                              if (e.target.checked) next[item.id] = item.remainingQty;
                              else delete next[item.id];
                              return next;
                            });
                          }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.drugName}</p>
                          <p className="text-xs text-gray-500">{item.dose} · {item.frequency} · {item.duration}</p>
                          <p className="text-xs text-gray-400">
                            Ordered: {item.quantity} · Dispensed: {item.quantityDispensed} · Remaining: {item.remainingQty}
                          </p>
                          {item.isDispensed && <span className="text-[10px] text-gray-400 italic">Already dispensed</span>}
                        </div>
                        {rxSelections[item.id] !== undefined && (
                          <div className="flex flex-col items-end gap-1">
                            <label className="text-[10px] text-gray-500">Qty to dispense</label>
                            <input
                              type="number"
                              min={1}
                              max={item.remainingQty}
                              value={rxSelections[item.id]}
                              onChange={(e) => {
                                const v = Math.max(1, Math.min(item.remainingQty, Number(e.target.value) || 1));
                                setRxSelections((prev) => ({ ...prev, [item.id]: v }));
                              }}
                              className="w-16 rounded border border-gray-300 px-2 py-0.5 text-right text-sm focus:outline-none focus:border-green-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleAddRxToCart}
                    disabled={Object.keys(rxSelections).length === 0}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add to Cart ({Object.keys(rxSelections).length} item{Object.keys(rxSelections).length !== 1 ? 's' : ''})
                  </button>
                  <button
                    onClick={() => { setShowRxModal(false); setRxData(null); setRxError(''); }}
                    className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* C3: DDI override modal */}
      {showDdiOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              Override Drug Interaction Warning
            </h3>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              {ddiWarnings.filter((w) => w.requireOverride).map((w, i) => (
                <p key={i} className="text-xs text-red-700">
                  <span className="font-semibold capitalize">{w.severity}:</span> {w.drug1.name} ↔ {w.drug2.name}
                </p>
              ))}
            </div>
            <p className="text-sm text-gray-600">
              A manager PIN and documented reason are required to proceed.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Clinical Reason *</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                rows={2}
                placeholder="e.g. Benefit outweighs risk; patient monitored"
                value={ddiOverrideReason}
                onChange={(e) => setDdiOverrideReason(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Manager PIN *</label>
              <input
                autoFocus
                type="password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Enter manager PIN"
                value={ddiOverridePin}
                onChange={(e) => setDdiOverridePin(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDdiOverrideConfirm(); }}
              />
            </div>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                disabled={!ddiOverrideReason.trim() || !ddiOverridePin.trim() || createSaleMutation.isPending}
                onClick={handleDdiOverrideConfirm}
              >
                {createSaleMutation.isPending ? 'Processing...' : 'Override & Complete Sale'}
              </button>
              <button
                className="flex-1 rounded-lg border py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { setShowDdiOverrideModal(false); setDdiOverridePin(''); setDdiOverrideReason(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* D1: Mobile Money STK modal */}
      {showMomoModal && momoSaleId && (
        <MobileMoneyModal
          saleId={momoSaleId}
          amount={grandTotal}
          defaultPhone={customerPhone}
          onSuccess={handleMomoSuccess}
          onClose={() => {
            setShowMomoModal(false);
            setMomoSaleId(null);
          }}
        />
      )}

      {/* D2: Pending offline sync badge */}
      {pendingSyncCount > 0 && (
        <button
          onClick={() => window.open('/pharmacy/pos/offline-sync', '_self')}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-amber-600"
        >
          <AlertTriangle className="h-4 w-4" />
          {pendingSyncCount} offline sale{pendingSyncCount !== 1 ? 's' : ''} pending sync
        </button>
      )}
    </div>
  );
}
