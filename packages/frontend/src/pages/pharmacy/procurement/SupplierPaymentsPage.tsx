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
  Banknote,
  FileText,
  Send,
  Download,
  Loader2,
  Plus,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { supplierFinanceService, type PaymentVoucher, type AgingBucket } from '../../../services/supplier-finance';
import api from '../../../services/api';
import { useAuthStore } from '../../../store/auth';
import { formatCurrency } from '../../../lib/currency';
import { asList } from '../../../utils/unwrapResponse';

type VoucherStatus = PaymentVoucher['status'];

const STATUS_COLORS: Record<VoucherStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<VoucherStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

const STATUS_ICONS: Record<VoucherStatus, React.ReactNode> = {
  draft: <FileText className="w-4 h-4" />,
  pending_approval: <Clock className="w-4 h-4" />,
  approved: <CheckCircle className="w-4 h-4" />,
  paid: <Banknote className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  mobile_money: 'Mobile Money',
  credit_card: 'Credit Card',
};

const todayStr = () => new Date().toISOString().split('T')[0];

interface LineItem {
  description: string;
  invoiceNumber: string;
  amount: number;
}

const emptyLineItem = (): LineItem => ({ description: '', invoiceNumber: '', amount: 0 });

export default function SupplierPaymentsPage() {
  const { hasPermission } = usePermissions();

  const facilityId = useAuthStore(state => state.user?.facilityId) || '';
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'vouchers' | 'aging' | 'history'>('vouchers');
  const [selectedPayment, setSelectedPayment] = useState<PaymentVoucher | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────
  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => supplierFinanceService.payments.list(),
  });

  const { data: agingBuckets = [] } = useQuery<AgingBucket[]>({
    queryKey: ['supplier-aging'],
    queryFn: () => supplierFinanceService.reports.getAging(),
  });

  const { data: suppliers = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await api.get('/suppliers');
      return asList(res.data);
    },
  });

  // ── Mutations ──────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });

  const submitMutation = useMutation({
    mutationFn: (id: string) => supplierFinanceService.payments.submit(id),
    onSuccess: () => { invalidate(); toast.success('Payment voucher submitted for approval'); },
    onError: () => toast.error('Failed to submit payment voucher'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => supplierFinanceService.payments.approve(id),
    onSuccess: () => { invalidate(); toast.success('Payment voucher approved'); },
    onError: () => toast.error('Failed to approve payment voucher'),
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => supplierFinanceService.payments.process(id),
    onSuccess: () => { invalidate(); toast.success('Payment processed & GL entry posted'); },
    onError: () => toast.error('Failed to process payment'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => supplierFinanceService.payments.cancel(id),
    onSuccess: () => { invalidate(); toast.success('Payment voucher cancelled'); },
    onError: () => toast.error('Failed to cancel payment voucher'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof supplierFinanceService.payments.create>[0]) =>
      supplierFinanceService.payments.create(data),
    onSuccess: () => {
      invalidate();
      toast.success('Payment voucher created');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to create payment voucher'),
  });

  // ── Derived Data ───────────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    return payments.filter((pv) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        pv.voucherNumber?.toLowerCase().includes(term) ||
        pv.supplier?.name?.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || pv.status === statusFilter;
      const matchesTab =
        activeTab === 'history'
          ? pv.status === 'paid'
          : pv.status !== 'paid' && pv.status !== 'cancelled';
      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [payments, searchTerm, statusFilter, activeTab]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalOutstanding = payments
      .filter(p => p.status !== 'paid' && p.status !== 'cancelled')
      .reduce((sum, p) => sum + (p.netAmount ?? 0), 0);

    const pendingApproval = payments.filter(p => p.status === 'pending_approval').length;
    const approved = payments.filter(p => p.status === 'approved').length;

    const paidThisMonth = payments
      .filter(p => p.status === 'paid' && p.paidAt && new Date(p.paidAt) >= monthStart)
      .reduce((sum, p) => sum + (p.netAmount ?? 0), 0);

    const voucherCount = payments.filter(
      p => p.status !== 'paid' && p.status !== 'cancelled'
    ).length;

    return { totalOutstanding, pendingApproval, approved, paidThisMonth, voucherCount };
  }, [payments]);

  if (!hasPermission('inventory.create')) {
    return <AccessDenied />;
  }

  // ── Loading / Error ────────────────────────────────────────────
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

  // ── Helpers ────────────────────────────────────────────────────
  const handleExport = () => {
    const header = 'Voucher,Supplier,Gross,Net,Status,Date';
    const rows = payments.map(p =>
      `${p.voucherNumber},${p.supplier?.name ?? ''},${p.grossAmount},${p.netAmount},${p.status},${p.paymentDate}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supplier-payments.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  const stopProp = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const agingTotal = agingBuckets.reduce((s, b) => s + b.amount, 0);
  const agingMaxAmount = Math.max(...agingBuckets.map(b => b.amount), 1);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Payments</h1>
          <p className="text-gray-600">Manage payment vouchers and accounts payable</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Payment Voucher
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
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalOutstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingApproval}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-blue-600">{stats.approved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Banknote className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Paid This Month</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidThisMonth)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('vouchers')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'vouchers'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          Payment Vouchers
          {stats.voucherCount > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
              {stats.voucherCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('aging')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'aging'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          AP Aging
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

      {/* Filters (vouchers & history tabs) */}
      {activeTab !== 'aging' && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by voucher number or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as VoucherStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── AP Aging Tab ─────────────────────────────────────────── */}
      {activeTab === 'aging' && (
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-auto h-full">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Range</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase w-1/3">Distribution</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Supplier Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {agingBuckets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center">
                      <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No aging data available</p>
                      <p className="text-gray-400 text-sm mt-1">Aging buckets will appear once payments exist</p>
                    </td>
                  </tr>
                ) : agingBuckets.map((bucket, idx) => {
                  const pct = agingMaxAmount > 0 ? (bucket.amount / agingMaxAmount) * 100 : 0;
                  const colors = ['bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-red-700'];
                  const barColor = colors[Math.min(idx, colors.length - 1)];
                  return (
                    <tr key={bucket.range} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{bucket.range}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatCurrency(bucket.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className={`${barColor} h-4 rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{bucket.count}</td>
                    </tr>
                  );
                })}
              </tbody>
              {agingBuckets.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {formatCurrency(agingTotal)}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                      {agingBuckets.reduce((s, b) => s + b.count, 0)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── Vouchers / History Table ─────────────────────────────── */}
      {activeTab !== 'aging' && (
        <div className="flex-1 flex overflow-hidden gap-4">
          {/* Table */}
          <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden ${selectedPayment ? 'flex-1' : 'w-full'}`}>
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Voucher #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
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
                          {activeTab === 'history' ? 'Payment history will appear here' : 'Payment vouchers will appear here'}
                        </p>
                      </td>
                    </tr>
                  ) : filteredPayments.map((pv) => (
                    <tr
                      key={pv.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        selectedPayment?.id === pv.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedPayment(pv)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{pv.voucherNumber}</p>
                        {pv.purchaseOrder && (
                          <p className="text-xs text-gray-500">PO: {pv.purchaseOrder.orderNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{pv.supplier?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatCurrency(pv.netAmount)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">
                        {PAYMENT_METHOD_LABELS[pv.paymentMethod] ?? pv.paymentMethod}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">
                            {new Date(pv.paymentDate).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${STATUS_COLORS[pv.status]}`}>
                          {STATUS_ICONS[pv.status]}
                          {STATUS_LABELS[pv.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {pv.status === 'draft' && (
                            <>
                              <button
                                onClick={stopProp(() => submitMutation.mutate(pv.id))}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                title="Submit for approval"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={stopProp(() => cancelMutation.mutate(pv.id))}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                title="Cancel"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {pv.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={stopProp(() => approveMutation.mutate(pv.id))}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                title="Approve"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={stopProp(() => cancelMutation.mutate(pv.id))}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                title="Cancel"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {pv.status === 'approved' && (
                            <>
                              <button
                                onClick={stopProp(() => processMutation.mutate(pv.id))}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                title="Process payment (posts GL entry)"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={stopProp(() => cancelMutation.mutate(pv.id))}
                                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                title="Cancel"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {pv.status === 'paid' && (
                            <button
                              onClick={stopProp(() => setSelectedPayment(pv))}
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                              title="View receipt"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={stopProp(() => setSelectedPayment(pv))}
                            className="p-1.5 hover:bg-gray-100 rounded"
                            title="Details"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Detail Side Panel ────────────────────────────────── */}
          {selectedPayment && (
            <div className="w-[420px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-auto flex-shrink-0">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">{selectedPayment.voucherNumber}</h2>
                  <button onClick={() => setSelectedPayment(null)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-4 ${STATUS_COLORS[selectedPayment.status]}`}>
                  {STATUS_ICONS[selectedPayment.status]}
                  {STATUS_LABELS[selectedPayment.status]}
                </span>

                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Supplier</dt>
                    <dd className="font-medium text-gray-900">{selectedPayment.supplier?.name ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Payment Date</dt>
                    <dd className="text-gray-900">{new Date(selectedPayment.paymentDate).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Method</dt>
                    <dd className="text-gray-900">{PAYMENT_METHOD_LABELS[selectedPayment.paymentMethod] ?? selectedPayment.paymentMethod}</dd>
                  </div>
                  {selectedPayment.bankName && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Bank</dt>
                      <dd className="text-gray-900">{selectedPayment.bankName}</dd>
                    </div>
                  )}
                  {selectedPayment.accountNumber && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Account #</dt>
                      <dd className="text-gray-900">{selectedPayment.accountNumber}</dd>
                    </div>
                  )}
                  {selectedPayment.bankReference && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Bank Reference</dt>
                      <dd className="text-gray-900">{selectedPayment.bankReference}</dd>
                    </div>
                  )}
                  {selectedPayment.chequeNumber && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Cheque #</dt>
                      <dd className="text-gray-900">{selectedPayment.chequeNumber}</dd>
                    </div>
                  )}
                  <hr className="border-gray-200" />
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Gross Amount</dt>
                    <dd className="font-medium text-gray-900">{formatCurrency(selectedPayment.grossAmount)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Withholding Tax</dt>
                    <dd className="text-gray-900">- {formatCurrency(selectedPayment.withholdingTax)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Other Deductions</dt>
                    <dd className="text-gray-900">- {formatCurrency(selectedPayment.otherDeductions)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <dt className="font-semibold text-gray-900">Net Amount</dt>
                    <dd className="font-bold text-gray-900">{formatCurrency(selectedPayment.netAmount)}</dd>
                  </div>
                </dl>

                {/* Line Items */}
                {selectedPayment.items?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Line Items</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="py-1 text-left text-gray-500">Description</th>
                          <th className="py-1 text-left text-gray-500">Invoice #</th>
                          <th className="py-1 text-right text-gray-500">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPayment.items.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="py-1 text-gray-900">{item.description}</td>
                            <td className="py-1 text-gray-700">{item.invoiceNumber ?? '—'}</td>
                            <td className="py-1 text-right font-medium text-gray-900">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Audit trail */}
                <div className="mt-4 space-y-2 text-sm">
                  {selectedPayment.preparedBy && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Prepared By</dt>
                      <dd className="text-gray-900">{selectedPayment.preparedBy.fullName}</dd>
                    </div>
                  )}
                  {selectedPayment.approvedBy && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Approved By</dt>
                      <dd className="text-gray-900">
                        {selectedPayment.approvedBy.fullName}
                        {selectedPayment.approvedAt && (
                          <span className="text-gray-400 ml-1">
                            ({new Date(selectedPayment.approvedAt).toLocaleDateString()})
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {selectedPayment.paidBy && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Paid By</dt>
                      <dd className="text-gray-900">
                        {selectedPayment.paidBy.fullName}
                        {selectedPayment.paidAt && (
                          <span className="text-gray-400 ml-1">
                            ({new Date(selectedPayment.paidAt).toLocaleDateString()})
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                  {selectedPayment.journalEntryId && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Journal Entry</dt>
                      <dd className="font-mono text-xs text-blue-600">{selectedPayment.journalEntryId}</dd>
                    </div>
                  )}
                </div>

                {/* Panel action buttons */}
                <div className="mt-5 flex gap-2">
                  {selectedPayment.status === 'draft' && (
                    <>
                      <button
                        onClick={() => submitMutation.mutate(selectedPayment.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Send className="w-4 h-4" /> Submit
                      </button>
                      <button
                        onClick={() => cancelMutation.mutate(selectedPayment.id)}
                        className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {selectedPayment.status === 'pending_approval' && (
                    <>
                      <button
                        onClick={() => approveMutation.mutate(selectedPayment.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => cancelMutation.mutate(selectedPayment.id)}
                        className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {selectedPayment.status === 'approved' && (
                    <>
                      <button
                        onClick={() => processMutation.mutate(selectedPayment.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        <Banknote className="w-4 h-4" /> Process Payment
                      </button>
                      <button
                        onClick={() => cancelMutation.mutate(selectedPayment.id)}
                        className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Create Payment Voucher Modal ─────────────────────────── */}
      {showCreateModal && (
        <CreatePaymentModal
          suppliers={suppliers}
          facilityId={facilityId}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Create Payment Voucher Modal
// ═══════════════════════════════════════════════════════════════════
function CreatePaymentModal({
  suppliers,
  facilityId,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  suppliers: { id: string; name: string }[];
  facilityId: string;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [paymentMethod, setPaymentMethod] = useState<string>('bank_transfer');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [grossAmount, setGrossAmount] = useState<number>(0);
  const [withholdingTax, setWithholdingTax] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  const netAmount = grossAmount - withholdingTax - otherDeductions;

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeItem = (index: number) => {
    setLineItems(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) { toast.error('Please select a supplier'); return; }
    if (grossAmount <= 0) { toast.error('Gross amount must be greater than zero'); return; }

    onSubmit({
      facilityId,
      supplierId,
      paymentDate,
      grossAmount,
      withholdingTax: withholdingTax || 0,
      otherDeductions: otherDeductions || 0,
      paymentMethod,
      ...(paymentMethod === 'bank_transfer' && { bankName, accountNumber, bankReference }),
      ...(paymentMethod === 'cheque' && { chequeNumber }),
      description: description || undefined,
      remarks: remarks || undefined,
      items: lineItems
        .filter(li => li.description.trim())
        .map(li => ({
          description: li.description,
          invoiceNumber: li.invoiceNumber || undefined,
          amount: li.amount,
        })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto"
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Create Payment Voucher</h2>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select supplier…</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Payment Date & Method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
              <select
                required
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </div>
          </div>

          {/* Conditional bank fields */}
          {paymentMethod === 'bank_transfer' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account #</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Reference</label>
                <input
                  type="text"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
          {paymentMethod === 'cheque' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
              <input
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Amounts */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gross Amount *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={grossAmount || ''}
                onChange={(e) => setGrossAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Withholding Tax</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={withholdingTax || ''}
                onChange={(e) => setWithholdingTax(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Other Deductions</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={otherDeductions || ''}
                onChange={(e) => setOtherDeductions(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Net Amount</label>
              <input
                type="text"
                readOnly
                value={formatCurrency(netAmount)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-bold"
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Line Items</label>
              <button
                type="button"
                onClick={() => setLineItems(prev => [...prev, emptyLineItem()])}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-600">Description</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-600">Invoice #</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-600">Amount</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, 'description', e.target.value)}
                        placeholder="Description"
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={item.invoiceNumber}
                        onChange={(e) => updateItem(idx, 'invoiceNumber', e.target.value)}
                        placeholder="INV-001"
                        className="w-full px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.amount || ''}
                        onChange={(e) => updateItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-right focus:ring-1 focus:ring-blue-400 text-sm"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Description / Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Remarks</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setRemarks(e.target.value); }}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes…"
            />
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Voucher
          </button>
        </div>
      </form>
    </div>
  );
}
