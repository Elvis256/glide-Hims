import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Scale,
  Download,
  CheckCircle,
  ArrowRight,
  Trophy,
  TrendingDown,
  TrendingUp,
  Clock,
  DollarSign,
  Truck,
  CreditCard,
  Award,
  FileText,
  Printer,
  Star,
  AlertCircle,
  Loader2,
  Building2,
  Filter,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import { rfqService, type RFQ, type VendorQuotation, type VendorQuotationItem } from '../../services/rfq';
import { formatCurrency } from '../../lib/currency';

export default function StoresCompareQuotesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const rfqId = searchParams.get('rfqId') || '';

  const [selectedQuotation, setSelectedQuotation] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [sortBy, setSortBy] = useState<'price' | 'delivery' | 'rating'>('price');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // Fetch RFQ details
  const { data: rfq, isLoading: rfqLoading, error: rfqError } = useQuery({
    queryKey: ['rfq', rfqId],
    queryFn: () => rfqService.getById(rfqId),
    enabled: !!rfqId,
  });

  // Fetch quotations for RFQ
  const { data: quotations = [], isLoading: quotationsLoading } = useQuery({
    queryKey: ['rfq-quotations', rfqId],
    queryFn: () => rfqService.quotations.list(rfqId),
    enabled: !!rfqId,
  });

  // Select winner mutation
  const selectWinnerMutation = useMutation({
    mutationFn: (quotationId: string) => rfqService.quotations.selectWinner(quotationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] });
      queryClient.invalidateQueries({ queryKey: ['rfq-quotations', rfqId] });
      setShowConfirmModal(false);
      setSelectedQuotation(null);
    },
  });

  const isLoading = rfqLoading || quotationsLoading;

  // Calculate best prices per item
  const bestPrices = useMemo(() => {
    const prices: Record<string, { quotationId: string; supplierId: string; price: number }> = {};
    if (!rfq?.items) return prices;

    rfq.items.forEach((item) => {
      let bestPrice = Infinity;
      let bestQuotationId = '';
      let bestSupplierId = '';
      quotations.forEach((quote) => {
        const quoteItem = quote.items?.find((qi) => qi.rfqItemId === item.id);
        if (quoteItem && quoteItem.unitPrice < bestPrice) {
          bestPrice = quoteItem.unitPrice;
          bestQuotationId = quote.id;
          bestSupplierId = quote.supplierId;
        }
      });
      if (bestPrice < Infinity) {
        prices[item.id] = { quotationId: bestQuotationId, supplierId: bestSupplierId, price: bestPrice };
      }
    });
    return prices;
  }, [rfq, quotations]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (quotations.length === 0) {
      return { lowestTotal: 0, highestTotal: 0, fastestDelivery: 0, avgRating: 0 };
    }
    const totals = quotations.map((q) => q.totalAmount);
    const deliveries = quotations.map((q) => q.deliveryDays);
    return {
      lowestTotal: Math.min(...totals),
      highestTotal: Math.max(...totals),
      fastestDelivery: Math.min(...deliveries),
      avgRating: 0, // Would be calculated from supplier ratings if available
    };
  }, [quotations]);

  // Sort quotations
  const sortedQuotations = useMemo(() => {
    return [...quotations].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.totalAmount - b.totalAmount;
        case 'delivery':
          return a.deliveryDays - b.deliveryDays;
        case 'rating':
          return 0; // Would sort by rating if available
        default:
          return 0;
      }
    });
  }, [quotations, sortBy]);

  const getScoreColor = (quote: VendorQuotation) => {
    if (quote.totalAmount === stats.lowestTotal) return 'text-green-600';
    if (quote.totalAmount <= stats.lowestTotal * 1.05) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleSelectWinner = () => {
    if (selectedQuotation) {
      selectWinnerMutation.mutate(selectedQuotation);
    }
  };

  const selectedQuote = quotations.find((q) => q.id === selectedQuotation);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (rfqError) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <p className="text-red-600">Failed to load RFQ details</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Scale className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Compare Quotations</h1>
              <p className="text-sm text-gray-500">
                {rfq ? `${rfq.rfqNumber} - ${rfq.title}` : 'Select an RFQ to compare quotations'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Printer className="w-4 h-4" />
              Print Report
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={!selectedQuotation}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedQuotation
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Select Winner & Create PO
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-6 py-4 flex-shrink-0">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <FileText className="w-4 h-4" />
              <span className="text-sm">Quotations Received</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{quotations.length}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm">Lowest Quote</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.lowestTotal)}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Highest Quote</span>
            </div>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(stats.highestTotal)}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Truck className="w-4 h-4" />
              <span className="text-sm">Fastest Delivery</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.fastestDelivery} days</p>
          </div>
        </div>
      </div>

      {/* Sort Options */}
      <div className="px-6 mb-4 flex-shrink-0">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Sort by:</span>
            <div className="flex gap-2">
              {[
                { key: 'price', label: 'Lowest Price', icon: DollarSign },
                { key: 'delivery', label: 'Fastest Delivery', icon: Truck },
                { key: 'rating', label: 'Best Rating', icon: Star },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key as 'price' | 'delivery' | 'rating')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    sortBy === key
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {quotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 bg-white rounded-lg border p-12">
            <Scale className="w-16 h-16 mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Quotations to Compare</h3>
            <p className="text-sm text-gray-500">Select an RFQ with received quotations to compare</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-700 border-b w-48">
                      Item / Criteria
                    </th>
                    {sortedQuotations.map((quote) => (
                      <th
                        key={quote.id}
                        className={`text-center px-4 py-3 font-medium border-b cursor-pointer transition-colors ${
                          selectedQuotation === quote.id
                            ? 'bg-green-50 border-green-200'
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={() => setSelectedQuotation(quote.id)}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-2">
                            {quote.totalAmount === stats.lowestTotal && (
                              <Trophy className="w-4 h-4 text-amber-500" />
                            )}
                            <span className="text-gray-900">{quote.supplier?.name || 'Vendor'}</span>
                          </div>
                          <span className="text-xs text-gray-500">{quote.quotationNumber}</span>
                          {selectedQuotation === quote.id && (
                            <span className="text-xs text-green-600 font-normal flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Selected
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Vendor Rating Row */}
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-gray-600" />
                        <span>Vendor Rating</span>
                      </div>
                    </td>
                    {sortedQuotations.map((quote) => (
                      <td
                        key={quote.id}
                        className={`px-4 py-3 text-center ${
                          selectedQuotation === quote.id ? 'bg-green-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Item Prices */}
                  {rfq?.items?.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-xs text-gray-500">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                      </td>
                      {sortedQuotations.map((quote) => {
                        const quoteItem = quote.items?.find((qi) => qi.rfqItemId === item.id);
                        const isBest = bestPrices[item.id]?.quotationId === quote.id;
                        return (
                          <td
                            key={quote.id}
                            className={`px-4 py-3 text-center ${
                              selectedQuotation === quote.id ? 'bg-green-50' : ''
                            }`}
                          >
                            {quoteItem ? (
                              <div className="space-y-1">
                                <div
                                  className={`flex items-center justify-center gap-1 ${
                                    isBest ? 'text-green-600 font-semibold' : 'text-gray-700'
                                  }`}
                                >
                                  {isBest && <Award className="w-4 h-4" />}
                                  <span>{formatCurrency(quoteItem.unitPrice)}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Total: {formatCurrency(quoteItem.totalPrice)}
                                </p>
                                <div className="flex items-center justify-center gap-1">
                                  {quoteItem.inStock ? (
                                    <span className="text-xs text-green-600">In Stock</span>
                                  ) : (
                                    <span className="text-xs text-orange-500 flex items-center gap-0.5">
                                      <AlertCircle className="w-3 h-3" />
                                      {quoteItem.deliveryDays}d lead
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Total Amount */}
                  <tr className="bg-gray-100 font-semibold border-b">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-600" />
                        <span>Total Amount</span>
                      </div>
                    </td>
                    {sortedQuotations.map((quote) => (
                      <td
                        key={quote.id}
                        className={`px-4 py-3 text-center ${
                          selectedQuotation === quote.id ? 'bg-green-100' : ''
                        }`}
                      >
                        <span className={`text-lg ${getScoreColor(quote)}`}>
                          {formatCurrency(quote.totalAmount)}
                        </span>
                        {quote.totalAmount === stats.lowestTotal && (
                          <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                            Best Price
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Delivery Time */}
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-gray-600" />
                        <span>Delivery Time</span>
                      </div>
                    </td>
                    {sortedQuotations.map((quote) => (
                      <td
                        key={quote.id}
                        className={`px-4 py-3 text-center ${
                          selectedQuotation === quote.id ? 'bg-green-50' : ''
                        }`}
                      >
                        <span
                          className={
                            quote.deliveryDays === stats.fastestDelivery
                              ? 'text-blue-600 font-medium'
                              : 'text-gray-700'
                          }
                        >
                          {quote.deliveryDays} days
                        </span>
                        {quote.deliveryDays === stats.fastestDelivery && (
                          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                            Fastest
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Payment Terms */}
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-gray-600" />
                        <span>Payment Terms</span>
                      </div>
                    </td>
                    {sortedQuotations.map((quote) => (
                      <td
                        key={quote.id}
                        className={`px-4 py-3 text-center ${
                          selectedQuotation === quote.id ? 'bg-green-50' : ''
                        }`}
                      >
                        {quote.paymentTerms || '-'}
                      </td>
                    ))}
                  </tr>

                  {/* Warranty */}
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span>Warranty</span>
                      </div>
                    </td>
                    {sortedQuotations.map((quote) => (
                      <td
                        key={quote.id}
                        className={`px-4 py-3 text-center ${
                          selectedQuotation === quote.id ? 'bg-green-50' : ''
                        }`}
                      >
                        {quote.warranty || '-'}
                      </td>
                    ))}
                  </tr>

                  {/* Valid Until */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span>Quote Valid Until</span>
                      </div>
                    </td>
                    {sortedQuotations.map((quote) => (
                      <td
                        key={quote.id}
                        className={`px-4 py-3 text-center ${
                          selectedQuotation === quote.id ? 'bg-green-50' : ''
                        }`}
                      >
                        {new Date(quote.validUntil).toLocaleDateString()}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Notes Section */}
            <div className="mt-4 grid grid-cols-3 gap-4">
              {sortedQuotations.map((quote) => (
                <div key={quote.id} className="bg-white rounded-lg border p-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    {quote.supplier?.name || 'Vendor'} Notes
                  </h4>
                  <p className="text-sm text-gray-600">
                    {quote.notes || 'No additional notes provided.'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && selectedQuote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Confirm Vendor Selection & Create PO</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-full">
                  <Trophy className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedQuote.supplier?.name || 'Vendor'}
                  </p>
                  <p className="text-sm text-gray-500">Selected as winning vendor</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Total Amount:</span>
                    <span className="ml-2 font-medium">
                      {formatCurrency(selectedQuote.totalAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Delivery:</span>
                    <span className="ml-2 font-medium">{selectedQuote.deliveryDays} days</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Payment Terms:</span>
                    <span className="ml-2 font-medium">{selectedQuote.paymentTerms || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Valid Until:</span>
                    <span className="ml-2 font-medium">
                      {new Date(selectedQuote.validUntil).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                This will mark the quotation as selected and create a Purchase Order. Do you want to
                continue?
              </p>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSelectWinner}
                disabled={selectWinnerMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {selectWinnerMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Confirm & Create PO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
