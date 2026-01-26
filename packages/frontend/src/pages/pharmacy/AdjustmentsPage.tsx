import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Minus,
  User,
  Package,
  AlertTriangle,
  Pill,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  Scale,
  History,
} from 'lucide-react';

type AdjustmentReason = 'Breakage' | 'Theft' | 'Counting error' | 'Expiry' | 'Damage' | 'Found stock' | 'Other';
type AdjustmentType = 'Increase' | 'Decrease';
type AdjustmentStatus = 'Pending' | 'Approved' | 'Rejected';

interface Adjustment {
  id: string;
  adjustmentNumber: string;
  medication: string;
  batchNumber: string;
  type: AdjustmentType;
  reason: AdjustmentReason;
  beforeQty: number;
  afterQty: number;
  adjustmentQty: number;
  unitCost: number;
  adjustmentValue: number;
  status: AdjustmentStatus;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string;
}

const mockAdjustments: Adjustment[] = [
  {
    id: 'ADJ001',
    adjustmentNumber: 'ADJ-2024-001',
    medication: 'Amoxicillin 500mg',
    batchNumber: 'AMX-2024-001',
    type: 'Decrease',
    reason: 'Breakage',
    beforeQty: 150,
    afterQty: 145,
    adjustmentQty: 5,
    unitCost: 15,
    adjustmentValue: 75,
    status: 'Approved',
    createdBy: 'Jane Pharmacist',
    createdAt: '2024-01-15 09:30',
    approvedBy: 'Dr. Head Pharmacist',
    approvedAt: '2024-01-15 10:15',
    notes: '5 tablets broken during shelf organization',
  },
  {
    id: 'ADJ002',
    adjustmentNumber: 'ADJ-2024-002',
    medication: 'Paracetamol 1g',
    batchNumber: 'PCM-2023-045',
    type: 'Decrease',
    reason: 'Expiry',
    beforeQty: 100,
    afterQty: 45,
    adjustmentQty: 55,
    unitCost: 5,
    adjustmentValue: 275,
    status: 'Pending',
    createdBy: 'John Pharmacist',
    createdAt: '2024-01-15 11:00',
    approvedBy: null,
    approvedAt: null,
    notes: 'Batch expired on 2024-01-10',
  },
  {
    id: 'ADJ003',
    adjustmentNumber: 'ADJ-2024-003',
    medication: 'Metformin 500mg',
    batchNumber: 'MET-2024-012',
    type: 'Increase',
    reason: 'Found stock',
    beforeQty: 200,
    afterQty: 220,
    adjustmentQty: 20,
    unitCost: 12,
    adjustmentValue: 240,
    status: 'Approved',
    createdBy: 'Jane Pharmacist',
    createdAt: '2024-01-14 14:30',
    approvedBy: 'Dr. Head Pharmacist',
    approvedAt: '2024-01-14 15:00',
    notes: 'Found stock in back storage area',
  },
  {
    id: 'ADJ004',
    adjustmentNumber: 'ADJ-2024-004',
    medication: 'Lisinopril 10mg',
    batchNumber: 'LIS-2023-089',
    type: 'Decrease',
    reason: 'Counting error',
    beforeQty: 50,
    afterQty: 25,
    adjustmentQty: 25,
    unitCost: 25,
    adjustmentValue: 625,
    status: 'Rejected',
    createdBy: 'New Staff',
    createdAt: '2024-01-13 16:00',
    approvedBy: 'Dr. Head Pharmacist',
    approvedAt: '2024-01-13 17:00',
    notes: 'Rejected - needs physical recount first',
  },
  {
    id: 'ADJ005',
    adjustmentNumber: 'ADJ-2024-005',
    medication: 'Salbutamol Inhaler',
    batchNumber: 'SAL-2024-005',
    type: 'Decrease',
    reason: 'Theft',
    beforeQty: 80,
    afterQty: 78,
    adjustmentQty: 2,
    unitCost: 350,
    adjustmentValue: 700,
    status: 'Pending',
    createdBy: 'Jane Pharmacist',
    createdAt: '2024-01-15 08:00',
    approvedBy: null,
    approvedAt: null,
    notes: 'Suspected theft - security notified',
  },
];

const reasons: AdjustmentReason[] = ['Breakage', 'Theft', 'Counting error', 'Expiry', 'Damage', 'Found stock', 'Other'];

export default function AdjustmentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AdjustmentStatus | 'All'>('All');
  const [selectedType, setSelectedType] = useState<AdjustmentType | 'All'>('All');
  const [selectedReason, setSelectedReason] = useState<AdjustmentReason | 'All'>('All');

  const filteredAdjustments = useMemo(() => {
    return mockAdjustments.filter((item) => {
      const matchesSearch =
        item.medication.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.adjustmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;
      const matchesType = selectedType === 'All' || item.type === selectedType;
      const matchesReason = selectedReason === 'All' || item.reason === selectedReason;
      return matchesSearch && matchesStatus && matchesType && matchesReason;
    });
  }, [searchTerm, selectedStatus, selectedType, selectedReason]);

  const adjustmentStats = useMemo(() => ({
    total: mockAdjustments.length,
    pending: mockAdjustments.filter((a) => a.status === 'Pending').length,
    increases: mockAdjustments.filter((a) => a.type === 'Increase').reduce((acc, a) => acc + a.adjustmentValue, 0),
    decreases: mockAdjustments.filter((a) => a.type === 'Decrease').reduce((acc, a) => acc + a.adjustmentValue, 0),
  }), []);

  const getStatusIcon = (status: AdjustmentStatus) => {
    switch (status) {
      case 'Pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'Approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: AdjustmentStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
    }
  };

  const getReasonColor = (reason: AdjustmentReason) => {
    switch (reason) {
      case 'Breakage':
        return 'bg-orange-100 text-orange-800';
      case 'Theft':
        return 'bg-red-100 text-red-800';
      case 'Counting error':
        return 'bg-blue-100 text-blue-800';
      case 'Expiry':
        return 'bg-purple-100 text-purple-800';
      case 'Damage':
        return 'bg-gray-100 text-gray-800';
      case 'Found stock':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Adjustments</h1>
          <p className="text-gray-600">Record and approve inventory adjustments</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Scale className="w-4 h-4" />
          New Adjustment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Adjustments</p>
              <p className="text-2xl font-bold text-gray-900">{adjustmentStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-amber-600">{adjustmentStats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Increases</p>
              <p className="text-2xl font-bold text-green-600">+KES {adjustmentStats.increases.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Stock Decreases</p>
              <p className="text-2xl font-bold text-red-600">-KES {adjustmentStats.decreases.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by medication, adjustment number, or batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as AdjustmentStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as AdjustmentType | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Types</option>
              <option value="Increase">Increase</option>
              <option value="Decrease">Decrease</option>
            </select>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as AdjustmentReason | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Reasons</option>
              {reasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Adjustment #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Medication</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Before</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">After</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAdjustments.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-blue-600">{item.adjustmentNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Pill className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.medication}</p>
                        <p className="text-sm text-gray-500">{item.batchNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.type === 'Increase' ? (
                        <Plus className="w-4 h-4 text-green-600" />
                      ) : (
                        <Minus className="w-4 h-4 text-red-600" />
                      )}
                      <span className={`font-medium ${item.type === 'Increase' ? 'text-green-600' : 'text-red-600'}`}>
                        {item.type}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReasonColor(item.reason)}`}>
                      {item.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700">{item.beforeQty}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{item.afterQty}</span>
                      <span className={`text-sm ${item.type === 'Increase' ? 'text-green-600' : 'text-red-600'}`}>
                        ({item.type === 'Increase' ? '+' : '-'}{item.adjustmentQty})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${item.type === 'Increase' ? 'text-green-600' : 'text-red-600'}`}>
                      {item.type === 'Increase' ? '+' : '-'}KES {item.adjustmentValue.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(item.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-gray-900">{item.createdBy}</p>
                      <p className="text-xs text-gray-500">{item.createdAt}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.status === 'Pending' && (
                        <>
                          <button className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                            Approve
                          </button>
                          <button className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors">
                            Reject
                          </button>
                        </>
                      )}
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <FileText className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}