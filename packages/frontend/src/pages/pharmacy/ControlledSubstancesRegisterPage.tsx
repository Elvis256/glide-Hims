import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Lock,
  AlertTriangle,
  User,
  Clock,
  FileText,
  Search,
  Download,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Eye,
  UserCheck,
} from 'lucide-react';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useFacilityId } from '../../lib/facility';
import { prescriptionsService, type ControlledSubstanceLog } from '../../services/prescriptions';
import { asList } from '../../utils/unwrapResponse';
import { toCsv, downloadBlob } from '../reports/_reportUtils';

export default function ControlledSubstancesRegisterPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [witnessModal, setWitnessModal] = useState<{ logId: string } | null>(null);
  const [witnessUserId, setWitnessUserId] = useState('');
  const [doubleCheckModal, setDoubleCheckModal] = useState<{ logId: string } | null>(null);
  const [doubleCheckUserId, setDoubleCheckUserId] = useState('');

  // Fetch controlled substance register
  const { data: registerData, isLoading } = useQuery({
    queryKey: ['controlled-register', facilityId, selectedSchedule, dateFrom, dateTo],
    queryFn: () =>
      prescriptionsService.getControlledSubstanceRegister({
        facilityId: facilityId || undefined,
        drugSchedule: selectedSchedule !== 'all' ? selectedSchedule : undefined,
        dateFrom,
        dateTo,
        limit: 200,
      }),
    staleTime: 60000,
  });

  const filtered = useMemo(() => {
    const entries: ControlledSubstanceLog[] = asList(registerData);
    if (!searchTerm) return entries;
    const q = searchTerm.toLowerCase();
    return entries.filter(
      (e) =>
        e.prescriptionItem?.drugName?.toLowerCase().includes(q) ||
        e.dispensedBy?.fullName?.toLowerCase().includes(q) ||
        e.witness?.fullName?.toLowerCase().includes(q) ||
        e.notes?.toLowerCase().includes(q),
    );
  }, [registerData, searchTerm]);

  // Witness mutation
  const witnessMutation = useMutation({
    mutationFn: (data: { logId: string; witnessId: string }) =>
      prescriptionsService.addControlledWitness(data.logId, { witnessId: data.witnessId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controlled-register'] });
      toast.success('Witness recorded successfully');
      setWitnessModal(null);
      setWitnessUserId('');
    },
    onError: () => toast.error('Failed to record witness'),
  });

  // Double-check mutation
  const doubleCheckMutation = useMutation({
    mutationFn: (data: { logId: string; checkerId: string }) =>
      prescriptionsService.doubleCheckControlled(data.logId, data.checkerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controlled-register'] });
      toast.success('Double-check recorded successfully');
      setDoubleCheckModal(null);
      setDoubleCheckUserId('');
    },
    onError: () => toast.error('Failed to record double-check'),
  });

  if (!hasPermission('pharmacy.read')) {
    return <AccessDenied />;
  }

  const entries: ControlledSubstanceLog[] = asList(registerData);

  const scheduleOptions = ['all', 'schedule_1', 'schedule_2', 'schedule_3', 'schedule_4', 'schedule_5'];

  const handleExport = () => {
    const rows: Array<Array<unknown>> = [
      ['Date', 'Drug', 'Schedule', 'Qty', 'Running Balance', 'Dispensed By', 'Witness', 'Double-Check', 'Notes'],
      ...filtered.map((e) => [
        new Date(e.createdAt).toLocaleString(),
        e.prescriptionItem?.drugName || '-',
        e.drugSchedule,
        e.quantityDispensed,
        e.runningBalance,
        e.dispensedBy?.fullName || '-',
        e.witness?.fullName || 'Not witnessed',
        e.doubleCheckBy?.fullName || 'Not checked',
        e.notes || '',
      ]),
    ];
    downloadBlob(
      `controlled-register-${dateFrom}-${dateTo}.csv`,
      'text/csv;charset=utf-8',
      '\ufeff' + toCsv(rows),
    );
  };

  const needsAttention = (entry: ControlledSubstanceLog) => {
    const isHighSchedule = entry.drugSchedule === 'schedule_1' || entry.drugSchedule === 'schedule_2';
    return isHighSchedule && (!entry.witnessId || !entry.doubleCheckById);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Lock className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Controlled Substances Register</h1>
            <p className="text-gray-600">Official dispensing log for Schedule I–V controlled drugs</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-800">
          This register is a legal document. All entries must be complete, accurate, and witnessed where required.
          Schedule I/II substances require a witness and double-check verification. Entries missing these are highlighted in red.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drug, staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedSchedule}
            onChange={(e) => setSelectedSchedule(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Schedules</option>
            {scheduleOptions.filter((s) => s !== 'all').map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-center text-sm text-gray-500">
            {filtered.length} entries
          </div>
        </div>
      </div>

      {/* Register Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Dispensing Register</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded">
              <XCircle className="w-3 h-3" /> Needs attention
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded">
              <CheckCircle className="w-3 h-3" /> Complete
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
            <span className="text-gray-600">Loading register...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Lock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No controlled substance dispensations found for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date/Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Drug</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Schedule</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Dispensed By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Witness</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Double-Check</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((entry) => {
                  const attention = needsAttention(entry);
                  return (
                    <tr
                      key={entry.id}
                      className={attention ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {new Date(entry.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-red-600" />
                          <span className="font-medium text-gray-900">
                            {entry.prescriptionItem?.drugName || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            entry.drugSchedule === 'schedule_1' || entry.drugSchedule === 'schedule_2'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {entry.drugSchedule.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {entry.quantityDispensed}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                        {entry.runningBalance}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-700">
                          <User className="w-3 h-3" />
                          {entry.dispensedBy?.fullName || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {entry.witnessId ? (
                          <div className="flex items-center gap-1 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                            {entry.witness?.fullName || 'Witnessed'}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 font-medium">
                            <XCircle className="w-3 h-3" />
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.doubleCheckById ? (
                          <div className="flex items-center gap-1 text-green-700">
                            <CheckCircle className="w-3 h-3" />
                            {entry.doubleCheckBy?.fullName || 'Verified'}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 font-medium">
                            <XCircle className="w-3 h-3" />
                            Missing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!entry.witnessId && (
                            <button
                              onClick={() => setWitnessModal({ logId: entry.id })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                              title="Add witness"
                            >
                              <UserCheck className="w-3 h-3" />
                              Witness
                            </button>
                          )}
                          {!entry.doubleCheckById && (
                            <button
                              onClick={() => setDoubleCheckModal({ logId: entry.id })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
                              title="Double-check"
                            >
                              <Eye className="w-3 h-3" />
                              Check
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Witness Modal */}
      {witnessModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              Add Witness
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the User ID of the staff member witnessing this controlled substance dispensation.
            </p>
            <input
              type="text"
              placeholder="Witness User ID (UUID)"
              value={witnessUserId}
              onChange={(e) => setWitnessUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setWitnessModal(null); setWitnessUserId(''); }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => witnessMutation.mutate({ logId: witnessModal.logId, witnessId: witnessUserId })}
                disabled={!witnessUserId || witnessMutation.isPending}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {witnessMutation.isPending ? 'Saving...' : 'Confirm Witness'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Double-Check Modal */}
      {doubleCheckModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-600" />
              Double-Check Verification
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the User ID of the verifying pharmacist. Cannot be the same person who dispensed.
            </p>
            <input
              type="text"
              placeholder="Checker User ID (UUID)"
              value={doubleCheckUserId}
              onChange={(e) => setDoubleCheckUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDoubleCheckModal(null); setDoubleCheckUserId(''); }}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => doubleCheckMutation.mutate({ logId: doubleCheckModal.logId, checkerId: doubleCheckUserId })}
                disabled={!doubleCheckUserId || doubleCheckMutation.isPending}
                className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {doubleCheckMutation.isPending ? 'Saving...' : 'Confirm Double-Check'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
