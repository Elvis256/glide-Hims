import { useState, useMemo } from 'react';
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
} from 'lucide-react';

interface RatingCriteria {
  deliveryTime: number;
  quality: number;
  price: number;
  service: number;
}

interface HistoricalRating {
  month: string;
  overall: number;
}

interface VendorRating {
  id: string;
  vendorId: string;
  vendorName: string;
  category: string;
  overallRating: number;
  criteria: RatingCriteria;
  totalReviews: number;
  lastReviewDate: string;
  trend: 'up' | 'down' | 'stable';
  historicalRatings: HistoricalRating[];
}

const mockVendorRatings: VendorRating[] = [
  {
    id: '1',
    vendorId: '1',
    vendorName: 'MediSupply Kenya Ltd',
    category: 'Medical Supplies',
    overallRating: 4.8,
    criteria: { deliveryTime: 4.9, quality: 4.8, price: 4.5, service: 4.9 },
    totalReviews: 156,
    lastReviewDate: '2024-01-15',
    trend: 'up',
    historicalRatings: [
      { month: 'Oct', overall: 4.5 },
      { month: 'Nov', overall: 4.6 },
      { month: 'Dec', overall: 4.7 },
      { month: 'Jan', overall: 4.8 },
    ],
  },
  {
    id: '2',
    vendorId: '2',
    vendorName: 'PharmaCare Distributors',
    category: 'Pharmaceuticals',
    overallRating: 4.5,
    criteria: { deliveryTime: 4.3, quality: 4.8, price: 4.2, service: 4.7 },
    totalReviews: 243,
    lastReviewDate: '2024-01-17',
    trend: 'stable',
    historicalRatings: [
      { month: 'Oct', overall: 4.5 },
      { month: 'Nov', overall: 4.4 },
      { month: 'Dec', overall: 4.5 },
      { month: 'Jan', overall: 4.5 },
    ],
  },
  {
    id: '3',
    vendorId: '3',
    vendorName: 'EquipMed Africa',
    category: 'Equipment',
    overallRating: 4.2,
    criteria: { deliveryTime: 3.8, quality: 4.6, price: 4.0, service: 4.4 },
    totalReviews: 45,
    lastReviewDate: '2024-01-10',
    trend: 'down',
    historicalRatings: [
      { month: 'Oct', overall: 4.5 },
      { month: 'Nov', overall: 4.4 },
      { month: 'Dec', overall: 4.3 },
      { month: 'Jan', overall: 4.2 },
    ],
  },
  {
    id: '4',
    vendorId: '4',
    vendorName: 'CleanPro Services',
    category: 'Services',
    overallRating: 2.8,
    criteria: { deliveryTime: 2.5, quality: 3.0, price: 3.5, service: 2.2 },
    totalReviews: 12,
    lastReviewDate: '2023-12-05',
    trend: 'down',
    historicalRatings: [
      { month: 'Oct', overall: 3.5 },
      { month: 'Nov', overall: 3.2 },
      { month: 'Dec', overall: 3.0 },
      { month: 'Jan', overall: 2.8 },
    ],
  },
  {
    id: '5',
    vendorId: '5',
    vendorName: 'Lab Consumables Ltd',
    category: 'Consumables',
    overallRating: 4.6,
    criteria: { deliveryTime: 4.7, quality: 4.5, price: 4.4, service: 4.8 },
    totalReviews: 89,
    lastReviewDate: '2024-01-16',
    trend: 'up',
    historicalRatings: [
      { month: 'Oct', overall: 4.3 },
      { month: 'Nov', overall: 4.4 },
      { month: 'Dec', overall: 4.5 },
      { month: 'Jan', overall: 4.6 },
    ],
  },
  {
    id: '6',
    vendorId: '6',
    vendorName: 'SurgEquip International',
    category: 'Equipment',
    overallRating: 4.9,
    criteria: { deliveryTime: 5.0, quality: 4.9, price: 4.7, service: 5.0 },
    totalReviews: 34,
    lastReviewDate: '2024-01-18',
    trend: 'up',
    historicalRatings: [
      { month: 'Oct', overall: 4.6 },
      { month: 'Nov', overall: 4.7 },
      { month: 'Dec', overall: 4.8 },
      { month: 'Jan', overall: 4.9 },
    ],
  },
];

const criteriaConfig = {
  deliveryTime: { label: 'Delivery Time', icon: Clock, color: 'text-blue-600' },
  quality: { label: 'Quality', icon: Package, color: 'text-green-600' },
  price: { label: 'Price', icon: DollarSign, color: 'text-purple-600' },
  service: { label: 'Service', icon: HeadphonesIcon, color: 'text-orange-600' },
};

export default function VendorRatingsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorRating | null>(null);
  const [ratingFormData, setRatingFormData] = useState<RatingCriteria>({
    deliveryTime: 5,
    quality: 5,
    price: 5,
    service: 5,
  });

  const categories = useMemo(() => {
    const unique = [...new Set(mockVendorRatings.map((v) => v.category))];
    return unique.sort();
  }, []);

  const filteredVendors = useMemo(() => {
    return mockVendorRatings.filter((vendor) => {
      const matchesSearch = vendor.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || vendor.category === categoryFilter;
      const matchesRating =
        ratingFilter === 'all' ||
        (ratingFilter === '4plus' && vendor.overallRating >= 4) ||
        (ratingFilter === '3to4' && vendor.overallRating >= 3 && vendor.overallRating < 4) ||
        (ratingFilter === 'below3' && vendor.overallRating < 3);
      return matchesSearch && matchesCategory && matchesRating;
    });
  }, [searchQuery, categoryFilter, ratingFilter]);

  const topPerformers = useMemo(() => {
    return [...mockVendorRatings].sort((a, b) => b.overallRating - a.overallRating).slice(0, 3);
  }, []);

  const needsImprovement = useMemo(() => {
    return mockVendorRatings.filter((v) => v.overallRating < 3.5);
  }, []);

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
            <p className="text-xl font-bold text-gray-900 mt-1">{mockVendorRatings.length}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <Star className="w-4 h-4" />
              Avg Rating
            </div>
            <p className="text-xl font-bold text-yellow-700 mt-1">
              {(mockVendorRatings.reduce((sum, v) => sum + v.overallRating, 0) / mockVendorRatings.length).toFixed(1)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Award className="w-4 h-4" />
              Top Rated (4+)
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">
              {mockVendorRatings.filter((v) => v.overallRating >= 4).length}
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

            {filteredVendors.length === 0 && (
              <div className="text-center py-12 text-gray-500 bg-white rounded-lg border">
                <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No vendors found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
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
                  { label: '5 Stars', count: mockVendorRatings.filter((v) => v.overallRating >= 4.5).length },
                  { label: '4 Stars', count: mockVendorRatings.filter((v) => v.overallRating >= 3.5 && v.overallRating < 4.5).length },
                  { label: '3 Stars', count: mockVendorRatings.filter((v) => v.overallRating >= 2.5 && v.overallRating < 3.5).length },
                  { label: '2 Stars', count: mockVendorRatings.filter((v) => v.overallRating >= 1.5 && v.overallRating < 2.5).length },
                  { label: '1 Star', count: mockVendorRatings.filter((v) => v.overallRating < 1.5).length },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-16">{item.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{ width: `${(item.count / mockVendorRatings.length) * 100}%` }}
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
                  {mockVendorRatings.map((v) => (
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
