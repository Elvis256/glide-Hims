import { useState, useMemo } from 'react';
import {
  Truck,
  MapPin,
  Clock,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
  Navigation,
  Radio,
  Package,
  Users,
  Plus,
  Activity,
  Wifi,
} from 'lucide-react';

type AmbulanceStatus = 'available' | 'en-route' | 'at-scene' | 'returning';

interface Ambulance {
  id: string;
  vehicleNumber: string;
  status: AmbulanceStatus;
  crew: { driver: string; paramedic: string };
  location: string;
  eta?: number;
  patient?: { name: string; condition: string; vitals: string };
  equipment: { oxygen: boolean; defibrillator: boolean; stretcher: boolean; firstAid: boolean };
  lastUpdate: Date;
}

const mockAmbulances: Ambulance[] = [
  {
    id: 'AMB001',
    vehicleNumber: 'EMT-101',
    status: 'en-route',
    crew: { driver: 'John Smith', paramedic: 'Dr. Sarah Lee' },
    location: 'Highway 45, 5km from hospital',
    eta: 8,
    patient: { name: 'Unknown Male', condition: 'Cardiac arrest', vitals: 'BP: 90/60, HR: 120' },
    equipment: { oxygen: true, defibrillator: true, stretcher: true, firstAid: true },
    lastUpdate: new Date(Date.now() - 2 * 60000),
  },
  {
    id: 'AMB002',
    vehicleNumber: 'EMT-102',
    status: 'at-scene',
    crew: { driver: 'Mike Johnson', paramedic: 'Dr. Emily Chen' },
    location: '123 Oak Street, Downtown',
    eta: 15,
    patient: { name: 'Mary Wilson', condition: 'Fall injury', vitals: 'BP: 130/85, HR: 88' },
    equipment: { oxygen: true, defibrillator: true, stretcher: true, firstAid: true },
    lastUpdate: new Date(Date.now() - 5 * 60000),
  },
  {
    id: 'AMB003',
    vehicleNumber: 'EMT-103',
    status: 'available',
    crew: { driver: 'Robert Davis', paramedic: 'Dr. James Miller' },
    location: 'Hospital Bay 3',
    equipment: { oxygen: true, defibrillator: true, stretcher: true, firstAid: true },
    lastUpdate: new Date(),
  },
  {
    id: 'AMB004',
    vehicleNumber: 'EMT-104',
    status: 'returning',
    crew: { driver: 'David Brown', paramedic: 'Dr. Lisa Wang' },
    location: 'Central Ave, 3km out',
    eta: 5,
    equipment: { oxygen: true, defibrillator: false, stretcher: true, firstAid: true },
    lastUpdate: new Date(Date.now() - 1 * 60000),
  },
  {
    id: 'AMB005',
    vehicleNumber: 'EMT-105',
    status: 'available',
    crew: { driver: 'Chris Taylor', paramedic: 'Dr. Amanda Scott' },
    location: 'Hospital Bay 1',
    equipment: { oxygen: true, defibrillator: true, stretcher: true, firstAid: false },
    lastUpdate: new Date(),
  },
];

const statusConfig: Record<AmbulanceStatus, { label: string; color: string; bgColor: string; icon: typeof Truck }> = {
  'available': { label: 'Available', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  'en-route': { label: 'En Route', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Navigation },
  'at-scene': { label: 'At Scene', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: MapPin },
  'returning': { label: 'Returning', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Truck },
};

export default function AmbulanceTrackingPage() {
  const [ambulances] = useState<Ambulance[]>(mockAmbulances);
  const [selectedAmbulance, setSelectedAmbulance] = useState<string | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  const stats = useMemo(() => ({
    total: ambulances.length,
    available: ambulances.filter(a => a.status === 'available').length,
    active: ambulances.filter(a => a.status !== 'available').length,
    incoming: ambulances.filter(a => a.status === 'en-route' && a.patient).length,
  }), [ambulances]);

  const selected = ambulances.find(a => a.id === selectedAmbulance);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Truck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ambulance Tracking</h1>
            <p className="text-sm text-gray-500">Real-time fleet management & dispatch</p>
          </div>
        </div>
        <button
          onClick={() => setShowDispatchModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Plus className="w-4 h-4" />
          Dispatch Ambulance
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Truck className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Fleet</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.available}</p>
              <p className="text-sm text-gray-500">Available</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.active}</p>
              <p className="text-sm text-gray-500">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.incoming}</p>
              <p className="text-sm text-gray-500">Incoming Patients</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {/* Map Placeholder */}
        <div className="col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Live Tracking Map</h2>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Wifi className="w-4 h-4" />
              GPS Connected
            </div>
          </div>
          <div className="flex-1 bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center relative">
            <div className="absolute inset-4 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">GPS Tracking Map</p>
                <p className="text-sm text-gray-400">Real-time ambulance locations</p>
              </div>
            </div>
            {/* Simulated ambulance markers */}
            {ambulances.map((amb, idx) => (
              <div
                key={amb.id}
                className={`absolute w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transform hover:scale-110 transition-transform ${
                  amb.status === 'available' ? 'bg-green-500' :
                  amb.status === 'en-route' ? 'bg-blue-500' :
                  amb.status === 'at-scene' ? 'bg-orange-500' : 'bg-purple-500'
                }`}
                style={{ top: `${20 + idx * 15}%`, left: `${15 + idx * 12}%` }}
                onClick={() => setSelectedAmbulance(amb.id)}
              >
                <Truck className="w-4 h-4 text-white" />
              </div>
            ))}
          </div>
        </div>

        {/* Ambulance List */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900">Ambulance Fleet</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {ambulances.map((ambulance) => {
              const config = statusConfig[ambulance.status];
              const StatusIcon = config.icon;
              return (
                <div
                  key={ambulance.id}
                  className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                    selectedAmbulance === ambulance.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                  onClick={() => setSelectedAmbulance(ambulance.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-gray-600" />
                      <span className="font-semibold">{ambulance.vehicleNumber}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{ambulance.location}</span>
                  </div>
                  {ambulance.eta && (
                    <div className="flex items-center gap-1 text-sm text-blue-600">
                      <Clock className="w-3 h-3" />
                      <span>ETA: {ambulance.eta} min</span>
                    </div>
                  )}
                  {ambulance.patient && (
                    <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                      <div className="flex items-center gap-1 text-sm text-red-700 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        {ambulance.patient.condition}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Ambulance Details Panel */}
      {selected && (
        <div className="mt-4 bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{selected.vehicleNumber} Details</h3>
            <button onClick={() => setSelectedAmbulance(null)} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Users className="w-4 h-4" /> Crew
              </h4>
              <p className="text-sm"><span className="text-gray-500">Driver:</span> {selected.crew.driver}</p>
              <p className="text-sm"><span className="text-gray-500">Paramedic:</span> {selected.crew.paramedic}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Package className="w-4 h-4" /> Equipment Status
              </h4>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <span className={selected.equipment.oxygen ? 'text-green-600' : 'text-red-600'}>
                  {selected.equipment.oxygen ? '✓' : '✗'} Oxygen
                </span>
                <span className={selected.equipment.defibrillator ? 'text-green-600' : 'text-red-600'}>
                  {selected.equipment.defibrillator ? '✓' : '✗'} Defib
                </span>
                <span className={selected.equipment.stretcher ? 'text-green-600' : 'text-red-600'}>
                  {selected.equipment.stretcher ? '✓' : '✗'} Stretcher
                </span>
                <span className={selected.equipment.firstAid ? 'text-green-600' : 'text-red-600'}>
                  {selected.equipment.firstAid ? '✓' : '✗'} First Aid
                </span>
              </div>
            </div>
            {selected.patient && (
              <div className="col-span-2 p-3 bg-red-50 rounded-lg border border-red-200">
                <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Incoming Patient Alert
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-gray-500">Patient:</span> {selected.patient.name}</p>
                  <p><span className="text-gray-500">Condition:</span> {selected.patient.condition}</p>
                  <p className="col-span-2"><span className="text-gray-500">Vitals:</span> {selected.patient.vitals}</p>
                </div>
              </div>
            )}
            {!selected.patient && (
              <div className="col-span-2 flex items-center gap-4">
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Radio className="w-4 h-4" />
                  Contact Crew
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  <Phone className="w-4 h-4" />
                  Call Driver
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Dispatch Ambulance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Ambulance</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  {ambulances.filter(a => a.status === 'available').map(a => (
                    <option key={a.id} value={a.id}>{a.vehicleNumber}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
                <input type="text" className="w-full border rounded-lg px-3 py-2" placeholder="Enter address or coordinates" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Type</label>
                <select className="w-full border rounded-lg px-3 py-2">
                  <option>Cardiac Emergency</option>
                  <option>Trauma / Accident</option>
                  <option>Respiratory Distress</option>
                  <option>Stroke</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caller Contact</label>
                <input type="tel" className="w-full border rounded-lg px-3 py-2" placeholder="Phone number" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Dispatch Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
