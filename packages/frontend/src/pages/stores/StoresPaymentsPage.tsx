import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  DollarSign,
  Building2,
  Calendar,
  Filter,
  Eye,
  ChevronRight,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Banknote,
  FileText,
  Download,
  Loader2,
  X,
  Receipt,
} from 'lucide-react';
import {
  procurementService,
  type GoodsReceipt,
} from '../../services/procurement';
import { formatCurrency } from '../../lib/currency';

type PaymentStatus = 'Pending' | 'Scheduled' | 'Processing' | 'Paid' | 'Overdue';

interface Payment {
  id: string;
  paymentRef: string;
  supplier: string;
  supplierId: string;
  supplierBank: string;
  accountNumber: string;
  invoices: string[];
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  paymentDate?: string;
  paymentMethod?: string;
  transactionRef?: string;
  grnNumber: string;
}

interface SupplierBalance {
  id: string;
  supplier: string;
  totalOutstanding: number;
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  lastPayment: string;
  lastPaymentAmount: number;
}

interface RecordPaymentDto {
  grnId: string;
  amount: number;
  paymentMethod: string;
  transactionRef?: string;
  paymentDate: string;
  notes?: string;
}

// Transform goods receipts to payment format
const transformToPayment = (grn: GoodsReceipt): Payment => {
  const dueDate = grn.invoiceDate
    ? new Date(new Date(grn.invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(new Date(grn.receivedDate).getTime() + 30 * 24 * 60 * 60 * 1000);

  const today = new Date();
  const isOverdue = dueDate < today && grn.status !== 'posted';
  const isPaid = grn.status === 'posted';

  return {
    id: grn.id,
    paymentRef: `PAY-${grn.grnNumber}`,
    supplier: grn.supplier?.name || 'Unknown Supplier',
    supplierId: grn.supplierId,
    supplierBank: '',
    accountNumber: '',
    invoices: [grn.invoiceNumber || `INV-${grn.grnNumber}`],
    amount: grn.invoiceAmount || grn.totalAmount,
    dueDate: dueDate.toLocaleDateString(),
    status: isPaid ? 'Paid' : isOverdue ? 'Overdue' : grn.status === 'approved' ? 'Scheduled' : 'Pending',
    paymentDate: isPaid ? new Date(grn.postedAt || grn.approvedAt || grn.updatedAt).toLocaleDateString() : undefined,
    paymentMethod: isPaid ? 'Bank Transfer' : undefined,
    transactionRef: isPaid ? `TXN-${grn.id.substring(0, 8)}` : undefined,
    grnNumber: grn.grnNumber,
  };
};

// Calculate supplier balances from goods receipts
const calculateSupplierBalances = (grns: GoodsReceipt[]): SupplierBalance[] => {
  const supplierMap = new Map<string, SupplierBalance>();
  const today = new Date();

  grns.forEach(grn => {
    const supplierName = grn.supplier?.name || 'Unknown Supplier';
    const supplierId = grn.supplierId;
    const amount = grn.invoiceAmount || grn.totalAmount;
    const invoiceDate = new Date(grn.invoiceDate || grn.receivedDate);
    const daysSinceInvoice = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    const isPaid = grn.status === 'posted';

    if (!supplierMap.has(supplierId)) {
      supplierMap.set(supplierId, {
        id: supplierId,
        supplier: supplierName,
        totalOutstanding: 0,
        current: 0,
        days30: 0,
        days60: 0,
        days90Plus: 0,
        lastPayment: '',
        lastPaymentAmount: 0,
      });
    }

    const balance = supplierMap.get(supplierId)!;

    if (!isPaid) {
      balance.totalOutstanding += amount;
      if (daysSinceInvoice <= 30) {
        balance.current += amount;
      } else if (daysSinceInvoice <= 60) {
        balance.days30 += amount;
      } else if (daysSinceInvoice <= 90) {
        balance.days60 += amount;
      } else {
        balance.days90Plus += amount;
      }
    } else {
      if (!balance.lastPayment || new Date(grn.postedAt || grn.approvedAt || grn.updatedAt) > new Date(balance.lastPayment)) {
        balance.lastPayment = new Date(grn.postedAt || grn.approvedAt || grn.updatedAt).toLocaleDateString();
        balance.lastPaymentAmount = amount;
      }
    }
  });

  return Array.from(supplierMap.values());
};

export default function StoresPaymentsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'All'>('All');
  const [activeTab, setActiveTab] = useState<'payments' | 'balances' | 'history'>('payments');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false);

  const facilityId = localStorage.getItem('facilityId') || '';

  // Fetch goods receipts from API (payments are derived from approved/posted GRNs)
  const { data: goodsReceipts = [], isLoading, error } = useQuery({
    queryKey: ['stores-payments-grns', facilityId],
    queryFn: () => procurementService.goodsReceipts.list({
      facilityId: facilityId || undefined,
    }),
    staleTime: 30000,
  });

  // Transform data
  const payments = useMemo(() =>
    goodsReceipts.map(transformToPayment),
    [goodsReceipts]
  );

  const supplierBalances = useMemo(() =>
    calculateSupplierBalances(goodsReceipts),
    [goodsReceipts]
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesSearch =
        payment.paymentRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || payment.status === statusFilter;
      const matchesTab =
        activeTab === 'history' ? payment.status === 'Paid' : payment.status !== 'Paid';
      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [payments, searchTerm, statusFilter, activeTab]);

  const stats = useMemo(() => {
    const totalOutstanding = payments
      .filter(p => p.status !== 'Paid')
      .reduce((sum, p) => sum + p.amount, 0);
    const overdue = payments
      .filter(p => p.status === 'Overdue')
      .reduce((sum, p) => sum + p.amount, 0);
    const scheduled = payments
      .filter(p => p.status === 'Scheduled')
      .reduce((sum, p) => sum + p.amount, 0);
    const paidThisMonth = payments
      .filter(p => p.status === 'Paid')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalOutstanding,
      overdue,
      scheduled,
      paidThisMonth,
      pendingCount: payments.filter(p => p.status === 'Pending' || p.status === 'Overdue').length,
      overdueCount: payments.filter(p => p.status === 'Overdue').length,
    };
  }, [payments]);

  // Record payment mutation - uses GRN posting as payment confirmation
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: RecordPaymentDto) => {
      // Post the GRN to mark as paid
      await procurementService.goodsReceipts.post(data.grnId);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-payments-grns'] });
      setShowRecordPaymentModal(false);
      setSelectedPayment(null);
    },
  });

  const handleRecordPayment = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowRecordPaymentModal(true);
  };

  const handleViewDetails = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowPaymentDetailModal(true);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <p className="text-red-600">Failed to load payment data</p>
      </div>
    );
  }

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'Pending': return 'bg-gray-100 text-gray-700';
      case 'Scheduled': return 'bg-blue-100 text-blue-700';
      case 'Processing': return 'bg-yellow-100 text-yellow-700';
      case 'Paid': return 'bg-green-100 text-green-700';
      case 'Overdue': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'Pending': return <Clock className="w-4 h-4" />;
      case 'Scheduled': return <Calendar className="w-4 h-4" />;
      case 'Processing': return <TrendingUp className="w-4 h-4" />;
      case 'Paid': return <CheckCircle className="w-4 h-4" />;
      case 'Overdue': return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getAgingColor = (amount: number) => {
    if (amount > 0) return 'text-red-600 font-medium';
    return 'text-gray-400';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores Payments</h1>
          <p className="text-gray-600">Manage supplier payments and outstanding balances</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Export payments to CSV
              const headers = ['Payment Ref', 'Supplier', 'Invoices', 'Amount', 'Due Date', 'Status'];
              const rows = filteredPayments.map(p => [
                p.paymentRef,
                p.supplier,
                p.invoices.join('; '),
                p.amount.toString(),
                p.dueDate,
                p.status,
              ]);
              const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button
            onClick={() => {
              const pendingPayment = payments.find(p => p.status !== 'Paid');
              if (pendingPayment) {
                handleRecordPayment(pendingPayment);
              } else {
                toast.error('No pending payments available.\n\nTo record a payment:\n1. Go to Stores → GRN\n2. Create a Goods Receipt Note\n3. Once approved, it will appear here for payment');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Outstanding</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalOutstanding)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(stats.overdue)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Scheduled</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(stats.scheduled)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Paid This Month</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.paidThisMonth)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'payments'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Pending Payments
          {stats.pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              {stats.pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('balances')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'balances'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Supplier Balances
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Payment History
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by payment reference or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Processing">Processing</option>
              <option value="Overdue">Overdue</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'balances' ? (
        /* Supplier Balances (Aging Analysis) */
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total Outstanding</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Current</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">1-30 Days</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">31-60 Days</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">90+ Days</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Last Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {supplierBalances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No supplier balances</p>
                      <p className="text-gray-400 text-sm mt-1">Outstanding balances will appear here</p>
                    </td>
                  </tr>
                ) : supplierBalances.map((balance) => (
                  <tr key={balance.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{balance.supplier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${balance.totalOutstanding > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                        {formatCurrency(balance.totalOutstanding)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={balance.current > 0 ? 'text-green-600' : 'text-gray-400'}>
                        {balance.current > 0 ? formatCurrency(balance.current) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getAgingColor(balance.days30)}>
                        {balance.days30 > 0 ? formatCurrency(balance.days30) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getAgingColor(balance.days60)}>
                        {balance.days60 > 0 ? formatCurrency(balance.days60) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getAgingColor(balance.days90Plus)}>
                        {balance.days90Plus > 0 ? formatCurrency(balance.days90Plus) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-700">{balance.lastPayment || '-'}</p>
                        {balance.lastPaymentAmount > 0 && (
                          <p className="text-xs text-gray-500">{formatCurrency(balance.lastPaymentAmount)}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        {balance.totalOutstanding > 0 && (
                          <button
                            onClick={() => {
                              const supplierPayment = payments.find(p => p.supplierId === balance.id && p.status !== 'Paid');
                              if (supplierPayment) handleRecordPayment(supplierPayment);
                            }}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {supplierBalances.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {formatCurrency(supplierBalances.reduce((sum, b) => sum + b.totalOutstanding, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {formatCurrency(supplierBalances.reduce((sum, b) => sum + b.current, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {formatCurrency(supplierBalances.reduce((sum, b) => sum + b.days30, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {formatCurrency(supplierBalances.reduce((sum, b) => sum + b.days60, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {formatCurrency(supplierBalances.reduce((sum, b) => sum + b.days90Plus, 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : (
        /* Payments Table (both pending and history) */
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Payment Ref</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoices</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    {activeTab === 'history' ? 'Paid Date' : 'Due Date'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No payments found</p>
                      <p className="text-gray-400 text-sm mt-1 max-w-md mx-auto">
                        {activeTab === 'history' 
                          ? 'Payment history will appear here once you record payments' 
                          : 'To record a payment, first create a Goods Receipt Note (GRN) from the Stores → GRN menu. Once goods are received and the GRN is approved, it will appear here for payment.'}
                      </p>
                    </td>
                  </tr>
                ) : filteredPayments.map((payment) => {
                  const daysUntil = getDaysUntilDue(payment.dueDate);
                  return (
                    <tr
                      key={payment.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        selectedPayment?.id === payment.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => handleViewDetails(payment)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{payment.paymentRef}</p>
                          {payment.transactionRef && (
                            <p className="text-xs text-gray-500">TXN: {payment.transactionRef}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-900">{payment.supplier}</p>
                            {payment.supplierBank && (
                              <p className="text-xs text-gray-500">{payment.supplierBank}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {payment.invoices.map((inv) => (
                            <span key={inv} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                              {inv}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">
                            {activeTab === 'history' ? payment.paymentDate : payment.dueDate}
                          </span>
                          {activeTab !== 'history' && payment.status !== 'Paid' && (
                            <>
                              {daysUntil < 0 && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                  {Math.abs(daysUntil)}d overdue
                                </span>
                              )}
                              {daysUntil >= 0 && daysUntil <= 3 && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                                  {daysUntil}d left
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(payment.status)}`}>
                          {getStatusIcon(payment.status)}
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewDetails(payment)}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {payment.status === 'Pending' && (
                            <button
                              onClick={() => handleRecordPayment(payment)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Record
                            </button>
                          )}
                          {payment.status === 'Scheduled' && (
                            <button
                              onClick={() => handleRecordPayment(payment)}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Pay Now
                            </button>
                          )}
                          {payment.status === 'Overdue' && (
                            <button
                              onClick={() => handleRecordPayment(payment)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Pay Urgent
                            </button>
                          )}
                          {payment.status === 'Paid' && (
                            <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-1.5 hover:bg-gray-100 rounded">
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordPaymentModal && selectedPayment && (
        <RecordPaymentModal
          payment={selectedPayment}
          onClose={() => {
            setShowRecordPaymentModal(false);
            setSelectedPayment(null);
          }}
          onSubmit={(data) => recordPaymentMutation.mutate(data)}
          isLoading={recordPaymentMutation.isPending}
        />
      )}

      {/* Payment Detail Modal */}
      {showPaymentDetailModal && selectedPayment && (
        <PaymentDetailModal
          payment={selectedPayment}
          onClose={() => {
            setShowPaymentDetailModal(false);
            setSelectedPayment(null);
          }}
        />
      )}
    </div>
  );
}

// Record Payment Modal Component
function RecordPaymentModal({
  payment,
  onClose,
  onSubmit,
  isLoading,
}: {
  payment: Payment;
  onClose: () => void;
  onSubmit: (data: RecordPaymentDto) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    paymentMethod: 'bank_transfer',
    transactionRef: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      grnId: payment.id,
      amount: payment.amount,
      paymentMethod: formData.paymentMethod,
      transactionRef: formData.transactionRef || undefined,
      paymentDate: formData.paymentDate,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Supplier</span>
              <span className="font-medium text-gray-900">{payment.supplier}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Reference</span>
              <span className="font-medium text-gray-900">{payment.paymentRef}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Amount</span>
              <span className="font-bold text-lg text-gray-900">{formatCurrency(payment.amount)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference</label>
            <input
              type="text"
              value={formData.transactionRef}
              onChange={(e) => setFormData({ ...formData, transactionRef: e.target.value })}
              placeholder="Enter transaction reference"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Enter any payment notes"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <Banknote className="w-4 h-4" />
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Payment Detail Modal Component
function PaymentDetailModal({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Payment Reference</span>
            <span className="font-medium text-gray-900">{payment.paymentRef}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">GRN Number</span>
            <span className="font-medium text-gray-900">{payment.grnNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Supplier</span>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900">{payment.supplier}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Amount</span>
            <span className="font-bold text-xl text-gray-900">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Status</span>
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
              payment.status === 'Paid' ? 'bg-green-100 text-green-700' :
              payment.status === 'Overdue' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {payment.status === 'Paid' && <CheckCircle className="w-3 h-3" />}
              {payment.status === 'Overdue' && <AlertTriangle className="w-3 h-3" />}
              {payment.status !== 'Paid' && payment.status !== 'Overdue' && <Clock className="w-3 h-3" />}
              {payment.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{payment.status === 'Paid' ? 'Paid Date' : 'Due Date'}</span>
            <span className="font-medium text-gray-900">
              {payment.status === 'Paid' ? payment.paymentDate : payment.dueDate}
            </span>
          </div>
          {payment.transactionRef && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Transaction Reference</span>
              <span className="font-medium text-gray-900">{payment.transactionRef}</span>
            </div>
          )}
          {payment.paymentMethod && (
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Payment Method</span>
              <span className="font-medium text-gray-900">{payment.paymentMethod}</span>
            </div>
          )}
          <div>
            <span className="text-gray-600">Invoices</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {payment.invoices.map((inv) => (
                <span key={inv} className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  {inv}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
          {payment.status === 'Paid' && (
            <button className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download Receipt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
