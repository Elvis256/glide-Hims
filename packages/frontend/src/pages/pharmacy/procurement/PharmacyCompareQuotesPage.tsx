import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  CheckCircle,
  Award,
  Building2,
  Clock,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Star,
  Filter,
  ChevronDown,
  ChevronUp,
  Truck,
  CreditCard,
  Package,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import { procurementService, type PurchaseRequest } from '../../../services/procurement';
import { formatCurrency } from '../../../lib/currency';

interface SupplierQuote {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  deliveryDays: number;
  paymentTerms: string;
  minOrderQty: number;
  validity: string;
  notes: string;
  rating: number;
}

interface QuoteItem {
  id: string;
  medication: string;
  quantity: number;
  specification: string;
  quotes: SupplierQuote[];
  selectedSupplier?: string;
}

interface QuoteComparison {
  rfqNo: string;
  rfqDate: string;
  deadline: string;
  items: QuoteItem[];
}

// Transform approved purchase requests to quote comparison format
const transformToQuoteComparison = (pr: PurchaseRequest): QuoteComparison => ({
  rfqNo: `RFQ-${pr.requestNumber}`,
  rfqDate: new Date(pr.createdAt).toLocaleDateString(),
  deadline: pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString() : '',
  items: pr.items.map(item => ({
    id: item.id,
    medication: item.itemName,
    quantity: item.quantityRequested,
    specification: item.specifications || '',
    quotes: [],
    selectedSupplier: undefined,
  })),
});

export default function PharmacyCompareQuotesPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.procurement')) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)] bg-gray-50">
        <div className="text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<'price' | 'delivery' | 'rating'>('price');

  // Fetch approved purchase requests
  const { data: purchaseRequests = [], isLoading, error } = useQuery({
    queryKey: ['purchaseRequests', 'approved'],
    queryFn: () => procurementService.purchaseRequests.list({ status: 'approved' }),
  });

  const comparison = useMemo(() => {
    if (purchaseRequests.length === 0) {
      return { rfqNo: '', rfqDate: '', deadline: '', items: [] };
    }
    return transformToQuoteComparison(purchaseRequests[0]);
  }, [purchaseRequests]);

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
        <p className="text-red-600">Failed to load quotations</p>
      </div>
    );
  }

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const selectSupplier = (itemId: string, supplierId: string) => {
    setSelections((prev) => ({ ...prev, [itemId]: supplierId }));
  };

  const getBestQuote = (quotes: SupplierQuote[], criteria: 'price' | 'delivery' | 'rating') => {
    if (quotes.length === 0) return null;
    switch (criteria) {
      case 'price':
        return quotes.reduce((best, q) => (q.unitPrice < best.unitPrice ? q : best));
      case 'delivery':
        return quotes.reduce((best, q) => (q.deliveryDays < best.deliveryDays ? q : best));
      case 'rating':
        return quotes.reduce((best, q) => (q.rating > best.rating ? q : best));
    }
  };

  const sortedQuotes = (quotes: SupplierQuote[]) => {
    return [...quotes].sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return a.unitPrice - b.unitPrice;
        case 'delivery':
          return a.deliveryDays - b.deliveryDays;
        case 'rating':
          return b.rating - a.rating;
      }
    });
  };

  const stats = useMemo(() => {
    return {
      totalItems: 0,
      totalQuotes: 0,
      selectedItems: 0,
      totalSelected: 0,
      totalSavings: 0,
    };
  }, []);

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compare Quotations</h1>
          <p className="text-gray-600">
            {comparison.rfqNo} • Created {comparison.rfqDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={stats.selectedItems < stats.totalItems}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              stats.selectedItems === stats.totalItems
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Award className="w-4 h-4" />
            Award to Suppliers
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Items to Quote</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Quotes</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalQuotes}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Selected</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.selectedItems}/{stats.totalItems}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Selected Total</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(stats.totalSelected)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Potential Savings</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalSavings)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sort Options */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Sort quotes by:</span>
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
          <button className="text-sm text-blue-600 hover:underline">Auto-select Best</button>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="flex-1 overflow-auto space-y-4">
        {comparison.items.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium text-lg">No quotations to compare</p>
            <p className="text-gray-400 text-sm mt-2">Select an RFQ with responses to compare supplier quotations</p>
          </div>
        ) : (
          comparison.items.map((item) => {
            const isExpanded = expandedItems[item.id];
            const bestPrice = getBestQuote(item.quotes, 'price');
            const selectedQuote = item.quotes.find((q) => q.supplierId === selections[item.id]);

            return (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Item Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.medication}</h3>
                      <p className="text-sm text-gray-500">
                        {item.specification} • Qty: {item.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {selectedQuote ? (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          {selectedQuote.supplierName} - {formatCurrency(selectedQuote.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">{item.quotes.length} quotes received</span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Quotes Grid */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4">
                    <div className="grid grid-cols-3 gap-4">
                      {sortedQuotes(item.quotes).map((quote, index) => {
                        const isSelected = selections[item.id] === quote.supplierId;
                        const isBestPrice = quote.supplierId === bestPrice?.supplierId;
                        const totalPrice = quote.unitPrice * item.quantity;

                        return (
                          <div
                            key={quote.supplierId}
                            className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                            }`}
                            onClick={() => selectSupplier(item.id, quote.supplierId)}
                          >
                            {/* Best Price Badge */}
                            {isBestPrice && sortBy === 'price' && (
                              <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                                Best Price
                              </div>
                            )}
                            {index === 0 && sortBy === 'delivery' && (
                              <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                                Fastest
                              </div>
                            )}
                            {index === 0 && sortBy === 'rating' && (
                              <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
                                Top Rated
                              </div>
                            )}

                            {/* Supplier Info */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{quote.supplierName}</span>
                              </div>
                              {isSelected && <CheckCircle className="w-5 h-5 text-green-600" />}
                            </div>

                            {/* Rating */}
                            <div className="mb-3">{renderStars(quote.rating)}</div>

                            {/* Price */}
                            <div className="mb-3">
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-gray-900">
                                  {formatCurrency(quote.unitPrice)}
                                </span>
                                <span className="text-sm text-gray-500">/unit</span>
                              </div>
                              <p className="text-sm text-gray-600">
                                Total: {formatCurrency(totalPrice)}
                              </p>
                            </div>

                            {/* Details */}
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-gray-600">
                                <Truck className="w-4 h-4" />
                                <span>{quote.deliveryDays} days delivery</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <CreditCard className="w-4 h-4" />
                                <span>{quote.paymentTerms}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <Clock className="w-4 h-4" />
                                <span>Valid: {quote.validity}</span>
                              </div>
                            </div>

                            {/* Notes */}
                            {quote.notes && (
                              <p className="mt-3 text-xs text-gray-500 italic">
                                "{quote.notes}"
                              </p>
                            )}

                            {/* Select Button */}
                            <button
                              className={`w-full mt-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                isSelected
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select Supplier'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
