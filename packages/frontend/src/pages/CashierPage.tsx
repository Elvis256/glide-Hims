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
} from 'lucide-react';
import api from '../services/api';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
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
    patient?: {
      id: string;
      mrn: string;
      fullName: string;
    };
  };
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentReference, setPaymentReference] = useState<string>('');

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment recorded successfully');
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

  const invoices: Invoice[] = invoicesData?.data || [];

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

  const handlePayment = () => {
    if (!selectedInvoice) return;
    
    const balance = Number(selectedInvoice.balanceDue) || 0;

    if (paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > balance) {
      toast.error('Payment amount cannot exceed balance');
      return;
    }

    paymentMutation.mutate({
      invoiceId: selectedInvoice.id,
      amount: paymentAmount,
      method: paymentMethod,
      reference: paymentReference || undefined,
    });
  };

  // Stats - use correct field names and handle NaN
  const pendingCount = invoices.filter((inv) => inv.status === 'pending').length;
  const pendingAmount = invoices
    .filter((inv) => ['pending', 'partially_paid'].includes(inv.status))
    .reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
  const todayCollected = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.amountPaid) || 0), 0);

  const formatCurrency = (amount: number | undefined | null) => {
    const safeAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
    }).format(safeAmount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cashier</h1>
          <p className="text-gray-600">Collect payments and issue receipts</p>
        </div>
        <button
          onClick={() => refetch()}
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
                    setPaymentAmount(Number(inv.balanceDue) || 0);
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
                        {inv.items?.length || 0} item(s) • {inv.encounter?.visitNumber || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(inv.totalAmount)}</p>
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
                <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {(selectedInvoice.items || []).length > 0 ? (
                    selectedInvoice.items.map((item) => (
                      <div key={item.id} className="p-2 flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.description} x{item.quantity}
                        </span>
                        <span className="font-medium">{formatCurrency(item.amount)}</span>
                      </div>
                    ))
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
                            className={`flex items-center gap-2 p-3 rounded-lg border ${
                              paymentMethod === method.value
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">UGX</span>
                      <input
                        type="number"
                        min="0"
                        max={Number(selectedInvoice.balanceDue) || 0}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                        className="w-full pl-14 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-right text-lg font-semibold"
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setPaymentAmount(Number(selectedInvoice.balanceDue) || 0)}
                        className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        Full Amount
                      </button>
                      <button
                        onClick={() => setPaymentAmount(Math.floor((Number(selectedInvoice.balanceDue) || 0) / 2))}
                        className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        50%
                      </button>
                    </div>
                  </div>

                  {/* Reference */}
                  {paymentMethod !== 'cash' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reference #</label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="Transaction reference..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {paymentError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {paymentError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={handlePayment}
                      disabled={paymentMutation.isPending || paymentAmount <= 0}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {paymentMutation.isPending ? 'Processing...' : `Pay ${formatCurrency(paymentAmount)}`}
                    </button>
                    {selectedInvoice.encounter?.id && (
                      <button
                        onClick={() => navigate(`/encounters/${selectedInvoice.encounter?.id}`)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        View Visit
                      </button>
                    )}
                  </div>
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
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-green-800 font-medium">Fully Paid</p>
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
    </div>
  );
}
