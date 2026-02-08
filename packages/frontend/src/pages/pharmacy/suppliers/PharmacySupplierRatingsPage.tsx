import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Star,
  TrendingUp,
  TrendingDown,
  Truck,
  Package,
  DollarSign,
  Headphones,
  AlertTriangle,
  Award,
  Filter,
  ChevronDown,
  ChevronUp,
  Flag,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { pharmacyService, type Supplier } from '../../../services/pharmacy';

interface SupplierRating {
  id: string;
  supplierName: string;
  overallRating: number;
  deliveryRating: number;
  qualityRating: number;
  priceRating: number;
  serviceRating: number;
  totalReviews: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  issuesCount: number;
  lastReview: string;
  isTopSupplier: boolean;
}

interface HistoricalRating {
  month: string;
  rating: number;
}

export default function PharmacySupplierRatingsPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.suppliers')) {
    return <AccessDenied />;
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'overall' | 'delivery' | 'quality' | 'price' | 'service'>('overall');
  const [showTopOnly, setShowTopOnly] = useState(false);
  const [expandedSupplier, setExpandedSupplier] = useState<string | null>(null);

  const { data: suppliersData, isLoading } = useQuery({
    queryKey: ['pharmacy', 'suppliers'],
    queryFn: () => pharmacyService.suppliers.list(),
  });

  // Historical data for charts
  const historicalData: HistoricalRating[] = useMemo(() => {
    return [
      { month: 'Jan', rating: 4.2 },
      { month: 'Feb', rating: 4.3 },
      { month: 'Mar', rating: 4.1 },
      { month: 'Apr', rating: 4.4 },
      { month: 'May', rating: 4.5 },
      { month: 'Jun', rating: 4.6 },
    ];
  }, []);

  // Transform suppliers to ratings format
  const ratings: SupplierRating[] = useMemo(() => {
    if (!suppliersData?.data) return [];
    return suppliersData.data.map((s: Supplier, index: number) => {
      // Generate pseudo-random ratings based on supplier data
      const baseRating = 3.5 + (index % 20) * 0.1;
      const isTop = baseRating >= 4.3;
      return {
        id: s.id,
        supplierName: s.name,
        overallRating: Math.min(5, baseRating + 0.2),
        deliveryRating: Math.min(5, baseRating + 0.1),
        qualityRating: Math.min(5, baseRating + 0.3),
        priceRating: Math.min(5, baseRating - 0.1),
        serviceRating: Math.min(5, baseRating + 0.15),
        totalReviews: 10 + (index * 3),
        trend: index % 3 === 0 ? 'up' : index % 3 === 1 ? 'down' : 'stable',
        trendValue: 0.2 + (index % 5) * 0.1,
        issuesCount: index % 4 === 0 ? 1 : 0,
        lastReview: new Date(s.createdAt).toLocaleDateString(),
        isTopSupplier: isTop,
      };
    });
  }, [suppliersData]);

  const filteredRatings = useMemo(() => {
    let ratingsList = ratings.filter((rating) =>
      rating.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (showTopOnly) {
      ratingsList = ratingsList.filter((r) => r.isTopSupplier);
    }
    return ratingsList.sort((a, b) => {
      const keyMap = {
        overall: 'overallRating',
        delivery: 'deliveryRating',
        quality: 'qualityRating',
        price: 'priceRating',
        service: 'serviceRating',
      };
      const key = keyMap[sortBy] as keyof SupplierRating;
      return (b[key] as number) - (a[key] as number);
    });
  }, [searchTerm, sortBy, showTopOnly]);

  const stats = useMemo(() => {
    if (ratings.length === 0) return { avgRating: 0, topSuppliers: 0, totalIssues: 0, improvingCount: 0 };
    const avgRating = ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length;
    const topSuppliers = ratings.filter((r) => r.isTopSupplier).length;
    const totalIssues = ratings.reduce((sum, r) => sum + r.issuesCount, 0);
    const improvingCount = ratings.filter((r) => r.trend === 'up').length;
    return { avgRating, topSuppliers, totalIssues, improvingCount };
  }, [ratings]);

  const renderStars = (rating: number, size: string = 'w-4 h-4') => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`${size} ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
        />
      );
    }
    return stars;
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-blue-600';
    if (rating >= 3.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: string, value: number) => {
    if (trend === 'up') {
      return (
        <span className="flex items-center gap-1 text-green-600 text-sm">
          <TrendingUp className="w-4 h-4" />+{value.toFixed(1)}
        </span>
      );
    } else if (trend === 'down') {
      return (
        <span className="flex items-center gap-1 text-red-600 text-sm">
          <TrendingDown className="w-4 h-4" />{value.toFixed(1)}
        </span>
      );
    }
    return <span className="text-gray-500 text-sm">Stable</span>;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Ratings</h1>
          <p className="text-gray-500">Performance ratings and historical trends</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Star className="w-4 h-4" />
          Rate Supplier
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{(Number(stats.avgRating) || 0).toFixed(1)}</p>
              <p className="text-sm text-gray-500">Average Rating</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Award className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.topSuppliers}</p>
              <p className="text-sm text-gray-500">Top Suppliers</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Flag className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalIssues}</p>
              <p className="text-sm text-gray-500">Issues Flagged</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.improvingCount}</p>
              <p className="text-sm text-gray-500">Improving</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="overall">Sort by Overall</option>
            <option value="delivery">Sort by Delivery</option>
            <option value="quality">Sort by Quality</option>
            <option value="price">Sort by Price</option>
            <option value="service">Sort by Service</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showTopOnly}
            onChange={(e) => setShowTopOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-600">Top suppliers only</span>
        </label>
      </div>

      {/* Ratings List */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-auto h-full">
          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                  <p className="text-gray-500">Loading ratings...</p>
                </div>
              </div>
            ) : filteredRatings.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Star className="w-12 h-12 text-gray-300" />
                  <div>
                    <p className="text-gray-900 font-medium">No ratings found</p>
                    <p className="text-gray-500 text-sm">Supplier ratings will appear here once reviews are submitted</p>
                  </div>
                </div>
              </div>
            ) : (
              filteredRatings.map((rating) => (
              <div key={rating.id} className="p-4 hover:bg-gray-50">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedSupplier(expandedSupplier === rating.id ? null : rating.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                      {rating.supplierName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{rating.supplierName}</span>
                        {rating.isTopSupplier && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
                            <Award className="w-3 h-3" /> Top Supplier
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center">{renderStars(rating.overallRating)}</div>
                        <span className={`font-medium ${getRatingColor(rating.overallRating)}`}>
                          {rating.overallRating.toFixed(1)}
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="text-sm text-gray-500">{rating.totalReviews} reviews</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {rating.issuesCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {rating.issuesCount} issues
                      </span>
                    )}
                    {getTrendIcon(rating.trend, rating.trendValue)}
                    {expandedSupplier === rating.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedSupplier === rating.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">Delivery</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStars(rating.deliveryRating, 'w-3 h-3')}
                          <span className={`font-medium ${getRatingColor(rating.deliveryRating)}`}>
                            {rating.deliveryRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-gray-700">Quality</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStars(rating.qualityRating, 'w-3 h-3')}
                          <span className={`font-medium ${getRatingColor(rating.qualityRating)}`}>
                            {rating.qualityRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm font-medium text-gray-700">Price</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStars(rating.priceRating, 'w-3 h-3')}
                          <span className={`font-medium ${getRatingColor(rating.priceRating)}`}>
                            {rating.priceRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Headphones className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-gray-700">Service</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStars(rating.serviceRating, 'w-3 h-3')}
                          <span className={`font-medium ${getRatingColor(rating.serviceRating)}`}>
                            {rating.serviceRating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Historical Performance */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Historical Performance (6 months)</span>
                      </div>
                      <div className="flex items-end gap-2 h-20">
                        {historicalData.map((h, idx) => (
                          <div key={idx} className="flex-1 flex flex-col items-center">
                            <div
                              className="w-full bg-blue-500 rounded-t"
                              style={{ height: `${(h.rating / 5) * 100}%` }}
                            />
                            <span className="text-xs text-gray-500 mt-1">{h.month}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-gray-500">Last review: {rating.lastReview}</span>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          View All Reviews
                        </button>
                        <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors">
                          Add Review
                        </button>
                        {rating.issuesCount > 0 && (
                          <button className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1">
                            <Flag className="w-3 h-3" /> View Issues
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
