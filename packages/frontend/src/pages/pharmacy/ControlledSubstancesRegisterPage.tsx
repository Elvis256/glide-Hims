import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useFacilityId } from '../../hooks/useFacilityId';
import api from '../../services/api';
import { formatCurrency } from '../../lib/currency';

interface ControlledDispensation {
  id: string;
  date: string;
  patientName: string;
  patientMrn: string;
  prescriptionNumber: string;
  drugName: string;
  quantity: number;
  unit: string;
  prescribedBy: string;
  dispensedBy: string;
  witnessedBy?: string;
  runningBalance: number;
  notes?: string;
}

export default function ControlledSubstancesRegisterPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.controlled')) {
    return <AccessDenied />;
  }

  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDrug, setSelectedDrug] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Fetch controlled substances dispensing log
  const { data: dispensationsData, isLoading } = useQuery({
    queryKey: ['controlled-dispensations', facilityId, dateFrom, dateTo],
    queryFn: async () => {
      const res = await api.get('/drug-management/reports/controlled-substances', {
        params: { facilityId, dateFrom, dateTo, limit: 200 },
      });
      return (res.data?.data || res.data || []) as ControlledDispensation[];
    },
    staleTime: 60000,
  });

  // Fetch controlled drug list
  const { data: controlledDrugs } = useQuery({
    queryKey: ['controlled-drugs-list'],
    queryFn: async () => {
      const res = await api.get('/drug-management/classifications', { params: { type: 'controlled' } });
      return (res.data?.data || res.data || []) as Array<{ id: string; genericName: string; scheduleClass?: string }>;
    },
    staleTime: 600000,
  });

  const dispensations: ControlledDispensation[] = dispensationsData || [];

  const drugOptions = useMemo(() => {
    const names = [...new Set(dispensations.map((d) => d.drugName))];
    return names.sort();
  }, [dispensations]);

  const filtered = useMemo(() => {
    return dispensations.filter((d) => {
      const matchesDrug = selectedDrug === 'all' || d.drugName === selectedDrug;
      const matchesSearch =
        !searchTerm ||
        d.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.patientMrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.prescriptionNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.drugName?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesDrug && matchesSearch;
    });
  }, [dispensations, selectedDrug, searchTerm]);

  const handleExport = () => {
    const csv = [
      ['Date', 'Patient', 'MRN', 'Rx #', 'Drug', 'Qty', 'Prescribed By', 'Dispensed By', 'Witness', 'Balance'].join(','),
      ...filtered.map((d) =>
        [
          new Date(d.date).toLocaleString(),
          d.patientName,
          d.patientMrn,
          d.prescriptionNumber,
          d.drugName,
          `${d.quantity} ${d.unit}`,
          d.prescribedBy,
          d.dispensedBy,
          d.witnessedBy || '-',
          d.runningBalance,
        ].join(',')
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `controlled-register-${dateFrom}-${dateTo}.csv`;
    a.click();
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
          Discrepancies must be reported to the pharmacist-in-charge immediately.
        </p>
      </div>

      {/* Controlled Drug Reference */}
      {controlledDrugs && controlledDrugs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-600" /> Controlled Substances on File ({controlledDrugs.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {controlledDrugs.slice(0, 20).map((d) => (
              <span key={d.id} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-full">
                {d.genericName}{d.scheduleClass ? ` (Sch ${d.scheduleClass})` : ''}
              </span>
            ))}
            {controlledDrugs.length > 20 && (
              <span className="text-xs text-gray-500">+{controlledDrugs.length - 20} more</span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient, Rx, drug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={selectedDrug}
            onChange={(e) => setSelectedDrug(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Drugs</option>
            {drugOptions.map((d) => <option key={d} value={d}>{d}</option>)}
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
        </div>
      </div>

      {/* Register Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Dispensing Register</h3>
          <span className="text-sm text-gray-500">{filtered.length} entries</span>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Rx #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Drug</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Prescribed By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Dispensed By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Witness</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((entry, idx) => (
                  <tr key={entry.id || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {new Date(entry.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{entry.patientName}</p>
                      <p className="text-xs text-gray-500">{entry.patientMrn}</p>
                    </td>
                    <td className="px-4 py-3 text-blue-700 font-mono text-xs">{entry.prescriptionNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-red-600" />
                        <span className="font-medium text-gray-900">{entry.drugName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {entry.quantity} {entry.unit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-700">
                        <User className="w-3 h-3" />
                        {entry.prescribedBy}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-700">
                        <User className="w-3 h-3" />
                        {entry.dispensedBy}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {entry.witnessedBy ? (
                        <div className="flex items-center gap-1 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          {entry.witnessedBy}
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                          <XCircle className="w-3 h-3" />
                          Not witnessed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900">
                      {entry.runningBalance ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
