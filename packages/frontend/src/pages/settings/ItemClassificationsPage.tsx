import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth';
import { Plus, Trash2, Tag, Layers, Building2, Box, FlaskConical, Thermometer, Loader2, RefreshCw } from 'lucide-react';
import {
  categoryService,
  subcategoryService,
  brandService,
  tagService,
  unitService,
  formulationService,
  storageConditionService,
  seedDefaults,
  type ItemCategory,
  type ItemSubcategory,
} from '../../services/item-classifications';

type TabType = 'categories' | 'brands' | 'tags' | 'units' | 'formulations' | 'storage';

// Default facility ID - should come from user context
const DEFAULT_FACILITY_ID = '00000000-0000-0000-0000-000000000001';

export default function ItemClassificationsPage() {
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || DEFAULT_FACILITY_ID;
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState<TabType>('categories');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  // Categories query
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['item-categories', facilityId],
    queryFn: () => categoryService.list(facilityId),
    enabled: !!facilityId,
  });

  // Subcategories query
  const { data: subcategories = [], isLoading: loadingSubcategories } = useQuery({
    queryKey: ['item-subcategories', facilityId, selectedCategoryId],
    queryFn: () => subcategoryService.list(facilityId, selectedCategoryId || undefined),
    enabled: !!facilityId,
  });

  // Brands query
  const { data: brands = [], isLoading: loadingBrands } = useQuery({
    queryKey: ['item-brands', facilityId],
    queryFn: () => brandService.list(facilityId),
    enabled: !!facilityId && activeTab === 'brands',
  });

  // Tags query
  const { data: tags = [], isLoading: loadingTags } = useQuery({
    queryKey: ['item-tags', facilityId],
    queryFn: () => tagService.list(facilityId),
    enabled: !!facilityId && activeTab === 'tags',
  });

  // Units query
  const { data: units = [], isLoading: loadingUnits } = useQuery({
    queryKey: ['item-units', facilityId],
    queryFn: () => unitService.list(facilityId),
    enabled: !!facilityId && activeTab === 'units',
  });

  // Formulations query
  const { data: formulations = [], isLoading: loadingFormulations } = useQuery({
    queryKey: ['item-formulations', facilityId],
    queryFn: () => formulationService.list(facilityId),
    enabled: !!facilityId && activeTab === 'formulations',
  });

  // Storage conditions query
  const { data: storageConditions = [], isLoading: loadingStorage } = useQuery({
    queryKey: ['storage-conditions', facilityId],
    queryFn: () => storageConditionService.list(facilityId),
    enabled: !!facilityId && activeTab === 'storage',
  });

  // Seed defaults mutation
  const seedMutation = useMutation({
    mutationFn: () => seedDefaults(facilityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      queryClient.invalidateQueries({ queryKey: ['item-subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['item-tags'] });
      queryClient.invalidateQueries({ queryKey: ['item-units'] });
      queryClient.invalidateQueries({ queryKey: ['storage-conditions'] });
      alert('Default classifications seeded successfully!');
    },
    onError: (err: Error) => alert('Error seeding defaults: ' + err.message),
  });

  // Category mutations
  const createCategory = useMutation({
    mutationFn: (data: { name: string; code: string; description?: string }) =>
      categoryService.create(facilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-categories'] });
      resetForm();
    },
  });

  const deleteCategory = useMutation({
    mutationFn: categoryService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-categories'] }),
  });

  // Subcategory mutations
  const createSubcategory = useMutation({
    mutationFn: (data: { categoryId: string; name: string; code: string }) =>
      subcategoryService.create(facilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-subcategories'] });
      resetForm();
    },
  });

  const deleteSubcategory = useMutation({
    mutationFn: subcategoryService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-subcategories'] }),
  });

  // Brand mutations
  const createBrand = useMutation({
    mutationFn: (data: { name: string; code: string; manufacturer?: string }) =>
      brandService.create(facilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-brands'] });
      resetForm();
    },
  });

  const deleteBrand = useMutation({
    mutationFn: brandService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-brands'] }),
  });

  // Tag mutations
  const createTag = useMutation({
    mutationFn: (data: { name: string; code: string; color?: string }) =>
      tagService.create(facilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-tags'] });
      resetForm();
    },
  });

  const deleteTag = useMutation({
    mutationFn: tagService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-tags'] }),
  });

  // Unit mutations
  const createUnit = useMutation({
    mutationFn: (data: { name: string; abbreviation: string }) =>
      unitService.create(facilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-units'] });
      resetForm();
    },
  });

  const deleteUnit = useMutation({
    mutationFn: unitService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-units'] }),
  });

  // Formulation mutations
  const createFormulation = useMutation({
    mutationFn: (data: { name: string; code: string }) =>
      formulationService.create(facilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-formulations'] });
      resetForm();
    },
  });

  const deleteFormulation = useMutation({
    mutationFn: formulationService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['item-formulations'] }),
  });

  // Storage condition mutations
  const createStorageCondition = useMutation({
    mutationFn: (data: { name: string; code: string; minTemp?: number; maxTemp?: number }) =>
      storageConditionService.create(facilityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storage-conditions'] });
      resetForm();
    },
  });

  const deleteStorageCondition = useMutation({
    mutationFn: storageConditionService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storage-conditions'] }),
  });

  const resetForm = () => {
    setFormData({});
    setShowAddForm(false);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      alert('Name is required');
      return;
    }

    switch (activeTab) {
      case 'categories':
        if (showAddForm && !selectedCategoryId) {
          createCategory.mutate({
            name: formData.name,
            code: formData.code || formData.name.toUpperCase().replace(/\s+/g, '_'),
            description: formData.description,
          });
        } else if (showAddForm && selectedCategoryId) {
          createSubcategory.mutate({
            categoryId: selectedCategoryId,
            name: formData.name,
            code: formData.code || formData.name.toUpperCase().replace(/\s+/g, '_'),
          });
        }
        break;
      case 'brands':
        createBrand.mutate({
          name: formData.name,
          code: formData.code || formData.name.toUpperCase().replace(/\s+/g, '_'),
          manufacturer: formData.manufacturer,
        });
        break;
      case 'tags':
        createTag.mutate({
          name: formData.name,
          code: formData.code || formData.name.toUpperCase().replace(/\s+/g, '_'),
          color: formData.color,
        });
        break;
      case 'units':
        createUnit.mutate({
          name: formData.name,
          abbreviation: formData.abbreviation || formData.name.substring(0, 3).toLowerCase(),
        });
        break;
      case 'formulations':
        createFormulation.mutate({
          name: formData.name,
          code: formData.code || formData.name.toUpperCase().replace(/\s+/g, '_'),
        });
        break;
      case 'storage':
        createStorageCondition.mutate({
          name: formData.name,
          code: formData.code || formData.name.toUpperCase().replace(/\s+/g, '_'),
          minTemp: formData.minTemp ? parseFloat(formData.minTemp) : undefined,
          maxTemp: formData.maxTemp ? parseFloat(formData.maxTemp) : undefined,
        });
        break;
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    switch (activeTab) {
      case 'categories':
        if (selectedCategoryId) {
          deleteSubcategory.mutate(id);
        } else {
          deleteCategory.mutate(id);
        }
        break;
      case 'brands':
        deleteBrand.mutate(id);
        break;
      case 'tags':
        deleteTag.mutate(id);
        break;
      case 'units':
        deleteUnit.mutate(id);
        break;
      case 'formulations':
        deleteFormulation.mutate(id);
        break;
      case 'storage':
        deleteStorageCondition.mutate(id);
        break;
    }
  };

  const tabs = [
    { id: 'categories' as TabType, label: 'Categories', icon: Layers },
    { id: 'brands' as TabType, label: 'Brands', icon: Building2 },
    { id: 'tags' as TabType, label: 'Tags', icon: Tag },
    { id: 'units' as TabType, label: 'Units', icon: Box },
    { id: 'formulations' as TabType, label: 'Formulations', icon: FlaskConical },
    { id: 'storage' as TabType, label: 'Storage', icon: Thermometer },
  ];

  const isLoading = loadingCategories || loadingSubcategories || loadingBrands || 
    loadingTags || loadingUnits || loadingFormulations || loadingStorage;

  const renderCategoriesTab = () => (
    <div className="space-y-6">
      {/* Category selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">View:</label>
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} (Subcategories)
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Code</th>
              {selectedCategoryId && (
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Category</th>
              )}
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(selectedCategoryId ? subcategories : categories).map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-gray-600">{item.code}</td>
                {selectedCategoryId && 'category' in item && (
                  <td className="px-4 py-3 text-gray-600">{(item as ItemSubcategory).category?.name}</td>
                )}
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {(selectedCategoryId ? subcategories : categories).length === 0 && (
              <tr>
                <td colSpan={selectedCategoryId ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                  No {selectedCategoryId ? 'subcategories' : 'categories'} found. Click "Add New" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGenericList = (items: Array<{ id: string; name: string; code?: string; abbreviation?: string; isActive?: boolean }>, extraColumns?: { key: string; label: string }[]) => (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              {activeTab === 'units' ? 'Abbreviation' : 'Code'}
            </th>
            {extraColumns?.map((col) => (
              <th key={col.key} className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                {col.label}
              </th>
            ))}
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{item.name}</td>
              <td className="px-4 py-3 text-gray-600">{item.abbreviation || item.code}</td>
              {extraColumns?.map((col) => (
                <td key={col.key} className="px-4 py-3 text-gray-600">
                  {(item as Record<string, unknown>)[col.key] as string}
                </td>
              ))}
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs ${item.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {item.isActive !== false ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={(extraColumns?.length || 0) + 4} className="px-4 py-8 text-center text-gray-500">
                No items found. Click "Add New" to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderAddForm = () => {
    const formFields: { key: string; label: string; type?: string; placeholder?: string }[] = [];
    
    switch (activeTab) {
      case 'categories':
        formFields.push(
          { key: 'name', label: 'Name', placeholder: selectedCategoryId ? 'e.g., Antibiotics' : 'e.g., Medications' },
          { key: 'code', label: 'Code', placeholder: 'Auto-generated if empty' },
          { key: 'description', label: 'Description', placeholder: 'Optional description' }
        );
        break;
      case 'brands':
        formFields.push(
          { key: 'name', label: 'Brand Name', placeholder: 'e.g., Pfizer' },
          { key: 'code', label: 'Code', placeholder: 'Auto-generated if empty' },
          { key: 'manufacturer', label: 'Manufacturer', placeholder: 'e.g., Pfizer Inc.' }
        );
        break;
      case 'tags':
        formFields.push(
          { key: 'name', label: 'Tag Name', placeholder: 'e.g., High-Alert' },
          { key: 'code', label: 'Code', placeholder: 'Auto-generated if empty' },
          { key: 'color', label: 'Color', type: 'color' }
        );
        break;
      case 'units':
        formFields.push(
          { key: 'name', label: 'Unit Name', placeholder: 'e.g., Tablet' },
          { key: 'abbreviation', label: 'Abbreviation', placeholder: 'e.g., tab' }
        );
        break;
      case 'formulations':
        formFields.push(
          { key: 'name', label: 'Formulation Name', placeholder: 'e.g., Tablet' },
          { key: 'code', label: 'Code', placeholder: 'Auto-generated if empty' }
        );
        break;
      case 'storage':
        formFields.push(
          { key: 'name', label: 'Condition Name', placeholder: 'e.g., Refrigerated' },
          { key: 'code', label: 'Code', placeholder: 'Auto-generated if empty' },
          { key: 'minTemp', label: 'Min Temp (°C)', type: 'number', placeholder: 'e.g., 2' },
          { key: 'maxTemp', label: 'Max Temp (°C)', type: 'number', placeholder: 'e.g., 8' }
        );
        break;
    }

    return (
      <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
        <h3 className="font-medium mb-3">
          Add New {activeTab === 'categories' && selectedCategoryId ? 'Subcategory' : tabs.find(t => t.id === activeTab)?.label.slice(0, -1)}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {formFields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type || 'text'}
                value={formData[field.key] || ''}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={resetForm}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createCategory.isPending || createSubcategory.isPending || createBrand.isPending || 
              createTag.isPending || createUnit.isPending || createFormulation.isPending || createStorageCondition.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {(createCategory.isPending || createSubcategory.isPending || createBrand.isPending || 
              createTag.isPending || createUnit.isPending || createFormulation.isPending || createStorageCondition.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Save
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Item Classifications</h1>
          <p className="text-gray-600">Manage categories, brands, units, and other item attributes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            {seedMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Seed Defaults
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add New
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedCategoryId('');
                resetForm();
              }}
              className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && renderAddForm()}

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {activeTab === 'categories' && renderCategoriesTab()}
          {activeTab === 'brands' && renderGenericList(brands, [{ key: 'manufacturer', label: 'Manufacturer' }])}
          {activeTab === 'tags' && renderGenericList(tags)}
          {activeTab === 'units' && renderGenericList(units)}
          {activeTab === 'formulations' && renderGenericList(formulations)}
          {activeTab === 'storage' && renderGenericList(storageConditions as Array<{ id: string; name: string; code: string; isActive: boolean }>)}
        </>
      )}
    </div>
  );
}
