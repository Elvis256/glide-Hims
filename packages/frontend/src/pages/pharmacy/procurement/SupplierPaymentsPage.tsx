import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Send,
  Download,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import { procurementService, type GoodsReceipt } from '../../../services/procurement';
import { formatCurrency } from '../../../lib/currency';

type PaymentStatus = 'Pending' | 'Scheduled' | 'Processing' | 'Paid' | 'Overdue';

interface Payment {
  id: string;
  paymentRef: string;
  supplier: string;
  supplierBank: string;
  accountNumber: string;
  invoices: string[];
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  paymentDate?: string;
  paymentMethod?: string;
  transactionRef?: string;
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
    supplierBank: '',
    accountNumber: '',
    invoices: [grn.invoiceNumber || `INV-${grn.grnNumber}`],
    amount: grn.invoiceAmount || grn.totalAmount,
    dueDate: dueDate.toLocaleDateString(),
    status: isPaid ? 'Paid' : isOverdue ? 'Overdue' : grn.status === 'approved' ? 'Scheduled' : 'Pending',
    paymentDate: isPaid ? new Date(grn.postedAt || grn.approvedAt || grn.updatedAt).toLocaleDateString() : undefined,
    paymentMethod: isPaid ? 'Bank Transfer' : undefined,
    transactionRef: isPaid ? `TXN-${grn.id.substring(0, 8)}` : undefined,
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

export default function SupplierPaymentsPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.procurement')) {
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

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'All'>('All');
  const [activeTab, setActiveTab] = useState<'payments' | 'balances' | 'history'>('payments');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Fetch goods receipts from API (payments are derived from approved/posted GRNs)
  const { data: goodsReceipts = [], isLoading, error } = useQuery({
    queryKey: ['goodsReceipts'],
    queryFn: () => procurementService.goodsReceipts.list(),
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
          <h1 className="text-2xl font-bold text-gray-900">Supplier Payments</h1>
          <p className="text-gray-600">Manage outstanding balances and process payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <CreditCard className="w-4 h-4" />
            Process Payment
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
                        <p className="text-sm text-gray-700">{balance.lastPayment}</p>
                        <p className="text-xs text-gray-500">{formatCurrency(balance.lastPaymentAmount)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        {balance.totalOutstanding > 0 && (
                          <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
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
                      <p className="text-gray-400 text-sm mt-1">
                        {activeTab === 'history' ? 'Payment history will appear here' : 'Pending payments will appear here'}
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
                      onClick={() => setSelectedPayment(payment)}
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
                            <p className="text-xs text-gray-500">{payment.supplierBank}</p>
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
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                            <Eye className="w-4 h-4" />
                          </button>
                          {payment.status === 'Pending' && (
                            <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                              Schedule
                            </button>
                          )}
                          {payment.status === 'Scheduled' && (
                            <button className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                              Pay Now
                            </button>
                          )}
                          {payment.status === 'Overdue' && (
                            <button className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">
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
    </div>
  );
}
