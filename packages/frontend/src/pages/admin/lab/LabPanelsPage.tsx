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
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
import { toast } from 'sonner';
import api from '../../../services/api';
import { labService } from '../../../services/lab';
import type { LabTest } from '../../../services/lab';

interface PanelTest {
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
  tests: PanelTest[];
  panelPrice: number;
  isActive: boolean;
}

type ModalMode = 'create' | 'edit' | 'delete' | null;

const SETTINGS_KEY = 'lab_panels';
const QUERY_KEY = ['lab-panels-settings'];
const TESTS_QUERY_KEY = ['lab-tests-catalog'];

const categories = ['All', 'Hematology', 'Biochemistry', 'Immunology', 'Microbiology', 'Other'];
const panelCategories = categories.slice(1); // exclude 'All'

function generateCode(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) + '-' + Math.random().toString(36).substring(2, 5).toUpperCase();
}

const emptyForm = (): Omit<LabPanel, 'id'> => ({
  code: '',
  name: '',
  category: 'Hematology',
  description: '',
  tests: [],
  panelPrice: 0,
  isActive: true,
});

export default function LabPanelsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [activePanel, setActivePanel] = useState<LabPanel | null>(null);
  const [form, setForm] = useState<Omit<LabPanel, 'id'>>(emptyForm());
  const [testSearch, setTestSearch] = useState('');

  // Load panels from settings API
  const { data: panels = [], isLoading } = useQuery<LabPanel[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      try {
        const response = await api.get(`/settings?key=${SETTINGS_KEY}`);
        return (response.data?.value ?? []) as LabPanel[];
      } catch {
        return [];
      }
    },
  });

  // Load available tests from lab catalog
  const { data: availableTests = [] } = useQuery<LabTest[]>({
    queryKey: TESTS_QUERY_KEY,
    queryFn: () => labService.tests.list({ status: 'active' }),
  });

  // Save panels to settings API
  const saveMutation = useMutation({
    mutationFn: async (updated: LabPanel[]) => {
      await api.post('/settings', { key: SETTINGS_KEY, value: updated });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Panels saved');
    },
    onError: () => toast.error('Failed to save panels'),
  });

  const filteredPanels = useMemo(() => {
    return panels.filter(panel => {
      const matchesSearch = panel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        panel.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || panel.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [panels, searchTerm, selectedCategory]);

  const filteredAvailableTests = useMemo(() => {
    if (!testSearch) return availableTests;
    return availableTests.filter(t =>
      t.name.toLowerCase().includes(testSearch.toLowerCase()) ||
      t.code.toLowerCase().includes(testSearch.toLowerCase())
    );
  }, [availableTests, testSearch]);

  const toggleExpanded = (id: string) => {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const calculateIndividualTotal = (tests: PanelTest[]) => tests.reduce((sum, t) => sum + t.price, 0);

  const calculateSavings = (panel: LabPanel) => {
    const individualTotal = calculateIndividualTotal(panel.tests);
    if (individualTotal === 0) return { savings: 0, percentage: 0 };
    const savings = individualTotal - panel.panelPrice;
    const percentage = Math.round((savings / individualTotal) * 100);
    return { savings, percentage };
  };

  const stats = useMemo(() => ({
    total: panels.length,
    active: panels.filter(p => p.isActive).length,
    inactive: panels.filter(p => !p.isActive).length,
    avgSavings: panels.length > 0
      ? Math.round(panels.reduce((acc, p) => acc + calculateSavings(p).percentage, 0) / panels.length)
      : 0,
  }), [panels]);

  // Modal helpers
  const openCreate = () => { setForm(emptyForm()); setActivePanel(null); setModalMode('create'); setTestSearch(''); };
  const openEdit = (panel: LabPanel) => { setForm({ ...panel }); setActivePanel(panel); setModalMode('edit'); setTestSearch(''); };
  const openDelete = (panel: LabPanel) => { setActivePanel(panel); setModalMode('delete'); };
  const closeModal = () => { setModalMode(null); setActivePanel(null); };

  const toggleTestInForm = (test: LabTest) => {
    setForm(prev => {
      const exists = prev.tests.find(t => t.id === test.id);
      if (exists) {
        return { ...prev, tests: prev.tests.filter(t => t.id !== test.id) };
      }
      return {
        ...prev,
        tests: [...prev.tests, { id: test.id, code: test.code, name: test.name, price: test.price }],
      };
    });
  };

  const handleSavePanel = () => {
    if (!form.name.trim()) { toast.error('Panel name is required'); return; }
    if (form.tests.length === 0) { toast.error('Add at least one test'); return; }

    let updated: LabPanel[];
    if (modalMode === 'create') {
      const newPanel: LabPanel = { ...form, id: crypto.randomUUID(), code: generateCode(form.name) };
      updated = [...panels, newPanel];
    } else {
      updated = panels.map(p => p.id === activePanel!.id ? { ...form, id: activePanel!.id } : p);
    }
    saveMutation.mutate(updated, { onSuccess: closeModal });
  };

  const handleDeletePanel = () => {
    if (!activePanel) return;
    saveMutation.mutate(panels.filter(p => p.id !== activePanel.id), { onSuccess: closeModal });
  };

  const handleDuplicate = (panel: LabPanel) => {
    const copy: LabPanel = {
      ...panel,
      id: crypto.randomUUID(),
      name: `Copy of ${panel.name}`,
      code: generateCode(`Copy of ${panel.name}`),
    };
    saveMutation.mutate([...panels, copy]);
  };

  const handleToggleStatus = (panel: LabPanel) => {
    saveMutation.mutate(panels.map(p => p.id === panel.id ? { ...p, isActive: !p.isActive } : p));
  };

  const handleExport = () => {
    const csv = [
      ['Code', 'Name', 'Category', 'Tests', 'Panel Price', 'Individual Total', 'Status'].join(','),
      ...panels.map(p => [
        p.code, p.name, p.category, p.tests.length,
        p.panelPrice, calculateIndividualTotal(p.tests), p.isActive ? 'Active' : 'Inactive',
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lab_panels.csv'; a.click();
    URL.revokeObjectURL(url);
  };

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
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create Panel
            </button>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-500">Active:</span>
            <span className="font-semibold text-green-600">{stats.active}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full" />
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
              onChange={e => setSearchTerm(e.target.value)}
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
                  selectedCategory === cat ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredPanels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg border">
            <Layers className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Panels Found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {panels.length === 0 ? 'Get started by creating your first test panel.' : 'No panels match your search criteria.'}
            </p>
            {panels.length === 0 && (
              <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
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
                <div key={panel.id} className={`bg-white rounded-lg border ${!panel.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => toggleExpanded(panel.id)}>
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
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{panel.category}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{panel.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 line-through">{formatCurrency(individualTotal)}</span>
                          <span className="font-bold text-lg text-gray-900">{formatCurrency(panel.panelPrice)}</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                            <DollarSign className="w-3 h-3" />
                            Save {formatCurrency(savings)} ({percentage}%)
                          </span>
                          <span className="text-xs text-gray-500">{panel.tests.length} tests</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(panel)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDuplicate(panel)} className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded" title="Duplicate">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleToggleStatus(panel)} className={`p-1.5 rounded ${
                          panel.isActive ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                        }`} title={panel.isActive ? 'Disable' : 'Enable'}>
                          <Power className="w-4 h-4" />
                        </button>
                        <button onClick={() => openDelete(panel)} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-gray-50">
                      <div className="flex items-center gap-2 mb-3">
                        <FlaskConical className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Included Tests</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {panel.tests.map(test => (
                          <div key={test.id} className="flex items-center justify-between px-3 py-2 bg-white border rounded">
                            <div>
                              <code className="text-xs text-gray-500">{test.code}</code>
                              <p className="text-sm text-gray-800">{test.name}</p>
                            </div>
                            <span className="text-xs text-gray-500">{formatCurrency(test.price)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="text-sm text-gray-500">
                          Individual Total: <span className="font-medium text-gray-700">{formatCurrency(individualTotal)}</span>
                        </span>
                        <span className="text-sm text-gray-500">
                          Panel Price: <span className="font-semibold text-green-600">{formatCurrency(panel.panelPrice)}</span>
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

      {/* Create / Edit Modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900 text-lg">
                {modalMode === 'create' ? 'Create Panel' : 'Edit Panel'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Panel Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Basic Metabolic Panel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {panelCategories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Panel Price ({CURRENCY_SYMBOL})</label>
                  <input
                    type="number"
                    min={0}
                    value={form.panelPrice}
                    onChange={e => setForm(p => ({ ...p, panelPrice: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Panel description..."
                  />
                </div>
              </div>

              {/* Tests selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Tests ({form.tests.length} selected, est. cost: {formatCurrency(calculateIndividualTotal(form.tests))})
                  </label>
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search tests..."
                    value={testSearch}
                    onChange={e => setTestSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="border rounded-lg max-h-52 overflow-auto divide-y">
                  {filteredAvailableTests.length === 0 ? (
                    <p className="text-sm text-gray-500 p-3 text-center">No tests found</p>
                  ) : filteredAvailableTests.map(test => {
                    const selected = form.tests.some(t => t.id === test.id);
                    return (
                      <label key={test.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleTestInForm(test)}
                          className="rounded text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <code className="text-xs text-gray-500">{test.code}</code>
                          <span className="ml-2 text-sm text-gray-800">{test.name}</span>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">{formatCurrency(test.price)}</span>
                        {selected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={closeModal} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSavePanel}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {modalMode === 'create' ? 'Create Panel' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {modalMode === 'delete' && activePanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full"><Trash2 className="w-5 h-5 text-red-600" /></div>
                <h3 className="font-semibold text-gray-900">Delete Panel</h3>
              </div>
              <p className="text-gray-600 mb-2">
                Are you sure you want to delete <strong>{activePanel.name}</strong>?
              </p>
              <p className="text-sm text-gray-500">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={closeModal} className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleDeletePanel}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

