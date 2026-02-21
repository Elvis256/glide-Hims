import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
import { api } from '../../../services/api';
import {
  GitBranch,
  Plus,
  Edit2,
  Trash2,
  Users,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Search,
  Settings,
  Zap,
  Loader2,
  X,
} from 'lucide-react';

interface ApprovalLevel {
  id: string;
  level: number;
  name: string;
  minAmount: number;
  maxAmount: number | null;
  approvers: string[];
  escalationHours: number;
  autoApprove: boolean;
  autoApproveThreshold: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  levels: ApprovalLevel[];
  createdAt: string;
}

interface Approver {
  id: string;
  name: string;
  role: string;
  department: string;
}

const SETTINGS_API = '/settings/approval_workflows';

interface ApprovalWorkflowSettings {
  workflows: Workflow[];
  approvers: Approver[];
}

export default function ApprovalWorkflowPage() {
  const queryClient = useQueryClient();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [showAddWorkflow, setShowAddWorkflow] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ name: '', description: '' });
  const [newLevel, setNewLevel] = useState({
    name: '',
    minAmount: 0,
    maxAmount: null as number | null,
    approvers: [] as string[],
    escalationHours: 24,
    autoApprove: false,
    autoApproveThreshold: 0,
  });

  const { data, isLoading } = useQuery<ApprovalWorkflowSettings>({
    queryKey: ['approval-workflows'],
    queryFn: async () => {
      const res = await api.get(SETTINGS_API);
      return (res.data?.value as ApprovalWorkflowSettings) ?? { workflows: [], approvers: [] };
    },
  });

  const workflows = data?.workflows ?? [];
  const approvers = data?.approvers ?? [];

  // Select first workflow when data loads if nothing is selected
  const resolvedSelected = selectedWorkflow
    ? workflows.find(w => w.id === selectedWorkflow.id) ?? null
    : workflows[0] ?? null;

  const saveMutation = useMutation({
    mutationFn: (value: ApprovalWorkflowSettings) =>
      api.put(SETTINGS_API, { value, description: 'Approval workflows configuration' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] });
    },
  });

  const isSaving = saveMutation.isPending;

  const persistWorkflows = useCallback((updatedWorkflows: Workflow[], updatedApprovers?: Approver[]) => {
    saveMutation.mutate({ workflows: updatedWorkflows, approvers: updatedApprovers ?? approvers });
  }, [approvers, saveMutation]);

  // CRUD: Create Workflow
  const handleAddWorkflow = useCallback(() => {
    if (!newWorkflow.name.trim()) return;
    
    const workflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name: newWorkflow.name,
      description: newWorkflow.description,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
      levels: [],
    };
    
    const updatedWorkflows = [...workflows, workflow];
    persistWorkflows(updatedWorkflows);
    setSelectedWorkflow(workflow);
    setShowAddWorkflow(false);
    setNewWorkflow({ name: '', description: '' });
  }, [newWorkflow, workflows, persistWorkflows]);

  // CRUD: Delete Workflow
  const handleDeleteWorkflow = useCallback((id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    const updatedWorkflows = workflows.filter(w => w.id !== id);
    persistWorkflows(updatedWorkflows);
    
    if (selectedWorkflow?.id === id) {
      setSelectedWorkflow(updatedWorkflows[0] || null);
    }
  }, [workflows, selectedWorkflow, persistWorkflows]);

  // CRUD: Add Level to Workflow
  const handleAddLevel = useCallback(() => {
    if (!resolvedSelected || !newLevel.name.trim()) return;
    
    const level: ApprovalLevel = {
      id: `level-${Date.now()}`,
      level: resolvedSelected.levels.length + 1,
      name: newLevel.name,
      minAmount: newLevel.minAmount,
      maxAmount: newLevel.maxAmount,
      approvers: newLevel.approvers,
      escalationHours: newLevel.escalationHours,
      autoApprove: newLevel.autoApprove,
      autoApproveThreshold: newLevel.autoApproveThreshold,
    };
    
    const updatedWorkflow = {
      ...resolvedSelected,
      levels: [...resolvedSelected.levels, level],
    };
    
    const updatedWorkflows = workflows.map(w =>
      w.id === resolvedSelected.id ? updatedWorkflow : w
    );
    
    persistWorkflows(updatedWorkflows);
    setSelectedWorkflow(updatedWorkflow);
    setShowAddLevel(false);
    setNewLevel({
      name: '',
      minAmount: 0,
      maxAmount: null,
      approvers: [],
      escalationHours: 24,
      autoApprove: false,
      autoApproveThreshold: 0,
    });
  }, [resolvedSelected, newLevel, workflows, persistWorkflows]);

  // CRUD: Delete Level from Workflow
  const handleDeleteLevel = useCallback((levelId: string) => {
    if (!resolvedSelected) return;
    if (!confirm('Are you sure you want to delete this approval level?')) return;
    
    const updatedLevels = resolvedSelected.levels
      .filter(l => l.id !== levelId)
      .map((l, idx) => ({ ...l, level: idx + 1 }));
    
    const updatedWorkflow = { ...resolvedSelected, levels: updatedLevels };
    const updatedWorkflows = workflows.map(w =>
      w.id === resolvedSelected.id ? updatedWorkflow : w
    );
    
    persistWorkflows(updatedWorkflows);
    setSelectedWorkflow(updatedWorkflow);
  }, [resolvedSelected, workflows, persistWorkflows]);

  const stats = useMemo(() => ({
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter(w => w.isActive).length,
    totalLevels: workflows.reduce((sum, w) => sum + w.levels.length, 0),
    autoApprovalEnabled: workflows.flatMap(w => w.levels).filter(l => l.autoApprove).length,
  }), [workflows]);

  const toggleWorkflowActive = useCallback((id: string) => {
    const updatedWorkflows = workflows.map(w =>
      w.id === id ? { ...w, isActive: !w.isActive } : w
    );
    persistWorkflows(updatedWorkflows);
    
    if (selectedWorkflow?.id === id) {
      setSelectedWorkflow(prev => prev ? { ...prev, isActive: !prev.isActive } : prev);
    }
  }, [workflows, selectedWorkflow, persistWorkflows]);

  // Toggle approver selection for new level
  const toggleApproverSelection = useCallback((approverName: string) => {
    setNewLevel(prev => ({
      ...prev,
      approvers: prev.approvers.includes(approverName)
        ? prev.approvers.filter(a => a !== approverName)
        : [...prev.approvers, approverName],
    }));
  }, []);

  const formatAmount = (amount: number | null) => {
    if (amount === null) return 'Unlimited';
    return formatCurrency(amount);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-gray-500">Loading workflows...</span>
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
            <div className="p-2 bg-blue-100 rounded-lg">
              <GitBranch className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Approval Workflows</h1>
              <p className="text-sm text-gray-500">Configure procurement approval levels and escalation rules</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddWorkflow(true)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New Workflow
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Total Workflows</div>
            <div className="text-xl font-bold text-gray-900">{stats.totalWorkflows}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-sm text-green-600">Active Workflows</div>
            <div className="text-xl font-bold text-green-700">{stats.activeWorkflows}</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-blue-600">Total Approval Levels</div>
            <div className="text-xl font-bold text-blue-700">{stats.totalLevels}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-purple-600">
              <Zap className="w-4 h-4" />
              Auto-Approval Rules
            </div>
            <div className="text-xl font-bold text-purple-700">{stats.autoApprovalEnabled}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Workflows List */}
        <div className="w-80 bg-white border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {workflows.filter(w => w.name.toLowerCase().includes(searchTerm.toLowerCase())).map(workflow => (
              <button
                key={workflow.id}
                onClick={() => setSelectedWorkflow(workflow)}
                className={`w-full p-4 text-left border-b hover:bg-gray-50 ${
                  resolvedSelected?.id === workflow.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{workflow.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    workflow.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {workflow.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{workflow.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{workflow.levels.length} levels</span>
                  <span>•</span>
                  <span>Created {workflow.createdAt}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Workflow Details */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {resolvedSelected ? (
            <>
              <div className="p-6 border-b bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{resolvedSelected.name}</h2>
                    <p className="text-sm text-gray-500">{resolvedSelected.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWorkflowActive(resolvedSelected.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        resolvedSelected.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {resolvedSelected.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Settings className="w-5 h-5 text-gray-500" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Edit2 className="w-5 h-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflow(resolvedSelected.id)}
                      className="p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Approval Levels</h3>
                  <button
                    onClick={() => setShowAddLevel(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    <Plus className="w-4 h-4" />
                    Add Level
                  </button>
                </div>

                <div className="space-y-4">
                  {resolvedSelected.levels.map((level, index) => (
                    <div key={level.id} className="bg-white rounded-lg border p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                            {level.level}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{level.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <DollarSign className="w-3 h-3" />
                              <span>{formatAmount(level.minAmount)} - {formatAmount(level.maxAmount)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 hover:bg-gray-100 rounded">
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleDeleteLevel(level.id)}
                            className="p-1.5 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <Users className="w-4 h-4" />
                            Approvers
                          </div>
                          <div className="space-y-1">
                            {level.approvers.map((approver, idx) => (
                              <div key={idx} className="text-sm font-medium text-gray-700">{approver}</div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <Clock className="w-4 h-4" />
                            Escalation
                          </div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-medium text-gray-700">After {level.escalationHours} hours</span>
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <Zap className="w-4 h-4" />
                            Auto-Approve
                          </div>
                          {level.autoApprove ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                              <span className="text-sm font-medium text-green-700">
                                Up to {formatAmount(level.autoApproveThreshold)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">Disabled</span>
                          )}
                        </div>
                      </div>

                      {index < resolvedSelected.levels.length - 1 && (
                        <div className="flex justify-center mt-4">
                          <ChevronRight className="w-5 h-5 text-gray-300 rotate-90" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Approvers Section */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Approvers</h3>
                  <div className="bg-white rounded-lg border">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Role</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Department</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {approvers.map(approver => (
                          <tr key={approver.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{approver.name}</td>
                            <td className="px-4 py-3 text-gray-600">{approver.role}</td>
                            <td className="px-4 py-3 text-gray-600">{approver.department}</td>
                            <td className="px-4 py-3 text-center">
                              <button className="text-sm text-blue-600 hover:text-blue-800">Assign</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a workflow to view details
            </div>
          )}
        </div>
      </div>

      {/* Add Workflow Modal */}
      {showAddWorkflow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Add New Workflow</h3>
              <button onClick={() => setShowAddWorkflow(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Name</label>
                <input
                  type="text"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Capital Expenditure Workflow"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the purpose of this workflow..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowAddWorkflow(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWorkflow}
                disabled={!newWorkflow.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Level Modal */}
      {showAddLevel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Add Approval Level</h3>
              <button onClick={() => setShowAddLevel(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level Name</label>
                <input
                  type="text"
                  value={newLevel.name}
                  onChange={(e) => setNewLevel(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Department Head Approval"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount ({CURRENCY_SYMBOL})</label>
                  <input
                    type="number"
                    value={newLevel.minAmount}
                    onChange={(e) => setNewLevel(prev => ({ ...prev, minAmount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount ({CURRENCY_SYMBOL})</label>
                  <input
                    type="number"
                    value={newLevel.maxAmount ?? ''}
                    onChange={(e) => setNewLevel(prev => ({ ...prev, maxAmount: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="Leave empty for unlimited"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Escalation (hours)</label>
                <input
                  type="number"
                  value={newLevel.escalationHours}
                  onChange={(e) => setNewLevel(prev => ({ ...prev, escalationHours: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Approvers</label>
                <div className="space-y-2 max-h-32 overflow-auto border rounded-lg p-2">
                  {approvers.map(approver => (
                    <label key={approver.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newLevel.approvers.includes(approver.name)}
                        onChange={() => toggleApproverSelection(approver.name)}
                        className="rounded"
                      />
                      <span className="text-sm">{approver.name} ({approver.role})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={newLevel.autoApprove}
                  onChange={(e) => setNewLevel(prev => ({ ...prev, autoApprove: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="autoApprove" className="text-sm font-medium text-gray-700">Enable Auto-Approve</label>
              </div>
              {newLevel.autoApprove && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auto-Approve Threshold ({CURRENCY_SYMBOL})</label>
                  <input
                    type="number"
                    value={newLevel.autoApproveThreshold}
                    onChange={(e) => setNewLevel(prev => ({ ...prev, autoApproveThreshold: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                onClick={() => setShowAddLevel(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLevel}
                disabled={!newLevel.name.trim() || newLevel.approvers.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Add Level
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
