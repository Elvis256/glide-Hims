import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  Search,
  Filter,
  X,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  AlertTriangle,
  ChevronDown,
  BarChart3,
  Clock,
  Package,
  DollarSign,
  HeadphonesIcon,
  Loader2,
} from 'lucide-react';
import { vendorRatingsService, type VendorRating, type VendorRatingSummary, type CreateVendorRatingDto } from '../../../services/vendor-ratings';
import { useAuthStore } from '../../../store/auth';

const criteriaConfig = {
  quality: { label: 'Quality', icon: Package, color: 'text-green-600' },
  delivery: { label: 'Delivery', icon: Clock, color: 'text-blue-600' },
  pricing: { label: 'Pricing', icon: DollarSign, color: 'text-purple-600' },
  service: { label: 'Service', icon: HeadphonesIcon, color: 'text-orange-600' },
};

interface RatingCriteria {
  quality: number;
  delivery: number;
  pricing: number;
  service: number;
}

interface HistoricalRating {
  month: string;
  overall: number;
}

interface TransformedVendor {
  id: string;
  vendorName: string;
  category: string;
  overallRating: number;
  totalReviews: number;
  trend: 'up' | 'down' | 'stable';
  criteria: RatingCriteria;
  historicalRatings: HistoricalRating[];
}

export default function VendorRatingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorRatingSummary | null>(null);
  const [ratingFormData, setRatingFormData] = useState<Record<keyof RatingCriteria, number>>({
    quality: 5,
    delivery: 5,
    pricing: 5,
    service: 5,
  });

  // Fetch vendor rating summaries
  const { data: vendorSummaries = [], isLoading } = useQuery({
    queryKey: ['vendor-ratings-summaries'],
    queryFn: () => vendorRatingsService.getAllSummaries(),
  });

  // Fetch top vendors
  const { data: topVendors = [] } = useQuery({
    queryKey: ['vendor-ratings-top'],
    queryFn: () => vendorRatingsService.getTopVendors(5),
  });

  // Create rating mutation
  const createRatingMutation = useMutation({
    mutationFn: (data: CreateVendorRatingDto) => vendorRatingsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-ratings'] });
      setShowRateModal(false);
    },
  });

  // Transform API data to match UI expectations
  const transformedVendors = useMemo((): TransformedVendor[] => {
    return vendorSummaries.map((v) => ({
      id: v.id,
      vendorName: v.supplier?.name || 'Unknown Vendor',
      category: 'Supplier',
      overallRating: Number(v.avgOverall) || 0,
      totalReviews: v.totalReviews || 0,
      trend: v.trend || 'stable',
      criteria: {
        quality: Number(v.avgQuality) || 0,
        delivery: Number(v.avgDeliveryTime) || 0,
        pricing: Number(v.avgPrice) || 0,
        service: Number(v.avgService) || 0,
      },
      historicalRatings: [],
    }));
  }, [vendorSummaries]);

  const transformedTopVendors = useMemo((): TransformedVendor[] => {
    return topVendors.map((v) => ({
      id: v.id,
      vendorName: v.supplier?.name || 'Unknown Vendor',
      category: 'Supplier',
      overallRating: Number(v.avgOverall) || 0,
      totalReviews: v.totalReviews || 0,
      trend: v.trend || 'stable',
      criteria: {
        quality: Number(v.avgQuality) || 0,
        delivery: Number(v.avgDeliveryTime) || 0,
        pricing: Number(v.avgPrice) || 0,
        service: Number(v.avgService) || 0,
      },
      historicalRatings: [],
    }));
  }, [topVendors]);

  const filteredVendors = useMemo(() => {
    return transformedVendors.filter((vendor) => {
      const matchesSearch = vendor.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating =
        ratingFilter === 'all' ||
        (ratingFilter === '4plus' && vendor.overallRating >= 4) ||
        (ratingFilter === '3to4' && vendor.overallRating >= 3 && vendor.overallRating < 4) ||
        (ratingFilter === 'below3' && vendor.overallRating < 3);
      return matchesSearch && matchesRating;
    });
  }, [transformedVendors, searchQuery, ratingFilter]);

  const topPerformers = useMemo(() => {
    return transformedTopVendors.slice(0, 3);
  }, [transformedTopVendors]);

  const needsImprovement = useMemo(() => {
    return transformedVendors.filter((v) => v.overallRating < 3.5);
  }, [transformedVendors]);

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(transformedVendors.map((v) => v.category))];
    return uniqueCategories;
  }, [transformedVendors]);

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderMiniChart = (data: HistoricalRating[]) => {
    if (!data || data.length === 0) {
      return <span className="text-xs text-gray-400">No history</span>;
    }
    const max = 5;
    const min = 0;
    return (
      <div className="flex items-end gap-1 h-12">
        {data.map((point, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div
              className="w-6 bg-blue-500 rounded-t"
              style={{ height: `${((point.overall - min) / (max - min)) * 100}%` }}
            />
            <span className="text-xs text-gray-500 mt-1">{point.month}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendor Ratings</h1>
            <p className="text-sm text-gray-500 mt-1">Performance scorecards and reviews</p>
          </div>
          <button
            onClick={() => setShowRateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Star className="w-4 h-4" />
            Rate a Vendor
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Building2 className="w-4 h-4" />
              Total Vendors
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{transformedVendors.length}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <Star className="w-4 h-4" />
              Avg Rating
            </div>
            <p className="text-xl font-bold text-yellow-700 mt-1">
              {transformedVendors.length > 0 ? (transformedVendors.reduce((sum, v) => sum + v.overallRating, 0) / transformedVendors.length).toFixed(1) : '0.0'}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Award className="w-4 h-4" />
              Top Rated (4+)
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">
              {transformedVendors.filter((v) => v.overallRating >= 4).length}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Needs Improvement
            </div>
            <p className="text-xl font-bold text-red-700 mt-1">{needsImprovement.length}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rating</label>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Ratings</option>
                <option value="4plus">4+ Stars</option>
                <option value="3to4">3-4 Stars</option>
                <option value="below3">Below 3 Stars</option>
              </select>
            </div>
            {(categoryFilter !== 'all' || ratingFilter !== 'all') && (
              <button
                onClick={() => {
                  setCategoryFilter('all');
                  setRatingFilter('all');
                }}
                className="text-sm text-blue-600 hover:underline mt-4"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="grid grid-cols-3 gap-6">
          {/* Main Ratings List */}
          <div className="col-span-2 space-y-4">
            <h2 className="font-semibold text-gray-900">All Vendor Ratings</h2>
            {filteredVendors.length === 0 ? (
              <div className="text-center py-12 text-gray-500 bg-white rounded-lg border">
                <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No vendor ratings found</p>
                <p className="text-sm mt-1">Rate your first vendor to see performance data</p>
                <button
                  onClick={() => setShowRateModal(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Star className="w-4 h-4" />
                  Rate a Vendor
                </button>
              </div>
            ) : (
            <>
            {filteredVendors.map((vendor) => (
              <div key={vendor.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{vendor.vendorName}</h3>
                      <p className="text-sm text-gray-500">{vendor.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">{vendor.overallRating}</span>
                      {getTrendIcon(vendor.trend)}
                    </div>
                    {renderStars(vendor.overallRating)}
                    <p className="text-xs text-gray-500 mt-1">{vendor.totalReviews} reviews</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-4">
                  {(Object.keys(vendor.criteria) as Array<keyof RatingCriteria>).map((key) => {
                    const config = criteriaConfig[key];
                    const Icon = config.icon;
                    return (
                      <div key={key} className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          <span className="text-xs text-gray-500">{config.label}</span>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-semibold">{vendor.criteria[key]}</span>
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Performance Trend</span>
                  </div>
                  {renderMiniChart(vendor.historicalRatings)}
                </div>
              </div>
            ))}
            </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Top Performers */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold text-gray-900">Top Performers</h3>
              </div>
              <div className="space-y-3">
                {topPerformers.map((vendor, idx) => (
                  <div key={vendor.id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-600' : 'bg-orange-100 text-orange-700'}`}>
                      {idx + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{vendor.vendorName}</p>
                      <div className="flex items-center gap-1">
                        {renderStars(vendor.overallRating)}
                        <span className="text-sm text-gray-600 ml-1">{vendor.overallRating}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Needs Improvement */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-900">Needs Improvement</h3>
              </div>
              {needsImprovement.length > 0 ? (
                <div className="space-y-3">
                  {needsImprovement.map((vendor) => (
                    <div key={vendor.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{vendor.vendorName}</p>
                        <div className="flex items-center gap-1">
                          {renderStars(vendor.overallRating)}
                          <span className="text-sm text-red-600 ml-1">{vendor.overallRating}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">All vendors meeting standards</p>
              )}
            </div>

            {/* Rating Comparison Chart */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-gray-900">Rating Distribution</h3>
              </div>
              <div className="space-y-2">
                {[
                  { label: '5 Stars', count: transformedVendors.filter((v) => v.overallRating >= 4.5).length },
                  { label: '4 Stars', count: transformedVendors.filter((v) => v.overallRating >= 3.5 && v.overallRating < 4.5).length },
                  { label: '3 Stars', count: transformedVendors.filter((v) => v.overallRating >= 2.5 && v.overallRating < 3.5).length },
                  { label: '2 Stars', count: transformedVendors.filter((v) => v.overallRating >= 1.5 && v.overallRating < 2.5).length },
                  { label: '1 Star', count: transformedVendors.filter((v) => v.overallRating < 1.5).length },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${transformedVendors.length > 0 ? (item.count / transformedVendors.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-4">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rate Vendor Modal */}
      {showRateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Rate a Vendor</h2>
                <p className="text-sm text-gray-500">Submit your performance review</p>
              </div>
              <button onClick={() => setShowRateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Vendor</label>
                <select className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Choose a vendor</option>
                  {transformedVendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.vendorName}</option>
                  ))}
                </select>
              </div>

              {(Object.keys(criteriaConfig) as Array<keyof RatingCriteria>).map((key) => {
                const config = criteriaConfig[key];
                const Icon = config.icon;
                return (
                  <div key={key}>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      {config.label}
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRatingFormData((prev) => ({ ...prev, [key]: star }))}
                          className="p-1"
                        >
                          <Star
                            className={`w-6 h-6 ${star <= ratingFormData[key] ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                          />
                        </button>
                      ))}
                      <span className="text-sm text-gray-600 ml-2">{ratingFormData[key]}/5</span>
                    </div>
                  </div>
                );
              })}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Add any additional feedback..."
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button onClick={() => setShowRateModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
