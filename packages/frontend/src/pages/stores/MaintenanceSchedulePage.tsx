import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Search,
  Plus,
  Filter,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building2,
  User,
  Phone,
  FileText,
  Eye,
  MoreVertical,
  Play,
  Settings,
  AlertCircle,
  Hammer,
} from 'lucide-react';

interface MaintenanceRecord {
  id: string;
  workOrderNo: string;
  assetName: string;
  assetNo: string;
  type: 'preventive' | 'corrective' | 'emergency' | 'calibration';
  description: string;
  scheduledDate: string;
  completedDate?: string;
  vendor?: string;
  vendorContact?: string;
  technician?: string;
  cost?: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface MaintenanceSchedule {
  id: string;
  assetName: string;
  assetNo: string;
  frequency: string;
  lastMaintenance: string;
  nextMaintenance: string;
  assignedTo: string;
  status: 'on-track' | 'due-soon' | 'overdue';
}

const mockMaintenanceRecords: MaintenanceRecord[] = [
  { id: '1', workOrderNo: 'WO-2025-0089', assetName: 'Patient Monitor PM-500', assetNo: 'AST-001', type: 'preventive', description: 'Quarterly calibration and inspection', scheduledDate: '2025-01-25', vendor: 'MedEquip Services Ltd', vendorContact: '+254 722 345 678', status: 'scheduled', priority: 'medium' },
  { id: '2', workOrderNo: 'WO-2025-0088', assetName: 'Defibrillator LifePak 15', assetNo: 'AST-006', type: 'corrective', description: 'Battery replacement and system check', scheduledDate: '2025-01-23', vendor: 'PhysioControl EA', vendorContact: '+254 733 456 789', status: 'in-progress', priority: 'high' },
  { id: '3', workOrderNo: 'WO-2025-0087', assetName: 'Ultrasound Machine GE Logiq', assetNo: 'AST-002', type: 'preventive', description: 'Annual service and probe inspection', scheduledDate: '2025-01-30', vendor: 'GE Healthcare Kenya', vendorContact: '+254 711 567 890', status: 'scheduled', priority: 'medium' },
  { id: '4', workOrderNo: 'WO-2025-0086', assetName: 'Toyota Hilux Ambulance', assetNo: 'AST-004', type: 'preventive', description: 'Service at 50,000km', scheduledDate: '2025-02-01', technician: 'David Kiprop', status: 'scheduled', priority: 'low' },
  { id: '5', workOrderNo: 'WO-2025-0085', assetName: 'Dell Server R740', assetNo: 'AST-003', type: 'preventive', description: 'Firmware update and hardware check', scheduledDate: '2025-01-20', completedDate: '2025-01-20', technician: 'James Mutua', cost: 15000, status: 'completed', priority: 'high' },
  { id: '6', workOrderNo: 'WO-2025-0084', assetName: 'X-Ray Machine', assetNo: 'AST-010', type: 'emergency', description: 'Tube failure - urgent replacement', scheduledDate: '2025-01-22', status: 'overdue', priority: 'critical' },
];

const mockSchedules: MaintenanceSchedule[] = [
  { id: '1', assetName: 'Patient Monitor PM-500', assetNo: 'AST-001', frequency: 'Quarterly', lastMaintenance: '2024-10-25', nextMaintenance: '2025-01-25', assignedTo: 'MedEquip Services Ltd', status: 'due-soon' },
  { id: '2', assetName: 'Ultrasound Machine GE Logiq', assetNo: 'AST-002', frequency: 'Annually', lastMaintenance: '2024-01-30', nextMaintenance: '2025-01-30', assignedTo: 'GE Healthcare Kenya', status: 'due-soon' },
  { id: '3', assetName: 'Toyota Hilux Ambulance', assetNo: 'AST-004', frequency: '10,000 km', lastMaintenance: '2024-11-01', nextMaintenance: '2025-02-01', assignedTo: 'Internal Fleet', status: 'on-track' },
  { id: '4', assetName: 'Dell Server R740', assetNo: 'AST-003', frequency: 'Semi-Annually', lastMaintenance: '2025-01-20', nextMaintenance: '2025-07-20', assignedTo: 'IT Department', status: 'on-track' },
  { id: '5', assetName: 'X-Ray Machine', assetNo: 'AST-010', frequency: 'Quarterly', lastMaintenance: '2024-09-15', nextMaintenance: '2024-12-15', assignedTo: 'RadTech Services', status: 'overdue' },
];

export default function MaintenanceSchedulePage() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'workorders' | 'history'>('workorders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewWorkOrder, setShowNewWorkOrder] = useState(false);

  const filteredRecords = useMemo(() => {
    return mockMaintenanceRecords.filter((record) => {
      const matchesSearch = 
        record.workOrderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.assetNo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    scheduled: mockMaintenanceRecords.filter((r) => r.status === 'scheduled').length,
    inProgress: mockMaintenanceRecords.filter((r) => r.status === 'in-progress').length,
    overdue: mockMaintenanceRecords.filter((r) => r.status === 'overdue').length,
    completedMTD: mockMaintenanceRecords.filter((r) => r.status === 'completed').length,
  }), []);

  const getTypeBadge = (type: string) => {
    const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
      preventive: { bg: 'bg-blue-100 text-blue-700', icon: <Settings className="w-3 h-3" /> },
      corrective: { bg: 'bg-orange-100 text-orange-700', icon: <Wrench className="w-3 h-3" /> },
      emergency: { bg: 'bg-red-100 text-red-700', icon: <AlertTriangle className="w-3 h-3" /> },
      calibration: { bg: 'bg-purple-100 text-purple-700', icon: <Settings className="w-3 h-3" /> },
    };
    const { bg, icon } = styles[type] || styles.preventive;
    return (
      <span className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full capitalize ${bg}`}>
        {icon}
        {type}
      </span>
    );
  };

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
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'overdue':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
            <AlertCircle className="w-3 h-3" />
            Overdue
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      critical: 'bg-red-100 text-red-600',
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full capitalize ${styles[priority]}`}>
        {priority}
      </span>
    );
  };

  const getScheduleStatusBadge = (status: string) => {
    switch (status) {
      case 'on-track':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">On Track</span>;
      case 'due-soon':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Due Soon</span>;
      case 'overdue':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Overdue</span>;
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Schedule</h1>
          <p className="text-gray-600">Equipment maintenance and service management</p>
        </div>
        <button
          onClick={() => setShowNewWorkOrder(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Work Order
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Overdue</p>
              <p className="text-2xl font-bold text-red-700">{stats.overdue}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Completed (MTD)</p>
              <p className="text-2xl font-bold text-green-700">{stats.completedMTD}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-4">
        <button
          onClick={() => setActiveTab('workorders')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'workorders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Work Orders
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          PM Calendar
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          History
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search work orders..."
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
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        {activeTab === 'workorders' && (
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Work Order</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asset</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Scheduled</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Vendor/Tech</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Priority</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className={`hover:bg-gray-50 ${record.status === 'overdue' ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-mono text-blue-600">{record.workOrderNo}</p>
                        <p className="text-sm text-gray-500 max-w-xs truncate">{record.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{record.assetName}</p>
                        <p className="text-sm text-gray-500">{record.assetNo}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getTypeBadge(record.type)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {record.scheduledDate}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {record.vendor ? (
                        <div>
                          <div className="flex items-center gap-1 text-gray-900">
                            <Building2 className="w-3 h-3" />
                            {record.vendor}
                          </div>
                          {record.vendorContact && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Phone className="w-3 h-3" />
                              {record.vendorContact}
                            </div>
                          )}
                        </div>
                      ) : record.technician ? (
                        <div className="flex items-center gap-1 text-gray-900">
                          <User className="w-3 h-3" />
                          {record.technician}
                        </div>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getPriorityBadge(record.priority)}</td>
                    <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded" title="View">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {record.status === 'scheduled' && (
                          <button className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            Start
                          </button>
                        )}
                        {record.status === 'in-progress' && (
                          <button className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            Complete
                          </button>
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
        )}

        {activeTab === 'calendar' && (
          <div className="overflow-auto flex-1">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-4">Preventive Maintenance Schedule</h3>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Asset</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Frequency</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Last Maintenance</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Next Due</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Assigned To</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mockSchedules.map((schedule) => (
                    <tr key={schedule.id} className={`hover:bg-gray-50 ${schedule.status === 'overdue' ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{schedule.assetName}</p>
                          <p className="text-sm text-gray-500">{schedule.assetNo}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{schedule.frequency}</td>
                      <td className="px-4 py-3 text-gray-600">{schedule.lastMaintenance}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium">{schedule.nextMaintenance}</td>
                      <td className="px-4 py-3 text-gray-600">{schedule.assignedTo}</td>
                      <td className="px-4 py-3">{getScheduleStatusBadge(schedule.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Clock className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-lg font-medium">Maintenance History</p>
              <p className="text-sm">View completed maintenance records and costs</p>
            </div>
          </div>
        )}

        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          {activeTab === 'workorders' && `Showing ${filteredRecords.length} work orders`}
          {activeTab === 'calendar' && `${mockSchedules.length} assets with scheduled maintenance`}
          {activeTab === 'history' && 'Maintenance history view'}
        </div>
      </div>

      {/* New Work Order Modal */}
      {showNewWorkOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Work Order</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
                <input
                  type="text"
                  placeholder="Search for asset..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">Select type</option>
                  <option value="preventive">Preventive</option>
                  <option value="corrective">Corrective</option>
                  <option value="emergency">Emergency</option>
                  <option value="calibration">Calibration</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor/Technician</label>
                <input
                  type="text"
                  placeholder="Assign vendor or technician..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the maintenance work required..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewWorkOrder(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create Work Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
