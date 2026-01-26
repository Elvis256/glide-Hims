import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Search,
  Plus,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Package,
  AlertTriangle,
  FileText,
  Eye,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
} from 'lucide-react';

interface Adjustment {
  id: string;
  adjustmentNo: string;
  itemName: string;
  itemSku: string;
  type: 'breakage' | 'damage' | 'loss' | 'found' | 'correction' | 'theft';
  quantityBefore: number;
  quantityAfter: number;
  difference: number;
  unit: string;
  reason: string;
  location: string;
  requestedBy: string;
  requestDate: string;
  approvedBy?: string;
  approvalDate?: string;
  status: 'pending' | 'approved' | 'rejected';
  value: number;
}

const mockAdjustments: Adjustment[] = [
  { id: '1', adjustmentNo: 'ADJ-2025-0145', itemName: 'Surgical Gloves (Medium)', itemSku: 'MS-001', type: 'breakage', quantityBefore: 250, quantityAfter: 240, difference: -10, unit: 'Pairs', reason: 'Damaged during handling - torn packaging', location: 'Store A', requestedBy: 'John Kamau', requestDate: '2025-01-23', status: 'pending', value: 500 },
  { id: '2', adjustmentNo: 'ADJ-2025-0144', itemName: 'IV Cannula 22G', itemSku: 'MS-002', type: 'damage', quantityBefore: 200, quantityAfter: 185, difference: -15, unit: 'Pieces', reason: 'Water damage from roof leak', location: 'Store A', requestedBy: 'Grace Akinyi', requestDate: '2025-01-22', approvedBy: 'Mary Wanjiku', approvalDate: '2025-01-22', status: 'approved', value: 1200 },
  { id: '3', adjustmentNo: 'ADJ-2025-0143', itemName: 'Syringes 10ml', itemSku: 'MS-004', type: 'found', quantityBefore: 450, quantityAfter: 475, difference: 25, unit: 'Pieces', reason: 'Found during stock take - miscounted', location: 'Store B', requestedBy: 'Peter Ochieng', requestDate: '2025-01-21', approvedBy: 'Sarah Muthoni', approvalDate: '2025-01-22', status: 'approved', value: 375 },
  { id: '4', adjustmentNo: 'ADJ-2025-0142', itemName: 'Gauze Pads Sterile', itemSku: 'MS-005', type: 'loss', quantityBefore: 300, quantityAfter: 280, difference: -20, unit: 'Pieces', reason: 'Unaccounted loss - investigation pending', location: 'Store A', requestedBy: 'Faith Njeri', requestDate: '2025-01-20', status: 'pending', value: 800 },
  { id: '5', adjustmentNo: 'ADJ-2025-0141', itemName: 'Bandage Rolls', itemSku: 'MS-006', type: 'correction', quantityBefore: 145, quantityAfter: 150, difference: 5, unit: 'Rolls', reason: 'System entry error correction', location: 'Store C', requestedBy: 'David Kiprop', requestDate: '2025-01-19', approvedBy: 'James Mutua', approvalDate: '2025-01-20', status: 'approved', value: 150 },
  { id: '6', adjustmentNo: 'ADJ-2025-0140', itemName: 'Patient Monitor Parts', itemSku: 'EQ-015', type: 'theft', quantityBefore: 8, quantityAfter: 6, difference: -2, unit: 'Units', reason: 'Suspected theft - police report filed', location: 'Store B', requestedBy: 'John Kamau', requestDate: '2025-01-18', status: 'rejected', value: 25000 },
];

const adjustmentReasons = [
  { value: 'breakage', label: 'Breakage', icon: Package, color: 'text-orange-600 bg-orange-100' },
  { value: 'damage', label: 'Damage', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  { value: 'loss', label: 'Loss', icon: Minus, color: 'text-red-600 bg-red-100' },
  { value: 'found', label: 'Found', icon: Plus, color: 'text-green-600 bg-green-100' },
  { value: 'correction', label: 'Correction', icon: RefreshCw, color: 'text-blue-600 bg-blue-100' },
  { value: 'theft', label: 'Theft', icon: XCircle, color: 'text-red-600 bg-red-100' },
];

export default function StockAdjustmentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewAdjustment, setShowNewAdjustment] = useState(false);

  const filteredAdjustments = useMemo(() => {
    return mockAdjustments.filter((adj) => {
      const matchesSearch = 
        adj.adjustmentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adj.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        adj.itemSku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || adj.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || adj.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [searchTerm, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const pending = mockAdjustments.filter((a) => a.status === 'pending').length;
    const negativeAdj = mockAdjustments.filter((a) => a.difference < 0).reduce((sum, a) => sum + Math.abs(a.difference), 0);
    const positiveAdj = mockAdjustments.filter((a) => a.difference > 0).reduce((sum, a) => sum + a.difference, 0);
    const totalLossValue = mockAdjustments.filter((a) => a.difference < 0 && a.status === 'approved').reduce((sum, a) => sum + a.value, 0);
    return { pending, negativeAdj, positiveAdj, totalLossValue };
  }, []);

  const getTypeBadge = (type: string) => {
    const reason = adjustmentReasons.find((r) => r.value === type);
    if (!reason) return null;
    return (
      <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${reason.color}`}>
        <reason.icon className="w-3 h-3" />
        {reason.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Adjustments</h1>
          <p className="text-gray-600">Manage stock corrections, breakage, damage, and losses</p>
        </div>
        <button
          onClick={() => setShowNewAdjustment(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Adjustment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Stock Reductions</p>
              <p className="text-2xl font-bold text-red-700">{stats.negativeAdj}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Stock Additions</p>
              <p className="text-2xl font-bold text-green-700">{stats.positiveAdj}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">MTD Loss Value (KES)</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalLossValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Reason Filters */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Quick filter:</span>
        {adjustmentReasons.map((reason) => (
          <button
            key={reason.value}
            onClick={() => setTypeFilter(typeFilter === reason.value ? 'all' : reason.value)}
            className={`flex items-center gap-1 px-3 py-1 text-sm rounded-lg border transition-colors ${
              typeFilter === reason.value ? reason.color + ' border-current' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <reason.icon className="w-3 h-3" />
            {reason.label}
          </button>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by adjustment number, item name, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Adjustments Table */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Adjustment No</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity Change</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Requested</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAdjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-blue-600">{adj.adjustmentNo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{adj.itemName}</p>
                      <p className="text-sm text-gray-500">SKU: {adj.itemSku} • {adj.location}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{getTypeBadge(adj.type)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{adj.quantityBefore}</span>
                      <span className="text-gray-400">→</span>
                      <span className="font-medium">{adj.quantityAfter}</span>
                      <span className={`font-medium ${adj.difference < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ({adj.difference > 0 ? '+' : ''}{adj.difference})
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-600 max-w-xs truncate" title={adj.reason}>
                      {adj.reason}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900">{adj.requestedBy}</p>
                    <p className="text-sm text-gray-500">{adj.requestDate}</p>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(adj.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button className="p-1 hover:bg-gray-100 rounded" title="View">
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      {adj.status === 'pending' && (
                        <>
                          <button className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                            Approve
                          </button>
                          <button className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200">
                            Reject
                          </button>
                        </>
                      )}
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {filteredAdjustments.length} of {mockAdjustments.length} adjustments
        </div>
      </div>

      {/* New Adjustment Modal */}
      {showNewAdjustment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Stock Adjustment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <input
                  type="text"
                  placeholder="Search for item..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select type</option>
                  {adjustmentReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Quantity</label>
                  <input
                    type="number"
                    disabled
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Quantity</label>
                  <input
                    type="number"
                    placeholder="Enter new quantity"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason/Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Provide detailed reason for adjustment..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Documents</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Click to upload or drag and drop</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewAdjustment(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
