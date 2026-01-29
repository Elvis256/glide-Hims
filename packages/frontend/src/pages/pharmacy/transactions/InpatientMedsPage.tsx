import { useState, useMemo } from 'react';
import {
  Search,
  Building,
  User,
  Pill,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Send,
  Package,
  ClipboardList,
  Activity,
  Shield,
  Eye,
  Plus,
  Minus,
  X,
  FileText,
  Lock,
  ArrowRight,
  Timer,
} from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  mrn: string;
  ward: string;
  bed: string;
  admissionDate: string;
  diagnosis: string;
  allergies: string[];
}

interface MedicationOrder {
  id: string;
  patientId: string;
  medication: string;
  dose: string;
  route: string;
  frequency: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'discontinued' | 'on-hold';
  prescriber: string;
  isControlled: boolean;
}

interface ScheduledDose {
  id: string;
  orderId: string;
  patientName: string;
  patientMrn: string;
  ward: string;
  bed: string;
  medication: string;
  dose: string;
  route: string;
  scheduledTime: string;
  status: 'pending' | 'given' | 'missed' | 'held';
  administeredBy?: string;
  administeredAt?: string;
}

interface WardStock {
  id: string;
  ward: string;
  medication: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  lastRestocked: string;
}

interface ControlledSubstanceLog {
  id: string;
  medication: string;
  action: 'issued' | 'administered' | 'wasted' | 'returned';
  quantity: number;
  patientName?: string;
  ward: string;
  performedBy: string;
  witnessedBy?: string;
  timestamp: string;
  balanceBefore: number;
  balanceAfter: number;
}

// Data - empty state
const mockPatients: Patient[] = [];

const mockMedicationOrders: MedicationOrder[] = [];

const mockScheduledDoses: ScheduledDose[] = [];

const mockWardStock: WardStock[] = [];

const mockControlledLog: ControlledSubstanceLog[] = [];

const wards = ['All Wards', 'Medical Ward', 'Surgical Ward', 'ICU', 'Pediatric Ward'];

const statusColors = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  discontinued: 'bg-red-100 text-red-800',
  'on-hold': 'bg-yellow-100 text-yellow-800',
};

const doseStatusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  given: 'bg-green-100 text-green-800',
  missed: 'bg-red-100 text-red-800',
  held: 'bg-gray-100 text-gray-800',
};

export default function InpatientMedsPage() {
  const [selectedWard, setSelectedWard] = useState('All Wards');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'schedule' | 'orders' | 'wardstock' | 'controlled'>('schedule');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueWard, setIssueWard] = useState('');
  const [issueItems, setIssueItems] = useState<{ medication: string; quantity: number }[]>([]);

  const filteredPatients = useMemo(() => {
    let patients = mockPatients;
    if (selectedWard !== 'All Wards') {
      patients = patients.filter((p) => p.ward === selectedWard);
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      patients = patients.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.mrn.toLowerCase().includes(search) ||
          p.bed.toLowerCase().includes(search)
      );
    }
    return patients;
  }, [selectedWard, searchTerm]);

  const filteredScheduledDoses = useMemo(() => {
    let doses = mockScheduledDoses;
    if (selectedWard !== 'All Wards') {
      doses = doses.filter((d) => d.ward === selectedWard);
    }
    return doses;
  }, [selectedWard]);

  const filteredWardStock = useMemo(() => {
    if (selectedWard === 'All Wards') return mockWardStock;
    return mockWardStock.filter((w) => w.ward === selectedWard);
  }, [selectedWard]);

  const patientOrders = useMemo(() => {
    if (!selectedPatient) return [];
    return mockMedicationOrders.filter((o) => o.patientId === selectedPatient.id);
  }, [selectedPatient]);

  // Summary stats
  const stats = useMemo(() => {
    const pendingDoses = mockScheduledDoses.filter((d) => d.status === 'pending').length;
    const lowStockItems = mockWardStock.filter((w) => w.currentStock <= w.minStock).length;
    const activeOrders = mockMedicationOrders.filter((o) => o.status === 'active').length;
    const controlledIssues = mockControlledLog.filter((c) => c.action === 'issued').length;
    return { pendingDoses, lowStockItems, activeOrders, controlledIssues };
  }, []);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inpatient Medications</h1>
          <p className="text-gray-600">Ward medication management</p>
        </div>
        <div className="flex gap-2">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
            <p className="text-xs text-yellow-700">Pending Doses</p>
            <p className="text-lg font-bold text-yellow-900">{stats.pendingDoses}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <p className="text-xs text-red-700">Low Stock</p>
            <p className="text-lg font-bold text-red-900">{stats.lowStockItems}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="text-xs text-green-700">Active Orders</p>
            <p className="text-lg font-bold text-green-900">{stats.activeOrders}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search patient name, MRN, or bed..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={selectedWard}
          onChange={(e) => setSelectedWard(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {wards.map((ward) => (
            <option key={ward} value={ward}>
              {ward}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowIssueModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          Issue to Ward
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'schedule' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Dose Schedule
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Medication Orders
        </button>
        <button
          onClick={() => setActiveTab('wardstock')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'wardstock' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Package className="w-4 h-4" />
          Ward Stock
        </button>
        <button
          onClick={() => setActiveTab('controlled')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'controlled' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Lock className="w-4 h-4" />
          Controlled Substances
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'schedule' && (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Patient List */}
            <div className="col-span-3 bg-white rounded-lg shadow flex flex-col min-h-0">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Patients ({filteredPatients.length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredPatients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <User className="w-12 h-12 mb-2" />
                    <p>No patients found</p>
                  </div>
                ) : (
                  filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPatient?.id === patient.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{patient.name}</p>
                          <p className="text-xs text-gray-500">{patient.mrn}</p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{patient.bed}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{patient.ward}</p>
                      {patient.allergies.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                          <span className="text-xs text-red-600">{patient.allergies.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Medication Chart */}
            <div className="col-span-5 bg-white rounded-lg shadow flex flex-col min-h-0">
              <div className="p-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Pill className="w-4 h-4" />
                  Medication Chart
                </h3>
                {selectedPatient && (
                  <span className="text-sm text-gray-600">{selectedPatient.name}</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {!selectedPatient ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <User className="w-12 h-12 mb-2" />
                    <p>Select a patient</p>
                  </div>
                ) : patientOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Pill className="w-12 h-12 mb-2" />
                    <p>No active medication orders</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Medication</th>
                        <th className="text-left p-2">Dose</th>
                        <th className="text-left p-2">Route</th>
                        <th className="text-left p-2">Frequency</th>
                        <th className="text-center p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patientOrders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              {order.isControlled && <Lock className="w-3 h-3 text-purple-600" />}
                              <span className="font-medium">{order.medication}</span>
                            </div>
                            <p className="text-xs text-gray-500">by {order.prescriber}</p>
                          </td>
                          <td className="p-2">{order.dose}</td>
                          <td className="p-2">{order.route}</td>
                          <td className="p-2">{order.frequency}</td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[order.status]}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Scheduled Doses */}
            <div className="col-span-4 bg-white rounded-lg shadow flex flex-col min-h-0">
              <div className="p-3 border-b">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Today's Scheduled Doses
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredScheduledDoses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Clock className="w-12 h-12 mb-2" />
                    <p>No scheduled doses</p>
                  </div>
                ) : (
                  filteredScheduledDoses.map((dose) => (
                    <div
                      key={dose.id}
                      className={`p-3 border rounded-lg ${
                        dose.status === 'pending' ? 'border-yellow-300 bg-yellow-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{dose.medication}</p>
                          <p className="text-xs text-gray-600">
                            {dose.patientName} • {dose.bed}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${doseStatusColors[dose.status]}`}>
                          {dose.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {dose.scheduledTime}
                        </div>
                        {dose.status === 'pending' && (
                          <button className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Mark Given
                          </button>
                        )}
                        {dose.status === 'given' && (
                          <p className="text-xs text-gray-500">
                            by {dose.administeredBy} at {dose.administeredAt}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-lg shadow h-full flex flex-col min-h-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">All Medication Orders</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {mockMedicationOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <ClipboardList className="w-12 h-12 mb-2" />
                  <p>No medication orders</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-4">Patient</th>
                      <th className="text-left p-4">Medication</th>
                      <th className="text-left p-4">Dose</th>
                      <th className="text-left p-4">Route</th>
                      <th className="text-left p-4">Frequency</th>
                      <th className="text-left p-4">Start</th>
                      <th className="text-left p-4">End</th>
                      <th className="text-center p-4">Status</th>
                      <th className="text-center p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockMedicationOrders.map((order) => {
                      const patient = mockPatients.find((p) => p.id === order.patientId);
                      return (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <p className="font-medium">{patient?.name}</p>
                            <p className="text-xs text-gray-500">{patient?.bed}</p>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1">
                              {order.isControlled && <Lock className="w-3 h-3 text-purple-600" />}
                              <span>{order.medication}</span>
                            </div>
                          </td>
                          <td className="p-4">{order.dose}</td>
                          <td className="p-4">{order.route}</td>
                          <td className="p-4">{order.frequency}</td>
                          <td className="p-4 text-gray-600">{order.startDate}</td>
                          <td className="p-4 text-gray-600">{order.endDate}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${statusColors[order.status]}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <button className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'wardstock' && (
          <div className="bg-white rounded-lg shadow h-full flex flex-col min-h-0">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Ward Stock Management</h3>
              <div className="flex gap-2 text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span> Adequate
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full"></span> Low
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span> Critical
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredWardStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Package className="w-12 h-12 mb-2" />
                  <p>No ward stock records</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-4">Ward</th>
                      <th className="text-left p-4">Medication</th>
                      <th className="text-right p-4">Current</th>
                      <th className="text-right p-4">Min</th>
                      <th className="text-right p-4">Max</th>
                      <th className="text-center p-4">Level</th>
                      <th className="text-left p-4">Last Restocked</th>
                      <th className="text-center p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWardStock.map((stock) => {
                      const level = stock.currentStock <= stock.minStock * 0.5 ? 'critical' : stock.currentStock <= stock.minStock ? 'low' : 'adequate';
                      return (
                        <tr key={stock.id} className="border-b hover:bg-gray-50">
                          <td className="p-4 font-medium">{stock.ward}</td>
                          <td className="p-4">{stock.medication}</td>
                          <td className="p-4 text-right font-semibold">{stock.currentStock}</td>
                          <td className="p-4 text-right text-gray-600">{stock.minStock}</td>
                          <td className="p-4 text-right text-gray-600">{stock.maxStock}</td>
                          <td className="p-4 text-center">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                level === 'critical'
                                  ? 'bg-red-100 text-red-800'
                                  : level === 'low'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {level}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600">{stock.lastRestocked}</td>
                          <td className="p-4 text-center">
                            <button className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">
                              <Plus className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeTab === 'controlled' && (
          <div className="bg-white rounded-lg shadow h-full flex flex-col min-h-0">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Controlled Substances Log
              </h3>
              <p className="text-sm text-gray-600">All transactions require witness verification</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {mockControlledLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Shield className="w-12 h-12 mb-2" />
                  <p>No controlled substance logs</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-4">Timestamp</th>
                      <th className="text-left p-4">Medication</th>
                      <th className="text-center p-4">Action</th>
                      <th className="text-right p-4">Qty</th>
                      <th className="text-left p-4">Patient</th>
                      <th className="text-left p-4">Ward</th>
                      <th className="text-left p-4">Performed By</th>
                      <th className="text-left p-4">Witnessed By</th>
                      <th className="text-right p-4">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockControlledLog.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-gray-600 text-sm">{log.timestamp}</td>
                        <td className="p-4 font-medium">{log.medication}</td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              log.action === 'issued'
                                ? 'bg-blue-100 text-blue-800'
                                : log.action === 'administered'
                                ? 'bg-green-100 text-green-800'
                                : log.action === 'wasted'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-right font-semibold">{log.quantity}</td>
                        <td className="p-4">{log.patientName || '-'}</td>
                        <td className="p-4">{log.ward}</td>
                        <td className="p-4 text-sm">{log.performedBy}</td>
                        <td className="p-4 text-sm">{log.witnessedBy || '-'}</td>
                        <td className="p-4 text-right">
                          <span className="text-gray-500">{log.balanceBefore}</span>
                          <ArrowRight className="w-3 h-3 inline mx-1" />
                          <span className="font-semibold">{log.balanceAfter}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Issue to Ward Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Issue Medications to Ward
              </h3>
              <button onClick={() => setShowIssueModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Ward</label>
                <select
                  value={issueWard}
                  onChange={(e) => setIssueWard(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select ward...</option>
                  {wards.filter((w) => w !== 'All Wards').map((ward) => (
                    <option key={ward} value={ward}>{ward}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Medications to Issue</label>
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                  {mockWardStock.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-4 text-gray-400">
                      <Package className="w-8 h-8 mb-1" />
                      <p className="text-sm">No medications available</p>
                    </div>
                  ) : (
                    mockWardStock.slice(0, 6).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{item.medication}</span>
                        <div className="flex items-center gap-2">
                          <button className="p-1 bg-gray-200 rounded hover:bg-gray-300">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-10 text-center text-sm">0</span>
                          <button className="p-1 bg-gray-200 rounded hover:bg-gray-300">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />
                  Issue to Ward
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
