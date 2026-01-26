import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FileQuestion,
  Clock,
  CheckCircle,
  Send,
  Building2,
  Calendar,
  Filter,
  Trash2,
  Eye,
  ChevronRight,
  Users,
  AlertCircle,
} from 'lucide-react';

type RFQStatus = 'Draft' | 'Sent' | 'Responses Received' | 'Closed' | 'Expired';

interface RFQItem {
  id: string;
  medication: string;
  quantity: number;
  specifications: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string;
  responded: boolean;
  responseDate?: string;
}

interface RFQ {
  id: string;
  rfqNo: string;
  createdDate: string;
  deadline: string;
  status: RFQStatus;
  items: RFQItem[];
  suppliers: Supplier[];
  notes: string;
}

const mockRFQs: RFQ[] = [
  {
    id: '1',
    rfqNo: 'RFQ-2024-001',
    createdDate: '2024-01-15',
    deadline: '2024-01-25',
    status: 'Responses Received',
    items: [
      { id: '1', medication: 'Amoxicillin 500mg', quantity: 500, specifications: 'Capsules, blister pack' },
      { id: '2', medication: 'Azithromycin 250mg', quantity: 200, specifications: 'Tablets, bottle' },
    ],
    suppliers: [
      { id: '1', name: 'PharmaCorp Kenya', email: 'sales@pharmacorp.ke', responded: true, responseDate: '2024-01-18' },
      { id: '2', name: 'MediSupply Ltd', email: 'orders@medisupply.co.ke', responded: true, responseDate: '2024-01-19' },
      { id: '3', name: 'HealthCare Distributors', email: 'info@hcd.ke', responded: false },
    ],
    notes: 'Urgent restock needed',
  },
  {
    id: '2',
    rfqNo: 'RFQ-2024-002',
    createdDate: '2024-01-14',
    deadline: '2024-01-28',
    status: 'Sent',
    items: [
      { id: '3', medication: 'Metformin 500mg', quantity: 1000, specifications: 'Extended release tablets' },
      { id: '4', medication: 'Lisinopril 10mg', quantity: 300, specifications: 'Tablets' },
      { id: '5', medication: 'Omeprazole 20mg', quantity: 500, specifications: 'Capsules' },
    ],
    suppliers: [
      { id: '1', name: 'PharmaCorp Kenya', email: 'sales@pharmacorp.ke', responded: false },
      { id: '4', name: 'Generic Pharma East Africa', email: 'sales@genericpharma.co.ke', responded: false },
    ],
    notes: 'Quarterly restocking',
  },
  {
    id: '3',
    rfqNo: 'RFQ-2024-003',
    createdDate: '2024-01-10',
    deadline: '2024-01-18',
    status: 'Closed',
    items: [
      { id: '6', medication: 'Insulin Glargine', quantity: 100, specifications: 'Cold chain required, 100IU/mL' },
    ],
    suppliers: [
      { id: '1', name: 'PharmaCorp Kenya', email: 'sales@pharmacorp.ke', responded: true, responseDate: '2024-01-15' },
      { id: '2', name: 'MediSupply Ltd', email: 'orders@medisupply.co.ke', responded: true, responseDate: '2024-01-16' },
    ],
    notes: 'Awarded to PharmaCorp Kenya',
  },
];

const availableSuppliers = [
  { id: '1', name: 'PharmaCorp Kenya', email: 'sales@pharmacorp.ke', categories: ['Antibiotics', 'Cardiovascular'] },
  { id: '2', name: 'MediSupply Ltd', email: 'orders@medisupply.co.ke', categories: ['Analgesics', 'Diabetes'] },
  { id: '3', name: 'HealthCare Distributors', email: 'info@hcd.ke', categories: ['All Categories'] },
  { id: '4', name: 'Generic Pharma East Africa', email: 'sales@genericpharma.co.ke', categories: ['Generic Medications'] },
  { id: '5', name: 'BioMed Supplies', email: 'contact@biomed.ke', categories: ['Specialty Medications'] },
];

export default function PharmacyRFQPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RFQStatus | 'All'>('All');
  const [showNewRFQ, setShowNewRFQ] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);

  const filteredRFQs = useMemo(() => {
    return mockRFQs.filter((rfq) => {
      const matchesSearch =
        rfq.rfqNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfq.items.some((item) => item.medication.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || rfq.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: mockRFQs.length,
    sent: mockRFQs.filter((r) => r.status === 'Sent').length,
    responsesReceived: mockRFQs.filter((r) => r.status === 'Responses Received').length,
    closed: mockRFQs.filter((r) => r.status === 'Closed').length,
  }), []);

  const getStatusColor = (status: RFQStatus) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700';
      case 'Sent': return 'bg-blue-100 text-blue-700';
      case 'Responses Received': return 'bg-green-100 text-green-700';
      case 'Closed': return 'bg-purple-100 text-purple-700';
      case 'Expired': return 'bg-red-100 text-red-700';
    }
  };

  const getDaysRemaining = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diff = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request for Quotations</h1>
          <p className="text-gray-600">Request and manage supplier quotations</p>
        </div>
        <button
          onClick={() => setShowNewRFQ(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New RFQ
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileQuestion className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total RFQs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Sent</p>
              <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Responses Received</p>
              <p className="text-2xl font-bold text-green-600">{stats.responsesReceived}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Closed</p>
              <p className="text-2xl font-bold text-purple-600">{stats.closed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search RFQs by number or medication..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RFQStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Responses Received">Responses Received</option>
              <option value="Closed">Closed</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* RFQ Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">RFQ Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Deadline</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Suppliers</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Responses</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredRFQs.map((rfq) => {
                const daysRemaining = getDaysRemaining(rfq.deadline);
                const responsesCount = rfq.suppliers.filter((s) => s.responded).length;
                return (
                  <tr
                    key={rfq.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      selectedRFQ?.id === rfq.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedRFQ(rfq)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileQuestion className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-gray-900">{rfq.rfqNo}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{rfq.createdDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{rfq.deadline}</span>
                        {rfq.status !== 'Closed' && daysRemaining > 0 && daysRemaining <= 3 && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                            {daysRemaining}d left
                          </span>
                        )}
                        {rfq.status !== 'Closed' && daysRemaining <= 0 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                            Expired
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                        {rfq.items.length} items
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{rfq.suppliers.length} suppliers</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                        responsesCount === rfq.suppliers.length
                          ? 'bg-green-100 text-green-700'
                          : responsesCount > 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {responsesCount}/{rfq.suppliers.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(rfq.status)}`}>
                        {rfq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        {rfq.status === 'Responses Received' && (
                          <button className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                            Compare
                          </button>
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

      {/* New RFQ Modal */}
      {showNewRFQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Request for Quotation</h2>
              <button
                onClick={() => setShowNewRFQ(false)}
                className="p-2 hover:bg-gray-100 rounded-lg text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RFQ Title</label>
                    <input
                      type="text"
                      placeholder="e.g., Q1 2024 Antibiotics Restock"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Response Deadline</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Medications</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search medications to add..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="mt-2 border border-gray-200 rounded-lg p-3 min-h-[80px]">
                    <p className="text-sm text-gray-500 text-center">No medications added. Search above to add items.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Suppliers</label>
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-[200px] overflow-auto">
                    {availableSuppliers.map((supplier) => (
                      <label
                        key={supplier.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{supplier.name}</span>
                          </div>
                          <p className="text-sm text-gray-500">{supplier.email}</p>
                        </div>
                        <div className="flex gap-1">
                          {supplier.categories.slice(0, 2).map((cat, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Special Instructions</label>
                  <textarea
                    placeholder="Add any special requirements or instructions..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewRFQ(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Save as Draft
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Send className="w-4 h-4" />
                Send to Suppliers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
