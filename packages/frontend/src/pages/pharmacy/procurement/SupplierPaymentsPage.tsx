import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';

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

const mockPayments: Payment[] = [
  {
    id: '1',
    paymentRef: 'PAY-2024-001',
    supplier: 'PharmaCorp Kenya',
    supplierBank: 'KCB Bank',
    accountNumber: '1234567890',
    invoices: ['INV-2024-0125', 'INV-2024-0130'],
    amount: 22850.0,
    dueDate: '2024-02-15',
    status: 'Scheduled',
  },
  {
    id: '2',
    paymentRef: 'PAY-2024-002',
    supplier: 'MediSupply Ltd',
    supplierBank: 'Equity Bank',
    accountNumber: '0987654321',
    invoices: ['INV-2024-0122'],
    amount: 42500.0,
    dueDate: '2024-02-20',
    status: 'Pending',
  },
  {
    id: '3',
    paymentRef: 'PAY-2024-003',
    supplier: 'HealthCare Distributors',
    supplierBank: 'Co-op Bank',
    accountNumber: '5678901234',
    invoices: ['INV-2024-0118'],
    amount: 4750.0,
    dueDate: '2024-02-05',
    status: 'Overdue',
  },
  {
    id: '4',
    paymentRef: 'PAY-2024-004',
    supplier: 'PharmaCorp Kenya',
    supplierBank: 'KCB Bank',
    accountNumber: '1234567890',
    invoices: ['INV-2024-0100', 'INV-2024-0105'],
    amount: 35000.0,
    dueDate: '2024-01-25',
    status: 'Paid',
    paymentDate: '2024-01-24',
    paymentMethod: 'Bank Transfer',
    transactionRef: 'TXN-2024-0124-001',
  },
  {
    id: '5',
    paymentRef: 'PAY-2024-005',
    supplier: 'Generic Pharma EA',
    supplierBank: 'Stanbic Bank',
    accountNumber: '2345678901',
    invoices: ['INV-2024-0110'],
    amount: 18500.0,
    dueDate: '2024-01-30',
    status: 'Paid',
    paymentDate: '2024-01-28',
    paymentMethod: 'Mobile Money',
    transactionRef: 'MP-2024-0128-055',
  },
];

const mockSupplierBalances: SupplierBalance[] = [
  {
    id: '1',
    supplier: 'PharmaCorp Kenya',
    totalOutstanding: 22850.0,
    current: 15650.0,
    days30: 7200.0,
    days60: 0,
    days90Plus: 0,
    lastPayment: '2024-01-24',
    lastPaymentAmount: 35000.0,
  },
  {
    id: '2',
    supplier: 'MediSupply Ltd',
    totalOutstanding: 42500.0,
    current: 42500.0,
    days30: 0,
    days60: 0,
    days90Plus: 0,
    lastPayment: '2024-01-15',
    lastPaymentAmount: 28000.0,
  },
  {
    id: '3',
    supplier: 'HealthCare Distributors',
    totalOutstanding: 4750.0,
    current: 0,
    days30: 0,
    days60: 4750.0,
    days90Plus: 0,
    lastPayment: '2023-12-20',
    lastPaymentAmount: 15000.0,
  },
  {
    id: '4',
    supplier: 'Generic Pharma EA',
    totalOutstanding: 0,
    current: 0,
    days30: 0,
    days60: 0,
    days90Plus: 0,
    lastPayment: '2024-01-28',
    lastPaymentAmount: 18500.0,
  },
];

export default function SupplierPaymentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'All'>('All');
  const [activeTab, setActiveTab] = useState<'payments' | 'balances' | 'history'>('payments');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const filteredPayments = useMemo(() => {
    return mockPayments.filter((payment) => {
      const matchesSearch =
        payment.paymentRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || payment.status === statusFilter;
      const matchesTab = 
        activeTab === 'history' ? payment.status === 'Paid' : payment.status !== 'Paid';
      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [searchTerm, statusFilter, activeTab]);

  const stats = useMemo(() => {
    const outstanding = mockPayments
      .filter((p) => p.status !== 'Paid')
      .reduce((sum, p) => sum + p.amount, 0);
    const overdue = mockPayments
      .filter((p) => p.status === 'Overdue')
      .reduce((sum, p) => sum + p.amount, 0);
    const scheduled = mockPayments
      .filter((p) => p.status === 'Scheduled')
      .reduce((sum, p) => sum + p.amount, 0);
    const paidThisMonth = mockPayments
      .filter((p) => p.status === 'Paid')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalOutstanding: outstanding,
      overdue,
      scheduled,
      paidThisMonth,
      pendingCount: mockPayments.filter((p) => p.status === 'Pending').length,
      overdueCount: mockPayments.filter((p) => p.status === 'Overdue').length,
    };
  }, []);

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
                KES {stats.totalOutstanding.toLocaleString()}
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
                KES {stats.overdue.toLocaleString()}
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
                KES {stats.scheduled.toLocaleString()}
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
                KES {stats.paidThisMonth.toLocaleString()}
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
                {mockSupplierBalances.map((balance) => (
                  <tr key={balance.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{balance.supplier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${balance.totalOutstanding > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                        KES {balance.totalOutstanding.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={balance.current > 0 ? 'text-green-600' : 'text-gray-400'}>
                        {balance.current > 0 ? `KES ${balance.current.toLocaleString()}` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getAgingColor(balance.days30)}>
                        {balance.days30 > 0 ? `KES ${balance.days30.toLocaleString()}` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getAgingColor(balance.days60)}>
                        {balance.days60 > 0 ? `KES ${balance.days60.toLocaleString()}` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={getAgingColor(balance.days90Plus)}>
                        {balance.days90Plus > 0 ? `KES ${balance.days90Plus.toLocaleString()}` : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-700">{balance.lastPayment}</p>
                        <p className="text-xs text-gray-500">KES {balance.lastPaymentAmount.toLocaleString()}</p>
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
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    KES {mockSupplierBalances.reduce((sum, b) => sum + b.totalOutstanding, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-600">
                    KES {mockSupplierBalances.reduce((sum, b) => sum + b.current, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">
                    KES {mockSupplierBalances.reduce((sum, b) => sum + b.days30, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">
                    KES {mockSupplierBalances.reduce((sum, b) => sum + b.days60, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">
                    KES {mockSupplierBalances.reduce((sum, b) => sum + b.days90Plus, 0).toLocaleString()}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
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
                {filteredPayments.map((payment) => {
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
                        KES {payment.amount.toLocaleString()}
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
