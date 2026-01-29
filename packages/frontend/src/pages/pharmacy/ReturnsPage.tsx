import React, { useState, useMemo } from 'react';
import {
  Search,
  RotateCcw,
  User,
  Package,
  Trash2,
  DollarSign,
  AlertTriangle,
  Pill,
  Filter,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
} from 'lucide-react';

type ReturnReason = 'Wrong medication' | 'Adverse reaction' | 'Expired' | 'Damaged' | 'Other';
type ReturnStatus = 'Pending' | 'Approved' | 'Rejected' | 'Processed';
type ReturnAction = 'Return to Stock' | 'Dispose';

interface ReturnItem {
  id: string;
  returnNumber: string;
  patientName: string;
  patientId: string;
  medication: string;
  quantity: number;
  batchNumber: string;
  reason: ReturnReason;
  status: ReturnStatus;
  action: ReturnAction;
  refundAmount: number;
  returnDate: string;
  processedBy: string | null;
  notes: string;
}

const mockReturns: ReturnItem[] = [];

const reasons: ReturnReason[] = ['Wrong medication', 'Adverse reaction', 'Expired', 'Damaged', 'Other'];

export default function ReturnsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ReturnStatus | 'All'>('All');
  const [selectedReason, setSelectedReason] = useState<ReturnReason | 'All'>('All');

  const filteredReturns = useMemo(() => {
    return mockReturns.filter((item) => {
      const matchesSearch =
        item.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.returnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.medication.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;
      const matchesReason = selectedReason === 'All' || item.reason === selectedReason;
      return matchesSearch && matchesStatus && matchesReason;
    });
  }, [searchTerm, selectedStatus, selectedReason]);

  const returnStats = useMemo(() => ({
    total: mockReturns.length,
    pending: mockReturns.filter((r) => r.status === 'Pending').length,
    totalRefunds: mockReturns.filter((r) => r.status === 'Processed').reduce((acc, r) => acc + r.refundAmount, 0),
    returnedToStock: mockReturns.filter((r) => r.action === 'Return to Stock' && r.status === 'Processed').length,
    disposed: mockReturns.filter((r) => r.action === 'Dispose' && r.status === 'Processed').length,
  }), []);

  const getStatusIcon = (status: ReturnStatus) => {
    switch (status) {
      case 'Pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'Approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'Processed':
        return <Package className="w-4 h-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: ReturnStatus) => {
    switch (status) {
      case 'Pending':
        return 'bg-amber-100 text-amber-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'Processed':
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getReasonColor = (reason: ReturnReason) => {
    switch (reason) {
      case 'Wrong medication':
        return 'bg-purple-100 text-purple-800';
      case 'Adverse reaction':
        return 'bg-red-100 text-red-800';
      case 'Expired':
        return 'bg-orange-100 text-orange-800';
      case 'Damaged':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Returns</h1>
          <p className="text-gray-600">Process customer returns and refunds</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          New Return
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <RotateCcw className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Returns</p>
              <p className="text-2xl font-bold text-gray-900">{returnStats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{returnStats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Refunds</p>
              <p className="text-2xl font-bold text-green-600">KES {returnStats.totalRefunds.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Restocked</p>
              <p className="text-2xl font-bold text-purple-600">{returnStats.returnedToStock}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Disposed</p>
              <p className="text-2xl font-bold text-red-600">{returnStats.disposed}</p>
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
              placeholder="Search by patient name, return number, or medication..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ReturnStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Processed">Processed</option>
            </select>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value as ReturnReason | 'All')}
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

      {/* Returns Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Return #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Medication</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Refund</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReturns.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center text-gray-500">
                      <RotateCcw className="w-12 h-12 mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No returns found</p>
                      <p className="text-sm">Returns will appear here when processed</p>
                    </div>
                  </td>
                </tr>
              )}
              {filteredReturns.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium text-blue-600">{item.returnNumber}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.patientName}</p>
                        <p className="text-sm text-gray-500">{item.patientId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-900">{item.medication}</p>
                        <p className="text-xs text-gray-500">{item.batchNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{item.quantity}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReasonColor(item.reason)}`}>
                      {item.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.action === 'Return to Stock' ? (
                        <Package className="w-4 h-4 text-green-600" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm text-gray-700">{item.action}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${item.refundAmount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      KES {item.refundAmount.toLocaleString()}
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
                  <td className="px-4 py-3 text-gray-700">{item.returnDate}</td>
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
                      {item.status === 'Approved' && (
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                          Process
                        </button>
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
