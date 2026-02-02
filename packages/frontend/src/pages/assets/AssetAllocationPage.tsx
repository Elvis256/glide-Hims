import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Building2,
  User,
  Plus,
  ArrowRightLeft,
  Loader2,
  X,
  Save,
  Package,
  CheckCircle,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { FixedAsset } from '../../services/assets';

const departments = [
  'OPD',
  'Emergency',
  'Laboratory',
  'Radiology',
  'Pharmacy',
  'Pediatrics',
  'Surgery',
  'ICU',
  'Administration',
  'Finance',
  'IT',
  'Maintenance',
  'Other',
];

export default function AssetAllocationPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', facilityId],
    queryFn: () => assetsService.list(facilityId, {}),
    enabled: !!facilityId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FixedAsset> }) => 
      assetsService.update(id, data),
    onSuccess: () => {
      toast.success('Asset allocation updated');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowModal(false);
      setSelectedAsset(null);
    },
    onError: () => toast.error('Failed to update allocation'),
  });

  const handleAllocate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAsset) return;

    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: selectedAsset.id,
      data: {
        department: formData.get('department') as string,
        assignedTo: formData.get('assignedTo') as string,
        location: formData.get('location') as string,
      },
    });
  };

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.assetCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !filterDepartment || a.department === filterDepartment;
    return matchesSearch && matchesDept;
  });

  // Group by department
  const byDepartment = filteredAssets.reduce((acc, asset) => {
    const dept = asset.department || 'Unassigned';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(asset);
    return acc;
  }, {} as Record<string, FixedAsset[]>);

  const unassignedCount = assets.filter(a => !a.department && !a.assignedTo).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Asset Allocation</h1>
            <p className="text-sm text-gray-500">Assign assets to departments and users</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
            </div>
            <Package className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Allocated</p>
              <p className="text-2xl font-bold text-green-600">{assets.length - unassignedCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unassigned</p>
              <p className="text-2xl font-bold text-yellow-600">{unassignedCount}</p>
            </div>
            <Package className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Departments</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(byDepartment).length}</p>
            </div>
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDepartment).map(([dept, deptAssets]) => (
            <div key={dept} className="bg-white rounded-lg border overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <h3 className="font-medium text-gray-900">{dept}</h3>
                  <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    {deptAssets.length} assets
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  Value: {formatCurrency(deptAssets.reduce((sum, a) => sum + Number(a.purchaseCost || 0), 0))}
                </span>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deptAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        <div className="text-xs text-gray-500">{asset.assetCode}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {asset.category.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {asset.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            {asset.assignedTo}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {asset.location || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setSelectedAsset(asset); setShowModal(true); }}
                          className="px-3 py-1 text-indigo-600 border border-indigo-200 text-sm rounded hover:bg-indigo-50"
                        >
                          <ArrowRightLeft className="w-4 h-4 inline mr-1" />
                          Reassign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {Object.keys(byDepartment).length === 0 && (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No assets found matching your filters</p>
            </div>
          )}
        </div>
      )}

      {/* Allocation Modal */}
      {showModal && selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Allocate Asset</h2>
              <button onClick={() => { setShowModal(false); setSelectedAsset(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAllocate} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500">Asset</p>
                <p className="font-medium">{selectedAsset.assetCode} - {selectedAsset.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                <select
                  name="department"
                  defaultValue={selectedAsset.department || ''}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Department</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <input
                  type="text"
                  name="assignedTo"
                  defaultValue={selectedAsset.assignedTo || ''}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Person responsible"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  name="location"
                  defaultValue={selectedAsset.location || ''}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Room/Building"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setSelectedAsset(null); }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
