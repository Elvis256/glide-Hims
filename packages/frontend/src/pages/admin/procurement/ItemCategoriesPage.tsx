import { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  FolderTree,
  Receipt,
  Percent,
  GitBranch,
  Settings,
  MoreVertical,
  Check,
  X,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  level: number;
  glAccount: string;
  glAccountName: string;
  taxApplicable: boolean;
  taxRate: number;
  approvalRoute: string;
  itemCount: number;
  isActive: boolean;
  children?: Category[];
}

const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Medical Supplies',
    code: 'MED',
    parentId: null,
    level: 0,
    glAccount: '5100-100',
    glAccountName: 'Medical Supplies Expense',
    taxApplicable: false,
    taxRate: 0,
    approvalRoute: 'Medical Director',
    itemCount: 450,
    isActive: true,
    children: [
      { id: '1-1', name: 'Consumables', code: 'MED-CON', parentId: '1', level: 1, glAccount: '5100-110', glAccountName: 'Medical Consumables', taxApplicable: false, taxRate: 0, approvalRoute: 'Nursing Head', itemCount: 280, isActive: true },
      { id: '1-2', name: 'Surgical Supplies', code: 'MED-SUR', parentId: '1', level: 1, glAccount: '5100-120', glAccountName: 'Surgical Supplies', taxApplicable: false, taxRate: 0, approvalRoute: 'Medical Director', itemCount: 120, isActive: true },
      { id: '1-3', name: 'Diagnostic Supplies', code: 'MED-DIA', parentId: '1', level: 1, glAccount: '5100-130', glAccountName: 'Diagnostic Supplies', taxApplicable: false, taxRate: 0, approvalRoute: 'Lab Manager', itemCount: 50, isActive: true },
    ],
  },
  {
    id: '2',
    name: 'Pharmaceuticals',
    code: 'PHR',
    parentId: null,
    level: 0,
    glAccount: '5200-100',
    glAccountName: 'Pharmaceutical Expense',
    taxApplicable: false,
    taxRate: 0,
    approvalRoute: 'Pharmacy Head',
    itemCount: 850,
    isActive: true,
    children: [
      { id: '2-1', name: 'Prescription Drugs', code: 'PHR-RX', parentId: '2', level: 1, glAccount: '5200-110', glAccountName: 'Prescription Drugs', taxApplicable: false, taxRate: 0, approvalRoute: 'Pharmacy Head', itemCount: 500, isActive: true },
      { id: '2-2', name: 'OTC Medications', code: 'PHR-OTC', parentId: '2', level: 1, glAccount: '5200-120', glAccountName: 'OTC Medications', taxApplicable: false, taxRate: 0, approvalRoute: 'Pharmacy Head', itemCount: 200, isActive: true },
      { id: '2-3', name: 'Controlled Substances', code: 'PHR-CS', parentId: '2', level: 1, glAccount: '5200-130', glAccountName: 'Controlled Substances', taxApplicable: false, taxRate: 0, approvalRoute: 'Medical Director + Pharmacy', itemCount: 150, isActive: true },
    ],
  },
  {
    id: '3',
    name: 'Laboratory',
    code: 'LAB',
    parentId: null,
    level: 0,
    glAccount: '5300-100',
    glAccountName: 'Laboratory Expense',
    taxApplicable: true,
    taxRate: 16,
    approvalRoute: 'Lab Manager',
    itemCount: 320,
    isActive: true,
    children: [
      { id: '3-1', name: 'Reagents', code: 'LAB-REA', parentId: '3', level: 1, glAccount: '5300-110', glAccountName: 'Laboratory Reagents', taxApplicable: true, taxRate: 16, approvalRoute: 'Lab Manager', itemCount: 180, isActive: true },
      { id: '3-2', name: 'Lab Consumables', code: 'LAB-CON', parentId: '3', level: 1, glAccount: '5300-120', glAccountName: 'Lab Consumables', taxApplicable: true, taxRate: 16, approvalRoute: 'Lab Manager', itemCount: 140, isActive: true },
    ],
  },
  {
    id: '4',
    name: 'Equipment',
    code: 'EQP',
    parentId: null,
    level: 0,
    glAccount: '1500-100',
    glAccountName: 'Equipment Asset',
    taxApplicable: true,
    taxRate: 16,
    approvalRoute: 'Finance + Department Head',
    itemCount: 85,
    isActive: true,
    children: [
      { id: '4-1', name: 'Medical Equipment', code: 'EQP-MED', parentId: '4', level: 1, glAccount: '1500-110', glAccountName: 'Medical Equipment', taxApplicable: true, taxRate: 16, approvalRoute: 'Medical Director + Finance', itemCount: 45, isActive: true },
      { id: '4-2', name: 'Office Equipment', code: 'EQP-OFF', parentId: '4', level: 1, glAccount: '1500-120', glAccountName: 'Office Equipment', taxApplicable: true, taxRate: 16, approvalRoute: 'Admin Manager', itemCount: 25, isActive: true },
      { id: '4-3', name: 'IT Equipment', code: 'EQP-IT', parentId: '4', level: 1, glAccount: '1500-130', glAccountName: 'IT Equipment', taxApplicable: true, taxRate: 16, approvalRoute: 'IT Manager', itemCount: 15, isActive: true },
    ],
  },
  {
    id: '5',
    name: 'Office Supplies',
    code: 'OFF',
    parentId: null,
    level: 0,
    glAccount: '5400-100',
    glAccountName: 'Office Supplies Expense',
    taxApplicable: true,
    taxRate: 16,
    approvalRoute: 'Department Head',
    itemCount: 120,
    isActive: true,
  },
  {
    id: '6',
    name: 'Maintenance',
    code: 'MNT',
    parentId: null,
    level: 0,
    glAccount: '5500-100',
    glAccountName: 'Maintenance Expense',
    taxApplicable: true,
    taxRate: 16,
    approvalRoute: 'Maintenance Manager',
    itemCount: 75,
    isActive: true,
  },
];

export default function ItemCategoriesPage() {
  const [categories] = useState(mockCategories);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['1', '2', '3', '4']);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const allCategories = categories.flatMap(c => [c, ...(c.children || [])]);
    return {
      totalCategories: allCategories.length,
      parentCategories: categories.length,
      totalItems: allCategories.reduce((sum, c) => sum + c.itemCount, 0),
      taxableCategories: allCategories.filter(c => c.taxApplicable).length,
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
      c.children?.some(child =>
        child.name.toLowerCase().includes(searchLower) ||
        child.code.toLowerCase().includes(searchLower)
      )
    );
  }, [categories, searchTerm]);

  const renderCategory = (category: Category, depth: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedCategories.includes(category.id);
    const isEditing = editingId === category.id;

    return (
      <div key={category.id}>
        <div
          className={`flex items-center gap-2 px-4 py-3 border-b hover:bg-gray-50 cursor-pointer ${
            selectedCategory?.id === category.id ? 'bg-orange-50' : ''
          }`}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
          onClick={() => setSelectedCategory(category)}
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

          <div className="text-sm text-gray-500 w-24 text-right">{category.itemCount} items</div>

          <div className="text-sm text-gray-600 w-28">{category.glAccount}</div>

          <div className="w-20 text-center">
            {category.taxApplicable ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                <Percent className="w-3 h-3" />
                {category.taxRate}%
              </span>
            ) : (
              <span className="text-xs text-gray-400">Exempt</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setEditingId(category.id); }}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {category.children!.map(child => renderCategory(child, depth + 1))}
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
              <p className="text-sm text-gray-500">Manage product categories and GL mappings</p>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
            <Plus className="w-4 h-4" />
            New Category
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Total Categories</div>
            <div className="text-xl font-bold text-gray-900">{stats.totalCategories}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-orange-600">
              <FolderTree className="w-4 h-4" />
              Parent Categories
            </div>
            <div className="text-xl font-bold text-orange-700">{stats.parentCategories}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-blue-600">Total Items</div>
            <div className="text-xl font-bold text-blue-700">{stats.totalItems.toLocaleString()}</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-amber-600">
              <Percent className="w-4 h-4" />
              Taxable Categories
            </div>
            <div className="text-xl font-bold text-amber-700">{stats.taxableCategories}</div>
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
              <div className="w-24 text-right">Items</div>
              <div className="w-28">GL Account</div>
              <div className="w-20 text-center">Tax</div>
              <div className="w-20">Actions</div>
            </div>
          </div>
          {filteredCategories.map(category => renderCategory(category))}
        </div>

        {/* Details Panel */}
        {selectedCategory && (
          <div className="w-96 border-l bg-white flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Category Details</h3>
                <button
                  onClick={() => setSelectedCategory(null)}
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

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                  <Receipt className="w-4 h-4 text-gray-500" />
                  GL Account Mapping
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="font-mono text-blue-600">{selectedCategory.glAccount}</div>
                  <div className="text-sm text-gray-600">{selectedCategory.glAccountName}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                  <Percent className="w-4 h-4 text-gray-500" />
                  Tax Configuration
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tax Applicable</span>
                    {selectedCategory.taxApplicable ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  {selectedCategory.taxApplicable && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                      <span className="text-sm text-gray-600">Tax Rate</span>
                      <span className="font-medium text-amber-600">{selectedCategory.taxRate}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-3">
                  <GitBranch className="w-4 h-4 text-gray-500" />
                  Approval Routing
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-700">{selectedCategory.approvalRoute}</div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="font-medium text-gray-900">Items in Category</span>
                  <span className="text-blue-600">{selectedCategory.itemCount} items</span>
                </div>
                <button className="w-full text-center py-2 text-sm text-orange-600 hover:bg-orange-50 rounded-lg">
                  View All Items →
                </button>
              </div>
            </div>

            <div className="p-4 border-t flex gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                <Edit2 className="w-4 h-4" />
                Edit Category
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                <Settings className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
