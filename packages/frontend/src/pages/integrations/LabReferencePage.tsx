import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  TestTube,
  Loader2,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Filter,
  Calculator,
} from 'lucide-react';
import { integrationsService, type LabTestReference } from '../../../services/integrations';

export default function LabReferencePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTest, setSelectedTest] = useState<LabTestReference | null>(null);
  const [valueToCheck, setValueToCheck] = useState('');
  const [checkResult, setCheckResult] = useState<{
    status: string;
    referenceRange?: { low?: number; high?: number };
  } | null>(null);

  // Get categories
  const { data: categories } = useQuery({
    queryKey: ['lab-categories'],
    queryFn: () => integrationsService.getLabCategories(),
  });

  // Get lab tests
  const { data: labTests, isLoading } = useQuery({
    queryKey: ['lab-tests', selectedCategory],
    queryFn: () => integrationsService.getCommonLabTests(selectedCategory || undefined),
  });

  // Filter by search
  const filteredTests = labTests?.data.filter(test =>
    searchQuery === '' ||
    test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    test.code.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleCheckValue = async () => {
    if (!selectedTest || !valueToCheck) return;
    
    try {
      const result = await integrationsService.checkLabValue(selectedTest.code, parseFloat(valueToCheck));
      setCheckResult(result);
    } catch (error) {
      console.error('Failed to check value');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-700 border-green-300';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'high': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'critical-low':
      case 'critical-high': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'low': return <ArrowDown className="w-5 h-5 text-blue-600" />;
      case 'high': return <ArrowUp className="w-5 h-5 text-yellow-600" />;
      case 'critical-low':
      case 'critical-high': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return <AlertTriangle className="w-5 h-5 text-gray-600" />;
    }
  };

  const categoryColors: Record<string, string> = {
    'Hematology': 'bg-red-100 text-red-700',
    'Chemistry': 'bg-blue-100 text-blue-700',
    'Electrolytes': 'bg-purple-100 text-purple-700',
    'Lipid Panel': 'bg-yellow-100 text-yellow-700',
    'Infectious': 'bg-green-100 text-green-700',
    'Urinalysis': 'bg-orange-100 text-orange-700',
    'Thyroid': 'bg-pink-100 text-pink-700',
    'Coagulation': 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <TestTube className="w-7 h-7 text-purple-600" />
          Lab Test Reference (LOINC)
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Standard lab test codes with reference ranges • Used worldwide for lab result standardization
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Search & Filter */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search lab tests by name or LOINC code..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 appearance-none bg-white"
                >
                  <option value="">All Categories</option>
                  {categories?.data.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedCategory === '' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({labTests?.count || 0})
            </button>
            {categories?.data.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white'
                    : categoryColors[cat] || 'bg-gray-100 text-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lab Tests Grid */}
          <div className="bg-white rounded-lg shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOINC Code</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specimen</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference Range</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTests.map((test) => (
                      <tr
                        key={test.code}
                        onClick={() => {
                          setSelectedTest(test);
                          setValueToCheck('');
                          setCheckResult(null);
                        }}
                        className={`hover:bg-purple-50 cursor-pointer transition-colors ${
                          selectedTest?.code === test.code ? 'bg-purple-100' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-sm text-purple-600 font-medium">
                          {test.code}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 font-medium">
                          {test.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {test.specimen}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {test.units}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {test.referenceRange?.text ? (
                            <span className="text-gray-600">{test.referenceRange.text}</span>
                          ) : test.referenceRange?.low !== undefined || test.referenceRange?.high !== undefined ? (
                            <span className="font-medium">
                              {test.referenceRange.low ?? '—'} - {test.referenceRange.high ?? '—'}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${categoryColors[test.category] || 'bg-gray-100'}`}>
                            {test.category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Value Checker */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-purple-600" />
              Value Checker
            </h3>

            {selectedTest ? (
              <div className="space-y-4">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="font-mono text-sm text-purple-600">{selectedTest.code}</p>
                  <p className="font-medium text-gray-800">{selectedTest.name}</p>
                  <p className="text-sm text-gray-500">Units: {selectedTest.units}</p>
                </div>

                {selectedTest.referenceRange && (
                  <div className="text-sm">
                    <p className="text-gray-600">
                      Reference: {' '}
                      {selectedTest.referenceRange.text || (
                        <>
                          <span className="font-medium">
                            {selectedTest.referenceRange.low ?? '—'} - {selectedTest.referenceRange.high ?? '—'}
                          </span>
                          <span className="text-gray-400 ml-1">{selectedTest.units}</span>
                        </>
                      )}
                    </p>
                    {selectedTest.criticalRange && (
                      <p className="text-red-600 mt-1">
                        Critical: {selectedTest.criticalRange.low ?? '—'} - {selectedTest.criticalRange.high ?? '—'} {selectedTest.units}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter Value
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={valueToCheck}
                      onChange={(e) => setValueToCheck(e.target.value)}
                      placeholder="e.g., 12.5"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleCheckValue}
                      disabled={!valueToCheck}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      Check
                    </button>
                  </div>
                </div>

                {checkResult && (
                  <div className={`p-4 rounded-lg border-2 ${getStatusColor(checkResult.status)}`}>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(checkResult.status)}
                      <span className="font-bold uppercase">{checkResult.status.replace('-', ' ')}</span>
                    </div>
                    <p className="text-sm mt-2">
                      Value: <span className="font-bold">{valueToCheck} {selectedTest.units}</span>
                    </p>
                    {checkResult.referenceRange && (
                      <p className="text-sm">
                        Normal Range: {checkResult.referenceRange.low ?? '—'} - {checkResult.referenceRange.high ?? '—'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <TestTube className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Select a test from the table</p>
                <p className="text-sm">to check a value</p>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h4 className="font-medium text-gray-800 mb-3">Quick Reference</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Normal - Within reference range</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Low - Below reference range</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>High - Above reference range</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Critical - Requires immediate attention</span>
              </div>
            </div>
          </div>

          {/* Common Uganda Tests */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h4 className="font-medium text-gray-800 mb-3">Common in Uganda</h4>
            <div className="flex flex-wrap gap-2">
              {['Malaria', 'HIV', 'Typhoid', 'Hemoglobin', 'Blood Glucose'].map((test) => (
                <button
                  key={test}
                  onClick={() => setSearchQuery(test)}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  {test}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
