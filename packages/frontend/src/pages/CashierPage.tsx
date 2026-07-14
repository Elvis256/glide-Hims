import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  Receipt,
  RefreshCw,
  Banknote,
  RotateCcw,
  Pill,
  Printer,
  FlaskConical,
  Trash2,
  Shield,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency } from '../lib/currency';
import { usePermissions } from '../components/PermissionGate';
import AccessDenied from '../components/AccessDenied';
import { printService } from '../lib/print';
import { useInstitutionInfo } from '../lib/useInstitutionInfo';
import { usePrintFormat } from '../lib/usePrintFormat';
import PaymentMethodPicker from '../components/PaymentMethodPicker';
import { confirmDialog } from '../components/ConfirmDialog';
import type { PaymentMethod } from '../shared/payment-methods';
import { Badge, EmptyState, Skeleton, cn, type BadgeTone } from '../components/ui';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  insuranceCovered?: boolean;
  insuranceAmount?: number;
  copayAmount?: number;
  coverageNote?: string;
  chargeType?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'cancelled';
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
  };
  encounter?: {
    id: string;
    visitNumber: string;
    type?: string;
    patient?: {
      id: string;
      mrn: string;
      fullName: string;
    };
  };
  insuranceAmount?: number;
  copayAmount?: number;
  patientResponsibility?: number;
  insurancePolicyId?: string;
  paymentType?: string;
  items: InvoiceItem[];
  payments: {
    id: string;
    amount: number;
    method: string;
    receiptNumber: string;
    paidAt: string;
  }[];
  createdAt: string;
}

const statusTones: Record<Invoice['status'], BadgeTone> = {
  draft: 'neutral',
  pending: 'warning',
  partially_paid: 'info',
  paid: 'success',
  cancelled: 'danger',
};

const statusLabels: Record<Invoice['status'], string> = {
  draft: 'Draft',
  pending: 'Pending',
  partially_paid: 'Partial',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

/** The amount the patient actually owes right now (insurance leaves only their share). */
const dueNow = (inv: Invoice): number =>
  inv.paymentType === 'insurance' && inv.patientResponsibility != null
    ? Number(inv.patientResponsibility)
    : Number(inv.balanceDue) || 0;

const initials = (name?: string) =>
  (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export default function CashierPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const inst = useInstitutionInfo();
  const { printFormat } = usePrintFormat();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('unpaid');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnPharmacyModal, setShowReturnPharmacyModal] = useState(false);
  const [returnPharmacyReason, setReturnPharmacyReason] = useState('');
  const [showReturnLabModal, setShowReturnLabModal] = useState(false);
  const [returnLabReason, setReturnLabReason] = useState('');
  const [completedPayment, setCompletedPayment] = useState<{
    patientName: string;
    invoiceNumber: string;
    amountPaid: number;
    method: string;
    receiptNumber?: string;
    change: number;
  } | null>(null);
  const [lastPaidInvoice, setLastPaidInvoice] = useState<Invoice | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<number>(0);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch invoices
  const { data: invoicesData, isLoading, refetch } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      // "unpaid" is a UI-side worklist filter (pending + partially_paid)
      if (statusFilter && statusFilter !== 'unpaid') params.append('status', statusFilter);
      const response = await api.get(`/billing/invoices?${params}`);
      return response.data;
    },
  });

  // Fetch stats separately (not affected by status filter)
  const { data: pendingData } = useQuery({
    queryKey: ['invoices-pending-stats'],
    queryFn: async () => {
      const response = await api.get('/billing/invoices/pending');
      return response.data;
    },
    staleTime: 30000,
  });

  const { data: dailyRevenueData } = useQuery({
    queryKey: ['daily-revenue'],
    queryFn: async () => {
      const response = await api.get('/billing/revenue/daily');
      return response.data;
    },
    staleTime: 30000,
  });

  // Payment mutation
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const paymentMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; amount: number; method: string; reference?: string }) => {
      const response = await api.post('/billing/payments', {
        invoiceId: data.invoiceId,
        amount: data.amount,
        method: data.method,
        transactionReference: data.reference,
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-pending-stats'] });
      queryClient.invalidateQueries({ queryKey: ['daily-revenue'] });
      // Cash overpayment is capped before sending: what was COLLECTED differs
      // from what was TENDERED. The receipt and flash must show the collected
      // amount — the difference is the change handed back.
      const due = selectedInvoice ? dueNow(selectedInvoice) : 0;
      const tendered = paymentAmount;
      const collected = paymentMethod === 'cash' ? Math.min(tendered, due) : tendered;
      const change = Math.max(0, tendered - collected);
      const receiptNum = data?.receiptNumber || data?.data?.receiptNumber || '';
      if (selectedInvoice) {
        setLastPaidInvoice({
          ...selectedInvoice,
          payments: [{ id: data?.id || '', amount: Number(data?.amount ?? collected), method: paymentMethod, receiptNumber: receiptNum, paidAt: new Date().toISOString() }, ...(selectedInvoice.payments || [])],
        });
      }
      setCompletedPayment({
        patientName: selectedInvoice?.patient?.fullName || selectedInvoice?.patient?.mrn || 'Patient',
        invoiceNumber: selectedInvoice?.invoiceNumber || '',
        amountPaid: collected,
        method: paymentMethod,
        receiptNumber: receiptNum,
        change,
      });
      setSelectedInvoice(null);
      setPaymentAmount(0);
      setPaymentMethod('cash');
      setPaymentReference('');
      setPaymentError(null);
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message || 'Payment failed. Please try again.';
      setPaymentError(msg);
      toast.error(msg);
    },
  });

  // Update item price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; itemId: string; unitPrice: number }) => {
      const response = await api.patch(`/billing/invoices/${data.invoiceId}/items/${data.itemId}`, {
        unitPrice: data.unitPrice,
      });
      return response.data;
    },
    onSuccess: (updatedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (selectedInvoice && updatedInvoice) {
        setSelectedInvoice(updatedInvoice);
        setPaymentAmount(dueNow(updatedInvoice));
      }
      setEditingItemId(null);
      toast.success('Price updated');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to update price');
    },
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (data: { invoiceId: string; itemId: string }) => {
      const response = await api.delete(`/billing/invoices/${data.invoiceId}/items/${data.itemId}`);
      return response.data;
    },
    onSuccess: (updatedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (selectedInvoice && updatedInvoice) {
        setSelectedInvoice(updatedInvoice);
        setPaymentAmount(dueNow(updatedInvoice));
      }
      toast.success('Item removed');
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to remove item');
    },
  });

  // Return to doctor mutation
  const returnToDoctorMutation = useMutation({
    mutationFn: async (data: { encounterId: string; reason: string }) => {
      const response = await api.patch(`/encounters/${data.encounterId}/return-to-doctor`, {
        reason: data.reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Patient returned to doctor successfully');
      setShowReturnModal(false);
      setReturnReason('');
      setSelectedInvoice(null);
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message || 'Failed to return patient to doctor';
      toast.error(msg);
    },
  });

  // Return to pharmacy mutation
  const returnToPharmacyMutation = useMutation({
    mutationFn: async (data: { encounterId: string; reason: string }) => {
      const response = await api.patch(`/encounters/${data.encounterId}/return-to-pharmacy`, {
        reason: data.reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Patient returned to pharmacy successfully');
      setShowReturnPharmacyModal(false);
      setReturnPharmacyReason('');
      setSelectedInvoice(null);
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message || 'Failed to return patient to pharmacy';
      toast.error(msg);
    },
  });

  // Return to lab mutation
  const returnToLabMutation = useMutation({
    mutationFn: async (data: { encounterId: string; reason: string }) => {
      const response = await api.patch(`/encounters/${data.encounterId}/return-to-lab`, {
        reason: data.reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Patient returned to lab successfully');
      setShowReturnLabModal(false);
      setReturnLabReason('');
      setSelectedInvoice(null);
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message || 'Failed to return patient to lab';
      toast.error(msg);
    },
  });

  const invoices: Invoice[] = Array.isArray(invoicesData) ? invoicesData : (invoicesData?.data || []);

  const filteredInvoices = useMemo(() => invoices.filter((inv) => {
    if (statusFilter === 'unpaid' && !['pending', 'partially_paid'].includes(inv.status)) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const patientMrn = inv.encounter?.patient?.mrn || inv.patient?.mrn || '';
    const patientName = inv.encounter?.patient?.fullName || inv.patient?.fullName || '';
    return (
      inv.invoiceNumber.toLowerCase().includes(search) ||
      patientMrn.toLowerCase().includes(search) ||
      patientName.toLowerCase().includes(search)
    );
  }), [invoices, searchTerm, statusFilter]);

  const hasZeroPriceItems = selectedInvoice
    ? (selectedInvoice.items || []).some((item) => !item.unitPrice || Number(item.unitPrice) <= 0)
    : false;

  const selectInvoice = useCallback((inv: Invoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(dueNow(inv));
    setPaymentError(null);
    setEditingItemId(null);
    // Cashier types the tendered amount straight away
    setTimeout(() => amountInputRef.current?.select(), 80);
  }, []);

  const backToWorklist = useCallback(() => {
    setSelectedInvoice(null);
    setPaymentAmount(0);
    setPaymentMethod('cash');
    setPaymentReference('');
    setPaymentError(null);
    setEditingItemId(null);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handlePayment = () => {
    if (!selectedInvoice) return;

    const balance = Number(selectedInvoice.balanceDue) || 0;

    if (hasZeroPriceItems) {
      toast.error('Cannot process payment: some items have no price. Please set prices first.');
      return;
    }

    if (paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    // For cash, allow overpayment (change will be given); for others, cap at balance
    const actualPayment = paymentMethod === 'cash'
      ? Math.min(paymentAmount, balance)
      : paymentAmount;

    if (paymentMethod !== 'cash' && paymentAmount > balance) {
      toast.error('Payment amount cannot exceed balance');
      return;
    }

    if (paymentMethod !== 'cash' && !paymentReference.trim()) {
      toast.error('Please enter a transaction reference');
      return;
    }

    paymentMutation.mutate({
      invoiceId: selectedInvoice.id,
      amount: actualPayment,
      method: paymentMethod,
      reference: paymentReference || undefined,
    });
  };

  const handlePrintReceipt = useCallback((invoice: Invoice, payment?: { receiptNumber: string; amount: number; method: string; paidAt: string }) => {
    const variant = printService.getVariant(printFormat);
    const header = printService.buildHeader(inst, variant);
    const lastPayment = payment || invoice.payments?.[0];
    if (!lastPayment) {
      toast.error('No payment found for this invoice');
      return;
    }
    const paidDate = new Date(lastPayment.paidAt);
    const servicesHtml = (invoice.items || []).length > 0
      ? `<div class="mb-2">
          <div class="font-bold text-xs">Services:</div>
          ${invoice.items.map(item => printService.kvRow(item.description, Number(item.amount).toLocaleString())).join('')}
        </div>
        <div class="border-dashed"></div>`
      : '';
    const body = `
      <div class="text-center font-bold mb-2">PAYMENT RECEIPT</div>
      <div class="border-dashed"></div>
      ${printService.kvRow('Receipt No', lastPayment.receiptNumber, true)}
      ${printService.kvRow('Invoice No', invoice.invoiceNumber)}
      ${printService.kvRow('Date', `${paidDate.toLocaleDateString()} ${paidDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)}
      <div class="border-dashed" style="margin:6px 0;"></div>
      ${printService.kvRow('Patient', invoice.patient?.fullName || 'Unknown', true)}
      ${printService.kvRow('MRN', invoice.patient?.mrn || 'N/A')}
      <div class="border-dashed" style="margin:6px 0;"></div>
      ${servicesHtml}
      ${printService.kvRow('TOTAL PAID', `UGX ${Number(lastPayment.amount).toLocaleString()}`, true)}
      ${printService.kvRow('Payment Method', lastPayment.method.replace('_', ' '))}
      <div class="border-dashed" style="margin:6px 0;"></div>
    `;
    const footer = printService.buildFooter(inst, variant);
    printService.printBilling(header + body + footer, printFormat, { title: `Receipt ${lastPayment.receiptNumber}` });
  }, [inst, printFormat]);

  // ── State C: auto-print receipt + flash + auto-reset ──────────────────────
  useEffect(() => {
    if (completedPayment && lastPaidInvoice) {
      handlePrintReceipt(lastPaidInvoice);
      resetTimerRef.current = setTimeout(() => {
        setCompletedPayment(null);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }, 6000);
      return () => {
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedPayment]);

  // ── Keyboard grammar ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const modalOpen = showReturnModal || showReturnPharmacyModal || showReturnLabModal;

      if (completedPayment) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
          setCompletedPayment(null);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }
        return;
      }

      if (modalOpen) return;

      if (e.key === 'Escape') {
        if (editingItemId) {
          setEditingItemId(null);
        } else if (selectedInvoice) {
          backToWorklist();
        }
        return;
      }

      // Enter on the ticket outside a field → collect
      if (e.key === 'Enter' && !inField && selectedInvoice && !editingItemId) {
        if (!paymentMutation.isPending) {
          e.preventDefault();
          handlePayment();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvoice, completedPayment, paymentAmount, paymentMethod, paymentReference, editingItemId, showReturnModal, showReturnPharmacyModal, showReturnLabModal]);

  if (!hasPermission('billing.read')) {
    return <AccessDenied />;
  }

  const handleReturnToDoctor = () => {
    if (!selectedInvoice?.encounter?.id) {
      toast.error('No encounter found for this invoice');
      return;
    }
    if (!returnReason.trim()) {
      toast.error('Please provide a reason for returning the patient');
      return;
    }
    returnToDoctorMutation.mutate({
      encounterId: selectedInvoice.encounter.id,
      reason: returnReason,
    });
  };

  const handleReturnToPharmacy = () => {
    if (!selectedInvoice?.encounter?.id) {
      toast.error('No encounter found for this invoice');
      return;
    }
    if (!returnPharmacyReason.trim()) {
      toast.error('Please provide a reason for returning the patient');
      return;
    }
    returnToPharmacyMutation.mutate({
      encounterId: selectedInvoice.encounter.id,
      reason: returnPharmacyReason,
    });
  };

  const handleReturnToLab = () => {
    if (!selectedInvoice?.encounter?.id) {
      toast.error('No encounter found for this invoice');
      return;
    }
    if (!returnLabReason.trim()) {
      toast.error('Please provide a reason for returning the patient');
      return;
    }
    returnToLabMutation.mutate({
      encounterId: selectedInvoice.encounter.id,
      reason: returnLabReason,
    });
  };

  // Stats from dedicated endpoints (not affected by status filter)
  const pendingInvoices: Invoice[] = Array.isArray(pendingData) ? pendingData : (pendingData?.data || []);
  const pendingCount = pendingInvoices.length;
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
  const todayCollected = Number(dailyRevenueData?.totalCollected) || 0;

  // Change calculation for cash payments
  const changeAmount = selectedInvoice && paymentMethod === 'cash'
    ? Math.max(0, paymentAmount - (Number(selectedInvoice.balanceDue) || 0))
    : 0;

  const patientOf = (inv: Invoice) => inv.patient || inv.encounter?.patient;

  // ═══ State C: paid — the hero number is the CHANGE ═══════════════════════
  if (completedPayment) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center animate-fade-in max-w-md w-full px-6">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <p className="text-sm text-surface-500 uppercase tracking-widest mb-1">
            Paid · receipt printing…
          </p>

          {completedPayment.change > 0 ? (
            <>
              <p className="text-base text-surface-600 mb-1">Change due</p>
              <p className="text-7xl font-mono font-extrabold text-amber-600 tracking-tight mb-2">
                {formatCurrency(completedPayment.change)}
              </p>
            </>
          ) : (
            <p className="text-6xl font-mono font-extrabold text-emerald-600 tracking-tight mb-2">
              {formatCurrency(completedPayment.amountPaid)}
            </p>
          )}

          <p className="text-lg font-semibold text-surface-800">{completedPayment.patientName}</p>
          <p className="text-sm text-surface-500 mt-1">
            {completedPayment.invoiceNumber}
            {completedPayment.receiptNumber && <> · Receipt <span className="font-mono">{completedPayment.receiptNumber}</span></>}
            {' '}· <span className="capitalize">{completedPayment.method.replace(/_/g, ' ')}</span>
          </p>
          {completedPayment.change > 0 && (
            <p className="text-sm text-surface-500 mt-1">
              Received {formatCurrency(completedPayment.amountPaid + completedPayment.change)} · billed {formatCurrency(completedPayment.amountPaid)}
            </p>
          )}

          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => lastPaidInvoice && handlePrintReceipt(lastPaidInvoice)}
              className="btn-secondary text-sm"
            >
              <Printer className="w-4 h-4" /> Reprint
            </button>
            <button
              onClick={() => {
                if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
                setCompletedPayment(null);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="btn-primary px-6"
              autoFocus
            >
              Next patient
              <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 border border-white/30 rounded">↵</kbd>
            </button>
          </div>
          <p className="text-xs text-surface-400 mt-3">Returning to worklist automatically…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header + ambient till strip */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-surface-900 tracking-tight">Cashier</h1>
          <p className="text-surface-500 text-sm">Collect payments and issue receipts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 text-sm bg-white border border-surface-200 rounded-xl px-3 py-1.5">
            <span className="flex items-center gap-1.5 text-amber-700">
              <Clock className="w-4 h-4" />
              <span className="font-semibold">{pendingCount}</span> pending
            </span>
            <span className="text-surface-300">·</span>
            <span className="text-rose-700 font-medium">{formatCurrency(pendingAmount)} due</span>
            <span className="text-surface-300">·</span>
            <span className="text-emerald-700 font-medium">{formatCurrency(todayCollected)} today</span>
          </div>
          <button
            onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ['invoices-pending-stats'] }); queryClient.invalidateQueries({ queryKey: ['daily-revenue'] }); }}
            className="btn-ghost"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ═══ State A: WORKLIST — who owes, newest first ═══ */}
      {!selectedInvoice && (
        <div className="flex-1 flex flex-col items-center min-h-0">
          <div className="w-full max-w-2xl flex flex-col min-h-0">
            <div className="relative flex-shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Invoice #, MRN or patient name…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setHighlightIdx(0); }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filteredInvoices.length - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
                  if (e.key === 'Enter' && filteredInvoices[highlightIdx]) {
                    e.preventDefault();
                    selectInvoice(filteredInvoices[highlightIdx]);
                  }
                }}
                className="w-full pl-12 pr-4 py-3.5 text-lg bg-white border-2 border-surface-200 rounded-2xl shadow-sm
                  focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none transition-all"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 mt-3 flex-shrink-0">
              {([['unpaid', 'To collect'], ['partially_paid', 'Partial'], ['paid', 'Paid (reprints)'], ['', 'All']] as const).map(([value, label]) => (
                <button
                  key={value || 'all'}
                  onClick={() => { setStatusFilter(value); setHighlightIdx(0); }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm transition-colors',
                    statusFilter === value
                      ? 'bg-brand-100 text-brand-700 font-medium'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex-1 overflow-y-auto min-h-0 pb-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
                </div>
              ) : filteredInvoices.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title={statusFilter === 'unpaid' ? 'Nothing to collect' : 'No invoices found'}
                  description={
                    statusFilter === 'unpaid'
                      ? 'Invoices awaiting payment will appear here as patients are billed.'
                      : 'Try a different search or filter.'
                  }
                />
              ) : (
                <div className="space-y-2">
                  {filteredInvoices.map((inv, i) => {
                    const p = patientOf(inv);
                    const due = dueNow(inv);
                    return (
                      <button
                        key={inv.id}
                        onClick={() => selectInvoice(inv)}
                        onMouseEnter={() => setHighlightIdx(i)}
                        className={cn(
                          'w-full flex items-center gap-3 bg-white border rounded-2xl px-4 py-3 text-left transition-all',
                          i === highlightIdx
                            ? 'border-brand-400 shadow-md'
                            : 'border-surface-200 hover:border-brand-300',
                        )}
                      >
                        <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {initials(p?.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-surface-900 truncate">{p?.fullName || 'Unknown'}</p>
                            <Badge tone={statusTones[inv.status]}>{statusLabels[inv.status]}</Badge>
                            {inv.paymentType === 'insurance' && (
                              <Badge tone="info" icon={Shield}>Insurance</Badge>
                            )}
                          </div>
                          <p className="text-sm text-surface-500 truncate">
                            {inv.invoiceNumber} · {p?.mrn || 'N/A'} · {inv.items?.length || 0} item{(inv.items?.length || 0) === 1 ? '' : 's'}
                            {' '}· {inv.encounter?.type?.toUpperCase() || 'Walk-in'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {inv.status === 'paid' ? (
                            <p className="font-semibold text-emerald-600">{formatCurrency(inv.amountPaid)}</p>
                          ) : (
                            <>
                              <p className="font-bold text-surface-900">{formatCurrency(due)}</p>
                              {due !== Number(inv.totalAmount) && (
                                <p className="text-xs text-surface-400">of {formatCurrency(inv.totalAmount)}</p>
                              )}
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ State B: PAYMENT TICKET ═══ */}
      {selectedInvoice && (() => {
        const p = patientOf(selectedInvoice);
        const balance = Number(selectedInvoice.balanceDue) || 0;
        const isPayable = selectedInvoice.status !== 'paid' && balance > 0;
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-2 pb-6">
              <div className="bg-white rounded-2xl border border-surface-200 shadow-[0_4px_24px_rgba(15,23,42,0.07)] overflow-hidden">
                {/* Patient header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-surface-50 border-b border-surface-200">
                  <div className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0">
                    {initials(p?.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-surface-900 truncate">{p?.fullName || 'Unknown'}</p>
                      <Badge tone={statusTones[selectedInvoice.status]}>{statusLabels[selectedInvoice.status]}</Badge>
                    </div>
                    <p className="text-sm text-surface-500 truncate">
                      {p?.mrn || 'N/A'} · {selectedInvoice.invoiceNumber}
                    </p>
                  </div>
                  <button onClick={backToWorklist} className="text-sm text-brand-600 hover:underline shrink-0" title="Esc">
                    Back
                  </button>
                </div>

                {/* Items */}
                <div className="px-4 py-3 border-b border-surface-100">
                  {hasZeroPriceItems && (
                    <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700">Some items have no price. Click the price to set it before collecting payment.</p>
                    </div>
                  )}
                  <div className="max-h-44 overflow-y-auto divide-y divide-surface-100">
                    {(selectedInvoice.items || []).length > 0 ? (
                      selectedInvoice.items.map((item) => {
                        const isZeroPrice = !item.unitPrice || Number(item.unitPrice) <= 0;
                        const isEditing = editingItemId === item.id;
                        return (
                          <div key={item.id} className={cn('py-1.5 flex justify-between items-center text-sm gap-2', isZeroPrice && 'bg-rose-50 -mx-2 px-2 rounded')}>
                            <div className="flex-1 min-w-0">
                              <span className={isZeroPrice ? 'text-rose-700' : 'text-surface-700'}>
                                {item.description} <span className="text-surface-400">×{item.quantity}</span>
                              </span>
                              {item.insuranceCovered && (
                                <Badge tone="info" icon={Shield} className="ml-1.5">Covered</Badge>
                              )}
                              {item.insuranceCovered === false && item.coverageNote && (
                                <Badge tone="danger" className="ml-1.5">Not covered</Badge>
                              )}
                              {item.coverageNote === 'Requires pre-authorization' && (
                                <Badge tone="warning" className="ml-1.5">Pre-auth</Badge>
                              )}
                            </div>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  value={editingPrice}
                                  onChange={(e) => setEditingPrice(parseFloat(e.target.value) || 0)}
                                  className="w-24 px-2 py-1 border border-surface-300 rounded-lg text-right text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && editingPrice > 0) {
                                      e.stopPropagation();
                                      updatePriceMutation.mutate({ invoiceId: selectedInvoice.id, itemId: item.id, unitPrice: editingPrice });
                                    } else if (e.key === 'Escape') {
                                      setEditingItemId(null);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    if (editingPrice > 0) {
                                      updatePriceMutation.mutate({ invoiceId: selectedInvoice.id, itemId: item.id, unitPrice: editingPrice });
                                    }
                                  }}
                                  disabled={editingPrice <= 0 || updatePriceMutation.isPending}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setEditingItemId(null)}
                                  className="px-2 py-1 bg-surface-200 text-surface-700 rounded-lg text-xs hover:bg-surface-300"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={cn('font-medium', isZeroPrice && 'text-rose-600 cursor-pointer underline decoration-dashed')}
                                  onClick={isZeroPrice ? () => { setEditingItemId(item.id); setEditingPrice(Number(item.unitPrice) || 0); } : undefined}
                                  title={isZeroPrice ? 'Click to set price' : undefined}
                                >
                                  {isZeroPrice ? 'Set price' : formatCurrency(item.amount)}
                                </span>
                                {isPayable && (
                                  <button
                                    onClick={async () => {
                                      const ok = await confirmDialog({
                                        title: 'Remove invoice item',
                                        message: `Remove "${item.description}" from this invoice? The amount due will be recalculated.`,
                                        confirmLabel: 'Remove item',
                                        variant: 'danger',
                                      });
                                      if (ok) removeItemMutation.mutate({ invoiceId: selectedInvoice.id, itemId: item.id });
                                    }}
                                    disabled={removeItemMutation.isPending}
                                    className="p-1 text-surface-300 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    title="Remove item"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-3 text-center text-surface-400 text-sm">No items on this invoice</div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="mt-2 pt-2 border-t border-surface-100 space-y-1 text-sm">
                    <div className="flex justify-between text-surface-600">
                      <span>Total</span>
                      <span className="font-medium">{formatCurrency(selectedInvoice.totalAmount)}</span>
                    </div>
                    {selectedInvoice.paymentType === 'insurance' && Number(selectedInvoice.insuranceAmount || 0) > 0 && (
                      <>
                        <div className="flex justify-between text-brand-600">
                          <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Insurance covers</span>
                          <span className="font-medium">-{formatCurrency(selectedInvoice.insuranceAmount || 0)}</span>
                        </div>
                        {Number(selectedInvoice.copayAmount || 0) > 0 && (
                          <div className="flex justify-between text-surface-500">
                            <span className="pl-5">Patient copay</span>
                            <span>{formatCurrency(selectedInvoice.copayAmount || 0)}</span>
                          </div>
                        )}
                      </>
                    )}
                    {Number(selectedInvoice.amountPaid) > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Already paid</span>
                        <span>{formatCurrency(selectedInvoice.amountPaid)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-surface-100">
                      <span className="font-semibold text-surface-900">Due now</span>
                      <span className="font-bold text-lg text-surface-900">{formatCurrency(dueNow(selectedInvoice))}</span>
                    </div>
                  </div>
                </div>

                {/* Tender */}
                {isPayable ? (
                  <div className="px-4 py-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Amount received</label>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setPaymentAmount(dueNow(selectedInvoice))}
                            className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 font-medium"
                          >
                            Exact
                          </button>
                          <button
                            onClick={() => setPaymentAmount(Math.floor(dueNow(selectedInvoice) / 2))}
                            className="text-xs px-2.5 py-1 bg-surface-100 text-surface-700 rounded-lg hover:bg-surface-200 font-medium"
                          >
                            50%
                          </button>
                        </div>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 font-semibold">UGX</span>
                        <input
                          ref={amountInputRef}
                          type="number"
                          min="0"
                          value={paymentAmount || ''}
                          onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !paymentMutation.isPending) {
                              e.preventDefault();
                              handlePayment();
                            }
                          }}
                          className="w-full pl-16 pr-4 py-3.5 border-2 border-surface-200 rounded-2xl text-right text-3xl font-mono font-bold
                            focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 focus:outline-none"
                        />
                      </div>
                      {paymentMethod === 'cash' && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {[1000, 2000, 5000, 10000, 20000, 50000].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setPaymentAmount(amt)}
                              className={cn(
                                'text-sm px-3 py-1.5 rounded-lg border transition-colors',
                                paymentAmount === amt
                                  ? 'bg-brand-100 border-brand-300 text-brand-700 font-medium'
                                  : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50',
                              )}
                            >
                              {amt.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      )}
                      {paymentMethod === 'cash' && changeAmount > 0 && (
                        <div className="mt-2 flex justify-between items-center p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-sm font-medium text-amber-800">Change due</span>
                          <span className="text-xl font-mono font-bold text-amber-900">{formatCurrency(changeAmount)}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Method</label>
                      <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
                      {paymentMethod !== 'cash' && (
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder={paymentMethod === 'mobile_money' ? 'Reference — e.g. MM-12345678 *' : paymentMethod === 'insurance' ? 'Pre-auth / Claim # *' : 'Transaction reference *'}
                          className="input mt-2"
                        />
                      )}
                    </div>

                    {paymentError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {paymentError}
                      </div>
                    )}

                    <button
                      onClick={handlePayment}
                      disabled={paymentMutation.isPending || paymentAmount <= 0 || hasZeroPriceItems || (paymentMethod !== 'cash' && !paymentReference.trim())}
                      className="w-full bg-emerald-600 text-white py-4 rounded-xl hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed
                        flex items-center justify-center gap-2 font-semibold text-lg transition-colors shadow-[0_2px_10px_rgba(5,150,105,0.35)]"
                    >
                      {paymentMutation.isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Banknote className="w-5 h-5" />
                          Collect {formatCurrency(Math.min(paymentAmount, balance))}
                          <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 border border-white/30 rounded">↵</kbd>
                        </>
                      )}
                    </button>

                    {/* Exceptions: send the patient back */}
                    {selectedInvoice.encounter?.id && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setShowReturnModal(true)}
                          className="flex-1 px-3 py-2 bg-white text-surface-600 border border-surface-200 rounded-xl hover:bg-surface-50 hover:text-amber-700 flex items-center justify-center gap-1.5 text-sm transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" /> Doctor
                        </button>
                        <button
                          onClick={() => setShowReturnPharmacyModal(true)}
                          className="flex-1 px-3 py-2 bg-white text-surface-600 border border-surface-200 rounded-xl hover:bg-surface-50 hover:text-purple-700 flex items-center justify-center gap-1.5 text-sm transition-colors"
                        >
                          <Pill className="w-4 h-4" /> Pharmacy
                        </button>
                        <button
                          onClick={() => setShowReturnLabModal(true)}
                          className="flex-1 px-3 py-2 bg-white text-surface-600 border border-surface-200 rounded-xl hover:bg-surface-50 hover:text-cyan-700 flex items-center justify-center gap-1.5 text-sm transition-colors"
                        >
                          <FlaskConical className="w-4 h-4" /> Lab
                        </button>
                      </div>
                    )}
                  </div>
                ) : selectedInvoice.status === 'paid' ? (
                  <div className="px-4 py-4 space-y-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                      <CheckCircle className="w-9 h-9 text-emerald-600 mx-auto mb-1.5" />
                      <p className="text-emerald-800 font-bold">Fully Paid</p>
                      <p className="text-emerald-600 text-sm">{formatCurrency(selectedInvoice.amountPaid)} received</p>
                    </div>
                    <button
                      onClick={() => handlePrintReceipt(selectedInvoice)}
                      className="btn-primary w-full"
                    >
                      <Printer className="w-4 h-4" /> Print Receipt
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                      <AlertCircle className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                      <p className="text-amber-800 font-medium">No balance due</p>
                      <p className="text-amber-600 text-sm mt-1">This invoice has no outstanding amount</p>
                    </div>
                  </div>
                )}

                {/* Payment history */}
                {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                  <details className="border-t border-surface-100 group">
                    <summary className="px-4 py-2.5 text-sm text-surface-500 cursor-pointer hover:bg-surface-50 flex items-center justify-between list-none">
                      <span>Payment history ({selectedInvoice.payments.length})</span>
                      <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-4 pb-3 divide-y divide-surface-100">
                      {selectedInvoice.payments.map((payment) => (
                        <div key={payment.id} className="py-2 flex justify-between text-sm">
                          <div>
                            <p className="font-medium text-surface-800">{payment.receiptNumber}</p>
                            <p className="text-xs text-surface-500">
                              <span className="capitalize">{payment.method.replace(/_/g, ' ')}</span> · {new Date(payment.paidAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-emerald-600">{formatCurrency(payment.amount)}</span>
                            <button
                              onClick={() => handlePrintReceipt(selectedInvoice, payment)}
                              className="p-1 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                              title="Reprint this receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Return to Doctor Modal */}
      {showReturnModal && selectedInvoice && (
        <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <h3 className="font-semibold text-surface-900 mb-1 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600" /> Return to Doctor
            </h3>
            <p className="text-sm text-surface-500 mb-3">
              Sends {patientOf(selectedInvoice)?.fullName || 'the patient'} back to the doctor's queue. The invoice stays open.
            </p>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Reason (required) — e.g. patient requests medication review…"
              rows={3}
              className="input w-full resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowReturnModal(false); setReturnReason(''); }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleReturnToDoctor}
                disabled={returnToDoctorMutation.isPending || !returnReason.trim()}
                className="btn-primary flex-1"
              >
                {returnToDoctorMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Return Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Pharmacy Modal */}
      {showReturnPharmacyModal && selectedInvoice && (
        <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <h3 className="font-semibold text-surface-900 mb-1 flex items-center gap-2">
              <Pill className="w-4 h-4 text-purple-600" /> Return to Pharmacy
            </h3>
            <p className="text-sm text-surface-500 mb-3">
              Sends {patientOf(selectedInvoice)?.fullName || 'the patient'} back to the pharmacy queue. The invoice stays open.
            </p>
            <textarea
              value={returnPharmacyReason}
              onChange={(e) => setReturnPharmacyReason(e.target.value)}
              placeholder="Reason (required) — e.g. dispensed item needs adjustment…"
              rows={3}
              className="input w-full resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowReturnPharmacyModal(false); setReturnPharmacyReason(''); }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleReturnToPharmacy}
                disabled={returnToPharmacyMutation.isPending || !returnPharmacyReason.trim()}
                className="btn-primary flex-1"
              >
                {returnToPharmacyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Return Patient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Lab Modal */}
      {showReturnLabModal && selectedInvoice && (
        <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <h3 className="font-semibold text-surface-900 mb-1 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-cyan-600" /> Return to Lab
            </h3>
            <p className="text-sm text-surface-500 mb-3">
              Sends {patientOf(selectedInvoice)?.fullName || 'the patient'} back to the lab queue. The invoice stays open.
            </p>
            <textarea
              value={returnLabReason}
              onChange={(e) => setReturnLabReason(e.target.value)}
              placeholder="Reason (required) — e.g. additional test ordered…"
              rows={3}
              className="input w-full resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowReturnLabModal(false); setReturnLabReason(''); }} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleReturnToLab}
                disabled={returnToLabMutation.isPending || !returnLabReason.trim()}
                className="btn-primary flex-1"
              >
                {returnToLabMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Return Patient'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
