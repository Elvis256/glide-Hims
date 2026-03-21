import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle,
  Award,
  Building2,
  Clock,
  DollarSign,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Truck,
  Package,
  Loader2,
  FileText,
  ShoppingCart,
  AlertCircle,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { useFacilityId } from '../../../lib/facility';
import { rfqService, type RFQ, type VendorQuotation, type VendorQuotationItem } from '../../../services/rfq';
import { procurementService } from '../../../services/procurement';
import { formatCurrency } from '../../../lib/currency';

// Per-item comparison: one row per RFQ item, columns are vendor quotes
interface ItemComparison {
  rfqItemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  vendorPrices: {
    quotationId: string;
    supplierId: string;
    supplierName: string;
    unitPrice: number;
    totalPrice: number;
    deliveryDays?: number;
    inStock: boolean;
    notes?: string;
  }[];
}

export default function PharmacyCompareQuotesPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [selectedRfqId, setSelectedRfqId] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'price' | 'delivery'>('price');
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [selectedQuotationForPO, setSelectedQuotationForPO] = useState<VendorQuotation | null>(null);
  const [poExpectedDelivery, setPoExpectedDelivery] = useState('');
  const [poPaymentTerms, setPoPaymentTerms] = useState('Net 30');
  const [poDeliveryAddress, setPoDeliveryAddress] = useState('');
  const [poNotes, setPoNotes] = useState('');

  // Fetch RFQs that have quotations (sent, responses_received, or closed)
  const { data: allRfqs = [], isLoading: rfqsLoading } = useQuery({
    queryKey: ['rfqs-for-compare', facilityId],
    queryFn: async () => {
      const all = await rfqService.list(facilityId);
      const arr = Array.isArray(all) ? all : [];
      return arr.filter((r: RFQ) => r.status !== 'draft' && r.status !== 'cancelled');
    },
    enabled: !!facilityId,
  });

  // Fetch selected RFQ detail (includes quotations)
  const { data: selectedRfq, isLoading: detailLoading } = useQuery({
    queryKey: ['rfq-detail', selectedRfqId],
    queryFn: () => rfqService.getById(selectedRfqId),
    enabled: !!selectedRfqId,
  });

  // Select winner mutation
  const selectWinnerMutation = useMutation({
    mutationFn: (quotationId: string) => rfqService.quotations.selectWinner(quotationId),
    onSuccess: () => {
      toast.success('Winner selected — approval workflow started');
      queryClient.invalidateQueries({ queryKey: ['rfq-detail', selectedRfqId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to select winner'),
  });

  // Create PO from quotation mutation
  const createPOMutation = useMutation({
    mutationFn: (data: { quotationId: string; expectedDelivery: string; paymentTerms: string; deliveryAddress: string; notes: string }) =>
      procurementService.purchaseOrders.createFromQuotation(data),
    onSuccess: () => {
      toast.success('Purchase Order created from quotation!');
      setShowCreatePO(false);
      setSelectedQuotationForPO(null);
      queryClient.invalidateQueries({ queryKey: ['rfq-detail', selectedRfqId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create PO'),
  });

  // Build per-item comparison matrix
  const comparisons = useMemo<ItemComparison[]>(() => {
    if (!selectedRfq?.items?.length || !selectedRfq?.quotations?.length) return [];
    return selectedRfq.items.map((rfqItem) => {
      const vendorPrices = selectedRfq.quotations
        .filter((q: VendorQuotation) => q.status !== 'rejected')
        .map((q: VendorQuotation) => {
          const qi = (q.items || []).find((i: VendorQuotationItem) => i.rfqItemId === rfqItem.id);
          if (!qi) return null;
          return {
            quotationId: q.id,
            supplierId: q.supplierId,
            supplierName: q.supplier?.name || 'Unknown',
            unitPrice: Number(qi.unitPrice) || 0,
            totalPrice: Number(qi.totalPrice) || 0,
            deliveryDays: q.deliveryDays,
            inStock: qi.inStock,
            notes: qi.notes,
          };
        })
        .filter(Boolean) as ItemComparison['vendorPrices'];

      // Sort vendor prices
      if (sortBy === 'price') vendorPrices.sort((a, b) => a.unitPrice - b.unitPrice);
      else vendorPrices.sort((a, b) => (a.deliveryDays || 999) - (b.deliveryDays || 999));

      return {
        rfqItemId: rfqItem.id,
        itemCode: rfqItem.itemCode,
        itemName: rfqItem.itemName,
        quantity: rfqItem.quantity,
        unit: rfqItem.unit || 'unit',
        vendorPrices,
      };
    });
  }, [selectedRfq, sortBy]);

  const quotations = selectedRfq?.quotations || [];
  const activeQuotations = quotations.filter((q: VendorQuotation) => q.status !== 'rejected');
  const winnerQuotation = quotations.find((q: VendorQuotation) => q.status === 'selected');

  // Stats
  const stats = useMemo(() => {
    const totalItems = comparisons.length;
    const totalQuotes = activeQuotations.length;
    const lowestTotal = activeQuotations.length > 0
      ? Math.min(...activeQuotations.map((q: VendorQuotation) => Number(q.totalAmount) || 0))
      : 0;
    const highestTotal = activeQuotations.length > 0
      ? Math.max(...activeQuotations.map((q: VendorQuotation) => Number(q.totalAmount) || 0))
      : 0;
    return { totalItems, totalQuotes, lowestTotal, highestTotal, savings: highestTotal - lowestTotal };
  }, [comparisons, activeQuotations]);

  if (!hasPermission('procurement.read')) {
    return <AccessDenied />;
  }

  const openCreatePO = (q: VendorQuotation) => {
    setSelectedQuotationForPO(q);
    setPoExpectedDelivery('');
    setPoPaymentTerms(q.paymentTerms || 'Net 30');
    setPoDeliveryAddress('');
    setPoNotes('');
    setShowCreatePO(true);
  };

  if (rfqsLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compare Quotations</h1>
          <p className="text-gray-600">Side-by-side comparison of vendor responses to RFQs</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedRfqId}
            onChange={(e) => { setSelectedRfqId(e.target.value); setExpandedItems({}); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— Select an RFQ —</option>
            {allRfqs.map((rfq: RFQ) => (
              <option key={rfq.id} value={rfq.id}>
                {rfq.rfqNumber} — {rfq.title} ({rfq.quotations?.length || 0} quotes)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      {selectedRfq && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-600">Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg"><Building2 className="w-5 h-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-gray-600">Quotations</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalQuotes}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-600">Lowest Quote</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.lowestTotal)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg"><TrendingDown className="w-5 h-5 text-orange-600" /></div>
              <div>
                <p className="text-sm text-gray-600">Potential Savings</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.savings)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!selectedRfqId ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium text-lg">Select an RFQ to compare quotations</p>
            <p className="text-gray-400 text-sm mt-2">
              Choose an RFQ from the dropdown above to view side-by-side vendor comparisons
            </p>
          </div>
        ) : detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : activeQuotations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium text-lg">No quotations received yet</p>
            <p className="text-gray-400 text-sm mt-2">
              Vendor quotations for {selectedRfq?.rfqNumber} will appear here once received
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Winner banner */}
            {winnerQuotation && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">
                      Winner: {winnerQuotation.supplier?.name || 'Supplier'} — {formatCurrency(winnerQuotation.totalAmount)}
                    </p>
                    <p className="text-sm text-green-600">
                      Quotation {winnerQuotation.quotationNumber} • {winnerQuotation.deliveryDays} days delivery
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => openCreatePO(winnerQuotation)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Create Purchase Order
                </button>
              </div>
            )}

            {/* Sort controls */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
              <span className="text-sm text-gray-600">Sort by:</span>
              {[
                { key: 'price' as const, label: 'Lowest Price', icon: DollarSign },
                { key: 'delivery' as const, label: 'Fastest Delivery', icon: Truck },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm ${
                    sortBy === key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            {/* Quotation Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeQuotations.map((q: VendorQuotation) => {
                const isWinner = q.status === 'selected';
                const isLowest = Number(q.totalAmount) === stats.lowestTotal;
                return (
                  <div
                    key={q.id}
                    className={`bg-white rounded-xl shadow-sm border-2 p-4 ${
                      isWinner ? 'border-green-500 bg-green-50' : isLowest ? 'border-blue-300' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-semibold text-gray-900">{q.supplier?.name || 'Supplier'}</span>
                      </div>
                      {isWinner && <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">Winner</span>}
                      {!isWinner && isLowest && <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">Lowest</span>}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">#{q.quotationNumber}</p>
                    <div className="text-2xl font-bold text-gray-900 mb-3">{formatCurrency(q.totalAmount)}</div>
                    <div className="space-y-1 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2"><Truck className="w-4 h-4" />{q.deliveryDays} days delivery</div>
                      {q.paymentTerms && <div className="flex items-center gap-2"><Clock className="w-4 h-4" />{q.paymentTerms}</div>}
                      <div className="flex items-center gap-2"><Clock className="w-4 h-4" />Valid until {new Date(q.validUntil).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-2">
                      {!isWinner && !winnerQuotation && (
                        <button
                          onClick={() => selectWinnerMutation.mutate(q.id)}
                          disabled={selectWinnerMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Award className="w-4 h-4" />Select as Winner
                        </button>
                      )}
                      {isWinner && (
                        <button
                          onClick={() => openCreatePO(q)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          <ShoppingCart className="w-4 h-4" />Create PO
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Per-item breakdown */}
            <h2 className="text-lg font-semibold text-gray-900 mt-6 mb-2">Item-by-Item Comparison</h2>
            {comparisons.map((item) => {
              const isExpanded = expandedItems[item.rfqItemId];
              return (
                <div key={item.rfqItemId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedItems((p) => ({ ...p, [item.rfqItemId]: !p[item.rfqItemId] }))}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.itemName}</h3>
                        <p className="text-sm text-gray-500">{item.itemCode} • Qty: {item.quantity} {item.unit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">{item.vendorPrices.length} vendor{item.vendorPrices.length !== 1 ? 's' : ''}</span>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Supplier</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">Unit Price</th>
                            <th className="text-right px-4 py-2 font-medium text-gray-600">Total</th>
                            <th className="text-center px-4 py-2 font-medium text-gray-600">Delivery</th>
                            <th className="text-center px-4 py-2 font-medium text-gray-600">In Stock</th>
                            <th className="text-left px-4 py-2 font-medium text-gray-600">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.vendorPrices.map((vp, idx) => {
                            const isBest = idx === 0;
                            return (
                              <tr key={vp.quotationId} className={isBest ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {vp.supplierName}
                                  {isBest && <span className="ml-2 px-1.5 py-0.5 bg-green-600 text-white text-xs rounded">Best</span>}
                                </td>
                                <td className="px-4 py-3 text-right font-mono">{formatCurrency(vp.unitPrice)}</td>
                                <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(vp.totalPrice)}</td>
                                <td className="px-4 py-3 text-center">{vp.deliveryDays ? `${vp.deliveryDays}d` : '—'}</td>
                                <td className="px-4 py-3 text-center">
                                  {vp.inStock
                                    ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                                    : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{vp.notes || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create PO Modal */}
      {showCreatePO && selectedQuotationForPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Create Purchase Order from Quotation</h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedQuotationForPO.supplier?.name} — {selectedQuotationForPO.quotationNumber}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-blue-800">Total: {formatCurrency(selectedQuotationForPO.totalAmount)}</p>
                <p className="text-blue-600">{selectedQuotationForPO.items?.length || 0} items • {selectedQuotationForPO.deliveryDays} days delivery</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
                <input type="date" value={poExpectedDelivery} onChange={(e) => setPoExpectedDelivery(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select value={poPaymentTerms} onChange={(e) => setPoPaymentTerms(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option>Net 30</option><option>Net 60</option><option>Net 90</option><option>COD</option><option>Advance Payment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                <input type="text" value={poDeliveryAddress} onChange={(e) => setPoDeliveryAddress(e.target.value)} placeholder="e.g., Main Pharmacy Store" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={poNotes} onChange={(e) => setPoNotes(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowCreatePO(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => createPOMutation.mutate({
                  quotationId: selectedQuotationForPO.id,
                  expectedDelivery: poExpectedDelivery,
                  paymentTerms: poPaymentTerms,
                  deliveryAddress: poDeliveryAddress,
                  notes: poNotes,
                })}
                disabled={createPOMutation.isPending || !poExpectedDelivery}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {createPOMutation.isPending ? 'Creating...' : 'Create Purchase Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
