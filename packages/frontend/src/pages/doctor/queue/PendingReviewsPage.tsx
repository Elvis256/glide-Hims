import { usePermissions } from '../../../components/PermissionGate';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  FlaskConical,
  Image,
  FileText,
  Pen,
  Eye,
  CheckCircle,
  X,
  Clock,
  Filter,
  Loader2,
} from 'lucide-react';
import { labService, type LabOrder } from '../../../services/lab';

type ReviewCategory = 'lab' | 'imaging' | 'referral' | 'notes';

interface PendingReview {
  id: string;
  patientName: string;
  mrn: string;
  category: ReviewCategory;
  type: string;
  dateSubmitted: string;
  priority: 'urgent' | 'routine';
  description: string;
}

const transformLabOrderToReview = (order: LabOrder): PendingReview => {
  const testNames = order.tests.map(t => t.testName || t.name || 'Lab Test').join(', ');
  return {
    id: order.id,
    patientName: order.patient?.fullName || 'Unknown Patient',
    mrn: order.patient?.mrn || order.patientId,
    category: 'lab',
    type: testNames || 'Lab Results',
    dateSubmitted: order.completedAt || order.createdAt,
    priority: order.priority === 'stat' ? 'urgent' : (order.priority || 'routine'),
    description: order.clinicalNotes || 'Lab results ready for review',
  };
};

const categoryConfig: Record<ReviewCategory, { icon: React.ElementType; label: string; bg: string; text: string }> = {
  lab: { icon: FlaskConical, label: 'Lab Results Pending', bg: 'bg-purple-100', text: 'text-purple-700' },
  imaging: { icon: Image, label: 'Imaging Pending', bg: 'bg-blue-100', text: 'text-blue-700' },
  referral: { icon: FileText, label: 'Referral Responses', bg: 'bg-green-100', text: 'text-green-700' },
  notes: { icon: Pen, label: 'Notes to Sign', bg: 'bg-orange-100', text: 'text-orange-700' },
};

type FilterCategory = 'all' | ReviewCategory;

export default function PendingReviewsPage() {
  const { hasPermission } = usePermissions();
  const { data: labOrders = [], isLoading } = useQuery({
    queryKey: ['pendingLabReviews'],
    queryFn: () => labService.orders.list({ status: 'completed' }),
  });

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');

  const reviews = useMemo(() => {
    return labOrders
      .filter(order => !dismissedIds.has(order.id))
      .map(transformLabOrderToReview);
  }, [labOrders, dismissedIds]);

  const categoryCounts = useMemo(() => {
    return {
      all: reviews.length,
      lab: reviews.filter((r) => r.category === 'lab').length,
      imaging: reviews.filter((r) => r.category === 'imaging').length,
      referral: reviews.filter((r) => r.category === 'referral').length,
      notes: reviews.filter((r) => r.category === 'notes').length,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (activeCategory === 'all') return reviews;
    return reviews.filter((r) => r.category === activeCategory);
  }, [reviews, activeCategory]);

  const handleReview = (review: PendingReview) => {
    toast.success(`Opening review for: ${review.patientName} - ${review.type}`);
  };

  const handleSign = (review: PendingReview) => {
    setDismissedIds(prev => new Set(prev).add(review.id));
    toast.success(`Signed: ${review.type} for ${review.patientName}`);
  };

  const handleDismiss = (review: PendingReview) => {
    setDismissedIds(prev => new Set(prev).add(review.id));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Loading pending reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pending Reviews</h1>
            <p className="text-gray-500">{reviews.length} items require your attention</p>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveCategory('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-white text-gray-600 border hover:bg-gray-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          All
          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
            activeCategory === 'all' ? 'bg-gray-600' : 'bg-gray-200'
          }`}>
            {categoryCounts.all}
          </span>
        </button>

        {(Object.entries(categoryConfig) as [ReviewCategory, typeof categoryConfig['lab']][]).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeCategory === key
                  ? `${config.bg} ${config.text}`
                  : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {config.label}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                activeCategory === key ? 'bg-white/50' : 'bg-gray-200'
              }`}>
                {categoryCounts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reviews List */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white rounded-xl shadow-sm border">
          {filteredReviews.length > 0 ? (
            <div className="divide-y">
              {filteredReviews.map((review) => {
                const config = categoryConfig[review.category];
                const Icon = config.icon;

                return (
                  <div
                    key={review.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${config.bg}`}>
                          <Icon className={`w-5 h-5 ${config.text}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium text-gray-900">
                              {review.patientName}
                            </span>
                            <span className="text-sm text-gray-400 font-mono">
                              {review.mrn}
                            </span>
                            {review.priority === 'urgent' && (
                              <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-700">{review.type}</p>
                          <p className="text-sm text-gray-500 mt-1">{review.description}</p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(review.dateSubmitted)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReview(review)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </button>
                        <button
                          onClick={() => handleSign(review)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Sign
                        </button>
                        <button
                          onClick={() => handleDismiss(review)}
                          className="inline-flex items-center gap-1 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center text-gray-500">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-300" />
              <h3 className="text-lg font-medium text-gray-700">All caught up!</h3>
              <p className="text-gray-400 mt-1">No pending reviews in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
