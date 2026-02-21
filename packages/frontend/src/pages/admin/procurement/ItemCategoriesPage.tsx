import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { api, getApiErrorMessage } from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';

const CATEGORIES_API = '/api/v1/item-classifications/categories';
const SUBCATEGORIES_API = '/api/v1/item-classifications/subcategories';

interface Subcategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  categoryId: string;
}

interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isDrugCategory: boolean;
  requiresPrescription: boolean;
  requiresBatchTracking: boolean;
  requiresExpiryTracking: boolean;
  sortOrder: number;
  isActive: boolean;
  facilityId: string;
  subcategories?: Subcategory[];
}

export default function ItemCategoriesPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['item-categories', facilityId],
    queryFn: async () => {
      const res = await api.get(CATEGORIES_API, { params: { facilityId } });
      return res.data;
    },
    staleTime: 60000,
  });

  const selectedCategory = useMemo(() => {
    if (!selectedCategoryId) return null;
    return categories.find(c => c.id === selectedCategoryId) ?? null;
  }, [categories, selectedCategoryId]);

  const invalidateCategories = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['item-categories'] });
  }, [queryClient]);

  const createCategoryMutation = useMutation({
    mutationFn: (data: { code: string; name: string }) =>
      api.post(CATEGORIES_API, { facilityId, code: data.code, name: data.name }),
    onSuccess: () => { invalidateCategories(); setMutationError(null); },
    onError: (err) => setMutationError(getApiErrorMessage(err)),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`${CATEGORIES_API}/${id}`, data),
    onSuccess: () => { invalidateCategories(); setMutationError(null); },
    onError: (err) => setMutationError(getApiErrorMessage(err)),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${CATEGORIES_API}/${id}`),
    onSuccess: (_data, deletedId) => {
      invalidateCategories();
      setMutationError(null);
      if (selectedCategoryId === deletedId) setSelectedCategoryId(null);
    },
    onError: (err) => setMutationError(getApiErrorMessage(err)),
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${SUBCATEGORIES_API}/${id}`),
    onSuccess: () => { invalidateCategories(); setMutationError(null); },
    onError: (err) => setMutationError(getApiErrorMessage(err)),
  });

  const handleAddCategory = useCallback(() => {
    const code = `NEW-${Date.now().toString().slice(-4)}`;
    createCategoryMutation.mutate({ code, name: 'New Category' });
  }, [createCategoryMutation]);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    deleteCategoryMutation.mutate(categoryId);
  }, [deleteCategoryMutation]);

  const handleDeleteSubcategory = useCallback((subcategoryId: string) => {
    deleteSubcategoryMutation.mutate(subcategoryId);
  }, [deleteSubcategoryMutation]);

  const stats = useMemo(() => {
    const allSubcategories = categories.flatMap(c => c.subcategories || []);
    return {
      totalCategories: categories.length,
      totalSubcategories: allSubcategories.length,
      drugCategories: categories.filter(c => c.isDrugCategory).length,
      activeCategories: categories.filter(c => c.isActive).length,
    };
  }, [categories]);

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    const searchLower = searchTerm.toLowerCase();
    return categories.filter(c =>
      c.name.toLowerCase().includes(searchLower) ||
      c.code.toLowerCase().includes(searchLower) ||
      c.subcategories?.some(sub =>
        sub.name.toLowerCase().includes(searchLower) ||
        sub.code.toLowerCase().includes(searchLower)
      )
    );
  }, [categories, searchTerm]);

  const renderSubcategory = (sub: Subcategory) => (
    <div
      key={sub.id}
      className="flex items-center gap-2 px-4 py-3 border-b hover:bg-gray-50"
      style={{ paddingLeft: '64px' }}
    >
      <div className="w-5" />

      <div className={`w-2 h-2 rounded-full ${sub.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />

      <div className="flex-1 flex items-center gap-3">
        <div>
          <div className="font-medium text-gray-900">{sub.name}</div>
          <div className="text-xs text-gray-500">{sub.code}</div>
        </div>
      </div>

      <div className="text-sm text-gray-500 w-24 text-right">&mdash;</div>

      <div className="text-sm text-gray-600 w-28">&mdash;</div>

      <div className="w-20 text-center">
        <span className={`text-xs ${sub.isActive ? 'text-green-600' : 'text-gray-400'}`}>
          {sub.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); handleDeleteSubcategory(sub.id); }}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderCategory = (category: Category) => {
    const hasChildren = category.subcategories && category.subcategories.length > 0;
    const isExpanded = expandedCategories.includes(category.id);

    return (
      <div key={category.id}>
        <div
          className={`flex items-center gap-2 px-4 py-3 border-b hover:bg-gray-50 cursor-pointer ${
            selectedCategoryId === category.id ? 'bg-orange-50' : ''
          }`}
          style={{ paddingLeft: '16px' }}
          onClick={() => setSelectedCategoryId(category.id)}
        >
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleCategory(category.id); }}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <div className={`w-2 h-2 rounded-full ${category.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />

          <div className="flex-1 flex items-center gap-3">
            <div>
              <div className="font-medium text-gray-900">{category.name}</div>
              <div className="text-xs text-gray-500">{category.code}</div>
            </div>
          </div>

          <div className="text-sm text-gray-500 w-24 text-right">{category.subcategories?.length || 0} sub</div>

          <div className="text-sm text-gray-600 w-28">
            {category.isDrugCategory ? (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Drug</span>
            ) : (
              <span className="text-xs text-gray-400">General</span>
            )}
          </div>

          <div className="w-20 text-center">
            <span className={`text-xs ${category.isActive ? 'text-green-600' : 'text-gray-400'}`}>
              {category.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedCategoryId(category.id); }}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category.id); }}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {category.subcategories!.map(sub => renderSubcategory(sub))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Layers className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Item Categories</h1>
              <p className="text-sm text-gray-500">Manage product categories and subcategories</p>
            </div>
          </div>
          <button
            onClick={handleAddCategory}
            disabled={createCategoryMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          >
            {createCategoryMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            New Category
          </button>
        </div>

        {mutationError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            {mutationError}
            <button onClick={() => setMutationError(null)} className="ml-2 text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Total Categories</div>
            <div className="text-xl font-bold text-gray-900">{stats.totalCategories}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-orange-600">
              <FolderTree className="w-4 h-4" />
              Subcategories
            </div>
            <div className="text-xl font-bold text-orange-700">{stats.totalSubcategories}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-blue-600">Drug Categories</div>
            <div className="text-xl font-bold text-blue-700">{stats.drugCategories}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Active Categories
            </div>
            <div className="text-xl font-bold text-green-700">{stats.activeCategories}</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button
            onClick={() => setExpandedCategories(categories.map(c => c.id))}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Expand All
          </button>
          <button
            onClick={() => setExpandedCategories([])}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Categories Tree */}
        <div className="flex-1 overflow-auto">
          <div className="bg-white border-b sticky top-0 z-10">
            <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
              <div className="w-5" />
              <div className="w-2" />
              <div className="flex-1">Category</div>
              <div className="w-24 text-right">Subcategories</div>
              <div className="w-28">Type</div>
              <div className="w-20 text-center">Status</div>
              <div className="w-20">Actions</div>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <span className="ml-2 text-gray-600">Loading categories...</span>
            </div>
          ) : (
            filteredCategories.map(category => renderCategory(category))
          )}
        </div>

        {/* Details Panel */}
        {selectedCategory && (
          <div className="w-96 border-l bg-white flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Category Details</h3>
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase">Name</label>
                <div className="font-medium text-gray-900">{selectedCategory.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Code</label>
                  <div className="font-medium text-gray-900">{selectedCategory.code}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Status</label>
                  <div className={`inline-flex items-center gap-1 text-sm ${selectedCategory.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${selectedCategory.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    {selectedCategory.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>

              {selectedCategory.description && (
                <div>
                  <label className="text-xs text-gray-500 uppercase">Description</label>
                  <div className="text-sm text-gray-700">{selectedCategory.description}</div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-900 mb-3">Category Settings</div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Drug Category</span>
                    {selectedCategory.isDrugCategory ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Requires Prescription</span>
                    {selectedCategory.requiresPrescription ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Batch Tracking</span>
                    {selectedCategory.requiresBatchTracking ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Expiry Tracking</span>
                    {selectedCategory.requiresExpiryTracking ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="font-medium text-gray-900">Subcategories</span>
                  <span className="text-blue-600">{selectedCategory.subcategories?.length || 0}</span>
                </div>
                {selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
                  <div className="space-y-1">
                    {selectedCategory.subcategories.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{sub.name}</div>
                          <div className="text-xs text-gray-500">{sub.code}</div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${sub.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setSelectedCategoryId(selectedCategory.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <Edit2 className="w-4 h-4" />
                Edit Category
              </button>
              <button
                onClick={() => handleDeleteCategory(selectedCategory.id)}
                disabled={deleteCategoryMutation.isPending}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {deleteCategoryMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
