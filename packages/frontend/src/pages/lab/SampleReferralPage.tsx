import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Send,
  GitBranch,
  Clock,
  CheckCircle,
  AlertTriangle,
  Truck,
  FlaskConical,
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  BarChart3,
  ArrowRight,
  Package,
  Thermometer,
  Phone,
  User,
  MapPin,
  XCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { sampleReferralService } from '../../services/sample-referral';
import type {
  SampleReferral,
  ReferralStage,
  ReferralPriority,
  CreateSampleReferralDto,
  ReferralDashboard,
  TATStats,
} from '../../services/sample-referral';
import { labService } from '../../services';
import { facilitiesService } from '../../services/facilities';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';
import api from '../../services/api';

type TabId = 'dashboard' | 'create' | 'track' | 'hub';

const STAGES: ReferralStage[] = [
  'collected', 'packaged', 'in_transit', 'received_at_hub',
  'processing', 'result_ready', 'result_delivered',
];

const STAGE_LABELS: Record<string, string> = {
  collected: 'Collected',
  packaged: 'Packaged',
  in_transit: 'In Transit',
  received_at_hub: 'Received at Hub',
  processing: 'Processing',
  result_ready: 'Result Ready',
  result_delivered: 'Delivered',
  rejected: 'Rejected',
};

const PRIORITY_COLORS: Record<ReferralPriority, string> = {
  STAT: 'bg-red-100 text-red-700 border-red-300',
  URGENT: 'bg-orange-100 text-orange-700 border-orange-300',
  ROUTINE: 'bg-blue-100 text-blue-700 border-blue-300',
};

const PRIORITY_DOT: Record<ReferralPriority, string> = {
  STAT: 'bg-red-500',
  URGENT: 'bg-orange-500',
  ROUTINE: 'bg-blue-500',
};

// ────────────────────────── Stage Timeline ──────────────────────────

function StageTimeline({ currentStage }: { currentStage: ReferralStage }) {
  if (currentStage === 'rejected') {
    return (
      <div className="flex items-center gap-1">
        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
          <X className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs text-red-600 font-medium">Rejected</span>
      </div>
    );
  }

  const idx = STAGES.indexOf(currentStage);

  return (
    <div className="flex items-center gap-0.5">
      {STAGES.map((stage, i) => (
        <React.Fragment key={stage}>
          <div
            className={`w-3 h-3 rounded-full flex-shrink-0 ${
              i <= idx ? 'bg-green-500' : 'bg-gray-300'
            }`}
            title={STAGE_LABELS[stage]}
          />
          {i < STAGES.length - 1 && (
            <div className={`w-4 h-0.5 ${i < idx ? 'bg-green-500' : 'bg-gray-300'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ────────────────────────── Dashboard Tab ──────────────────────────

function DashboardTab() {
  const { data: dashboard, isLoading: dashLoading } = useQuery<ReferralDashboard>({
    queryKey: ['sample-referral-dashboard'],
    queryFn: () => sampleReferralService.getDashboard(),
  });

  const { data: tatStats, isLoading: tatLoading } = useQuery<TATStats>({
    queryKey: ['sample-referral-tat'],
    queryFn: () => sampleReferralService.getTATStats(),
  });

  if (dashLoading || tatLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  const d = dashboard || { total: 0, inTransit: 0, pendingAtHub: 0, resultsReady: 0, avgTATDays: 0, pctMeeting7Day: 0, completedCount: 0, rejected: 0 };
  const tat = tatStats || { stageAvgHours: [], bottleneck: null, pctMeeting7Day: 0, completedCount: 0, totalReferrals: 0, routeBreakdown: [] };

  const cards = [
    { label: 'In Transit', value: d.inTransit, icon: Truck, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Pending at Hub', value: d.pendingAtHub, icon: FlaskConical, color: 'text-purple-600 bg-purple-50' },
    { label: 'Results Ready', value: d.resultsReady, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Avg TAT (days)', value: d.avgTATDays, icon: Clock, color: 'text-blue-600 bg-blue-50' },
  ];

  const chartData = tat.stageAvgHours.map((s) => ({
    name: s.stage.replace('→', ' → '),
    hours: s.avgHours,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-lg border p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TAT Bar Chart */}
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Avg Hours per Stage</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No data available yet</p>
          )}
        </div>

        {/* 7-Day Compliance & Bottleneck */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">7-Day Target Compliance</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full ${tat.pctMeeting7Day >= 80 ? 'bg-green-500' : tat.pctMeeting7Day >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(tat.pctMeeting7Day, 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-xl font-bold">{tat.pctMeeting7Day}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{tat.completedCount} completed referrals</p>
          </div>

          {tat.bottleneck && (
            <div className="bg-white rounded-lg border p-4 shadow-sm border-l-4 border-l-orange-400">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Bottleneck Identified</h3>
              <p className="text-sm text-gray-600">
                <span className="font-medium">{tat.bottleneck.stage.replace('→', ' → ')}</span>
                {' '}— avg {tat.bottleneck.avgHours} hrs
              </p>
            </div>
          )}

          {/* Route Breakdown */}
          {tat.routeBreakdown.length > 0 && (
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">By Route</h3>
              <div className="space-y-2">
                {tat.routeBreakdown.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{r.from} → {r.to}</span>
                    <span className="font-medium">{r.avgDays}d ({r.count})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────── Create Referral Tab ──────────────────────────

function CreateReferralTab() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [sampleSearch, setSampleSearch] = useState('');
  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [toFacilityId, setToFacilityId] = useState('');
  const [testRequested, setTestRequested] = useState('');
  const [clinicalInfo, setClinicalInfo] = useState('');
  const [priority, setPriority] = useState<ReferralPriority>('ROUTINE');
  const [transportMethod, setTransportMethod] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [transporterPhone, setTransporterPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch samples for search
  const { data: samplesData } = useQuery({
    queryKey: ['lab-samples-search', sampleSearch, facilityId],
    queryFn: () => labService.samples.list({ facilityId, status: 'collected,received', statuses: 'collected,received' }),
    enabled: sampleSearch.length >= 1,
  });

  const samples = useMemo(() => {
    const raw = asList(samplesData);
    if (!sampleSearch) return raw;
    const q = sampleSearch.toLowerCase();
    return raw.filter((s: any) =>
      s.sampleNumber?.toLowerCase().includes(q) ||
      s.patient?.fullName?.toLowerCase().includes(q) ||
      s.patient?.mrn?.toLowerCase().includes(q)
    );
  }, [samplesData, sampleSearch]);

  // Fetch facilities
  const { data: facilities } = useQuery({
    queryKey: ['facilities-list'],
    queryFn: () => facilitiesService.list(),
  });

  const otherFacilities = useMemo(
    () => asList(facilities).filter((f: any) => f.id !== facilityId),
    [facilities, facilityId],
  );

  const createMutation = useMutation({
    mutationFn: (data: CreateSampleReferralDto) => sampleReferralService.create(data),
    onSuccess: () => {
      toast.success('Sample referral created successfully');
      queryClient.invalidateQueries({ queryKey: ['sample-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['sample-referral-dashboard'] });
      // Reset form
      setSelectedSample(null);
      setSampleSearch('');
      setToFacilityId('');
      setTestRequested('');
      setClinicalInfo('');
      setPriority('ROUTINE');
      setTransportMethod('');
      setTransporterName('');
      setTransporterPhone('');
      setNotes('');
    },
    onError: (err: any) => {
      toast.error('Failed to create referral', {
        description: err?.response?.data?.message || err.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSample) {
      toast.error('Please select a sample');
      return;
    }
    if (!toFacilityId) {
      toast.error('Please select a destination facility');
      return;
    }
    createMutation.mutate({
      sampleId: selectedSample.id,
      fromFacilityId: facilityId,
      toFacilityId,
      testRequested: testRequested || undefined,
      clinicalInfo: clinicalInfo || undefined,
      priority,
      transportMethod: transportMethod || undefined,
      transporterName: transporterName || undefined,
      transporterPhone: transporterPhone || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 bg-white rounded-lg border p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800">Create Sample Referral</h3>

      {/* Sample Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Lab Sample *</label>
        {selectedSample ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">{selectedSample.sampleNumber}</span>
            <span className="text-sm text-gray-500">— {selectedSample.patient?.fullName || selectedSample.patient?.mrn || 'Unknown'}</span>
            <button
              type="button"
              onClick={() => { setSelectedSample(null); setSampleSearch(''); }}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={sampleSearch}
              onChange={(e) => setSampleSearch(e.target.value)}
              placeholder="Search by sample number or patient name..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {sampleSearch && samples.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {samples.slice(0, 10).map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                    onClick={() => { setSelectedSample(s); setSampleSearch(''); }}
                  >
                    <span className="font-medium">{s.sampleNumber}</span>
                    <span className="text-gray-500 ml-2">
                      {s.patient?.fullName || s.patient?.mrn || ''}
                    </span>
                    {s.priority && (
                      <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${PRIORITY_COLORS[s.priority?.toUpperCase() as ReferralPriority] || ''}`}>
                        {s.priority}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {sampleSearch && samples.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
                No samples found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Destination Facility */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Destination Facility *</label>
        <select
          value={toFacilityId}
          onChange={(e) => setToFacilityId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select facility...</option>
          {otherFacilities.map((f: any) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Test & Clinical Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Test Requested</label>
          <input
            type="text"
            value={testRequested}
            onChange={(e) => setTestRequested(e.target.value)}
            placeholder="e.g. CD4 Count, Viral Load..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <div className="flex gap-3 mt-1">
            {(['ROUTINE', 'URGENT', 'STAT'] as ReferralPriority[]).map((p) => (
              <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value={p}
                  checked={priority === p}
                  onChange={() => setPriority(p)}
                  className="text-blue-600"
                />
                <span className={`text-sm px-2 py-0.5 rounded border ${PRIORITY_COLORS[p]}`}>{p}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Information</label>
        <textarea
          value={clinicalInfo}
          onChange={(e) => setClinicalInfo(e.target.value)}
          rows={3}
          placeholder="Relevant clinical history, suspected diagnosis..."
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Transport Info */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">Transport Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Transport Method</label>
            <select
              value={transportMethod}
              onChange={(e) => setTransportMethod(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select...</option>
              <option value="rider">Motorcycle Rider</option>
              <option value="ambulance">Ambulance</option>
              <option value="courier">Courier</option>
              <option value="VHT">VHT (Village Health Team)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Transporter Name</label>
            <input
              type="text"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Transporter Phone</label>
            <input
              type="text"
              value={transporterPhone}
              onChange={(e) => setTransporterPhone(e.target.value)}
              placeholder="+256..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={createMutation.isPending || !selectedSample || !toFacilityId}
        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {createMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        Create Referral
      </button>
    </form>
  );
}

// ────────────────────────── Track Referrals Tab ──────────────────────────

function TrackReferralsTab() {
  const facilityId = useFacilityId();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['sample-referrals', 'outgoing', facilityId, stageFilter],
    queryFn: () =>
      sampleReferralService.list({
        direction: 'outgoing',
        facilityId,
        stage: stageFilter !== 'all' ? (stageFilter as ReferralStage) : undefined,
      }),
  });

  const referrals = asList<SampleReferral>(data);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {referrals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Send className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No outgoing referrals found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {referrals.map((ref) => (
            <div key={ref.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === ref.id ? null : ref.id)}
              >
                <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[ref.priority]}`} />
                <span className="text-sm font-medium w-36 flex-shrink-0">{ref.referralNumber}</span>
                <span className="text-sm text-gray-600 flex-1 truncate">{ref.patient?.fullName || ref.patientId}</span>
                <span className="text-xs text-gray-500 w-28 truncate">{ref.testRequested || '—'}</span>
                <span className="text-xs text-gray-500 w-28 truncate">{ref.toFacility?.name || '—'}</span>
                <StageTimeline currentStage={ref.stage} />
                <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_COLORS[ref.priority]}`}>{ref.priority}</span>
                <span className="text-xs text-gray-400 w-20 text-right">
                  {ref.collectedAt ? new Date(ref.collectedAt).toLocaleDateString() : '—'}
                </span>
                {expandedId === ref.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {expandedId === ref.id && (
                <div className="px-4 pb-4 border-t bg-gray-50">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">From → To</p>
                      <p className="font-medium">{ref.fromFacility?.name} → {ref.toFacility?.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Sample</p>
                      <p className="font-medium">{ref.sample?.sampleNumber || ref.sampleId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Priority</p>
                      <p className="font-medium">{ref.priority}</p>
                    </div>
                    {ref.transportMethod && (
                      <div>
                        <p className="text-xs text-gray-500">Transport</p>
                        <p className="font-medium">{ref.transportMethod}</p>
                      </div>
                    )}
                    {ref.transporterName && (
                      <div>
                        <p className="text-xs text-gray-500">Transporter</p>
                        <p className="font-medium">{ref.transporterName} {ref.transporterPhone ? `(${ref.transporterPhone})` : ''}</p>
                      </div>
                    )}
                    {ref.temperatureOnArrival != null && (
                      <div>
                        <p className="text-xs text-gray-500">Temp on Arrival</p>
                        <p className="font-medium">{ref.temperatureOnArrival}°C</p>
                      </div>
                    )}
                    {ref.sampleConditionOnArrival && (
                      <div>
                        <p className="text-xs text-gray-500">Condition</p>
                        <p className="font-medium capitalize">{ref.sampleConditionOnArrival}</p>
                      </div>
                    )}
                    {ref.rejectionReason && (
                      <div className="col-span-full">
                        <p className="text-xs text-red-500">Rejection Reason</p>
                        <p className="font-medium text-red-700">{ref.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                  {/* Timeline */}
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Timeline</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {[
                        { label: 'Collected', date: ref.collectedAt },
                        { label: 'Packaged', date: ref.packagedAt },
                        { label: 'Shipped', date: ref.shippedAt },
                        { label: 'Received at Hub', date: ref.receivedAtHubAt },
                        { label: 'Processing', date: ref.processingStartedAt },
                        { label: 'Result Ready', date: ref.resultReadyAt },
                        { label: 'Delivered', date: ref.resultDeliveredAt },
                        { label: 'Rejected', date: ref.rejectedAt },
                      ]
                        .filter((t) => t.date)
                        .map((t) => (
                          <div key={t.label} className="bg-white px-2 py-1 rounded border">
                            <span className="text-gray-500">{t.label}:</span>{' '}
                            <span className="font-medium">{new Date(t.date!).toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  {ref.notes && (
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs text-gray-500">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{ref.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────── Hub Queue Tab ──────────────────────────

function ReceiveModal({ referral, onClose, onConfirm }: {
  referral: SampleReferral;
  onClose: () => void;
  onConfirm: (temp: number | undefined, condition: string) => void;
}) {
  const [temp, setTemp] = useState('');
  const [condition, setCondition] = useState('intact');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Receive Sample</h3>
        <p className="text-sm text-gray-500 mb-4">
          Referral: <strong>{referral.referralNumber}</strong>
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temperature on Arrival (°C)</label>
            <input
              type="number"
              step="0.1"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              placeholder="e.g. 4.5"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sample Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="intact">Intact</option>
              <option value="hemolyzed">Hemolyzed</option>
              <option value="lipemic">Lipemic</option>
              <option value="clotted">Clotted</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(temp ? parseFloat(temp) : undefined, condition)}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Confirm Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({ referral, onClose, onConfirm }: {
  referral: SampleReferral;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-red-600 mb-4">Reject Sample</h3>
        <p className="text-sm text-gray-500 mb-4">
          Referral: <strong>{referral.referralNumber}</strong>
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Describe why this sample is being rejected..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim()}
            className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function HubQueueTab() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [receiveModal, setReceiveModal] = useState<SampleReferral | null>(null);
  const [rejectModal, setRejectModal] = useState<SampleReferral | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sample-referrals', 'incoming', facilityId],
    queryFn: () =>
      sampleReferralService.list({ direction: 'incoming', facilityId }),
  });

  const referrals = asList<SampleReferral>(data);

  const stageMutation = useMutation({
    mutationFn: ({ id, stage, temp, condition, notes }: {
      id: string; stage: ReferralStage; temp?: number; condition?: string; notes?: string;
    }) =>
      sampleReferralService.updateStage(id, {
        stage,
        temperatureOnArrival: temp,
        sampleConditionOnArrival: condition,
        notes,
      }),
    onSuccess: () => {
      toast.success('Stage updated successfully');
      queryClient.invalidateQueries({ queryKey: ['sample-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['sample-referral-dashboard'] });
    },
    onError: (err: any) => {
      toast.error('Failed to update stage', {
        description: err?.response?.data?.message || err.message,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      sampleReferralService.reject(id, reason),
    onSuccess: () => {
      toast.success('Referral rejected');
      setRejectModal(null);
      queryClient.invalidateQueries({ queryKey: ['sample-referrals'] });
      queryClient.invalidateQueries({ queryKey: ['sample-referral-dashboard'] });
    },
    onError: (err: any) => {
      toast.error('Failed to reject', {
        description: err?.response?.data?.message || err.message,
      });
    },
  });

  const getActionButton = (ref: SampleReferral) => {
    switch (ref.stage) {
      case 'in_transit':
        return (
          <button
            onClick={() => setReceiveModal(ref)}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 flex items-center gap-1"
          >
            <Package className="w-3 h-3" /> Receive
          </button>
        );
      case 'received_at_hub':
        return (
          <button
            onClick={() => stageMutation.mutate({ id: ref.id, stage: 'processing' })}
            disabled={stageMutation.isPending}
            className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 flex items-center gap-1"
          >
            <FlaskConical className="w-3 h-3" /> Start Processing
          </button>
        );
      case 'processing':
        return (
          <button
            onClick={() => stageMutation.mutate({ id: ref.id, stage: 'result_ready' })}
            disabled={stageMutation.isPending}
            className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 flex items-center gap-1"
          >
            <CheckCircle className="w-3 h-3" /> Result Ready
          </button>
        );
      case 'result_ready':
        return (
          <button
            onClick={() => stageMutation.mutate({ id: ref.id, stage: 'result_delivered' })}
            disabled={stageMutation.isPending}
            className="px-3 py-1 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 flex items-center gap-1"
          >
            <Send className="w-3 h-3" /> Deliver Result
          </button>
        );
      default:
        return null;
    }
  };

  // Filter out delivered and rejected for the active queue
  const activeReferrals = referrals.filter(
    (r) => r.stage !== 'result_delivered' && r.stage !== 'rejected',
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeReferrals.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FlaskConical className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No incoming referrals in queue</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Referral #</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Patient</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">From</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Test</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Priority</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Stage</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Received</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeReferrals.map((ref) => (
                <tr key={ref.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{ref.referralNumber}</td>
                  <td className="px-4 py-2 text-gray-600">{ref.patient?.fullName || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{ref.fromFacility?.name || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{ref.testRequested || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 text-xs rounded border ${PRIORITY_COLORS[ref.priority]}`}>
                      {ref.priority}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{STAGE_LABELS[ref.stage]}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {ref.receivedAtHubAt ? new Date(ref.receivedAtHubAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {getActionButton(ref)}
                      {ref.stage !== 'result_delivered' && ref.stage !== 'rejected' && (
                        <button
                          onClick={() => setRejectModal(ref)}
                          className="px-2 py-1 text-red-600 text-xs rounded-lg hover:bg-red-50 border border-red-200 flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {receiveModal && (
        <ReceiveModal
          referral={receiveModal}
          onClose={() => setReceiveModal(null)}
          onConfirm={(temp, condition) => {
            stageMutation.mutate({
              id: receiveModal.id,
              stage: 'received_at_hub',
              temp,
              condition,
            });
            setReceiveModal(null);
          }}
        />
      )}
      {rejectModal && (
        <RejectModal
          referral={rejectModal}
          onClose={() => setRejectModal(null)}
          onConfirm={(reason) => {
            rejectMutation.mutate({ id: rejectModal.id, reason });
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────── Main Page ──────────────────────────

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'create', label: 'Create Referral', icon: Send },
  { id: 'track', label: 'Track Referrals', icon: GitBranch },
  { id: 'hub', label: 'Hub Queue', icon: FlaskConical },
];

export default function SampleReferralPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-blue-600" />
          Sample Referral Tracking
        </h1>
      </div>

      {/* Tab Navigation */}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'create' && <CreateReferralTab />}
        {activeTab === 'track' && <TrackReferralsTab />}
        {activeTab === 'hub' && <HubQueueTab />}
      </div>
    </div>
  );
}
