import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
import { api, getApiErrorMessage } from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';
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
  History,
  Loader2,
  X,
  Trash2,
} from 'lucide-react';

interface Equipment {
  id: string;
  facilityId: string;
  assetCode: string;
  name: string;
  description?: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  installationDate?: string;
  warrantyExpiry?: string;
  status: 'OPERATIONAL' | 'UNDER_MAINTENANCE' | 'OUT_OF_SERVICE' | 'CALIBRATION_DUE' | 'DECOMMISSIONED';
  isActive: boolean;
  requiresCalibration: boolean;
  calibrationFrequencyDays?: number;
  lastCalibrationDate?: string;
  nextCalibrationDate?: string;
  requiresMaintenance: boolean;
  maintenanceFrequencyDays?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  calibrations?: MaintenanceRecord[];
  maintenances?: MaintenanceRecord[];
}

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  facilityId: string;
  maintenanceDate?: string;
  calibrationDate?: string;
  type: string;
  description?: string;
  performedBy?: string;
  serviceProvider?: string;
  cost?: number;
  comments?: string;
  passed?: boolean;
  createdAt?: string;
}

const categories = [
  'All', 'ANALYZER', 'CENTRIFUGE', 'MICROSCOPE', 'INCUBATOR', 'REFRIGERATOR',
  'WATER_BATH', 'AUTOCLAVE', 'SPECTROPHOTOMETER', 'PCR_MACHINE',
  'BLOOD_GAS_ANALYZER', 'HEMATOLOGY_ANALYZER', 'CHEMISTRY_ANALYZER',
  'COAGULATION_ANALYZER', 'IMMUNOASSAY_ANALYZER', 'URINALYSIS_ANALYZER', 'OTHER',
];
const statuses: Array<'All' | Equipment['status']> = ['All', 'OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'CALIBRATION_DUE', 'DECOMMISSIONED'];

const statusLabels: Record<Equipment['status'], string> = {
  OPERATIONAL: 'Operational',
  UNDER_MAINTENANCE: 'Maintenance',
  OUT_OF_SERVICE: 'Offline',
  CALIBRATION_DUE: 'Calibration Due',
  DECOMMISSIONED: 'Decommissioned',
};

const getStatusBadge = (status: Equipment['status']) => {
  switch (status) {
    case 'OPERATIONAL':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" />Operational</span>;
    case 'UNDER_MAINTENANCE':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Wrench className="w-3 h-3" />Maintenance</span>;
    case 'OUT_OF_SERVICE':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3" />Offline</span>;
    case 'CALIBRATION_DUE':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><Clock className="w-3 h-3" />Calibration Due</span>;
    case 'DECOMMISSIONED':
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"><AlertTriangle className="w-3 h-3" />Decommissioned</span>;
  }
};

interface EquipmentFormData {
  assetCode: string;
  name: string;
  category: string;
  description: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  location: string;
  installationDate: string;
  status: Equipment['status'];
  requiresCalibration: boolean;
  calibrationFrequencyDays: number;
  lastCalibrationDate: string;
  nextCalibrationDate: string;
  requiresMaintenance: boolean;
  maintenanceFrequencyDays: number;
  lastMaintenanceDate: string;
  nextMaintenanceDate: string;
}

const getEmptyEquipmentForm = (): EquipmentFormData => ({
  assetCode: '',
  name: '',
  category: 'ANALYZER',
  description: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  location: '',
  installationDate: new Date().toISOString().split('T')[0],
  status: 'OPERATIONAL',
  requiresCalibration: true,
  calibrationFrequencyDays: 90,
  lastCalibrationDate: new Date().toISOString().split('T')[0],
  nextCalibrationDate: new Date().toISOString().split('T')[0],
  requiresMaintenance: true,
  maintenanceFrequencyDays: 90,
  lastMaintenanceDate: new Date().toISOString().split('T')[0],
  nextMaintenanceDate: new Date().toISOString().split('T')[0],
});

interface MaintenanceFormData {
  date: string;
  type: 'preventive' | 'corrective' | 'calibration';
  description: string;
  performedBy: string;
  cost: number;
}

const getEmptyMaintenanceForm = (): MaintenanceFormData => ({
  date: new Date().toISOString().split('T')[0],
  type: 'preventive',
  description: '',
  performedBy: '',
  cost: 0,
});

export default function LabEquipmentPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormData>(getEmptyEquipmentForm());
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceFormData>(getEmptyMaintenanceForm());

  // Fetch equipment from API
  const { data: equipmentData, isLoading } = useQuery({
    queryKey: ['lab-equipment', facilityId],
    queryFn: async () => {
      const response = await api.get('/lab-supplies/equipment', { params: { facilityId } });
      return response.data as Equipment[];
    },
  });

  const equipment = equipmentData ?? [];

  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (eq.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (eq.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || eq.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || eq.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [equipment, searchTerm, selectedCategory, selectedStatus]);

  const stats = useMemo(() => ({
    total: equipment.length,
    operational: equipment.filter(e => e.status === 'OPERATIONAL').length,
    needsAttention: equipment.filter(e => e.status !== 'OPERATIONAL').length,
    active: equipment.filter(e => e.isActive).length,
  }), [equipment]);

  const maintenanceHistory = useMemo(() => {
    if (!selectedEquipment) return [] as MaintenanceRecord[];
    const eq = equipment.find(e => e.id === selectedEquipment);
    if (!eq) return [] as MaintenanceRecord[];
    const records: MaintenanceRecord[] = [];
    if (eq.calibrations) {
      for (const c of eq.calibrations) {
        records.push({ ...c, type: 'calibration' });
      }
    }
    if (eq.maintenances) {
      for (const m of eq.maintenances) {
        records.push(m);
      }
    }
    records.sort((a, b) => {
      const dateA = a.maintenanceDate || a.calibrationDate || a.createdAt || '';
      const dateB = b.maintenanceDate || b.calibrationDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
    return records;
  }, [selectedEquipment, equipment]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/lab-supplies/equipment', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-equipment'] });
      toast.success('Equipment added successfully');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/lab-supplies/equipment/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-equipment'] });
      toast.success('Equipment updated successfully');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const calibrationMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.post(`/lab-supplies/equipment/${id}/calibration`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-equipment'] });
      toast.success('Calibration recorded successfully');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const maintenanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.post(`/lab-supplies/equipment/${id}/maintenance`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-equipment'] });
      toast.success('Maintenance recorded successfully');
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  // CRUD Operations for Equipment
  const handleAddEquipment = () => {
    setEditingEquipment(null);
    setEquipmentForm(getEmptyEquipmentForm());
    setShowEquipmentModal(true);
  };

  const handleEditEquipment = (eq: Equipment, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEquipment(eq);
    setEquipmentForm({
      assetCode: eq.assetCode || '',
      name: eq.name,
      category: eq.category || 'ANALYZER',
      description: eq.description || '',
      model: eq.model || '',
      manufacturer: eq.manufacturer || '',
      serialNumber: eq.serialNumber || '',
      location: eq.location || '',
      installationDate: eq.installationDate ? eq.installationDate.split('T')[0] : '',
      status: eq.status,
      requiresCalibration: eq.requiresCalibration ?? true,
      calibrationFrequencyDays: eq.calibrationFrequencyDays ?? 90,
      lastCalibrationDate: eq.lastCalibrationDate ? eq.lastCalibrationDate.split('T')[0] : '',
      nextCalibrationDate: eq.nextCalibrationDate ? eq.nextCalibrationDate.split('T')[0] : '',
      requiresMaintenance: eq.requiresMaintenance ?? true,
      maintenanceFrequencyDays: eq.maintenanceFrequencyDays ?? 90,
      lastMaintenanceDate: eq.lastMaintenanceDate ? eq.lastMaintenanceDate.split('T')[0] : '',
      nextMaintenanceDate: eq.nextMaintenanceDate ? eq.nextMaintenanceDate.split('T')[0] : '',
    });
    setShowEquipmentModal(true);
  };

  const handleDeleteEquipment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to decommission this equipment?')) {
      updateMutation.mutate({ id, data: { status: 'DECOMMISSIONED', isActive: false } });
      if (selectedEquipment === id) {
        setSelectedEquipment(null);
      }
    }
  };

  const handleSaveEquipment = () => {
    if (!equipmentForm.name || !equipmentForm.assetCode) {
      toast.error('Please fill in required fields (Name and Asset Code)');
      return;
    }

    const payload = {
      ...equipmentForm,
      facilityId,
      installationDate: equipmentForm.installationDate || undefined,
      lastCalibrationDate: equipmentForm.lastCalibrationDate || undefined,
      nextCalibrationDate: equipmentForm.nextCalibrationDate || undefined,
      lastMaintenanceDate: equipmentForm.lastMaintenanceDate || undefined,
      nextMaintenanceDate: equipmentForm.nextMaintenanceDate || undefined,
    };

    if (editingEquipment) {
      updateMutation.mutate({ id: editingEquipment.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
    setShowEquipmentModal(false);
    setEditingEquipment(null);
    setEquipmentForm(getEmptyEquipmentForm());
  };

  // Maintenance Operations
  const handleAddMaintenance = () => {
    if (!selectedEquipment) {
      toast.error('Please select equipment first');
      return;
    }
    setMaintenanceForm(getEmptyMaintenanceForm());
    setShowMaintenanceModal(true);
  };

  const handleSaveMaintenance = () => {
    if (!selectedEquipment || !maintenanceForm.description || !maintenanceForm.performedBy) {
      toast.error('Please fill in required fields (Description and Performed By)');
      return;
    }

    if (maintenanceForm.type === 'calibration') {
      calibrationMutation.mutate({
        id: selectedEquipment,
        data: {
          facilityId,
          calibrationDate: maintenanceForm.date,
          type: 'internal',
          performedBy: maintenanceForm.performedBy,
          comments: maintenanceForm.description,
          passed: true,
        },
      });
    } else {
      maintenanceMutation.mutate({
        id: selectedEquipment,
        data: {
          facilityId,
          maintenanceDate: maintenanceForm.date,
          type: maintenanceForm.type,
          description: maintenanceForm.description,
          performedBy: maintenanceForm.performedBy,
          cost: maintenanceForm.cost,
        },
      });
    }

    setShowMaintenanceModal(false);
    setMaintenanceForm(getEmptyMaintenanceForm());
  };

  const handleExportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      equipment,
      maintenanceRecords,
      stats,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lab-equipment-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Loading equipment data...</p>
        </div>
      </div>
    );
  }

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
            <button 
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
            <button 
              onClick={handleAddEquipment}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
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
            <Monitor className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Active:</span>
            <span className="font-semibold text-blue-600">{stats.active}</span>
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
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All Statuses' : statusLabels[status]}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Next Calibration</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Next Maintenance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
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
                    <td className="px-4 py-3 text-sm text-gray-600">{(eq.category || '').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {eq.nextCalibrationDate ? new Date(eq.nextCalibrationDate).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                        <Wrench className="w-3 h-3 text-gray-400" />
                        {eq.nextMaintenanceDate ? new Date(eq.nextMaintenanceDate).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{eq.location || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(eq.status)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={(e) => handleEditEquipment(eq, e)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" 
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEquipment(eq.id);
                          }}
                          className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded" 
                          title="Maintenance History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteEquipment(eq.id, e)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" 
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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
                          record.type === 'corrective' || record.type === 'emergency' ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500">{new Date(record.maintenanceDate || record.calibrationDate || record.createdAt || '').toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-gray-700">{record.description || record.comments || ''}</p>
                      <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                        <span>By: {record.performedBy || record.serviceProvider || '—'}</span>
                        <span>{record.cost != null ? formatCurrency(record.cost) : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">No maintenance records found</p>
              )}
              <button 
                onClick={handleAddMaintenance}
                className="w-full mt-4 px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Maintenance Record
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Equipment Modal */}
      {showEquipmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}
              </h2>
              <button 
                onClick={() => setShowEquipmentModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Code *</label>
                <input
                  type="text"
                  value={equipmentForm.assetCode}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, assetCode: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={equipmentForm.serialNumber}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, serialNumber: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={equipmentForm.model}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  value={equipmentForm.manufacturer}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, manufacturer: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={equipmentForm.category}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={equipmentForm.location}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Installation Date</label>
                <input
                  type="date"
                  value={equipmentForm.installationDate}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, installationDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={equipmentForm.status}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, status: e.target.value as Equipment['status'] }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="OPERATIONAL">Operational</option>
                  <option value="UNDER_MAINTENANCE">Maintenance</option>
                  <option value="OUT_OF_SERVICE">Out of Service</option>
                  <option value="CALIBRATION_DUE">Calibration Due</option>
                  <option value="DECOMMISSIONED">Decommissioned</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calibration Frequency (days)</label>
                <input
                  type="number"
                  value={equipmentForm.calibrationFrequencyDays}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, calibrationFrequencyDays: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Calibration</label>
                <input
                  type="date"
                  value={equipmentForm.lastCalibrationDate}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, lastCalibrationDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Calibration</label>
                <input
                  type="date"
                  value={equipmentForm.nextCalibrationDate}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, nextCalibrationDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Frequency (days)</label>
                <input
                  type="number"
                  value={equipmentForm.maintenanceFrequencyDays}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, maintenanceFrequencyDays: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Maintenance</label>
                <input
                  type="date"
                  value={equipmentForm.lastMaintenanceDate}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, lastMaintenanceDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Maintenance</label>
                <input
                  type="date"
                  value={equipmentForm.nextMaintenanceDate}
                  onChange={(e) => setEquipmentForm(prev => ({ ...prev, nextMaintenanceDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowEquipmentModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEquipment}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {editingEquipment ? 'Update' : 'Add'} Equipment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Add Maintenance Record</h2>
              <button 
                onClick={() => setShowMaintenanceModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={maintenanceForm.date}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={maintenanceForm.type}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, type: e.target.value as MaintenanceRecord['type'] }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="preventive">Preventive</option>
                  <option value="corrective">Corrective</option>
                  <option value="calibration">Calibration</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Performed By *</label>
                <input
                  type="text"
                  value={maintenanceForm.performedBy}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, performedBy: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost ({CURRENCY_SYMBOL})</label>
                <input
                  type="number"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, cost: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMaintenance}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
