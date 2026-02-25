import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Loader2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { labService, type LabOrder } from '../../../services/lab';
import { radiologyService, type ImagingOrder } from '../../../services/radiology';
import { referralsService, type Referral } from '../../../services/referrals';
import { encountersService, type Encounter } from '../../../services/encounters';
import { useFacilityId } from '../../../lib/facility';

type ReviewCategory = 'lab' | 'imaging' | 'referral' | 'notes';

interface PendingReview {
  id: string;
  patientId?: string;
  patientName: string;
  mrn: string;
  category: ReviewCategory;
  type: string;
  dateSubmitted: string;
  priority: 'urgent' | 'routine';
  description: string;
  navigateTo?: string;
}

// Helper to safely extract department name (may be string or object)
const getDeptName = (dept: any): string => {
  if (!dept) return 'General';
  if (typeof dept === 'string') return dept;
  if (typeof dept === 'object' && dept.name) return dept.name;
  return 'General';
};

// Parse encounter notes JSON to extract chief complaint
const parseEncounterDescription = (encounter: Encounter): string => {
  if (encounter.chiefComplaint && encounter.chiefComplaint !== 'Preferred doctor:') {
    return encounter.chiefComplaint;
  }
  if (encounter.notes) {
    try {
      const parsed = JSON.parse(encounter.notes);
      if (parsed.hpi && typeof parsed.hpi === 'string' && parsed.hpi.length > 0) {
        return parsed.hpi.substring(0, 120);
      }
      if (parsed.assessment) return String(parsed.assessment).substring(0, 120);
    } catch {
      // notes is plain text
      return encounter.notes.substring(0, 120);
    }
  }
  return 'Encounter note ready for review';
};

const transformImagingOrderToReview = (order: ImagingOrder): PendingReview => {
  const modalityName = typeof order.modality === 'string'
    ? order.modality
    : order.modality?.modalityType || 'Imaging';
  return {
    id: order.id,
    patientId: order.patientId,
    patientName: order.patient?.fullName || 'Unknown Patient',
    mrn: order.patient?.mrn || order.patientId,
    category: 'imaging',
    type: `${modalityName.toUpperCase()} — ${order.studyType}`,
    dateSubmitted: order.performedAt || order.completedAt || order.createdAt,
    priority: order.priority === 'stat' ? 'urgent' : (order.priority || 'routine'),
    description: order.clinicalHistory || order.clinicalIndication || 'Imaging study ready for review',
    navigateTo: '/radiology/orders',
  };
};

const transformReferralToReview = (referral: Referral): PendingReview => ({
  id: referral.id,
  patientName: referral.patient?.fullName || 'Unknown Patient',
  mrn: referral.patient?.mrn || referral.patientId,
  category: 'referral',
  type: `From: ${referral.fromFacility?.name || referral.externalFacilityName || 'Unknown Facility'}`,
  dateSubmitted: referral.createdAt,
  priority: referral.priority === 'emergency' || referral.priority === 'urgent' ? 'urgent' : 'routine',
  description: referral.reason || referral.clinicalSummary || 'Referral response pending review',
});

const transformEncounterToReview = (encounter: Encounter): PendingReview => ({
  id: encounter.id,
  patientId: encounter.patientId,
  patientName: encounter.patient?.fullName || 'Unknown Patient',
  mrn: encounter.patient?.mrn || encounter.patientId,
  category: 'notes',
  type: `${(encounter.type || 'OPD').toUpperCase()} — ${getDeptName(encounter.department)}`,
  dateSubmitted: encounter.visitDate || encounter.createdAt || new Date().toISOString(),
  priority: 'routine',
  description: parseEncounterDescription(encounter),
});

const transformLabOrderToReview = (order: LabOrder): PendingReview => {
  const testNames = (order.tests || []).map(t => t.testName || t.name || 'Lab Test').join(', ');
  return {
    id: order.id,
    patientId: order.patientId,
    patientName: order.patient?.fullName || 'Unknown Patient',
    mrn: order.patient?.mrn || order.patientId,
    category: 'lab',
    type: testNames || 'Lab Results',
    dateSubmitted: order.completedAt || order.createdAt,
    priority: order.priority === 'stat' ? 'urgent' : (order.priority || 'routine'),
    description: order.clinicalNotes || 'Lab results ready for review',
    navigateTo: order.patientId ? `/doctor/results?patientId=${order.patientId}` : '/doctor/results',
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
  const facilityId = useFacilityId();
  const navigate = useNavigate();

  const { data: labOrders = [], isLoading: isLoadingLab } = useQuery({
    queryKey: ['pendingLabReviews'],
    queryFn: () => labService.orders.list({ status: 'completed' }),
  });

  const { data: imagingOrders = [], isLoading: isLoadingImaging } = useQuery({
    queryKey: ['pendingImagingReviews', facilityId],
    queryFn: () => radiologyService.orders.getPendingReports(facilityId),
    enabled: !!facilityId,
  });

  const { data: incomingReferrals = [], isLoading: isLoadingReferrals } = useQuery({
    queryKey: ['pendingReferralReviews'],
    queryFn: () => referralsService.getIncoming(),
  });

  const { data: completedEncounters = [], isLoading: isLoadingEncounters } = useQuery({
    queryKey: ['pendingNotesToSign'],
    queryFn: async () => {
      const result = await encountersService.list({ status: 'completed' });
      return result.data || [];
    },
  });

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('all');

  const reviews = useMemo(() => {
    const labReviews = labOrders
      .filter(order => !dismissedIds.has(order.id))
      .map(transformLabOrderToReview);
    const imgReviews = imagingOrders
      .filter(order => !dismissedIds.has(order.id))
      .map(transformImagingOrderToReview);
    const refReviews = incomingReferrals
      .filter(r => !dismissedIds.has(r.id))
      .map(transformReferralToReview);
    const noteReviews = completedEncounters
      .filter(e => !dismissedIds.has(e.id))
      .map(transformEncounterToReview);
    return [...labReviews, ...imgReviews, ...refReviews, ...noteReviews];
  }, [labOrders, imagingOrders, incomingReferrals, completedEncounters, dismissedIds]);

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
    if (review.navigateTo) {
      navigate(review.navigateTo);
    } else {
      toast.info(`Opening review for: ${review.patientName} — ${review.type}`);
    }
  };

  const handleSign = (review: PendingReview) => {
    setDismissedIds(prev => new Set(prev).add(review.id));
    toast.success(`Signed: ${review.type} for ${review.patientName}`);
  };

  const handleDismiss = (review: PendingReview) => {
    setDismissedIds(prev => new Set(prev).add(review.id));
  };

  const handleAcceptReferral = (review: PendingReview) => {
    setDismissedIds(prev => new Set(prev).add(review.id));
    toast.success(`Accepted referral for ${review.patientName}`);
  };

  const handleRejectReferral = (review: PendingReview) => {
    referralsService.cancel(review.id, 'Rejected by receiving physician')
      .then(() => {
        setDismissedIds(prev => new Set(prev).add(review.id));
        toast.success(`Rejected referral for ${review.patientName}`);
      })
      .catch(() => toast.error('Failed to reject referral'));
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

  const isLoading = isLoadingLab || isLoadingImaging || isLoadingReferrals || isLoadingEncounters;

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
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pending Reviews</h1>
            <p className="text-sm text-gray-500">
              {reviews.length > 0
                ? `${reviews.length} item${reviews.length !== 1 ? 's' : ''} require your attention`
                : 'No items need review'}
            </p>
          </div>
        </div>
        {reviews.some(r => r.priority === 'urgent') && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
            <Zap className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">
              {reviews.filter(r => r.priority === 'urgent').length} urgent
            </span>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {([
          { key: 'lab' as ReviewCategory, icon: FlaskConical, label: 'Lab Results', bgActive: 'bg-purple-50 border-purple-300 ring-2 ring-purple-200', iconBg: 'bg-purple-100', iconColor: 'text-purple-600', countColor: 'text-purple-700' },
          { key: 'imaging' as ReviewCategory, icon: Image, label: 'Imaging', bgActive: 'bg-blue-50 border-blue-300 ring-2 ring-blue-200', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', countColor: 'text-blue-700' },
          { key: 'referral' as ReviewCategory, icon: FileText, label: 'Referrals', bgActive: 'bg-green-50 border-green-300 ring-2 ring-green-200', iconBg: 'bg-green-100', iconColor: 'text-green-600', countColor: 'text-green-700' },
          { key: 'notes' as ReviewCategory, icon: Pen, label: 'Notes to Sign', bgActive: 'bg-orange-50 border-orange-300 ring-2 ring-orange-200', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', countColor: 'text-orange-700' },
        ] as const).map(({ key, icon: Icon, label, bgActive, iconBg, iconColor, countColor }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(activeCategory === key ? 'all' : key)}
            className={`p-3.5 rounded-xl border transition-all text-left ${
              activeCategory === key
                ? bgActive
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`p-1.5 rounded-lg ${iconBg}`}>
                <Icon className={`w-4 h-4 ${iconColor}`} />
              </div>
              <span className={`text-2xl font-bold ${categoryCounts[key] > 0 ? countColor : 'text-gray-300'}`}>
                {categoryCounts[key]}
              </span>
            </div>
            <p className="text-xs font-medium text-gray-600 mt-2">{label}</p>
          </button>
        ))}
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeCategory === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All ({categoryCounts.all})
        </button>
        {(Object.entries(categoryConfig) as [ReviewCategory, typeof categoryConfig['lab']][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(activeCategory === key ? 'all' : key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === key
                ? `${config.bg} ${config.text}`
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {config.label} ({categoryCounts[key]})
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div className="flex-1 overflow-auto">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {filteredReviews.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredReviews.map((review) => {
                const config = categoryConfig[review.category];
                const Icon = config.icon;

                return (
                  <div
                    key={`${review.category}-${review.id}`}
                    className={`p-4 hover:bg-gray-50/80 transition-colors ${
                      review.priority === 'urgent' ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className={`p-2.5 rounded-xl ${config.bg} flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${config.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {review.patientName.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-900">
                                {review.patientName}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400 font-mono">
                              {review.mrn}
                            </span>
                            {review.priority === 'urgent' && (
                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" />
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-800 text-sm">{review.type}</p>
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{review.description}</p>
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(review.dateSubmitted)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {review.category === 'referral' ? (
                          <>
                            <button
                              onClick={() => handleAcceptReferral(review)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Accept
                            </button>
                            <button
                              onClick={() => handleRejectReferral(review)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleReview(review)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                              <Eye className="w-4 h-4" />
                              {review.category === 'imaging' ? 'View Study' : review.category === 'lab' ? 'View Results' : 'Review'}
                            </button>
                            <button
                              onClick={() => handleSign(review)}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {review.category === 'imaging' ? 'Acknowledge' : review.category === 'notes' ? 'Sign Note' : 'Mark Reviewed'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDismiss(review)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700">All caught up!</h3>
              <p className="text-gray-400 mt-1 text-sm">
                {activeCategory === 'all'
                  ? 'No pending reviews at this time'
                  : `No pending ${categoryConfig[activeCategory as ReviewCategory]?.label.toLowerCase() || 'reviews'}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
