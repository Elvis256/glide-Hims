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
} from 'lucide-react';
import { labService, type LabTest as APILabTest } from '../../../services';

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

const mockTests: LabTest[] = [
  { id: '1', code: 'CBC001', name: 'Complete Blood Count', category: 'Hematology', sampleType: 'EDTA Blood', normalRange: 'Multiple', unit: 'Various', ageGenderNotes: 'Age-specific ranges', turnaroundTime: '2 hours', price: 350, cost: 120, isActive: true },
  { id: '2', code: 'LFT001', name: 'Liver Function Test', category: 'Biochemistry', sampleType: 'Serum', normalRange: 'Multiple', unit: 'Various', ageGenderNotes: 'Adult values', turnaroundTime: '4 hours', price: 800, cost: 250, isActive: true },
  { id: '3', code: 'RFT001', name: 'Renal Function Test', category: 'Biochemistry', sampleType: 'Serum', normalRange: 'Multiple', unit: 'Various', ageGenderNotes: 'Age-specific', turnaroundTime: '4 hours', price: 700, cost: 200, isActive: true },
  { id: '4', code: 'GLU001', name: 'Fasting Blood Glucose', category: 'Biochemistry', sampleType: 'Fluoride Blood', normalRange: '70-100', unit: 'mg/dL', ageGenderNotes: 'Adult values', turnaroundTime: '1 hour', price: 150, cost: 40, isActive: true },
  { id: '5', code: 'HBA001', name: 'HbA1c', category: 'Biochemistry', sampleType: 'EDTA Blood', normalRange: '4.0-5.6', unit: '%', ageGenderNotes: 'Adults only', turnaroundTime: '4 hours', price: 600, cost: 180, isActive: true },
  { id: '6', code: 'LIP001', name: 'Lipid Profile', category: 'Biochemistry', sampleType: 'Serum (Fasting)', normalRange: 'Multiple', unit: 'mg/dL', ageGenderNotes: 'Fasting 12hrs required', turnaroundTime: '4 hours', price: 800, cost: 220, isActive: true },
  { id: '7', code: 'THY001', name: 'Thyroid Profile (T3, T4, TSH)', category: 'Immunology', sampleType: 'Serum', normalRange: 'Multiple', unit: 'Various', ageGenderNotes: 'Pregnancy-specific ranges', turnaroundTime: '6 hours', price: 1200, cost: 400, isActive: true },
  { id: '8', code: 'URI001', name: 'Urine Routine', category: 'Clinical Pathology', sampleType: 'Urine', normalRange: 'N/A', unit: 'Various', ageGenderNotes: 'Mid-stream sample', turnaroundTime: '1 hour', price: 200, cost: 50, isActive: true },
  { id: '9', code: 'CUL001', name: 'Blood Culture', category: 'Microbiology', sampleType: 'Blood (Sterile)', normalRange: 'No Growth', unit: 'N/A', ageGenderNotes: 'Collect before antibiotics', turnaroundTime: '48-72 hours', price: 1500, cost: 500, isActive: true },
  { id: '10', code: 'ESR001', name: 'ESR', category: 'Hematology', sampleType: 'EDTA Blood', normalRange: 'M: 0-15, F: 0-20', unit: 'mm/hr', ageGenderNotes: 'Gender-specific', turnaroundTime: '1 hour', price: 100, cost: 25, isActive: false },
  { id: '11', code: 'CRP001', name: 'C-Reactive Protein', category: 'Immunology', sampleType: 'Serum', normalRange: '<6', unit: 'mg/L', ageGenderNotes: 'Inflammation marker', turnaroundTime: '2 hours', price: 450, cost: 130, isActive: true },
  { id: '12', code: 'VIT001', name: 'Vitamin D (25-OH)', category: 'Biochemistry', sampleType: 'Serum', normalRange: '30-100', unit: 'ng/mL', ageGenderNotes: 'Seasonal variation', turnaroundTime: '24 hours', price: 1800, cost: 600, isActive: true },
];

const categories = ['All', 'Hematology', 'Biochemistry', 'Immunology', 'Microbiology', 'Clinical Pathology'];

const sampleTypes = ['All', 'EDTA Blood', 'Serum', 'Urine', 'Fluoride Blood'];

export default function TestCatalogPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSampleType, setSelectedSampleType] = useState('All');

  // Fetch lab tests from API
  const { data: apiTests, isLoading } = useQuery({
    queryKey: ['lab-tests'],
    queryFn: () => labService.tests.list(),
    staleTime: 60000,
  });

  // Transform API data to local format with fallback to mock
  const tests: LabTest[] = useMemo(() => {
    if (!apiTests) return [];
    return apiTests.map((t: APILabTest) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      category: t.category,
      sampleType: t.sampleType || 'Serum',
      normalRange: t.normalRange || 'N/A',
      unit: t.unit || 'N/A',
      ageGenderNotes: 'Standard ranges',
      turnaroundTime: t.turnaroundTime || '4 hours',
      price: t.price,
      cost: t.cost || Math.round(t.price * 0.35),
      isActive: t.isActive !== false,
    }));
  }, [apiTests]);

  // Toggle test status mutation
  const toggleMutation = useMutation({
    mutationFn: (id: string) => labService.tests.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-tests'] });
    },
  });

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
    avgMargin: Math.round(tests.reduce((acc, t) => acc + ((t.price - t.cost) / t.price * 100), 0) / tests.length),
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
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
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
                <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
              ))}
            </select>
            <select
              value={selectedSampleType}
              onChange={(e) => setSelectedSampleType(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sampleTypes.map(type => (
                <option key={type} value={type}>{type === 'All' ? 'All Sample Types' : type}</option>
              ))}
            </select>
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
              {filteredTests.map(test => (
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
                      {test.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <Droplets className="w-3 h-3 text-red-400" />
                      {test.sampleType}
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
                  <td className="px-4 py-3 text-right font-medium text-gray-900">KES {test.price.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">KES {test.cost.toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      test.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {test.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
