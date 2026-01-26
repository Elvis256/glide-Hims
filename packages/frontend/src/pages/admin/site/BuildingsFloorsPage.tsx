import { useState, useMemo } from 'react';
import {
  Building2,
  Layers,
  DoorOpen,
  Bed,
  Plus,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  MapPin,
  Users,
  Stethoscope,
  FlaskConical,
  Pill,
  Scissors,
  Baby,
  Heart,
  Activity,
} from 'lucide-react';

interface Room {
  id: string;
  name: string;
  number: string;
  type: 'ward' | 'private' | 'icu' | 'theatre' | 'opd' | 'lab' | 'pharmacy' | 'office' | 'storage' | 'other';
  bedCount: number;
  occupiedBeds: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

interface Floor {
  id: string;
  name: string;
  level: number;
  rooms: Room[];
}

interface Wing {
  id: string;
  name: string;
  floors: Floor[];
}

interface BuildingData {
  id: string;
  name: string;
  code: string;
  wings: Wing[];
  totalBeds: number;
  occupiedBeds: number;
  facilityTypes: string[];
}

const mockBuildings: BuildingData[] = [
  {
    id: '1',
    name: 'Main Hospital Building',
    code: 'MHB',
    totalBeds: 120,
    occupiedBeds: 85,
    facilityTypes: ['OPD', 'IPD', 'Emergency', 'Laboratory'],
    wings: [
      {
        id: 'w1',
        name: 'East Wing',
        floors: [
          {
            id: 'f1',
            name: 'Ground Floor',
            level: 0,
            rooms: [
              { id: 'r1', name: 'Emergency Room', number: 'E-001', type: 'opd', bedCount: 10, occupiedBeds: 6, status: 'available' },
              { id: 'r2', name: 'Reception', number: 'E-002', type: 'office', bedCount: 0, occupiedBeds: 0, status: 'available' },
              { id: 'r3', name: 'OPD Room 1', number: 'E-003', type: 'opd', bedCount: 2, occupiedBeds: 1, status: 'available' },
            ],
          },
          {
            id: 'f2',
            name: 'First Floor',
            level: 1,
            rooms: [
              { id: 'r4', name: 'General Ward A', number: 'E-101', type: 'ward', bedCount: 20, occupiedBeds: 15, status: 'available' },
              { id: 'r5', name: 'General Ward B', number: 'E-102', type: 'ward', bedCount: 20, occupiedBeds: 18, status: 'occupied' },
            ],
          },
          {
            id: 'f3',
            name: 'Second Floor',
            level: 2,
            rooms: [
              { id: 'r6', name: 'ICU', number: 'E-201', type: 'icu', bedCount: 8, occupiedBeds: 6, status: 'available' },
              { id: 'r7', name: 'Private Room 1', number: 'E-202', type: 'private', bedCount: 1, occupiedBeds: 1, status: 'occupied' },
              { id: 'r8', name: 'Private Room 2', number: 'E-203', type: 'private', bedCount: 1, occupiedBeds: 0, status: 'available' },
            ],
          },
        ],
      },
      {
        id: 'w2',
        name: 'West Wing',
        floors: [
          {
            id: 'f4',
            name: 'Ground Floor',
            level: 0,
            rooms: [
              { id: 'r9', name: 'Laboratory', number: 'W-001', type: 'lab', bedCount: 0, occupiedBeds: 0, status: 'available' },
              { id: 'r10', name: 'Pharmacy', number: 'W-002', type: 'pharmacy', bedCount: 0, occupiedBeds: 0, status: 'available' },
            ],
          },
          {
            id: 'f5',
            name: 'First Floor',
            level: 1,
            rooms: [
              { id: 'r11', name: 'Theatre 1', number: 'W-101', type: 'theatre', bedCount: 2, occupiedBeds: 1, status: 'available' },
              { id: 'r12', name: 'Theatre 2', number: 'W-102', type: 'theatre', bedCount: 2, occupiedBeds: 0, status: 'maintenance' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: '2',
    name: 'Maternity Block',
    code: 'MTB',
    totalBeds: 40,
    occupiedBeds: 28,
    facilityTypes: ['Maternity', 'Pediatrics', 'NICU'],
    wings: [
      {
        id: 'w3',
        name: 'Main Wing',
        floors: [
          {
            id: 'f6',
            name: 'Ground Floor',
            level: 0,
            rooms: [
              { id: 'r13', name: 'Antenatal Clinic', number: 'M-001', type: 'opd', bedCount: 5, occupiedBeds: 3, status: 'available' },
              { id: 'r14', name: 'Labor Ward', number: 'M-002', type: 'ward', bedCount: 8, occupiedBeds: 5, status: 'available' },
            ],
          },
          {
            id: 'f7',
            name: 'First Floor',
            level: 1,
            rooms: [
              { id: 'r15', name: 'Postnatal Ward', number: 'M-101', type: 'ward', bedCount: 15, occupiedBeds: 12, status: 'available' },
              { id: 'r16', name: 'NICU', number: 'M-102', type: 'icu', bedCount: 12, occupiedBeds: 8, status: 'available' },
            ],
          },
        ],
      },
    ],
  },
];

const facilityIcons: Record<string, React.ReactNode> = {
  opd: <Stethoscope className="w-4 h-4" />,
  ward: <Bed className="w-4 h-4" />,
  private: <DoorOpen className="w-4 h-4" />,
  icu: <Heart className="w-4 h-4" />,
  theatre: <Scissors className="w-4 h-4" />,
  lab: <FlaskConical className="w-4 h-4" />,
  pharmacy: <Pill className="w-4 h-4" />,
  office: <Users className="w-4 h-4" />,
  maternity: <Baby className="w-4 h-4" />,
  emergency: <Activity className="w-4 h-4" />,
};

export default function BuildingsFloorsPage() {
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set(['1']));
  const [expandedWings, setExpandedWings] = useState<Set<string>>(new Set(['w1']));
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set(['f1']));
  const [selectedView, setSelectedView] = useState<'tree' | 'grid'>('tree');

  const toggleBuilding = (id: string) => {
    const newExpanded = new Set(expandedBuildings);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedBuildings(newExpanded);
  };

  const toggleWing = (id: string) => {
    const newExpanded = new Set(expandedWings);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedWings(newExpanded);
  };

  const toggleFloor = (id: string) => {
    const newExpanded = new Set(expandedFloors);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFloors(newExpanded);
  };

  const getRoomStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'occupied':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'reserved':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const stats = useMemo(() => {
    let totalBeds = 0;
    let occupiedBeds = 0;
    let totalRooms = 0;

    mockBuildings.forEach((building) => {
      totalBeds += building.totalBeds;
      occupiedBeds += building.occupiedBeds;
      building.wings.forEach((wing) => {
        wing.floors.forEach((floor) => {
          totalRooms += floor.rooms.length;
        });
      });
    });

    return {
      buildings: mockBuildings.length,
      totalBeds,
      occupiedBeds,
      availableBeds: totalBeds - occupiedBeds,
      totalRooms,
      occupancyRate: Math.round((occupiedBeds / totalBeds) * 100),
    };
  }, []);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buildings & Floors</h1>
          <p className="text-gray-600">Manage physical structure and room allocations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedView('tree')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'tree' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setSelectedView('grid')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'grid' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'
              }`}
            >
              Grid View
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Add Building
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Buildings</p>
          <p className="text-2xl font-bold text-gray-900">{stats.buildings}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Rooms</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalRooms}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Beds</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalBeds}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Occupied</p>
          <p className="text-2xl font-bold text-blue-600">{stats.occupiedBeds}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Available</p>
          <p className="text-2xl font-bold text-green-600">{stats.availableBeds}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Occupancy</p>
          <p className="text-2xl font-bold text-gray-900">{stats.occupancyRate}%</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedView === 'tree' ? (
          <div className="space-y-4">
            {mockBuildings.map((building) => (
              <div key={building.id} className="bg-white rounded-lg border border-gray-200">
                {/* Building Header */}
                <div
                  onClick={() => toggleBuilding(building.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    {expandedBuildings.has(building.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{building.name}</h3>
                      <p className="text-sm text-gray-500">Code: {building.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {building.occupiedBeds}/{building.totalBeds} beds
                      </p>
                      <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${(building.occupiedBeds / building.totalBeds) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Wings */}
                {expandedBuildings.has(building.id) && (
                  <div className="border-t border-gray-200">
                    {building.wings.map((wing) => (
                      <div key={wing.id} className="ml-6 border-l border-gray-200">
                        {/* Wing Header */}
                        <div
                          onClick={() => toggleWing(wing.id)}
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                        >
                          {expandedWings.has(wing.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-700">{wing.name}</span>
                          <span className="text-sm text-gray-500">({wing.floors.length} floors)</span>
                        </div>

                        {/* Floors */}
                        {expandedWings.has(wing.id) && (
                          <div className="ml-8 border-l border-gray-200">
                            {wing.floors.map((floor) => (
                              <div key={floor.id}>
                                {/* Floor Header */}
                                <div
                                  onClick={() => toggleFloor(floor.id)}
                                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                                >
                                  {expandedFloors.has(floor.id) ? (
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                  )}
                                  <Layers className="w-4 h-4 text-gray-400" />
                                  <span className="text-gray-700">{floor.name}</span>
                                  <span className="text-sm text-gray-500">
                                    ({floor.rooms.length} rooms)
                                  </span>
                                </div>

                                {/* Rooms */}
                                {expandedFloors.has(floor.id) && (
                                  <div className="ml-8 p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {floor.rooms.map((room) => (
                                      <div
                                        key={room.id}
                                        className={`p-3 rounded-lg border ${getRoomStatusColor(room.status)}`}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            {facilityIcons[room.type] || <DoorOpen className="w-4 h-4" />}
                                            <span className="font-medium text-sm">{room.name}</span>
                                          </div>
                                          <span className="text-xs">{room.number}</span>
                                        </div>
                                        {room.bedCount > 0 && (
                                          <div className="flex items-center gap-2 text-xs">
                                            <Bed className="w-3 h-3" />
                                            <span>
                                              {room.occupiedBeds}/{room.bedCount} beds
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    <button className="p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 flex items-center justify-center gap-2">
                                      <Plus className="w-4 h-4" />
                                      Add Room
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {mockBuildings.map((building) => (
              <div key={building.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{building.name}</h3>
                    <p className="text-sm text-gray-500">{building.code}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-500">Total Beds</p>
                    <p className="text-xl font-bold text-gray-900">{building.totalBeds}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-500">Occupied</p>
                    <p className="text-xl font-bold text-blue-600">{building.occupiedBeds}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {building.facilityTypes.map((type) => (
                    <span
                      key={type}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
