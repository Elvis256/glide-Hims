import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  Search,
  UserPlus,
  Stethoscope,
  TestTube,
  Pill,
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Scan,
  ArrowRight,
  Users,
  Timer,
  Filter,
} from 'lucide-react';
import api from '../services/api';

interface JourneyStep {
  servicePoint: string;
  status: string;
  ticketNumber: string;
  calledAt?: string;
  serviceStartedAt?: string;
  serviceEndedAt?: string;
  waitMinutes?: number;
  serviceMinutes?: number;
}

interface PatientJourney {
  patientId: string;
  patientName: string;
  mrn: string;
  encounterId: string;
  encounterStatus: string;
  encounterType: string;
  currentServicePoint: string;
  currentQueueStatus: string;
  ticketNumber: string;
  priority: number;
  priorityReason?: string;
  visitType: string;
  chiefComplaint?: string;
  registeredAt: string;
  currentStepStartedAt?: string;
  pendingLabOrders: number;
  pendingImagingOrders: number;
  pendingPrescriptions: number;
  invoiceBalance: number;
  journeySteps: JourneyStep[];
}

const SERVICE_POINT_CONFIG: Record<string, { label: string; icon: typeof Activity; color: string; bgColor: string }> = {
  registration: { label: 'Registration', icon: UserPlus, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  triage: { label: 'Triage', icon: Activity, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  consultation: { label: 'Doctor', icon: Stethoscope, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  laboratory: { label: 'Laboratory', icon: TestTube, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  radiology: { label: 'Radiology', icon: Scan, color: 'text-pink-600', bgColor: 'bg-pink-100' },
  pharmacy: { label: 'Pharmacy', icon: Pill, color: 'text-green-600', bgColor: 'bg-green-100' },
  billing: { label: 'Billing', icon: CreditCard, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  cashier: { label: 'Cashier', icon: CreditCard, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  waiting: { label: 'Waiting', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  called: { label: 'Called', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  in_service: { label: 'Being Served', color: 'text-green-700 bg-green-50 border-green-200' },
  completed: { label: 'Done', color: 'text-gray-500 bg-gray-50 border-gray-200' },
  pending_payment: { label: 'Pending Payment', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  skipped: { label: 'Skipped', color: 'text-red-600 bg-red-50 border-red-200' },
  no_show: { label: 'No Show', color: 'text-red-600 bg-red-50 border-red-200' },
  transferred: { label: 'Transferred', color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

const ENCOUNTER_STATUS_LABELS: Record<string, string> = {
  registered: 'Registered',
  triage: 'In Triage',
  waiting: 'Waiting',
  in_consultation: 'With Doctor',
  pending_lab: 'Awaiting Lab',
  pending_pharmacy: 'Awaiting Pharmacy',
  pending_payment: 'Awaiting Payment',
  return_to_doctor: 'Return to Doctor',
  return_to_pharmacy: 'Return to Pharmacy',
  return_to_lab: 'Return to Lab',
  admitted: 'Admitted (IPD)',
  completed: 'Completed',
  discharged: 'Discharged',
  cancelled: 'Cancelled',
};

function formatMinutes(mins: number | undefined | null): string {
  if (!mins && mins !== 0) return '-';
  if (mins < 1) return '<1m';
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getElapsedMinutes(from: string | undefined): number | null {
  if (!from) return null;
  return Math.floor((Date.now() - new Date(from).getTime()) / 60000);
}

function PriorityBadge({ priority, reason }: { priority: number; reason?: string }) {
  if (priority <= 2) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700" title={reason}>
        <AlertTriangle className="w-3 h-3" /> Emergency
      </span>
    );
  }
  if (priority <= 4) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-700" title={reason}>
        Urgent
      </span>
    );
  }
  return null;
}

function JourneyPipeline({ journey }: { journey: PatientJourney }) {
  const standardSteps = ['registration', 'triage', 'consultation', 'laboratory', 'radiology', 'pharmacy', 'billing'];

  // Build visited set from journey steps
  const visited = new Set(journey.journeySteps.map(s => s.servicePoint));
  const completedSteps = new Set(
    journey.journeySteps.filter(s => s.status === 'completed' || s.status === 'transferred').map(s => s.servicePoint)
  );

  // Only show steps that were visited or are the standard flow
  const relevantSteps = standardSteps.filter(sp =>
    visited.has(sp) ||
    sp === 'registration' ||
    sp === journey.currentServicePoint ||
    (sp === 'laboratory' && (journey.pendingLabOrders > 0 || visited.has('laboratory'))) ||
    (sp === 'radiology' && (journey.pendingImagingOrders > 0 || visited.has('radiology'))) ||
    (sp === 'pharmacy' && (journey.pendingPrescriptions > 0 || visited.has('pharmacy'))) ||
    (sp === 'billing' && journey.invoiceBalance > 0)
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      {relevantSteps.map((sp, i) => {
        const config = SERVICE_POINT_CONFIG[sp] || { label: sp, icon: Activity, color: 'text-gray-500', bgColor: 'bg-gray-100' };
        const Icon = config.icon;
        const isCurrent = sp === journey.currentServicePoint;
        const isDone = completedSteps.has(sp);
        const isPending = !isDone && !isCurrent && visited.has(sp);

        return (
          <div key={sp} className="flex items-center gap-1">
            {i > 0 && <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 border ${
                isCurrent
                  ? `${config.bgColor} ${config.color} border-current ring-2 ring-offset-1 ring-blue-300`
                  : isDone
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : isPending
                  ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
              title={isCurrent ? 'Current location' : isDone ? 'Completed' : isPending ? 'Pending' : 'Not visited'}
            >
              {isDone ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <Icon className="w-3 h-3" />
              )}
              {config.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function JourneyDetails({ journey }: { journey: PatientJourney }) {
  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      {/* Pending items summary */}
      <div className="flex flex-wrap gap-3 text-xs">
        {journey.pendingLabOrders > 0 && (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
            <TestTube className="w-3 h-3" /> {journey.pendingLabOrders} pending lab{journey.pendingLabOrders > 1 ? 's' : ''}
          </span>
        )}
        {journey.pendingImagingOrders > 0 && (
          <span className="flex items-center gap-1 px-2 py-1 bg-pink-50 text-pink-700 rounded-full border border-pink-200">
            <Scan className="w-3 h-3" /> {journey.pendingImagingOrders} pending imaging
          </span>
        )}
        {journey.pendingPrescriptions > 0 && (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
            <Pill className="w-3 h-3" /> {journey.pendingPrescriptions} pending Rx
          </span>
        )}
        {journey.invoiceBalance > 0 && (
          <span className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
            <CreditCard className="w-3 h-3" /> UGX {Number(journey.invoiceBalance).toLocaleString()} due
          </span>
        )}
        {journey.pendingLabOrders === 0 && journey.pendingImagingOrders === 0 && journey.pendingPrescriptions === 0 && journey.invoiceBalance <= 0 && (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-full border border-green-200">
            <CheckCircle className="w-3 h-3" /> No pending items
          </span>
        )}
      </div>

      {/* Step-by-step timeline */}
      <div className="space-y-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Journey Timeline</p>
        <div className="space-y-1">
          {journey.journeySteps.map((step, i) => {
            const config = SERVICE_POINT_CONFIG[step.servicePoint] || { label: step.servicePoint, icon: Activity, color: 'text-gray-500', bgColor: 'bg-gray-100' };
            const Icon = config.icon;
            const isDone = step.status === 'completed' || step.status === 'transferred';
            return (
              <div key={i} className="flex items-center gap-3 text-xs">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-100' : config.bgColor}`}>
                  {isDone ? <CheckCircle className="w-3 h-3 text-green-600" /> : <Icon className={`w-3 h-3 ${config.color}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{config.label}</span>
                  <span className="text-gray-400 ml-1">({step.ticketNumber})</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500 flex-shrink-0">
                  {step.waitMinutes != null && (
                    <span title="Wait time">⏳ {formatMinutes(step.waitMinutes)}</span>
                  )}
                  {step.serviceMinutes != null && (
                    <span title="Service time">🔧 {formatMinutes(step.serviceMinutes)}</span>
                  )}
                  {step.serviceStartedAt && (
                    <span className="text-gray-400">
                      {new Date(step.serviceStartedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PatientJourneyPage() {
  const [search, setSearch] = useState('');
  const [filterServicePoint, setFilterServicePoint] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: journeys, isLoading, isError, refetch, isFetching } = useQuery<PatientJourney[]>({
    queryKey: ['patient-journeys'],
    queryFn: async () => {
      const res = await api.get('/queue/journeys');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const filteredJourneys = useMemo(() => {
    if (!journeys) return [];
    let result = journeys;

    // Status filter
    if (filterStatus === 'active') {
      result = result.filter(j => !['completed', 'discharged', 'cancelled'].includes(j.encounterStatus));
    } else if (filterStatus === 'completed') {
      result = result.filter(j => ['completed', 'discharged'].includes(j.encounterStatus));
    }

    // Service point filter
    if (filterServicePoint !== 'all') {
      result = result.filter(j => j.currentServicePoint === filterServicePoint);
    }

    // Search
    if (search.length >= 2) {
      const q = search.toLowerCase();
      result = result.filter(j =>
        j.patientName?.toLowerCase().includes(q) ||
        j.mrn?.toLowerCase().includes(q) ||
        j.ticketNumber?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [journeys, search, filterServicePoint, filterStatus]);

  // Summary stats
  const stats = useMemo(() => {
    if (!journeys) return { active: 0, waiting: 0, inService: 0, completed: 0, pendingPayment: 0 };
    const active = journeys.filter(j => !['completed', 'discharged', 'cancelled'].includes(j.encounterStatus));
    return {
      active: active.length,
      waiting: active.filter(j => j.currentQueueStatus === 'waiting' || j.currentQueueStatus === 'pending_payment').length,
      inService: active.filter(j => j.currentQueueStatus === 'in_service' || j.currentQueueStatus === 'called').length,
      completed: journeys.filter(j => j.encounterStatus === 'completed').length,
      pendingPayment: active.filter(j => j.invoiceBalance > 0).length,
    };
  }, [journeys]);

  // Group by service point for the summary bar
  const servicePointCounts = useMemo(() => {
    if (!journeys) return {};
    const active = journeys.filter(j => !['completed', 'discharged', 'cancelled'].includes(j.encounterStatus));
    const counts: Record<string, number> = {};
    active.forEach(j => {
      counts[j.currentServicePoint] = (counts[j.currentServicePoint] || 0) + 1;
    });
    return counts;
  }, [journeys]);

  return (
    <div className="p-4 md:p-6 space-y-4 bg-gray-50 min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Patient Journey Tracker
          </h1>
          <p className="text-sm text-gray-500">Live view of all patients and their progress through the facility</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
          <p className="text-xs text-gray-500">Active Patients</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.waiting}</p>
          <p className="text-xs text-gray-500">Waiting</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.inService}</p>
          <p className="text-xs text-gray-500">Being Served</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-orange-600">{stats.pendingPayment}</p>
          <p className="text-xs text-gray-500">Pending Payment</p>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-gray-500">{stats.completed}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
      </div>

      {/* Service Point Distribution */}
      {Object.keys(servicePointCounts).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(servicePointCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([sp, count]) => {
              const config = SERVICE_POINT_CONFIG[sp] || { label: sp, icon: Activity, color: 'text-gray-600', bgColor: 'bg-gray-100' };
              const Icon = config.icon;
              return (
                <button
                  key={sp}
                  onClick={() => setFilterServicePoint(filterServicePoint === sp ? 'all' : sp)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filterServicePoint === sp
                      ? `${config.bgColor} ${config.color} border-current`
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                  <span className="font-bold">{count}</span>
                </button>
              );
            })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, MRN, or token..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="active">Active Visits</option>
            <option value="completed">Completed</option>
            <option value="all">All</option>
          </select>
          <select
            value={filterServicePoint}
            onChange={e => setFilterServicePoint(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Departments</option>
            <option value="registration">Registration</option>
            <option value="triage">Triage</option>
            <option value="consultation">Doctor</option>
            <option value="laboratory">Laboratory</option>
            <option value="radiology">Radiology</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="billing">Billing</option>
          </select>
        </div>
      </div>

      {/* Patient Journey List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-500">Loading patient journeys...</span>
        </div>
      ) : isError ? (
        <div className="text-center py-20 text-red-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p>Failed to load journeys. Please try refreshing.</p>
        </div>
      ) : filteredJourneys.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2" />
          <p>{search ? 'No patients match your search' : 'No patients in the system right now'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredJourneys.map(journey => {
            const isExpanded = expandedId === journey.encounterId;
            const spConfig = SERVICE_POINT_CONFIG[journey.currentServicePoint] || { label: journey.currentServicePoint, icon: Activity, color: 'text-gray-600', bgColor: 'bg-gray-100' };
            const SpIcon = spConfig.icon;
            const statusConfig = STATUS_LABELS[journey.currentQueueStatus] || { label: journey.currentQueueStatus, color: 'text-gray-500 bg-gray-50 border-gray-200' };
            const elapsed = getElapsedMinutes(journey.registeredAt);
            const isCompleted = ['completed', 'discharged'].includes(journey.encounterStatus);

            return (
              <div
                key={journey.encounterId}
                className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all ${
                  isCompleted ? 'opacity-60' : ''
                }`}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : journey.encounterId)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                >
                  {/* Service point icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${spConfig.bgColor}`}>
                    <SpIcon className={`w-4 h-4 ${spConfig.color}`} />
                  </div>

                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900 truncate">{journey.patientName}</span>
                      <span className="text-xs text-gray-400 font-mono">{journey.mrn}</span>
                      <PriorityBadge priority={journey.priority} reason={journey.priorityReason} />
                    </div>
                    {/* Pipeline */}
                    <JourneyPipeline journey={journey} />
                  </div>

                  {/* Right side info */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Pending indicators */}
                    <div className="hidden md:flex items-center gap-1.5">
                      {journey.pendingLabOrders > 0 && (
                        <span className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center" title={`${journey.pendingLabOrders} pending labs`}>
                          <TestTube className="w-3 h-3 text-amber-600" />
                        </span>
                      )}
                      {journey.pendingImagingOrders > 0 && (
                        <span className="w-5 h-5 rounded-full bg-pink-100 flex items-center justify-center" title={`${journey.pendingImagingOrders} pending imaging`}>
                          <Scan className="w-3 h-3 text-pink-600" />
                        </span>
                      )}
                      {journey.pendingPrescriptions > 0 && (
                        <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center" title={`${journey.pendingPrescriptions} pending Rx`}>
                          <Pill className="w-3 h-3 text-green-600" />
                        </span>
                      )}
                      {journey.invoiceBalance > 0 && (
                        <span className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center" title={`UGX ${Number(journey.invoiceBalance).toLocaleString()} due`}>
                          <CreditCard className="w-3 h-3 text-indigo-600" />
                        </span>
                      )}
                    </div>

                    {/* Token */}
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono font-bold">
                      {journey.ticketNumber}
                    </span>

                    {/* Status badge */}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>

                    {/* Elapsed time */}
                    {elapsed != null && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 min-w-[50px]" title="Total visit time">
                        <Timer className="w-3 h-3" />
                        {formatMinutes(elapsed)}
                      </span>
                    )}

                    {/* Expand chevron */}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-3">
                    <JourneyDetails journey={journey} />
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                      <span>Visit: {journey.visitType?.replace(/_/g, ' ')}</span>
                      {journey.chiefComplaint && <span>• {journey.chiefComplaint}</span>}
                      <span>• {ENCOUNTER_STATUS_LABELS[journey.encounterStatus] || journey.encounterStatus}</span>
                      <Link
                        to={`/patients/${journey.patientId}`}
                        className="ml-auto text-blue-500 hover:underline"
                      >
                        View Patient →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
