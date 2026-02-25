import React, { useState, useMemo } from 'react';
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

type DisplayGRNStatus = 'Pending Inspection' | 'Inspecting' | 'Approved' | 'Partially Accepted' | 'Rejected';

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
  items: DisplayGRNItem[];
  deliveryNote: string;
  vehicleTemp?: number;
  inspectedBy?: string;
  inspectionDate?: string;
}

// Map API status to display status
const mapGRNStatus = (status: APIGRNStatus): DisplayGRNStatus => {
  switch (status) {
    case 'pending_inspection': return 'Pending Inspection';
    case 'draft': return 'Pending Inspection';
    case 'inspected': return 'Inspecting';
    case 'approved': return 'Approved';
    case 'posted': return 'Approved';
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
  receivedDate: new Date(grn.receivedDate).toLocaleDateString(),
  receivedBy: '',
  status: mapGRNStatus(grn.status),
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
});

export default function PharmacyGRNPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.procurement')) {
    return <AccessDenied />;
  }

  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
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
    batchNumber: string;
    expiryDate: string;
    qualityStatus: string;
    purchaseOrderItemId?: string;
  }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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
  const suppliers = suppliersData?.data ?? [];

  // When PO is selected, fetch its details and populate items
  const handlePOSelect = async (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) {
      setReceivedItems([]);
      return;
    }
    try {
      const po = await procurementService.purchaseOrders.getById(poId);
      setReceivedItems(po.items.map(item => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemUnit: item.itemUnit,
        quantityExpected: item.quantityOrdered,
        quantityReceived: item.quantityOrdered,
        unitCost: item.unitPrice,
        sellingPrice: 0,
        markupPercentage: 0,
        batchNumber: '',
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
    mutationFn: (id: string) => procurementService.goodsReceipts.inspect(id, {
      inspectedItems: [],
      inspectionNotes: 'Inspection started',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] });
      toast.success('GRN inspection started');
    },
    onError: () => toast.error('Failed to start inspection'),
  });

  // Approve GRN mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.goodsReceipts.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] }),
  });

  // Post GRN mutation
  const postMutation = useMutation({
    mutationFn: (id: string) => procurementService.goodsReceipts.post(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] }),
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
        sellingPrice: item.sellingPrice || undefined,
        markupPercentage: item.markupPercentage || undefined,
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
      await procurementService.goodsReceipts.approve(grn.id);
      await procurementService.goodsReceipts.post(grn.id);
      queryClient.invalidateQueries({ queryKey: ['goodsReceipts'] });
      toast.success('GRN created and posted to stock');
      resetModal();
    } catch {
      toast.error('Failed to create and post GRN');
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
    pendingInspection: grns.filter(g => g.status === 'Pending Inspection' || g.status === 'Inspecting').length,
    approved: grns.filter(g => g.status === 'Approved').length,
    issues: grns.filter(g => g.status === 'Partially Accepted' || g.status === 'Rejected').length,
  }), [grns]);

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
      case 'Inspecting': return 'bg-blue-100 text-blue-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Partially Accepted': return 'bg-orange-100 text-orange-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: DisplayGRNStatus) => {
    switch (status) {
      case 'Pending Inspection': return <Clock className="w-4 h-4" />;
      case 'Inspecting': return <ClipboardCheck className="w-4 h-4" />;
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
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
              <option value="Inspecting">Inspecting</option>
              <option value="Approved">Approved</option>
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
                                if (original) inspectMutation.mutate(original.id);
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

      {/* New GRN Modal */}
      {showNewGRN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
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
                      placeholder="Name of receiver"
                      value={receivedBy}
                      onChange={(e) => setReceivedBy(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                          type="number"
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
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Medication</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Ordered</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Received</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Batch No.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Expiry Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Unit Cost</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Markup %</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Sell Price</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Quality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {receivedItems.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-400">
                              Select a Purchase Order to populate items
                            </td>
                          </tr>
                        ) : (
                          receivedItems.map((item, index) => (
                            <tr key={item.itemId + index}>
                              <td className="px-3 py-2 text-sm">{item.itemName}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{item.quantityExpected}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
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
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.unitCost || ''}
                                  onChange={(e) => {
                                    const cost = parseFloat(e.target.value) || 0;
                                    updateReceivedItem(index, 'unitCost', cost);
                                    if (item.markupPercentage > 0) updateReceivedItem(index, 'sellingPrice', +(cost * (1 + item.markupPercentage / 100)).toFixed(2));
                                  }}
                                  placeholder="0.00"
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.1"
                                  value={item.markupPercentage || ''}
                                  onChange={(e) => {
                                    const markup = parseFloat(e.target.value) || 0;
                                    updateReceivedItem(index, 'markupPercentage', markup);
                                    if (item.unitCost > 0) updateReceivedItem(index, 'sellingPrice', +(item.unitCost * (1 + markup / 100)).toFixed(2));
                                  }}
                                  placeholder="%"
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.sellingPrice || ''}
                                  onChange={(e) => {
                                    const sell = parseFloat(e.target.value) || 0;
                                    updateReceivedItem(index, 'sellingPrice', sell);
                                    if (item.unitCost > 0) updateReceivedItem(index, 'markupPercentage', +(((sell - item.unitCost) / item.unitCost) * 100).toFixed(2));
                                  }}
                                  placeholder="0.00"
                                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
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
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

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
