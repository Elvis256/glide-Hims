import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Power,
  Download,
  Filter,
  Layers,
  FlaskConical,
  DollarSign,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Copy,
  Percent,
} from 'lucide-react';

interface LabTest {
  id: string;
  code: string;
  name: string;
  price: number;
}

interface LabPanel {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  tests: LabTest[];
  panelPrice: number;
  isActive: boolean;
}

const mockPanels: LabPanel[] = [
  {
    id: '1',
    code: 'PNL001',
    name: 'Liver Function Test (LFT)',
    category: 'Biochemistry',
    description: 'Comprehensive liver health assessment',
    tests: [
      { id: 't1', code: 'ALT001', name: 'ALT (SGPT)', price: 200 },
      { id: 't2', code: 'AST001', name: 'AST (SGOT)', price: 200 },
      { id: 't3', code: 'ALP001', name: 'Alkaline Phosphatase', price: 200 },
      { id: 't4', code: 'BIL001', name: 'Total Bilirubin', price: 150 },
      { id: 't5', code: 'BIL002', name: 'Direct Bilirubin', price: 150 },
      { id: 't6', code: 'ALB001', name: 'Albumin', price: 180 },
      { id: 't7', code: 'TPR001', name: 'Total Protein', price: 150 },
    ],
    panelPrice: 800,
    isActive: true,
  },
  {
    id: '2',
    code: 'PNL002',
    name: 'Renal Function Test (RFT)',
    category: 'Biochemistry',
    description: 'Kidney function evaluation',
    tests: [
      { id: 't8', code: 'BUN001', name: 'Blood Urea Nitrogen', price: 150 },
      { id: 't9', code: 'CRE001', name: 'Creatinine', price: 180 },
      { id: 't10', code: 'UA001', name: 'Uric Acid', price: 180 },
      { id: 't11', code: 'NA001', name: 'Sodium', price: 150 },
      { id: 't12', code: 'K001', name: 'Potassium', price: 150 },
      { id: 't13', code: 'CL001', name: 'Chloride', price: 150 },
    ],
    panelPrice: 700,
    isActive: true,
  },
  {
    id: '3',
    code: 'PNL003',
    name: 'Lipid Profile',
    category: 'Biochemistry',
    description: 'Cardiovascular risk assessment',
    tests: [
      { id: 't14', code: 'TC001', name: 'Total Cholesterol', price: 200 },
      { id: 't15', code: 'TG001', name: 'Triglycerides', price: 200 },
      { id: 't16', code: 'HDL001', name: 'HDL Cholesterol', price: 200 },
      { id: 't17', code: 'LDL001', name: 'LDL Cholesterol', price: 200 },
      { id: 't18', code: 'VLDL001', name: 'VLDL Cholesterol', price: 150 },
    ],
    panelPrice: 800,
    isActive: true,
  },
  {
    id: '4',
    code: 'PNL004',
    name: 'Thyroid Profile',
    category: 'Immunology',
    description: 'Thyroid function assessment',
    tests: [
      { id: 't19', code: 'T3001', name: 'T3 (Triiodothyronine)', price: 350 },
      { id: 't20', code: 'T4001', name: 'T4 (Thyroxine)', price: 350 },
      { id: 't21', code: 'TSH001', name: 'TSH', price: 400 },
    ],
    panelPrice: 1000,
    isActive: true,
  },
  {
    id: '5',
    code: 'PNL005',
    name: 'Complete Blood Count (CBC)',
    category: 'Hematology',
    description: 'Full blood cell analysis',
    tests: [
      { id: 't22', code: 'HB001', name: 'Hemoglobin', price: 100 },
      { id: 't23', code: 'HCT001', name: 'Hematocrit', price: 80 },
      { id: 't24', code: 'RBC001', name: 'RBC Count', price: 80 },
      { id: 't25', code: 'WBC001', name: 'WBC Count', price: 80 },
      { id: 't26', code: 'PLT001', name: 'Platelet Count', price: 80 },
      { id: 't27', code: 'MCV001', name: 'MCV', price: 50 },
      { id: 't28', code: 'MCH001', name: 'MCH', price: 50 },
      { id: 't29', code: 'MCHC001', name: 'MCHC', price: 50 },
    ],
    panelPrice: 350,
    isActive: true,
  },
  {
    id: '6',
    code: 'PNL006',
    name: 'Diabetes Panel',
    category: 'Biochemistry',
    description: 'Diabetes monitoring and diagnosis',
    tests: [
      { id: 't30', code: 'FBS001', name: 'Fasting Blood Sugar', price: 150 },
      { id: 't31', code: 'HBA001', name: 'HbA1c', price: 600 },
      { id: 't32', code: 'FI001', name: 'Fasting Insulin', price: 500 },
    ],
    panelPrice: 1100,
    isActive: true,
  },
  {
    id: '7',
    code: 'PNL007',
    name: 'Anemia Profile',
    category: 'Hematology',
    description: 'Comprehensive anemia workup',
    tests: [
      { id: 't33', code: 'FE001', name: 'Serum Iron', price: 250 },
      { id: 't34', code: 'TIBC001', name: 'TIBC', price: 300 },
      { id: 't35', code: 'FER001', name: 'Ferritin', price: 400 },
      { id: 't36', code: 'B12001', name: 'Vitamin B12', price: 800 },
      { id: 't37', code: 'FOL001', name: 'Folate', price: 600 },
    ],
    panelPrice: 2000,
    isActive: true,
  },
  {
    id: '8',
    code: 'PNL008',
    name: 'Cardiac Markers',
    category: 'Immunology',
    description: 'Heart attack and cardiac risk markers',
    tests: [
      { id: 't38', code: 'TRO001', name: 'Troponin I', price: 800 },
      { id: 't39', code: 'CK001', name: 'CK-MB', price: 400 },
      { id: 't40', code: 'BNP001', name: 'NT-proBNP', price: 1500 },
    ],
    panelPrice: 2400,
    isActive: false,
  },
];

const categories = ['All', 'Hematology', 'Biochemistry', 'Immunology'];

export default function LabPanelsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [panels, setPanels] = useState<LabPanel[]>(mockPanels);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());

  const filteredPanels = useMemo(() => {
    return panels.filter(panel => {
      const matchesSearch = panel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        panel.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || panel.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [panels, searchTerm, selectedCategory]);

  const togglePanelStatus = (id: string) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
  };

  const toggleExpanded = (id: string) => {
    setExpandedPanels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const calculateIndividualTotal = (tests: LabTest[]) => {
    return tests.reduce((sum, test) => sum + test.price, 0);
  };

  const calculateSavings = (panel: LabPanel) => {
    const individualTotal = calculateIndividualTotal(panel.tests);
    const savings = individualTotal - panel.panelPrice;
    const percentage = Math.round((savings / individualTotal) * 100);
    return { savings, percentage };
  };

  const stats = useMemo(() => ({
    total: panels.length,
    active: panels.filter(p => p.isActive).length,
    inactive: panels.filter(p => !p.isActive).length,
    avgSavings: Math.round(panels.reduce((acc, p) => acc + calculateSavings(p).percentage, 0) / panels.length),
  }), [panels]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Test Panels</h1>
            <p className="text-sm text-gray-500">Manage test panels and profiles with bundled pricing</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create Panel
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total Panels:</span>
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
            <Percent className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-500">Avg Savings:</span>
            <span className="font-semibold text-green-600">{stats.avgSavings}%</span>
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
              placeholder="Search by panel name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            {categories.map(cat => (
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

      {/* Panels List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-4">
          {filteredPanels.map(panel => {
            const isExpanded = expandedPanels.has(panel.id);
            const individualTotal = calculateIndividualTotal(panel.tests);
            const { savings, percentage } = calculateSavings(panel);
            
            return (
              <div 
                key={panel.id} 
                className={`bg-white rounded-lg border ${!panel.isActive ? 'opacity-60' : ''}`}
              >
                {/* Panel Header */}
                <div 
                  className="flex items-center justify-between px-4 py-3 cursor-pointer"
                  onClick={() => toggleExpanded(panel.id)}
                >
                  <div className="flex items-center gap-4">
                    <button className="p-1 text-gray-400 hover:text-gray-600">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{panel.code}</code>
                        <span className="font-semibold text-gray-900">{panel.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          panel.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {panel.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{panel.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 line-through">KES {individualTotal.toLocaleString()}</span>
                        <span className="font-bold text-lg text-gray-900">KES {panel.panelPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          <DollarSign className="w-3 h-3" />
                          Save KES {savings.toLocaleString()} ({percentage}%)
                        </span>
                        <span className="text-xs text-gray-500">{panel.tests.length} tests</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded" title="Duplicate">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => togglePanelStatus(panel.id)}
                        className={`p-1.5 rounded ${
                          panel.isActive
                            ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={panel.isActive ? 'Disable' : 'Enable'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Tests List */}
                {isExpanded && (
                  <div className="border-t px-4 py-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                      <FlaskConical className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Included Tests</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {panel.tests.map(test => (
                        <div 
                          key={test.id}
                          className="flex items-center justify-between px-3 py-2 bg-white border rounded"
                        >
                          <div>
                            <code className="text-xs text-gray-500">{test.code}</code>
                            <p className="text-sm text-gray-800">{test.name}</p>
                          </div>
                          <span className="text-xs text-gray-500">KES {test.price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-sm text-gray-500">
                        Individual Total: <span className="font-medium text-gray-700">KES {individualTotal.toLocaleString()}</span>
                      </span>
                      <span className="text-sm text-gray-500">
                        Panel Price: <span className="font-semibold text-green-600">KES {panel.panelPrice.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
