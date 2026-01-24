import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import {
  Plus,
  Search,
  Edit,
  Loader2,
  Layers,
  DollarSign,
  Package,
  X,
  FolderOpen,
} from 'lucide-react';

interface ServiceCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

interface Service {
  id: string;
  name: string;
  code: string;
  description?: string;
  categoryId: string;
  tier: 'basic' | 'standard' | 'premium' | 'vip';
  duration?: number;
  isActive: boolean;
  category?: ServiceCategory;
}

interface ServicePackage {
  id: string;
  name: string;
  code: string;
  description?: string;
  basePrice: number;
  discountedPrice: number;
  isActive: boolean;
}

const tierColors: Record<string, string> = {
  basic: 'bg-gray-100 text-gray-800',
  standard: 'bg-blue-100 text-blue-800',
  premium: 'bg-purple-100 text-purple-800',
  vip: 'bg-amber-100 text-amber-800',
};

export default function ServicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState<'services' | 'categories' | 'packages'>('services');

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const response = await api.get('/services/categories');
      return response.data as ServiceCategory[];
    },
  });

  // Fetch services
  const { data: services, isLoading: loadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await api.get('/services');
      return response.data as Service[];
    },
  });

  // Fetch packages
  const { data: packages } = useQuery({
    queryKey: ['service-packages'],
    queryFn: async () => {
      const response = await api.get('/services/packages');
      return response.data as ServicePackage[];
    },
  });

  // Category mutation
  const categoryMutation = useMutation({
    mutationFn: (data: Partial<ServiceCategory>) => {
      if (editingCategory) {
        return api.patch(`/services/categories/${editingCategory.id}`, data);
      }
      return api.post('/services/categories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      setShowCategoryModal(false);
      setEditingCategory(null);
    },
  });

  // Service mutation
  const serviceMutation = useMutation({
    mutationFn: (data: Partial<Service>) => {
      if (editingService) {
        return api.patch(`/services/${editingService.id}`, data);
      }
      return api.post('/services', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setShowServiceModal(false);
      setEditingService(null);
    },
  });

  // Package mutation
  const packageMutation = useMutation({
    mutationFn: (data: Partial<ServicePackage>) => api.post('/services/packages', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-packages'] });
      setShowPackageModal(false);
    },
  });

  const filteredServices = services?.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCategorySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    categoryMutation.mutate({
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      description: formData.get('description') as string,
      isActive: formData.get('isActive') === 'true',
    });
  };

  const handleServiceSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    serviceMutation.mutate({
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      categoryId: formData.get('categoryId') as string,
      tier: formData.get('tier') as Service['tier'],
      description: formData.get('description') as string,
      duration: Number(formData.get('duration')) || undefined,
      isActive: formData.get('isActive') === 'true',
    });
  };

  const handlePackageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    packageMutation.mutate({
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      description: formData.get('description') as string,
      basePrice: Number(formData.get('basePrice')),
      discountedPrice: Number(formData.get('discountedPrice')),
      isActive: true,
    });
  };

  const openModal = () => {
    if (activeTab === 'categories') {
      setEditingCategory(null);
      setShowCategoryModal(true);
    } else if (activeTab === 'services') {
      setEditingService(null);
      setShowServiceModal(true);
    } else {
      setShowPackageModal(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services Management</h1>
          <p className="mt-1 text-sm text-gray-500">Manage service categories, services, and packages</p>
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New {activeTab === 'categories' ? 'Category' : activeTab === 'services' ? 'Service' : 'Package'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('services')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'services'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Layers className="h-4 w-4 inline mr-2" />
            Services ({services?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FolderOpen className="h-4 w-4 inline mr-2" />
            Categories ({categories?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('packages')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'packages'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="h-4 w-4 inline mr-2" />
            Packages ({packages?.length || 0})
          </button>
        </nav>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loadingServices ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredServices?.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{service.name}</div>
                      <div className="text-sm text-gray-500">{service.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{service.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {categories?.find(c => c.id === service.categoryId)?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${tierColors[service.tier]}`}>
                        {service.tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {service.duration ? `${service.duration} min` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        service.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingService(service);
                          setShowServiceModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories?.map((category) => (
            <div key={category.id} className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <FolderOpen className="h-8 w-8 text-blue-500 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{category.name}</h3>
                    <p className="text-xs text-gray-500">{category.code}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingCategory(category);
                    setShowCategoryModal(true);
                  }}
                  className="text-gray-400 hover:text-blue-600"
                >
                  <Edit className="h-4 w-4" />
                </button>
              </div>
              {category.description && (
                <p className="mt-2 text-sm text-gray-500">{category.description}</p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  category.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {category.isActive ? 'Active' : 'Inactive'}
                </span>
                <span className="text-xs text-gray-400">
                  {services?.filter(s => s.categoryId === category.id).length || 0} services
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Packages Tab */}
      {activeTab === 'packages' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages?.map((pkg) => (
            <div key={pkg.id} className="bg-white shadow rounded-lg p-4 border-2 border-transparent hover:border-blue-500">
              <div className="flex items-center mb-3">
                <Package className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{pkg.name}</h3>
                  <p className="text-xs text-gray-500">{pkg.code}</p>
                </div>
              </div>
              {pkg.description && (
                <p className="text-sm text-gray-500 mb-3">{pkg.description}</p>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-green-600">UGX {pkg.discountedPrice.toLocaleString()}</span>
                  {pkg.basePrice !== pkg.discountedPrice && (
                    <span className="ml-2 text-sm text-gray-400 line-through">UGX {pkg.basePrice.toLocaleString()}</span>
                  )}
                </div>
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowCategoryModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingCategory ? 'Edit Category' : 'New Service Category'}
                </h3>
                <button onClick={() => setShowCategoryModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCategorySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingCategory?.name}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code</label>
                  <input
                    type="text"
                    name="code"
                    defaultValue={editingCategory?.code}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    defaultValue={editingCategory?.description}
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={editingCategory?.isActive ?? true}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">Active</label>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCategoryModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={categoryMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {categoryMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowServiceModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingService ? 'Edit Service' : 'New Service'}
                </h3>
                <button onClick={() => setShowServiceModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleServiceSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingService?.name}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code</label>
                  <input
                    type="text"
                    name="code"
                    defaultValue={editingService?.code}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select
                    name="categoryId"
                    defaultValue={editingService?.categoryId}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="">Select category</option>
                    {categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tier</label>
                    <select
                      name="tier"
                      defaultValue={editingService?.tier || 'standard'}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="basic">Basic</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                      <option value="vip">VIP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration (min)</label>
                    <input
                      type="number"
                      name="duration"
                      defaultValue={editingService?.duration}
                      min="0"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    defaultValue={editingService?.description}
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={editingService?.isActive ?? true}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">Active</label>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowServiceModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={serviceMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {serviceMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Package Modal */}
      {showPackageModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowPackageModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">New Service Package</h3>
                <button onClick={() => setShowPackageModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handlePackageSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code</label>
                  <input
                    type="text"
                    name="code"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Base Price (UGX)</label>
                    <input
                      type="number"
                      name="basePrice"
                      required
                      min="0"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Discounted Price</label>
                    <input
                      type="number"
                      name="discountedPrice"
                      required
                      min="0"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPackageModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={packageMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {packageMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
