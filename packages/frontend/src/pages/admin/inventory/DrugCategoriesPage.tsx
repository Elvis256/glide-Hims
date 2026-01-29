import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FolderTree,
  Search,
  Plus,
  Edit2,
  Trash2,
  Thermometer,
  Lock,
  FileText,
  ChevronRight,
  Shield,
  Snowflake,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';

interface DrugCategory {
  id: string;
  code: string;
  name: string;
  parentCategory?: string;
  therapeuticClass: string;
  controlSchedule?: string;
  storageRequirement: 'room-temp' | 'cold-chain' | 'controlled' | 'frozen';
  prescriptionRequired: boolean;
  specialHandling?: string;
  drugCount: number;
  isActive: boolean;
}

const STORAGE_KEY = 'glide_drug_categories';

const defaultCategories: DrugCategory[] = [
  {
    id: '1',
    code: 'AB',
    name: 'Antibiotics',
    therapeuticClass: 'Anti-Infectives',
    storageRequirement: 'room-temp',
    prescriptionRequired: true,
    drugCount: 45,
    isActive: true,
  },
  {
    id: '2',
    code: 'AN-OP',
    name: 'Opioid Analgesics',
    parentCategory: 'Analgesics',
    therapeuticClass: 'Pain Management',
    controlSchedule: 'Schedule II',
    storageRequirement: 'controlled',
    prescriptionRequired: true,
    specialHandling: 'Double-lock cabinet, witness for waste',
    drugCount: 12,
    isActive: true,
  },
  {
    id: '3',
    code: 'VAC',
    name: 'Vaccines',
    therapeuticClass: 'Immunization',
    storageRequirement: 'cold-chain',
    prescriptionRequired: true,
    specialHandling: 'Maintain 2-8°C, monitor temperature',
    drugCount: 28,
    isActive: true,
  },
  {
    id: '4',
    code: 'INS',
    name: 'Insulins',
    therapeuticClass: 'Antidiabetics',
    storageRequirement: 'cold-chain',
    prescriptionRequired: true,
    specialHandling: 'Refrigerate until use, 28 days at room temp after opening',
    drugCount: 15,
    isActive: true,
  },
  {
    id: '5',
    code: 'BZ',
    name: 'Benzodiazepines',
    parentCategory: 'Anxiolytics',
    therapeuticClass: 'CNS Agents',
    controlSchedule: 'Schedule IV',
    storageRequirement: 'controlled',
    prescriptionRequired: true,
    specialHandling: 'Controlled substance cabinet',
    drugCount: 8,
    isActive: true,
  },
  {
    id: '6',
    code: 'BIO',
    name: 'Biologics',
    therapeuticClass: 'Immunomodulators',
    storageRequirement: 'frozen',
    prescriptionRequired: true,
    specialHandling: 'Store at -20°C, thaw before administration',
    drugCount: 6,
    isActive: true,
  },
  {
    id: '7',
    code: 'OTC',
    name: 'Over-the-Counter',
    therapeuticClass: 'General',
    storageRequirement: 'room-temp',
    prescriptionRequired: false,
    drugCount: 52,
    isActive: true,
  },
  {
    id: '8',
    code: 'CHEMO',
    name: 'Chemotherapy Agents',
    therapeuticClass: 'Oncology',
    storageRequirement: 'controlled',
    prescriptionRequired: true,
    specialHandling: 'Hazardous material, special handling required',
    drugCount: 18,
    isActive: true,
  },
  {
    id: '9',
    code: 'AN-NS',
    name: 'NSAIDs',
    parentCategory: 'Analgesics',
    therapeuticClass: 'Pain Management',
    storageRequirement: 'room-temp',
    prescriptionRequired: true,
    drugCount: 14,
    isActive: true,
  },
  {
    id: '10',
    code: 'BARB',
    name: 'Barbiturates',
    therapeuticClass: 'CNS Agents',
    controlSchedule: 'Schedule III',
    storageRequirement: 'controlled',
    prescriptionRequired: true,
    specialHandling: 'Controlled substance cabinet',
    drugCount: 4,
    isActive: false,
  },
];

function loadCategories(): DrugCategory[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load drug categories:', e);
  }
  return defaultCategories;
}

function saveCategories(categories: DrugCategory[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save drug categories:', e);
  }
}

export default function DrugCategoriesPage() {
  const [categories, setCategories] = useState<DrugCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [storageFilter, setStorageFilter] = useState<string>('all');
  const [controlFilter, setControlFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<DrugCategory | null>(null);
  const [formData, setFormData] = useState<Partial<DrugCategory>>({});

  useEffect(() => {
    const loaded = loadCategories();
    setCategories(loaded);
    setIsLoading(false);
  }, []);

  const updateCategories = useCallback((updater: (prev: DrugCategory[]) => DrugCategory[]) => {
    setCategories((prev) => {
      const updated = updater(prev);
      saveCategories(updated);
      return updated;
    });
  }, []);

  const handleAdd = () => {
    setFormData({
      code: '',
      name: '',
      therapeuticClass: '',
      storageRequirement: 'room-temp',
      prescriptionRequired: true,
      drugCount: 0,
      isActive: true,
    });
    setShowAddModal(true);
  };

  const handleEdit = (category: DrugCategory) => {
    setEditingCategory(category);
    setFormData({ ...category });
    setShowEditModal(true);
  };

  const handleDelete = (id: string) => {
    updateCategories((prev) => prev.filter((c) => c.id !== id));
    setShowDeleteConfirm(null);
  };

  const handleSaveAdd = () => {
    if (!formData.code || !formData.name || !formData.therapeuticClass) return;
    const newCategory: DrugCategory = {
      id: `cat_${Date.now()}`,
      code: formData.code,
      name: formData.name,
      parentCategory: formData.parentCategory,
      therapeuticClass: formData.therapeuticClass,
      controlSchedule: formData.controlSchedule,
      storageRequirement: formData.storageRequirement || 'room-temp',
      prescriptionRequired: formData.prescriptionRequired ?? true,
      specialHandling: formData.specialHandling,
      drugCount: formData.drugCount || 0,
      isActive: formData.isActive ?? true,
    };
    updateCategories((prev) => [...prev, newCategory]);
    setShowAddModal(false);
    setFormData({});
  };

  const handleSaveEdit = () => {
    if (!editingCategory || !formData.code || !formData.name || !formData.therapeuticClass) return;
    updateCategories((prev) =>
      prev.map((c) =>
        c.id === editingCategory.id
          ? {
              ...c,
              code: formData.code!,
              name: formData.name!,
              parentCategory: formData.parentCategory,
              therapeuticClass: formData.therapeuticClass!,
              controlSchedule: formData.controlSchedule,
              storageRequirement: formData.storageRequirement || 'room-temp',
              prescriptionRequired: formData.prescriptionRequired ?? true,
              specialHandling: formData.specialHandling,
              isActive: formData.isActive ?? true,
            }
          : c
      )
    );
    setShowEditModal(false);
    setEditingCategory(null);
    setFormData({});
  };

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchesSearch =
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.therapeuticClass.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStorage = storageFilter === 'all' || cat.storageRequirement === storageFilter;
      const matchesControl =
        controlFilter === 'all' ||
        (controlFilter === 'controlled' && cat.controlSchedule) ||
        (controlFilter === 'non-controlled' && !cat.controlSchedule);
      return matchesSearch && matchesStorage && matchesControl;
    });
  }, [categories, searchTerm, storageFilter, controlFilter]);

  const getStorageIcon = (storage: string) => {
    switch (storage) {
      case 'cold-chain':
        return <Snowflake className="w-4 h-4 text-blue-500" />;
      case 'frozen':
        return <Snowflake className="w-4 h-4 text-cyan-500" />;
      case 'controlled':
        return <Lock className="w-4 h-4 text-red-500" />;
      default:
        return <Thermometer className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStorageLabel = (storage: string) => {
    switch (storage) {
      case 'room-temp':
        return 'Room Temperature';
      case 'cold-chain':
        return 'Cold Chain (2-8°C)';
      case 'frozen':
        return 'Frozen (-20°C)';
      case 'controlled':
        return 'Controlled Access';
      default:
        return storage;
    }
  };

  const getStorageBadge = (storage: string) => {
    switch (storage) {
      case 'cold-chain':
        return 'bg-blue-100 text-blue-800';
      case 'frozen':
        return 'bg-cyan-100 text-cyan-800';
      case 'controlled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading drug categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FolderTree className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Drug Categories</h1>
            <p className="text-sm text-gray-500">Therapeutic classifications and storage requirements</p>
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <select
          value={storageFilter}
          onChange={(e) => setStorageFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Storage Types</option>
          <option value="room-temp">Room Temperature</option>
          <option value="cold-chain">Cold Chain</option>
          <option value="frozen">Frozen</option>
          <option value="controlled">Controlled Access</option>
        </select>
        <select
          value={controlFilter}
          onChange={(e) => setControlFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Substances</option>
          <option value="controlled">Controlled Substances</option>
          <option value="non-controlled">Non-Controlled</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
          <div className="text-sm text-gray-500">Total Categories</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            <span className="text-2xl font-bold text-red-600">
              {categories.filter((c) => c.controlSchedule).length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Controlled</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-bold text-blue-600">
              {categories.filter((c) => c.storageRequirement === 'cold-chain').length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Cold Chain</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-cyan-500" />
            <span className="text-2xl font-bold text-cyan-600">
              {categories.filter((c) => c.storageRequirement === 'frozen').length}
            </span>
          </div>
          <div className="text-sm text-gray-500">Frozen</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">
            {categories.reduce((sum, c) => sum + c.drugCount, 0)}
          </div>
          <div className="text-sm text-gray-500">Total Drugs</div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Therapeutic Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Control Schedule</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rx Required</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drugs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCategories.map((cat) => (
                <tr key={cat.id} className={`hover:bg-gray-50 ${!cat.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-indigo-600">{cat.code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {cat.parentCategory && (
                        <>
                          <span className="text-sm text-gray-400">{cat.parentCategory}</span>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                        </>
                      )}
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">{cat.therapeuticClass}</span>
                  </td>
                  <td className="px-4 py-3">
                    {cat.controlSchedule ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-red-600">
                        <Shield className="w-4 h-4" />
                        {cat.controlSchedule}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStorageBadge(cat.storageRequirement)}`}>
                        {getStorageIcon(cat.storageRequirement)}
                        {getStorageLabel(cat.storageRequirement)}
                      </span>
                      {cat.specialHandling && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {cat.specialHandling.substring(0, 35)}...
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {cat.prescriptionRequired ? (
                      <span className="flex items-center gap-1 text-sm text-amber-600">
                        <FileText className="w-4 h-4" />
                        Required
                      </span>
                    ) : (
                      <span className="text-sm text-green-600">OTC</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">{cat.drugCount}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(cat)}
                        className="p-1 text-gray-400 hover:text-indigo-600"
                        title="Edit category"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(cat.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Add New Category</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., AB"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Antibiotics"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
                <input
                  type="text"
                  value={formData.parentCategory || ''}
                  onChange={(e) => setFormData({ ...formData, parentCategory: e.target.value })}
                  placeholder="e.g., Analgesics (optional)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Therapeutic Class *</label>
                <input
                  type="text"
                  value={formData.therapeuticClass || ''}
                  onChange={(e) => setFormData({ ...formData, therapeuticClass: e.target.value })}
                  placeholder="e.g., Anti-Infectives"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Control Schedule</label>
                  <select
                    value={formData.controlSchedule || ''}
                    onChange={(e) => setFormData({ ...formData, controlSchedule: e.target.value || undefined })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None</option>
                    <option value="Schedule I">Schedule I</option>
                    <option value="Schedule II">Schedule II</option>
                    <option value="Schedule III">Schedule III</option>
                    <option value="Schedule IV">Schedule IV</option>
                    <option value="Schedule V">Schedule V</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Storage Requirement</label>
                  <select
                    value={formData.storageRequirement || 'room-temp'}
                    onChange={(e) => setFormData({ ...formData, storageRequirement: e.target.value as DrugCategory['storageRequirement'] })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="room-temp">Room Temperature</option>
                    <option value="cold-chain">Cold Chain (2-8°C)</option>
                    <option value="frozen">Frozen (-20°C)</option>
                    <option value="controlled">Controlled Access</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Handling</label>
                <textarea
                  value={formData.specialHandling || ''}
                  onChange={(e) => setFormData({ ...formData, specialHandling: e.target.value })}
                  placeholder="e.g., Double-lock cabinet, witness for waste"
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.prescriptionRequired ?? true}
                    onChange={(e) => setFormData({ ...formData, prescriptionRequired: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Prescription Required</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive ?? true}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setFormData({});
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdd}
                disabled={!formData.code || !formData.name || !formData.therapeuticClass}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditModal && editingCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Edit Category</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                  <input
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
                <input
                  type="text"
                  value={formData.parentCategory || ''}
                  onChange={(e) => setFormData({ ...formData, parentCategory: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Therapeutic Class *</label>
                <input
                  type="text"
                  value={formData.therapeuticClass || ''}
                  onChange={(e) => setFormData({ ...formData, therapeuticClass: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Control Schedule</label>
                  <select
                    value={formData.controlSchedule || ''}
                    onChange={(e) => setFormData({ ...formData, controlSchedule: e.target.value || undefined })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None</option>
                    <option value="Schedule I">Schedule I</option>
                    <option value="Schedule II">Schedule II</option>
                    <option value="Schedule III">Schedule III</option>
                    <option value="Schedule IV">Schedule IV</option>
                    <option value="Schedule V">Schedule V</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Storage Requirement</label>
                  <select
                    value={formData.storageRequirement || 'room-temp'}
                    onChange={(e) => setFormData({ ...formData, storageRequirement: e.target.value as DrugCategory['storageRequirement'] })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="room-temp">Room Temperature</option>
                    <option value="cold-chain">Cold Chain (2-8°C)</option>
                    <option value="frozen">Frozen (-20°C)</option>
                    <option value="controlled">Controlled Access</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Handling</label>
                <textarea
                  value={formData.specialHandling || ''}
                  onChange={(e) => setFormData({ ...formData, specialHandling: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.prescriptionRequired ?? true}
                    onChange={(e) => setFormData({ ...formData, prescriptionRequired: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Prescription Required</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive ?? true}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCategory(null);
                  setFormData({});
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!formData.code || !formData.name || !formData.therapeuticClass}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-sm m-4">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Delete Category</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-700">
                Are you sure you want to delete this category? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}