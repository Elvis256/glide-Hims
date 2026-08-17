import React, { useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency } from '../../lib/currency';
import { supplierFinanceService, type CreditNote } from '../../services/supplier-finance';
import { useFacilityId } from '../../lib/facility';
import {
  Receipt,
  Search,
  Plus,
  Eye,
  Filter,
  Loader2,
  Check,
  X,
  DollarSign,
  Building2,
  ArrowUpCircle,
  ArrowDownCircle,
  Link,
} from 'lucide-react';

// Values must match backend CreditNoteStatus/CreditNoteType exactly
// (supplier-credit-note.entity.ts). The uppercase set this page used matched
// nothing, so every total read 0 and every badge fell through to grey.
const statuses = ['All', 'draft', 'pending_approval', 'approved', 'applied', 'cancelled'];
const noteTypes = ['All', 'credit_note', 'debit_note'];

const titleize = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** decimal columns arrive as strings from TypeORM. */
const num = (v: number | string | undefined) => Number(v ?? 0) || 0;

export default function SupplierCreditNotesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingNote, setViewingNote] = useState<CreditNote | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyingNote, setApplyingNote] = useState<CreditNote | null>(null);
  const [applyVoucherId, setApplyVoucherId] = useState('');
  const [applyAmount, setApplyAmount] = useState('');

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const viewingNoteDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!viewingNote,
    onClose: () => setViewingNote(null),
  });
  const showApplyModalDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!showApplyModal,
    onClose: () => setShowApplyModal(false),
  });
  const showAddModalDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!showAddModal,
    onClose: () => setShowAddModal(false),
  });

  const facilityId = useFacilityId();

  const { data: creditNotes, isLoading } = useQuery({
    queryKey: ['credit-notes', facilityId],
    // facilityId is required — the backend filters on it unconditionally.
    queryFn: () => supplierFinanceService.creditNotes.list({ facilityId: facilityId! }),
    enabled: !!facilityId,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => supplierFinanceService.creditNotes.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
    },
  });

  // Payment vouchers this note can be applied against — same supplier, and the
  // backend only permits applying to a voucher that is not yet paid.
  const { data: vouchers = [] } = useQuery({
    queryKey: ['supplier-vouchers-for-apply', applyingNote?.supplierId],
    queryFn: () =>
      supplierFinanceService.payments.list({
        facilityId,
        supplierId: applyingNote!.supplierId,
      }),
    enabled: !!applyingNote?.supplierId && !!facilityId,
  });

  const applyMutation = useMutation({
    mutationFn: ({ id, voucherId, amount }: { id: string; voucherId: string; amount: number }) =>
      supplierFinanceService.creditNotes.apply(id, voucherId, amount),
    onSuccess: () => {
      toast.success('Credit note applied');
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      setShowApplyModal(false);
      setApplyingNote(null);
      setApplyVoucherId('');
      setApplyAmount('');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to apply credit note'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<CreditNote>) => supplierFinanceService.creditNotes.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      setShowAddModal(false);
    },
  });

  const items = creditNotes || [];

  const filteredNotes = items.filter((note) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      note.noteNumber?.toLowerCase().includes(q) ||
      note.supplier?.name?.toLowerCase().includes(q) ||
      note.reason?.toLowerCase().includes(q);
    const matchesStatus = selectedStatus === 'All' || note.status === selectedStatus;
    const matchesType = selectedType === 'All' || note.noteType === selectedType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'pending_approval': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'applied': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const totalCredits = items
    .filter(n => n.noteType === 'credit_note' && n.status !== 'cancelled')
    .reduce((sum, n) => sum + num(n.totalAmount), 0);
  const totalDebits = items
    .filter(n => n.noteType === 'debit_note' && n.status !== 'cancelled')
    .reduce((sum, n) => sum + num(n.totalAmount), 0);
  const pendingApproval = items.filter(n => n.status === 'pending_approval').length;
  const unapplied = items.filter(n => n.status === 'approved').length;

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
          <h1 className="text-2xl font-bold text-gray-900">Credit & Debit Notes</h1>
          <p className="text-gray-600">Manage supplier credit and debit adjustments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Note
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ArrowDownCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Credits</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalCredits, { currencyCode: 'UGX' })}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <ArrowUpCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Debits</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebits, { currencyCode: 'UGX' })}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Receipt className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-xl font-bold text-yellow-600">{pendingApproval}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Link className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Ready to Apply</p>
              <p className="text-xl font-bold text-blue-600">{unapplied}</p>
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
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {noteTypes.map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedType === type
                    ? type === 'credit_note' ? 'bg-green-600 text-white' :
                      type === 'debit_note' ? 'bg-red-600 text-white' :
                      'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {statuses.slice(0, 5).map((status) => (
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

      {/* Notes Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Note</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Supplier</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Reason</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredNotes.map((note) => (
              <tr key={note.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{note.noteNumber}</p>
                    <p className="text-xs text-gray-500">
                      {note.supplierInvoiceNumber ? `INV: ${note.supplierInvoiceNumber}` : note.grnId ? 'From GRN' : '—'}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`flex items-center gap-1 ${note.noteType === 'credit_note' ? 'text-green-600' : 'text-red-600'}`}>
                    {note.noteType === 'credit_note' ? (
                      <ArrowDownCircle className="w-4 h-4" />
                    ) : (
                      <ArrowUpCircle className="w-4 h-4" />
                    )}
                    {titleize(note.noteType || '')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{note.supplier?.name || '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-medium ${note.noteType === 'credit_note' ? 'text-green-600' : 'text-red-600'}`}>
                    {note.noteType === 'credit_note' ? '-' : '+'}{formatCurrency(num(note.totalAmount))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700 truncate max-w-[200px] block" title={note.reason}>
                    {note.reason}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(note.status)}`}>
                    {note.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingNote(note)}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                    {note.status === 'pending_approval' && (
                      <button
                        onClick={() => approveMutation.mutate(note.id)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                    )}
                    {note.status === 'approved' && note.noteType === 'credit_note' && (
                      <button
                        onClick={() => {
                          setApplyingNote(note);
                          setShowApplyModal(true);
                        }}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredNotes.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No credit/debit notes found</p>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewingNote && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          ref={viewingNoteDialogRef}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{viewingNote.noteNumber}</h2>
              <button onClick={() => setViewingNote(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <span className={`font-medium ${viewingNote.noteType === 'credit_note' ? 'text-green-600' : 'text-red-600'}`}>
                    {titleize(viewingNote.noteType || '')}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium">{formatCurrency(num(viewingNote.totalAmount))}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Supplier</p>
                  <p className="font-medium">{viewingNote.supplier?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(viewingNote.status)}`}>
                    {titleize(viewingNote.status || '')}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Reason</p>
                <p className="font-medium">{titleize(viewingNote.reason || '')}</p>
                {viewingNote.reasonDetails && (
                  <p className="text-sm text-gray-600 mt-1">{viewingNote.reasonDetails}</p>
                )}
              </div>
              {/* The entity tracks applied/balance amounts, not a voucher ref. */}
              {num(viewingNote.appliedAmount) > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">
                    Applied: {formatCurrency(num(viewingNote.appliedAmount))} • Balance:{' '}
                    {formatCurrency(num(viewingNote.balanceAmount))}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => setViewingNote(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyModal && applyingNote && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          ref={showApplyModalDialogRef}
        >
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Apply Credit Note</h2>
              <button onClick={() => { setShowApplyModal(false); setApplyingNote(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-600">Applying:</p>
                <p className="font-medium">{applyingNote.noteNumber}</p>
                <p className="text-green-600 font-medium">
                  Available balance: {formatCurrency(num(applyingNote.balanceAmount))}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Voucher <span className="text-red-500">*</span>
                </label>
                <select
                  value={applyVoucherId}
                  onChange={(e) => setApplyVoucherId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select voucher</option>
                  {vouchers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.voucherNumber} — {formatCurrency(num(v.netAmount))}
                    </option>
                  ))}
                </select>
                {vouchers.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    No payment vouchers for this supplier.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount to Apply <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={applyAmount}
                  onChange={(e) => setApplyAmount(e.target.value)}
                  max={num(applyingNote.balanceAmount)}
                  min={0}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Cannot exceed the note's balance of {formatCurrency(num(applyingNote.balanceAmount))}.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button onClick={() => { setShowApplyModal(false); setApplyingNote(null); }} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() =>
                  applyMutation.mutate({
                    id: applyingNote.id,
                    voucherId: applyVoucherId,
                    amount: Number(applyAmount),
                  })
                }
                disabled={
                  applyMutation.isPending ||
                  !applyVoucherId ||
                  !applyAmount ||
                  Number(applyAmount) <= 0 ||
                  Number(applyAmount) > num(applyingNote.balanceAmount)
                }
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {applyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Apply Credit
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
              <h2 className="text-xl font-bold text-gray-900">Create Note</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="CREDIT">Credit Note</option>
                  <option value="DEBIT">Debit Note</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select supplier</option>
                  <option value="s1">MedPharm Supplies Ltd</option>
                  <option value="s2">Uganda Lab Equipment Co</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  rows={2}
                  placeholder="Reason for this note..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="GRN or Invoice number"
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
                Create Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
