import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CreditCard,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Receipt,
  RefreshCw,
  DollarSign,
  Banknote,
  Smartphone,
  RotateCcw,
  X,
  Pill,
  Printer,
  UserCheck,
  FlaskConical,
  Trash2,
  Shield,
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency } from '../lib/currency';
import { usePermissions } from '../components/PermissionGate';
import AccessDenied from '../components/AccessDenied';
import { printService } from '../lib/print';
import { useInstitutionInfo } from '../lib/useInstitutionInfo';
import { usePrintFormat } from '../lib/usePrintFormat';

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

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  partially_paid: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels = {
  draft: 'Draft',
  pending: 'Pending',
  partially_paid: 'Partial',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const paymentMethods = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone },
  { value: 'insurance', label: 'Insurance', icon: Receipt },
];

export default function CashierPage() {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inst = useInstitutionInfo();
  const { printFormat } = usePrintFormat();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
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
  // Fetch invoices
  const { data: invoicesData, isLoading, refetch } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
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
      const change = paymentAmount - (selectedInvoice?.balanceDue || 0);
      const receiptNum = data?.receiptNumber || data?.data?.receiptNumber || '';
      if (selectedInvoice) {
        setLastPaidInvoice({
          ...selectedInvoice,
          payments: [{ id: data?.id || '', amount: paymentAmount, method: paymentMethod, receiptNumber: receiptNum, paidAt: new Date().toISOString() }, ...(selectedInvoice.payments || [])],
        });
      }
      setCompletedPayment({
        patientName: selectedInvoice?.patient?.fullName || selectedInvoice?.patient?.mrn || 'Patient',
        invoiceNumber: selectedInvoice?.invoiceNumber || '',
        amountPaid: paymentAmount,
        method: paymentMethod,
        receiptNumber: receiptNum,
        change: change > 0 ? change : 0,
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
        setPaymentAmount(Number(updatedInvoice.balanceDue) || 0);
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
        setPaymentAmount(Number(updatedInvoice.balanceDue) || 0);
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

  const invoices: Invoice[] = Array.isArray(invoicesData) ? invoicesData : (invoicesData?.data || []);

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const patientMrn = inv.encounter?.patient?.mrn || inv.patient?.mrn || '';
    const patientName = inv.encounter?.patient?.fullName || inv.patient?.fullName || '';
    return (
      inv.invoiceNumber.toLowerCase().includes(search) ||
      patientMrn.toLowerCase().includes(search) ||
      patientName.toLowerCase().includes(search)
    );
  });

  const hasZeroPriceItems = selectedInvoice
    ? (selectedInvoice.items || []).some((item) => !item.unitPrice || Number(item.unitPrice) <= 0)
    : false;

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

  const handlePrintReceipt = (invoice: Invoice, payment?: { receiptNumber: string; amount: number; method: string; paidAt: string }) => {
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

  return (
    <div className="space-y-6">
      {/* Payment Completion Screen */}
      {completedPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-5">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900">Payment Successful!</h2>
              <p className="text-gray-500 mt-1">{completedPayment.invoiceNumber}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Patient</span>
                <span className="font-medium text-gray-900">{completedPayment.patientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount Paid</span>
                <span className="font-bold text-green-700">{formatCurrency(completedPayment.amountPaid)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Method</span>
                <span className="font-medium capitalize">{completedPayment.method.replace('_', ' ')}</span>
              </div>
              {completedPayment.receiptNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Receipt #</span>
                  <span className="font-medium">{completedPayment.receiptNumber}</span>
                </div>
              )}
              {completedPayment.change > 0 && (
                <div className="flex justify-between text-sm border-t pt-2 mt-2">
                  <span className="text-gray-500">Change Due</span>
                  <span className="font-bold text-blue-700">{formatCurrency(completedPayment.change)}</span>
                </div>
              )}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-left">
              <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> Patient Complete
              </p>
              <p className="text-xs text-green-700 mt-1">
                Payment received. Give the patient their receipt and direct them to exit. Thank them for visiting.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (lastPaidInvoice) {
                    handlePrintReceipt(lastPaidInvoice);
                  }
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Printer className="w-5 h-5" />
                Print Receipt
              </button>
              <button
                onClick={() => setCompletedPayment(null)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                <DollarSign className="w-5 h-5" />
                Next Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashier</h1>
          <p className="text-gray-600">Collect payments and issue receipts</p>
        </div>
        <button
          onClick={() => { refetch(); queryClient.invalidateQueries({ queryKey: ['invoices-pending-stats'] }); queryClient.invalidateQueries({ queryKey: ['daily-revenue'] }); }}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">{pendingCount}</p>
              <p className="text-sm text-yellow-700">Pending Invoices</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-900">{formatCurrency(pendingAmount)}</p>
              <p className="text-sm text-red-700">Outstanding Balance</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(todayCollected)}</p>
              <p className="text-sm text-green-700">Collected Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by invoice #, MRN, or patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Invoices</h2>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No invoices found</p>
              </div>
            ) : (
              filteredInvoices.map((inv) => (
                <div
                  key={inv.id}
                  onClick={() => {
                    setSelectedInvoice(inv);
                    setPaymentAmount(
                      inv.paymentType === 'insurance' && inv.patientResponsibility != null
                        ? Number(inv.patientResponsibility)
                        : Number(inv.balanceDue) || 0
                    );
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedInvoice?.id === inv.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{inv.invoiceNumber}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[inv.status]}`}>
                          {statusLabels[inv.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{inv.patient?.fullName || inv.encounter?.patient?.fullName || 'Unknown'}</span>
                        <span className="text-gray-400">•</span>
                        <span>{inv.patient?.mrn || inv.encounter?.patient?.mrn || 'N/A'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {inv.items?.length || 0} item(s) • {inv.encounter?.type?.toUpperCase() || inv.items?.[0]?.chargeType || 'Walk-in'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end">
                        <p className="font-semibold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
                        {inv.paymentType === 'insurance' && (
                          <span className="ml-1 inline-flex items-center text-[10px] text-blue-500">
                            <Shield className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      {(Number(inv.balanceDue) || 0) > 0 && (Number(inv.balanceDue) || 0) < (Number(inv.totalAmount) || 0) && (
                        <p className="text-xs text-red-600">
                          Balance: {formatCurrency(inv.balanceDue)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Payment Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Payment</h2>
          </div>
          {selectedInvoice ? (
            <div className="p-4">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedInvoice.patient?.fullName || selectedInvoice.encounter?.patient?.fullName || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">
                      {selectedInvoice.patient?.mrn || selectedInvoice.encounter?.patient?.mrn || 'N/A'} • {selectedInvoice.invoiceNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Invoice Items */}
              <div className="space-y-2 mb-4">
                <h3 className="font-medium text-gray-900">Invoice Items</h3>
                {hasZeroPriceItems && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">Some items have no price. Click the price to set it before collecting payment.</p>
                  </div>
                )}
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {(selectedInvoice.items || []).length > 0 ? (
                    selectedInvoice.items.map((item) => {
                      const isZeroPrice = !item.unitPrice || Number(item.unitPrice) <= 0;
                      const isEditing = editingItemId === item.id;
                      return (
                        <div key={item.id} className={`p-2 flex justify-between items-center text-sm ${isZeroPrice ? 'bg-red-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <span className={isZeroPrice ? 'text-red-700' : 'text-gray-700'}>
                              {item.description} x{item.quantity}
                            </span>
                            {item.insuranceCovered && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded-full">
                                <Shield className="w-2.5 h-2.5" />
                                Covered
                              </span>
                            )}
                            {item.insuranceCovered === false && item.coverageNote && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] rounded-full">
                                Not covered
                              </span>
                            )}
                            {item.coverageNote === 'Requires pre-authorization' && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] rounded-full">
                                Pre-auth
                              </span>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="1"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border rounded text-right text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && editingPrice > 0) {
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
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingItemId(null)}
                                className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium ${isZeroPrice ? 'text-red-600 cursor-pointer underline decoration-dashed' : ''}`}
                                onClick={isZeroPrice ? () => { setEditingItemId(item.id); setEditingPrice(Number(item.unitPrice) || 0); } : undefined}
                                title={isZeroPrice ? 'Click to set price' : undefined}
                              >
                                {isZeroPrice ? 'Set price' : formatCurrency(item.amount)}
                              </span>
                              <button
                                onClick={() => {
                                  if (confirm(`Remove "${item.description}" from this invoice?`)) {
                                    removeItemMutation.mutate({ invoiceId: selectedInvoice.id, itemId: item.id });
                                  }
                                }}
                                disabled={removeItemMutation.isPending}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3 text-center text-gray-500 text-sm">No items on this invoice</div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-semibold">{formatCurrency(selectedInvoice.totalAmount)}</span>
                </div>
                {selectedInvoice.paymentType === 'insurance' && Number(selectedInvoice.insuranceAmount || 0) > 0 && (
                  <>
                    <div className="flex justify-between text-blue-600">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" />
                        Insurance Covers
                      </span>
                      <span className="font-medium">-{formatCurrency(selectedInvoice.insuranceAmount || 0)}</span>
                    </div>
                    {Number(selectedInvoice.copayAmount || 0) > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span className="pl-5">Patient Copay</span>
                        <span>{formatCurrency(selectedInvoice.copayAmount || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-1">
                      <span className="font-medium text-gray-700">Patient Responsibility</span>
                      <span className="font-bold text-orange-600">{formatCurrency(selectedInvoice.patientResponsibility || selectedInvoice.balanceDue)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Paid Amount</span>
                  <span className="text-green-600">{formatCurrency(selectedInvoice.amountPaid)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium text-gray-900">Balance Due</span>
                  <span className="font-bold text-red-600">{formatCurrency(selectedInvoice.balanceDue)}</span>
                </div>
              </div>

              {selectedInvoice.status !== 'paid' && (Number(selectedInvoice.balanceDue) || 0) > 0 && (
                <>
                  {/* Payment Method */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      {paymentMethods.map((method) => {
                        const Icon = method.icon;
                        return (
                          <button
                            key={method.value}
                            onClick={() => setPaymentMethod(method.value)}
                            className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                              paymentMethod === method.value
                                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-sm font-medium">{method.label}</span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                  {/* Payment Amount */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">UGX</span>
                      <input
                        type="number"
                        min="0"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                        className="w-full pl-14 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right text-xl font-bold"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setPaymentAmount(
                          selectedInvoice.paymentType === 'insurance' && selectedInvoice.patientResponsibility != null
                            ? Number(selectedInvoice.patientResponsibility)
                            : Number(selectedInvoice.balanceDue) || 0
                        )}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
                      >
                        Exact Amount
                      </button>
                      <button
                        onClick={() => setPaymentAmount(Math.floor((
                          selectedInvoice.paymentType === 'insurance' && selectedInvoice.patientResponsibility != null
                            ? Number(selectedInvoice.patientResponsibility)
                            : Number(selectedInvoice.balanceDue) || 0
                        ) / 2))}
                        className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                      >
                        50%
                      </button>
                    </div>
                    {/* Quick denomination buttons for cash */}
                    {paymentMethod === 'cash' && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Quick denominations:</p>
                        <div className="flex flex-wrap gap-1">
                          {[1000, 2000, 5000, 10000, 20000, 50000].map((amt) => (
                            <button
                              key={amt}
                              onClick={() => setPaymentAmount(amt)}
                              className={`text-xs px-2 py-1 rounded border transition-colors ${
                                paymentAmount === amt
                                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {amt.toLocaleString()}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Change Due for Cash */}
                  {paymentMethod === 'cash' && changeAmount > 0 && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-amber-800">Change Due</span>
                        <span className="text-lg font-bold text-amber-900">{formatCurrency(changeAmount)}</span>
                      </div>
                    </div>
                  )}

                  {/* Reference for non-cash */}
                  {paymentMethod !== 'cash' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reference # <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder={paymentMethod === 'mobile_money' ? 'e.g., MM-12345678' : paymentMethod === 'insurance' ? 'Pre-auth / Claim #' : 'Transaction reference...'}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {paymentError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {paymentError}
                    </div>
                  )}

                  {/* Pay Button */}
                  <button
                    onClick={handlePayment}
                    disabled={paymentMutation.isPending || paymentAmount <= 0 || hasZeroPriceItems || (paymentMethod !== 'cash' && !paymentReference.trim())}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-lg transition-colors"
                  >
                    {paymentMutation.isPending ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Pay {formatCurrency(Math.min(paymentAmount, Number(selectedInvoice.balanceDue) || 0))}
                      </>
                    )}
                  </button>

                  {/* Secondary Actions */}
                  {selectedInvoice.encounter?.id && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={() => setShowReturnModal(true)}
                        className="flex-1 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
                        title="Return patient to doctor"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Return to Doctor
                      </button>
                      <button
                        onClick={() => setShowReturnPharmacyModal(true)}
                        className="flex-1 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
                        title="Return patient to pharmacy"
                      >
                        <Pill className="w-4 h-4" />
                        Return to Pharmacy
                      </button>
                      <button
                        onClick={() => setShowReturnLabModal(true)}
                        className="flex-1 px-3 py-2 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg hover:bg-cyan-100 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
                        title="Return patient to lab"
                      >
                        <FlaskConical className="w-4 h-4" />
                        Return to Lab
                      </button>
                    </div>
                  )}
                </>
              )}

              {selectedInvoice.status !== 'paid' && (Number(selectedInvoice.balanceDue) || 0) <= 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
                  <p className="text-yellow-800 font-medium">No balance due</p>
                  <p className="text-yellow-600 text-sm mt-1">This invoice has no outstanding amount</p>
                </div>
              )}

              {selectedInvoice.status === 'paid' && (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                    <p className="text-green-800 font-bold text-lg">Fully Paid</p>
                    <p className="text-green-600 text-sm mt-1">
                      {formatCurrency(selectedInvoice.amountPaid)} received
                    </p>
                  </div>
                  <button
                    onClick={() => handlePrintReceipt(selectedInvoice)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Print Receipt
                  </button>
                </div>
              )}

              {/* Payment History */}
              {selectedInvoice.payments && selectedInvoice.payments.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-gray-900 mb-2">Payment History</h3>
                  <div className="border rounded-lg divide-y">
                    {selectedInvoice.payments.map((payment) => (
                      <div key={payment.id} className="p-2 flex justify-between text-sm">
                        <div>
                          <p className="font-medium">{payment.receiptNumber}</p>
                          <p className="text-xs text-gray-500">
                            {payment.method} • {new Date(payment.paidAt).toLocaleString()}
                          </p>
                        </div>
                        <span className="font-medium text-green-600">{formatCurrency(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Select an invoice to process payment</p>
            </div>
          )}
        </div>
      </div>

      {/* Return to Doctor Modal */}
      {showReturnModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-orange-500" />
                Return Patient to Doctor
              </h3>
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Patient: <span className="font-medium">{selectedInvoice.patient?.fullName || selectedInvoice.encounter?.patient?.fullName}</span>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Invoice: <span className="font-medium">{selectedInvoice.invoiceNumber}</span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Return <span className="text-red-500">*</span>
              </label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="e.g., Need prescription adjustment, Additional consultation required, Lab results need review..."
              />
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500">
                Common reasons:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  'Prescription adjustment needed',
                  'Additional consultation required',
                  'Lab results need review',
                  'Patient has questions',
                  'Insurance pre-auth issue',
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReturnReason(reason)}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReturnModal(false);
                  setReturnReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnToDoctor}
                disabled={returnToDoctorMutation.isPending || !returnReason.trim()}
                className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {returnToDoctorMutation.isPending ? 'Processing...' : 'Return to Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Pharmacy Modal */}
      {showReturnPharmacyModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Pill className="w-5 h-5 text-purple-500" />
                Return Patient to Pharmacy
              </h3>
              <button
                onClick={() => {
                  setShowReturnPharmacyModal(false);
                  setReturnPharmacyReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Patient: <span className="font-medium">{selectedInvoice.patient?.fullName || selectedInvoice.encounter?.patient?.fullName}</span>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Invoice: <span className="font-medium">{selectedInvoice.invoiceNumber}</span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Return <span className="text-red-500">*</span>
              </label>
              <textarea
                value={returnPharmacyReason}
                onChange={(e) => setReturnPharmacyReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., Wrong medication, Dosage adjustment needed, Out of stock alternative..."
              />
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500">
                Common reasons:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  'Wrong medication dispensed',
                  'Dosage adjustment needed',
                  'Alternative medication required',
                  'Additional medications needed',
                  'Insurance coverage issue',
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReturnPharmacyReason(reason)}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReturnPharmacyModal(false);
                  setReturnPharmacyReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnToPharmacy}
                disabled={returnToPharmacyMutation.isPending || !returnPharmacyReason.trim()}
                className="flex-1 bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Pill className="w-4 h-4" />
                {returnToPharmacyMutation.isPending ? 'Processing...' : 'Return to Pharmacy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return to Lab Modal */}
      {showReturnLabModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-cyan-500" />
                Return Patient to Lab
              </h3>
              <button
                onClick={() => {
                  setShowReturnLabModal(false);
                  setReturnLabReason('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Patient: <span className="font-medium">{selectedInvoice.patient?.fullName || selectedInvoice.encounter?.patient?.fullName}</span>
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Invoice: <span className="font-medium">{selectedInvoice.invoiceNumber}</span>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Return <span className="text-red-500">*</span>
              </label>
              <textarea
                value={returnLabReason}
                onChange={(e) => setReturnLabReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="e.g., Additional tests required, Retest needed, Sample issue..."
              />
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500">
                Common reasons:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  'Additional tests required',
                  'Retest needed - inconclusive results',
                  'Sample quality issue',
                  'Doctor requested repeat',
                  'Wrong test performed',
                ].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setReturnLabReason(reason)}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReturnLabModal(false);
                  setReturnLabReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReturnToLab}
                disabled={returnToLabMutation.isPending || !returnLabReason.trim()}
                className="flex-1 bg-cyan-500 text-white py-2 px-4 rounded-lg hover:bg-cyan-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <FlaskConical className="w-4 h-4" />
                {returnToLabMutation.isPending ? 'Processing...' : 'Return to Lab'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
