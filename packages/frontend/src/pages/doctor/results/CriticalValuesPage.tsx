import { usePermissions } from '../../../components/PermissionGate';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  Phone,
  User,
  Eye,
  Check,
  CheckCircle,
  Filter,
  Bell,
  TrendingUp,
  FileText,
  ChevronDown,
  X,
  MessageSquare,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { labService, type LabOrder, type LabResult } from '../../../services/lab';

interface CriticalValue {
  id: string;
  patientName: string;
  mrn: string;
  room: string;
  testName: string;
  result: string;
  units: string;
  referenceRange: string;
  timeReported: Date;
  type: 'Lab' | 'Imaging';
  reportedBy: string;
  priority: 'Immediate' | 'Urgent';
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  actionTaken?: string;
}

// Helper to get name from verifiedBy which could be string or object
const getVerifiedByName = (verifiedBy?: string | { firstName: string; lastName: string }): string => {
  if (!verifiedBy) return 'Lab';
  if (typeof verifiedBy === 'string') return verifiedBy;
  return `${verifiedBy.firstName} ${verifiedBy.lastName}`;
};

// Transform lab orders with critical values to CriticalValue interface
function transformToCriticalValues(orders: LabOrder[]): CriticalValue[] {
  const criticalValues: CriticalValue[] = [];

  orders.forEach((order) => {
    order.tests.forEach((test) => {
      const result = test.result;
      if (!result) return;

      // Handle parameters array format
      if (result.parameters && result.parameters.length > 0) {
        result.parameters.forEach((param) => {
          const flag = param.flag?.toLowerCase() || '';
          if (flag.includes('critical') || flag === 'high' || flag === 'low') {
            criticalValues.push({
              id: `${order.id}-${test.id}-${param.name}`,
              patientName: order.patient?.fullName || 'Unknown Patient',
              mrn: order.patient?.mrn || 'N/A',
              room: order.patient?.room || 'N/A',
              testName: `${test.testName} - ${param.name}`,
              result: param.value,
              units: param.unit || '',
              referenceRange: param.referenceRange || '',
              timeReported: new Date(result.createdAt || order.createdAt),
              type: 'Lab',
              reportedBy: getVerifiedByName(result.verifiedBy || result.validatedBy),
              priority: order.priority === 'stat' ? 'Immediate' : 'Urgent',
              acknowledged: !!(result.verifiedAt || result.validatedAt),
              acknowledgedBy: getVerifiedByName(result.verifiedBy || result.validatedBy),
              acknowledgedAt: (result.verifiedAt || result.validatedAt) ? new Date(result.verifiedAt || result.validatedAt!) : undefined,
            });
          }
        });
      } else {
        // Handle single result format
        const flag = (result.abnormalFlag || result.flag || '').toLowerCase();
        if (flag.includes('critical') || flag === 'high' || flag === 'low') {
          criticalValues.push({
            id: `${order.id}-${test.id}`,
            patientName: order.patient?.fullName || 'Unknown Patient',
            mrn: order.patient?.mrn || 'N/A',
            room: order.patient?.room || 'N/A',
            testName: `${test.testName} - ${result.parameter}`,
            result: result.value,
            units: result.unit || '',
            referenceRange: result.referenceRange || '',
            timeReported: new Date(result.createdAt || order.createdAt),
            type: 'Lab',
            reportedBy: getVerifiedByName(result.verifiedBy || result.validatedBy),
            priority: order.priority === 'stat' ? 'Immediate' : 'Urgent',
            acknowledged: !!(result.verifiedAt || result.validatedAt),
            acknowledgedBy: getVerifiedByName(result.verifiedBy || result.validatedBy),
            acknowledgedAt: (result.verifiedAt || result.validatedAt) ? new Date(result.verifiedAt || result.validatedAt!) : undefined,
          });
        }
      }
    });
  });

  return criticalValues;
}

export default function CriticalValuesPage() {
  const { hasPermission } = usePermissions();
  const [filter, setFilter] = useState<'Unacknowledged' | 'All'>('Unacknowledged');
  const [acknowledgeModalOpen, setAcknowledgeModalOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState<CriticalValue | null>(null);
  const [actionTaken, setActionTaken] = useState('');
  const [acknowledgedValues, setAcknowledgedValues] = useState<Set<string>>(new Set());

  // Fetch lab orders with completed results
  const { data: labOrders = [], isLoading } = useQuery({
    queryKey: ['lab-orders', 'completed'],
    queryFn: () => labService.orders.list({ status: 'completed' }),
    refetchInterval: 30000, // Refetch every 30 seconds for critical values
  });

  // Transform lab orders to critical values
  const criticalValues = useMemo(() => transformToCriticalValues(labOrders), [labOrders]);

  const filteredValues = useMemo(() => {
    const values =
      filter === 'Unacknowledged'
        ? criticalValues.filter((v) => !v.acknowledged && !acknowledgedValues.has(v.id))
        : criticalValues;

    // Sort by time reported (most recent first)
    return [...values].sort((a, b) => b.timeReported.getTime() - a.timeReported.getTime());
  }, [filter, acknowledgedValues, criticalValues]);

  const unacknowledgedCount = criticalValues.filter((v) => !v.acknowledged && !acknowledgedValues.has(v.id)).length;

  const getTimeSinceReported = (time: Date) => {
    const diffMs = Date.now() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) {
      return `${diffMins} min ago`;
    } else {
      return `${diffHours}h ${diffMins % 60}m ago`;
    }
  };

  const getEscalationLevel = (time: Date) => {
    const diffMins = Math.floor((Date.now() - time.getTime()) / (1000 * 60));

    if (diffMins < 15) {
      return { level: 'normal', color: 'text-gray-500', bg: 'bg-gray-100' };
    } else if (diffMins < 30) {
      return { level: 'warning', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    } else if (diffMins < 60) {
      return { level: 'escalated', color: 'text-orange-600', bg: 'bg-orange-100' };
    } else {
      return { level: 'critical', color: 'text-red-600', bg: 'bg-red-100' };
    }
  };

  const openAcknowledgeModal = (value: CriticalValue) => {
    setSelectedValue(value);
    setActionTaken('');
    setAcknowledgeModalOpen(true);
  };

  const handleAcknowledge = () => {
    if (selectedValue && actionTaken.trim()) {
      setAcknowledgedValues((prev) => {
        const next = new Set(prev);
        next.add(selectedValue.id);
        return next;
      });
      setAcknowledgeModalOpen(false);
      setSelectedValue(null);
      setActionTaken('');
    }
  };

  const isAcknowledged = (value: CriticalValue) => value.acknowledged || acknowledgedValues.has(value.id);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Critical Values</h1>
              <p className="text-sm text-gray-500">Results requiring immediate attention</p>
            </div>
            {unacknowledgedCount > 0 && (
              <span className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full animate-pulse">
                <Bell className="h-4 w-4" />
                {unacknowledgedCount} Pending
              </span>
            )}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setFilter('Unacknowledged')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === 'Unacknowledged' ? 'bg-red-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Unacknowledged
              </button>
              <button
                onClick={() => setFilter('All')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === 'All' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-3" />
              <p className="text-lg font-medium">Loading critical values...</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Test</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Critical Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Time Reported
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
              {filteredValues.map((value) => {
                const escalation = getEscalationLevel(value.timeReported);
                const acked = isAcknowledged(value);

                return (
                  <tr key={value.id} className={`${!acked ? 'bg-red-50/50' : ''} hover:bg-gray-50`}>
                    {/* Patient */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            !acked ? 'bg-red-100' : 'bg-gray-100'
                          }`}
                        >
                          <User className={`h-5 w-5 ${!acked ? 'text-red-600' : 'text-gray-500'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{value.patientName}</p>
                          <p className="text-sm text-gray-500">
                            {value.mrn} · {value.room}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Test */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            value.type === 'Lab' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {value.type}
                        </span>
                        <span className="font-medium text-gray-900">{value.testName}</span>
                      </div>
                    </td>

                    {/* Critical Value */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-red-600">{value.result}</span>
                        {value.units && <span className="text-sm text-gray-500">{value.units}</span>}
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Ref: {value.referenceRange}</p>
                    </td>

                    {/* Time Reported */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className={`h-4 w-4 ${escalation.color}`} />
                        <span className={`font-medium ${escalation.color}`}>{getTimeSinceReported(value.timeReported)}</span>
                      </div>
                      {!acked && (
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${escalation.bg} ${escalation.color}`}>
                          {escalation.level === 'critical'
                            ? '⚠️ Escalation Required'
                            : escalation.level === 'escalated'
                              ? '⚠️ Needs Attention'
                              : escalation.level === 'warning'
                                ? 'Action Pending'
                                : 'Just Reported'}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {acked ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-sm font-medium rounded">
                            <CheckCircle className="h-4 w-4" />
                            Acknowledged
                          </span>
                          {value.acknowledgedBy && (
                            <p className="text-xs text-gray-500 mt-1">by {value.acknowledgedBy}</p>
                          )}
                          {value.actionTaken && (
                            <p className="text-xs text-gray-600 mt-1 max-w-xs truncate" title={value.actionTaken}>
                              {value.actionTaken}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-sm font-medium rounded animate-pulse">
                          <AlertTriangle className="h-4 w-4" />
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="View Patient">
                          <Eye className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Call Nurse">
                          <Phone className="h-5 w-5" />
                        </button>
                        {!acked && (
                          <button
                            onClick={() => openAcknowledgeModal(value)}
                            className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
                          >
                            <Check className="h-4 w-4" />
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredValues.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <CheckCircle className="h-12 w-12 text-green-400 mb-3" />
              <p className="text-lg font-medium">No critical values</p>
              <p className="text-sm">{criticalValues.length === 0 ? 'No critical or abnormal lab results found' : 'All critical values have been acknowledged'}</p>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      {/* Acknowledge Modal */}
      {acknowledgeModalOpen && selectedValue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h2 className="text-lg font-semibold text-gray-900">Acknowledge Critical Value</h2>
              </div>
              <button onClick={() => setAcknowledgeModalOpen(false)} className="p-2 hover:bg-red-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Patient & Value Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Patient</p>
                    <p className="font-medium text-gray-900">{selectedValue.patientName}</p>
                    <p className="text-sm text-gray-500">{selectedValue.mrn}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Location</p>
                    <p className="font-medium text-gray-900">{selectedValue.room}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Critical Value</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-bold text-red-600">{selectedValue.result}</span>
                    {selectedValue.units && <span className="text-gray-500">{selectedValue.units}</span>}
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">{selectedValue.testName}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Reference: {selectedValue.referenceRange}</p>
                </div>
              </div>

              {/* Action Taken */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Action Taken <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="Document the action taken in response to this critical value..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={4}
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  Examples: "Patient notified and transferred to ICU", "Started IV potassium replacement", "Ordered stat blood
                  transfusion"
                </p>
              </div>

              {/* Quick Actions */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Quick Templates</p>
                <div className="flex flex-wrap gap-2">
                  {['Patient notified', 'Nurse notified', 'Treatment started', 'Consult placed', 'Repeat ordered'].map(
                    (template) => (
                      <button
                        key={template}
                        onClick={() => setActionTaken((prev) => (prev ? `${prev}. ${template}` : template))}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                      >
                        + {template}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setAcknowledgeModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAcknowledge}
                disabled={!actionTaken.trim()}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                  actionTaken.trim()
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Check className="h-4 w-4" />
                Acknowledge Critical Value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
