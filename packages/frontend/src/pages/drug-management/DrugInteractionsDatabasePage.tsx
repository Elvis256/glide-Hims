import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch,
  Search,
  Plus,
  Edit2,
  Filter,
  ChevronDown,
  Loader2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Pill,
  ArrowRight,
  X,
  Trash2,
} from 'lucide-react';

interface DrugInteraction {
  id: string;
  drug1Id: string;
  drug1Name: string;
  drug2Id: string;
  drug2Name: string;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CONTRAINDICATED';
  description: string;
  clinicalEffect: string;
  management: string;
  documentation: 'ESTABLISHED' | 'PROBABLE' | 'SUSPECTED' | 'POSSIBLE';
  isActive: boolean;
  createdAt: string;
}

// Data - will be populated from API
const mockInteractions: DrugInteraction[] = [];

const severities = ['All', 'MINOR', 'MODERATE', 'MAJOR', 'CONTRAINDICATED'];

export default function DrugInteractionsDatabasePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<DrugInteraction | null>(null);
  const [showSeverityDropdown, setShowSeverityDropdown] = useState(false);

  const { data: interactions, isLoading } = useQuery({
    queryKey: ['drug-interactions'],
    queryFn: async () => mockInteractions,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<DrugInteraction>) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drug-interactions'] });
      setShowAddModal(false);
      setEditingInteraction(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drug-interactions'] });
    },
  });

  const items = interactions || [];

  const filteredInteractions = items.filter((interaction) => {
    const matchesSearch = 
      interaction.drug1Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interaction.drug2Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interaction.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === 'All' || interaction.severity === selectedSeverity;
    return matchesSearch && matchesSeverity;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'MINOR': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'MODERATE': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'MAJOR': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'CONTRAINDICATED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'MINOR': return <Info className="w-4 h-4" />;
      case 'MODERATE': return <AlertTriangle className="w-4 h-4" />;
      case 'MAJOR': return <AlertTriangle className="w-4 h-4" />;
      case 'CONTRAINDICATED': return <AlertOctagon className="w-4 h-4" />;
      default: return null;
    }
  };

  const contraCount = items.filter(i => i.severity === 'CONTRAINDICATED').length;
  const majorCount = items.filter(i => i.severity === 'MAJOR').length;
  const moderateCount = items.filter(i => i.severity === 'MODERATE').length;
  const minorCount = items.filter(i => i.severity === 'MINOR').length;

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
          <h1 className="text-2xl font-bold text-gray-900">Drug Interactions Database</h1>
          <p className="text-gray-600">Manage drug-drug interaction records for clinical decision support</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Interaction
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertOctagon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Contraindicated</p>
              <p className="text-xl font-bold text-red-600">{contraCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Major</p>
              <p className="text-xl font-bold text-orange-600">{majorCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Moderate</p>
              <p className="text-xl font-bold text-yellow-600">{moderateCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Minor</p>
              <p className="text-xl font-bold text-blue-600">{minorCount}</p>
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
              placeholder="Search drugs or descriptions..."
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
                    ? severity === 'CONTRAINDICATED' ? 'bg-red-600 text-white' :
                      severity === 'MAJOR' ? 'bg-orange-600 text-white' :
                      severity === 'MODERATE' ? 'bg-yellow-600 text-white' :
                      severity === 'MINOR' ? 'bg-blue-600 text-white' :
                      'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {severity}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactions List */}
      <div className="space-y-4">
        {filteredInteractions.map((interaction) => (
          <div 
            key={interaction.id} 
            className={`bg-white rounded-xl border-l-4 shadow-sm overflow-hidden ${
              interaction.severity === 'CONTRAINDICATED' ? 'border-l-red-500' :
              interaction.severity === 'MAJOR' ? 'border-l-orange-500' :
              interaction.severity === 'MODERATE' ? 'border-l-yellow-500' :
              'border-l-blue-500'
            }`}
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Pill className="w-5 h-5 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-900">{interaction.drug1Name}</span>
                  </div>
                  <GitBranch className="w-5 h-5 text-gray-400 rotate-90" />
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <Pill className="w-5 h-5 text-gray-600" />
                    </div>
                    <span className="font-medium text-gray-900">{interaction.drug2Name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(interaction.severity)}`}>
                    {getSeverityIcon(interaction.severity)}
                    {interaction.severity}
                  </span>
                  <button
                    onClick={() => setEditingInteraction(interaction)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(interaction.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Description</p>
                  <p className="text-sm text-gray-600">{interaction.description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Clinical Effect</p>
                    <p className="text-sm text-gray-600">{interaction.clinicalEffect}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Management</p>
                    <p className="text-sm text-gray-600">{interaction.management}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>Documentation: {interaction.documentation}</span>
                  <span>•</span>
                  <span>Added: {new Date(interaction.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {filteredInteractions.length === 0 && (
          <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
            <GitBranch className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No drug interactions found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingInteraction) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingInteraction ? 'Edit Interaction' : 'Add Interaction'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingInteraction(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drug 1</label>
                  <input
                    type="text"
                    defaultValue={editingInteraction?.drug1Name}
                    placeholder="e.g., Warfarin"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Drug 2</label>
                  <input
                    type="text"
                    defaultValue={editingInteraction?.drug2Name}
                    placeholder="e.g., Aspirin"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select 
                    defaultValue={editingInteraction?.severity}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MINOR">Minor</option>
                    <option value="MODERATE">Moderate</option>
                    <option value="MAJOR">Major</option>
                    <option value="CONTRAINDICATED">Contraindicated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Documentation</label>
                  <select 
                    defaultValue={editingInteraction?.documentation}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ESTABLISHED">Established</option>
                    <option value="PROBABLE">Probable</option>
                    <option value="SUSPECTED">Suspected</option>
                    <option value="POSSIBLE">Possible</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  defaultValue={editingInteraction?.description}
                  placeholder="Brief description of the interaction"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Effect</label>
                <textarea
                  rows={2}
                  defaultValue={editingInteraction?.clinicalEffect}
                  placeholder="What happens clinically"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Management</label>
                <textarea
                  rows={2}
                  defaultValue={editingInteraction?.management}
                  placeholder="How to manage this interaction"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingInteraction(null);
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
                {editingInteraction ? 'Save Changes' : 'Add Interaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
