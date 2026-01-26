import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  FileText,
  CheckCircle,
  Package,
  Building2,
  Calendar,
  Filter,
  Eye,
  ChevronRight,
  AlertTriangle,
  Thermometer,
  ClipboardCheck,
  Truck,
  XCircle,
  Clock,
  Hash,
} from 'lucide-react';

type GRNStatus = 'Pending Inspection' | 'Inspecting' | 'Approved' | 'Partially Accepted' | 'Rejected';

interface GRNItem {
  id: string;
  medication: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  batchNumber: string;
  expiryDate: string;
  unitPrice: number;
  qualityStatus: 'Pending' | 'Passed' | 'Failed';
  tempVerified?: boolean;
  coldChain?: boolean;
  notes: string;
}

interface GRN {
  id: string;
  grnNumber: string;
  poNumber: string;
  supplier: string;
  receivedDate: string;
  receivedBy: string;
  status: GRNStatus;
  items: GRNItem[];
  deliveryNote: string;
  vehicleTemp?: number;
  inspectedBy?: string;
  inspectionDate?: string;
}

const mockGRNs: GRN[] = [
  {
    id: '1',
    grnNumber: 'GRN-2024-001',
    poNumber: 'PO-2024-001',
    supplier: 'PharmaCorp Kenya',
    receivedDate: '2024-01-20',
    receivedBy: 'Mary Store Keeper',
    status: 'Pending Inspection',
    items: [
      {
        id: '1',
        medication: 'Amoxicillin 500mg',
        orderedQty: 500,
        receivedQty: 500,
        acceptedQty: 0,
        batchNumber: 'AMX-2024-015',
        expiryDate: '2026-01-15',
        unitPrice: 14.5,
        qualityStatus: 'Pending',
        notes: '',
      },
      {
        id: '2',
        medication: 'Azithromycin 250mg',
        orderedQty: 200,
        receivedQty: 180,
        acceptedQty: 0,
        batchNumber: 'AZI-2024-008',
        expiryDate: '2025-06-20',
        unitPrice: 42.0,
        qualityStatus: 'Pending',
        notes: '20 units short - supplier to deliver balance',
      },
    ],
    deliveryNote: 'DN-2024-0125',
  },
  {
    id: '2',
    grnNumber: 'GRN-2024-002',
    poNumber: 'PO-2024-003',
    supplier: 'MediSupply Ltd',
    receivedDate: '2024-01-19',
    receivedBy: 'John Store Keeper',
    status: 'Approved',
    items: [
      {
        id: '3',
        medication: 'Insulin Glargine 100IU/mL',
        orderedQty: 50,
        receivedQty: 50,
        acceptedQty: 50,
        batchNumber: 'INS-2024-022',
        expiryDate: '2025-03-10',
        unitPrice: 850.0,
        qualityStatus: 'Passed',
        coldChain: true,
        tempVerified: true,
        notes: 'Cold chain verified - arrived at 4°C',
      },
    ],
    deliveryNote: 'DN-2024-0119',
    vehicleTemp: 4,
    inspectedBy: 'Dr. Sarah QA',
    inspectionDate: '2024-01-19',
  },
  {
    id: '3',
    grnNumber: 'GRN-2024-003',
    poNumber: 'PO-2024-002',
    supplier: 'HealthCare Distributors',
    receivedDate: '2024-01-18',
    receivedBy: 'Mary Store Keeper',
    status: 'Partially Accepted',
    items: [
      {
        id: '4',
        medication: 'Paracetamol 1g',
        orderedQty: 1000,
        receivedQty: 1000,
        acceptedQty: 950,
        batchNumber: 'PCM-2024-045',
        expiryDate: '2025-12-31',
        unitPrice: 5.0,
        qualityStatus: 'Passed',
        notes: '50 units damaged packaging - returned',
      },
      {
        id: '5',
        medication: 'Ibuprofen 400mg',
        orderedQty: 500,
        receivedQty: 500,
        acceptedQty: 0,
        batchNumber: 'IBU-2024-012',
        expiryDate: '2024-04-30',
        unitPrice: 8.0,
        qualityStatus: 'Failed',
        notes: 'Rejected - expiry too close (within 90 days)',
      },
    ],
    deliveryNote: 'DN-2024-0118',
    inspectedBy: 'Dr. Sarah QA',
    inspectionDate: '2024-01-18',
  },
];

export default function PharmacyGRNPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<GRNStatus | 'All'>('All');
  const [showNewGRN, setShowNewGRN] = useState(false);
  const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);

  const filteredGRNs = useMemo(() => {
    return mockGRNs.filter((grn) => {
      const matchesSearch =
        grn.grnNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grn.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || grn.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: mockGRNs.length,
    pendingInspection: mockGRNs.filter((g) => g.status === 'Pending Inspection').length,
    approved: mockGRNs.filter((g) => g.status === 'Approved').length,
    issues: mockGRNs.filter((g) => g.status === 'Partially Accepted' || g.status === 'Rejected').length,
  }), []);

  const getStatusColor = (status: GRNStatus) => {
    switch (status) {
      case 'Pending Inspection': return 'bg-yellow-100 text-yellow-700';
      case 'Inspecting': return 'bg-blue-100 text-blue-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Partially Accepted': return 'bg-orange-100 text-orange-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: GRNStatus) => {
    switch (status) {
      case 'Pending Inspection': return <Clock className="w-4 h-4" />;
      case 'Inspecting': return <ClipboardCheck className="w-4 h-4" />;
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Partially Accepted': return <AlertTriangle className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
    }
  };

  const getQualityColor = (status: string) => {
    switch (status) {
      case 'Passed': return 'text-green-600 bg-green-100';
      case 'Failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Received Notes</h1>
          <p className="text-gray-600">Receive, inspect, and accept medication deliveries</p>
        </div>
        <button
          onClick={() => setShowNewGRN(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Receive Delivery
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total GRNs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Inspection</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingInspection}</p>
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
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">With Issues</p>
              <p className="text-2xl font-bold text-orange-600">{stats.issues}</p>
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
              placeholder="Search by GRN, PO number, or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as GRNStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Pending Inspection">Pending Inspection</option>
              <option value="Inspecting">Inspecting</option>
              <option value="Approved">Approved</option>
              <option value="Partially Accepted">Partially Accepted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* GRN Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">GRN Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">PO Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Received</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cold Chain</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredGRNs.map((grn) => {
                const hasColdChain = grn.items.some((i) => i.coldChain);
                const totalReceived = grn.items.reduce((sum, i) => sum + i.receivedQty, 0);
                const totalAccepted = grn.items.reduce((sum, i) => sum + i.acceptedQty, 0);

                return (
                  <tr
                    key={grn.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      selectedGRN?.id === grn.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedGRN(grn)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{grn.grnNumber}</p>
                        <p className="text-xs text-gray-500">DN: {grn.deliveryNote}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-blue-600 font-medium">{grn.poNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{grn.supplier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{grn.receivedDate}</span>
                        </div>
                        <p className="text-xs text-gray-500">{grn.receivedBy}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                          {grn.items.length} items
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          {totalAccepted}/{totalReceived} accepted
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {hasColdChain ? (
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-blue-600">
                            {grn.vehicleTemp ? `${grn.vehicleTemp}°C` : 'Required'}
                          </span>
                          {grn.items.some((i) => i.tempVerified) && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(grn.status)}`}>
                        {getStatusIcon(grn.status)}
                        {grn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        {grn.status === 'Pending Inspection' && (
                          <button className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">
                            Inspect
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

      {/* New GRN Modal */}
      {showNewGRN && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Receive Delivery</h2>
              <button
                onClick={() => setShowNewGRN(false)}
                className="p-2 hover:bg-gray-100 rounded-lg text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Order</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Select PO...</option>
                      <option value="PO-2024-001">PO-2024-001 - PharmaCorp Kenya</option>
                      <option value="PO-2024-002">PO-2024-002 - MediSupply Ltd</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Note Number</label>
                    <input
                      type="text"
                      placeholder="e.g., DN-2024-0125"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Received By</label>
                    <input
                      type="text"
                      placeholder="Name of receiver"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Cold Chain Verification</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Vehicle Temperature</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="°C"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Container Condition</label>
                      <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <option value="">Select...</option>
                        <option value="intact">Intact - No damage</option>
                        <option value="minor">Minor damage</option>
                        <option value="compromised">Compromised</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Temperature Log</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-sm text-gray-700">Temperature log verified</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Items Received</label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Medication</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Ordered</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Received</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Batch No.</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Expiry Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Quality</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr>
                          <td className="px-3 py-2 text-sm">Amoxicillin 500mg</td>
                          <td className="px-3 py-2 text-sm text-gray-600">500</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              defaultValue={500}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              placeholder="Batch #"
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select className="px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="pending">Pending</option>
                              <option value="passed">Passed</option>
                              <option value="failed">Failed</option>
                            </select>
                          </td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 text-sm">Azithromycin 250mg</td>
                          <td className="px-3 py-2 text-sm text-gray-600">200</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              defaultValue={180}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              placeholder="Batch #"
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select className="px-2 py-1 border border-gray-300 rounded text-sm">
                              <option value="pending">Pending</option>
                              <option value="passed">Passed</option>
                              <option value="failed">Failed</option>
                            </select>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Discrepancies</label>
                  <textarea
                    placeholder="Document any issues, damages, or discrepancies..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewGRN(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Save for Inspection
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <CheckCircle className="w-4 h-4" />
                Accept & Add to Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
