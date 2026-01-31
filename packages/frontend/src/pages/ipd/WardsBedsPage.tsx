import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bed,
  Building2,
  User,
  Wrench,
  Clock,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  Calendar,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';

type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'cleaning';
type WardType = 'All' | 'general' | 'icu' | 'private' | 'maternity' | 'pediatric';

interface BedInfo {
  id: string;
  bedNumber: string;
  type: string;
  status: BedStatus;
  dailyRate: number;
  notes?: string;
  wardId: string;
}

interface Ward {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  totalBeds: number;
  occupiedBeds: number;
  floor?: string;
  building?: string;
  beds?: BedInfo[];
}

interface Admission {
  id: string;
  admissionNumber: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
    gender: string;
    dateOfBirth: string;
  };
  bedId: string;
  wardId: string;
  admissionDate: string;
  admissionDiagnosis?: string;
  attendingDoctor?: {
    id: string;
    fullName: string;
  };
}

export default function WardsBedsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWardType, setSelectedWardType] = useState<WardType>('All');
  const [selectedBed, setSelectedBed] = useState<BedInfo | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);

  // Fetch wards
  const { data: wards = [], isLoading: wardsLoading } = useQuery({
    queryKey: ['ipd-wards'],
    queryFn: async () => {
      const res = await api.get('/ipd/wards');
      return res.data as Ward[];
    },
  });

  // Fetch beds for selected ward
  const { data: beds = [] } = useQuery({
    queryKey: ['ipd-beds', selectedWardId],
    queryFn: async () => {
      if (!selectedWardId) return [];
      const res = await api.get('/ipd/beds', { params: { wardId: selectedWardId } });
      return res.data as BedInfo[];
    },
    enabled: !!selectedWardId,
  });

  // Fetch current admissions to show patient info
  const { data: admissionsData } = useQuery({
    queryKey: ['ipd-admissions-current'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'admitted' } });
      return res.data as { data: Admission[]; total: number };
    },
  });

  const admissions = admissionsData?.data || [];
  const admissionsByBed = useMemo(() => {
    const map: Record<string, Admission> = {};
    admissions.forEach((a) => {
      if (a.bedId) map[a.bedId] = a;
    });
    return map;
  }, [admissions]);

  const filteredWards = useMemo(() => {
    return wards.filter((ward) => {
      if (selectedWardType !== 'All' && ward.type !== selectedWardType) return false;
      if (searchTerm) {
        return ward.name.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    });
  }, [wards, searchTerm, selectedWardType]);

  const stats = useMemo(() => {
    const totalBeds = wards.reduce((sum, w) => sum + (w.totalBeds || 0), 0);
    const occupiedBeds = wards.reduce((sum, w) => sum + (w.occupiedBeds || 0), 0);
    return {
      total: totalBeds,
      available: totalBeds - occupiedBeds,
      occupied: occupiedBeds,
      reserved: 0,
      maintenance: 0,
    };
  }, [wards]);

  const getBedStatusColor = (status: BedStatus) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 border-green-300 text-green-700';
      case 'occupied':
        return 'bg-red-100 border-red-300 text-red-700';
      case 'reserved':
        return 'bg-yellow-100 border-yellow-300 text-yellow-700';
      case 'maintenance':
      case 'cleaning':
        return 'bg-gray-100 border-gray-300 text-gray-700';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  const getBedIcon = (status: BedStatus) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'occupied':
        return <User className="w-4 h-4 text-red-600" />;
      case 'reserved':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'maintenance':
      case 'cleaning':
        return <Wrench className="w-4 h-4 text-gray-600" />;
      default:
        return <Bed className="w-4 h-4 text-gray-600" />;
    }
  };

  const wardTypes: WardType[] = ['All', 'general', 'icu', 'private', 'maternity', 'pediatric'];

  if (wardsLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

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
            placeholder="Search wards..."
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
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
        {/* Ward List */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
          {filteredWards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <Building2 className="w-16 h-16 text-gray-300 mb-4" />
              <p className="font-medium text-lg">No wards found</p>
              <p className="text-sm">Create wards from Ward Management page</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredWards.map((ward) => (
                <div
                  key={ward.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedWardId === ward.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedWardId(ward.id)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-600" />
                      <h3 className="font-semibold text-gray-900">{ward.name}</h3>
                      <span className="text-sm text-gray-500">{ward.floor ? `Floor ${ward.floor}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium capitalize">
                        {ward.type}
                      </span>
                      <span className="text-sm text-gray-500">
                        {ward.occupiedBeds}/{ward.totalBeds} beds
                      </span>
                    </div>
                  </div>
                  {selectedWardId === ward.id && beds.length > 0 && (
                    <div className="grid grid-cols-6 gap-3 mt-4">
                      {beds.map((bed) => {
                        const admission = admissionsByBed[bed.id];
                        return (
                          <div
                            key={bed.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBed(bed);
                            }}
                            className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${getBedStatusColor(bed.status)} ${
                              selectedBed?.id === bed.id ? 'ring-2 ring-purple-500' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{bed.bedNumber}</span>
                              {getBedIcon(bed.status)}
                            </div>
                            <p className="text-xs truncate">
                              {bed.status === 'occupied' && admission?.patient?.fullName}
                              {bed.status === 'available' && 'Available'}
                              {bed.status === 'cleaning' && 'Cleaning'}
                              {bed.status === 'maintenance' && 'Maintenance'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bed Details Panel */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-auto">
          {selectedBed ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Bed {selectedBed.bedNumber}</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getBedStatusColor(selectedBed.status)}`}>
                  {selectedBed.status}
                </span>
              </div>

              {selectedBed.status === 'occupied' && admissionsByBed[selectedBed.id] && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-white rounded-full border border-gray-200">
                        <User className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{admissionsByBed[selectedBed.id].patient?.fullName}</p>
                        <p className="text-sm text-gray-500">MRN: {admissionsByBed[selectedBed.id].patient?.mrn}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Diagnosis</p>
                    <p className="font-medium text-gray-900">{admissionsByBed[selectedBed.id].admissionDiagnosis || 'Not specified'}</p>
                  </div>

                  {admissionsByBed[selectedBed.id].attendingDoctor && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Attending Doctor</p>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-gray-500" />
                        <p className="font-medium text-gray-900">{admissionsByBed[selectedBed.id].attendingDoctor?.fullName}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-sm text-gray-500 mb-1">Admitted On</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <p className="font-medium text-gray-900">
                        {new Date(admissionsByBed[selectedBed.id].admissionDate).toLocaleDateString()}
                      </p>
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

              {selectedBed.status === 'available' && (
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

              {(selectedBed.status === 'maintenance' || selectedBed.status === 'cleaning') && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <Wrench className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="font-medium text-gray-900 capitalize">{selectedBed.status}</p>
                    {selectedBed.notes && <p className="text-sm text-gray-600 mt-1">{selectedBed.notes}</p>}
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
