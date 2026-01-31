import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// Status display config mapped to backend GRNStatus values
const statusConfig: Record<GRNStatus | 'draft', { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Clock className="w-3 h-3" />, label: 'Draft' },
  pending: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  inspected: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <ClipboardCheck className="w-3 h-3" />, label: 'Inspected' },
  approved: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
  posted: { color: 'text-emerald-600', bg: 'bg-emerald-100', icon: <Package className="w-3 h-3" />, label: 'Posted' },
  rejected: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
};

export default function GoodsReceivedPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<GRNStatus | 'all'>('all');
  const [selectedGRN, setSelectedGRN] = useState<GoodsReceipt | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string | null>(null);

  // Get facilityId from localStorage
  const facilityId = localStorage.getItem('facilityId') || '';

  // Query for goods receipts
  const { data: grns = [], isLoading, error } = useQuery({
    queryKey: ['goods-receipts', facilityId, statusFilter],
    queryFn: () => procurementService.goodsReceipts.list({
      facilityId: facilityId || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    staleTime: 30000,
  });

  // Query for purchase orders (for create modal)
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase-orders', facilityId, 'for-grn'],
    queryFn: () => procurementService.purchaseOrders.list({
      facilityId: facilityId || undefined,
      status: 'sent', // Only sent POs can be received
    }),
    staleTime: 30000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateGoodsReceiptDto) => procurementService.goodsReceipts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      setShowCreateModal(false);
    },
  });

  const createFromPOMutation = useMutation({
    mutationFn: ({ purchaseOrderId, receivedItems }: { 
      purchaseOrderId: string; 
      receivedItems: { itemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string }[] 
    }) => procurementService.goodsReceipts.createFromPO(purchaseOrderId, receivedItems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setShowCreateModal(false);
    },
  });

  const inspectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InspectGRNDto }) => 
      procurementService.goodsReceipts.inspect(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      setSelectedGRN(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.goodsReceipts.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      setSelectedGRN(null);
    },
  });

  const postMutation = useMutation({
    mutationFn: (id: string) => procurementService.goodsReceipts.post(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goods-receipts'] });
      setSelectedGRN(null);
    },
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
    return grns.filter((grn) => grn.status === 'pending').length;
  }, [grns]);

  const getReceiptPercentage = (grn: GoodsReceipt) => {
    const totalExpected = grn.items.reduce((sum, item) => sum + item.quantityExpected, 0);
    const totalReceived = grn.items.reduce((sum, item) => sum + item.quantityReceived, 0);
    if (totalExpected === 0) return 0;
    return Math.round((totalReceived / totalExpected) * 100);
  };

  const handleInspect = (grn: GoodsReceipt) => {
    // Auto-accept all items for simple inspection
    const inspectData: InspectGRNDto = {
      inspectedItems: grn.items.map(item => ({
        itemId: item.itemId,
        quantityAccepted: item.quantityReceived,
        quantityRejected: 0,
      })),
      inspectionNotes: 'Items inspected and accepted',
    };
    inspectMutation.mutate({ id: grn.id, data: inspectData });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
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
              {(['all', 'pending', 'inspected', 'approved', 'posted', 'rejected'] as const).map((status) => (
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
                        {grn.receivedDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(grn.receivedDate).toLocaleDateString()}
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
                  {grn.status !== 'pending' && (
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
                  <p className="text-sm">{selectedGRN.receivedDate ? new Date(selectedGRN.receivedDate).toLocaleDateString() : '-'}</p>
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
                {selectedGRN.status === 'pending' && (
                  <button 
                    onClick={() => handleInspect(selectedGRN)}
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateGRNModal
          purchaseOrders={purchaseOrders}
          isLoading={createFromPOMutation.isPending}
          onClose={() => setShowCreateModal(false)}
          onSubmit={(purchaseOrderId, receivedItems) => {
            createFromPOMutation.mutate({ purchaseOrderId, receivedItems });
          }}
        />
      )}
    </div>
  );
}

// Create GRN Modal Component
interface CreateGRNModalProps {
  purchaseOrders: PurchaseOrder[];
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (purchaseOrderId: string, receivedItems: { itemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string }[]) => void;
}

function CreateGRNModal({ purchaseOrders, isLoading, onClose, onSubmit }: CreateGRNModalProps) {
  const [selectedPOId, setSelectedPOId] = useState('');
  const [receivedItems, setReceivedItems] = useState<{ itemId: string; quantityReceived: number; batchNumber: string; expiryDate: string }[]>([]);
  const [notes, setNotes] = useState('');

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
    if (!selectedPOId) return;
    onSubmit(selectedPOId, receivedItems.filter(item => item.quantityReceived > 0).map(item => ({
      itemId: item.itemId,
      quantityReceived: item.quantityReceived,
      batchNumber: item.batchNumber || undefined,
      expiryDate: item.expiryDate || undefined,
    })));
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
            disabled={!selectedPOId || isLoading || receivedItems.every(item => item.quantityReceived === 0)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? (
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