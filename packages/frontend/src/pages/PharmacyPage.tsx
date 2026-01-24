import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Pill,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Package,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';

interface PrescriptionItem {
  id: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
}

interface Prescription {
  id: string;
  prescriptionNumber: string;
  status: 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';
  encounter: {
    id: string;
    visitNumber: string;
    patient: {
      id: string;
      mrn: string;
      fullName: string;
    };
  };
  prescriber: {
    fullName: string;
  };
  items: PrescriptionItem[];
  createdAt: string;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  partially_dispensed: 'bg-blue-100 text-blue-800',
  dispensed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels = {
  pending: 'Pending',
  partially_dispensed: 'Partial',
  dispensed: 'Dispensed',
  cancelled: 'Cancelled',
};

export default function PharmacyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
  const [dispensingItems, setDispensingItems] = useState<Record<string, number>>({});

  // Fetch prescriptions
  const { data: prescriptionsData, isLoading, refetch } = useQuery({
    queryKey: ['prescriptions', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/prescriptions?${params}`);
      return response.data;
    },
  });

  // Dispense mutation
  const dispenseMutation = useMutation({
    mutationFn: async ({ prescriptionId, items }: { prescriptionId: string; items: { itemId: string; quantityDispensed: number }[] }) => {
      const response = await api.post(`/prescriptions/${prescriptionId}/dispense`, { items });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      setSelectedPrescription(null);
      setDispensingItems({});
    },
  });

  const prescriptions: Prescription[] = prescriptionsData?.data || [];

  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      rx.prescriptionNumber.toLowerCase().includes(search) ||
      rx.encounter.patient.mrn.toLowerCase().includes(search) ||
      rx.encounter.patient.fullName.toLowerCase().includes(search)
    );
  });

  const handleDispense = () => {
    if (!selectedPrescription) return;

    const items = Object.entries(dispensingItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantityDispensed]) => ({ itemId, quantityDispensed }));

    if (items.length === 0) {
      alert('Please enter quantities to dispense');
      return;
    }

    dispenseMutation.mutate({
      prescriptionId: selectedPrescription.id,
      items,
    });
  };

  const initializeDispensingItems = (prescription: Prescription) => {
    const items: Record<string, number> = {};
    prescription.items.forEach((item) => {
      items[item.id] = item.quantity;
    });
    setDispensingItems(items);
  };

  // Stats
  const pendingCount = prescriptions.filter((rx) => rx.status === 'pending').length;
  const todayDispensed = prescriptions.filter((rx) => rx.status === 'dispensed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Queue</h1>
          <p className="text-gray-600">Dispense prescriptions</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">{pendingCount}</p>
              <p className="text-sm text-yellow-700">Pending Prescriptions</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{todayDispensed}</p>
              <p className="text-sm text-green-700">Dispensed Today</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-900">{prescriptions.length}</p>
              <p className="text-sm text-blue-700">Total in Queue</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by prescription #, MRN, or patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="partially_dispensed">Partially Dispensed</option>
          <option value="dispensed">Dispensed</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prescription List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Prescriptions</h2>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : filteredPrescriptions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Pill className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No prescriptions found</p>
              </div>
            ) : (
              filteredPrescriptions.map((rx) => (
                <div
                  key={rx.id}
                  onClick={() => {
                    setSelectedPrescription(rx);
                    initializeDispensingItems(rx);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedPrescription?.id === rx.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{rx.prescriptionNumber}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[rx.status]}`}>
                          {statusLabels[rx.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{rx.encounter.patient.fullName}</span>
                        <span className="text-gray-400">•</span>
                        <span>{rx.encounter.patient.mrn}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {rx.items.length} item(s) • Dr. {rx.prescriber?.fullName || 'Unknown'}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(rx.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dispensing Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Dispense</h2>
          </div>
          {selectedPrescription ? (
            <div className="p-4">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedPrescription.encounter.patient.fullName}</p>
                    <p className="text-sm text-gray-500">
                      {selectedPrescription.encounter.patient.mrn} • {selectedPrescription.prescriptionNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3 mb-4">
                <h3 className="font-medium text-gray-900">Prescription Items</h3>
                {selectedPrescription.items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.drugName}</p>
                        <p className="text-sm text-gray-600">
                          {item.dose} • {item.frequency} • {item.duration}
                        </p>
                        {item.instructions && (
                          <p className="text-xs text-gray-500 mt-1">{item.instructions}</p>
                        )}
                        <p className="text-sm text-gray-700 mt-1">
                          Prescribed: <span className="font-medium">{item.quantity}</span>
                        </p>
                      </div>
                      <div className="w-24">
                        <label className="text-xs text-gray-500">Dispense</label>
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={dispensingItems[item.id] || 0}
                          onChange={(e) =>
                            setDispensingItems({
                              ...dispensingItems,
                              [item.id]: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2 py-1 border rounded text-center"
                          disabled={selectedPrescription.status === 'dispensed'}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              {selectedPrescription.status !== 'dispensed' && (
                <div className="flex gap-3">
                  <button
                    onClick={handleDispense}
                    disabled={dispenseMutation.isPending}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {dispenseMutation.isPending ? 'Processing...' : 'Dispense'}
                  </button>
                  <button
                    onClick={() => navigate(`/encounters/${selectedPrescription.encounter.id}`)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    View Visit
                  </button>
                </div>
              )}

              {selectedPrescription.status === 'dispensed' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-green-800 font-medium">Already Dispensed</p>
                </div>
              )}

              {dispenseMutation.isError && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-800 text-sm">Failed to dispense. Please try again.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Pill className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Select a prescription to dispense</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
