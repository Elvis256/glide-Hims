import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  User,
  Building2,
  Calendar,
  DollarSign,
  Package,
  ChevronDown,
  MoreVertical,
} from 'lucide-react';

type RequisitionStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';

interface RequisitionItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedPrice: number;
}

interface Requisition {
  id: string;
  reqNumber: string;
  title: string;
  department: string;
  requester: string;
  status: RequisitionStatus;
  items: RequisitionItem[];
  totalEstimatedCost: number;
  createdDate: string;
  submittedDate?: string;
  approvedDate?: string;
  approvalStage?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  notes?: string;
}

const mockRequisitions: Requisition[] = [
  {
    id: '1',
    reqNumber: 'REQ-2024-001',
    title: 'Medical Supplies Q1',
    department: 'Pharmacy',
    requester: 'Dr. Sarah Johnson',
    status: 'Approved',
    items: [
      { id: '1', name: 'Surgical Gloves (Box)', quantity: 100, unit: 'boxes', estimatedPrice: 15 },
      { id: '2', name: 'Syringes 5ml', quantity: 500, unit: 'pcs', estimatedPrice: 0.5 },
      { id: '3', name: 'Bandages', quantity: 200, unit: 'rolls', estimatedPrice: 3 },
    ],
    totalEstimatedCost: 2350,
    createdDate: '2024-01-15',
    submittedDate: '2024-01-16',
    approvedDate: '2024-01-18',
    approvalStage: 'Completed',
    priority: 'High',
  },
  {
    id: '2',
    reqNumber: 'REQ-2024-002',
    title: 'Laboratory Equipment',
    department: 'Laboratory',
    requester: 'Dr. Michael Chen',
    status: 'Submitted',
    items: [
      { id: '1', name: 'Microscope Slides', quantity: 1000, unit: 'pcs', estimatedPrice: 0.1 },
      { id: '2', name: 'Test Tubes', quantity: 500, unit: 'pcs', estimatedPrice: 0.25 },
    ],
    totalEstimatedCost: 225,
    createdDate: '2024-01-18',
    submittedDate: '2024-01-19',
    approvalStage: 'Manager Review',
    priority: 'Medium',
  },
  {
    id: '3',
    reqNumber: 'REQ-2024-003',
    title: 'Office Supplies',
    department: 'Administration',
    requester: 'Jane Smith',
    status: 'Draft',
    items: [
      { id: '1', name: 'Printer Paper (Ream)', quantity: 50, unit: 'reams', estimatedPrice: 8 },
      { id: '2', name: 'Ink Cartridges', quantity: 10, unit: 'pcs', estimatedPrice: 45 },
    ],
    totalEstimatedCost: 850,
    createdDate: '2024-01-20',
    priority: 'Low',
  },
  {
    id: '4',
    reqNumber: 'REQ-2024-004',
    title: 'Emergency Medical Kit',
    department: 'Emergency',
    requester: 'Dr. Emily Davis',
    status: 'Rejected',
    items: [
      { id: '1', name: 'Defibrillator', quantity: 2, unit: 'units', estimatedPrice: 2500 },
    ],
    totalEstimatedCost: 5000,
    createdDate: '2024-01-10',
    submittedDate: '2024-01-11',
    priority: 'Urgent',
    notes: 'Budget exceeded for this quarter',
  },
  {
    id: '5',
    reqNumber: 'REQ-2024-005',
    title: 'Cleaning Supplies',
    department: 'Housekeeping',
    requester: 'Tom Wilson',
    status: 'Submitted',
    items: [
      { id: '1', name: 'Disinfectant (Gallon)', quantity: 20, unit: 'gallons', estimatedPrice: 25 },
      { id: '2', name: 'Mops', quantity: 15, unit: 'pcs', estimatedPrice: 12 },
      { id: '3', name: 'Trash Bags (Box)', quantity: 30, unit: 'boxes', estimatedPrice: 18 },
    ],
    totalEstimatedCost: 1220,
    createdDate: '2024-01-21',
    submittedDate: '2024-01-21',
    approvalStage: 'Finance Review',
    priority: 'Medium',
  },
];

const statusConfig: Record<RequisitionStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  Draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Edit className="w-3 h-3" /> },
  Submitted: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Clock className="w-3 h-3" /> },
  Approved: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  Rejected: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" /> },
};

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Low: { color: 'text-gray-600', bg: 'bg-gray-100' },
  Medium: { color: 'text-yellow-600', bg: 'bg-yellow-100' },
  High: { color: 'text-orange-600', bg: 'bg-orange-100' },
  Urgent: { color: 'text-red-600', bg: 'bg-red-100' },
};

export default function RequisitionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'All'>('All');
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredRequisitions = useMemo(() => {
    return mockRequisitions.filter((req) => {
      const matchesSearch =
        req.reqNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    return mockRequisitions.reduce(
      (acc, req) => {
        acc[req.status] = (acc[req.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, []);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Purchase Requisitions</h1>
              <p className="text-sm text-gray-500">Manage and track purchase requests</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Requisition
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search requisitions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {(['All', 'Draft', 'Submitted', 'Approved', 'Rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
                  {status !== 'All' && statusCounts[status] && (
                    <span className="ml-1.5 text-xs">({statusCounts[status]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Requisition List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {filteredRequisitions.map((req) => (
              <div
                key={req.id}
                onClick={() => setSelectedRequisition(req)}
                className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedRequisition?.id === req.id ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-gray-500">{req.reqNumber}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[req.status].bg} ${statusConfig[req.status].color}`}
                      >
                        {statusConfig[req.status].icon}
                        {req.status}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig[req.priority].bg} ${priorityConfig[req.priority].color}`}
                      >
                        {req.priority}
                      </span>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">{req.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {req.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {req.requester}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {req.createdDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        {req.items.length} items
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-lg font-semibold text-gray-900">
                      <DollarSign className="w-4 h-4" />
                      {req.totalEstimatedCost.toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-500">Estimated Cost</p>
                  </div>
                </div>
                {req.approvalStage && req.status === 'Submitted' && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="text-gray-600">Current Stage:</span>
                      <span className="font-medium text-blue-600">{req.approvalStage}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedRequisition && (
          <div className="w-96 border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Requisition Details</h2>
                <button
                  onClick={() => setSelectedRequisition(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Requisition Number</p>
                <p className="font-mono font-medium">{selectedRequisition.reqNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Title</p>
                <p className="font-medium">{selectedRequisition.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Department</p>
                  <p className="text-sm">{selectedRequisition.department}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Requester</p>
                  <p className="text-sm">{selectedRequisition.requester}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-2">
                  {selectedRequisition.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                      <span>{item.name}</span>
                      <span className="text-gray-600">
                        {item.quantity} {item.unit} × ${item.estimatedPrice}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t font-medium">
                  <span>Total Estimated</span>
                  <span>${selectedRequisition.totalEstimatedCost.toLocaleString()}</span>
                </div>
              </div>

              {/* Approval Workflow */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Approval Workflow</p>
                <div className="space-y-2">
                  {['Submitted', 'Manager Review', 'Finance Review', 'Director Approval', 'Completed'].map(
                    (stage, idx) => {
                      const isCompleted =
                        selectedRequisition.status === 'Approved' ||
                        (selectedRequisition.approvalStage &&
                          ['Submitted', 'Manager Review', 'Finance Review', 'Director Approval', 'Completed'].indexOf(
                            selectedRequisition.approvalStage
                          ) > idx);
                      const isCurrent = selectedRequisition.approvalStage === stage;
                      return (
                        <div key={stage} className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? 'bg-green-100 text-green-600'
                                : isCurrent
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <span className="text-xs">{idx + 1}</span>
                            )}
                          </div>
                          <span
                            className={`text-sm ${isCurrent ? 'font-medium text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}
                          >
                            {stage}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedRequisition.status === 'Draft' && (
                  <>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                      <Send className="w-4 h-4" />
                      Submit for Approval
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Edit className="w-4 h-4" />
                      Edit Requisition
                    </button>
                  </>
                )}
                {selectedRequisition.status === 'Approved' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <ArrowRight className="w-4 h-4" />
                    Convert to RFQ
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Eye className="w-4 h-4" />
                  View Full Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create New Requisition</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter requisition title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option>Select department</option>
                    <option>Pharmacy</option>
                    <option>Laboratory</option>
                    <option>Administration</option>
                    <option>Emergency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Item Name</th>
                        <th className="text-left px-3 py-2">Qty</th>
                        <th className="text-left px-3 py-2">Unit</th>
                        <th className="text-left px-3 py-2">Est. Price</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-3 py-2">
                          <input type="text" className="w-full px-2 py-1 border rounded" placeholder="Item name" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" className="w-16 px-2 py-1 border rounded" placeholder="0" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" className="w-16 px-2 py-1 border rounded" placeholder="pcs" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" className="w-20 px-2 py-1 border rounded" placeholder="0.00" />
                        </td>
                        <td className="px-3 py-2">
                          <button className="text-red-500 hover:text-red-700">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button className="mt-2 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Additional notes or justification"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Save as Draft
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
