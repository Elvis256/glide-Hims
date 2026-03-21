import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  FileText,
  CheckCircle,
  AlertTriangle,
  Building2,
  Filter,
  Eye,
  ChevronRight,
  XCircle,
  Link,
  DollarSign,
  Package,
  Calculator,
  AlertCircle,
  Check,
  Loader2,
  Plus,
  X,
  Flag,
  CreditCard,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { useAuthStore } from '../../../store/auth';
import { invoiceMatchingService, type InvoiceMatch, type InvoiceMatchStatus } from '../../../services/invoice-matching';
import { procurementService, type GoodsReceipt, type GRNItem } from '../../../services/procurement';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';

// ── helpers ──

const STATUS_COLORS: Record<InvoiceMatchStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  matched: 'bg-blue-100 text-blue-700',
  mismatch: 'bg-orange-100 text-orange-700',
  flagged: 'bg-red-100 text-red-700',
  approved: 'bg-green-100 text-green-700',
  paid: 'bg-purple-100 text-purple-700',
};

const STATUS_ICONS: Record<InvoiceMatchStatus, React.ReactNode> = {
  pending: <FileText className="w-4 h-4" />,
  matched: <Link className="w-4 h-4" />,
  mismatch: <AlertTriangle className="w-4 h-4" />,
  flagged: <XCircle className="w-4 h-4" />,
  approved: <CheckCircle className="w-4 h-4" />,
  paid: <CreditCard className="w-4 h-4" />,
};

const statusLabel = (s: InvoiceMatchStatus) =>
  s.charAt(0).toUpperCase() + s.slice(1);

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString() : '—';

// ── modal item type ──

interface ModalItem {
  id: string;
  itemName: string;
  quantityExpected: number;
  quantityOrdered?: number;
  unitCost: number;
  unitPrice?: number;
  quantityReceived: number;
  invoiceQty: number;
  invoicePrice: number;
}

// ── Record Invoice Modal ──

function RecordInvoiceModal({
  grns,
  facilityId,
  onClose,
  onCreated,
}: {
  grns: GoodsReceipt[];
  facilityId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedGrnId, setSelectedGrnId] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<ModalItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const postedGrns = useMemo(() => grns.filter((g) => g.status === 'posted'), [grns]);

  const selectedGrn = useMemo(
    () => postedGrns.find((g) => g.id === selectedGrnId),
    [postedGrns, selectedGrnId],
  );

  const handleGrnSelect = (grnId: string) => {
    setSelectedGrnId(grnId);
    const grn = postedGrns.find((g) => g.id === grnId);
    if (grn) {
      setItems(
        grn.items.map((it: GRNItem) => ({
          id: it.itemId || it.id,
          itemName: it.itemName,
          quantityExpected: it.quantityExpected,
          unitCost: it.unitCost,
          quantityReceived: it.quantityReceived,
          invoiceQty: it.quantityReceived,
          invoicePrice: it.unitCost,
        })),
      );
    } else {
      setItems([]);
    }
  };

  const updateItem = (idx: number, field: 'invoiceQty' | 'invoicePrice', value: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const invoiceTotal = useMemo(
    () => items.reduce((sum, it) => sum + it.invoiceQty * it.invoicePrice, 0),
    [items],
  );

  const effectiveDueDate = dueDate || (() => {
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const handleSubmit = async () => {
    if (!selectedGrn || !vendorInvoiceNumber || !invoiceDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await invoiceMatchingService.create({
        facilityId,
        purchaseOrderId: selectedGrn.purchaseOrderId || '',
        grnId: selectedGrn.id,
        invoiceNumber: vendorInvoiceNumber,
        invoiceDate,
        dueDate: effectiveDueDate,
        invoiceAmount: invoiceTotal,
        items: items.map((it) => ({
          itemId: it.id,
          itemName: it.itemName,
          poQty: it.quantityExpected ?? (it as any).quantityOrdered ?? 0,
          poPrice: it.unitCost ?? (it as any).unitPrice ?? 0,
          grnQty: it.quantityReceived,
          invoiceQty: it.invoiceQty,
          invoicePrice: it.invoicePrice,
        })),
      });
      toast.success('Invoice match created');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create invoice match');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Record Vendor Invoice</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* GRN select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select GRN *</label>
            <select
              value={selectedGrnId}
              onChange={(e) => handleGrnSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Choose a posted GRN —</option>
              {postedGrns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.grnNumber} — {g.supplier?.name || 'Unknown'} — {formatCurrency(g.totalValue)}
                </option>
              ))}
            </select>
          </div>

          {selectedGrn && (
            <>
              {/* auto-populated references */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO Number</label>
                  <input
                    readOnly
                    value={selectedGrn.purchaseOrder?.orderNumber || '—'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <input
                    readOnly
                    value={selectedGrn.supplier?.name || '—'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                  />
                </div>
              </div>

              {/* invoice fields */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Invoice # *</label>
                  <input
                    value={vendorInvoiceNumber}
                    onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2024-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    placeholder="Defaults to +30 days"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {!dueDate && (
                    <p className="text-xs text-gray-400 mt-1">Defaults to invoice date + 30 days</p>
                  )}
                </div>
              </div>

              {/* items table */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Invoice Line Items</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">PO Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">PO Price</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">GRN Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Inv Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Inv Price</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((it, idx) => (
                        <tr key={it.id}>
                          <td className="px-3 py-2 text-gray-900">{it.itemName}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{it.quantityExpected}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(it.unitCost)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{it.quantityReceived}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={it.invoiceQty}
                              onChange={(e) => updateItem(idx, 'invoiceQty', Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={it.invoicePrice}
                              onChange={(e) => updateItem(idx, 'invoicePrice', Number(e.target.value))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">
                            {formatCurrency(it.invoiceQty * it.invoicePrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-right font-semibold text-gray-700">
                          Invoice Total
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">
                          {formatCurrency(invoiceTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedGrn || !vendorInvoiceNumber}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Invoice Match'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main page
// ══════════════════════════════════════════════════════════════

export default function PharmacyInvoiceMatchPage() {
  const { hasPermission } = usePermissions();

  const facilityId = useAuthStore((s) => s.user?.facilityId) || '';
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceMatchStatus | 'all'>('all');
  const [selectedMatch, setSelectedMatch] = useState<InvoiceMatch | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);

  // ── queries ──

  const {
    data: matches = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invoice-matches', facilityId],
    queryFn: () => invoiceMatchingService.list(facilityId),
    enabled: !!facilityId,
  });

  const { data: stats } = useQuery({
    queryKey: ['invoice-match-stats', facilityId],
    queryFn: () => invoiceMatchingService.getStats(facilityId),
    enabled: !!facilityId,
  });

  const { data: grns = [] } = useQuery({
    queryKey: ['goodsReceipts'],
    queryFn: () => procurementService.goodsReceipts.list(),
  });

  // ── mutations ──

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['invoice-matches'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-match-stats'] });
  };

  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      invoiceMatchingService.approve(id, { notes }),
    onSuccess: () => {
      invalidate();
      toast.success('Invoice approved for payment');
    },
    onError: () => toast.error('Failed to approve invoice'),
  });

  const flagMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invoiceMatchingService.flag(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Invoice flagged');
    },
    onError: () => toast.error('Failed to flag invoice'),
  });

  const paidMutation = useMutation({
    mutationFn: (id: string) => invoiceMatchingService.markAsPaid(id),
    onSuccess: () => {
      invalidate();
      toast.success('Invoice marked as paid');
    },
    onError: () => toast.error('Failed to mark as paid'),
  });

  // ── derived data ──

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (m.vendorInvoiceNumber || '').toLowerCase().includes(term) ||
        (m.purchaseOrder?.orderNumber || '').toLowerCase().includes(term) ||
        (m.supplier?.name || '').toLowerCase().includes(term) ||
        (m.matchNumber || '').toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [matches, searchTerm, statusFilter]);

  const computedStats = useMemo(() => {
    const s = stats || { pending: 0, matched: 0, mismatch: 0, approved: 0, paid: 0, flagged: 0, totalVarianceAmount: 0 };
    const total = s.pending + s.matched + s.mismatch + s.approved + s.paid + s.flagged;
    const discrepancies = s.mismatch + s.flagged;
    const matchedValue = matches
      .filter((m) => m.status === 'approved' || m.status === 'paid')
      .reduce((sum, m) => sum + (m.invoiceTotal || 0), 0);
    return { total, pending: s.pending, discrepancies, approved: s.approved, matchedValue };
  }, [stats, matches]);

  if (!hasPermission('inventory.create')) {
    return <AccessDenied />;
  }

  // ── auto-match all ──

  const handleAutoMatchAll = async () => {
    const existingGrnIds = new Set(matches.map((m) => m.grnId));
    const unmatchedGrns = grns.filter(
      (g) => g.status === 'posted' && !existingGrnIds.has(g.id),
    );
    if (unmatchedGrns.length === 0) {
      toast.info('No unmatched posted GRNs found');
      return;
    }
    toast.info(`Auto-matching ${unmatchedGrns.length} GRN(s)…`);
    let created = 0;
    for (const grn of unmatchedGrns) {
      try {
        await invoiceMatchingService.create({
          facilityId,
          purchaseOrderId: grn.purchaseOrderId || '',
          grnId: grn.id,
          invoiceNumber: grn.invoiceNumber || `AUTO-${grn.grnNumber}`,
          invoiceDate: grn.invoiceDate || new Date().toISOString().slice(0, 10),
          invoiceAmount: grn.totalValue,
          items: grn.items.map((it) => ({
            itemId: it.itemId || it.id,
            itemName: it.itemName,
            poQty: it.quantityExpected,
            poPrice: it.unitCost,
            grnQty: it.quantityReceived,
            invoiceQty: it.quantityExpected,
            invoicePrice: it.unitCost,
          })),
        });
        created++;
      } catch {
        // skip failures silently – the toast below summarises
      }
    }
    invalidate();
    toast.success(`Auto-matched ${created} of ${unmatchedGrns.length} GRN(s)`);
  };

  // ── action helpers ──

  const handleApprove = (match: InvoiceMatch) => {
    const notes = window.prompt('Approval notes (optional):');
    if (notes === null) return; // cancelled
    approveMutation.mutate({ id: match.id, notes: notes || undefined });
  };

  const handleFlag = (match: InvoiceMatch) => {
    const reason = window.prompt('Reason for flagging:');
    if (!reason) return;
    flagMutation.mutate({ id: match.id, reason });
  };

  const handleMarkPaid = (match: InvoiceMatch) => {
    paidMutation.mutate(match.id);
  };

  // ── loading / error states ──

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
        <p className="text-red-600">Failed to load invoice matches</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Matching</h1>
          <p className="text-gray-600">Match PO, GRN, and supplier invoices for payment approval</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoMatchAll}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Calculator className="w-4 h-4" />
            Auto-Match All
          </button>
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Record Invoice
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{computedStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-gray-700">{computedStats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Discrepancies</p>
              <p className="text-2xl font-bold text-orange-600">{computedStats.discrepancies}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{computedStats.approved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Matched Value</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(computedStats.matchedValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Invoice List */}
        <div className="flex-1 flex flex-col">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by invoice, PO, or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as InvoiceMatchStatus | 'all')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="matched">Matched</option>
                  <option value="mismatch">Mismatch</option>
                  <option value="flagged">Flagged</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Documents</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice Amt</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">PO Amt</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No invoices to match</p>
                        <p className="text-gray-400 text-sm mt-1">
                          Click &quot;Record Invoice&quot; to create a new invoice match
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredMatches.map((m) => (
                      <tr
                        key={m.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedMatch?.id === m.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedMatch(m)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{m.vendorInvoiceNumber}</p>
                            <p className="text-xs text-gray-500">{fmtDate(m.invoiceDate)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {m.purchaseOrder?.orderNumber || '—'}
                            </span>
                            <Link className="w-3 h-3 text-gray-400" />
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                              {m.goodsReceipt?.grnNumber || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-900">{m.supplier?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatCurrency(m.invoiceTotal)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-medium ${
                              m.poTotal === m.invoiceTotal
                                ? 'text-green-600'
                                : m.poTotal > 0
                                  ? 'text-orange-600'
                                  : 'text-gray-500'
                            }`}
                          >
                            {formatCurrency(m.poTotal)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${STATUS_COLORS[m.status]}`}
                          >
                            {STATUS_ICONS[m.status]}
                            {statusLabel(m.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMatch(m);
                              }}
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {m.status === 'matched' && (
                              <button
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(m);
                                }}
                                disabled={approveMutation.isPending}
                              >
                                Approve
                              </button>
                            )}
                            {['pending', 'matched', 'mismatch'].includes(m.status) && (
                              <button
                                className="px-2 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleFlag(m);
                                }}
                                disabled={flagMutation.isPending}
                              >
                                <Flag className="w-3 h-3 inline mr-1" />
                                Flag
                              </button>
                            )}
                            {m.status === 'approved' && (
                              <button
                                className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkPaid(m);
                                }}
                                disabled={paidMutation.isPending}
                              >
                                Mark Paid
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMatch(m);
                              }}
                              className="p-1.5 hover:bg-gray-100 rounded"
                            >
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Detail Panel ── */}
        {selectedMatch && (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            {/* header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{selectedMatch.vendorInvoiceNumber}</h2>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedMatch.status]}`}
                >
                  {statusLabel(selectedMatch.status)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{selectedMatch.supplier?.name || '—'}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedMatch.matchNumber} · Due {fmtDate(selectedMatch.dueDate)}
              </p>
            </div>

            {/* Three-way match visual */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Three-Way Match</h3>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 text-center p-3 bg-blue-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-blue-900">
                    {selectedMatch.purchaseOrder?.orderNumber || '—'}
                  </p>
                  <p className="text-xs text-blue-600">PO</p>
                  <p className="text-sm font-bold text-blue-800 mt-1">
                    {formatCurrency(selectedMatch.poTotal)}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <Check className="w-4 h-4 text-green-500" />
                  <div className="w-6 h-0.5 bg-gray-300" />
                </div>
                <div className="flex-1 text-center p-3 bg-green-50 rounded-lg">
                  <Package className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-green-900">
                    {selectedMatch.goodsReceipt?.grnNumber || '—'}
                  </p>
                  <p className="text-xs text-green-600">GRN</p>
                  <p className="text-sm font-bold text-green-800 mt-1">
                    {formatCurrency(selectedMatch.grnTotal)}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <Check className="w-4 h-4 text-green-500" />
                  <div className="w-6 h-0.5 bg-gray-300" />
                </div>
                <div className="flex-1 text-center p-3 bg-purple-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-purple-900">
                    {selectedMatch.vendorInvoiceNumber}
                  </p>
                  <p className="text-xs text-purple-600">Invoice</p>
                  <p className="text-sm font-bold text-purple-800 mt-1">
                    {formatCurrency(selectedMatch.invoiceTotal)}
                  </p>
                </div>
              </div>

              {/* variance bar */}
              <div className="mt-3 p-2 bg-gray-50 rounded-lg flex items-center justify-between text-xs">
                <span className="text-gray-600">Variance</span>
                <span
                  className={`font-semibold ${
                    selectedMatch.variance === 0
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`}
                >
                  {formatCurrency(selectedMatch.variance)} ({selectedMatch.variancePercent?.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Line items */}
            <div className="flex-1 overflow-auto p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Line Items</h3>
              <div className="space-y-3">
                {(selectedMatch.items || []).map((item) => (
                  <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">{item.itemName}</span>
                      <div className="flex items-center gap-1">
                        <span title={item.qtyMatch ? 'Qty matches' : 'Qty mismatch'}>
                          {item.qtyMatch ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </span>
                        <span title={item.priceMatch ? 'Price matches' : 'Price mismatch'}>
                          {item.priceMatch ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">PO</p>
                        <p className="font-medium">
                          {item.poQty} × {CURRENCY_SYMBOL} {item.poPrice}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">GRN</p>
                        <p
                          className={`font-medium ${
                            item.grnQty !== item.poQty ? 'text-orange-600' : ''
                          }`}
                        >
                          {item.grnQty}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Invoice</p>
                        <p
                          className={`font-medium ${
                            item.invoicePrice !== item.poPrice ? 'text-orange-600' : ''
                          }`}
                        >
                          {item.invoiceQty} × {CURRENCY_SYMBOL} {item.invoicePrice}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              {selectedMatch.notes && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs font-medium text-orange-800 mb-1">Notes</p>
                  <p className="text-xs text-orange-700">{selectedMatch.notes}</p>
                </div>
              )}

              {/* Approved by */}
              {selectedMatch.approvedBy && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs font-medium text-green-800 mb-1">Approved By</p>
                  <p className="text-xs text-green-700">
                    {selectedMatch.approvedBy.fullName}
                    {selectedMatch.approvedAt && ` on ${fmtDate(selectedMatch.approvedAt)}`}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                {selectedMatch.status === 'matched' && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedMatch)}
                      disabled={approveMutation.isPending}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                    >
                      {approveMutation.isPending ? 'Approving…' : 'Approve for Payment'}
                    </button>
                    <button
                      onClick={() => handleFlag(selectedMatch)}
                      disabled={flagMutation.isPending}
                      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                    >
                      Flag
                    </button>
                  </>
                )}
                {(selectedMatch.status === 'pending' || selectedMatch.status === 'mismatch') && (
                  <button
                    onClick={() => handleFlag(selectedMatch)}
                    disabled={flagMutation.isPending}
                    className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium disabled:opacity-50"
                  >
                    <Flag className="w-4 h-4 inline mr-1" />
                    Flag for Review
                  </button>
                )}
                {selectedMatch.status === 'approved' && (
                  <button
                    onClick={() => handleMarkPaid(selectedMatch)}
                    disabled={paidMutation.isPending}
                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50"
                  >
                    {paidMutation.isPending ? 'Processing…' : 'Mark as Paid'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Record Invoice Modal */}
      {showRecordModal && (
        <RecordInvoiceModal
          grns={grns}
          facilityId={facilityId}
          onClose={() => setShowRecordModal(false)}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}
