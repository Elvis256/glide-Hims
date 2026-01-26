import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Download,
  Filter,
  Monitor,
  Calendar,
  Wrench,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  History,
  Settings,
} from 'lucide-react';

interface Equipment {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  department: string;
  installationDate: string;
  lastCalibration: string;
  nextCalibration: string;
  lastMaintenance: string;
  nextMaintenance: string;
  interfaceStatus: 'connected' | 'disconnected' | 'not-configured';
  status: 'operational' | 'maintenance' | 'offline' | 'calibration-due';
}

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  date: string;
  type: 'preventive' | 'corrective' | 'calibration';
  description: string;
  technician: string;
  cost: number;
}

const mockEquipment: Equipment[] = [
  { id: '1', name: 'Hematology Analyzer', model: 'Sysmex XN-1000', manufacturer: 'Sysmex', serialNumber: 'SN-2024-001', department: 'Hematology', installationDate: '2023-01-15', lastCalibration: '2024-01-10', nextCalibration: '2024-04-10', lastMaintenance: '2024-01-05', nextMaintenance: '2024-04-05', interfaceStatus: 'connected', status: 'operational' },
  { id: '2', name: 'Chemistry Analyzer', model: 'Roche Cobas c311', manufacturer: 'Roche', serialNumber: 'SN-2023-042', department: 'Biochemistry', installationDate: '2022-06-20', lastCalibration: '2024-01-08', nextCalibration: '2024-02-08', lastMaintenance: '2024-01-01', nextMaintenance: '2024-03-01', interfaceStatus: 'connected', status: 'calibration-due' },
  { id: '3', name: 'Immunoassay Analyzer', model: 'Abbott Architect i1000SR', manufacturer: 'Abbott', serialNumber: 'SN-2023-089', department: 'Immunology', installationDate: '2023-03-10', lastCalibration: '2024-01-12', nextCalibration: '2024-04-12', lastMaintenance: '2024-01-10', nextMaintenance: '2024-04-10', interfaceStatus: 'connected', status: 'operational' },
  { id: '4', name: 'Coagulation Analyzer', model: 'Stago STA-R Max', manufacturer: 'Diagnostica Stago', serialNumber: 'SN-2022-156', department: 'Hematology', installationDate: '2022-09-05', lastCalibration: '2024-01-05', nextCalibration: '2024-04-05', lastMaintenance: '2023-12-15', nextMaintenance: '2024-03-15', interfaceStatus: 'disconnected', status: 'maintenance' },
  { id: '5', name: 'Blood Gas Analyzer', model: 'Radiometer ABL90 FLEX', manufacturer: 'Radiometer', serialNumber: 'SN-2024-003', department: 'POCT', installationDate: '2024-01-02', lastCalibration: '2024-01-15', nextCalibration: '2024-02-15', lastMaintenance: '2024-01-02', nextMaintenance: '2024-07-02', interfaceStatus: 'connected', status: 'operational' },
  { id: '6', name: 'Urine Analyzer', model: 'Siemens CLINITEK Novus', manufacturer: 'Siemens', serialNumber: 'SN-2023-201', department: 'Clinical Pathology', installationDate: '2023-05-18', lastCalibration: '2024-01-11', nextCalibration: '2024-03-11', lastMaintenance: '2024-01-08', nextMaintenance: '2024-04-08', interfaceStatus: 'not-configured', status: 'operational' },
  { id: '7', name: 'Microbiology Analyzer', model: 'bioMérieux VITEK 2', manufacturer: 'bioMérieux', serialNumber: 'SN-2021-078', department: 'Microbiology', installationDate: '2021-11-22', lastCalibration: '2024-01-09', nextCalibration: '2024-04-09', lastMaintenance: '2024-01-02', nextMaintenance: '2024-04-02', interfaceStatus: 'connected', status: 'operational' },
  { id: '8', name: 'Electrolyte Analyzer', model: 'OPTI CCA-TS2', manufacturer: 'OPTI Medical', serialNumber: 'SN-2023-145', department: 'Biochemistry', installationDate: '2023-08-14', lastCalibration: '2024-01-14', nextCalibration: '2024-04-14', lastMaintenance: '2023-12-20', nextMaintenance: '2024-03-20', interfaceStatus: 'connected', status: 'offline' },
];

const mockMaintenanceHistory: MaintenanceRecord[] = [
  { id: 'm1', equipmentId: '1', date: '2024-01-05', type: 'preventive', description: 'Quarterly preventive maintenance', technician: 'John Smith', cost: 15000 },
  { id: 'm2', equipmentId: '1', date: '2024-01-10', type: 'calibration', description: 'Monthly calibration', technician: 'Jane Doe', cost: 5000 },
  { id: 'm3', equipmentId: '2', date: '2024-01-01', type: 'preventive', description: 'Annual maintenance service', technician: 'Mike Wilson', cost: 45000 },
];

const departments = ['All', 'Hematology', 'Biochemistry', 'Immunology', 'Microbiology', 'Clinical Pathology', 'POCT'];
const statuses = ['All', 'operational', 'maintenance', 'offline', 'calibration-due'];

const getStatusBadge = (status: Equipment['status']) => {
  switch (status) {
    case 'operational':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />Operational</span>;
    case 'maintenance':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Wrench className="w-3 h-3" />Maintenance</span>;
    case 'offline':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" />Offline</span>;
    case 'calibration-due':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><Clock className="w-3 h-3" />Calibration Due</span>;
  }
};

const getInterfaceIcon = (status: Equipment['interfaceStatus']) => {
  switch (status) {
    case 'connected':
      return <Wifi className="w-4 h-4 text-green-500" />;
    case 'disconnected':
      return <WifiOff className="w-4 h-4 text-red-500" />;
    case 'not-configured':
      return <WifiOff className="w-4 h-4 text-gray-400" />;
  }
};

export default function LabEquipmentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [equipment] = useState<Equipment[]>(mockEquipment);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);

  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDepartment = selectedDepartment === 'All' || eq.department === selectedDepartment;
      const matchesStatus = selectedStatus === 'All' || eq.status === selectedStatus;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [equipment, searchTerm, selectedDepartment, selectedStatus]);

  const stats = useMemo(() => ({
    total: equipment.length,
    operational: equipment.filter(e => e.status === 'operational').length,
    needsAttention: equipment.filter(e => e.status !== 'operational').length,
    connected: equipment.filter(e => e.interfaceStatus === 'connected').length,
  }), [equipment]);

  const maintenanceHistory = useMemo(() => {
    if (!selectedEquipment) return [];
    return mockMaintenanceHistory.filter(m => m.equipmentId === selectedEquipment);
  }, [selectedEquipment]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Equipment</h1>
            <p className="text-sm text-gray-500">Manage analyzers, calibration schedules, and maintenance</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Equipment
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total Equipment:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-500">Operational:</span>
            <span className="font-semibold text-green-600">{stats.operational}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-gray-500">Needs Attention:</span>
            <span className="font-semibold text-orange-600">{stats.needsAttention}</span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">LIS Connected:</span>
            <span className="font-semibold text-blue-600">{stats.connected}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, model, or serial number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept === 'All' ? 'All Departments' : dept}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Equipment List */}
        <div className={`${selectedEquipment ? 'w-2/3' : 'w-full'} overflow-auto px-6 py-4`}>
          <div className="bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Equipment</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Serial Number</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Department</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Next Calibration</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Next Maintenance</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Interface</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEquipment.map(eq => (
                  <tr 
                    key={eq.id} 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedEquipment === eq.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedEquipment(eq.id === selectedEquipment ? null : eq.id)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{eq.name}</span>
                        <p className="text-xs text-gray-500">{eq.manufacturer} {eq.model}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">{eq.serialNumber}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{eq.department}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {new Date(eq.nextCalibration).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Wrench className="w-3 h-3 text-gray-400" />
                        {new Date(eq.nextMaintenance).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getInterfaceIcon(eq.interfaceStatus)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(eq.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded" title="Maintenance History">
                          <History className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded" title="Settings">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance History Panel */}
        {selectedEquipment && (
          <div className="w-1/3 border-l bg-white overflow-auto">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900">Maintenance History</h2>
              <p className="text-sm text-gray-500">
                {equipment.find(e => e.id === selectedEquipment)?.name}
              </p>
            </div>
            <div className="p-4">
              {maintenanceHistory.length > 0 ? (
                <div className="space-y-3">
                  {maintenanceHistory.map(record => (
                    <div key={record.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          record.type === 'preventive' ? 'bg-blue-100 text-blue-700' :
                          record.type === 'corrective' ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(record.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-700">{record.description}</p>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>By: {record.technician}</span>
                        <span>KES {record.cost.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">No maintenance records found</p>
              )}
              <button className="w-full mt-4 px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
                <Plus className="w-4 h-4 inline mr-2" />
                Add Maintenance Record
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
