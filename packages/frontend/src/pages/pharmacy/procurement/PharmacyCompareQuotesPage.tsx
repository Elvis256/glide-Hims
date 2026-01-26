import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';

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

const mockQuoteComparison: QuoteComparison = {
  rfqNo: 'RFQ-2024-001',
  rfqDate: '2024-01-15',
  deadline: '2024-01-25',
  items: [
    {
      id: '1',
      medication: 'Amoxicillin 500mg',
      quantity: 500,
      specification: 'Capsules, blister pack',
      quotes: [
        {
          supplierId: '1',
          supplierName: 'PharmaCorp Kenya',
          unitPrice: 14.5,
          deliveryDays: 3,
          paymentTerms: 'Net 30',
          minOrderQty: 100,
          validity: '30 days',
          notes: 'Can deliver in batches',
          rating: 4.5,
        },
        {
          supplierId: '2',
          supplierName: 'MediSupply Ltd',
          unitPrice: 15.0,
          deliveryDays: 5,
          paymentTerms: 'Net 45',
          minOrderQty: 50,
          validity: '30 days',
          notes: '',
          rating: 4.2,
        },
        {
          supplierId: '3',
          supplierName: 'HealthCare Distributors',
          unitPrice: 13.8,
          deliveryDays: 7,
          paymentTerms: 'Net 15',
          minOrderQty: 200,
          validity: '14 days',
          notes: 'Limited stock available',
          rating: 3.8,
        },
      ],
    },
    {
      id: '2',
      medication: 'Azithromycin 250mg',
      quantity: 200,
      specification: 'Tablets, bottle',
      quotes: [
        {
          supplierId: '1',
          supplierName: 'PharmaCorp Kenya',
          unitPrice: 42.0,
          deliveryDays: 3,
          paymentTerms: 'Net 30',
          minOrderQty: 50,
          validity: '30 days',
          notes: '',
          rating: 4.5,
        },
        {
          supplierId: '2',
          supplierName: 'MediSupply Ltd',
          unitPrice: 45.5,
          deliveryDays: 4,
          paymentTerms: 'Net 45',
          minOrderQty: 25,
          validity: '30 days',
          notes: 'Bulk discount available for 500+',
          rating: 4.2,
        },
      ],
    },
    {
      id: '3',
      medication: 'Paracetamol 1g',
      quantity: 1000,
      specification: 'Tablets',
      quotes: [
        {
          supplierId: '1',
          supplierName: 'PharmaCorp Kenya',
          unitPrice: 4.8,
          deliveryDays: 2,
          paymentTerms: 'Net 30',
          minOrderQty: 500,
          validity: '30 days',
          notes: '',
          rating: 4.5,
        },
        {
          supplierId: '2',
          supplierName: 'MediSupply Ltd',
          unitPrice: 5.0,
          deliveryDays: 3,
          paymentTerms: 'Net 45',
          minOrderQty: 200,
          validity: '30 days',
          notes: '',
          rating: 4.2,
        },
        {
          supplierId: '3',
          supplierName: 'HealthCare Distributors',
          unitPrice: 4.5,
          deliveryDays: 5,
          paymentTerms: 'Net 15',
          minOrderQty: 1000,
          validity: '14 days',
          notes: 'Best price for bulk',
          rating: 3.8,
        },
      ],
    },
  ],
};

export default function PharmacyCompareQuotesPage() {
  const [comparison] = useState<QuoteComparison>(mockQuoteComparison);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({
    '1': true,
    '2': true,
    '3': true,
  });
  const [sortBy, setSortBy] = useState<'price' | 'delivery' | 'rating'>('price');

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
    const allQuotes = comparison.items.flatMap((item) => item.quotes);
    const selectedItems = Object.keys(selections).length;
    let totalSelected = 0;
    let totalSavings = 0;

    comparison.items.forEach((item) => {
      const selected = selections[item.id];
      if (selected) {
        const quote = item.quotes.find((q) => q.supplierId === selected);
        const highest = Math.max(...item.quotes.map((q) => q.unitPrice));
        if (quote) {
          totalSelected += quote.unitPrice * item.quantity;
          totalSavings += (highest - quote.unitPrice) * item.quantity;
        }
      }
    });

    return {
      totalItems: comparison.items.length,
      totalQuotes: allQuotes.length,
      selectedItems,
      totalSelected,
      totalSavings,
    };
  }, [comparison, selections]);

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
                KES {stats.totalSelected.toLocaleString()}
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
                KES {stats.totalSavings.toLocaleString()}
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
        {comparison.items.map((item) => {
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
                        {selectedQuote.supplierName} - KES {(selectedQuote.unitPrice * item.quantity).toLocaleString()}
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
                                KES {quote.unitPrice.toFixed(2)}
                              </span>
                              <span className="text-sm text-gray-500">/unit</span>
                            </div>
                            <p className="text-sm text-gray-600">
                              Total: KES {totalPrice.toLocaleString()}
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
        })}
      </div>
    </div>
  );
}
