import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Loader2,
  AlertTriangle,
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

// Empty data - API integration pending (no panels endpoint available in lab service)
const samplePanels: LabPanel[] = [];

const categories = ['All', 'Hematology', 'Biochemistry', 'Immunology'];

// NOTE: Lab panels API is not yet available in the backend.
// This page displays sample data until the panels endpoint is implemented.
const API_NOT_AVAILABLE = true;

export default function LabPanelsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [panels, setPanels] = useState<LabPanel[]>(samplePanels);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());

  // Query client for future API integration
  const queryClient = useQueryClient();

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
    avgSavings: panels.length > 0 ? Math.round(panels.reduce((acc, p) => acc + calculateSavings(p).percentage, 0) / panels.length) : 0,
  }), [panels]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* API Not Available Banner */}
      {API_NOT_AVAILABLE && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              Lab Panels API is not yet available. Displaying sample data for preview purposes.
            </span>
          </div>
        </div>
      )}
      
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
        {filteredPanels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border">
            <Layers className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Panels Found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {panels.length === 0 
                ? 'Get started by creating your first test panel.' 
                : 'No panels match your search criteria.'}
            </p>
            {panels.length === 0 && (
              <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                Create Panel
              </button>
            )}
          </div>
        ) : (
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
        )}
      </div>
    </div>
  );
}
