import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Star,
  Clock,
  CheckCircle,
  TrendingUp,
  Calendar,
  Eye,
  FileText,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { hrService, type Appraisal } from '../../services/hr';
import { useAuthStore } from '../../store/auth';
import StarRating from '../../components/StarRating';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  self_review: 'bg-yellow-100 text-yellow-800',
  manager_review: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  acknowledged: 'bg-purple-100 text-purple-800',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  self_review: 'Self Review',
  manager_review: 'Manager Review',
  completed: 'Completed',
  acknowledged: 'Acknowledged',
};

export default function MyAppraisalsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: appraisals = [], isLoading } = useQuery({
    queryKey: ['my-appraisals'],
    queryFn: () => hrService.appraisals.getMyAppraisals(),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => hrService.appraisals.acknowledge(id),
    onSuccess: () => {
      toast.success('Appraisal acknowledged');
      queryClient.invalidateQueries({ queryKey: ['my-appraisals'] });
    },
    onError: () => toast.error('Failed to acknowledge'),
  });

  const filteredAppraisals = appraisals.filter((a: Appraisal) => a.year === selectedYear);
  const completedAppraisals = appraisals.filter((a: Appraisal) =>
    ['completed', 'acknowledged'].includes(a.status) && a.overallRating
  );

  // Build trend data
  const trendData = completedAppraisals
    .sort((a: Appraisal, b: Appraisal) => {
      if (a.year !== b.year) return a.year - b.year;
      const periodOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'annual', 'probation'];
      return periodOrder.indexOf(a.appraisalPeriod) - periodOrder.indexOf(b.appraisalPeriod);
    })
    .map((a: Appraisal) => ({
      period: `${a.appraisalPeriod} ${a.year}`,
      rating: Number(a.overallRating),
    }));

  const pendingAction = filteredAppraisals.filter((a: Appraisal) =>
    a.status === 'draft' || a.status === 'completed'
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Appraisals</h1>
        <p className="text-gray-500">View your performance reviews and submit self-assessments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Appraisals</p>
              <p className="text-2xl font-bold">{appraisals.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Action</p>
              <p className="text-2xl font-bold">{pendingAction.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold">{completedAppraisals.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Latest Rating</p>
              <p className="text-2xl font-bold">
                {completedAppraisals.length > 0
                  ? Number(completedAppraisals[0]?.overallRating).toFixed(1)
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trend Chart */}
      {trendData.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Performance Trend
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 5, fill: '#3b82f6' }}
                name="Overall Rating"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Appraisal List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold">Appraisal Records</h2>
          <select
            className="px-3 py-1.5 border rounded-lg text-sm"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
          </div>
        ) : filteredAppraisals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Star className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No appraisals for {selectedYear}</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredAppraisals.map((appraisal: Appraisal) => (
              <div
                key={appraisal.id}
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                onClick={() => navigate(`/hr/appraisals/${appraisal.id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium">{appraisal.appraisalPeriod} {appraisal.year}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[appraisal.status]}`}>
                      {statusLabels[appraisal.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Reviewer: {appraisal.reviewer?.fullName || '—'}
                    {appraisal.reviewDate && ` • Reviewed: ${new Date(appraisal.reviewDate).toLocaleDateString()}`}
                  </p>
                  {appraisal.overallRating && (
                    <div className="mt-1">
                      <StarRating value={Math.round(Number(appraisal.overallRating))} readonly size="sm" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {appraisal.status === 'draft' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/hr/appraisals/${appraisal.id}`); }}
                      className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-200"
                    >
                      Start Self-Review
                    </button>
                  )}
                  {appraisal.status === 'completed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        acknowledgeMutation.mutate(appraisal.id);
                      }}
                      className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200"
                    >
                      Acknowledge
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
