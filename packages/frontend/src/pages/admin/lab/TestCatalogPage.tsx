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
  FlaskConical,
  Clock,
  Droplets,
  MoreHorizontal,
  DollarSign,
  Activity,
  Loader2,
  X,
} from 'lucide-react';
import { labService, type LabTest as APILabTest } from '../../../services';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';

interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  sampleType: string;
  normalRange: string;
  unit: string;
  ageGenderNotes: string;
  turnaroundTime: string;
  price: number;
  cost: number;
  isActive: boolean;
}

interface TestFormData {
  code: string;
  name: string;
  description: string;
  category: string;
  sampleType: string;
  turnaroundTimeMinutes: number;
  price: number;
  requiresFasting: boolean;
  specialInstructions: string;
}

const initialFormData: TestFormData = {
  code: '',
  name: '',
  description: '',
  category: 'chemistry',
  sampleType: 'serum',
  turnaroundTimeMinutes: 240,
  price: 0,
  requiresFasting: false,
  specialInstructions: '',
};

// Backend enum values (lowercase)
const categories = ['All', 'hematology', 'chemistry', 'microbiology', 'serology', 'urinalysis', 'parasitology', 'immunology', 'molecular', 'blood_bank', 'other'];
const categoryLabels: Record<string, string> = {
  hematology: 'Hematology',
  chemistry: 'Chemistry/Biochemistry',
  microbiology: 'Microbiology',
  serology: 'Serology',
  urinalysis: 'Urinalysis',
  parasitology: 'Parasitology',
  immunology: 'Immunology',
  molecular: 'Molecular',
  blood_bank: 'Blood Bank',
  other: 'Other',
};

const sampleTypes = ['All', 'blood', 'serum', 'plasma', 'urine', 'stool', 'sputum', 'csf', 'swab', 'tissue', 'other'];
const sampleTypeLabels: Record<string, string> = {
  blood: 'Blood (EDTA)',
  serum: 'Serum',
  plasma: 'Plasma',
  urine: 'Urine',
  stool: 'Stool',
  sputum: 'Sputum',
  csf: 'CSF',
  swab: 'Swab',
  tissue: 'Tissue',
  other: 'Other',
};

export default function TestCatalogPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSampleType, setSelectedSampleType] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTest | null>(null);
  const [formData, setFormData] = useState<TestFormData>(initialFormData);

  // Fetch lab tests from API
  const { data: apiTests, isLoading } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => labService.tests.list(),
    staleTime: 60000,
  });

  // Transform API data to local format
  const tests: LabTest[] = useMemo(() => {
    if (!apiTests) return [];
    return apiTests.map((t: APILabTest) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      category: t.category,
      sampleType: t.sampleType || 'serum',
      normalRange: t.referenceRanges?.[0] ? `${t.referenceRanges[0].normalMin || ''}-${t.referenceRanges[0].normalMax || ''}` : 'N/A',
      unit: t.referenceRanges?.[0]?.unit || 'N/A',
      ageGenderNotes: 'Standard ranges',
      turnaroundTime: t.turnaroundTimeMinutes ? `${Math.round(t.turnaroundTimeMinutes / 60)} hours` : '4 hours',
      price: t.price,
      cost: Math.round(t.price * 0.35),
      isActive: t.status !== 'inactive',
    }));
  }, [apiTests]);

  // Toggle test status mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => labService.tests.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
    },
  });

  // Create test mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<APILabTest>) => labService.tests.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
      closeModal();
    },
  });

  // Update test mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<APILabTest> }) => labService.tests.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
      closeModal();
    },
  });

  const openAddModal = () => {
    setEditingTest(null);
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (test: LabTest) => {
    setEditingTest(test);
    setFormData({
      code: test.code,
      name: test.name,
      description: '',
      category: test.category,
      sampleType: test.sampleType,
      turnaroundTimeMinutes: parseInt(test.turnaroundTime) * 60 || 240,
      price: test.price,
      requiresFasting: false,
      specialInstructions: '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTest(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const testData: Partial<APILabTest> = {
      code: formData.code,
      name: formData.name,
      description: formData.description || undefined,
      category: formData.category,
      sampleType: formData.sampleType,
      turnaroundTimeMinutes: formData.turnaroundTimeMinutes,
      price: formData.price,
      requiresFasting: formData.requiresFasting,
      specialInstructions: formData.specialInstructions || undefined,
    };

    if (editingTest) {
      updateMutation.mutate({ id: editingTest.id, data: testData });
    } else {
      createMutation.mutate(testData);
    }
  };

  const filteredTests = useMemo(() => {
    return tests.filter(test => {
      const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        test.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || test.category === selectedCategory;
      const matchesSampleType = selectedSampleType === 'All' || test.sampleType.includes(selectedSampleType);
      return matchesSearch && matchesCategory && matchesSampleType;
    });
  }, [tests, searchTerm, selectedCategory, selectedSampleType]);

  const toggleTestStatus = (id: string) => {
    toggleMutation.mutate(id);
  };

  const stats = useMemo(() => ({
    total: tests.length,
    active: tests.filter(t => t.isActive).length,
    inactive: tests.filter(t => !t.isActive).length,
    avgMargin: tests.length > 0 ? Math.round(tests.reduce((acc, t) => acc + ((t.price - t.cost) / t.price * 100), 0) / tests.length) : 0,
  }), [tests]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Test Catalog</h1>
            <p className="text-sm text-gray-500">Manage laboratory tests, pricing, and normal ranges</p>
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
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700" onClick={openAddModal}>
              <Plus className="w-4 h-4" />
              Add Test
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total Tests:</span>
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
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Avg Margin:</span>
            <span className="font-semibold text-blue-600">{stats.avgMargin}%</span>
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
              placeholder="Search by test name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : categoryLabels[cat] || cat}</option>
              ))}
            </select>
            <select
              value={selectedSampleType}
              onChange={(e) => setSelectedSampleType(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sampleTypes.map(type => (
                <option key={type} value={type}>{type === 'All' ? 'All Sample Types' : sampleTypeLabels[type] || type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-500">Loading tests...</span>
          </div>
        ) : (
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Test Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Sample Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Normal Range</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">TAT</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cost</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No Tests Found</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {tests.length === 0 
                        ? 'Get started by adding your first lab test.' 
                        : 'No tests match your search criteria.'}
                    </p>
                    {tests.length === 0 && (
                      <button 
                        onClick={openAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      >
                        <Plus className="w-4 h-4" />
                        Add Test
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
              filteredTests.map(test => (
                <tr key={test.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{test.code}</code>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="font-medium text-gray-900">{test.name}</span>
                      <p className="text-xs text-gray-500">{test.ageGenderNotes}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      <Activity className="w-3 h-3" />
                      {categoryLabels[test.category] || test.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <Droplets className="w-3 h-3 text-red-400" />
                      {sampleTypeLabels[test.sampleType] || test.sampleType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {test.normalRange} {test.unit !== 'Various' && test.unit !== 'N/A' && <span className="text-gray-400">{test.unit}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {test.turnaroundTime}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(test.price)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">{formatCurrency(test.cost)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      test.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {test.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit" onClick={() => openEditModal(test)}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleTestStatus(test.id)}
                        className={`p-1.5 rounded ${
                          test.isActive
                            ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={test.isActive ? 'Disable' : 'Enable'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingTest ? 'Edit Test' : 'Add New Test'}
              </h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional test description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sample Type</label>
                  <select
                    value={formData.sampleType}
                    onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {sampleTypes.filter(s => s !== 'All').map(type => (
                      <option key={type} value={type}>{sampleTypeLabels[type] || type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Turnaround Time (minutes)</label>
                  <input
                    type="number"
                    value={formData.turnaroundTimeMinutes}
                    onChange={(e) => setFormData({ ...formData, turnaroundTimeMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    placeholder="e.g., 240 for 4 hours"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ({CURRENCY_SYMBOL})</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                  <input
                    type="text"
                    value={formData.specialInstructions}
                    onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Collect in fasting state"
                  />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresFasting}
                      onChange={(e) => setFormData({ ...formData, requiresFasting: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Requires Fasting</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {editingTest ? 'Update Test' : 'Create Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
