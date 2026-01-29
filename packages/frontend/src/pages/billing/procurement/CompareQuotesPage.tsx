import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';

interface QuoteItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface VendorQuote {
  vendorId: string;
  vendorName: string;
  items: {
    itemId: string;
    unitPrice: number;
    totalPrice: number;
    deliveryDays: number;
    inStock: boolean;
  }[];
  totalAmount: number;
  deliveryDays: number;
  paymentTerms: string;
  validUntil: string;
  warranty: string;
  qualityRating: number;
  notes?: string;
}

interface ComparisonData {
  rfqNumber: string;
  rfqTitle: string;
  items: QuoteItem[];
  quotes: VendorQuote[];
}

const comparisonData: ComparisonData = {
  rfqNumber: '',
  rfqTitle: '',
  items: [],
  quotes: [],
};

export default function CompareQuotesPage() {
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const bestPrices = useMemo(() => {
    const prices: Record<string, { vendorId: string; price: number }> = {};
    comparisonData.items.forEach((item) => {
      let bestPrice = Infinity;
      let bestVendor = '';
      comparisonData.quotes.forEach((quote) => {
        const quoteItem = quote.items.find((qi) => qi.itemId === item.id);
        if (quoteItem && quoteItem.unitPrice < bestPrice) {
          bestPrice = quoteItem.unitPrice;
          bestVendor = quote.vendorId;
        }
      });
      prices[item.id] = { vendorId: bestVendor, price: bestPrice };
    });
    return prices;
  }, []);

  const lowestTotal = useMemo(() => {
    if (comparisonData.quotes.length === 0) return 0;
    return Math.min(...comparisonData.quotes.map((q) => q.totalAmount));
  }, []);

  const fastestDelivery = useMemo(() => {
    if (comparisonData.quotes.length === 0) return 0;
    return Math.min(...comparisonData.quotes.map((q) => q.deliveryDays));
  }, []);

  const getScoreColor = (quote: VendorQuote) => {
    if (quote.totalAmount === lowestTotal) return 'text-green-600';
    if (quote.totalAmount <= lowestTotal * 1.05) return 'text-yellow-600';
    return 'text-gray-600';
  };

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
                {comparisonData.rfqNumber ? `${comparisonData.rfqNumber} - ${comparisonData.rfqTitle}` : 'No quotation selected'}
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
              disabled={!selectedVendor}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedVendor
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              Select Winner
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
            <p className="text-2xl font-bold text-gray-900">{comparisonData.quotes.length}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingDown className="w-4 h-4" />
              <span className="text-sm">Lowest Quote</span>
            </div>
            <p className="text-2xl font-bold text-green-600">${lowestTotal.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Highest Quote</span>
            </div>
            <p className="text-2xl font-bold text-red-500">
              ${comparisonData.quotes.length > 0 ? Math.max(...comparisonData.quotes.map((q) => q.totalAmount)).toLocaleString() : 0}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Truck className="w-4 h-4" />
              <span className="text-sm">Fastest Delivery</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{fastestDelivery} days</p>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {comparisonData.quotes.length === 0 ? (
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
                {comparisonData.quotes.map((quote) => (
                  <th
                    key={quote.vendorId}
                    className={`text-center px-4 py-3 font-medium border-b cursor-pointer transition-colors ${
                      selectedVendor === quote.vendorId
                        ? 'bg-green-50 border-green-200'
                        : 'hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedVendor(quote.vendorId)}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-2">
                        {quote.totalAmount === lowestTotal && (
                          <Trophy className="w-4 h-4 text-amber-500" />
                        )}
                        <span className="text-gray-900">{quote.vendorName}</span>
                      </div>
                      {selectedVendor === quote.vendorId && (
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
              {/* Item Prices */}
              {comparisonData.items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} {item.unit}
                      </p>
                    </div>
                  </td>
                  {comparisonData.quotes.map((quote) => {
                    const quoteItem = quote.items.find((qi) => qi.itemId === item.id);
                    const isBest = bestPrices[item.id]?.vendorId === quote.vendorId;
                    return (
                      <td
                        key={quote.vendorId}
                        className={`px-4 py-3 text-center ${
                          selectedVendor === quote.vendorId ? 'bg-green-50' : ''
                        }`}
                      >
                        {quoteItem && (
                          <div className="space-y-1">
                            <div
                              className={`flex items-center justify-center gap-1 ${
                                isBest ? 'text-green-600 font-semibold' : 'text-gray-700'
                              }`}
                            >
                              {isBest && <Award className="w-4 h-4" />}
                              <span>${quoteItem.unitPrice.toFixed(2)}</span>
                            </div>
                            <p className="text-xs text-gray-500">
                              Total: ${quoteItem.totalPrice.toLocaleString()}
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
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Total */}
              <tr className="bg-gray-100 font-semibold border-b">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-600" />
                    <span>Total Amount</span>
                  </div>
                </td>
                {comparisonData.quotes.map((quote) => (
                  <td
                    key={quote.vendorId}
                    className={`px-4 py-3 text-center ${
                      selectedVendor === quote.vendorId ? 'bg-green-100' : ''
                    }`}
                  >
                    <span className={`text-lg ${getScoreColor(quote)}`}>
                      ${quote.totalAmount.toLocaleString()}
                    </span>
                    {quote.totalAmount === lowestTotal && (
                      <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                        Best Price
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Delivery */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-gray-600" />
                    <span>Delivery Time</span>
                  </div>
                </td>
                {comparisonData.quotes.map((quote) => (
                  <td
                    key={quote.vendorId}
                    className={`px-4 py-3 text-center ${
                      selectedVendor === quote.vendorId ? 'bg-green-50' : ''
                    }`}
                  >
                    <span
                      className={
                        quote.deliveryDays === fastestDelivery
                          ? 'text-blue-600 font-medium'
                          : 'text-gray-700'
                      }
                    >
                      {quote.deliveryDays} days
                    </span>
                    {quote.deliveryDays === fastestDelivery && (
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
                {comparisonData.quotes.map((quote) => (
                  <td
                    key={quote.vendorId}
                    className={`px-4 py-3 text-center ${
                      selectedVendor === quote.vendorId ? 'bg-green-50' : ''
                    }`}
                  >
                    {quote.paymentTerms}
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
                {comparisonData.quotes.map((quote) => (
                  <td
                    key={quote.vendorId}
                    className={`px-4 py-3 text-center ${
                      selectedVendor === quote.vendorId ? 'bg-green-50' : ''
                    }`}
                  >
                    {quote.warranty}
                  </td>
                ))}
              </tr>

              {/* Quality Rating */}
              <tr className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-gray-600" />
                    <span>Vendor Rating</span>
                  </div>
                </td>
                {comparisonData.quotes.map((quote) => (
                  <td
                    key={quote.vendorId}
                    className={`px-4 py-3 text-center ${
                      selectedVendor === quote.vendorId ? 'bg-green-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium">{quote.qualityRating}</span>
                      <span className="text-gray-400">/5</span>
                    </div>
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
                {comparisonData.quotes.map((quote) => (
                  <td
                    key={quote.vendorId}
                    className={`px-4 py-3 text-center ${
                      selectedVendor === quote.vendorId ? 'bg-green-50' : ''
                    }`}
                  >
                    {quote.validUntil}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes Section */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          {comparisonData.quotes.map((quote) => (
            <div key={quote.vendorId} className="bg-white rounded-lg border p-4">
              <h4 className="font-medium text-gray-900 mb-2">{quote.vendorName} Notes</h4>
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
      {showConfirmModal && selectedVendor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Confirm Vendor Selection</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-full">
                  <Trophy className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {comparisonData.quotes.find((q) => q.vendorId === selectedVendor)?.vendorName}
                  </p>
                  <p className="text-sm text-gray-500">Selected as winning vendor</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Total Amount:</span>
                    <span className="ml-2 font-medium">
                      ${comparisonData.quotes.find((q) => q.vendorId === selectedVendor)?.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Delivery:</span>
                    <span className="ml-2 font-medium">
                      {comparisonData.quotes.find((q) => q.vendorId === selectedVendor)?.deliveryDays} days
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                This will proceed to the approval workflow. Do you want to continue?
              </p>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <ArrowRight className="w-4 h-4" />
                Proceed to Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
