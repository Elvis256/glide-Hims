import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isPast, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';
import {
  Wrench,
  Plus,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  X,
  Save,
  FileText,
  DollarSign,
  User,
  Building2,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { FixedAsset, AssetMaintenance } from '../../services/assets';

const maintenanceTypes = [
  { value: 'preventive', label: 'Preventive Maintenance' },
  { value: 'corrective', label: 'Corrective Maintenance' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'repair', label: 'Repair' },
  { value: 'overhaul', label: 'Overhaul' },
];

export default function AssetMaintenancePage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'due' | 'history'>('due');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

  // Get all assets
  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', facilityId],
    queryFn: () => assetsService.list(facilityId, { status: 'active' }),
    enabled: !!facilityId,
  });

  // Get maintenance due
  const { data: maintenanceDue = [], isLoading: dueLoading } = useQuery({
    queryKey: ['maintenance-due', facilityId],
    queryFn: () => assetsService.getMaintenanceDue(facilityId, 60),
    enabled: !!facilityId,
  });

  const recordMutation = useMutation({
    mutationFn: (data: Partial<AssetMaintenance>) => assetsService.recordMaintenance(data),
    onSuccess: () => {
      toast.success('Maintenance recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['maintenance-due'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setShowModal(false);
      setSelectedAsset(null);
    },
    onError: () => toast.error('Failed to record maintenance'),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAsset) return;

    const formData = new FormData(e.currentTarget);
    const data: Partial<AssetMaintenance> = {
      assetId: selectedAsset.id,
      facilityId,
      type: formData.get('type') as string,
      maintenanceDate: formData.get('maintenanceDate') as string,
      description: formData.get('description') as string,
      performedBy: formData.get('performedBy') as string,
      serviceProvider: formData.get('serviceProvider') as string,
      cost: Number(formData.get('cost') || 0),
      nextDueDate: formData.get('nextDueDate') as string || undefined,
      findings: formData.get('findings') as string,
      recommendations: formData.get('recommendations') as string,
    };

    recordMutation.mutate(data);
  };

  // Categorize due maintenance
  const overdue = maintenanceDue.filter(a => a.nextMaintenanceDate && isPast(new Date(a.nextMaintenanceDate)));
  const dueSoon = maintenanceDue.filter(a => {
    if (!a.nextMaintenanceDate) return false;
    const date = new Date(a.nextMaintenanceDate);
    return !isPast(date) && isWithinInterval(date, { start: new Date(), end: addDays(new Date(), 30) });
  });

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.assetCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Wrench className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Asset Maintenance</h1>
            <p className="text-sm text-gray-500">Track and schedule equipment maintenance</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Record Maintenance
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">{assets.length}</p>
            </div>
            <Wrench className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Due in 30 Days</p>
              <p className="text-2xl font-bold text-yellow-600">{dueSoon.length}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Up to Date</p>
              <p className="text-2xl font-bold text-green-600">{assets.length - maintenanceDue.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('due')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'due' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500'
          }`}
        >
          Maintenance Due ({maintenanceDue.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'history' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500'
          }`}
        >
          All Assets
        </button>
      </div>

      {/* Content */}
      {activeTab === 'due' && (
        <div className="space-y-4">
          {dueLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : maintenanceDue.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-green-800 font-medium">All assets are up to date!</p>
              <p className="text-green-600 text-sm">No maintenance is due in the next 60 days.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {maintenanceDue.map((asset) => {
                    const isOverdue = asset.nextMaintenanceDate && isPast(new Date(asset.nextMaintenanceDate));
                    return (
                      <tr key={asset.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{asset.name}</div>
                          <div className="text-xs text-gray-500">{asset.assetCode}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                          {asset.category.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {asset.location || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {asset.nextMaintenanceDate ? format(new Date(asset.nextMaintenanceDate), 'dd/MM/yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {isOverdue ? 'Overdue' : 'Due Soon'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { setSelectedAsset(asset); setShowModal(true); }}
                            className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                          >
                            Record
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Maintenance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Due</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assetsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                    </td>
                  </tr>
                ) : filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No assets found
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{asset.name}</div>
                        <div className="text-xs text-gray-500">{asset.assetCode}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {asset.category.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize">
                        {asset.condition.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">-</td>
                      <td className="px-4 py-3 text-sm">
                        {asset.nextMaintenanceDate ? format(new Date(asset.nextMaintenanceDate), 'dd/MM/yyyy') : 'Not scheduled'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setSelectedAsset(asset); setShowModal(true); }}
                          className="px-3 py-1 border text-sm rounded hover:bg-gray-50"
                        >
                          Record
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Maintenance Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Record Maintenance</h2>
              <button onClick={() => { setShowModal(false); setSelectedAsset(null); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Asset Selection */}
              {!selectedAsset ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Asset *</label>
                  <select
                    onChange={(e) => {
                      const asset = assets.find(a => a.id === e.target.value);
                      setSelectedAsset(asset || null);
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Choose an asset...</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.assetCode} - {a.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Selected Asset</p>
                  <p className="font-medium">{selectedAsset.assetCode} - {selectedAsset.name}</p>
                  <p className="text-sm text-gray-600">{selectedAsset.location || 'No location'}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Type *</label>
                  <select name="type" required className="w-full px-3 py-2 border rounded-lg">
                    {maintenanceTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input
                    type="date"
                    name="maintenanceDate"
                    defaultValue={format(new Date(), 'yyyy-MM-dd')}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  name="description"
                  rows={2}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="What maintenance was performed?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Performed By</label>
                  <input type="text" name="performedBy" className="w-full px-3 py-2 border rounded-lg" placeholder="Technician name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Provider</label>
                  <input type="text" name="serviceProvider" className="w-full px-3 py-2 border rounded-lg" placeholder="Company name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost</label>
                  <input type="number" name="cost" className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
                  <input type="date" name="nextDueDate" className="w-full px-3 py-2 border rounded-lg" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Findings</label>
                <textarea name="findings" rows={2} className="w-full px-3 py-2 border rounded-lg" placeholder="Any issues found?" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recommendations</label>
                <textarea name="recommendations" rows={2} className="w-full px-3 py-2 border rounded-lg" placeholder="Future actions needed?" />
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
                  disabled={recordMutation.isPending || !selectedAsset}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {recordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Record Maintenance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
