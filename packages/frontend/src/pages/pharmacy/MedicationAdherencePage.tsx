import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Pill,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  CalendarDays,
  AlertTriangle,
  Loader2,
  SkipForward,
  Activity,
} from 'lucide-react';
import { adherenceService, type AdherenceRecord, type AdherenceSummary } from '../../services/adherence';

export default function MedicationAdherencePage() {
  const queryClient = useQueryClient();
  const [patientId, setPatientId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [skipRecordId, setSkipRecordId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const handlePatientSearch = () => {
    if (searchInput.trim()) {
      setPatientId(searchInput.trim());
    }
  };

  // Fetch adherence summary
  const { data: summary, isLoading: summaryLoading } = useQuery<AdherenceSummary>({
    queryKey: ['adherence-summary', patientId],
    queryFn: () => adherenceService.getAdherenceSummary(patientId),
    enabled: !!patientId,
  });

  // Fetch adherence records
  const { data: records, isLoading: recordsLoading } = useQuery<AdherenceRecord[]>({
    queryKey: ['adherence-records', patientId, dateFrom, dateTo],
    queryFn: () =>
      adherenceService.getPatientAdherence(patientId, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    enabled: !!patientId,
  });

  // Record adherence mutation
  const recordMutation = useMutation({
    mutationFn: ({ recordId, status, skipReason }: { recordId: string; status: 'taken' | 'skipped'; skipReason?: string }) =>
      adherenceService.recordAdherence(recordId, { status, skipReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adherence-records', patientId] });
      queryClient.invalidateQueries({ queryKey: ['adherence-summary', patientId] });
      setSkipRecordId(null);
      setSkipReason('');
      toast.success('Adherence recorded');
    },
    onError: () => {
      toast.error('Failed to record adherence');
    },
  });

  const handleTaken = (recordId: string) => {
    recordMutation.mutate({ recordId, status: 'taken' });
  };

  const handleSkip = (recordId: string) => {
    recordMutation.mutate({ recordId, status: 'skipped', skipReason: skipReason || undefined });
  };

  // Group records by medication for the table view
  const medicationStats = useMemo(() => {
    if (!records || records.length === 0) return [];

    const grouped: Record<string, {
      drugName: string;
      frequency: string;
      dose: string;
      totalRecords: number;
      takenRecords: number;
      lastTaken?: string;
      nextDue?: string;
    }> = {};

    for (const record of records) {
      const key = record.prescriptionItemId;
      if (!grouped[key]) {
        grouped[key] = {
          drugName: record.prescriptionItem?.drugName || 'Unknown',
          frequency: record.prescriptionItem?.frequency || '-',
          dose: record.prescriptionItem?.dose || '-',
          totalRecords: 0,
          takenRecords: 0,
        };
      }
      grouped[key].totalRecords++;
      if (record.status === 'taken') {
        grouped[key].takenRecords++;
        if (!grouped[key].lastTaken || record.takenAt! > grouped[key].lastTaken!) {
          grouped[key].lastTaken = record.takenAt;
        }
      }
      if (record.status === 'pending' && !grouped[key].nextDue) {
        grouped[key].nextDue = `${record.scheduledDate} ${record.scheduledTime}`;
      }
    }

    return Object.entries(grouped).map(([id, stats]) => ({
      id,
      ...stats,
      adherenceRate: stats.totalRecords > 0
        ? Math.round((stats.takenRecords / stats.totalRecords) * 100)
        : 0,
    }));
  }, [records]);

  const getAdherenceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-100';
    if (rate >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getAdherenceBarColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'taken':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'skipped':
        return <SkipForward className="w-4 h-4 text-orange-500" />;
      case 'missed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Activity className="w-7 h-7 text-blue-600" />
        <h1 className="text-3xl font-bold text-gray-900">Medication Adherence</h1>
      </div>

      {/* Patient Selector */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Enter Patient ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePatientSearch()}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={handlePatientSearch}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Load
        </button>
      </div>

      {!patientId && (
        <div className="text-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Enter a Patient ID to view medication adherence</p>
        </div>
      )}

      {patientId && (
        <>
          {/* Summary Cards */}
          {summaryLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : summary ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-600">Adherence Rate</span>
                </div>
                <p className={`text-3xl font-bold ${summary.adherenceRate >= 80 ? 'text-green-600' : summary.adherenceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {summary.adherenceRate}%
                </p>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getAdherenceBarColor(summary.adherenceRate)}`}
                    style={{ width: `${summary.adherenceRate}%` }}
                  />
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Pill className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-gray-600">Current Medications</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{summary.currentMedicationsCount}</p>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-600">Doses Taken</span>
                </div>
                <p className="text-3xl font-bold text-green-600">{summary.taken}</p>
                <p className="text-xs text-gray-500 mt-1">of {summary.totalScheduled} scheduled</p>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span className="text-sm text-gray-600">Missed / Skipped</span>
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  {summary.missed + summary.skipped}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {summary.missed} missed, {summary.skipped} skipped
                </p>
              </div>
            </div>
          ) : null}

          {/* Date Filters */}
          <div className="flex items-center gap-4 bg-white border rounded-lg p-3">
            <CalendarDays className="w-5 h-5 text-gray-500" />
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Medication Stats Table */}
          {medicationStats.length > 0 && (
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Medications Overview</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Medication</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dose</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Taken</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Due</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adherence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {medicationStats.map((med) => (
                      <tr key={med.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{med.drugName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{med.dose}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{med.frequency}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(med.lastTaken)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{med.nextDue || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdherenceColor(med.adherenceRate)}`}>
                            {med.adherenceRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Timeline / Records */}
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Schedule &amp; History</h2>
            </div>

            {recordsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : records && records.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {records.map((record) => (
                  <div key={record.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {statusIcon(record.status)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {record.prescriptionItem?.drugName || 'Medication'}
                          {' '}
                          <span className="text-gray-500">
                            {record.prescriptionItem?.dose}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(record.scheduledDate)} at {record.scheduledTime}
                          {record.takenAt && ` • Taken ${formatDateTime(record.takenAt)}`}
                          {record.skipReason && ` • Reason: ${record.skipReason}`}
                        </p>
                      </div>
                    </div>

                    {record.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        {skipRecordId === record.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Reason (optional)"
                              value={skipReason}
                              onChange={(e) => setSkipReason(e.target.value)}
                              className="px-2 py-1 border rounded text-sm w-40"
                            />
                            <button
                              onClick={() => handleSkip(record.id)}
                              disabled={recordMutation.isPending}
                              className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded hover:bg-orange-200 disabled:opacity-50"
                            >
                              Confirm Skip
                            </button>
                            <button
                              onClick={() => { setSkipRecordId(null); setSkipReason(''); }}
                              className="px-2 py-1 text-gray-500 text-sm hover:text-gray-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleTaken(record.id)}
                              disabled={recordMutation.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded hover:bg-green-200 disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Taken
                            </button>
                            <button
                              onClick={() => setSkipRecordId(record.id)}
                              disabled={recordMutation.isPending}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded hover:bg-orange-200 disabled:opacity-50"
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                              Skip
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {record.status !== 'pending' && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'taken' ? 'bg-green-100 text-green-800' :
                        record.status === 'skipped' ? 'bg-orange-100 text-orange-800' :
                        record.status === 'missed' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No adherence records found</p>
                <p className="text-sm mt-1">Generate a schedule from a prescription to get started</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
