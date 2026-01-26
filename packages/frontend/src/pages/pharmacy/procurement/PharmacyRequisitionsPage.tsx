import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  Send,
  AlertTriangle,
  Filter,
  Trash2,
  Edit2,
  ChevronRight,
  Package,
  TrendingDown,
} from 'lucide-react';

type RequisitionStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
type Urgency = 'Normal' | 'Urgent' | 'Critical';

interface RequisitionItem {
  id: string;
  medication: string;
  currentStock: number;
  reorderLevel: number;
  requestedQty: number;
  unitPrice: number;
}

interface Requisition {
  id: string;
  requisitionNo: string;
  createdDate: string;
  status: RequisitionStatus;
  urgency: Urgency;
  items: RequisitionItem[];
  createdBy: string;
  notes: string;
}

const mockRequisitions: Requisition[] = [
  {
    id: '1',
    requisitionNo: 'REQ-2024-001',
    createdDate: '2024-01-15',
    status: 'Draft',
    urgency: 'Normal',
    items: [
      { id: '1', medication: 'Amoxicillin 500mg', currentStock: 45, reorderLevel: 100, requestedQty: 200, unitPrice: 15 },
      { id: '2', medication: 'Paracetamol 1g', currentStock: 80, reorderLevel: 150, requestedQty: 300, unitPrice: 5 },
    ],
    createdBy: 'John Pharmacist',
    notes: 'Regular restocking',
  },
  {
    id: '2',
    requisitionNo: 'REQ-2024-002',
    createdDate: '2024-01-14',
    status: 'Submitted',
    urgency: 'Urgent',
    items: [
      { id: '3', medication: 'Azithromycin 250mg', currentStock: 0, reorderLevel: 50, requestedQty: 100, unitPrice: 45 },
    ],
    createdBy: 'John Pharmacist',
    notes: 'Out of stock - urgent need',
  },
  {
    id: '3',
    requisitionNo: 'REQ-2024-003',
    createdDate: '2024-01-12',
    status: 'Approved',
    urgency: 'Normal',
    items: [
      { id: '4', medication: 'Metformin 500mg', currentStock: 120, reorderLevel: 150, requestedQty: 200, unitPrice: 12 },
      { id: '5', medication: 'Lisinopril 10mg', currentStock: 25, reorderLevel: 50, requestedQty: 100, unitPrice: 25 },
    ],
    createdBy: 'Mary Pharmacist',
    notes: 'Approved by Procurement Manager',
  },
];

const autoReorderSuggestions = [
  { medication: 'Azithromycin 250mg', currentStock: 0, reorderLevel: 50, suggestedQty: 100 },
  { medication: 'Lisinopril 10mg', currentStock: 25, reorderLevel: 50, suggestedQty: 75 },
  { medication: 'Paracetamol 1g', currentStock: 45, reorderLevel: 100, suggestedQty: 150 },
];

export default function PharmacyRequisitionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'All'>('All');
  const [showNewRequisition, setShowNewRequisition] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);

  const filteredRequisitions = useMemo(() => {
    return mockRequisitions.filter((req) => {
      const matchesSearch =
        req.requisitionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.items.some((item) => item.medication.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: mockRequisitions.length,
    draft: mockRequisitions.filter((r) => r.status === 'Draft').length,
    submitted: mockRequisitions.filter((r) => r.status === 'Submitted').length,
    approved: mockRequisitions.filter((r) => r.status === 'Approved').length,
  }), []);

  const getStatusColor = (status: RequisitionStatus) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700';
      case 'Submitted': return 'bg-blue-100 text-blue-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
    }
  };

  const getUrgencyColor = (urgency: Urgency) => {
    switch (urgency) {
      case 'Normal': return 'bg-gray-100 text-gray-600';
      case 'Urgent': return 'bg-orange-100 text-orange-700';
      case 'Critical': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: RequisitionStatus) => {
    switch (status) {
      case 'Draft': return <FileText className="w-4 h-4" />;
      case 'Submitted': return <Clock className="w-4 h-4" />;
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Rejected': return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drug Requisitions</h1>
          <p className="text-gray-600">Create and manage medication requisition requests</p>
        </div>
        <button
          onClick={() => setShowNewRequisition(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Requisition
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Requisitions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Edit2 className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-700">{stats.draft}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Submitted</p>
              <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by requisition number or medication..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as RequisitionStatus | 'All')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Requisitions Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Requisition</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Est. Value</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Urgency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRequisitions.map((req) => {
                    const totalValue = req.items.reduce((sum, item) => sum + item.requestedQty * item.unitPrice, 0);
                    return (
                      <tr
                        key={req.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedRequisition?.id === req.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedRequisition(req)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{req.requisitionNo}</p>
                            <p className="text-sm text-gray-500">{req.createdBy}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{req.createdDate}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                            {req.items.length} items
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          KES {totalValue.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(req.urgency)}`}>
                            {req.urgency}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(req.status)}`}>
                            {getStatusIcon(req.status)}
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {req.status === 'Draft' && (
                              <>
                                <button className="p-1.5 hover:bg-blue-100 rounded text-blue-600">
                                  <Send className="w-4 h-4" />
                                </button>
                                <button className="p-1.5 hover:bg-red-100 rounded text-red-600">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button className="p-1.5 hover:bg-gray-100 rounded">
                              <ChevronRight className="w-4 h-4 text-gray-500" />
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

        {/* Auto-Reorder Suggestions Panel */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-orange-50">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-gray-900">Auto-Reorder Suggestions</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">Based on current stock levels</p>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {autoReorderSuggestions.map((item, index) => (
              <div key={index} className="p-3 border border-orange-200 rounded-lg bg-orange-50/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{item.medication}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">Stock: {item.currentStock}</span>
                      <span className="text-xs text-gray-400">|</span>
                      <span className="text-xs text-gray-500">Min: {item.reorderLevel}</span>
                    </div>
                  </div>
                  <Package className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-medium text-orange-700">
                    Suggest: {item.suggestedQty} units
                  </span>
                  <button className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700">
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-200">
            <button className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
              Add All to Requisition
            </button>
          </div>
        </div>
      </div>

      {/* New Requisition Modal */}
      {showNewRequisition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Requisition</h2>
              <button
                onClick={() => setShowNewRequisition(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency Level</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Medications</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search medications to add..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500 text-center">No items added yet. Search and add medications above.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    placeholder="Add any notes or justification..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewRequisition(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Save as Draft
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
