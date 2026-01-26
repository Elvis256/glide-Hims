import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Droplets,
  User,
  Barcode,
  Clock,
  CheckCircle,
  AlertCircle,
  Printer,
  Search,
  Clipboard,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { labService, type LabOrder } from '../../services';

type SampleType = 'Blood' | 'Urine' | 'Stool' | 'Swab' | 'Sputum' | 'CSF';

interface PendingCollection {
  id: string;
  patientName: string;
  patientId: string;
  roomNumber: string;
  sampleType: SampleType;
  tests: string[];
  orderTime: string;
  priority: 'STAT' | 'Urgent' | 'Routine';
  specialInstructions: string;
  collected: boolean;
  collectedAt?: string;
  collectedBy?: string;
  barcode?: string;
}

const mockCollections: PendingCollection[] = [
  { id: 'SC001', patientName: 'John Smith', patientId: 'P001', roomNumber: '201A', sampleType: 'Blood', tests: ['CBC', 'BMP'], orderTime: '08:15 AM', priority: 'STAT', specialInstructions: 'Fasting required', collected: false },
  { id: 'SC002', patientName: 'Mary Johnson', patientId: 'P002', roomNumber: '105B', sampleType: 'Urine', tests: ['Urinalysis', 'Culture'], orderTime: '07:45 AM', priority: 'Routine', specialInstructions: 'Midstream clean catch', collected: false },
  { id: 'SC003', patientName: 'Robert Brown', patientId: 'P003', roomNumber: '302', sampleType: 'Swab', tests: ['Throat Culture'], orderTime: '08:30 AM', priority: 'Urgent', specialInstructions: 'Swab both tonsils', collected: false },
  { id: 'SC004', patientName: 'Emily Davis', patientId: 'P004', roomNumber: '210', sampleType: 'Blood', tests: ['Lipid Panel', 'HbA1c'], orderTime: '06:30 AM', priority: 'Routine', specialInstructions: '12-hour fasting', collected: true, collectedAt: '07:00 AM', collectedBy: 'Tech. Sarah', barcode: 'LAB-2024-0001' },
  { id: 'SC005', patientName: 'Michael Wilson', patientId: 'P005', roomNumber: 'ER-3', sampleType: 'Blood', tests: ['Troponin', 'BNP', 'D-Dimer'], orderTime: '08:45 AM', priority: 'STAT', specialInstructions: 'Cardiac workup - urgent', collected: false },
  { id: 'SC006', patientName: 'Sarah Lee', patientId: 'P006', roomNumber: '108', sampleType: 'Stool', tests: ['Occult Blood', 'Culture'], orderTime: '07:00 AM', priority: 'Routine', specialInstructions: 'Collect 3 samples on different days', collected: false },
  { id: 'SC007', patientName: 'David Chen', patientId: 'P007', roomNumber: 'ICU-2', sampleType: 'Blood', tests: ['ABG', 'Lactate'], orderTime: '09:00 AM', priority: 'STAT', specialInstructions: 'Arterial draw required', collected: false },
  { id: 'SC008', patientName: 'Lisa Anderson', patientId: 'P008', roomNumber: '215', sampleType: 'Sputum', tests: ['AFB Smear', 'Culture'], orderTime: '08:00 AM', priority: 'Urgent', specialInstructions: 'Early morning sample preferred', collected: false },
];

const sampleTypeIcons: Record<SampleType, string> = {
  Blood: '🩸',
  Urine: '🧪',
  Stool: '🔬',
  Swab: '🧫',
  Sputum: '💨',
  CSF: '💉',
};

const priorityColors = {
  STAT: 'bg-red-100 text-red-700 border-red-300',
  Urgent: 'bg-orange-100 text-orange-700 border-orange-300',
  Routine: 'bg-blue-100 text-blue-700 border-blue-300',
};

export default function SampleCollectionPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PendingCollection | null>(null);
  const [collectorName, setCollectorName] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastBarcode, setLastBarcode] = useState('');

  // Fetch pending collections from API
  const { data: apiOrders, isLoading, refetch } = useQuery({
    queryKey: ['lab-orders', 'pending-collection'],
    queryFn: () => labService.orders.getPending(),
    staleTime: 15000,
    refetchInterval: 15000,
  });

  // Transform API orders to collection format
  const collections: PendingCollection[] = useMemo(() => {
    const orders = apiOrders || [];
    if (orders.length === 0) return [];
    return orders.map((order: LabOrder) => ({
      id: order.id,
      patientName: order.patient?.fullName || 'Unknown',
      patientId: order.patientId,
      roomNumber: order.patient?.room || order.patient?.mrn || 'N/A',
      sampleType: (order.sampleType as SampleType) || 'Blood',
      tests: order.tests?.map((t) => t.name || t.testName) || [],
      orderTime: new Date(order.createdAt || '').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      priority: (order.priority?.toUpperCase() === 'STAT' ? 'STAT' : 
                order.priority?.toLowerCase() === 'urgent' ? 'Urgent' : 'Routine') as 'STAT' | 'Urgent' | 'Routine',
      specialInstructions: order.clinicalNotes || '',
      collected: order.status === 'collected' || order.status === 'in-progress',
      collectedAt: order.collectedAt,
      collectedBy: order.collectedBy,
      barcode: order.sampleId,
    }));
  }, [apiOrders]);

  // Collect sample mutation
  const collectMutation = useMutation({
    mutationFn: (data: { orderId: string; collectorName: string; barcode: string }) =>
      labService.orders.updateStatus(data.orderId, 'collected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
    },
  });

  const pendingCollections = useMemo(() => {
    return collections
      .filter((c) => !c.collected)
      .filter((c) =>
        c.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        const priorityOrder = { STAT: 0, Urgent: 1, Routine: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }, [collections, searchTerm]);

  const generateBarcode = () => {
    const date = new Date();
    const code = `LAB-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    return code;
  };

  const handleMarkCollected = (collection: PendingCollection) => {
    if (!collectorName.trim()) {
      alert('Please enter collector name');
      return;
    }
    const barcode = generateBarcode();
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    collectMutation.mutate({
      orderId: collection.id,
      collectorName,
      barcode,
    });

    setLastBarcode(barcode);
    setShowPrintModal(true);
    setSelectedPatient(null);
  };

  const stats = useMemo(() => ({
    pending: collections.filter((c) => !c.collected).length,
    collected: collections.filter((c) => c.collected).length,
    stat: collections.filter((c) => !c.collected && c.priority === 'STAT').length,
  }), [collections]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Droplets className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sample Collection</h1>
            <p className="text-sm text-gray-500">Manage pending sample collections</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-xl font-bold text-red-600">{stats.stat}</p>
            <p className="text-xs text-red-500">STAT Pending</p>
          </div>
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-amber-500">Total Pending</p>
          </div>
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-xl font-bold text-green-600">{stats.collected}</p>
            <p className="text-xs text-green-500">Collected Today</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name, ID, or room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="divide-y divide-gray-100">
              {pendingCollections.map((collection) => (
                <div
                  key={collection.id}
                  onClick={() => setSelectedPatient(collection)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedPatient?.id === collection.id ? 'bg-rose-50 border-l-4 border-rose-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{sampleTypeIcons[collection.sampleType]}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{collection.patientName}</p>
                          <span className={`px-2 py-0.5 rounded border text-xs font-medium ${priorityColors[collection.priority]}`}>
                            {collection.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {collection.patientId} • Room {collection.roomNumber}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {collection.tests.map((test) => (
                            <span key={test} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {test}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {collection.orderTime}
                      </p>
                      <p className="text-sm font-medium text-gray-700 mt-1">{collection.sampleType}</p>
                    </div>
                  </div>
                </div>
              ))}
              {pendingCollections.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
                  <p>All samples collected!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-96 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          {selectedPatient ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold text-gray-900">Collection Details</h2>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <User className="w-10 h-10 p-2 bg-white rounded-full text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">{selectedPatient.patientName}</p>
                      <p className="text-sm text-gray-500">{selectedPatient.patientId}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Room</p>
                      <p className="font-medium">{selectedPatient.roomNumber}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500">Sample Type</p>
                      <p className="font-medium flex items-center gap-1">
                        {sampleTypeIcons[selectedPatient.sampleType]} {selectedPatient.sampleType}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">Tests Ordered</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPatient.tests.map((test) => (
                        <span key={test} className="px-2 py-1 bg-white border border-gray-200 text-gray-700 text-sm rounded">
                          {test}
                        </span>
                      ))}
                    </div>
                  </div>

                  {selectedPatient.specialInstructions && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <p className="text-xs font-medium text-amber-700">Special Instructions</p>
                      </div>
                      <p className="text-sm text-amber-800">{selectedPatient.specialInstructions}</p>
                    </div>
                  )}

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <label className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <UserCheck className="w-4 h-4" />
                      Collector Name
                    </label>
                    <input
                      type="text"
                      value={collectorName}
                      onChange={(e) => setCollectorName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Barcode className="w-4 h-4 text-gray-500" />
                      <p className="text-xs text-gray-500">Barcode will be generated</p>
                    </div>
                    <div className="h-12 bg-white border border-gray-200 rounded flex items-center justify-center">
                      <Clipboard className="w-5 h-5 text-gray-300 mr-2" />
                      <span className="text-gray-400 text-sm">Auto-generated on collection</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => handleMarkCollected(selectedPatient)}
                  className="w-full py-3 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Mark as Collected
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Droplets className="w-12 h-12 mx-auto mb-2" />
                <p>Select a patient to collect sample</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sample Collected!</h3>
              <p className="text-gray-600 mb-4">Barcode generated successfully</p>
              <div className="p-4 bg-gray-100 rounded-lg mb-4">
                <Barcode className="w-8 h-8 mx-auto mb-2 text-gray-700" />
                <p className="font-mono text-lg font-bold">{lastBarcode}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print();
                    setShowPrintModal(false);
                  }}
                  className="flex-1 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
