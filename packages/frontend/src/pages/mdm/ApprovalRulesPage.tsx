import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  mdmService,
  ENTITY_TYPE_LABELS,
  MASTER_DATA_ENTITY_TYPES,
  type ApprovalRule,
  type CreateApprovalRuleInput,
  type MasterDataEntityType,
} from '../../services/mdm';
import { rolesService } from '../../services/roles';
import {
  Settings,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Edit,
  Trash2,
  Shield,
  Users,
  Database,
  Bell,
  CheckCircle,
} from 'lucide-react';

const emptyForm = {
  entityType: 'service' as MasterDataEntityType,
  approverRoleId: '',
  minApprovers: 1,
  notifyOnChange: false,
  notificationEmails: '',
};

export default function ApprovalRulesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<'All' | MasterDataEntityType>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['approval-rules'],
    queryFn: () => mdmService.rules.list(),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesService.list(),
  });

  const roleName = (roleId?: string) =>
    roleId ? roles?.find((r) => r.id === roleId)?.name || roleId : undefined;

  const toPayload = (data: typeof formData): CreateApprovalRuleInput => {
    const emails = data.notificationEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
    return {
      entityType: data.entityType,
      minApprovers: data.minApprovers,
      notifyOnChange: data.notifyOnChange,
      ...(data.approverRoleId ? { approverRoleId: data.approverRoleId } : {}),
      ...(emails.length ? { notificationEmails: emails } : {}),
    };
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingRule) {
        return mdmService.rules.update(editingRule.id, toPayload(data));
      }
      return mdmService.rules.create(toPayload(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
      resetForm();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      return mdmService.rules.update(id, { isActive: false });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] });
    },
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingRule(null);
    setShowModal(false);
  };

  const handleEdit = (rule: ApprovalRule) => {
    setFormData({
      entityType: rule.entityType,
      approverRoleId: rule.approverRoleId || '',
      minApprovers: rule.minApprovers ?? 1,
      notifyOnChange: !!rule.notifyOnChange,
      notificationEmails: (rule.notificationEmails || []).join(', '),
    });
    setEditingRule(rule);
    setShowModal(true);
  };

  const filteredRules = rules?.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      ENTITY_TYPE_LABELS[r.entityType]?.toLowerCase().includes(term) ||
      (roleName(r.approverRoleId) || '').toLowerCase().includes(term);
    const matchesType = selectedEntityType === 'All' || r.entityType === selectedEntityType;
    return matchesSearch && matchesType;
  });

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
              <p className="text-sm text-gray-600">Active Rules</p>
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
              <p className="text-sm text-gray-600">Requiring Approval</p>
              <p className="text-xl font-bold text-green-600">
                {rules?.filter((r) => r.requiresApproval).length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Bell className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Notify on Change</p>
              <p className="text-xl font-bold text-gray-600">
                {rules?.filter((r) => r.notifyOnChange).length || 0}
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
              placeholder="Search by entity type or approver role..."
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
              onChange={(e) => setSelectedEntityType(e.target.value as 'All' | MasterDataEntityType)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Entity Types</option>
              {MASTER_DATA_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABELS[type]}
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
              <div key={rule.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield
                        className={`w-5 h-5 ${rule.requiresApproval ? 'text-blue-600' : 'text-gray-400'}`}
                      />
                      <h3 className="font-medium text-gray-900">
                        {ENTITY_TYPE_LABELS[rule.entityType] || rule.entityType}
                      </h3>
                      {rule.requiresApproval ? (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                          Requires approval
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                          Auto-approve
                        </span>
                      )}
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        {rule.facilityId ? 'Facility rule' : 'Global rule'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {rule.minApprovers} approver(s) required
                      </span>
                      {rule.approverRoleId && (
                        <span className="flex items-center gap-1">
                          <Shield className="w-4 h-4" />
                          {roleName(rule.approverRoleId)}
                        </span>
                      )}
                      {rule.notifyOnChange && (
                        <span className="flex items-center gap-1">
                          <Bell className="w-4 h-4" />
                          Notify on change
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(rule.notificationEmails || []).map((email) => (
                        <span
                          key={email}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full"
                        >
                          {email}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Edit"
                    >
                      <Edit className="w-5 h-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => deactivateMutation.mutate(rule.id)}
                      disabled={deactivateMutation.isPending}
                      className="p-2 hover:bg-red-50 rounded-lg"
                      title="Deactivate"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Entity Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.entityType}
                    onChange={(e) =>
                      setFormData({ ...formData, entityType: e.target.value as MasterDataEntityType })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {MASTER_DATA_ENTITY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ENTITY_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Approvers
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.minApprovers}
                    onChange={(e) =>
                      setFormData({ ...formData, minApprovers: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approver Role</label>
                <select
                  value={formData.approverRoleId}
                  onChange={(e) => setFormData({ ...formData, approverRoleId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Not set</option>
                  {roles?.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.notifyOnChange}
                    onChange={(e) => setFormData({ ...formData, notifyOnChange: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  Notify on change
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notification Emails
                </label>
                <input
                  type="text"
                  value={formData.notificationEmails}
                  onChange={(e) => setFormData({ ...formData, notificationEmails: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., admin@hospital.org, finance@hospital.org"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
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
                disabled={saveMutation.isPending}
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
