import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Power,
  Download,
  Upload,
  Filter,
  Stethoscope,
  FlaskConical,
  Radio,
  Scissors,
  Pill,
  MoreHorizontal,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { servicesService, type Service, type ServiceCategory } from '../../../services/services';

const fallbackServices: Service[] = [
  { id: '1', code: 'CON001', name: 'General Consultation', categoryId: '1', category: { id: '1', code: 'CON', name: 'Consultation', createdAt: '' }, basePrice: 500, isActive: true, createdAt: '' },
  { id: '2', code: 'LAB001', name: 'Complete Blood Count', categoryId: '2', category: { id: '2', code: 'LAB', name: 'Lab', createdAt: '' }, basePrice: 350, isActive: true, createdAt: '' },
  { id: '3', code: 'RAD001', name: 'Chest X-Ray', categoryId: '3', category: { id: '3', code: 'RAD', name: 'Radiology', createdAt: '' }, basePrice: 600, isActive: true, createdAt: '' },
];

const categories = ['All', 'Consultation', 'Lab', 'Radiology', 'Procedures', 'Pharmacy'];

const getCategoryIcon = (categoryName?: string) => {
  switch (categoryName) {
    case 'Consultation': return <Stethoscope className="w-4 h-4" />;
    case 'Lab': return <FlaskConical className="w-4 h-4" />;
    case 'Radiology': return <Radio className="w-4 h-4" />;
    case 'Procedures': return <Scissors className="w-4 h-4" />;
    case 'Pharmacy': return <Pill className="w-4 h-4" />;
    default: return null;
  }
};

export default function ServiceCatalogPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Fetch services from API
  const { data: servicesData, isLoading, error } = useQuery({
    queryKey: ['services', selectedCategory === 'All' ? undefined : selectedCategory],
    queryFn: () => servicesService.list({ categoryId: selectedCategory === 'All' ? undefined : selectedCategory }),
    staleTime: 30000,
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['serviceCategories'],
    queryFn: () => servicesService.categories.list(),
    staleTime: 60000,
  });

  // Toggle service status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return servicesService.update(id, { isActive: !isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const services = servicesData || fallbackServices;
  const categoryNames = ['All', ...(categoriesData?.map((c: ServiceCategory) => c.name) || ['Consultation', 'Lab', 'Radiology', 'Procedures', 'Pharmacy'])];

  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = service.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.code?.toLowerCase().includes(searchTerm.toLowerCase());
      const categoryName = service.category?.name || '';
      const matchesCategory = selectedCategory === 'All' || categoryName === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [services, searchTerm, selectedCategory]);

  const stats = useMemo(() => ({
    total: services.length,
    active: services.filter(s => s.isActive).length,
    inactive: services.filter(s => !s.isActive).length,
  }), [services]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Catalog</h1>
            <p className="text-sm text-gray-500">Manage all hospital services</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Service
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Total:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm text-gray-500">Active:</span>
            <span className="font-semibold text-green-600">{stats.active}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            <span className="text-sm text-gray-500">Inactive:</span>
            <span className="font-semibold text-gray-600">{stats.inactive}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            {categoryNames.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Service Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Department</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Base Price</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                    <p className="text-sm text-gray-500 mt-2">Loading services...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
                    <p className="text-sm text-red-600 mt-2">Failed to load services</p>
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No services found.
                  </td>
                </tr>
              ) : (
                filteredServices.map(service => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{service.code}</code>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{service.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-sm">
                      {getCategoryIcon(service.category?.name)}
                      {service.category?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{service.department || '—'}</td>
                  <td className="px-4 py-3 text-right font-medium">KES {(service.basePrice || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      service.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {service.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleStatusMutation.mutate({ id: service.id, isActive: service.isActive })}
                        className={`p-1.5 rounded ${
                          service.isActive
                            ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
