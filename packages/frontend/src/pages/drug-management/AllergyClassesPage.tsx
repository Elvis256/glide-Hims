import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Search,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Pill,
  Shield,
  X,
  Check,
  Info,
} from 'lucide-react';

interface AllergyClass {
  id: string;
  name: string;
  description: string;
  commonAllergens: string[];
  crossReactiveDrugs: string[];
  symptoms: string[];
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  isActive: boolean;
  createdAt: string;
}

// Data - will be populated from API
const mockAllergyClasses: AllergyClass[] = [];

const severities = ['All', 'MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING'];

export default function AllergyClassesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClass, setEditingClass] = useState<AllergyClass | null>(null);
  const [viewingClass, setViewingClass] = useState<AllergyClass | null>(null);

  const { data: allergyClasses, isLoading } = useQuery({
    queryKey: ['allergy-classes'],
    queryFn: async () => mockAllergyClasses,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<AllergyClass>) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergy-classes'] });
      setShowAddModal(false);
      setEditingClass(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allergy-classes'] });
    },
  });

  const items = allergyClasses || [];

  const filteredClasses = items.filter((cls) => {
    const matchesSearch = 
      cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cls.commonAllergens.some(a => a.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSeverity = selectedSeverity === 'All' || cls.severity === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'MILD': return 'bg-blue-100 text-blue-700';
      case 'MODERATE': return 'bg-yellow-100 text-yellow-700';
      case 'SEVERE': return 'bg-orange-100 text-orange-700';
      case 'LIFE_THREATENING': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getSeverityBorder = (severity: string) => {
    switch (severity) {
      case 'MILD': return 'border-l-blue-500';
      case 'MODERATE': return 'border-l-yellow-500';
      case 'SEVERE': return 'border-l-orange-500';
      case 'LIFE_THREATENING': return 'border-l-red-500';
      default: return 'border-l-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Allergy Classes</h1>
          <p className="text-gray-600">Manage drug allergy classes for cross-reactivity checking</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Allergy Class
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Classes</p>
              <p className="text-xl font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Life Threatening</p>
              <p className="text-xl font-bold text-red-600">
                {items.filter(c => c.severity === 'LIFE_THREATENING').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Severe</p>
              <p className="text-xl font-bold text-orange-600">
                {items.filter(c => c.severity === 'SEVERE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-xl font-bold text-green-600">
                {items.filter(c => c.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or allergen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {severities.map((severity) => (
              <button
                key={severity}
                onClick={() => setSelectedSeverity(severity)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedSeverity === severity
                    ? severity === 'LIFE_THREATENING' ? 'bg-red-600 text-white' :
                      severity === 'SEVERE' ? 'bg-orange-600 text-white' :
                      severity === 'MODERATE' ? 'bg-yellow-600 text-white' :
                      severity === 'MILD' ? 'bg-blue-600 text-white' :
                      'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {severity.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Allergy Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClasses.map((cls) => (
          <div 
            key={cls.id} 
            className={`bg-white rounded-xl border-l-4 shadow-sm overflow-hidden ${getSeverityBorder(cls.severity)}`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                    <p className="text-sm text-gray-500">{cls.description}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(cls.severity)}`}>
                  {cls.severity.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Common Allergens</p>
                  <div className="flex flex-wrap gap-1">
                    {cls.commonAllergens.slice(0, 4).map((allergen, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                        {allergen}
                      </span>
                    ))}
                    {cls.commonAllergens.length > 4 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                        +{cls.commonAllergens.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Cross-Reactive Drugs</p>
                  <div className="flex flex-wrap gap-1">
                    {cls.crossReactiveDrugs.slice(0, 3).map((drug, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">
                        {drug}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingClass(cls)}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                    title="View details"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingClass(cls)}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(cls.id)}
                    className="p-1 hover:bg-gray-100 rounded text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs text-gray-400">
                  Added {new Date(cls.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredClasses.length === 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No allergy classes found</p>
        </div>
      )}

      {/* View Detail Modal */}
      {viewingClass && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{viewingClass.name}</h2>
              <button
                onClick={() => setViewingClass(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Description</p>
                <p className="text-gray-600">{viewingClass.description}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Common Allergens</p>
                <div className="flex flex-wrap gap-2">
                  {viewingClass.commonAllergens.map((allergen, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                      {allergen}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Cross-Reactive Drugs</p>
                <div className="flex flex-wrap gap-2">
                  {viewingClass.crossReactiveDrugs.map((drug, idx) => (
                    <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm">
                      {drug}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Symptoms</p>
                <div className="flex flex-wrap gap-2">
                  {viewingClass.symptoms.map((symptom, idx) => (
                    <span key={idx} className="px-2 py-1 bg-red-50 text-red-700 rounded text-sm">
                      {symptom}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Severity</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(viewingClass.severity)}`}>
                    {viewingClass.severity.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${viewingClass.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {viewingClass.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setViewingClass(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setEditingClass(viewingClass);
                  setViewingClass(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingClass) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingClass ? 'Edit Allergy Class' : 'Add Allergy Class'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingClass(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  defaultValue={editingClass?.name}
                  placeholder="e.g., Penicillins"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  defaultValue={editingClass?.description}
                  placeholder="Brief description of this allergy class"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select 
                  defaultValue={editingClass?.severity}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="MILD">Mild</option>
                  <option value="MODERATE">Moderate</option>
                  <option value="SEVERE">Severe</option>
                  <option value="LIFE_THREATENING">Life Threatening</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Common Allergens</label>
                <textarea
                  rows={2}
                  defaultValue={editingClass?.commonAllergens.join(', ')}
                  placeholder="Comma-separated list (e.g., Penicillin, Amoxicillin)"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cross-Reactive Drugs</label>
                <textarea
                  rows={2}
                  defaultValue={editingClass?.crossReactiveDrugs.join(', ')}
                  placeholder="Comma-separated list"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Symptoms</label>
                <textarea
                  rows={2}
                  defaultValue={editingClass?.symptoms.join(', ')}
                  placeholder="Comma-separated list"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={editingClass?.isActive ?? true}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingClass(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate({})}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingClass ? 'Save Changes' : 'Add Allergy Class'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
