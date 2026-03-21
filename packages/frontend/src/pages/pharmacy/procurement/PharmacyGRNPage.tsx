import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  FileText,
  CheckCircle,
  Package,
  Building2,
  Calendar,
  Filter,
  Eye,
  ChevronRight,
  AlertTriangle,
  Thermometer,
  ClipboardCheck,
  Truck,
  XCircle,
  Clock,
  Hash,
  Loader2,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { procurementService, type GoodsReceipt, type GRNStatus as APIGRNStatus, type PurchaseOrder, type CreateGoodsReceiptDto } from '../../../services/procurement';
import { supplierService } from '../../../services/suppliers';
import { useFacilityId } from '../../../lib/facility';
import { useAuthStore } from '../../../store/auth';
import { asList } from '../../../utils/unwrapResponse';

type DisplayGRNStatus = 'Pending Inspection' | 'Inspected' | 'Approved' | 'Posted' | 'Partially Accepted' | 'Rejected';

interface DisplayGRNItem {
  id: string;
  medication: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  batchNumber: string;
  expiryDate: string;
  unitPrice: number;
  qualityStatus: 'Pending' | 'Passed' | 'Failed';
  tempVerified?: boolean;
  coldChain?: boolean;
  notes: string;
}

interface DisplayGRN {
  id: string;
  grnNumber: string;
  poNumber: string;
  supplier: string;
  receivedDate: string;
  receivedBy: string;
  status: DisplayGRNStatus;
  rawStatus: APIGRNStatus;
  items: DisplayGRNItem[];
  deliveryNote: string;
  vehicleTemp?: number;
  inspectedBy?: string;
  inspectionDate?: string;
  totalValue: number;
}

// Map API status to display status
const mapGRNStatus = (status: APIGRNStatus): DisplayGRNStatus => {
  switch (status) {
    case 'draft': return 'Pending Inspection';
    case 'pending_inspection': return 'Pending Inspection';
    case 'inspected': return 'Inspected';
    case 'approved': return 'Approved';
    case 'posted': return 'Posted';
    case 'cancelled': return 'Rejected';
    default: return 'Pending Inspection';
  }
};

// Transform API data to display format
const transformGoodsReceipt = (grn: GoodsReceipt): DisplayGRN => ({
  id: grn.id,
  grnNumber: grn.grnNumber,
  poNumber: grn.purchaseOrder?.orderNumber || grn.purchaseOrderId || '',
  supplier: grn.supplier?.name || 'Unknown Supplier',
  receivedDate: new Date(grn.receivedAt).toLocaleDateString(),
  receivedBy: grn.receivedBy?.fullName || '',
  status: mapGRNStatus(grn.status),
  rawStatus: grn.status,
  items: grn.items.map(item => ({
    id: item.id,
    medication: item.itemName,
    orderedQty: item.quantityExpected,
    receivedQty: item.quantityReceived,
    acceptedQty: item.quantityAccepted || 0,
    batchNumber: item.batchNumber || '',
    expiryDate: item.expiryDate || '',
    unitPrice: item.unitCost,
    qualityStatus: item.quantityRejected && item.quantityRejected > 0 ? 'Failed' : item.quantityAccepted ? 'Passed' : 'Pending',
    tempVerified: false,
    coldChain: false,
    notes: item.notes || '',
  })),
  deliveryNote: grn.deliveryNoteNumber || '',
  vehicleTemp: undefined,
  inspectedBy: grn.inspectedById,
  inspectionDate: grn.inspectedAt,
  totalValue: grn.totalValue || grn.items.reduce((sum, item) => sum + item.lineTotal, 0),
});

export default function PharmacyGRNPage() {
  const { hasPermission } = usePermissions();

  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const user = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DisplayGRNStatus | 'All'>('All');
  const [showNewGRN, setShowNewGRN] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<DisplayGRN | null>(null);

  // Modal form state
  const [selectedPOId, setSelectedPOId] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [receivedItems, setReceivedItems] = useState<{
    itemId: string;
    itemCode: string;
    itemName: string;
    itemUnit?: string;
    quantityExpected: number;
    quantityReceived: number;
    unitCost: number;
    sellingPrice: number;
    markupPercentage: number;
    retailPrice: number;
    wholesalePrice: number;
    batchNumber: string;
    expiryDate: string;
    qualityStatus: string;
    purchaseOrderItemId?: string;
  }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-fill "Received By" with logged-in user's name when modal opens
  useEffect(() => {
    if (showNewGRN && user?.fullName && !receivedBy) {
      setReceivedBy(user.fullName);
    }
  }, [showNewGRN]);

  // Fetch goods receipts from API
  const { data: goodsReceipts = [], isLoading, error } = useQuery({
    queryKey: ['goodsReceipts'],
    queryFn: () => procurementService.goodsReceipts.list(),
  });

  // Fetch sent POs for the dropdown
  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchaseOrders', 'sent'],
    queryFn: () => procurementService.purchaseOrders.list({ status: 'sent' }),
  });

  // Fetch suppliers
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', facilityId],
    queryFn: () => supplierService.list(facilityId),
  });
  const suppliers = asList(suppliersData);

  // When PO is selected, fetch its details and populate items
  const handlePOSelect = async (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) {
      setReceivedItems([]);
      return;
    }
    try {
      const po = await procurementService.purchaseOrders.getById(poId);
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
      const supplierPrefix = (po.supplier?.name || 'SUP').substring(0, 3).toUpperCase();
      setReceivedItems(po.items.map((item, idx) => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemUnit: item.itemUnit,
        quantityExpected: item.quantityOrdered,
        quantityReceived: item.quantityOrdered,
        unitCost: item.unitPrice,
        sellingPrice: 0,
        markupPercentage: 0,
        retailPrice: 0,
        wholesalePrice: 0,
        batchNumber: `${supplierPrefix}-${dateStr}${po.items.length > 1 ? `-${idx + 1}` : ''}`,
        expiryDate: '',
        qualityStatus: 'pending',
        purchaseOrderItemId: item.id,
      })));
    } catch {
      toast.error('Failed to load PO details');
    }
  };

  const updateReceivedItem = (index: number, field: string, value: string | number) => {
    setReceivedItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const resetModal = () => {
    setSelectedPOId('');
    setDeliveryNoteNumber('');
    setReceivedBy('');
    setNotes('');
    setReceivedItems([]);
    setShowNewGRN(false);
  };

  // Create GRN mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateGoodsReceiptDto) => procurementService.goodsReceipts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] });
      toast.success('GRN saved for inspection');
      resetModal();
    },
    onError: () => toast.error('Failed to create GRN'),
  });

  // Inspect GRN mutation
  const inspectMutation = useMutation({
    mutationFn: (grn: GoodsReceipt) => procurementService.goodsReceipts.inspect(grn.id, {
      inspectedItems: grn.items.map(item => ({
        itemId: item.itemId,
        quantityAccepted: item.quantityReceived,
        quantityRejected: 0,
      })),
      inspectionNotes: 'Inspected and accepted at receiving',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] });
      toast.success('GRN inspected successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to inspect GRN'),
  });

  // Approve GRN mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.goodsReceipts.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] });
      toast.success('GRN approved successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to approve GRN'),
  });

  // Post GRN mutation
  const postMutation = useMutation({
    mutationFn: (id: string) => procurementService.goodsReceipts.post(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] });
      toast.success('GRN posted to stock successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to post GRN to stock'),
  });

  const buildGRNPayload = (): CreateGoodsReceiptDto => {
    const po = purchaseOrders.find(p => p.id === selectedPOId);
    return {
      facilityId,
      supplierId: po?.supplierId || '',
      purchaseOrderId: selectedPOId || undefined,
      deliveryNoteNumber: deliveryNoteNumber || undefined,
      notes: notes || undefined,
      items: receivedItems.map(item => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemUnit: item.itemUnit,
        quantityExpected: item.quantityExpected,
        quantityReceived: item.quantityReceived,
        unitCost: item.unitCost,
        sellingPrice: item.retailPrice || item.sellingPrice || undefined,
        markupPercentage: item.markupPercentage || undefined,
        retailPrice: item.retailPrice || undefined,
        wholesalePrice: item.wholesalePrice || undefined,
        batchNumber: item.batchNumber || undefined,
        expiryDate: item.expiryDate || undefined,
        purchaseOrderItemId: item.purchaseOrderItemId,
      })),
    };
  };

  const handleSaveForInspection = () => {
    if (receivedItems.length === 0) {
      toast.error('Please select a PO and add items');
      return;
    }
    createMutation.mutate(buildGRNPayload());
  };

  const handleAcceptAndAddToStock = async () => {
    if (receivedItems.length === 0) {
      toast.error('Please select a PO and add items');
      return;
    }
    setIsSaving(true);
    try {
      const grn = await procurementService.goodsReceipts.create(buildGRNPayload());
      // Inspect: mark accepted/rejected based on quality status
      await procurementService.goodsReceipts.inspect(grn.id, {
        inspectedItems: receivedItems.map(item => ({
          itemId: item.itemId,
          quantityAccepted: item.qualityStatus === 'failed' ? 0 : item.quantityReceived,
          quantityRejected: item.qualityStatus === 'failed' ? item.quantityReceived : 0,
          rejectionReason: item.qualityStatus === 'failed' ? 'Failed quality check at receiving' : undefined,
        })),
      });
      await procurementService.goodsReceipts.approve(grn.id);
      await procurementService.goodsReceipts.post(grn.id);
      queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] });
      toast.success('GRN created and posted to stock');
      resetModal();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create and post GRN');
    } finally {
      setIsSaving(false);
    }
  };

  // Transform data
  const grns = useMemo(() => 
    goodsReceipts.map(transformGoodsReceipt),
    [goodsReceipts]
  );

  const filteredGRNs = useMemo(() => {
    return grns.filter((grn) => {
      const matchesSearch =
        grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || grn.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [grns, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: grns.length,
    pendingInspection: grns.filter(g => g.status === 'Pending Inspection').length,
    inspected: grns.filter(g => g.status === 'Inspected').length,
    approved: grns.filter(g => g.status === 'Approved' || g.status === 'Posted').length,
    issues: grns.filter(g => g.status === 'Partially Accepted' || g.status === 'Rejected').length,
  }), [grns]);

  if (!hasPermission('inventory.create')) {
    return <AccessDenied />;
  }

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
        <p className="text-red-600">Failed to load goods receipts</p>
      </div>
    );
  }

  const getStatusColor = (status: DisplayGRNStatus) => {
    switch (status) {
      case 'Pending Inspection': return 'bg-yellow-100 text-yellow-700';
      case 'Inspected': return 'bg-blue-100 text-blue-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Posted': return 'bg-emerald-100 text-emerald-700';
      case 'Partially Accepted': return 'bg-orange-100 text-orange-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: DisplayGRNStatus) => {
    switch (status) {
      case 'Pending Inspection': return <Clock className="w-4 h-4" />;
      case 'Inspected': return <ClipboardCheck className="w-4 h-4" />;
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Posted': return <Package className="w-4 h-4" />;
      case 'Partially Accepted': return <AlertTriangle className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
    }
  };

  const getQualityColor = (status: string) => {
    switch (status) {
      case 'Passed': return 'text-green-600 bg-green-100';
      case 'Failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Received Notes</h1>
          <p className="text-gray-600">Receive, inspect, and accept medication deliveries</p>
        </div>
        <button
          onClick={() => setShowNewGRN(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Receive Delivery
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total GRNs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Inspection</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingInspection}</p>
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
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">With Issues</p>
              <p className="text-2xl font-bold text-orange-600">{stats.issues}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by GRN, PO number, or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DisplayGRNStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Pending Inspection">Pending Inspection</option>
              <option value="Inspected">Inspected</option>
              <option value="Approved">Approved</option>
              <option value="Posted">Posted</option>
              <option value="Partially Accepted">Partially Accepted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* GRN Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">GRN Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">PO Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Received</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cold Chain</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredGRNs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No goods received notes found</p>
                    <p className="text-gray-400 text-sm mt-1">Receive a delivery to create a GRN</p>
                  </td>
                </tr>
              ) : (
                filteredGRNs.map((grn) => {
                  const hasColdChain = grn.items.some((i) => i.coldChain);
                  const totalReceived = grn.items.reduce((sum, i) => sum + i.receivedQty, 0);
                  const totalAccepted = grn.items.reduce((sum, i) => sum + i.acceptedQty, 0);

                  return (
                    <tr
                      key={grn.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        selectedGRN?.id === grn.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedGRN(grn)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{grn.grnNumber}</p>
                          <p className="text-xs text-gray-500">DN: {grn.deliveryNote}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-blue-600 font-medium">{grn.poNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{grn.supplier}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{grn.receivedDate}</span>
                          </div>
                          <p className="text-xs text-gray-500">{grn.receivedBy}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                            {grn.items.length} items
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            {totalAccepted}/{totalReceived} accepted
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {hasColdChain ? (
                          <div className="flex items-center gap-2">
                            <Thermometer className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-blue-600">
                              {grn.vehicleTemp ? `${grn.vehicleTemp}°C` : 'Required'}
                            </span>
                            {grn.items.some((i) => i.tempVerified) && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(grn.status)}`}>
                          {getStatusIcon(grn.status)}
                          {grn.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                            onClick={(e) => { e.stopPropagation(); setSelectedGRN(grn); }}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {grn.status === 'Pending Inspection' && (
                            <button
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                const original = goodsReceipts.find(g => g.id === grn.id);
                                if (original) inspectMutation.mutate(original);
                              }}
                            >
                              Inspect
                            </button>
                          )}
                          <button
                            className="p-1.5 hover:bg-gray-100 rounded"
                            onClick={(e) => { e.stopPropagation(); setSelectedGRN(grn); }}
                          >
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRN Detail Slide-Out Panel */}
      {selectedGRN && (
        <div className="fixed inset-0 bg-black/30 flex justify-end z-40" onClick={() => setSelectedGRN(null)}>
          <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl z-40 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">{selectedGRN.grnNumber}</h2>
              <button onClick={() => setSelectedGRN(null)} className="p-2 hover:bg-gray-100 rounded text-xl">×</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedGRN.status)}`}>
                  {getStatusIcon(selectedGRN.status)} {selectedGRN.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">GRN Number</span><p className="font-medium">{selectedGRN.grnNumber}</p></div>
                <div><span className="text-gray-500">PO Reference</span><p className="font-medium text-blue-600">{selectedGRN.poNumber || 'N/A'}</p></div>
                <div><span className="text-gray-500">Supplier</span><p className="font-medium">{selectedGRN.supplier}</p></div>
                <div><span className="text-gray-500">Received Date</span><p className="font-medium">{selectedGRN.receivedDate}</p></div>
                <div><span className="text-gray-500">Received By</span><p className="font-medium">{selectedGRN.receivedBy || 'N/A'}</p></div>
                <div><span className="text-gray-500">Delivery Note</span><p className="font-medium">{selectedGRN.deliveryNote || 'N/A'}</p></div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Items ({selectedGRN.items.length})</h3>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-xs">
                        <th className="px-3 py-2 text-left">Medication</th>
                        <th className="px-3 py-2 text-right">Ordered</th>
                        <th className="px-3 py-2 text-right">Received</th>
                        <th className="px-3 py-2 text-right">Accepted</th>
                        <th className="px-3 py-2 text-left">Batch</th>
                        <th className="px-3 py-2 text-left">Expiry</th>
                        <th className="px-3 py-2 text-right">Unit Cost</th>
                        <th className="px-3 py-2 text-center">Quality</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGRN.items.map((item) => (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium">{item.medication}</td>
                          <td className="px-3 py-2 text-right">{item.orderedQty}</td>
                          <td className="px-3 py-2 text-right">{item.receivedQty}</td>
                          <td className="px-3 py-2 text-right">{item.acceptedQty}</td>
                          <td className="px-3 py-2 text-xs">{item.batchNumber || '—'}</td>
                          <td className="px-3 py-2 text-xs">{item.expiryDate || '—'}</td>
                          <td className="px-3 py-2 text-right">{item.unitPrice.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getQualityColor(item.qualityStatus)}`}>
                              {item.qualityStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td colSpan={6} className="px-3 py-2 text-right">Total Value</td>
                        <td colSpan={2} className="px-3 py-2 text-right">UGX {selectedGRN.totalValue.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t">
                {(selectedGRN.rawStatus === 'draft' || selectedGRN.rawStatus === 'pending_inspection') && (
                  <button
                    onClick={() => {
                      const original = goodsReceipts.find(g => g.id === selectedGRN.id);
                      if (original) inspectMutation.mutate(original);
                    }}
                    disabled={inspectMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {inspectMutation.isPending ? 'Inspecting...' : 'Inspect & Approve'}
                  </button>
                )}
                {selectedGRN.rawStatus === 'inspected' && (
                  <button
                    onClick={() => approveMutation.mutate(selectedGRN.id)}
                    disabled={approveMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </button>
                )}
                {(selectedGRN.rawStatus === 'inspected' || selectedGRN.rawStatus === 'approved') && (
                  <button
                    onClick={() => postMutation.mutate(selectedGRN.id)}
                    disabled={postMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {postMutation.isPending ? 'Posting...' : 'Post to Stock'}
                  </button>
                )}
                {selectedGRN.rawStatus === 'posted' && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 rounded font-medium">
                    <CheckCircle className="w-4 h-4" /> Posted to Stock
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New GRN Modal */}
      {showNewGRN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[95vw] max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Receive Delivery</h2>
              <button
                onClick={() => resetModal()}
                className="p-2 hover:bg-gray-100 rounded-lg text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order</label>
                    <select
                      value={selectedPOId}
                      onChange={(e) => handlePOSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select PO...</option>
                      {purchaseOrders.map(po => (
                        <option key={po.id} value={po.id}>
                          {po.orderNumber} - {po.supplier?.name || 'Unknown'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Note Number</label>
                    <input
                      type="text"
                      placeholder="e.g., DN-2024-0125"
                      value={deliveryNoteNumber}
                      onChange={(e) => setDeliveryNoteNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                    <input
                      type="text"
                      readOnly
                      value={receivedBy}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Cold Chain Verification</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Vehicle Temperature</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="°C"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Container Condition</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="">Select...</option>
                        <option value="intact">Intact - No damage</option>
                        <option value="minor">Minor damage</option>
                        <option value="compromised">Compromised</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Temperature Log</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm text-gray-700">Temperature log verified</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Items Received</label>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <table className="w-full min-w-[1400px]">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-40">Medication</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-20">Ordered</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-24">Received</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-28">Batch No.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-32">Expiry Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-24">Unit Cost</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-20">Markup %</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-28">Retail Price</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-28">Wholesale</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-24">Profit</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 w-24">Quality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {receivedItems.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="px-3 py-6 text-center text-sm text-gray-400">
                              Select a Purchase Order to populate items
                            </td>
                          </tr>
                        ) : (
                          receivedItems.map((item, index) => {
                            const retailProfit = item.retailPrice > 0 && item.unitCost > 0
                              ? ((item.retailPrice - item.unitCost) * item.quantityReceived)
                              : 0;
                            return (
                            <tr key={item.itemId + index}>
                              <td className="px-3 py-2 text-sm">{item.itemName}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{item.quantityExpected}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={item.quantityReceived}
                                  onChange={(e) => updateReceivedItem(index, 'quantityReceived', parseInt(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  placeholder="Batch #"
                                  value={item.batchNumber}
                                  onChange={(e) => updateReceivedItem(index, 'batchNumber', e.target.value)}
                                  className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="date"
                                  value={item.expiryDate}
                                  onChange={(e) => updateReceivedItem(index, 'expiryDate', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.unitCost || ''}
                                  onChange={(e) => {
                                    const cost = parseFloat(e.target.value) || 0;
                                    const updates: Record<string, number> = { unitCost: cost };
                                    if (item.markupPercentage > 0) {
                                      updates.retailPrice = +(cost * (1 + item.markupPercentage / 100)).toFixed(0);
                                      updates.wholesalePrice = +(cost * (1 + Math.max(item.markupPercentage - 10, 5) / 100)).toFixed(0);
                                      updates.sellingPrice = updates.retailPrice;
                                    }
                                    setReceivedItems(prev => prev.map((it, i) => i === index ? { ...it, ...updates } : it));
                                  }}
                                  placeholder="0.00"
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.markupPercentage || ''}
                                  onChange={(e) => {
                                    const markup = parseFloat(e.target.value) || 0;
                                    const updates: Record<string, number> = { markupPercentage: markup };
                                    if (item.unitCost > 0) {
                                      updates.retailPrice = +(item.unitCost * (1 + markup / 100)).toFixed(0);
                                      updates.wholesalePrice = +(item.unitCost * (1 + Math.max(markup - 10, 5) / 100)).toFixed(0);
                                      updates.sellingPrice = updates.retailPrice;
                                    }
                                    setReceivedItems(prev => prev.map((it, i) => i === index ? { ...it, ...updates } : it));
                                  }}
                                  placeholder="%"
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.retailPrice || ''}
                                  onChange={(e) => {
                                    const retail = parseFloat(e.target.value) || 0;
                                    const updates: Record<string, number> = { retailPrice: retail, sellingPrice: retail };
                                    if (item.unitCost > 0) {
                                      const newMarkup = +(((retail - item.unitCost) / item.unitCost) * 100).toFixed(1);
                                      updates.markupPercentage = newMarkup;
                                      updates.wholesalePrice = +(item.unitCost * (1 + Math.max(newMarkup - 10, 5) / 100)).toFixed(0);
                                    }
                                    setReceivedItems(prev => prev.map((it, i) => i === index ? { ...it, ...updates } : it));
                                  }}
                                  placeholder="0"
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={item.wholesalePrice || ''}
                                  onChange={(e) => {
                                    updateReceivedItem(index, 'wholesalePrice', parseFloat(e.target.value) || 0);
                                  }}
                                  placeholder="0"
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2 text-sm">
                                {retailProfit > 0 ? (
                                  <span className="text-green-600 font-medium">
                                    {retailProfit.toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={item.qualityStatus}
                                  onChange={(e) => updateReceivedItem(index, 'qualityStatus', e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="passed">Passed</option>
                                  <option value="failed">Failed</option>
                                </select>
                              </td>
                            </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Profit Preview Summary */}
                {receivedItems.length > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Profit Preview</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 block">Total Cost</span>
                        <span className="font-semibold text-gray-800">
                          UGX {receivedItems.reduce((s, i) => s + (i.unitCost * i.quantityReceived), 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Retail Revenue</span>
                        <span className="font-semibold text-blue-700">
                          UGX {receivedItems.reduce((s, i) => s + ((i.retailPrice || 0) * i.quantityReceived), 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Wholesale Revenue</span>
                        <span className="font-semibold text-indigo-700">
                          UGX {receivedItems.reduce((s, i) => s + ((i.wholesalePrice || 0) * i.quantityReceived), 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Expected Retail Profit</span>
                        <span className="font-semibold text-green-700">
                          UGX {receivedItems.reduce((s, i) => s + (((i.retailPrice || 0) - i.unitCost) * i.quantityReceived), 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Avg Margin</span>
                        <span className="font-semibold text-green-700">
                          {(() => {
                            const totalCost = receivedItems.reduce((s, i) => s + (i.unitCost * i.quantityReceived), 0);
                            const totalRetail = receivedItems.reduce((s, i) => s + ((i.retailPrice || 0) * i.quantityReceived), 0);
                            return totalCost > 0 ? (((totalRetail - totalCost) / totalCost) * 100).toFixed(1) : '0.0';
                          })()}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Discrepancies</label>
                  <textarea
                    placeholder="Document any issues, damages, or discrepancies..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => resetModal()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveForInspection}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving...' : 'Save for Inspection'}
              </button>
              <button
                onClick={handleAcceptAndAddToStock}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {isSaving ? 'Processing...' : 'Accept & Add to Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
