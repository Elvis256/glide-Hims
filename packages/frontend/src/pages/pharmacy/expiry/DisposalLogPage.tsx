import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Trash2,
  FileText,
  Download,
  Eye,
  Filter,
  Calendar,
  User,
  Shield,
  DollarSign,
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Package,
  Plus,
  Loader2,
  X,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { api } from '../../../services/api';
import { useAuthStore } from '../../../store/auth';

interface DisposalRecord {
  id: string;
  itemId: string;
  item?: { id: string; name: string };
  batchNumber: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  disposalDate: string;
  disposalMethod: 'incineration' | 'chemical' | 'landfill' | 'return_to_manufacturer';
  witness: string;
  disposedById: string;
  disposedBy?: { id: string; fullName: string };
  approvedById?: string;
  approvedBy?: { id: string; fullName: string };
  certificateNumber: string;
  complianceStatus: 'compliant' | 'pending_review' | 'non_compliant';
  reason: string;
  notes?: string;
  facilityId: string;
  createdAt: string;
  updatedAt: string;
}

interface DisposalStatsItem {
  method: string;
  count: number;
  totalValue: number;
  totalQuantity: number;
}

interface DisposalSummaryItem {
  status: string;
  count: number;
  totalValue: number;
}

const disposalMethodConfig: Record<string, { label: string; color: string }> = {
  incineration: { label: 'Incineration', color: 'bg-orange-100 text-orange-700' },
  chemical: { label: 'Chemical Treatment', color: 'bg-purple-100 text-purple-700' },
  landfill: { label: 'Approved Landfill', color: 'bg-gray-100 text-gray-700' },
  return_to_manufacturer: { label: 'Return to Manufacturer', color: 'bg-blue-100 text-blue-700' },
};

const complianceStatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  compliant: { label: 'Compliant', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  pending_review: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  non_compliant: { label: 'Non-Compliant', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function DisposalLogPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const facilityId = sessionStorage.getItem('glide_active_facility_id') || user?.facilityId || '';

  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedCompliance, setSelectedCompliance] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [detailRecord, setDetailRecord] = useState<DisposalRecord | null>(null);
  const [formData, setFormData] = useState({
    itemId: '',
    batchNumber: '',
    quantity: 0,
    unitValue: 0,
    disposalDate: new Date().toISOString().split('T')[0],
    disposalMethod: 'incineration' as DisposalRecord['disposalMethod'],
    witness: '',
    certificateNumber: '',
    reason: '',
    notes: '',
  });

  const resetForm = () => setFormData({
    itemId: '',
    batchNumber: '',
    quantity: 0,
    unitValue: 0,
    disposalDate: new Date().toISOString().split('T')[0],
    disposalMethod: 'incineration',
    witness: '',
    certificateNumber: '',
    reason: '',
    notes: '',
  });

  const { data: disposalsResponse, isLoading } = useQuery({
    queryKey: ['disposal-records', facilityId, selectedMethod, selectedCompliance, dateRange],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (facilityId) params.facilityId = facilityId;
      if (selectedMethod !== 'all') params.disposalMethod = selectedMethod;
      if (selectedCompliance !== 'all') params.complianceStatus = selectedCompliance;
      if (dateRange.from) params.startDate = dateRange.from;
      if (dateRange.to) params.endDate = dateRange.to;
      const { data } = await api.get('/disposal', { params });
      return data;
    },
    enabled: !!facilityId,
  });

  const disposalRecords: DisposalRecord[] = disposalsResponse?.data ?? [];

  const { data: statsData } = useQuery({
    queryKey: ['disposal-stats', facilityId],
    queryFn: async () => {
      const { data } = await api.get<DisposalStatsItem[]>(`/disposal/stats/${facilityId}`);
      return data;
    },
    enabled: !!facilityId,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['disposal-summary', facilityId],
    queryFn: async () => {
      const { data } = await api.get<DisposalSummaryItem[]>(`/disposal/summary/${facilityId}`);
      return data;
    },
    enabled: !!facilityId,
  });

  const stats = useMemo(() => {
    const totalDisposed = (statsData ?? []).reduce((sum, s) => sum + Number(s.count), 0);
    const totalValueWrittenOff = (statsData ?? []).reduce((sum, s) => sum + Number(s.totalValue), 0);
    const compliantCount = Number(
      (summaryData ?? []).find((s) => s.status === 'compliant')?.count ?? 0
    );
    const pendingCount = Number(
      (summaryData ?? []).find((s) => s.status === 'pending_review')?.count ?? 0
    );
    return { totalDisposed, totalValueWrittenOff, compliantCount, pendingCount };
  }, [statsData, summaryData]);

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/disposal', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disposal-records'] });
      queryClient.invalidateQueries({ queryKey: ['disposal-stats'] });
      queryClient.invalidateQueries({ queryKey: ['disposal-summary'] });
      toast.success('Disposal record created');
      setShowRecordModal(false);
      resetForm();
    },
    onError: () => {
      toast.error('Failed to create disposal record');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.put(`/disposal/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disposal-records'] });
      queryClient.invalidateQueries({ queryKey: ['disposal-stats'] });
      queryClient.invalidateQueries({ queryKey: ['disposal-summary'] });
      toast.success('Disposal approved');
      setDetailRecord(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Failed to approve disposal';
      toast.error(msg);
    },
  });

  const handleRecordDisposal = () => {
    if (!formData.itemId.trim()) { toast.error('Item ID is required'); return; }
    if (formData.quantity <= 0) { toast.error('Quantity must be greater than 0'); return; }
    createMutation.mutate({ ...formData, facilityId });
  };

  const exportCsv = useCallback(() => {
    if (disposalRecords.length === 0) { toast.error('No data to export'); return; }
    const headers = ['Medication', 'Batch', 'Quantity', 'Total Value', 'Disposal Date', 'Method', 'Disposed By', 'Witness', 'Certificate', 'Compliance', 'Reason'];
    const rows = disposalRecords.map(r => [r.item?.name || r.itemId, r.batchNumber || '-', r.quantity, Number(r.totalValue).toFixed(2), r.disposalDate, r.disposalMethod, r.disposedBy?.fullName || '-', r.witness || '-', r.certificateNumber || '-', r.complianceStatus, r.reason || '-']);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `disposal-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('Log exported');
  }, [disposalRecords]);

  if (!hasPermission('inventory.read')) {
    return <AccessDenied />;
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-7 h-7 text-red-500" />
            Disposal Log
          </h1>
          <p className="text-gray-600 mt-1">Track disposed medications and compliance records</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Log
          </button>
          <button
            onClick={() => { resetForm(); setShowRecordModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Disposal
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Package className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Disposed</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalDisposed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Value Written Off</p>
              <p className="text-xl font-bold text-gray-900">${stats.totalValueWrittenOff.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Compliant</p>
              <p className="text-xl font-bold text-green-600">{stats.compliantCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-xl font-bold text-amber-600">{stats.pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Method:</span>
          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="all">All Methods</option>
            <option value="incineration">Incineration</option>
            <option value="chemical">Chemical Treatment</option>
            <option value="landfill">Approved Landfill</option>
            <option value="return_to_manufacturer">Return to Manufacturer</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Compliance:</span>
          <select
            value={selectedCompliance}
            onChange={(e) => setSelectedCompliance(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="all">All Status</option>
            <option value="compliant">Compliant</option>
            <option value="pending_review">Pending Review</option>
            <option value="non_compliant">Non-Compliant</option>
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Medication</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disposal Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Disposed By</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Witness</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Certificate</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Compliance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <Loader2 className="w-12 h-12 mb-3 text-red-500 animate-spin" />
                      <p className="text-sm font-medium">Loading disposal records...</p>
                    </div>
                  </td>
                </tr>
              ) : disposalRecords.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <FileText className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-sm font-medium">No disposal records</p>
                      <p className="text-xs text-gray-400 mt-1">Disposal records will appear here</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {disposalRecords.map((record) => {
                const methodConfig = disposalMethodConfig[record.disposalMethod] ?? { label: record.disposalMethod, color: 'bg-gray-100 text-gray-700' };
                const complianceConfig = complianceStatusConfig[record.complianceStatus] ?? { label: record.complianceStatus, color: 'bg-gray-100 text-gray-700', icon: AlertCircle };
                const ComplianceIcon = complianceConfig.icon;
                return (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{record.item?.name || record.itemId}</p>
                        <p className="text-sm text-gray-500 font-mono">{record.batchNumber || '-'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.quantity}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">${Number(record.totalValue).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.disposalDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${methodConfig.color}`}>
                        {methodConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{record.disposedBy?.fullName || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{record.witness || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-blue-600 font-mono">{record.certificateNumber || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${complianceConfig.color}`}>
                        <ComplianceIcon className="w-3.5 h-3.5" />
                        {complianceConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setDetailRecord(record)}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => {
                            const text = `Disposal Certificate\n\nCertificate: ${record.certificateNumber || '-'}\nMedication: ${record.item?.name || record.itemId}\nBatch: ${record.batchNumber || '-'}\nQuantity: ${record.quantity}\nValue: $${Number(record.totalValue).toFixed(2)}\nDate: ${record.disposalDate}\nMethod: ${record.disposalMethod}\nDisposed By: ${record.disposedBy?.fullName || '-'}\nWitness: ${record.witness || '-'}\nCompliance: ${record.complianceStatus}`;
                            const blob = new Blob([text], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = `${record.certificateNumber || record.id}.txt`;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                            toast.success('Certificate downloaded');
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Download Certificate"
                        >
                          <Download className="w-4 h-4 text-gray-500" />
                        </button>
                        {record.complianceStatus === 'pending_review' && (
                          <button
                            onClick={() => approveMutation.mutate(record.id)}
                            disabled={approveMutation.isPending}
                            className="p-1.5 hover:bg-green-100 rounded transition-colors" title="Approve Disposal"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
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
      </div>

      {/* Record Disposal Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Record Disposal</h2>
              <button onClick={() => setShowRecordModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item ID *</label>
                <input value={formData.itemId} onChange={e => setFormData(f => ({ ...f, itemId: e.target.value }))}
                  placeholder="Enter item UUID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                  <input value={formData.batchNumber} onChange={e => setFormData(f => ({ ...f, batchNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input type="number" min={1} value={formData.quantity || ''} onChange={e => setFormData(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Value ($)</label>
                  <input type="number" min={0} step={0.01} value={formData.unitValue || ''} onChange={e => setFormData(f => ({ ...f, unitValue: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Disposal Method</label>
                  <select value={formData.disposalMethod} onChange={e => setFormData(f => ({ ...f, disposalMethod: e.target.value as DisposalRecord['disposalMethod'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500">
                    <option value="incineration">Incineration</option>
                    <option value="chemical">Chemical Treatment</option>
                    <option value="landfill">Approved Landfill</option>
                    <option value="return_to_manufacturer">Return to Manufacturer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Disposal Date *</label>
                  <input type="date" value={formData.disposalDate} onChange={e => setFormData(f => ({ ...f, disposalDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Witness</label>
                  <input value={formData.witness} onChange={e => setFormData(f => ({ ...f, witness: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Number</label>
                  <input value={formData.certificateNumber} onChange={e => setFormData(f => ({ ...f, certificateNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input value={formData.reason} onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowRecordModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleRecordDisposal}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Record Disposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {detailRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Disposal Details</h2>
              <button onClick={() => setDetailRecord(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div><span className="font-medium text-gray-600">Medication:</span> <span className="text-gray-900">{detailRecord.item?.name || detailRecord.itemId}</span></div>
              <div><span className="font-medium text-gray-600">Batch:</span> <span className="text-gray-900">{detailRecord.batchNumber || '-'}</span></div>
              <div><span className="font-medium text-gray-600">Quantity:</span> <span className="text-gray-900">{detailRecord.quantity}</span></div>
              <div><span className="font-medium text-gray-600">Total Value:</span> <span className="text-gray-900">${Number(detailRecord.totalValue).toFixed(2)}</span></div>
              <div><span className="font-medium text-gray-600">Date:</span> <span className="text-gray-900">{detailRecord.disposalDate}</span></div>
              <div><span className="font-medium text-gray-600">Method:</span> <span className="text-gray-900">{(disposalMethodConfig[detailRecord.disposalMethod] ?? { label: detailRecord.disposalMethod }).label}</span></div>
              <div><span className="font-medium text-gray-600">Disposed By:</span> <span className="text-gray-900">{detailRecord.disposedBy?.fullName || '-'}</span></div>
              <div><span className="font-medium text-gray-600">Witness:</span> <span className="text-gray-900">{detailRecord.witness || '-'}</span></div>
              <div><span className="font-medium text-gray-600">Certificate:</span> <span className="text-gray-900 font-mono">{detailRecord.certificateNumber || '-'}</span></div>
              <div><span className="font-medium text-gray-600">Reason:</span> <span className="text-gray-900">{detailRecord.reason || '-'}</span></div>
              {detailRecord.notes && (
                <div><span className="font-medium text-gray-600">Notes:</span> <span className="text-gray-900">{detailRecord.notes}</span></div>
              )}
              {detailRecord.approvedBy && (
                <div><span className="font-medium text-gray-600">Approved By:</span> <span className="text-gray-900">{detailRecord.approvedBy.fullName}</span></div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              {detailRecord.complianceStatus === 'pending_review' && (
                <button
                  onClick={() => approveMutation.mutate(detailRecord.id)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {approveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
              )}
              <button onClick={() => setDetailRecord(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
