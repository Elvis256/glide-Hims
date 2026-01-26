import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  Plus,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Package,
  Download,
  Printer,
  Eye,
  MoreVertical,
  Play,
  Pause,
  FileText,
  BarChart3,
  Users,
  MapPin,
} from 'lucide-react';

interface StockTake {
  id: string;
  stockTakeNo: string;
  name: string;
  location: string;
  scheduledDate: string;
  startDate?: string;
  endDate?: string;
  itemsToCount: number;
  itemsCounted: number;
  varianceCount: number;
  varianceValue: number;
  assignedTo: string[];
  status: 'scheduled' | 'in-progress' | 'completed' | 'reconciled';
}

interface CountSheet {
  id: string;
  itemName: string;
  itemSku: string;
  location: string;
  systemQty: number;
  countedQty: number | null;
  variance: number | null;
  unit: string;
  countedBy?: string;
  countedAt?: string;
}

const mockStockTakes: StockTake[] = [
  { id: '1', stockTakeNo: 'ST-2025-0012', name: 'Monthly Full Count - January', location: 'All Stores', scheduledDate: '2025-01-25', itemsToCount: 450, itemsCounted: 0, varianceCount: 0, varianceValue: 0, assignedTo: ['John Kamau', 'Grace Akinyi', 'Peter Ochieng'], status: 'scheduled' },
  { id: '2', stockTakeNo: 'ST-2025-0011', name: 'Surgical Store Audit', location: 'Surgical Store', scheduledDate: '2025-01-23', startDate: '2025-01-23', itemsToCount: 85, itemsCounted: 62, varianceCount: 5, varianceValue: 12500, assignedTo: ['Faith Njeri', 'David Kiprop'], status: 'in-progress' },
  { id: '3', stockTakeNo: 'ST-2025-0010', name: 'Emergency Store Spot Check', location: 'Emergency Store', scheduledDate: '2025-01-20', startDate: '2025-01-20', endDate: '2025-01-21', itemsToCount: 45, itemsCounted: 45, varianceCount: 3, varianceValue: 4200, assignedTo: ['Mary Wanjiku'], status: 'completed' },
  { id: '4', stockTakeNo: 'ST-2025-0009', name: 'Lab Store Quarterly Count', location: 'Lab Store', scheduledDate: '2025-01-15', startDate: '2025-01-15', endDate: '2025-01-16', itemsToCount: 120, itemsCounted: 120, varianceCount: 8, varianceValue: 18700, assignedTo: ['James Mutua', 'Sarah Muthoni'], status: 'reconciled' },
];

const mockCountSheet: CountSheet[] = [
  { id: '1', itemName: 'Surgical Gloves (Medium)', itemSku: 'MS-001', location: 'Shelf A1', systemQty: 250, countedQty: 248, variance: -2, unit: 'Pairs', countedBy: 'Faith Njeri', countedAt: '2025-01-23 09:15' },
  { id: '2', itemName: 'IV Cannula 22G', itemSku: 'MS-002', location: 'Shelf A2', systemQty: 200, countedQty: 195, variance: -5, unit: 'Pieces', countedBy: 'David Kiprop', countedAt: '2025-01-23 09:32' },
  { id: '3', itemName: 'Suture Kit Nylon', itemSku: 'MS-003', location: 'Shelf B1', systemQty: 100, countedQty: 100, variance: 0, unit: 'Kits', countedBy: 'Faith Njeri', countedAt: '2025-01-23 10:05' },
  { id: '4', itemName: 'Sterile Gauze Pads', itemSku: 'CO-101', location: 'Shelf B2', systemQty: 300, countedQty: null, variance: null, unit: 'Packs', countedBy: undefined, countedAt: undefined },
  { id: '5', itemName: 'Oxygen Mask Adult', itemSku: 'CO-001', location: 'Shelf C1', systemQty: 150, countedQty: null, variance: null, unit: 'Pieces', countedBy: undefined, countedAt: undefined },
  { id: '6', itemName: 'Catheter Kit Sterile', itemSku: 'MS-202', location: 'Shelf C2', systemQty: 50, countedQty: 52, variance: 2, unit: 'Kits', countedBy: 'David Kiprop', countedAt: '2025-01-23 11:20' },
];

export default function StockTakePage() {
  const [activeTab, setActiveTab] = useState<'schedule' | 'count' | 'variance'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedStockTake, setSelectedStockTake] = useState<StockTake | null>(null);
  const [showNewStockTake, setShowNewStockTake] = useState(false);

  const filteredStockTakes = useMemo(() => {
    return mockStockTakes.filter((st) => {
      const matchesSearch = 
        st.stockTakeNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || st.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    scheduled: mockStockTakes.filter((s) => s.status === 'scheduled').length,
    inProgress: mockStockTakes.filter((s) => s.status === 'in-progress').length,
    pendingReconcile: mockStockTakes.filter((s) => s.status === 'completed').length,
    totalVariance: mockStockTakes.reduce((sum, s) => sum + s.varianceValue, 0),
  }), []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
            <Calendar className="w-3 h-3" />
            Scheduled
          </span>
        );
      case 'in-progress':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
            <AlertTriangle className="w-3 h-3" />
            Pending Reconciliation
          </span>
        );
      case 'reconciled':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Reconciled
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
          <h1 className="text-2xl font-bold text-gray-900">Stock Take</h1>
          <p className="text-gray-600">Physical inventory count and reconciliation</p>
        </div>
        <button
          onClick={() => setShowNewStockTake(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Schedule Stock Take
        </button>
      </div>

      {/* Stats Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Scheduled</p>
              <p className="text-2xl font-bold text-blue-700">{stats.scheduled}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.inProgress}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">Pending Reconcile</p>
              <p className="text-2xl font-bold text-orange-700">{stats.pendingReconcile}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Variance (KES)</p>
              <p className="text-2xl font-bold text-red-600">{stats.totalVariance.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'schedule' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Schedule
        </button>
        <button
          onClick={() => setActiveTab('count')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'count' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ClipboardList className="w-4 h-4 inline mr-2" />
          Count Sheets
        </button>
        <button
          onClick={() => setActiveTab('variance')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'variance' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Variance Report
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search stock takes..."
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
          <option value="scheduled">Scheduled</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="reconciled">Reconciled</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        {activeTab === 'schedule' && (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Stock Take</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Scheduled</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Progress</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Assigned To</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Variance</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStockTakes.map((st) => (
                  <tr key={st.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-mono text-blue-600 text-sm">{st.stockTakeNo}</p>
                        <p className="font-medium text-gray-900">{st.name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {st.location}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {st.scheduledDate}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 w-24">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(st.itemsCounted / st.itemsToCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">
                          {st.itemsCounted}/{st.itemsToCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{st.assignedTo.length} people</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {st.varianceCount > 0 ? (
                        <div>
                          <p className="text-red-600 font-medium">{st.varianceCount} items</p>
                          <p className="text-sm text-gray-500">KES {st.varianceValue.toLocaleString()}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(st.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {st.status === 'scheduled' && (
                          <button className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            Start
                          </button>
                        )}
                        {st.status === 'in-progress' && (
                          <>
                            <button className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                              Count Sheet
                            </button>
                            <button className="p-1 hover:bg-gray-100 rounded">
                              <Pause className="w-4 h-4 text-yellow-600" />
                            </button>
                          </>
                        )}
                        {st.status === 'completed' && (
                          <button className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200">
                            Reconcile
                          </button>
                        )}
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
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
        )}

        {activeTab === 'count' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Surgical Store Audit - Count Sheet</h3>
                <p className="text-sm text-gray-500">ST-2025-0011 • 62/85 items counted</p>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-white text-sm">
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button className="flex items-center gap-2 px-3 py-1.5 border rounded-lg hover:bg-white text-sm">
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Location</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">System Qty</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Counted Qty</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Variance</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Counted By</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mockCountSheet.map((item) => (
                    <tr key={item.id} className={`hover:bg-gray-50 ${item.variance !== null && item.variance !== 0 ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{item.itemName}</p>
                          <p className="text-sm text-gray-500">SKU: {item.itemSku}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.location}</td>
                      <td className="px-4 py-3">
                        {item.systemQty} {item.unit}
                      </td>
                      <td className="px-4 py-3">
                        {item.countedQty !== null ? (
                          <span className="font-medium">{item.countedQty} {item.unit}</span>
                        ) : (
                          <input
                            type="number"
                            placeholder="Enter count"
                            className="w-24 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.variance !== null ? (
                          <span className={`font-medium ${item.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.variance > 0 ? '+' : ''}{item.variance}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.countedBy ? (
                          <div>
                            <p className="text-gray-900">{item.countedBy}</p>
                            <p className="text-xs text-gray-500">{item.countedAt}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">Not counted</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.countedQty === null ? (
                          <button className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            Save Count
                          </button>
                        ) : (
                          <button className="text-blue-600 hover:text-blue-800 text-sm">
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'variance' && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">Variance Reports</p>
              <p className="text-sm">View variance analysis and reconciliation history</p>
            </div>
          </div>
        )}

        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          {activeTab === 'schedule' && `Showing ${filteredStockTakes.length} stock takes`}
          {activeTab === 'count' && `${mockCountSheet.filter(i => i.countedQty !== null).length}/${mockCountSheet.length} items counted`}
          {activeTab === 'variance' && 'Variance report view'}
        </div>
      </div>

      {/* New Stock Take Modal */}
      {showNewStockTake && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Schedule Stock Take</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Take Name</label>
                <input
                  type="text"
                  placeholder="e.g., Monthly Full Count - February"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location/Store</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select location</option>
                  <option value="all">All Stores</option>
                  <option value="main">Main Store</option>
                  <option value="surgical">Surgical Store</option>
                  <option value="emergency">Emergency Store</option>
                  <option value="lab">Lab Store</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Team Members</label>
                <input
                  type="text"
                  placeholder="Search and add team members..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Special instructions..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewStockTake(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Schedule Stock Take
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
