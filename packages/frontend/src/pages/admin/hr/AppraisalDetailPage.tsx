import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Star,
  User,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Target,
  TrendingUp,
  AlertCircle,
  Loader2,
  Printer,
  Trash2,
} from 'lucide-react';
import { hrService, type Appraisal, type SubmitSelfReviewDto, type SubmitManagerReviewDto } from '../../../services/hr';
import StarRating from '../../../components/StarRating';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const RATING_CATEGORIES = [
  { key: 'jobKnowledgeRating', label: 'Job Knowledge', description: 'Understanding of job duties and responsibilities' },
  { key: 'workQualityRating', label: 'Work Quality', description: 'Accuracy, thoroughness, and reliability of work output' },
  { key: 'attendanceRating', label: 'Attendance & Punctuality', description: 'Regularity and timeliness' },
  { key: 'communicationRating', label: 'Communication', description: 'Clarity and effectiveness of communication' },
  { key: 'teamworkRating', label: 'Teamwork', description: 'Cooperation and contribution to team goals' },
  { key: 'initiativeRating', label: 'Initiative', description: 'Proactiveness and willingness to take on challenges' },
] as const;

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; label: string; icon: typeof Clock }> = {
  draft: { color: 'text-gray-700', bgColor: 'bg-gray-100', label: 'Draft', icon: FileText },
  self_review: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', label: 'Self Review', icon: User },
  manager_review: { color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'Manager Review', icon: Star },
  completed: { color: 'text-green-700', bgColor: 'bg-green-100', label: 'Completed', icon: CheckCircle },
  acknowledged: { color: 'text-purple-700', bgColor: 'bg-purple-100', label: 'Acknowledged', icon: CheckCircle },
};

const STATUS_STEPS = ['draft', 'self_review', 'manager_review', 'completed', 'acknowledged'];

export default function AppraisalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'self-review' | 'manager-review'>('view');

  // Self-review form state
  const [selfReview, setSelfReview] = useState<SubmitSelfReviewDto>({});
  // Manager review form state
  const [managerReview, setManagerReview] = useState<SubmitManagerReviewDto>({
    jobKnowledgeRating: 0,
    workQualityRating: 0,
    attendanceRating: 0,
    communicationRating: 0,
    teamworkRating: 0,
    initiativeRating: 0,
  });

  const { data: appraisal, isLoading, error } = useQuery({
    queryKey: ['appraisal', id],
    queryFn: () => hrService.appraisals.getById(id!),
    enabled: !!id,
  });

  const submitSelfReviewMutation = useMutation({
    mutationFn: (data: SubmitSelfReviewDto) => hrService.appraisals.submitSelfReview(id!, data),
    onSuccess: () => {
      toast.success('Self-review submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['appraisal', id] });
      setMode('view');
    },
    onError: () => toast.error('Failed to submit self-review'),
  });

  const submitManagerReviewMutation = useMutation({
    mutationFn: (data: SubmitManagerReviewDto) => hrService.appraisals.submitManagerReview(id!, data),
    onSuccess: () => {
      toast.success('Manager review submitted — appraisal completed');
      queryClient.invalidateQueries({ queryKey: ['appraisal', id] });
      setMode('view');
    },
    onError: () => toast.error('Failed to submit manager review'),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => hrService.appraisals.acknowledge(id!),
    onSuccess: () => {
      toast.success('Appraisal acknowledged');
      queryClient.invalidateQueries({ queryKey: ['appraisal', id] });
    },
    onError: () => toast.error('Failed to acknowledge appraisal'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => hrService.appraisals.delete(id!),
    onSuccess: () => {
      toast.success('Appraisal deleted');
      navigate('/hr/appraisals');
    },
    onError: () => toast.error('Only draft appraisals can be deleted'),
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !appraisal) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-2" />
        <p className="text-gray-600">Appraisal not found</p>
        <button onClick={() => navigate('/hr/appraisals')} className="mt-4 text-blue-600 hover:underline">
          Back to Appraisals
        </button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[appraisal.status] || STATUS_CONFIG.draft;
  const currentStepIndex = STATUS_STEPS.indexOf(appraisal.status);

  const ratingBarWidth = (rating: number | undefined) => {
    if (!rating) return 0;
    return (Number(rating) / 5) * 100;
  };

  const ratingColor = (rating: number | undefined) => {
    if (!rating) return 'bg-gray-200';
    const r = Number(rating);
    if (r >= 4) return 'bg-green-500';
    if (r >= 3) return 'bg-yellow-500';
    if (r >= 2) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/hr/appraisals')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Appraisal</h1>
            <p className="text-gray-500">{appraisal.appraisalPeriod} {appraisal.year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {appraisal.status === 'draft' && (
            <>
              <button
                onClick={() => setMode('self-review')}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
              >
                Start Self-Review
              </button>
              <button
                onClick={() => setMode('manager-review')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Manager Review
              </button>
              <button
                onClick={() => { if (confirm('Delete this draft appraisal?')) deleteMutation.mutate(); }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                title="Delete Draft"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          {appraisal.status === 'self_review' && (
            <button
              onClick={() => setMode('manager-review')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Submit Manager Review
            </button>
          )}
          {appraisal.status === 'completed' && (
            <button
              onClick={() => acknowledgeMutation.mutate()}
              disabled={acknowledgeMutation.isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {acknowledgeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Acknowledge
            </button>
          )}
          <button onClick={() => window.print()} className="p-2 hover:bg-gray-100 rounded-lg" title="Print">
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between">
          {STATUS_STEPS.map((step, i) => {
            const config = STATUS_CONFIG[step];
            const isActive = i <= currentStepIndex;
            const isCurrent = step === appraisal.status;
            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCurrent ? `${config.bgColor} ${config.color} ring-2 ring-offset-2 ring-current` :
                    isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isActive && i < currentStepIndex ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className={`text-xs mt-1 ${isCurrent ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                    {config.label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${isActive && i < currentStepIndex ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Self-Review Form */}
      {mode === 'self-review' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-yellow-600" />
            Employee Self-Review
          </h2>
          <p className="text-sm text-gray-500 mb-6">Rate your own performance for each category (optional). Add comments and goals.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {RATING_CATEGORIES.map(({ key, label, description }) => (
              <div key={key} className="border rounded-lg p-4">
                <StarRating
                  label={label}
                  value={(selfReview as Record<string, number>)[key] || 0}
                  onChange={(val) => setSelfReview({ ...selfReview, [key]: val })}
                />
                <p className="text-xs text-gray-400 mt-1">{description}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee Comments</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                placeholder="Share your thoughts on your performance this period..."
                value={selfReview.employeeComments || ''}
                onChange={(e) => setSelfReview({ ...selfReview, employeeComments: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goals for Next Period</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                placeholder="What goals would you like to achieve in the next period?"
                value={selfReview.goals || ''}
                onChange={(e) => setSelfReview({ ...selfReview, goals: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setMode('view')} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
              Cancel
            </button>
            <button
              onClick={() => submitSelfReviewMutation.mutate(selfReview)}
              disabled={submitSelfReviewMutation.isPending}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {submitSelfReviewMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Self-Review
            </button>
          </div>
        </div>
      )}

      {/* Manager Review Form */}
      {mode === 'manager-review' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-600" />
            Manager Review
          </h2>
          <p className="text-sm text-gray-500 mb-6">Rate employee performance for each category. All ratings are required.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {RATING_CATEGORIES.map(({ key, label, description }) => (
              <div key={key} className="border rounded-lg p-4">
                <StarRating
                  label={`${label} *`}
                  value={(managerReview as Record<string, number>)[key] || 0}
                  onChange={(val) => setManagerReview({ ...managerReview, [key]: val })}
                />
                <p className="text-xs text-gray-400 mt-1">{description}</p>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Comments</label>
              <textarea
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
                placeholder="Overall assessment of the employee's performance..."
                value={managerReview.reviewerComments || ''}
                onChange={(e) => setManagerReview({ ...managerReview, reviewerComments: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strengths</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="Key strengths demonstrated..."
                  value={managerReview.strengths || ''}
                  onChange={(e) => setManagerReview({ ...managerReview, strengths: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Areas for Improvement</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  rows={3}
                  placeholder="Areas that need development..."
                  value={managerReview.areasForImprovement || ''}
                  onChange={(e) => setManagerReview({ ...managerReview, areasForImprovement: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setMode('view')} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
              Cancel
            </button>
            <button
              onClick={() => {
                const allRated = RATING_CATEGORIES.every(({ key }) => (managerReview as Record<string, number>)[key] > 0);
                if (!allRated) { toast.error('Please rate all categories'); return; }
                submitManagerReviewMutation.mutate(managerReview);
              }}
              disabled={submitManagerReviewMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {submitManagerReviewMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Complete Review
            </button>
          </div>
        </div>
      )}

      {/* Main Content - View Mode */}
      {mode === 'view' && (
        <>
          {/* Employee & Reviewer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> Employee
              </h3>
              <p className="font-semibold text-lg">{appraisal.employee?.fullName || '—'}</p>
              <p className="text-sm text-gray-500">{appraisal.employee?.jobTitle || '—'}</p>
              <p className="text-sm text-gray-500">{appraisal.employee?.department || '—'}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                <Star className="w-4 h-4" /> Reviewer
              </h3>
              <p className="font-semibold text-lg">{appraisal.reviewer?.fullName || '—'}</p>
              <p className="text-sm text-gray-500">{appraisal.reviewer?.jobTitle || '—'}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                {appraisal.reviewDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Reviewed: {new Date(appraisal.reviewDate).toLocaleDateString()}
                  </span>
                )}
                {appraisal.acknowledgedDate && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Acknowledged: {new Date(appraisal.acknowledgedDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Overall Rating Card */}
          {appraisal.overallRating && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6 text-center">
              <p className="text-sm font-semibold text-gray-500 uppercase mb-2">Overall Rating</p>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-4xl font-bold text-gray-900">{Number(appraisal.overallRating).toFixed(1)}</span>
                <span className="text-2xl text-gray-400">/ 5.0</span>
              </div>
              <StarRating value={Math.round(Number(appraisal.overallRating))} readonly size="lg" />
            </div>
          )}

          {/* Individual Ratings */}
          {(appraisal.status !== 'draft') && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Performance Ratings
              </h3>
              <div className="space-y-4">
                {RATING_CATEGORIES.map(({ key, label }) => {
                  const rating = appraisal[key as keyof Appraisal] as number | undefined;
                  return (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{label}</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {rating ? Number(rating).toFixed(1) : '—'} / 5.0
                        </span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${ratingColor(rating)}`}
                          style={{ width: `${ratingBarWidth(rating)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Radar Chart */}
          {appraisal.overallRating && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Skills Overview</h3>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={RATING_CATEGORIES.map(({ key, label }) => ({
                  subject: label.split(' ')[0],
                  value: Number(appraisal[key as keyof Appraisal]) || 0,
                  fullMark: 5,
                }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Radar name="Rating" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comments & Feedback */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {appraisal.employeeComments && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" /> Employee Comments
                </h3>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{appraisal.employeeComments}</p>
              </div>
            )}
            {appraisal.reviewerComments && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4" /> Reviewer Comments
                </h3>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{appraisal.reviewerComments}</p>
              </div>
            )}
          </div>

          {/* Strengths, Improvement Areas, Goals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {appraisal.strengths && (
              <div className="bg-green-50 rounded-lg border border-green-200 p-4">
                <h3 className="text-sm font-semibold text-green-700 uppercase mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Strengths
                </h3>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{appraisal.strengths}</p>
              </div>
            )}
            {appraisal.areasForImprovement && (
              <div className="bg-orange-50 rounded-lg border border-orange-200 p-4">
                <h3 className="text-sm font-semibold text-orange-700 uppercase mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Areas for Improvement
                </h3>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{appraisal.areasForImprovement}</p>
              </div>
            )}
            {appraisal.goals && (
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                <h3 className="text-sm font-semibold text-blue-700 uppercase mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Goals
                </h3>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{appraisal.goals}</p>
              </div>
            )}
          </div>

          {/* Empty state when no data yet */}
          {appraisal.status === 'draft' && !appraisal.overallRating && (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">This appraisal is in draft status</p>
              <p className="text-sm text-gray-400 mt-1">Start a self-review or manager review to begin the evaluation process</p>
            </div>
          )}
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          button, .no-print { display: none !important; }
          .shadow-sm { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
