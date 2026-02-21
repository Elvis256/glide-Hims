import { usePermissions } from '../../../components/PermissionGate';
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '../../../services/api';
import {
  Star,
  Search,
  Plus,
  Edit2,
  Trash2,
  Copy,
  FolderOpen,
  Pill,
  ChevronDown,
  ChevronUp,
  X,
  Download,
  Check,
  Loader2,
} from 'lucide-react';

interface TemplateMedication {
  name: string;
  strength: string;
  frequency: string;
  duration: string;
  quantity: string;
  refills: number;
}

interface PrescriptionTemplate {
  id: string;
  name: string;
  category: string;
  commonUse: string;
  medications: TemplateMedication[];
  createdAt: string;
}

const QUERY_KEY = ['favorite-prescriptions'];

const categories = [
  'All',
  'Antibiotics',
  'Pain Management',
  'Chronic Disease',
  'Cardiovascular',
  'Respiratory',
  'GI/Metabolic',
  'Mental Health',
];

export default function FavoriteRxPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PrescriptionTemplate | null>(null);
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await api.get('/settings/favorite_prescriptions');
      return (response.data?.value?.templates ?? []) as PrescriptionTemplate[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updated: PrescriptionTemplate[]) => {
      const response = await api.put('/settings/favorite_prescriptions', {
        value: { templates: updated },
        description: 'Favorite prescription templates',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      const msg = error.response?.data?.message || error.message || 'Failed to save templates';
      toast.error(msg);
    },
  });

  const updateTemplates = useCallback((updater: (prev: PrescriptionTemplate[]) => PrescriptionTemplate[]) => {
    const updated = updater(templates);
    saveMutation.mutate(updated);
  }, [templates, saveMutation]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.commonUse.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.medications.some(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'All' || template.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, PrescriptionTemplate[]> = {};
    filteredTemplates.forEach(template => {
      if (!grouped[template.category]) {
        grouped[template.category] = [];
      }
      grouped[template.category].push(template);
    });
    return grouped;
  }, [filteredTemplates]);

  const handleDelete = (id: string) => {
    updateTemplates(prev => prev.filter(t => t.id !== id));
    setShowDeleteConfirm(null);
  };

  const handleApply = (template: PrescriptionTemplate) => {
    setAppliedTemplate(template.id);
    setTimeout(() => setAppliedTemplate(null), 2000);
  };

  const handleEdit = (template: PrescriptionTemplate) => {
    setEditingTemplate(template);
    setShowEditModal(true);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading favorite prescriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Favorite Prescriptions</h1>
              <p className="text-sm text-gray-500">Your saved prescription templates for quick access</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Templates List */}
      <div className="flex-1 p-6 overflow-y-auto">
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FolderOpen className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">No templates found</p>
            <p className="text-sm">Try a different search or create a new template</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {Object.entries(templatesByCategory).map(([category, categoryTemplates]) => (
              <div key={category}>
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Pill className="w-4 h-4" />
                  {category}
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                    {categoryTemplates.length}
                  </span>
                </h2>
                <div className="space-y-2">
                  {categoryTemplates.map(template => (
                    <div key={template.id} className="bg-white rounded-lg border overflow-hidden">
                      <div
                        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                        onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-medium text-gray-900">{template.name}</span>
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5">{template.commonUse}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            {template.medications.length} medication{template.medications.length !== 1 ? 's' : ''} • 
                            Created {template.createdAt}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApply(template);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                              appliedTemplate === template.id
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {appliedTemplate === template.id ? (
                              <>
                                <Check className="w-4 h-4" />
                                Applied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Quick Apply
                              </>
                            )}
                          </button>
                          {expandedTemplate === template.id ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {expandedTemplate === template.id && (
                        <div className="px-4 pb-4 border-t bg-gray-50">
                          <div className="py-4">
                            <div className="text-sm font-medium text-gray-700 mb-2">Medications</div>
                            <div className="space-y-2">
                              {template.medications.map((med, idx) => (
                                <div key={idx} className="p-3 bg-white rounded-lg border">
                                  <div className="font-medium text-gray-900">{med.name} {med.strength}</div>
                                  <div className="text-sm text-gray-600 mt-1">
                                    {med.frequency} • {med.duration}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Qty: {med.quantity} | Refills: {med.refills}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="mt-4 pt-4 border-t flex gap-3">
                              <button
                                onClick={() => handleEdit(template)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-white"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(template.id)}
                                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Template Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg m-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Add New Template</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g., UTI Standard Treatment"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Common Use</label>
                <input
                  type="text"
                  placeholder="e.g., Uncomplicated urinary tract infection"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Medications</label>
                <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed text-center text-gray-500">
                  <Plus className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-sm">Add medications to this template</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {showEditModal && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg m-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">Edit Template</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  defaultValue={editingTemplate.name}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select 
                  defaultValue={editingTemplate.category}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {categories.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Common Use</label>
                <input
                  type="text"
                  defaultValue={editingTemplate.commonUse}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Medications</label>
                <div className="space-y-2">
                  {editingTemplate.medications.map((med, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-medium">{med.name} {med.strength}</div>
                        <div className="text-sm text-gray-500">{med.frequency}</div>
                      </div>
                      <button className="p-1 text-gray-400 hover:text-gray-600">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t sticky bottom-0 bg-white">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Common Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md m-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Import Common Prescriptions</h2>
              <button onClick={() => setShowImportModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Select from commonly used prescription templates to add to your favorites:
              </p>
              <div className="space-y-2">
                {commonPrescriptions.map((rx, idx) => {
                  const alreadyExists = templates.some(t => t.name === rx.name);
                  return (
                    <label 
                      key={idx} 
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${
                        alreadyExists ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 rounded"
                        disabled={alreadyExists}
                        checked={selectedImports.has(idx)}
                        onChange={(e) => {
                          const newSet = new Set(selectedImports);
                          if (e.target.checked) {
                            newSet.add(idx);
                          } else {
                            newSet.delete(idx);
                          }
                          setSelectedImports(newSet);
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{rx.name}</div>
                        <div className="text-sm text-gray-500">{rx.category}</div>
                      </div>
                      {alreadyExists && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Already added</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button
                onClick={() => {
                  setSelectedImports(new Set());
                  setShowImportModal(false);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedImports.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Selected ({selectedImports.size})
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
              <h2 className="text-lg font-semibold">Delete Template</h2>
            </div>
            <div className="p-4">
              <p className="text-gray-700">
                Are you sure you want to delete this template? This action cannot be undone.
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
