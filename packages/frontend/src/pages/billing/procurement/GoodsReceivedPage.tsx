import React, { useState, useMemo } from 'react';
import { useDialogA11y } from '../../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFacilityId } from '../../../lib/facility';
import {
  PackageCheck,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  Truck,
  Calendar,
  Building2,
  FileText,
  Printer,
  Download,
  ClipboardCheck,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Link,
  Loader2,
} from 'lucide-react';
import {
  procurementService,
  type GoodsReceipt,
  type GRNStatus,
  type InspectGRNDto,
  type PurchaseOrder,
  type CreateGoodsReceiptDto,
} from '../../../services/procurement';
import api, { getApiErrorMessage } from '../../../services/api';
import { CatalogItemPicker, type SelectedItem } from '../../../components/catalog';
import { CategoryContextBanner, useProcurementCategory } from '../../../components/procurement/CategoryContextBanner';

// Status display config mapped to backend GRNStatus values
const statusConfig: Record<GRNStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
  pending_inspection: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Clock className="w-3 h-3" />, label: 'Pending Inspection' },
  inspected: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <ClipboardCheck className="w-3 h-3" />, label: 'Inspected' },
  approved: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
  posted: { color: 'text-emerald-600', bg: 'bg-emerald-100', icon: <Package className="w-3 h-3" />, label: 'Posted' },
  cancelled: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
};

export default function GoodsReceivedPage() {
  const { category: __procCategory } = useProcurementCategory();
  const catalogModule: 'pharmacy' | 'general' | 'all' = __procCategory === 'drugs' ? 'pharmacy' : __procCategory === 'supplies' ? 'general' : 'all';

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<GRNStatus | 'all'>('all');
  const [selectedGRN, setSelectedGRN] = useState<GoodsReceipt | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Inspection used to be a single button that accepted every line in full
  // with a canned note, so a short, damaged or expired delivery could only be
  // recorded as if it had arrived perfect — and the debit-note flow further
  // down this page, which bills the supplier for rejected items, had nothing
  // to work from. The dialog below lets the storekeeper record what actually
  // turned up.
  const [inspectingGRN, setInspectingGRN] = useState<GoodsReceipt | null>(null);
  const [expandedItems, setExpandedItems] = useState<string | null>(null);

  const facilityId = useFacilityId();

  // Query for goods receipts
  const { data: grns = [], isLoading, error } = useQuery({
    queryKey: ['goods-receipts', facilityId, statusFilter],
    queryFn: () => procurementService.goodsReceipts.list({
      facilityId: facilityId || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    staleTime: 30000,
  });

  // Query for purchase orders (for create modal) — include sent and partially received
  const { data: sentPOs2 = [] } = useQuery({
    queryKey: ['purchase-orders', facilityId, 'for-grn-sent'],
    queryFn: () => procurementService.purchaseOrders.list({
      facilityId: facilityId || undefined,
      status: 'sent',
    }),
    staleTime: 30000,
  });
  const { data: partialPOs2 = [] } = useQuery({
    queryKey: ['purchase-orders', facilityId, 'for-grn-partial'],
    queryFn: () => procurementService.purchaseOrders.list({
      facilityId: facilityId || undefined,
      status: 'partially_received',
    }),
    staleTime: 30000,
  });
  const purchaseOrders = useMemo(() => {
    const arr1 = Array.isArray(sentPOs2) ? sentPOs2 : [];
    const arr2 = Array.isArray(partialPOs2) ? partialPOs2 : [];
    const all = [...arr1, ...arr2];
    const seen = new Set<string>();
    return all.filter(po => {
      if (seen.has(po.id)) return false;
      seen.add(po.id);
      return true;
    });
  }, [sentPOs2, partialPOs2]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateGoodsReceiptDto) => procurementService.goodsReceipts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      setShowCreateModal(false);
    },
  });

  const createFromPOMutation = useMutation({
    mutationFn: ({ purchaseOrderId, receivedItems, storeId }: {
      purchaseOrderId: string;
      receivedItems: { itemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string }[];
      storeId?: string;
    }) => procurementService.goodsReceipts.createFromPO(purchaseOrderId, receivedItems, storeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setShowCreateModal(false);
    },
  });

  // The QueryClient already installs a global mutation onError, so these
  // were never silent — but a mutation-level onError REPLACES the global one
  // rather than running alongside it, so anything defined here has to go
  // through the same formatter or it loses timeout handling and field-level
  // validation detail. The value added here is the specific fallback wording
  // when the server sends no message at all.
  const showError = (fallback: string) => (e: unknown) =>
    toast.error(getApiErrorMessage(e, fallback));

  const inspectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InspectGRNDto }) => 
      procurementService.goodsReceipts.inspect(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      toast.success('Inspection recorded');
      setInspectingGRN(null);
      setSelectedGRN(null);
    },
    onError: showError('Failed to record inspection'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.goodsReceipts.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      toast.success('GRN approved');
      setSelectedGRN(null);
    },
    onError: showError('Failed to approve GRN'),
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => procurementService.goodsReceipts.post(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      toast.success('GRN posted — stock updated');
      setSelectedGRN(null);
    },
    onError: showError('Failed to post GRN'),
  });

  const isAnyMutationLoading = createMutation.isPending || createFromPOMutation.isPending || 
    inspectMutation.isPending || approveMutation.isPending || postMutation.isPending;

  const filteredGRNs = useMemo(() => {
    return grns.filter((grn) => {
      const matchesSearch =
        grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (grn.purchaseOrder?.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (grn.supplier?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [grns, searchTerm]);

  const pendingDeliveries = useMemo(() => {
    // Fresh GRNs are created as 'draft' and nothing ever transitions them to
    // 'pending_inspection' — found by walking the flow live: this counter
    // read 0 with two deliveries sitting uninspected. The backend accepts
    // inspection from either status, so count and gate on both.
    return grns.filter((grn) => grn.status === 'draft' || grn.status === 'pending_inspection')
      .length;
  }, [grns]);

  const getReceiptPercentage = (grn: GoodsReceipt) => {
    const totalExpected = grn.items.reduce((sum, item) => sum + item.quantityExpected, 0);
    const totalReceived = grn.items.reduce((sum, item) => sum + item.quantityReceived, 0);
    if (totalExpected === 0) return 0;
    return Math.round((totalReceived / totalExpected) * 100);
  };


  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      <CategoryContextBanner />
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <PackageCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Goods Received Notes</h1>
              <p className="text-sm text-gray-500">Record and manage incoming deliveries</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingDeliveries > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Truck className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  {pendingDeliveries} pending {pendingDeliveries === 1 ? 'delivery' : 'deliveries'}
                </span>
              </div>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create GRN
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search GRN, PO number, or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {(['all', 'draft', 'pending_inspection', 'inspected', 'approved', 'posted', 'cancelled'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* GRN List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
              <p className="text-sm text-gray-500">Loading goods receipts...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <AlertCircle className="w-16 h-16 mb-4 text-red-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">Error Loading Data</h3>
              <p className="text-sm text-gray-500 mb-4">Failed to load goods receipts</p>
            </div>
          ) : filteredGRNs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <PackageCheck className="w-16 h-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Goods Received Notes</h3>
              <p className="text-sm text-gray-500 mb-4">Record deliveries when goods arrive</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4" />
                Create GRN
              </button>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredGRNs.map((grn) => {
              const receiptPct = getReceiptPercentage(grn);
              
              return (
                <div
                  key={grn.id}
                  onClick={() => setSelectedGRN(grn)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedGRN?.id === grn.id ? 'ring-2 ring-emerald-500 border-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-emerald-600">{grn.grnNumber}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[grn.status]?.bg || 'bg-gray-100'} ${statusConfig[grn.status]?.color || 'text-gray-600'}`}
                        >
                          {statusConfig[grn.status]?.icon}
                          {statusConfig[grn.status]?.label || grn.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{grn.supplier?.name || 'Unknown Supplier'}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {grn.purchaseOrder && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {grn.purchaseOrder.orderNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {grn.items.length} items
                        </span>
                        {grn.receivedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(grn.receivedAt).toLocaleDateString()}
                          </span>
                        )}
                        {grn.invoiceNumber && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Link className="w-3.5 h-3.5" />
                            {grn.invoiceNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {grn.items.reduce((sum, item) => sum + item.quantityReceived, 0)}/{grn.items.reduce((sum, item) => sum + item.quantityExpected, 0)}
                      </div>
                      <p className="text-xs text-gray-500">Items Received</p>
                    </div>
                  </div>

                  {/* Receipt Progress */}
                  {grn.status !== 'pending_inspection' && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Receipt Progress</span>
                        <span className={`font-medium ${receiptPct === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                          {receiptPct}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            receiptPct === 100 ? 'bg-green-500' : receiptPct > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${receiptPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Show rejection info if any items were rejected */}
                  {grn.items.some((item) => (item.quantityRejected || 0) > 0) && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                          {grn.items.filter((item) => (item.quantityRejected || 0) > 0).length} item(s) with rejections
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedGRN && (
          <div className="w-[450px] border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">GRN Details</h2>
              <div className="flex items-center gap-2">
                <button className="p-1.5 border rounded hover:bg-gray-100">
                  <Printer className="w-4 h-4 text-gray-600" />
                </button>
                <button className="p-1.5 border rounded hover:bg-gray-100">
                  <Download className="w-4 h-4 text-gray-600" />
                </button>
                <button onClick={() => setSelectedGRN(null)} className="p-1 hover:bg-gray-200 rounded">
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">GRN Number</p>
                  <p className="font-mono font-bold text-emerald-600">{selectedGRN.grnNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">PO Number</p>
                  <p className="font-mono text-sm">{selectedGRN.purchaseOrder?.orderNumber || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Supplier</p>
                <p className="font-medium">{selectedGRN.supplier?.name || '-'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Received Date</p>
                  <p className="text-sm">{selectedGRN.receivedAt ? new Date(selectedGRN.receivedAt).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[selectedGRN.status]?.bg || 'bg-gray-100'} ${statusConfig[selectedGRN.status]?.color || 'text-gray-600'}`}>
                    {statusConfig[selectedGRN.status]?.icon}
                    {statusConfig[selectedGRN.status]?.label || selectedGRN.status}
                  </span>
                </div>
              </div>

              {selectedGRN.invoiceNumber && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Linked Invoice</p>
                  <p className="font-medium text-blue-700">{selectedGRN.invoiceNumber}</p>
                </div>
              )}

              {/* Items Received */}
              <div>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedItems(expandedItems === 'items' ? null : 'items')}
                >
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Items Received</p>
                  {expandedItems === 'items' ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className={`mt-2 space-y-2 ${expandedItems === 'items' ? '' : 'max-h-48 overflow-hidden'}`}>
                  {selectedGRN.items.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{item.itemName}</span>
                        {item.batchNumber && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700">
                            Batch: {item.batchNumber}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Expected</span>
                          <p className="font-medium">{item.quantityExpected}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Received</span>
                          <p className="font-medium">{item.quantityReceived}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Accepted</span>
                          <p className="font-medium text-green-600">{item.quantityAccepted ?? '-'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Rejected</span>
                          <p className={`font-medium ${(item.quantityRejected || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {item.quantityRejected ?? 0}
                          </p>
                        </div>
                      </div>
                      {item.expiryDate && (
                        <p className="text-xs text-gray-500 mt-2 pt-2 border-t">
                          Expiry: {new Date(item.expiryDate).toLocaleDateString()}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-gray-500 mt-1">{item.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Inspection Info */}
              {selectedGRN.inspectedAt && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-600 uppercase tracking-wide mb-1">Inspection</p>
                  <p className="text-sm text-blue-700">
                    Inspected on {new Date(selectedGRN.inspectedAt).toLocaleDateString()}
                  </p>
                  {selectedGRN.inspectionNotes && (
                    <p className="text-sm text-blue-600 mt-1">{selectedGRN.inspectionNotes}</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedGRN.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{selectedGRN.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {(selectedGRN.status === 'draft' || selectedGRN.status === 'pending_inspection') && (
                  <button 
                    onClick={() => setInspectingGRN(selectedGRN)}
                    disabled={isAnyMutationLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {inspectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ClipboardCheck className="w-4 h-4" />
                    )}
                    Inspect Items
                  </button>
                )}
                {selectedGRN.status === 'inspected' && (
                  <button 
                    onClick={() => approveMutation.mutate(selectedGRN.id)}
                    disabled={isAnyMutationLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Approve GRN
                  </button>
                )}
                {selectedGRN.status === 'approved' && (
                  <button 
                    onClick={() => postMutation.mutate(selectedGRN.id)}
                    disabled={isAnyMutationLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {postMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Package className="w-4 h-4" />
                    )}
                    Post to Inventory
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Eye className="w-4 h-4" />
                  View Full Details
                </button>
                {selectedGRN.items?.some((i) => (i.quantityRejected || 0) > 0) && (
                  <CreateDebitNoteAction
                    grnId={selectedGRN.id}
                    grnNumber={selectedGRN.grnNumber}
                    onCreated={() => queryClient.invalidateQueries({ queryKey: ['goods-receipts'] })}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inspection */}
      {inspectingGRN && (
        <InspectGRNModal
          grn={inspectingGRN}
          isSubmitting={inspectMutation.isPending}
          onClose={() => setInspectingGRN(null)}
          onSubmit={(data) => inspectMutation.mutate({ id: inspectingGRN.id, data })}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateGRNModal
          purchaseOrders={purchaseOrders}
          facilityId={facilityId || ''}
          isLoadingPO={createFromPOMutation.isPending}
          isLoadingDirect={createMutation.isPending}
          onClose={() => setShowCreateModal(false)}
          onSubmitFromPO={(purchaseOrderId, receivedItems, storeId) => {
            createFromPOMutation.mutate({ purchaseOrderId, receivedItems, storeId });
          }}
          onSubmitDirect={(data) => {
            createMutation.mutate(data);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

/**
 * Records what actually arrived, line by line.
 *
 * Deliveries turn up short, damaged, or too close to expiry, and the GRN
 * schema has always carried quantityRejected and rejectionReason to say so —
 * the page just never offered anywhere to enter them, so every delivery was
 * inspected as perfect. Accepted quantity is what posts to stock, so this is
 * also the last point at which a discrepancy can be caught before the ledger
 * takes the supplier's word for it.
 */
interface InspectGRNModalProps {
  grn: GoodsReceipt;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: InspectGRNDto) => void;
}

export function InspectGRNModal({ grn, isSubmitting, onClose, onSubmit }: InspectGRNModalProps) {
  const dialogRef = useDialogA11y<HTMLDivElement>({ open: true, onClose });

  const [lines, setLines] = useState(() =>
    grn.items.map((item) => ({
      itemId: item.itemId,
      itemName: item.itemName,
      itemUnit: item.itemUnit,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      quantityReceived: item.quantityReceived,
      accepted: item.quantityReceived,
      rejected: 0,
      rejectionReason: '',
    })),
  );
  const [notes, setNotes] = useState('');

  const update = (itemId: string, patch: Partial<(typeof lines)[number]>) =>
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));

  // Typing in one box implies the other: the two must account for the
  // delivery between them, and making the storekeeper do that arithmetic
  // twice is how lines end up not adding up. Both derive from the previous
  // state rather than the render closure, so holding a key down cannot
  // compute from a value that has already been superseded.
  const setSplit = (itemId: string, value: number, edited: 'accepted' | 'rejected') =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.itemId !== itemId) return l;
        const entered = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, l.quantityReceived));
        const other = l.quantityReceived - entered;
        return edited === 'accepted'
          ? { ...l, accepted: entered, rejected: other, rejectionReason: other > 0 ? l.rejectionReason : '' }
          : { ...l, rejected: entered, accepted: other, rejectionReason: entered > 0 ? l.rejectionReason : '' };
      }),
    );

  const setAccepted = (itemId: string, value: number) => setSplit(itemId, value, 'accepted');
  const setRejected = (itemId: string, value: number) => setSplit(itemId, value, 'rejected');

  const acceptAll = () =>
    setLines((prev) =>
      prev.map((l) => ({ ...l, accepted: l.quantityReceived, rejected: 0, rejectionReason: '' })),
    );

  const totalRejected = lines.reduce((sum, l) => sum + l.rejected, 0);
  const missingReason = lines.filter((l) => l.rejected > 0 && !l.rejectionReason.trim());
  const overAccounted = lines.filter((l) => l.accepted + l.rejected > l.quantityReceived);
  const canSubmit = !isSubmitting && missingReason.length === 0 && overAccounted.length === 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      inspectedItems: lines.map((l) => ({
        itemId: l.itemId,
        quantityAccepted: l.accepted,
        quantityRejected: l.rejected,
        rejectionReason: l.rejected > 0 ? l.rejectionReason.trim() : undefined,
      })),
      inspectionNotes: notes.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspect-grn-title"
      ref={dialogRef}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0">
          <div>
            <h3 id="inspect-grn-title" className="font-semibold text-gray-900">
              Inspect {grn.grnNumber}
            </h3>
            <p className="text-sm text-gray-500">
              {grn.supplier?.name || 'Supplier'} · {lines.length} line
              {lines.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close inspection"
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-gray-600">
            Accepted quantities are what post to stock. Reject anything short, damaged or
            near expiry.
          </p>
          <button
            type="button"
            onClick={acceptAll}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white whitespace-nowrap"
          >
            Accept all in full
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {lines.map((line) => (
            <div key={line.itemId} className="border rounded-lg p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{line.itemName}</p>
                  <p className="text-xs text-gray-500">
                    Received {line.quantityReceived}
                    {line.itemUnit ? ` ${line.itemUnit}` : ''}
                    {line.batchNumber ? ` · batch ${line.batchNumber}` : ''}
                    {line.expiryDate
                      ? ` · expires ${new Date(line.expiryDate).toLocaleDateString()}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-end gap-3 flex-shrink-0">
                  <label className="text-xs text-gray-600">
                    <span className="block mb-1">Accepted</span>
                    <input
                      type="number"
                      min={0}
                      max={line.quantityReceived}
                      value={line.accepted}
                      onChange={(e) => setAccepted(line.itemId, Number(e.target.value))}
                      className="w-24 px-2 py-1.5 border rounded-lg text-right font-mono"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    <span className="block mb-1">Rejected</span>
                    <input
                      type="number"
                      min={0}
                      max={line.quantityReceived}
                      value={line.rejected}
                      onChange={(e) => setRejected(line.itemId, Number(e.target.value))}
                      className={`w-24 px-2 py-1.5 border rounded-lg text-right font-mono ${
                        line.rejected > 0 ? 'border-red-300 bg-red-50 text-red-700' : ''
                      }`}
                    />
                  </label>
                </div>
              </div>

              {line.rejected > 0 && (
                <div className="mt-3">
                  <label className="block text-xs text-gray-600 mb-1">
                    Why were {line.rejected} rejected?{' '}
                    <span className="text-red-600">required</span>
                  </label>
                  <input
                    type="text"
                    value={line.rejectionReason}
                    onChange={(e) => update(line.itemId, { rejectionReason: e.target.value })}
                    placeholder="e.g. damaged in transit, expires within 3 months, wrong strength"
                    className="w-full px-3 py-1.5 border rounded-lg text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t p-5 space-y-3 flex-shrink-0">
          <div>
            <label htmlFor="inspection-notes" className="block text-sm text-gray-700 mb-1">
              Inspection notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              id="inspection-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the approver should know about this delivery"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {totalRejected > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              {totalRejected} unit{totalRejected === 1 ? '' : 's'} will be rejected and will not
              enter stock. You can raise a debit note for them once this GRN is posted.
            </div>
          )}

          {missingReason.length > 0 && (
            <p className="text-sm text-red-600">
              Give a reason for every rejected line before recording the inspection.
            </p>
          )}

          <div className="flex gap-2 justify-end">
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ClipboardCheck className="w-4 h-4" />
              )}
              Record inspection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Create GRN Modal Component
interface CreateGRNModalProps {
  purchaseOrders: PurchaseOrder[];
  facilityId: string;
  isLoadingPO: boolean;
  isLoadingDirect: boolean;
  onClose: () => void;
  onSubmitFromPO: (purchaseOrderId: string, receivedItems: { itemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string }[], storeId?: string) => void;
  onSubmitDirect: (data: CreateGoodsReceiptDto) => void;
}

function CreateGRNModal({ purchaseOrders, facilityId, isLoadingPO, isLoadingDirect, onClose, onSubmitFromPO, onSubmitDirect }: CreateGRNModalProps) {
  // Resolved here rather than read from GoodsReceivedPage — this is a sibling
  // component, so the page's catalogModule is not in scope.
  const { category: __procCategory } = useProcurementCategory();
  const catalogModule: 'pharmacy' | 'general' | 'all' =
    __procCategory === 'drugs' ? 'pharmacy' : __procCategory === 'supplies' ? 'general' : 'all';

  const [mode, setMode] = useState<'po' | 'direct'>('po');
  const [selectedPOId, setSelectedPOId] = useState('');
  const [storeId, setStoreId] = useState('');
  const [receivedItems, setReceivedItems] = useState<{ itemId: string; quantityReceived: number; batchNumber: string; expiryDate: string }[]>([]);
  const [notes, setNotes] = useState('');
  // Direct GRN fields
  const [directSupplierId, setDirectSupplierId] = useState('');
  const [directItems, setDirectItems] = useState<Array<{ rowId: string; itemId: string; itemCode: string; itemName: string; itemUnit: string; quantityReceived: number; unitCost: number; batchNumber: string; expiryDate: string }>>([
    { rowId: '1', itemId: '', itemCode: '', itemName: '', itemUnit: 'unit', quantityReceived: 0, unitCost: 0, batchNumber: '', expiryDate: '' },
  ]);

  const { data: storesData } = useQuery({
    queryKey: ['stores-for-facility', facilityId],
    queryFn: () => api.get('/stores', { params: { facilityId, canReceive: true } }).then((r) => r.data),
    enabled: !!facilityId,
    staleTime: 60000,
  });
  const stores: any[] = Array.isArray(storesData) ? storesData : (storesData?.data ?? storesData?.items ?? []);

  const selectedPO = purchaseOrders.find(po => po.id === selectedPOId);

  const handlePOChange = (poId: string) => {
    setSelectedPOId(poId);
    const po = purchaseOrders.find(p => p.id === poId);
    if (po) {
      setReceivedItems(po.items.map(item => ({
        itemId: item.itemId,
        quantityReceived: item.quantityOrdered - item.quantityReceived,
        batchNumber: '',
        expiryDate: '',
      })));
    } else {
      setReceivedItems([]);
    }
  };

  const updateItemQuantity = (itemId: string, qty: number) => {
    setReceivedItems(items => items.map(item => 
      item.itemId === itemId ? { ...item, quantityReceived: qty } : item
    ));
  };

  const updateItemBatch = (itemId: string, batchNumber: string) => {
    setReceivedItems(items => items.map(item => 
      item.itemId === itemId ? { ...item, batchNumber } : item
    ));
  };

  const handleSubmit = () => {
    if (mode === 'po') {
      if (!selectedPOId) return;
      onSubmitFromPO(selectedPOId, receivedItems.filter(item => item.quantityReceived > 0).map(item => ({
        itemId: item.itemId,
        quantityReceived: item.quantityReceived,
        batchNumber: item.batchNumber || undefined,
        expiryDate: item.expiryDate || undefined,
      })), storeId || undefined);
    } else {
      const validItems = directItems.filter(i => i.itemId && i.quantityReceived > 0);
      if (validItems.length === 0 || !directSupplierId) return;
      const data: CreateGoodsReceiptDto = {
        facilityId,
        supplierId: directSupplierId,
        storeId: storeId || undefined,
        notes: notes || undefined,
        items: validItems.map(i => ({
          itemId: i.itemId,
          itemCode: i.itemCode,
          itemName: i.itemName,
          itemUnit: i.itemUnit,
          quantityExpected: i.quantityReceived,
          quantityReceived: i.quantityReceived,
          unitCost: i.unitCost,
          batchNumber: i.batchNumber || undefined,
          expiryDate: i.expiryDate || undefined,
        })),
      };
      onSubmitDirect(data);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Goods Received Note</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Mode toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode('po')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${mode === 'po' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Receive Against PO
            </button>
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${mode === 'direct' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Walk-in / Direct Receipt
            </button>
          </div>

          {mode === 'po' && (
          <div className="space-y-4">
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase Order</label>
            <select 
              value={selectedPOId}
              onChange={(e) => handlePOChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select a PO with pending delivery</option>
              {purchaseOrders.map(po => (
                <option key={po.id} value={po.id}>
                  {po.orderNumber} - {po.supplier?.name || 'Unknown'} - {po.items.length} items
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receive Into Store <span className="text-gray-400 font-normal">(optional — defaults to facility-level stock)</span>
            </label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— Facility-level (general stock) —</option>
              {stores.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.type ? ` · ${s.type}` : ''}{s.department ? ` · ${s.department}` : ''}
                </option>
              ))}
            </select>
            {stores.length === 0 && facilityId && (
              <p className="text-xs text-gray-500 mt-1">No stores configured for this facility — stock will go to facility-level inventory.</p>
            )}
          </div>

          {selectedPO && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items to Receive</label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="text-center px-3 py-2">Ordered</th>
                        <th className="text-center px-3 py-2">Already Received</th>
                        <th className="text-center px-3 py-2">Receiving Now</th>
                        <th className="text-left px-3 py-2">Batch #</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item) => {
                        const receivedItem = receivedItems.find(ri => ri.itemId === item.itemId);
                        const remaining = item.quantityOrdered - item.quantityReceived;
                        return (
                          <tr key={item.id} className="border-t">
                            <td className="px-3 py-2">
                              <div className="font-medium">{item.itemName}</div>
                              <div className="text-xs text-gray-500">{item.itemCode}</div>
                            </td>
                            <td className="px-3 py-2 text-center text-gray-500">{item.quantityOrdered}</td>
                            <td className="px-3 py-2 text-center text-gray-500">{item.quantityReceived}</td>
                            <td className="px-3 py-2">
                              <input 
                                type="number" 
                                className="w-20 px-2 py-1 border rounded text-center" 
                                value={receivedItem?.quantityReceived || 0}
                                min={0}
                                max={remaining}
                                onChange={(e) => updateItemQuantity(item.itemId, Math.min(remaining, parseInt(e.target.value) || 0))}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input 
                                type="text" 
                                className="w-24 px-2 py-1 border rounded text-sm" 
                                placeholder="Batch"
                                value={receivedItem?.batchNumber || ''}
                                onChange={(e) => updateItemBatch(item.itemId, e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder="Any observations or notes about the delivery..."
                />
              </div>
            </>
          )}
          </div> )} {/* end mode=po block */}

          {mode === 'direct' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={directSupplierId}
                  onChange={(e) => setDirectSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Enter supplier ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items Received</label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="px-3 py-2 w-20">Qty</th>
                        <th className="px-3 py-2 w-24">Unit Cost</th>
                        <th className="px-3 py-2 w-24">Batch #</th>
                        <th className="px-3 py-2 w-28">Expiry</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {directItems.map((line) => (
                        <tr key={line.rowId} className="border-t">
                          <td className="px-3 py-2 min-w-[180px]">
                            <CatalogItemPicker
                              module={catalogModule}
                              value={line.itemId ? { id: line.itemId, source: 'inventory', code: line.itemCode, name: line.itemName, unit: line.itemUnit } : null}
                              onChange={(picked) =>
                                setDirectItems((prev) =>
                                  prev.map((l) =>
                                    l.rowId === line.rowId
                                      ? { ...l, itemId: picked?.id || '', itemCode: picked?.code || '', itemName: picked?.name || '', itemUnit: picked?.unit || l.itemUnit, unitCost: picked?.lastPrice ?? l.unitCost }
                                      : l,
                                  ),
                                )
                              }
                              size="sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} value={line.quantityReceived || ''}
                              onChange={(e) => setDirectItems(prev => prev.map(l => l.rowId === line.rowId ? { ...l, quantityReceived: parseInt(e.target.value) || 0 } : l))}
                              className="w-16 px-2 py-1 border rounded text-sm" placeholder="0" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} value={line.unitCost || ''}
                              onChange={(e) => setDirectItems(prev => prev.map(l => l.rowId === line.rowId ? { ...l, unitCost: parseFloat(e.target.value) || 0 } : l))}
                              className="w-20 px-2 py-1 border rounded text-sm" placeholder="0.00" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={line.batchNumber}
                              onChange={(e) => setDirectItems(prev => prev.map(l => l.rowId === line.rowId ? { ...l, batchNumber: e.target.value } : l))}
                              className="w-20 px-2 py-1 border rounded text-sm" placeholder="Batch" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="date" value={line.expiryDate}
                              onChange={(e) => setDirectItems(prev => prev.map(l => l.rowId === line.rowId ? { ...l, expiryDate: e.target.value } : l))}
                              className="w-28 px-2 py-1 border rounded text-sm" />
                          </td>
                          <td className="px-3 py-2">
                            <button type="button" onClick={() => setDirectItems(prev => prev.filter(l => l.rowId !== line.rowId))} disabled={directItems.length === 1} className="text-red-400 hover:text-red-600 disabled:opacity-30">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" onClick={() => setDirectItems(prev => [...prev, { rowId: String(Date.now()), itemId: '', itemCode: '', itemName: '', itemUnit: 'unit', quantityReceived: 0, unitCost: 0, batchNumber: '', expiryDate: '' }])}
                  className="mt-2 flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700">
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" rows={2} placeholder="Delivery notes..." />
              </div>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={
              mode === 'po'
                ? (!selectedPOId || isLoadingPO || receivedItems.every(item => item.quantityReceived === 0))
                : (!directSupplierId || isLoadingDirect || directItems.every(i => !i.itemId || i.quantityReceived === 0))
            }
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {(mode === 'po' ? isLoadingPO : isLoadingDirect) ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <PackageCheck className="w-4 h-4" />
            )}
            Create GRN
          </button>
        </div>
      </div>
    </div>
  );
}
// Debit Note Action — appears when GRN has rejected items
function CreateDebitNoteAction({
  grnId,
  grnNumber,
  onCreated,
}: {
  grnId: string;
  grnNumber: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reasonDetails, setReasonDetails] = useState('');

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const openDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!open,
    onClose: () => setOpen(false),
  });

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/supplier-finance/credit-notes/from-grn/${grnId}/preview`);
      setPreview(res.data);
      setReasonDetails(
        (res.data.rejectedItems || [])
          .filter((i: any) => i.rejectionReason)
          .map((i: any) => `${i.description}: ${i.rejectionReason}`)
          .join('; '),
      );
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, 'Failed to load preview'));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open && !preview) loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/supplier-finance/credit-notes/from-grn/${grnId}`, {
        reasonDetails,
      });
      toast.success(`Debit note ${res.data.noteNumber} created (DRAFT)`);
      setOpen(false);
      setPreview(null);
      onCreated();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, 'Failed to create debit note'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
      >
        <AlertTriangle className="w-4 h-4" />
        Create Debit Note for Rejected Items
      </button>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          ref={openDialogRef}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Debit Note from GRN {grnNumber}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              {loading && <p className="text-center text-gray-500 py-6">Loading preview…</p>}
              {!loading && preview && (
                <>
                  {!preview.canCreate && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                      Cannot create: {preview.blockReason}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Supplier</p>
                      <p className="font-medium">{preview.supplierName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Total Rejected Value</p>
                      <p className="font-mono font-semibold text-red-600">
                        {Number(preview.totalRejectedValue).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase mb-2">Rejected Items</p>
                    <table className="w-full text-sm border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-3 py-2">Item</th>
                          <th className="text-right px-3 py-2">Qty</th>
                          <th className="text-right px-3 py-2">Unit Cost</th>
                          <th className="text-right px-3 py-2">Line Total</th>
                          <th className="text-left px-3 py-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {preview.rejectedItems.map((it: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{it.description}</td>
                            <td className="px-3 py-2 text-right">{it.quantityRejected}</td>
                            <td className="px-3 py-2 text-right font-mono">{Number(it.unitCost).toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono">{Number(it.lineTotal).toFixed(2)}</td>
                            <td className="px-3 py-2 text-xs text-gray-600">{it.rejectionReason || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase block mb-1">Reason / Notes</label>
                    <textarea
                      value={reasonDetails}
                      onChange={(e) => setReasonDetails(e.target.value)}
                      rows={3}
                      className="w-full border rounded px-3 py-2 text-sm"
                      placeholder="Detail the reason for the debit note"
                    />
                  </div>
                  {preview.existingDebitNotes?.length > 0 && (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      Existing notes for this GRN:{' '}
                      {preview.existingDebitNotes.map((n: any) => `${n.noteNumber} (${n.status})`).join(', ')}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 border rounded text-sm">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || !preview?.canCreate}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create Debit Note (DRAFT)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
