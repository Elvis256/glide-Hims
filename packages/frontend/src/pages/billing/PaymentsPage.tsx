import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENCY_SYMBOL, formatCurrency } from '../../lib/currency';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Shield,
  Search,
  Filter,
  Plus,
  Download,
  X,
  Clock,
  User,
  Receipt,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  TrendingUp,
  DollarSign,
  FileText,
  Loader2,
} from 'lucide-react';
import { billingService, type Payment } from '../../services';

type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'insurance';

// Empty fallback when API is unavailable
const emptyPayments: Payment[] = [];

const cashiers = ['All Cashiers', 'Jane Kamau', 'Samuel Otieno'];

const methodConfig: Record<PaymentMethod, { label: string; icon: React.ElementType; color: string }> = {
  cash: { label: 'Cash', icon: Banknote, color: 'bg-green-100 text-green-700' },
  card: { label: 'Card', icon: CreditCard, color: 'bg-blue-100 text-blue-700' },
  mobile_money: { label: 'Mobile Money', icon: Smartphone, color: 'bg-orange-100 text-orange-700' },
  insurance: { label: 'Insurance', icon: Shield, color: 'bg-purple-100 text-purple-700' },
};

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
  const [cashierFilter, setCashierFilter] = useState('All Cashiers');
  const [showFilters, setShowFilters] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [showRecordPayment, setShowRecordPayment] = useState(false);

  // Payment form state
  const [billNumber, setBillNumber] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');

  // Fetch payments from API with filters
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments', dateFilter, methodFilter],
    queryFn: () => billingService.payments.list({
      startDate: dateFilter,
      endDate: dateFilter,
      method: methodFilter !== 'all' ? methodFilter : undefined,
    }),
    staleTime: 30000,
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { invoiceNumber: string; amount: number; paymentMethod: string; referenceNumber?: string }) => {
      // Look up invoice by number first
      const invoice = await billingService.invoices.getByNumber(data.invoiceNumber);
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      return billingService.payments.record(invoice.id, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setShowRecordPayment(false);
      setBillNumber('');
      setPaymentAmount('');
      setSelectedMethod('cash');
      setReferenceNumber('');
      setFoundInvoice(null);
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to record payment');
    },
  });

  // Invoice lookup
  const [foundInvoice, setFoundInvoice] = useState<{ id: string; invoiceNumber: string; totalAmount: number; balance: number; patientName?: string } | null>(null);
  const [lookupError, setLookupError] = useState('');

  const handleLookupInvoice = async () => {
    if (!billNumber) return;
    setLookupError('');
    try {
      const invoice = await billingService.invoices.getByNumber(billNumber);
      setFoundInvoice({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        balance: invoice.balance,
        patientName: invoice.patient?.fullName,
      });
      setPaymentAmount(invoice.balance.toString());
    } catch {
      setLookupError('Invoice not found');
      setFoundInvoice(null);
    }
  };

  // Void payment mutation
  const voidPaymentMutation = useMutation({
    mutationFn: (data: { paymentId: string; reason: string }) =>
      billingService.payments.void(data.paymentId, data.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setVoidingPayment(null);
      setVoidReason('');
    },
  });

  const payments = paymentsData || emptyPayments;

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const search = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery ||
        payment.receiptNumber?.toLowerCase().includes(search) ||
        payment.invoiceId?.toLowerCase().includes(search) ||
        payment.patientName?.toLowerCase().includes(search) ||
        payment.invoice?.invoiceNumber?.toLowerCase().includes(search);
      const matchesMethod = methodFilter === 'all' || payment.paymentMethod === methodFilter;
      const matchesCashier = cashierFilter === 'All Cashiers' || payment.receivedBy === cashierFilter;
      return matchesSearch && matchesMethod && matchesCashier;
    });
  }, [searchQuery, methodFilter, cashierFilter, payments]);

  const todaySummary = useMemo(() => {
    const todayPayments = payments.filter((p) => p.status === 'completed');
    const total = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const cash = todayPayments.filter((p) => p.paymentMethod === 'cash').reduce((sum, p) => sum + (p.amount || 0), 0);
    const card = todayPayments.filter((p) => p.paymentMethod === 'card').reduce((sum, p) => sum + (p.amount || 0), 0);
    const mobile = todayPayments.filter((p) => p.paymentMethod === 'mobile_money').reduce((sum, p) => sum + (p.amount || 0), 0);
    const insurance = todayPayments.filter((p) => p.paymentMethod === 'insurance').reduce((sum, p) => sum + (p.amount || 0), 0);
    const count = todayPayments.length;
    return { total, cash, card, mobile, insurance, count };
  }, [payments]);

  const reconciliation = useMemo(() => {
    const completed = payments.filter((p) => p.status === 'completed').length;
    const voided = payments.filter((p) => p.status === 'voided').length;
    const voidedAmount = payments.filter((p) => p.status === 'voided').reduce((sum, p) => sum + (p.amount || 0), 0);
    return { completed, voided, voidedAmount };
  }, [payments]);

  const handleExportReport = () => {
    const headers = ['Receipt #', 'Patient', 'Invoice #', 'Amount', 'Method', 'Cashier', 'Date/Time', 'Status'];
    const rows = filteredPayments.map(p => [
      p.receiptNumber || '-',
      p.patientName || '-',
      p.invoiceId?.substring(0, 8) || '-',
      p.amount || 0,
      methodConfig[p.paymentMethod as PaymentMethod]?.label || p.paymentMethod || '-',
      p.receivedBy || '-',
      p.paidAt ? new Date(p.paidAt).toLocaleString('en-UG') : '-',
      p.status || 'completed',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-report-${dateFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleVoidPayment = () => {
    if (voidingPayment && voidReason) {
      voidPaymentMutation.mutate({ paymentId: voidingPayment.id, reason: voidReason });
    }
  };

  const handleRecordPayment = () => {
    if (foundInvoice && paymentAmount) {
      recordPaymentMutation.mutate({
        invoiceNumber: foundInvoice.invoiceNumber,
        amount: parseFloat(paymentAmount),
        paymentMethod: selectedMethod,
        referenceNumber: referenceNumber || undefined,
      });
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
            <p className="text-sm text-gray-500 mt-1">Track and manage all payment transactions</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button
              onClick={() => setShowRecordPayment(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          </div>
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-6 gap-4 mt-4">
          <div className="col-span-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-4 text-white">
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <TrendingUp className="w-4 h-4" />
              Total Collected Today
            </div>
            <p className="text-3xl font-bold mt-2">{formatCurrency(todaySummary.total)}</p>
            <p className="text-blue-200 text-sm mt-1">{todaySummary.count} transactions</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Banknote className="w-4 h-4" />
              Cash
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(todaySummary.cash)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <CreditCard className="w-4 h-4" />
              Card
            </div>
            <p className="text-xl font-bold text-blue-700 mt-1">{formatCurrency(todaySummary.card)}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <Smartphone className="w-4 h-4" />
              Mobile Money
            </div>
            <p className="text-xl font-bold text-orange-700 mt-1">{formatCurrency(todaySummary.mobile)}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-2 text-purple-600 text-sm">
              <Shield className="w-4 h-4" />
              Insurance
            </div>
            <p className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(todaySummary.insurance)}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by receipt, patient, or bill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Reconciliation Summary */}
          <div className="ml-auto flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>{reconciliation.completed} completed</span>
            </div>
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              <span>{reconciliation.voided} voided ({formatCurrency(reconciliation.voidedAmount)})</span>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | 'all')}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="insurance">Insurance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cashier</label>
              <select
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {cashiers.map((cashier) => (
                  <option key={cashier} value={cashier}>{cashier}</option>
                ))}
              </select>
            </div>
            {(dateFilter || methodFilter !== 'all' || cashierFilter !== 'All Cashiers') && (
              <button
                onClick={() => {
                  setDateFilter('');
                  setMethodFilter('all');
                  setCashierFilter('All Cashiers');
                }}
                className="text-sm text-blue-600 hover:underline mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Payment List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Receipt #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Bill #</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cashier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  </td>
                </tr>
              )}
              {!isLoading && filteredPayments.map((payment) => {
                const method = (payment.paymentMethod || 'cash') as PaymentMethod;
                const MethodIcon = methodConfig[method]?.icon || Banknote;
                const methodColor = methodConfig[method]?.color || 'bg-gray-100 text-gray-700';
                const methodLabel = methodConfig[method]?.label || payment.paymentMethod;
                const paymentTime = payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' }) : '';
                return (
                  <tr key={payment.id} className={`hover:bg-gray-50 ${payment.status === 'voided' ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600">{payment.receiptNumber || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{payment.patientName || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{payment.invoiceId || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(payment.amount || 0)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${methodColor}`}>
                        <MethodIcon className="w-3 h-3" />
                        {methodLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{payment.receivedBy || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {paymentTime}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {payment.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Completed
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <X className="w-3 h-3" />
                            Voided
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700">
                          <Receipt className="w-4 h-4" />
                        </button>
                        {payment.status === 'completed' && (
                          <button
                            onClick={() => setVoidingPayment(payment)}
                            className="p-1.5 hover:bg-red-100 rounded-lg text-gray-500 hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredPayments.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No payments found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Void Payment Modal */}
      {voidingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="text-lg font-bold">Void Payment</h2>
              </div>
              <button onClick={() => setVoidingPayment(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Receipt #</p>
                    <p className="font-medium">{voidingPayment.receiptNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Amount</p>
                    <p className="font-medium text-lg">{formatCurrency(voidingPayment.amount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Invoice</p>
                    <p className="font-medium">{voidingPayment.invoiceId || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Method</p>
                    <p className="font-medium">{methodConfig[(voidingPayment.paymentMethod || 'cash') as PaymentMethod]?.label || voidingPayment.paymentMethod}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for voiding <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Enter reason for voiding this payment..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 h-24 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setVoidingPayment(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleVoidPayment}
                disabled={!voidReason || voidPaymentMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {voidPaymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Void Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Record New Payment</h2>
              <button onClick={() => { setShowRecordPayment(false); setFoundInvoice(null); setLookupError(''); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice/Bill Number *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={billNumber}
                      onChange={(e) => { setBillNumber(e.target.value); setFoundInvoice(null); setLookupError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookupInvoice()}
                      placeholder="e.g. INV202602010001"
                      className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleLookupInvoice}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>
                {lookupError && <p className="text-red-500 text-sm mt-1">{lookupError}</p>}
              </div>

              {foundInvoice && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">Invoice Found</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">Patient:</span>
                      <span className="ml-1 font-medium">{foundInvoice.patientName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>
                      <span className="ml-1 font-medium">{formatCurrency(foundInvoice.totalAmount)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Balance Due:</span>
                      <span className="ml-1 font-bold text-lg text-green-700">{formatCurrency(foundInvoice.balance)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{CURRENCY_SYMBOL}</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={!foundInvoice}
                    className="w-full pl-12 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['cash', 'card', 'mobile_money', 'insurance'] as PaymentMethod[]).map((method) => {
                    const config = methodConfig[method];
                    const Icon = config.icon;
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setSelectedMethod(method)}
                        className={`flex flex-col items-center gap-1 p-3 border rounded-lg transition-colors ${
                          selectedMethod === method
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${selectedMethod === method ? 'text-blue-600' : 'text-gray-600'}`} />
                        <span className="text-xs font-medium">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Transaction reference (optional)"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {recordPaymentMutation.isError && (
                <p className="text-sm text-red-600">Failed to record payment. Please try again.</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => { setShowRecordPayment(false); setFoundInvoice(null); setLookupError(''); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={!foundInvoice || !paymentAmount || parseFloat(paymentAmount) <= 0 || recordPaymentMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {recordPaymentMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
