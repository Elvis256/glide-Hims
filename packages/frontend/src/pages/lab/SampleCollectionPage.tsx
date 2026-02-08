import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { useFacilityId } from '../../lib/facility';

type SampleType = 'blood' | 'serum' | 'plasma' | 'urine' | 'stool' | 'sputum' | 'csf' | 'swab' | 'tissue' | 'other';

const sampleTypeDisplay: Record<SampleType, string> = {
  blood: 'Blood',
  serum: 'Serum',
  plasma: 'Plasma',
  urine: 'Urine',
  stool: 'Stool',
  sputum: 'Sputum',
  csf: 'CSF',
  swab: 'Swab',
  tissue: 'Tissue',
  other: 'Other',
};

interface PendingCollection {
  id: string;
  patientName: string;
  patientId: string;
  roomNumber: string;
  sampleType: SampleType;
  tests: Array<{ testId: string; testName: string; testCode?: string }>;
  orderTime: string;
  priority: 'stat' | 'urgent' | 'routine';
  specialInstructions: string;
  collected: boolean;
  collectedAt?: string;
  collectedBy?: string;
  barcode?: string;
}



const sampleTypeIcons: Record<SampleType, string> = {
  blood: '🩸',
  serum: '🧪',
  plasma: '🧪',
  urine: '🧪',
  stool: '🔬',
  swab: '🧫',
  sputum: '💨',
  csf: '💉',
  tissue: '🔬',
  other: '🧪',
};

const priorityColors = {
  stat: 'bg-red-100 text-red-700 border-red-300',
  urgent: 'bg-orange-100 text-orange-700 border-orange-300',
  routine: 'bg-blue-100 text-blue-700 border-blue-300',
};

// Tube color guide for phlebotomy
const tubeColorGuide: Record<string, { color: string; tests: string; instructions: string }> = {
  'Red Top': { color: 'bg-red-600', tests: 'Chemistry, Serology, Blood Bank', instructions: 'No additive. Allow to clot 30-60 min.' },
  'Gold/SST': { color: 'bg-yellow-500', tests: 'Chemistry, Lipids, LFTs, RFTs', instructions: 'Serum separator. Clot 30 min.' },
  'Lavender/EDTA': { color: 'bg-purple-500', tests: 'CBC, HbA1c, ESR', instructions: 'Invert 8-10 times. Do not shake.' },
  'Light Blue': { color: 'bg-blue-300', tests: 'PT/INR, PTT, D-Dimer', instructions: 'Fill to line. Invert 3-4 times.' },
  'Green/Heparin': { color: 'bg-green-500', tests: 'Electrolytes, ABG, Ammonia', instructions: 'Invert 8-10 times.' },
  'Gray': { color: 'bg-gray-500', tests: 'Glucose, Lactate', instructions: 'Contains fluoride. Invert 8-10 times.' },
  'Pink/EDTA': { color: 'bg-pink-400', tests: 'Blood Bank, Type & Screen', instructions: 'Same as lavender.' },
};

export default function SampleCollectionPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PendingCollection | null>(null);
  const [collectorName, setCollectorName] = useState('');
  const [selectedSampleType, setSelectedSampleType] = useState<SampleType>('blood');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastBarcode, setLastBarcode] = useState('');

  if (!hasPermission('lab.read')) {
    return <AccessDenied />;
  }

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
      sampleType: ((order.sampleType as SampleType) || 'blood'),
      tests: (order.tests || []).map((t) => ({
        testId: t.testId || t.id,
        testName: t.name || t.testName || '',
        testCode: t.testCode,
      })).filter(t => t.testName),
      orderTime: new Date(order.createdAt || '').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      priority: (order.priority || 'routine') as 'stat' | 'urgent' | 'routine',
      specialInstructions: order.clinicalNotes || '',
      collected: order.status === 'collected' || order.status === 'processing' || order.status === 'in-progress',
      collectedAt: order.collectedAt,
      collectedBy: order.collectedBy,
      barcode: order.sampleId,
    }));
  }, [apiOrders]);

  // Collect sample mutation - creates LabSample and updates order status
  const collectMutation = useMutation({
    mutationFn: async (data: { collection: PendingCollection; collectorName: string; sampleType: SampleType }) => {
      // For each test in the order, collect a sample
      const firstTest = data.collection.tests[0];
      if (!firstTest) {
        throw new Error('No tests found in order');
      }
      
      // Look up the lab test by code to get the real UUID
      const labTest = await labService.tests.getByCode(firstTest.testCode || firstTest.testId);
      if (!labTest) {
        throw new Error(`Lab test not found for code: ${firstTest.testCode || firstTest.testId}`);
      }
      
      // Create lab sample via /lab/samples
      const sampleDto: any = {
        orderId: data.collection.id,
        patientId: data.collection.patientId,
        facilityId: facilityId,
        labTestId: labTest.id,
        sampleType: data.sampleType,
        priority: data.collection.priority,
        collectionNotes: `Collected by ${data.collectorName}`,
      };
      
      const sample = await labService.samples.collect(sampleDto);
      
      // Also update order status to in_progress
      await labService.orders.updateStatus(data.collection.id, 'in_progress');
      
      return sample;
    },
    onSuccess: (sample) => {
      setLastBarcode(sample.sampleNumber || sample.barcode || '');
      setShowPrintModal(true);
      setSelectedPatient(null);
      toast.success('Sample collected successfully');
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-samples'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error.message || 'Unknown error';
      toast.error(`Failed to collect sample: ${message}`);
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
        const priorityOrder = { stat: 0, urgent: 1, routine: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }, [collections, searchTerm]);

  const handleMarkCollected = (collection: PendingCollection) => {
    if (!collectorName.trim()) {
      toast.error('Please enter collector name');
      return;
    }
    
    collectMutation.mutate({
      collection,
      collectorName,
      sampleType: selectedSampleType,
    });
  };

  const stats = useMemo(() => ({
    pending: collections.filter((c) => !c.collected).length,
    collected: collections.filter((c) => c.collected).length,
    stat: collections.filter((c) => !c.collected && c.priority === 'stat').length,
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
                  onClick={() => {
                    setSelectedPatient(collection);
                    setSelectedSampleType(collection.sampleType);
                  }}
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
                            {collection.priority.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {collection.patientId} • Room {collection.roomNumber}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {collection.tests.map((test) => (
                            <span key={test.testId} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              {test.testName}
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
                      <p className="text-sm font-medium text-gray-700 mt-1">{sampleTypeDisplay[collection.sampleType] || collection.sampleType}</p>
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
                      <label className="text-xs text-gray-500 block mb-1">Sample Type</label>
                      <select
                        value={selectedSampleType}
                        onChange={(e) => setSelectedSampleType(e.target.value as SampleType)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 text-sm font-medium"
                      >
                        {(Object.keys(sampleTypeDisplay) as SampleType[]).map((type) => (
                          <option key={type} value={type}>
                            {sampleTypeIcons[type]} {sampleTypeDisplay[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">Tests Ordered</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedPatient.tests.map((test) => (
                        <span key={test.testId} className="px-2 py-1 bg-white border border-gray-200 text-gray-700 text-sm rounded">
                          {test.testName}
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
