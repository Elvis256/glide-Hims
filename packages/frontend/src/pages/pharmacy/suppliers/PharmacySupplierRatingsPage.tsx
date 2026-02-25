import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  X,
  Save,
  MessageSquare,
  User,
  Calendar,
  Trash2,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { pharmacyService, type Supplier } from '../../../services/pharmacy';

const STORAGE_KEY = 'glide_supplier_reviews';

interface Review {
  id: string;
  supplierId: string;
  supplierName: string;
  deliveryRating: number;
  qualityRating: number;
  priceRating: number;
  serviceRating: number;
  comment: string;
  reviewer: string;
  createdAt: string;
}

interface SupplierRating {
  id: string;
  supplierName: string;
  overallRating: number;
  deliveryRating: number;
  qualityRating: number;
  priceRating: number;
  serviceRating: number;
  totalReviews: number;
  issuesCount: number;
  lastReview: string;
  isTopSupplier: boolean;
  reviews: Review[];
}

function loadReviews(): Review[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}
function saveReviews(reviews: Review[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
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
  const [reviews, setReviews] = useState<Review[]>(loadReviews);

  // Modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewSupplierId, setReviewSupplierId] = useState<string | null>(null);
  const [reviewSupplierName, setReviewSupplierName] = useState('');
  const [showReviewsListModal, setShowReviewsListModal] = useState(false);
  const [reviewsListSupplierId, setReviewsListSupplierId] = useState<string | null>(null);
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);

  // Review form state
  const [formDelivery, setFormDelivery] = useState(0);
  const [formQuality, setFormQuality] = useState(0);
  const [formPrice, setFormPrice] = useState(0);
  const [formService, setFormService] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [formReviewer, setFormReviewer] = useState('');

  const { data: suppliersData, isLoading } = useQuery({
    queryKey: ['pharmacy', 'suppliers'],
    queryFn: () => pharmacyService.suppliers.list(),
  });

  const suppliers = suppliersData?.data || [];

  // Build ratings from real reviews
  const ratings: SupplierRating[] = useMemo(() => {
    if (!suppliers.length) return [];
    return suppliers.map((s: Supplier) => {
      const supplierReviews = reviews.filter((r) => r.supplierId === s.id);
      const count = supplierReviews.length;
      if (count === 0) {
        return {
          id: s.id,
          supplierName: s.name,
          overallRating: 0,
          deliveryRating: 0,
          qualityRating: 0,
          priceRating: 0,
          serviceRating: 0,
          totalReviews: 0,
          issuesCount: 0,
          lastReview: '—',
          isTopSupplier: false,
          reviews: [],
        };
      }
      const avg = (key: keyof Review) =>
        supplierReviews.reduce((sum, r) => sum + (r[key] as number), 0) / count;
      const del = avg('deliveryRating');
      const qual = avg('qualityRating');
      const price = avg('priceRating');
      const svc = avg('serviceRating');
      const overall = (del + qual + price + svc) / 4;
      // Issues: reviews where any category < 3
      const issues = supplierReviews.filter(
        (r) => r.deliveryRating < 3 || r.qualityRating < 3 || r.priceRating < 3 || r.serviceRating < 3
      );
      const sorted = [...supplierReviews].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return {
        id: s.id,
        supplierName: s.name,
        overallRating: overall,
        deliveryRating: del,
        qualityRating: qual,
        priceRating: price,
        serviceRating: svc,
        totalReviews: count,
        issuesCount: issues.length,
        lastReview: new Date(sorted[0].createdAt).toLocaleDateString(),
        isTopSupplier: overall >= 4.3,
        reviews: sorted,
      };
    });
  }, [suppliers, reviews]);

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
  }, [ratings, searchTerm, sortBy, showTopOnly]);

  const stats = useMemo(() => {
    const rated = ratings.filter((r) => r.totalReviews > 0);
    if (rated.length === 0) return { avgRating: 0, topSuppliers: 0, totalIssues: 0, totalReviews: 0 };
    const avgRating = rated.reduce((sum, r) => sum + r.overallRating, 0) / rated.length;
    const topSuppliers = rated.filter((r) => r.isTopSupplier).length;
    const totalIssues = rated.reduce((sum, r) => sum + r.issuesCount, 0);
    const totalReviews = reviews.length;
    return { avgRating, topSuppliers, totalIssues, totalReviews };
  }, [ratings, reviews]);

  // Historical data from reviews for a supplier
  const getHistoricalData = useCallback((supplierId: string) => {
    const supplierReviews = reviews.filter((r) => r.supplierId === supplierId);
    if (supplierReviews.length === 0) return [];
    const months: Record<string, { total: number; count: number }> = {};
    supplierReviews.forEach((r) => {
      const d = new Date(r.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { total: 0, count: 0 };
      const avg = (r.deliveryRating + r.qualityRating + r.priceRating + r.serviceRating) / 4;
      months[key].total += avg;
      months[key].count += 1;
    });
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, val]) => ({
        month: monthNames[parseInt(key.split('-')[1]) - 1],
        rating: val.total / val.count,
      }));
  }, [reviews]);

  const openReviewModal = (supplierId: string, supplierName: string) => {
    setReviewSupplierId(supplierId);
    setReviewSupplierName(supplierName);
    setFormDelivery(0);
    setFormQuality(0);
    setFormPrice(0);
    setFormService(0);
    setFormComment('');
    setFormReviewer('');
    setShowReviewModal(true);
  };

  const openReviewsList = (supplierId: string, issuesOnly: boolean) => {
    setReviewsListSupplierId(supplierId);
    setShowIssuesOnly(issuesOnly);
    setShowReviewsListModal(true);
  };

  const handleSubmitReview = () => {
    if (!reviewSupplierId) return;
    if (formDelivery === 0 || formQuality === 0 || formPrice === 0 || formService === 0) {
      toast.error('Please rate all 4 categories (click the stars)');
      return;
    }
    if (!formReviewer.trim()) {
      toast.error('Please enter your name');
      return;
    }
    const newReview: Review = {
      id: crypto.randomUUID(),
      supplierId: reviewSupplierId,
      supplierName: reviewSupplierName,
      deliveryRating: formDelivery,
      qualityRating: formQuality,
      priceRating: formPrice,
      serviceRating: formService,
      comment: formComment.trim(),
      reviewer: formReviewer.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...reviews, newReview];
    setReviews(updated);
    saveReviews(updated);
    setShowReviewModal(false);
    toast.success(`Review submitted for ${reviewSupplierName}`);
  };

  const handleDeleteReview = (reviewId: string) => {
    const updated = reviews.filter((r) => r.id !== reviewId);
    setReviews(updated);
    saveReviews(updated);
    toast.success('Review deleted');
  };

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

  const renderClickableStars = (value: number, onChange: (v: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => onChange(i)} className="focus:outline-none">
            <Star className={`w-6 h-6 cursor-pointer transition-colors ${i <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`} />
          </button>
        ))}
      </div>
    );
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-blue-600';
    if (rating >= 3.5) return 'text-yellow-600';
    if (rating > 0) return 'text-red-600';
    return 'text-gray-400';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Ratings</h1>
          <p className="text-gray-500">Performance ratings and historical trends</p>
        </div>
        <button
          onClick={() => {
            if (suppliers.length === 0) { toast.error('No suppliers to rate'); return; }
            openReviewModal(suppliers[0].id, suppliers[0].name);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
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
              <p className="text-2xl font-bold text-gray-900">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}</p>
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
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReviews}</p>
              <p className="text-sm text-gray-500">Total Reviews</p>
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
                    <p className="text-gray-500 text-sm">Click "Rate Supplier" or "Add Review" to submit the first review</p>
                  </div>
                </div>
              </div>
            ) : (
              filteredRatings.map((rating) => {
                const historicalData = getHistoricalData(rating.id);
                return (
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
                        {rating.totalReviews > 0 ? (
                          <>
                            <div className="flex items-center">{renderStars(rating.overallRating)}</div>
                            <span className={`font-medium ${getRatingColor(rating.overallRating)}`}>
                              {rating.overallRating.toFixed(1)}
                            </span>
                            <span className="text-gray-400">|</span>
                            <span className="text-sm text-gray-500">{rating.totalReviews} review{rating.totalReviews !== 1 ? 's' : ''}</span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 italic">No reviews yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {rating.issuesCount > 0 && (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {rating.issuesCount} issue{rating.issuesCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {expandedSupplier === rating.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedSupplier === rating.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {rating.totalReviews > 0 ? (
                      <>
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
                        {historicalData.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-3">
                              <BarChart3 className="w-4 h-4 text-gray-600" />
                              <span className="text-sm font-medium text-gray-700">Rating by Month</span>
                            </div>
                            <div className="flex items-end gap-2 h-20">
                              {historicalData.map((h, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center">
                                  <span className="text-xs text-gray-600 mb-1">{h.rating.toFixed(1)}</span>
                                  <div
                                    className="w-full bg-blue-500 rounded-t"
                                    style={{ height: `${(h.rating / 5) * 100}%` }}
                                  />
                                  <span className="text-xs text-gray-500 mt-1">{h.month}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <Star className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No reviews yet. Be the first to review this supplier.</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      {rating.totalReviews > 0 ? (
                        <span className="text-sm text-gray-500">Last review: {rating.lastReview}</span>
                      ) : <span />}
                      <div className="flex gap-2">
                        {rating.totalReviews > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openReviewsList(rating.id, false); }}
                            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            View All Reviews
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openReviewModal(rating.id, rating.supplierName); }}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                        >
                          Add Review
                        </button>
                        {rating.issuesCount > 0 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openReviewsList(rating.id, true); }}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                          >
                            <Flag className="w-3 h-3" /> View Issues
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Add Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add Review</h2>
                <p className="text-sm text-gray-500">{reviewSupplierName}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Supplier selector if opened from header button */}
              {suppliers.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select
                    value={reviewSupplierId || ''}
                    onChange={(e) => {
                      const s = suppliers.find((sup: Supplier) => sup.id === e.target.value);
                      if (s) { setReviewSupplierId(s.id); setReviewSupplierName(s.name); }
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {suppliers.map((s: Supplier) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Truck className="w-4 h-4 inline mr-1" /> Delivery {formDelivery > 0 && `(${formDelivery}/5)`}
                </label>
                {renderClickableStars(formDelivery, setFormDelivery)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Package className="w-4 h-4 inline mr-1" /> Quality {formQuality > 0 && `(${formQuality}/5)`}
                </label>
                {renderClickableStars(formQuality, setFormQuality)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" /> Price {formPrice > 0 && `(${formPrice}/5)`}
                </label>
                {renderClickableStars(formPrice, setFormPrice)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Headphones className="w-4 h-4 inline mr-1" /> Service {formService > 0 && `(${formService}/5)`}
                </label>
                {renderClickableStars(formService, setFormService)}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  value={formReviewer}
                  onChange={(e) => setFormReviewer(e.target.value)}
                  placeholder="e.g. Dr. Elvis"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
                <textarea
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  rows={3}
                  placeholder="Share your experience with this supplier..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Reviews / Issues Modal */}
      {showReviewsListModal && reviewsListSupplierId && (() => {
        const supplierRating = ratings.find((r) => r.id === reviewsListSupplierId);
        if (!supplierRating) return null;
        let displayReviews = supplierRating.reviews;
        if (showIssuesOnly) {
          displayReviews = displayReviews.filter(
            (r) => r.deliveryRating < 3 || r.qualityRating < 3 || r.priceRating < 3 || r.serviceRating < 3
          );
        }
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {showIssuesOnly ? 'Issues' : 'All Reviews'} — {supplierRating.supplierName}
                  </h2>
                  <p className="text-sm text-gray-500">{displayReviews.length} {showIssuesOnly ? 'issue' : 'review'}{displayReviews.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setShowReviewsListModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                {displayReviews.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No {showIssuesOnly ? 'issues' : 'reviews'} found</p>
                ) : (
                  <div className="space-y-4">
                    {displayReviews.map((review) => {
                      const avg = (review.deliveryRating + review.qualityRating + review.priceRating + review.serviceRating) / 4;
                      return (
                        <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="font-medium text-gray-900">{review.reviewer}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {renderStars(avg, 'w-3 h-3')}
                                <span className={`text-sm font-medium ${getRatingColor(avg)}`}>{avg.toFixed(1)}</span>
                              </div>
                              <button
                                onClick={() => handleDeleteReview(review.id)}
                                className="p-1 hover:bg-red-100 rounded transition-colors"
                                title="Delete review"
                              >
                                <Trash2 className="w-3 h-3 text-red-400" />
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                            <span className={review.deliveryRating < 3 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              Delivery: {review.deliveryRating}/5
                            </span>
                            <span className={review.qualityRating < 3 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              Quality: {review.qualityRating}/5
                            </span>
                            <span className={review.priceRating < 3 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              Price: {review.priceRating}/5
                            </span>
                            <span className={review.serviceRating < 3 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              Service: {review.serviceRating}/5
                            </span>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-gray-700 mt-2 italic">"{review.comment}"</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
                <button onClick={() => setShowReviewsListModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Close
                </button>
                <button
                  onClick={() => { setShowReviewsListModal(false); openReviewModal(reviewsListSupplierId, supplierRating.supplierName); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Star className="w-4 h-4" />
                  Add Review
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
