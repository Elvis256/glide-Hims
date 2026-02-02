import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../services/api';
import {
  Building2,
  Bed,
  Users,
  Plus,
  ChevronRight,
  UserPlus,
  ArrowRightLeft,
  ClipboardList,
} from 'lucide-react';

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
  beds?: BedItem[];
}

interface BedItem {
  id: string;
  bedNumber: string;
  type: string;
  status: string;
  dailyRate: number;
}

interface Admission {
  id: string;
  admissionNumber: string;
  type: string;
  status: string;
  admissionDate: string;
  admissionReason?: string;
  patient: {
    id: string;
    fullName: string;
    mrn: string;
    gender: string;
  };
  ward: Ward;
  bed: BedItem;
  attendingDoctor?: {
    fullName: string;
  };
}

interface IpdStats {
  activeAdmissions: number;
  todayAdmissions: number;
  todayDischarges: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  overallOccupancyRate: number;
  wardOccupancy: Array<{
    id: string;
    name: string;
    type: string;
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number;
  }>;
}

export default function WardManagementPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'wards' | 'admissions' | 'beds'>('overview');
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showWardModal, setShowWardModal] = useState(false);
  const [showBedModal, setShowBedModal] = useState(false);
  const queryClient = useQueryClient();

  // Fetch IPD stats
  const { data: stats } = useQuery<IpdStats>({
    queryKey: ['ipd-stats'],
    queryFn: async () => {
      const res = await api.get('/ipd/stats');
      return res.data;
    },
  });

  // Fetch wards
  const { data: wards = [] } = useQuery<Ward[]>({
    queryKey: ['wards'],
    queryFn: async () => {
      const res = await api.get('/ipd/wards');
      return res.data;
    },
  });

  // Fetch active admissions
  const { data: admissionsData } = useQuery<{ data: Admission[]; total: number }>({
    queryKey: ['admissions', 'active'],
    queryFn: async () => {
      const res = await api.get('/ipd/admissions', { params: { status: 'admitted' } });
      return res.data;
    },
  });

  // Fetch available beds
  const { data: availableBeds = [] } = useQuery<BedItem[]>({
    queryKey: ['available-beds'],
    queryFn: async () => {
      const res = await api.get('/ipd/beds/available');
      return res.data;
    },
  });

  const admissions = admissionsData?.data || [];

  const getOccupancyColor = (rate: number) => {
    if (rate >= 90) return 'text-red-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ward Management</h1>
          <p className="text-sm text-gray-500">IPD admissions, bed allocation, and ward oversight</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowWardModal(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
          >
            <Building2 className="h-4 w-4" />
            Add Ward
          </button>
          <button
            onClick={() => setShowAdmitModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            <UserPlus className="h-4 w-4" />
            Admit Patient
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Admissions</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.activeAdmissions || 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Bed className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Available Beds</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.availableBeds || 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserPlus className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Today's Admissions</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.todayAdmissions || 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`text-2xl font-bold ${getOccupancyColor(stats?.overallOccupancyRate || 0)}`}>
                {stats?.overallOccupancyRate || 0}%
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Bed Occupancy</p>
              <p className="text-sm text-gray-400">
                {stats?.occupiedBeds || 0} / {stats?.totalBeds || 0} beds
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: Building2 },
            { key: 'wards', label: 'Wards', icon: Building2 },
            { key: 'admissions', label: 'Admissions', icon: Users },
            { key: 'beds', label: 'Bed Map', icon: Bed },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Ward Occupancy */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Ward Occupancy</h3>
            <div className="space-y-4">
              {(stats?.wardOccupancy || []).map((ward) => (
                <div key={ward.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{ward.name}</p>
                    <p className="text-sm text-gray-500 capitalize">{ward.type}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          ward.occupancyRate >= 90 ? 'bg-red-500' :
                          ward.occupancyRate >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${ward.occupancyRate}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${getOccupancyColor(ward.occupancyRate)}`}>
                      {ward.occupiedBeds}/{ward.totalBeds}
                    </span>
                  </div>
                </div>
              ))}
              {(!stats?.wardOccupancy || stats.wardOccupancy.length === 0) && (
                <p className="text-center text-gray-500 py-4">No wards configured</p>
              )}
            </div>
          </div>

          {/* Recent Admissions */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-medium text-gray-900">Recent Admissions</h3>
            <div className="space-y-3">
              {admissions.slice(0, 5).map((admission) => (
                <div key={admission.id} className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <p className="font-medium text-gray-900">{admission.patient.fullName}</p>
                    <p className="text-sm text-gray-500">
                      {admission.ward?.name} - Bed {admission.bed?.bedNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">{admission.admissionNumber}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(admission.admissionDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              {admissions.length === 0 && (
                <p className="text-center text-gray-500 py-4">No active admissions</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'wards' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {wards.map((ward) => (
            <div
              key={ward.id}
              className="rounded-lg bg-white p-6 shadow hover:shadow-md cursor-pointer transition-shadow"
              onClick={() => setSelectedWard(ward)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{ward.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{ward.type} Ward</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                  ward.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {ward.status}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{ward.totalBeds}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{ward.occupiedBeds}</p>
                    <p className="text-xs text-gray-500">Occupied</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{ward.totalBeds - ward.occupiedBeds}</p>
                    <p className="text-xs text-gray-500">Available</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>
              {ward.floor && (
                <p className="mt-2 text-xs text-gray-400">
                  {ward.building && `${ward.building}, `}Floor {ward.floor}
                </p>
              )}
            </div>
          ))}
          {wards.length === 0 && (
            <div className="col-span-full rounded-lg bg-white p-12 text-center shadow">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No wards</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new ward.</p>
              <button
                onClick={() => setShowWardModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Ward
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'admissions' && (
        <div className="rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Admission #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Ward / Bed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Admitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Doctor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {admissions.map((admission) => (
                  <tr key={admission.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{admission.patient.fullName}</p>
                        <p className="text-sm text-gray-500">{admission.patient.mrn}</p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {admission.admissionNumber}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <p className="text-sm text-gray-900">{admission.ward?.name}</p>
                      <p className="text-sm text-gray-500">Bed {admission.bed?.bedNumber}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(admission.admissionDate).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {admission.attendingDoctor?.fullName || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="rounded bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                          <ClipboardList className="inline h-3 w-3 mr-1" />
                          Notes
                        </button>
                        <button className="rounded bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100">
                          <ArrowRightLeft className="inline h-3 w-3 mr-1" />
                          Transfer
                        </button>
                        <button className="rounded bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100">
                          Discharge
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {admissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No active admissions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'beds' && (
        <div className="space-y-6">
          {wards.map((ward) => (
            <div key={ward.id} className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{ward.name}</h3>
                  <p className="text-sm text-gray-500">
                    {ward.occupiedBeds} / {ward.totalBeds} beds occupied
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedWard(ward);
                    setShowBedModal(true);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Beds
                </button>
              </div>
              <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
                {(ward.beds || []).map((bed) => (
                  <div
                    key={bed.id}
                    className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg border-2 text-xs font-medium cursor-pointer transition-colors ${
                      bed.status === 'available'
                        ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                        : bed.status === 'occupied'
                        ? 'border-red-300 bg-red-50 text-red-700'
                        : bed.status === 'cleaning'
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-gray-50 text-gray-700'
                    }`}
                    title={`Bed ${bed.bedNumber} - ${bed.status}`}
                  >
                    <Bed className="h-4 w-4" />
                    <span>{bed.bedNumber}</span>
                  </div>
                ))}
                {(!ward.beds || ward.beds.length === 0) && (
                  <p className="col-span-full text-center text-gray-400 py-4">
                    No beds configured for this ward
                  </p>
                )}
              </div>
              <div className="mt-4 flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-green-500" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-red-500" />
                  <span>Occupied</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-blue-500" />
                  <span>Cleaning</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-gray-500" />
                  <span>Maintenance</span>
                </div>
              </div>
            </div>
          ))}
          {wards.length === 0 && (
            <div className="rounded-lg bg-white p-12 text-center shadow">
              <Bed className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No wards configured</h3>
              <p className="mt-1 text-sm text-gray-500">Create wards first to manage beds.</p>
            </div>
          )}
        </div>
      )}

      {/* Ward Modal */}
      {showWardModal && (
        <WardModal
          onClose={() => setShowWardModal(false)}
          onSuccess={() => {
            setShowWardModal(false);
            queryClient.invalidateQueries({ queryKey: ['wards'] });
            queryClient.invalidateQueries({ queryKey: ['ipd-stats'] });
          }}
        />
      )}

      {/* Bed Modal */}
      {showBedModal && selectedWard && (
        <BedModal
          ward={selectedWard}
          onClose={() => {
            setShowBedModal(false);
            setSelectedWard(null);
          }}
          onSuccess={() => {
            setShowBedModal(false);
            setSelectedWard(null);
            queryClient.invalidateQueries({ queryKey: ['wards'] });
            queryClient.invalidateQueries({ queryKey: ['ipd-stats'] });
          }}
        />
      )}

      {/* Admit Modal */}
      {showAdmitModal && (
        <AdmitModal
          wards={wards}
          availableBeds={availableBeds}
          onClose={() => setShowAdmitModal(false)}
          onSuccess={() => {
            setShowAdmitModal(false);
            queryClient.invalidateQueries({ queryKey: ['admissions'] });
            queryClient.invalidateQueries({ queryKey: ['ipd-stats'] });
            queryClient.invalidateQueries({ queryKey: ['wards'] });
            queryClient.invalidateQueries({ queryKey: ['available-beds'] });
          }}
        />
      )}
    </div>
  );
}

// Ward Creation Modal
function WardModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'general',
    floor: '',
    building: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Get facility ID
      const facilitiesRes = await api.get('/facilities');
      const facilities = Array.isArray(facilitiesRes.data) ? facilitiesRes.data : facilitiesRes.data?.data || [];
      if (facilities.length === 0) {
        toast.error('No facility found. Please create a facility first.');
        return;
      }
      
      await api.post('/ipd/wards', {
        ...formData,
        facilityId: facilities[0].id,
      });
      toast.success('Ward created successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create ward');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Create Ward</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="general">General</option>
              <option value="private">Private</option>
              <option value="icu">ICU</option>
              <option value="pediatric">Pediatric</option>
              <option value="maternity">Maternity</option>
              <option value="surgical">Surgical</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Building</label>
              <input
                type="text"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Floor</label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Ward'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Bed Creation Modal
function BedModal({ ward, onClose, onSuccess }: { ward: Ward; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    prefix: ward.code,
    count: 10,
    type: 'standard',
    dailyRate: 50000,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/ipd/beds/bulk', {
        wardId: ward.id,
        prefix: formData.prefix,
        count: formData.count,
        type: formData.type,
        dailyRate: formData.dailyRate,
      });
      toast.success('Beds created successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create beds');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">Add Beds to {ward.name}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Prefix</label>
              <input
                type="text"
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Number of Beds</label>
              <input
                type="number"
                min="1"
                max="50"
                value={formData.count}
                onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bed Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="standard">Standard</option>
              <option value="icu">ICU</option>
              <option value="pediatric">Pediatric</option>
              <option value="maternity">Maternity</option>
              <option value="isolation">Isolation</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Daily Rate (UGX)</label>
            <input
              type="number"
              min="0"
              value={formData.dailyRate}
              onChange={(e) => setFormData({ ...formData, dailyRate: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <p className="text-sm text-gray-500">
            This will create beds numbered {formData.prefix}01 through {formData.prefix}{formData.count.toString().padStart(2, '0')}
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Beds'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Admit Patient Modal
function AdmitModal({
  wards,
  availableBeds,
  onClose,
  onSuccess,
}: {
  wards: Ward[];
  availableBeds: BedItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    patientSearch: '',
    patientId: '',
    encounterId: '',
    wardId: '',
    bedId: '',
    type: 'emergency',
    admissionReason: '',
    admissionDiagnosis: '',
  });
  const [patients, setPatients] = useState<any[]>([]);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [filteredBeds, setFilteredBeds] = useState<BedItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Search patients
  const searchPatients = async (search: string) => {
    if (search.length < 2) return;
    try {
      const res = await api.get('/patients', { params: { search, limit: 10 } });
      setPatients(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (error) {
      console.error('Failed to search patients:', error);
    }
  };

  // Get patient encounters
  const getPatientEncounters = async (patientId: string) => {
    try {
      const res = await api.get('/encounters', { params: { patientId, status: 'in_consultation' } });
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setEncounters(data);
    } catch (error) {
      console.error('Failed to get encounters:', error);
    }
  };

  // Filter beds by ward
  const handleWardChange = (wardId: string) => {
    setFormData({ ...formData, wardId, bedId: '' });
    setFilteredBeds(availableBeds.filter((b: any) => b.wardId === wardId || b.ward?.id === wardId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.encounterId || !formData.wardId || !formData.bedId) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      await api.post('/ipd/admissions', {
        patientId: formData.patientId,
        encounterId: formData.encounterId,
        wardId: formData.wardId,
        bedId: formData.bedId,
        type: formData.type,
        admissionReason: formData.admissionReason,
        admissionDiagnosis: formData.admissionDiagnosis,
      });
      toast.success('Patient admitted successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to admit patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold">Admit Patient</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Search Patient</label>
            <input
              type="text"
              value={formData.patientSearch}
              onChange={(e) => {
                setFormData({ ...formData, patientSearch: e.target.value });
                searchPatients(e.target.value);
              }}
              placeholder="Search by name or MRN..."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {patients.length > 0 && !formData.patientId && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded border bg-white shadow-lg">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, patientId: p.id, patientSearch: p.fullName });
                      setPatients([]);
                      getPatientEncounters(p.id);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    {p.fullName} - {p.mrn}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Encounter Selection */}
          {formData.patientId && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Select Encounter</label>
              <select
                value={formData.encounterId}
                onChange={(e) => setFormData({ ...formData, encounterId: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">Select an encounter...</option>
                {encounters.map((enc) => (
                  <option key={enc.id} value={enc.id}>
                    {enc.visitNumber} - {new Date(enc.startTime).toLocaleDateString()}
                  </option>
                ))}
              </select>
              {encounters.length === 0 && (
                <p className="mt-1 text-sm text-yellow-600">
                  No active encounters found. Create an OPD visit first.
                </p>
              )}
            </div>
          )}

          {/* Ward & Bed Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Ward</label>
              <select
                value={formData.wardId}
                onChange={(e) => handleWardChange(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              >
                <option value="">Select ward...</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.totalBeds - w.occupiedBeds} available)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bed</label>
              <select
                value={formData.bedId}
                onChange={(e) => setFormData({ ...formData, bedId: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
                disabled={!formData.wardId}
              >
                <option value="">Select bed...</option>
                {filteredBeds.map((b) => (
                  <option key={b.id} value={b.id}>
                    Bed {b.bedNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Admission Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Admission Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="emergency">Emergency</option>
              <option value="elective">Elective</option>
              <option value="transfer">Transfer</option>
            </select>
          </div>

          {/* Reason & Diagnosis */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Admission Reason</label>
            <textarea
              value={formData.admissionReason}
              onChange={(e) => setFormData({ ...formData, admissionReason: e.target.value })}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Admitting...' : 'Admit Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
