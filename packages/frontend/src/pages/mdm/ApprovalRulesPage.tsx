import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Users,
  Database,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface ApprovalRule {
  id: string;
  name: string;
  entityType: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ALL';
  condition: string;
  requiredApprovers: number;
  approverRoles: string[];
  priority: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

// Data - will be populated from API
const mockRules: ApprovalRule[] = [];

const entityTypes = ['Drug', 'Supplier', 'Service', 'Ward', 'Department', 'Equipment', 'User'];
const actions = ['CREATE', 'UPDATE', 'DELETE', 'ALL'];
const roles = ['Hospital Admin', 'Finance Manager', 'Pharmacy Manager', 'Procurement Manager', 'Department Head', 'Medical Director', 'CEO', 'Lab Manager'];

export default function ApprovalRulesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    entityType: 'Drug',
    action: 'UPDATE' as 'CREATE' | 'UPDATE' | 'DELETE' | 'ALL',
    condition: '',
    requiredApprovers: 1,
    approverRoles: [] as string[],
    priority: 1,
  });

  const { data: rules, isLoading } = useQuery({
    queryKey: ['approval-rules', selectedEntityType],
    queryFn: async () => mockRules,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
      resetForm();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      entityType: 'Drug',
      action: 'UPDATE',
      condition: '',
      requiredApprovers: 1,
      approverRoles: [],
      priority: 1,
    });
    setEditingRule(null);
    setShowModal(false);
  };

  const handleEdit = (rule: ApprovalRule) => {
    setFormData({
      name: rule.name,
      entityType: rule.entityType,
      action: rule.action,
      condition: rule.condition,
      requiredApprovers: rule.requiredApprovers,
      approverRoles: [...rule.approverRoles],
      priority: rule.priority,
    });
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleRoleToggle = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      approverRoles: prev.approverRoles.includes(role)
        ? prev.approverRoles.filter((r) => r !== role)
        : [...prev.approverRoles, role],
    }));
  };

  const filteredRules = rules?.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedEntityType === 'All' || r.entityType === selectedEntityType;
    return matchesSearch && matchesType;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">Create</span>;
      case 'UPDATE':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">Update</span>;
      case 'DELETE':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">Delete</span>;
      case 'ALL':
        return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">All</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Rules</h1>
          <p className="text-gray-600">Configure approval workflows for master data changes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Rules</p>
              <p className="text-xl font-bold text-gray-900">{rules?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Rules</p>
              <p className="text-xl font-bold text-green-600">
                {rules?.filter((r) => r.isActive).length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Inactive Rules</p>
              <p className="text-xl font-bold text-gray-600">
                {rules?.filter((r) => !r.isActive).length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Database className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Entity Types</p>
              <p className="text-xl font-bold text-gray-900">
                {new Set(rules?.map((r) => r.entityType)).size || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="p-4 bg-gray-50 border-b">
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Entity Types</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Rules List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredRules && filteredRules.length > 0 ? (
          <div className="divide-y">
            {filteredRules.map((rule) => (
              <div key={rule.id} className={`p-4 ${!rule.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className={`w-5 h-5 ${rule.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      <h3 className="font-medium text-gray-900">{rule.name}</h3>
                      {getActionBadge(rule.action)}
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Database className="w-4 h-4" />
                        {rule.entityType}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {rule.requiredApprovers} approver(s) required
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rule.approverRoles.map((role) => (
                        <span
                          key={role}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Condition: <code className="bg-gray-100 px-1 rounded">{rule.condition}</code>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMutation.mutate(rule.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title={rule.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {rule.isActive ? (
                        <ToggleRight className="w-6 h-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(rule.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No approval rules configured</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRule ? 'Edit Approval Rule' : 'Add Approval Rule'}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Drug Price Changes"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.entityType}
                    onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {entityTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData({ ...formData, action: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {actions.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition
                </label>
                <input
                  type="text"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., field:price changed, always, field:amount > 1000000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use 'always' to apply to all changes, or specify field conditions
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Required Approvers
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.requiredApprovers}
                    onChange={(e) =>
                      setFormData({ ...formData, requiredApprovers: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority (lower = higher)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Approver Roles <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleToggle(role)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        formData.approverRoles.includes(role)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={resetForm}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate(formData)}
                disabled={
                  !formData.name.trim() ||
                  formData.approverRoles.length === 0 ||
                  saveMutation.isPending
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingRule ? 'Update' : 'Create'} Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
