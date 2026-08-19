import React, { useState } from 'react';
import { toast } from 'sonner';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '../../lib/currency';
import { supplierFinanceService, type PaymentVoucher } from '../../services/supplier-finance';
import {
  FileText,
  Search,
  Plus,
  Eye,
  Filter,
  ChevronDown,
  Loader2,
  Check,
  Clock,
  X,
  DollarSign,
  Building2,
  Calendar,
  CheckCircle,
  Send,
  CreditCard,
} from 'lucide-react';

// Values must match backend PaymentVoucherStatus/PaymentMethod exactly
// (supplier-payment.entity.ts) — the uppercase set matched nothing, so every
// total read 0 and the row action buttons never appeared.
const statuses = ['All', 'draft', 'pending_approval', 'approved', 'paid', 'cancelled'];
const paymentMethods = ['bank_transfer', 'cheque', 'cash', 'mobile_money', 'credit_card'];

const titleize = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** decimal columns arrive as strings from TypeORM. */
const num = (v: number | string | undefined) => Number(v ?? 0) || 0;

export default function SupplierPaymentVouchersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [processingVoucher, setProcessingVoucher] = useState<PaymentVoucher | null>(null);
  const [viewingVoucher, setViewingVoucher] = useState<PaymentVoucher | null>(null);

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const viewingVoucherDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!viewingVoucher,
    onClose: () => setViewingVoucher(null),
  });
  const showAddModalDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!showAddModal,
    onClose: () => setShowAddModal(false),
  });

  const { data: vouchers, isLoading } = useQuery({
    queryKey: ['payment-vouchers'],
    queryFn: () => supplierFinanceService.payments.list(),
  });

  // None of these reported failure, and every step of this voucher's life
  // refuses on segregation of duties: the preparer may not approve, and the
  // payer may be neither the preparer nor the approver. Silence turned a
  // deliberate refusal into a button that appeared not to work — on the
  // screen that releases money.
  const showError = (fallback: string) => (err: any) =>
    toast.error(err?.response?.data?.message || fallback);

  const submitMutation = useMutation({
    mutationFn: (id: string) => supplierFinanceService.payments.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      toast.success('Voucher submitted for approval');
    },
    onError: showError('Failed to submit voucher'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => supplierFinanceService.payments.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      toast.success('Voucher approved');
    },
    onError: showError('Failed to approve voucher'),
  });

  const processMutation = useMutation({
    mutationFn: ({
      id,
      bankDetails,
    }: {
      id: string;
      bankDetails?: { chequeNumber?: string; bankReference?: string };
    }) => supplierFinanceService.payments.process(id, bankDetails),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      toast.success('Payment processed');
      setProcessingVoucher(null);
    },
    onError: showError('Failed to process payment'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PaymentVoucher>) => supplierFinanceService.payments.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-vouchers'] });
      toast.success('Payment voucher created');
      setShowAddModal(false);
    },
    onError: showError('Failed to create payment voucher'),
  });

  const items = vouchers || [];

  const filteredVouchers = items.filter((voucher) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      voucher.voucherNumber?.toLowerCase().includes(q) ||
      voucher.supplier?.name?.toLowerCase().includes(q);
    const matchesStatus = selectedStatus === 'All' || voucher.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'paid': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const totalPending = items.filter(v => v.status === 'pending_approval').reduce((sum, v) => sum + num(v.netAmount), 0);
  const totalApproved = items.filter(v => v.status === 'approved').reduce((sum, v) => sum + num(v.netAmount), 0);
  const totalPaid = items.filter(v => v.status === 'paid').reduce((sum, v) => sum + num(v.netAmount), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Vouchers</h1>
          <p className="text-gray-600">Manage supplier payment vouchers and approvals</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Voucher
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Vouchers</p>
              <p className="text-xl font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-xl font-bold text-yellow-600">{formatCurrency(totalPending, { currencyCode: 'UGX' })}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Check className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(totalApproved, { currencyCode: 'UGX' })}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Paid</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid, { currencyCode: 'UGX' })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vouchers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Voucher</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Supplier</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Method</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Payment Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredVouchers.map((voucher) => (
              <tr key={voucher.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{voucher.voucherNumber}</p>
                    <p className="text-xs text-gray-500">{voucher.items?.map((i) => i.invoiceNumber).filter(Boolean).join(', ') || '—'}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{voucher.supplier?.name || '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">
                    {formatCurrency(num(voucher.netAmount))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">{voucher.paymentMethod.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {voucher.paymentDate ? new Date(voucher.paymentDate).toLocaleDateString() : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(voucher.status)}`}>
                    {voucher.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingVoucher(voucher)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    {voucher.status === 'draft' && (
                      <button
                        onClick={() => submitMutation.mutate(voucher.id)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Submit
                      </button>
                    )}
                    {voucher.status === 'pending_approval' && (
                      <button
                        onClick={() => approveMutation.mutate(voucher.id)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                    )}
                    {voucher.status === 'approved' && (
                      <button
                        onClick={() => setProcessingVoucher(voucher)}
                        className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                      >
                        Process
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredVouchers.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No payment vouchers found</p>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewingVoucher && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          ref={viewingVoucherDialogRef}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{viewingVoucher.voucherNumber}</h2>
              <button onClick={() => setViewingVoucher(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="font-medium">{viewingVoucher.supplier?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium">{formatCurrency(num(viewingVoucher.netAmount))}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium">{viewingVoucher.paymentMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Date</p>
                  <p className="font-medium">{viewingVoucher.paymentDate ? new Date(viewingVoucher.paymentDate).toLocaleDateString() : '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(viewingVoucher.status)}`}>
                    {titleize(viewingVoucher.status || '')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Invoices</p>
                  <p className="font-medium">{viewingVoucher.items?.map((i) => i.invoiceNumber).filter(Boolean).join(', ') || '—'}</p>
                </div>
              </div>
              {viewingVoucher.paidAt && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    Paid on {new Date(viewingVoucher.paidAt).toLocaleDateString()}
                    {viewingVoucher.bankReference && ` • Ref: ${viewingVoucher.bankReference}`}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setViewingVoucher(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          ref={showAddModalDialogRef}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Create Payment Voucher</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select supplier</option>
                  <option value="s1">MedPharm Supplies Ltd</option>
                  <option value="s2">Uganda Lab Equipment Co</option>
                  <option value="s3">AfriMed Pharmaceuticals</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (UGX)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  {paymentMethods.map(method => (
                    <option key={method} value={method}>{method.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Numbers</label>
                <input
                  type="text"
                  placeholder="Comma-separated (e.g., INV-001, INV-002)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({})}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Voucher
              </button>
            </div>
          </div>
        </div>
      )}
      {processingVoucher && (
        <ProcessPaymentModal
          voucher={processingVoucher}
          isSubmitting={processMutation.isPending}
          onClose={() => setProcessingVoucher(null)}
          onConfirm={(bankDetails) =>
            processMutation.mutate({ id: processingVoucher.id, bankDetails })
          }
        />
      )}
    </div>
  );
}

/**
 * Releasing the money.
 *
 * Process used to fire straight off the row button with no body, so the
 * cheque number and bank reference the endpoint accepts were never captured
 * and a cheque payment could not be matched to the bank statement later —
 * even though the voucher detail panel displays a bank reference. It also
 * states the segregation-of-duties rule up front, because the refusal comes
 * from the server and is worth knowing before you click.
 */
export function ProcessPaymentModal({
  voucher,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  voucher: PaymentVoucher;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (bankDetails: { chequeNumber?: string; bankReference?: string }) => void;
}) {
  const dialogRef = useDialogA11y<HTMLDivElement>({ open: true, onClose });
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankReference, setBankReference] = useState('');

  const method = voucher.paymentMethod;
  const needsCheque = method === 'cheque';
  const needsReference = method === 'bank_transfer' || method === 'mobile_money';

  const canSubmit =
    !isSubmitting &&
    (!needsCheque || chequeNumber.trim().length > 0) &&
    (!needsReference || bankReference.trim().length > 0);

  const submit = () => {
    if (!canSubmit) return;
    onConfirm({
      chequeNumber: chequeNumber.trim() || undefined,
      bankReference: bankReference.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="process-payment-title"
      ref={dialogRef}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-5 py-3 border-b">
          <h3 id="process-payment-title" className="font-semibold text-gray-900">
            Process {voucher.voucherNumber}
          </h3>
          <p className="text-sm text-gray-500">
            {voucher.supplier?.name || 'Supplier'} ·{' '}
            {formatCurrency(Number(voucher.netAmount ?? voucher.grossAmount) || 0)} by{' '}
            {String(method || '').replace(/_/g, ' ')}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            This records the money as paid. The person processing a payment must be neither the
            person who prepared the voucher nor the person who approved it.
          </p>

          {needsCheque && (
            <div>
              <label htmlFor="cheque-number" className="block text-sm text-gray-700 mb-1">
                Cheque number <span className="text-red-600">required</span>
              </label>
              <input
                id="cheque-number"
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="e.g. 004512"
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>
          )}

          {needsReference && (
            <div>
              <label htmlFor="bank-reference" className="block text-sm text-gray-700 mb-1">
                Transaction reference <span className="text-red-600">required</span>
              </label>
              <input
                id="bank-reference"
                type="text"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder="Bank or mobile-money reference"
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                This is what the payment is matched on when the statement is reconciled.
              </p>
            </div>
          )}

          {!needsCheque && !needsReference && (
            <div>
              <label htmlFor="bank-reference-optional" className="block text-sm text-gray-700 mb-1">
                Reference <span className="text-gray-400">(optional)</span>
              </label>
              <input
                id="bank-reference-optional"
                type="text"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder="Receipt or voucher reference, if any"
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
              />
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Record payment
          </button>
        </div>
      </div>
    </div>
  );
}
