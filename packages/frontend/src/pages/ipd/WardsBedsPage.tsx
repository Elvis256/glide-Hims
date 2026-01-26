import { useState, useMemo } from 'react';
import {
  Bed,
  Building2,
  User,
  AlertCircle,
  Wrench,
  Clock,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  Calendar,
  Phone,
  Stethoscope,
} from 'lucide-react';

type BedStatus = 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';
type WardType = 'All' | 'General' | 'ICU' | 'Private' | 'Maternity' | 'Pediatric';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  admittedAt: string;
  diagnosis: string;
  doctor: string;
  phone: string;
}

interface BedInfo {
  id: string;
  number: string;
  status: BedStatus;
  patient?: Patient;
  reservedFor?: string;
  reservedUntil?: string;
  maintenanceNote?: string;
}

interface Ward {
  id: string;
  name: string;
  type: WardType;
  floor: number;
  beds: BedInfo[];
}

const mockWards: Ward[] = [
  {
    id: 'W001',
    name: 'General Ward A',
    type: 'General',
    floor: 1,
    beds: [
      { id: 'B001', number: 'A-101', status: 'Available' },
      { id: 'B002', number: 'A-102', status: 'Occupied', patient: { id: 'P001', name: 'John Mwangi', age: 45, gender: 'Male', admittedAt: '2024-01-12', diagnosis: 'Pneumonia', doctor: 'Dr. Sarah Kimani', phone: '0712345678' } },
      { id: 'B003', number: 'A-103', status: 'Occupied', patient: { id: 'P002', name: 'Mary Wanjiku', age: 32, gender: 'Female', admittedAt: '2024-01-14', diagnosis: 'Post-surgery recovery', doctor: 'Dr. James Otieno', phone: '0723456789' } },
      { id: 'B004', number: 'A-104', status: 'Reserved', reservedFor: 'Peter Ochieng', reservedUntil: '2024-01-16 10:00' },
      { id: 'B005', number: 'A-105', status: 'Available' },
      { id: 'B006', number: 'A-106', status: 'Maintenance', maintenanceNote: 'Bed frame repair' },
    ],
  },
  {
    id: 'W002',
    name: 'ICU',
    type: 'ICU',
    floor: 2,
    beds: [
      { id: 'B007', number: 'ICU-01', status: 'Occupied', patient: { id: 'P003', name: 'David Njoroge', age: 62, gender: 'Male', admittedAt: '2024-01-10', diagnosis: 'Cardiac arrest recovery', doctor: 'Dr. Anne Mutua', phone: '0734567890' } },
      { id: 'B008', number: 'ICU-02', status: 'Occupied', patient: { id: 'P004', name: 'Grace Achieng', age: 28, gender: 'Female', admittedAt: '2024-01-13', diagnosis: 'Severe trauma', doctor: 'Dr. David Njoroge', phone: '0745678901' } },
      { id: 'B009', number: 'ICU-03', status: 'Available' },
      { id: 'B010', number: 'ICU-04', status: 'Available' },
    ],
  },
  {
    id: 'W003',
    name: 'Private Ward',
    type: 'Private',
    floor: 3,
    beds: [
      { id: 'B011', number: 'PVT-01', status: 'Occupied', patient: { id: 'P005', name: 'Jane Kamau', age: 55, gender: 'Female', admittedAt: '2024-01-11', diagnosis: 'Elective surgery', doctor: 'Dr. Sarah Kimani', phone: '0756789012' } },
      { id: 'B012', number: 'PVT-02', status: 'Available' },
      { id: 'B013', number: 'PVT-03', status: 'Reserved', reservedFor: 'VIP Patient', reservedUntil: '2024-01-16 14:00' },
      { id: 'B014', number: 'PVT-04', status: 'Available' },
    ],
  },
  {
    id: 'W004',
    name: 'Maternity Ward',
    type: 'Maternity',
    floor: 1,
    beds: [
      { id: 'B015', number: 'MAT-01', status: 'Occupied', patient: { id: 'P006', name: 'Faith Njeri', age: 26, gender: 'Female', admittedAt: '2024-01-14', diagnosis: 'Labour', doctor: 'Dr. James Otieno', phone: '0767890123' } },
      { id: 'B016', number: 'MAT-02', status: 'Occupied', patient: { id: 'P007', name: 'Esther Wairimu', age: 30, gender: 'Female', admittedAt: '2024-01-15', diagnosis: 'Post-delivery care', doctor: 'Dr. James Otieno', phone: '0778901234' } },
      { id: 'B017', number: 'MAT-03', status: 'Available' },
      { id: 'B018', number: 'MAT-04', status: 'Available' },
      { id: 'B019', number: 'MAT-05', status: 'Available' },
      { id: 'B020', number: 'MAT-06', status: 'Maintenance', maintenanceNote: 'Deep cleaning' },
    ],
  },
  {
    id: 'W005',
    name: 'Pediatric Ward',
    type: 'Pediatric',
    floor: 2,
    beds: [
      { id: 'B021', number: 'PED-01', status: 'Occupied', patient: { id: 'P008', name: 'Brian Kipkoech', age: 8, gender: 'Male', admittedAt: '2024-01-13', diagnosis: 'Acute bronchitis', doctor: 'Dr. Anne Mutua', phone: '0789012345' } },
      { id: 'B022', number: 'PED-02', status: 'Available' },
      { id: 'B023', number: 'PED-03', status: 'Available' },
      { id: 'B024', number: 'PED-04', status: 'Reserved', reservedFor: 'Scheduled admission', reservedUntil: '2024-01-16 09:00' },
    ],
  },
];

export default function WardsBedsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWardType, setSelectedWardType] = useState<WardType>('All');
  const [selectedBed, setSelectedBed] = useState<BedInfo | null>(null);
  const [hoveredBed, setHoveredBed] = useState<BedInfo | null>(null);

  const filteredWards = useMemo(() => {
    return mockWards.filter((ward) => {
      if (selectedWardType !== 'All' && ward.type !== selectedWardType) return false;
      if (searchTerm) {
        const matchesWard = ward.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBed = ward.beds.some(
          (bed) =>
            bed.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bed.patient?.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesWard || matchesBed;
      }
      return true;
    });
  }, [searchTerm, selectedWardType]);

  const stats = useMemo(() => {
    const allBeds = mockWards.flatMap((w) => w.beds);
    return {
      total: allBeds.length,
      available: allBeds.filter((b) => b.status === 'Available').length,
      occupied: allBeds.filter((b) => b.status === 'Occupied').length,
      reserved: allBeds.filter((b) => b.status === 'Reserved').length,
      maintenance: allBeds.filter((b) => b.status === 'Maintenance').length,
    };
  }, []);

  const getBedStatusColor = (status: BedStatus) => {
    switch (status) {
      case 'Available':
        return 'bg-green-100 border-green-300 text-green-700';
      case 'Occupied':
        return 'bg-red-100 border-red-300 text-red-700';
      case 'Reserved':
        return 'bg-yellow-100 border-yellow-300 text-yellow-700';
      case 'Maintenance':
        return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  const getBedIcon = (status: BedStatus) => {
    switch (status) {
      case 'Available':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Occupied':
        return <User className="w-4 h-4 text-red-600" />;
      case 'Reserved':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'Maintenance':
        return <Wrench className="w-4 h-4 text-gray-600" />;
    }
  };

  const wardTypes: WardType[] = ['All', 'General', 'ICU', 'Private', 'Maternity', 'Pediatric'];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Building2 className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Wards & Beds</h1>
            <p className="text-sm text-gray-500">Manage bed occupancy and availability</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bed className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Beds</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
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
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.occupied}</p>
              <p className="text-sm text-gray-500">Occupied</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.reserved}</p>
              <p className="text-sm text-gray-500">Reserved</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Wrench className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{stats.maintenance}</p>
              <p className="text-sm text-gray-500">Maintenance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search wards, beds, or patients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          {wardTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedWardType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedWardType === type
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Bed Map */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
          <div className="space-y-6">
            {filteredWards.map((ward) => (
              <div key={ward.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">{ward.name}</h3>
                    <span className="text-sm text-gray-500">Floor {ward.floor}</span>
                  </div>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                    {ward.type}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-3">
                  {ward.beds.map((bed) => (
                    <div
                      key={bed.id}
                      onClick={() => setSelectedBed(bed)}
                      onMouseEnter={() => setHoveredBed(bed)}
                      onMouseLeave={() => setHoveredBed(null)}
                      className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${getBedStatusColor(bed.status)} ${
                        selectedBed?.id === bed.id ? 'ring-2 ring-purple-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{bed.number}</span>
                        {getBedIcon(bed.status)}
                      </div>
                      <p className="text-xs truncate">
                        {bed.status === 'Occupied' && bed.patient?.name}
                        {bed.status === 'Reserved' && bed.reservedFor}
                        {bed.status === 'Available' && 'Available'}
                        {bed.status === 'Maintenance' && 'Under Maintenance'}
                      </p>

                      {/* Hover Tooltip */}
                      {hoveredBed?.id === bed.id && bed.patient && (
                        <div className="absolute left-0 top-full mt-2 z-10 w-64 p-4 bg-white rounded-lg shadow-lg border border-gray-200">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-gray-100 rounded-full">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{bed.patient.name}</p>
                              <p className="text-sm text-gray-500">{bed.patient.age}y, {bed.patient.gender}</p>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <AlertCircle className="w-4 h-4" />
                              <span>{bed.patient.diagnosis}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Stethoscope className="w-4 h-4" />
                              <span>{bed.patient.doctor}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>Admitted: {bed.patient.admittedAt}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bed Details Panel */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
          {selectedBed ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Bed {selectedBed.number}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getBedStatusColor(selectedBed.status)}`}>
                  {selectedBed.status}
                </span>
              </div>

              {selectedBed.status === 'Occupied' && selectedBed.patient && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-white rounded-full border border-gray-200">
                        <User className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{selectedBed.patient.name}</p>
                        <p className="text-sm text-gray-500">Patient ID: {selectedBed.patient.id}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Age</p>
                        <p className="font-medium">{selectedBed.patient.age} years</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Gender</p>
                        <p className="font-medium">{selectedBed.patient.gender}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Diagnosis</p>
                    <p className="font-medium text-gray-900">{selectedBed.patient.diagnosis}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Attending Doctor</p>
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-gray-500" />
                      <p className="font-medium text-gray-900">{selectedBed.patient.doctor}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Admitted On</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <p className="font-medium text-gray-900">{selectedBed.patient.admittedAt}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Contact</p>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-500" />
                      <p className="font-medium text-gray-900">{selectedBed.patient.phone}</p>
                    </div>
                  </div>

                  <div className="pt-4 space-y-2">
                    <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      View Patient Record
                    </button>
                    <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      Transfer Patient
                    </button>
                  </div>
                </div>
              )}

              {selectedBed.status === 'Reserved' && (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="font-medium text-gray-900">Reserved for:</p>
                    <p className="text-gray-700">{selectedBed.reservedFor}</p>
                    <p className="text-sm text-gray-500 mt-2">Until: {selectedBed.reservedUntil}</p>
                  </div>
                  <button className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                    Cancel Reservation
                  </button>
                </div>
              )}

              {selectedBed.status === 'Available' && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                    <p className="font-medium text-green-700">Bed is Available</p>
                  </div>
                  <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Admit Patient
                  </button>
                  <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                    Reserve Bed
                  </button>
                </div>
              )}

              {selectedBed.status === 'Maintenance' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <Wrench className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="font-medium text-gray-900">Under Maintenance</p>
                    <p className="text-sm text-gray-600 mt-1">{selectedBed.maintenanceNote}</p>
                  </div>
                  <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    Mark as Available
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Bed className="w-12 h-12 mb-3 text-gray-300" />
              <p className="font-medium">Select a bed</p>
              <p className="text-sm">Click on a bed to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
