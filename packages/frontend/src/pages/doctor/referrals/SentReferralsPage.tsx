import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  Send,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  X,
  User,
  Calendar,
  Building2,
  FileText,
  MessageSquare,
  RotateCcw,
  Eye,
  Loader2,
} from 'lucide-react';
import { referralsService, type Referral as ApiReferral, type ReferralStatus as ApiStatus, type ReferralPriority } from '../../../services/referrals';

type ReferralStatus = 'pending' | 'accepted' | 'declined' | 'completed';
type UrgencyLevel = 'routine' | 'urgent' | 'emergency';

interface Referral {
  id: string;
  patient: {
    name: string;
    mrn: string;
    age: number;
    gender: string;
  };
  referredTo: {
    name: string;
    department: string;
    facility: string;
    isExternal: boolean;
  };
  date: string;
  status: ReferralStatus;
  urgency: UrgencyLevel;
  reason: string;
  clinicalSummary: string;
  attachments: number;
  preferredDate?: string;
  response?: {
    date: string;
    message: string;
    appointmentDate?: string;
  };
}

// Transform API referral to local UI format
function transformReferral(apiReferral: ApiReferral): Referral {
  const statusMap: Record<ApiStatus, ReferralStatus> = {
    pending: 'pending',
    accepted: 'accepted',
    rejected: 'declined',
    completed: 'completed',
    cancelled: 'declined',
    expired: 'declined',
  };

  const urgencyMap: Record<ReferralPriority, UrgencyLevel> = {
    routine: 'routine',
    urgent: 'urgent',
    emergency: 'emergency',
  };

  // Calculate age from date of birth
  const calculateAge = (dob?: string): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const isExternal = apiReferral.type === 'external';
  const facilityName = isExternal
    ? apiReferral.externalFacilityName || 'External Facility'
    : apiReferral.toFacility?.name || 'Unknown Facility';

  return {
    id: apiReferral.id,
    patient: {
      name: apiReferral.patient?.fullName || 'Unknown Patient',
      mrn: apiReferral.patient?.mrn || '',
      age: calculateAge(apiReferral.patient?.dateOfBirth),
      gender: apiReferral.patient?.gender || 'Unknown',
    },
    referredTo: {
      name: apiReferral.referredToSpecialty || apiReferral.referredToDepartment || 'Specialist',
      department: apiReferral.referredToDepartment || '',
      facility: facilityName,
      isExternal,
    },
    date: apiReferral.createdAt.split('T')[0],
    status: statusMap[apiReferral.status] || 'pending',
    urgency: urgencyMap[apiReferral.priority] || 'routine',
    reason: apiReferral.reasonDetails || apiReferral.reason || '',
    clinicalSummary: apiReferral.clinicalSummary || '',
    attachments: 0,
    preferredDate: apiReferral.appointmentDate?.split('T')[0],
    response: apiReferral.acceptedAt || apiReferral.feedbackNotes || apiReferral.rejectionReason
      ? {
          date: (apiReferral.acceptedAt || apiReferral.completedAt || '')?.split('T')[0] || '',
          message: apiReferral.feedbackNotes || apiReferral.rejectionReason || '',
          appointmentDate: apiReferral.appointmentDate?.split('T')[0],
        }
      : undefined,
  };
}

const statusConfig: Record<ReferralStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
};

const urgencyConfig: Record<UrgencyLevel, { label: string; color: string }> = {
  routine: { label: 'Routine', color: 'bg-gray-100 text-gray-600' },
  urgent: { label: 'Urgent', color: 'bg-amber-100 text-amber-700' },
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-700' },
};

export default function SentReferralsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [responseModal, setResponseModal] = useState<Referral | null>(null);

  // Fetch outgoing referrals from API
  const { data: apiReferrals = [], isLoading, refetch } = useQuery({
    queryKey: ['referrals', 'outgoing'],
    queryFn: referralsService.getOutgoing,
  });

  // Transform API data to local format
  const referrals = useMemo(() => {
    return apiReferrals.map(transformReferral);
  }, [apiReferrals]);

  const filteredReferrals = useMemo(() => {
    return referrals.filter((referral) => {
      const matchesSearch =
        searchQuery === '' ||
        referral.patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        referral.patient.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        referral.referredTo.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || referral.status === statusFilter;

      const matchesDateFrom = !dateFrom || referral.date >= dateFrom;
      const matchesDateTo = !dateTo || referral.date <= dateTo;

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [referrals, searchQuery, statusFilter, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    return referrals.reduce(
      (acc, ref) => {
        acc[ref.status]++;
        return acc;
      },
      { pending: 0, accepted: 0, declined: 0, completed: 0 } as Record<ReferralStatus, number>
    );
  }, [referrals]);

  const handleResend = (referral: Referral) => {
    toast.success(`Referral for ${referral.patient.name} would be resent.`);
  };

  const handleCancel = (referral: Referral) => {
    if (confirm(`Are you sure you want to cancel the referral for ${referral.patient.name}?`)) {
      toast.success('Referral cancelled.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-500">Loading referrals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Send className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Sent Referrals</h1>
              <p className="text-sm text-gray-500">Track and manage your referrals</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Status Summary */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                {statusCounts.pending} Pending
              </span>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {statusCounts.accepted} Accepted
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, MRN, or doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReferralStatus | 'all')}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="completed">Completed</option>
          </select>

          {/* More Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Refresh */}
          <button onClick={() => refetch()} className="p-2 border rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {(dateFrom || dateTo || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setStatusFilter('all');
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Referrals List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredReferrals.length === 0 ? (
          <div className="text-center py-12">
            <Send className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No referrals found</h3>
            <p className="text-gray-500">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReferrals.map((referral) => {
              const isExpanded = expandedId === referral.id;
              const StatusIcon = statusConfig[referral.status].icon;

              return (
                <div key={referral.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                  {/* Main Row */}
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedId(isExpanded ? null : referral.id)}
                  >
                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{referral.patient.name}</span>
                        <span className="text-sm text-gray-500">({referral.patient.mrn})</span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {referral.patient.age}y {referral.patient.gender}
                      </div>
                    </div>

                    {/* Referred To */}
                    <div className="w-48">
                      <div className="font-medium text-gray-900 text-sm">{referral.referredTo.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {referral.referredTo.department}
                        {referral.referredTo.isExternal && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs ml-1">
                            External
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="w-24 text-center">
                      <div className="text-sm text-gray-900">{referral.date}</div>
                      <div className="text-xs text-gray-500">Sent</div>
                    </div>

                    {/* Urgency */}
                    <div className="w-24">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                          urgencyConfig[referral.urgency].color
                        }`}
                      >
                        {urgencyConfig[referral.urgency].label}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="w-28">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          statusConfig[referral.status].color
                        }`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusConfig[referral.status].label}
                      </span>
                    </div>

                    {/* Expand Icon */}
                    <div className="w-6">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Reason for Referral</h4>
                            <p className="text-sm text-gray-600">{referral.reason}</p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-1">Clinical Summary</h4>
                            <p className="text-sm text-gray-600">{referral.clinicalSummary}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-gray-500">
                              <FileText className="w-4 h-4" />
                              {referral.attachments} attachment{referral.attachments !== 1 ? 's' : ''}
                            </div>
                            {referral.preferredDate && (
                              <div className="flex items-center gap-1 text-gray-500">
                                <Calendar className="w-4 h-4" />
                                Preferred: {referral.preferredDate}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Column - Response or Actions */}
                        <div>
                          {referral.response ? (
                            <div className="bg-white p-4 rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                  <MessageSquare className="w-4 h-4" />
                                  Response
                                </h4>
                                <span className="text-xs text-gray-500">{referral.response.date}</span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{referral.response.message}</p>
                              {referral.response.appointmentDate && (
                                <div className="flex items-center gap-1 text-sm text-green-600">
                                  <Calendar className="w-4 h-4" />
                                  Appointment: {referral.response.appointmentDate}
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setResponseModal(referral);
                                }}
                                className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                              >
                                <Eye className="w-4 h-4" />
                                View Full Response
                              </button>
                            </div>
                          ) : (
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                              <div className="flex items-center gap-2 text-yellow-700 mb-2">
                                <Clock className="w-4 h-4" />
                                <span className="text-sm font-medium">Awaiting Response</span>
                              </div>
                              <p className="text-sm text-yellow-600">
                                The receiving doctor has not yet responded to this referral.
                              </p>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2 mt-4">
                            {referral.status === 'pending' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancel(referral);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm"
                                >
                                  <X className="w-4 h-4" />
                                  Cancel
                                </button>
                              </>
                            )}
                            {referral.status === 'declined' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResend(referral);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                              >
                                <RotateCcw className="w-4 h-4" />
                                Resend Referral
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Response Modal */}
      {responseModal && responseModal.response && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg m-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Referral Response</h2>
              <button
                onClick={() => setResponseModal(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="text-sm text-gray-500">Patient</div>
                <div className="font-medium">{responseModal.patient.name}</div>
              </div>
              <div className="mb-4">
                <div className="text-sm text-gray-500">Referred To</div>
                <div className="font-medium">{responseModal.referredTo.name}</div>
                <div className="text-sm text-gray-500">{responseModal.referredTo.department}</div>
              </div>
              <div className="mb-4">
                <div className="text-sm text-gray-500">Response Date</div>
                <div className="font-medium">{responseModal.response.date}</div>
              </div>
              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-1">Message</div>
                <div className="p-3 bg-gray-50 rounded-lg text-sm">{responseModal.response.message}</div>
              </div>
              {responseModal.response.appointmentDate && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-sm font-medium text-green-800">Appointment Scheduled</div>
                    <div className="text-sm text-green-700">{responseModal.response.appointmentDate}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={() => setResponseModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
