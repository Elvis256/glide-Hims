import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  Plus,
  Search,
  Edit,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Building2,
  TestTube,
  Stethoscope,
} from 'lucide-react';
import {
  getInsurancePriceLists,
  createInsurancePriceList,
  updateInsurancePriceList,
  deleteInsurancePriceList,
  bulkCreateInsurancePriceLists,
} from '../../../services/pricing';
import type { InsurancePriceList, CreateInsurancePriceListDto } from '../../../services/pricing';
import { insuranceService } from '../../../services/insurance';
import type { InsuranceProvider } from '../../../services/insurance';
import { servicesService } from '../../../services/services';
import type { Service } from '../../../services/services';
import { labService } from '../../../services/lab';
import type { LabTest } from '../../../services/lab';

const InsurancePriceListsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InsurancePriceList | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [itemType, setItemType] = useState<'service' | 'lab'>('service');

  // Fetch insurance providers
  const { data: providers = [] } = useQuery({
    queryKey: ['insurance-providers'],
    queryFn: () => insuranceService.providers.list(),
  });

  // Fetch price lists for selected provider
  const { data: priceLists = [], isLoading } = useQuery({
    queryKey: ['insurance-price-lists', selectedProvider],
    queryFn: () => getInsurancePriceLists({ insuranceProviderId: selectedProvider || undefined }),
    enabled: true,
  });

  // Fetch services and lab tests for dropdown
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesService.list(),
  });

  const { data: labTests = [] } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => labService.tests.list(),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createInsurancePriceList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-price-lists'] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateInsurancePriceListDto> }) =>
      updateInsurancePriceList(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-price-lists'] });
      setShowModal(false);
      setEditingItem(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInsurancePriceList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-price-lists'] });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: bulkCreateInsurancePriceLists,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-price-lists'] });
      setShowBulkModal(false);
    },
  });

  // Filter price lists
  const filteredPriceLists = priceLists.filter((item: InsurancePriceList) => {
    const matchesProvider = !selectedProvider || item.insuranceProviderId === selectedProvider;
    const matchesSearch =
      !searchTerm ||
      item.serviceName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.labTestName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesProvider && matchesSearch;
  });

  const handleSave = (data: CreateInsurancePriceListDto) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this price list entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const getProviderName = (providerId: string) => {
    const provider = providers.find((p: InsuranceProvider) => p.id === providerId);
    return provider?.name || 'Unknown';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-primary" />
            Insurance Price Lists
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Configure agreed prices for each insurance provider
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Import
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
          >
            <Plus className="h-5 w-5" />
            Add Price
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Insurance Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">All Providers</option>
              {providers.map((provider: InsuranceProvider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search services or lab tests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Providers</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{providers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Prices</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {priceLists.filter((p: InsurancePriceList) => p.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Stethoscope className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Services Priced</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {priceLists.filter((p: InsurancePriceList) => p.serviceId).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <TestTube className="h-5 w-5 text-orange-600 dark:text-orange-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Lab Tests Priced</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {priceLists.filter((p: InsurancePriceList) => p.labTestId).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Price List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Insurance Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Service / Lab Test
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Agreed Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Effective Period
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : filteredPriceLists.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  No price lists found. Add a new price or select a different provider.
                </td>
              </tr>
            ) : (
              filteredPriceLists.map((item: InsurancePriceList) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.insuranceProviderName || getProviderName(item.insuranceProviderId)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">
                      {item.serviceName || item.labTestName || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        item.serviceId
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }`}
                    >
                      {item.serviceId ? 'Service' : 'Lab Test'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.currency || 'UGX'} {Number(item.agreedPrice).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {item.effectiveFrom
                        ? new Date(item.effectiveFrom).toLocaleDateString()
                        : 'Always'}
                      {item.effectiveTo && ` - ${new Date(item.effectiveTo).toLocaleDateString()}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        item.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setShowModal(true);
                        }}
                        className="p-1 text-blue-600 hover:text-blue-800"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <PriceListModal
          item={editingItem}
          providers={providers}
          services={services}
          labTests={labTests}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <BulkImportModal
          providers={providers}
          services={services}
          labTests={labTests}
          onImport={bulkCreateMutation.mutate}
          onClose={() => setShowBulkModal(false)}
          isLoading={bulkCreateMutation.isPending}
        />
      )}
    </div>
  );
};

// Price List Modal Component
interface PriceListModalProps {
  item: InsurancePriceList | null;
  providers: InsuranceProvider[];
  services: Service[];
  labTests: LabTest[];
  onSave: (data: CreateInsurancePriceListDto) => void;
  onClose: () => void;
  isLoading: boolean;
}

const PriceListModal: React.FC<PriceListModalProps> = ({
  item,
  providers,
  services,
  labTests,
  onSave,
  onClose,
  isLoading,
}) => {
  const [formData, setFormData] = useState<CreateInsurancePriceListDto>({
    insuranceProviderId: item?.insuranceProviderId || '',
    serviceId: item?.serviceId || undefined,
    labTestId: item?.labTestId || undefined,
    agreedPrice: item?.agreedPrice || 0,
    currency: item?.currency || 'UGX',
    effectiveFrom: item?.effectiveFrom || '',
    effectiveTo: item?.effectiveTo || '',
    notes: item?.notes || '',
  });
  const [itemType, setItemType] = useState<'service' | 'lab'>(item?.labTestId ? 'lab' : 'service');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const submitData: CreateInsurancePriceListDto = {
      ...formData,
      serviceId: itemType === 'service' ? formData.serviceId : undefined,
      labTestId: itemType === 'lab' ? formData.labTestId : undefined,
    };
    onSave(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {item ? 'Edit Price List Entry' : 'Add Price List Entry'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Insurance Provider *
            </label>
            <select
              required
              value={formData.insuranceProviderId}
              onChange={(e) => setFormData({ ...formData, insuranceProviderId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select Provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Item Type
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={itemType === 'service'}
                  onChange={() => setItemType('service')}
                />
                <span className="text-sm">Service</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={itemType === 'lab'}
                  onChange={() => setItemType('lab')}
                />
                <span className="text-sm">Lab Test</span>
              </label>
            </div>
          </div>

          {itemType === 'service' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Service *
              </label>
              <select
                required
                value={formData.serviceId || ''}
                onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Select Service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} (Base: UGX {Number(service.basePrice || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lab Test *
              </label>
              <select
                required
                value={formData.labTestId || ''}
                onChange={(e) => setFormData({ ...formData, labTestId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              >
                <option value="">Select Lab Test</option>
                {labTests.map((test) => (
                  <option key={test.id} value={test.id}>
                    {test.name} (Base: UGX {Number(test.price || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agreed Price (UGX) *
            </label>
            <input
              type="number"
              required
              min="0"
              step="100"
              value={formData.agreedPrice}
              onChange={(e) => setFormData({ ...formData, agreedPrice: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Effective From
              </label>
              <input
                type="date"
                value={formData.effectiveFrom || ''}
                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Effective To
              </label>
              <input
                type="date"
                value={formData.effectiveTo || ''}
                onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Optional notes about this price agreement..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : item ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Bulk Import Modal
interface BulkImportModalProps {
  providers: InsuranceProvider[];
  services: Service[];
  labTests: LabTest[];
  onImport: (data: any) => void;
  onClose: () => void;
  isLoading: boolean;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({
  providers,
  services,
  labTests,
  onImport,
  onClose,
  isLoading,
}) => {
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ id: string; type: 'service' | 'lab'; price: number }[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  const handleAddItem = (id: string, type: 'service' | 'lab', defaultPrice: number) => {
    if (!selectedItems.find((i) => i.id === id)) {
      setSelectedItems([...selectedItems, { id, type, price: defaultPrice }]);
    }
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems(selectedItems.filter((i) => i.id !== id));
  };

  const handlePriceChange = (id: string, price: number) => {
    setSelectedItems(selectedItems.map((i) => (i.id === id ? { ...i, price } : i)));
  };

  const handleSubmit = () => {
    onImport({
      insuranceProviderId: selectedProvider,
      items: selectedItems.map((item) => ({
        serviceId: item.type === 'service' ? item.id : undefined,
        labTestId: item.type === 'lab' ? item.id : undefined,
        agreedPrice: item.price,
      })),
      effectiveFrom: effectiveFrom || undefined,
      effectiveTo: effectiveTo || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Import Price List</h2>
          <p className="text-sm text-gray-500 mt-1">
            Select multiple services and lab tests to set prices for an insurance provider
          </p>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Insurance Provider *
            </label>
            <select
              required
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select Provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Effective From
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Effective To
              </label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Available Items */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Available Items</h3>
              <div className="border rounded-lg dark:border-gray-600 max-h-64 overflow-y-auto">
                <div className="p-2 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 sticky top-0">
                  <span className="text-xs font-medium text-gray-500">Services</span>
                </div>
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center cursor-pointer border-b dark:border-gray-600"
                    onClick={() => handleAddItem(service.id, 'service', Number(service.basePrice || 0))}
                  >
                    <span className="text-sm">{service.name}</span>
                    <span className="text-xs text-gray-500">
                      UGX {Number(service.basePrice || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="p-2 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 sticky top-0">
                  <span className="text-xs font-medium text-gray-500">Lab Tests</span>
                </div>
                {labTests.map((test) => (
                  <div
                    key={test.id}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex justify-between items-center cursor-pointer border-b dark:border-gray-600"
                    onClick={() => handleAddItem(test.id, 'lab', Number(test.price || 0))}
                  >
                    <span className="text-sm">{test.name}</span>
                    <span className="text-xs text-gray-500">
                      UGX {Number(test.price || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Items */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Selected Items ({selectedItems.length})
              </h3>
              <div className="border rounded-lg dark:border-gray-600 max-h-64 overflow-y-auto">
                {selectedItems.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    Click items on the left to add them
                  </div>
                ) : (
                  selectedItems.map((item) => {
                    const name =
                      item.type === 'service'
                        ? services.find((s) => s.id === item.id)?.name
                        : labTests.find((t) => t.id === item.id)?.name;
                    return (
                      <div
                        key={item.id}
                        className="p-2 flex items-center gap-2 border-b dark:border-gray-600"
                      >
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <span className="flex-1 text-sm">{name}</span>
                        <input
                          type="number"
                          min="0"
                          value={item.price}
                          onChange={(e) => handlePriceChange(item.id, Number(e.target.value))}
                          className="w-24 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                        />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !selectedProvider || selectedItems.length === 0}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : `Import ${selectedItems.length} Items`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsurancePriceListsPage;
