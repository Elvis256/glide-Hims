import { useState, useMemo } from 'react';
import {
  DollarSign,
  Search,
  Filter,
  X,
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Banknote,
  Landmark,
  Receipt,
  FileText,
  Download,
  Printer,
  Eye,
  Send,
} from 'lucide-react';

type PaymentStatus = 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed';
type PaymentMethod = 'bank_transfer' | 'check' | 'cash';

interface Payment {
  id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  scheduledDate: string | null;
  paidDate: string | null;
  status: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  reference: string | null;
  aging: number;
}

const mockPayments: Payment[] = [
  {
    id: '1',
    vendorId: '1',
    vendorName: 'MediSupply Kenya Ltd',
    invoiceNumber: 'VINV-2024-001',
    amount: 125000,
    dueDate: '2024-01-25',
    scheduledDate: '2024-01-24',
    paidDate: null,
    status: 'scheduled',
    paymentMethod: 'bank_transfer',
    reference: null,
    aging: 0,
  },
  {
    id: '2',
    vendorId: '2',
    vendorName: 'PharmaCare Distributors',
    invoiceNumber: 'VINV-2024-002',
    amount: 85000,
    dueDate: '2024-01-20',
    scheduledDate: null,
    paidDate: null,
    status: 'pending',
    paymentMethod: null,
    reference: null,
    aging: 5,
  },
  {
    id: '3',
    vendorId: '3',
    vendorName: 'EquipMed Africa',
    invoiceNumber: 'VINV-2024-003',
    amount: 250000,
    dueDate: '2023-12-15',
    scheduledDate: null,
    paidDate: null,
    status: 'pending',
    paymentMethod: null,
    reference: null,
    aging: 40,
  },
  {
    id: '4',
    vendorId: '1',
    vendorName: 'MediSupply Kenya Ltd',
    invoiceNumber: 'VINV-2023-089',
    amount: 45000,
    dueDate: '2024-01-15',
    scheduledDate: null,
    paidDate: '2024-01-14',
    status: 'completed',
    paymentMethod: 'bank_transfer',
    reference: 'TXN-20240114-001',
    aging: 0,
  },
  {
    id: '5',
    vendorId: '5',
    vendorName: 'Lab Consumables Ltd',
    invoiceNumber: 'VINV-2024-004',
    amount: 67500,
    dueDate: '2024-01-28',
    scheduledDate: null,
    paidDate: null,
    status: 'pending',
    paymentMethod: null,
    reference: null,
    aging: 0,
  },
  {
    id: '6',
    vendorId: '4',
    vendorName: 'CleanPro Services',
    invoiceNumber: 'VINV-2023-078',
    amount: 35000,
    dueDate: '2023-11-30',
    scheduledDate: null,
    paidDate: null,
    status: 'pending',
    paymentMethod: null,
    reference: null,
    aging: 55,
  },
  {
    id: '7',
    vendorId: '2',
    vendorName: 'PharmaCare Distributors',
    invoiceNumber: 'VINV-2023-090',
    amount: 120000,
    dueDate: '2024-01-10',
    scheduledDate: null,
    paidDate: '2024-01-10',
    status: 'completed',
    paymentMethod: 'check',
    reference: 'CHK-001234',
    aging: 0,
  },
  {
    id: '8',
    vendorId: '3',
    vendorName: 'EquipMed Africa',
    invoiceNumber: 'VINV-2023-065',
    amount: 180000,
    dueDate: '2023-10-15',
    scheduledDate: null,
    paidDate: null,
    status: 'pending',
    paymentMethod: null,
    reference: null,
    aging: 100,
  },
];

const statusConfig: Record<PaymentStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700', icon: Calendar },
  processing: { label: 'Processing', color: 'bg-purple-100 text-purple-700', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

const paymentMethodConfig: Record<PaymentMethod, { label: string; icon: React.ElementType }> = {
  bank_transfer: { label: 'Bank Transfer', icon: Landmark },
  check: { label: 'Check', icon: FileText },
  cash: { label: 'Cash', icon: Banknote },
};

export default function VendorPaymentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [agingFilter, setAgingFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Payment | null>(null);

  const [paymentFormData, setPaymentFormData] = useState({
    method: 'bank_transfer' as PaymentMethod,
    scheduledDate: '',
    reference: '',
    notes: '',
  });

  const vendors = useMemo(() => {
    const unique = [...new Set(mockPayments.map((p) => p.vendorName))];
    return unique.sort();
  }, []);

  const filteredPayments = useMemo(() => {
    return mockPayments.filter((payment) => {
      const matchesSearch =
        payment.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVendor = vendorFilter === 'all' || payment.vendorName === vendorFilter;
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      let matchesAging = true;
      if (agingFilter === '30') matchesAging = payment.aging > 0 && payment.aging <= 30;
      else if (agingFilter === '60') matchesAging = payment.aging > 30 && payment.aging <= 60;
      else if (agingFilter === '90') matchesAging = payment.aging > 60 && payment.aging <= 90;
      else if (agingFilter === '90plus') matchesAging = payment.aging > 90;
      return matchesSearch && matchesVendor && matchesStatus && matchesAging;
    });
  }, [searchQuery, vendorFilter, statusFilter, agingFilter]);

  const summaryStats = useMemo(() => {
    const outstanding = mockPayments.filter((p) => p.status === 'pending' || p.status === 'scheduled');
    return {
      totalOutstanding: outstanding.reduce((sum, p) => sum + p.amount, 0),
      pending: outstanding.filter((p) => p.status === 'pending').length,
      scheduled: outstanding.filter((p) => p.status === 'scheduled').length,
      overdue: outstanding.filter((p) => p.aging > 0).length,
    };
  }, []);

  const agingReport = useMemo(() => {
    const outstanding = mockPayments.filter((p) => p.status === 'pending' || p.status === 'scheduled');
    return {
      current: outstanding.filter((p) => p.aging === 0).reduce((sum, p) => sum + p.amount, 0),
      days30: outstanding.filter((p) => p.aging > 0 && p.aging <= 30).reduce((sum, p) => sum + p.amount, 0),
      days60: outstanding.filter((p) => p.aging > 30 && p.aging <= 60).reduce((sum, p) => sum + p.amount, 0),
      days90: outstanding.filter((p) => p.aging > 60 && p.aging <= 90).reduce((sum, p) => sum + p.amount, 0),
      days90Plus: outstanding.filter((p) => p.aging > 90).reduce((sum, p) => sum + p.amount, 0),
    };
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  const openPaymentModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setPaymentFormData({
      method: 'bank_transfer',
      scheduledDate: '',
      reference: '',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Payments</h1>
            <p className="text-sm text-gray-500 mt-1">Manage payments to vendors</p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <DollarSign className="w-4 h-4" />
              Total Outstanding
            </div>
            <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(summaryStats.totalOutstanding)}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <Clock className="w-4 h-4" />
              Pending
            </div>
            <p className="text-xl font-bold text-yellow-700 mt-1">{summaryStats.pending} invoices</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <Calendar className="w-4 h-4" />
              Scheduled
            </div>
            <p className="text-xl font-bold text-blue-700 mt-1">{summaryStats.scheduled} payments</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-100">
            <div className="flex items-center gap-2 text-orange-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Overdue
            </div>
            <p className="text-xl font-bold text-orange-700 mt-1">{summaryStats.overdue} invoices</p>
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
              placeholder="Search vendors or invoices..."
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
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vendor</label>
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | 'all')}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Aging</label>
              <select
                value={agingFilter}
                onChange={(e) => setAgingFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="30">1-30 Days</option>
                <option value="60">31-60 Days</option>
                <option value="90">61-90 Days</option>
                <option value="90plus">90+ Days</option>
              </select>
            </div>
            {(vendorFilter !== 'all' || statusFilter !== 'all' || agingFilter !== 'all') && (
              <button
                onClick={() => {
                  setVendorFilter('all');
                  setStatusFilter('all');
                  setAgingFilter('all');
                }}
                className="text-sm text-blue-600 hover:underline mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="grid grid-cols-3 gap-6">
          {/* Payments List */}
          <div className="col-span-2">
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor / Invoice</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due Date</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Aging</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPayments.map((payment) => {
                    const StatusIcon = statusConfig[payment.status].icon;
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{payment.vendorName}</p>
                              <p className="text-xs text-gray-500">{payment.invoiceNumber}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {payment.dueDate}
                          </div>
                          {payment.scheduledDate && (
                            <p className="text-xs text-blue-600 mt-1">Scheduled: {payment.scheduledDate}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {payment.aging > 0 ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              payment.aging > 90 ? 'bg-red-100 text-red-700' :
                              payment.aging > 60 ? 'bg-orange-100 text-orange-700' :
                              payment.aging > 30 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {payment.aging} days
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">Current</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[payment.status].color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig[payment.status].label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {(payment.status === 'pending' || payment.status === 'scheduled') && (
                              <button
                                onClick={() => openPaymentModal(payment)}
                                className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 hover:text-blue-700"
                                title="Process Payment"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}
                            {payment.status === 'completed' && (
                              <button
                                onClick={() => setViewingReceipt(payment)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                                title="View Receipt"
                              >
                                <Receipt className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
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

          {/* Sidebar - Aging Report */}
          <div className="space-y-4">
            {/* Aging Report */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Aging Report</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current</span>
                  <span className="font-medium text-green-600">{formatCurrency(agingReport.current)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">1-30 Days</span>
                  <span className="font-medium text-yellow-600">{formatCurrency(agingReport.days30)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">31-60 Days</span>
                  <span className="font-medium text-orange-600">{formatCurrency(agingReport.days60)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">61-90 Days</span>
                  <span className="font-medium text-red-500">{formatCurrency(agingReport.days90)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-medium text-gray-600">90+ Days</span>
                  <span className="font-bold text-red-700">{formatCurrency(agingReport.days90Plus)}</span>
                </div>
              </div>

              {/* Visual Bar */}
              <div className="mt-4">
                <div className="flex rounded-lg overflow-hidden h-3">
                  {agingReport.current > 0 && (
                    <div
                      className="bg-green-500"
                      style={{ width: `${(agingReport.current / summaryStats.totalOutstanding) * 100}%` }}
                    />
                  )}
                  {agingReport.days30 > 0 && (
                    <div
                      className="bg-yellow-500"
                      style={{ width: `${(agingReport.days30 / summaryStats.totalOutstanding) * 100}%` }}
                    />
                  )}
                  {agingReport.days60 > 0 && (
                    <div
                      className="bg-orange-500"
                      style={{ width: `${(agingReport.days60 / summaryStats.totalOutstanding) * 100}%` }}
                    />
                  )}
                  {agingReport.days90 > 0 && (
                    <div
                      className="bg-red-400"
                      style={{ width: `${(agingReport.days90 / summaryStats.totalOutstanding) * 100}%` }}
                    />
                  )}
                  {agingReport.days90Plus > 0 && (
                    <div
                      className="bg-red-700"
                      style={{ width: `${(agingReport.days90Plus / summaryStats.totalOutstanding) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Payment Methods</h3>
              </div>
              <div className="space-y-3">
                {(Object.keys(paymentMethodConfig) as PaymentMethod[]).map((method) => {
                  const config = paymentMethodConfig[method];
                  const Icon = config.icon;
                  const count = mockPayments.filter((p) => p.paymentMethod === method && p.status === 'completed').length;
                  return (
                    <div key={method} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border">
                        <Icon className="w-4 h-4 text-gray-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{config.label}</p>
                        <p className="text-xs text-gray-500">{count} payments</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Payments */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-gray-900">Payment Schedule</h3>
              </div>
              <div className="space-y-3">
                {mockPayments
                  .filter((p) => p.status === 'scheduled')
                  .slice(0, 5)
                  .map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-blue-900">{payment.vendorName}</p>
                        <p className="text-xs text-blue-600">{payment.scheduledDate}</p>
                      </div>
                      <span className="font-medium text-blue-700">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                {mockPayments.filter((p) => p.status === 'scheduled').length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No scheduled payments</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Process Payment Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Process Payment</h2>
                <p className="text-sm text-gray-500">{selectedPayment.invoiceNumber}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Vendor</p>
                    <p className="font-medium">{selectedPayment.vendorName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedPayment.amount)}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(paymentMethodConfig) as PaymentMethod[]).map((method) => {
                    const config = paymentMethodConfig[method];
                    const Icon = config.icon;
                    return (
                      <button
                        key={method}
                        onClick={() => setPaymentFormData({ ...paymentFormData, method })}
                        className={`p-3 border rounded-lg flex flex-col items-center gap-1 ${
                          paymentFormData.method === method ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${paymentFormData.method === method ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={`text-xs ${paymentFormData.method === method ? 'text-blue-600' : 'text-gray-600'}`}>
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentFormData.scheduledDate}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, scheduledDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g., TXN-20240120-001"
                  value={paymentFormData.reference}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, reference: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Add any notes..."
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Send className="w-4 h-4" />
                Process Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Payment Receipt</h2>
                <p className="text-sm text-gray-500">{viewingReceipt.reference}</p>
              </div>
              <button onClick={() => setViewingReceipt(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Payment Confirmed</h3>
                <p className="text-gray-500">{viewingReceipt.paidDate}</p>
              </div>

              <div className="space-y-4 bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Vendor</span>
                  <span className="font-medium">{viewingReceipt.vendorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Invoice</span>
                  <span className="font-medium">{viewingReceipt.invoiceNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Amount</span>
                  <span className="font-bold text-lg">{formatCurrency(viewingReceipt.amount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Payment Method</span>
                  <span className="font-medium">
                    {viewingReceipt.paymentMethod && paymentMethodConfig[viewingReceipt.paymentMethod].label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Reference</span>
                  <span className="font-mono text-sm">{viewingReceipt.reference}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setViewingReceipt(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Close
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900">
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}