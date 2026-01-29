import { useState, useMemo } from 'react';
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
  ChevronRight,
} from 'lucide-react';

interface DisposalRecord {
  id: string;
  medication: string;
  batch: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  disposalDate: string;
  disposalMethod: 'incineration' | 'chemical' | 'landfill' | 'return-to-manufacturer';
  witness: string;
  disposedBy: string;
  certificateNumber: string;
  complianceStatus: 'compliant' | 'pending-review' | 'non-compliant';
  reason: string;
}

const disposalRecordsData: DisposalRecord[] = [];

const disposalMethodConfig = {
  incineration: { label: 'Incineration', color: 'bg-orange-100 text-orange-700' },
  chemical: { label: 'Chemical Treatment', color: 'bg-purple-100 text-purple-700' },
  landfill: { label: 'Approved Landfill', color: 'bg-gray-100 text-gray-700' },
  'return-to-manufacturer': { label: 'Return to Manufacturer', color: 'bg-blue-100 text-blue-700' },
};

const complianceStatusConfig = {
  compliant: { label: 'Compliant', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  'pending-review': { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  'non-compliant': { label: 'Non-Compliant', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default function DisposalLogPage() {
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedCompliance, setSelectedCompliance] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [disposalRecords] = useState<DisposalRecord[]>(disposalRecordsData);

  const filteredRecords = useMemo(() => {
    return disposalRecords.filter((record) => {
      const matchesMethod = selectedMethod === 'all' || record.disposalMethod === selectedMethod;
      const matchesCompliance = selectedCompliance === 'all' || record.complianceStatus === selectedCompliance;
      return matchesMethod && matchesCompliance;
    });
  }, [selectedMethod, selectedCompliance, disposalRecords]);

  const stats = useMemo(() => {
    const totalDisposed = disposalRecords.length;
    const totalValueWrittenOff = disposalRecords.reduce((sum, r) => sum + r.totalValue, 0);
    const compliantCount = disposalRecords.filter((r) => r.complianceStatus === 'compliant').length;
    const pendingCount = disposalRecords.filter((r) => r.complianceStatus === 'pending-review').length;
    return { totalDisposed, totalValueWrittenOff, compliantCount, pendingCount };
  }, [disposalRecords]);

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
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export Log
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
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
            <option value="return-to-manufacturer">Return to Manufacturer</option>
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
            <option value="pending-review">Pending Review</option>
            <option value="non-compliant">Non-Compliant</option>
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
              {filteredRecords.length === 0 ? (
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
              {filteredRecords.map((record) => {
                const methodConfig = disposalMethodConfig[record.disposalMethod];
                const complianceConfig = complianceStatusConfig[record.complianceStatus];
                const ComplianceIcon = complianceConfig.icon;
                return (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{record.medication}</p>
                        <p className="text-sm text-gray-500 font-mono">{record.batch}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.quantity}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">${record.totalValue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{record.disposalDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${methodConfig.color}`}>
                        {methodConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{record.disposedBy}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{record.witness}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm text-blue-600 font-mono">{record.certificateNumber}</span>
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
                        <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="View Details">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Download Certificate">
                          <Download className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}