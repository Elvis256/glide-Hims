import { useState, useMemo, useEffect, useCallback } from 'react';
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

const STORAGE_KEYS = {
  WORKFLOWS: 'approval_workflows',
  APPROVERS: 'approval_approvers',
};

const defaultWorkflows: Workflow[] = [
  {
    id: '1',
    name: 'Standard Purchase Workflow',
    description: 'Default approval workflow for all purchases',
    isActive: true,
    createdAt: '2024-01-01',
    levels: [
      { id: 'l1', level: 1, name: 'Department Head', minAmount: 0, maxAmount: 50000, approvers: ['John Doe', 'Jane Smith'], escalationHours: 24, autoApprove: true, autoApproveThreshold: 5000 },
      { id: 'l2', level: 2, name: 'Finance Manager', minAmount: 50000, maxAmount: 200000, approvers: ['Mike Johnson'], escalationHours: 48, autoApprove: false, autoApproveThreshold: 0 },
      { id: 'l3', level: 3, name: 'CFO Approval', minAmount: 200000, maxAmount: 500000, approvers: ['Sarah Wilson'], escalationHours: 72, autoApprove: false, autoApproveThreshold: 0 },
      { id: 'l4', level: 4, name: 'CEO Approval', minAmount: 500000, maxAmount: null, approvers: ['Robert Brown'], escalationHours: 96, autoApprove: false, autoApproveThreshold: 0 },
    ],
  },
  {
    id: '2',
    name: 'Emergency Purchase Workflow',
    description: 'Fast-track approval for urgent purchases',
    isActive: true,
    createdAt: '2024-01-15',
    levels: [
      { id: 'e1', level: 1, name: 'Duty Manager', minAmount: 0, maxAmount: 100000, approvers: ['Any Duty Manager'], escalationHours: 4, autoApprove: true, autoApproveThreshold: 10000 },
      { id: 'e2', level: 2, name: 'Finance Director', minAmount: 100000, maxAmount: null, approvers: ['Mike Johnson', 'Sarah Wilson'], escalationHours: 8, autoApprove: false, autoApproveThreshold: 0 },
    ],
  },
  {
    id: '3',
    name: 'Medical Supplies Workflow',
    description: 'Specialized workflow for medical equipment',
    isActive: false,
    createdAt: '2024-02-01',
    levels: [
      { id: 'm1', level: 1, name: 'Medical Director', minAmount: 0, maxAmount: 150000, approvers: ['Dr. James Lee'], escalationHours: 24, autoApprove: false, autoApproveThreshold: 0 },
      { id: 'm2', level: 2, name: 'Finance + Medical', minAmount: 150000, maxAmount: null, approvers: ['Mike Johnson', 'Dr. James Lee'], escalationHours: 48, autoApprove: false, autoApproveThreshold: 0 },
    ],
  },
];

const defaultApprovers: Approver[] = [
  { id: '1', name: 'John Doe', role: 'Department Head', department: 'Operations' },
  { id: '2', name: 'Jane Smith', role: 'Department Head', department: 'Nursing' },
  { id: '3', name: 'Mike Johnson', role: 'Finance Manager', department: 'Finance' },
  { id: '4', name: 'Sarah Wilson', role: 'CFO', department: 'Finance' },
  { id: '5', name: 'Robert Brown', role: 'CEO', department: 'Executive' },
  { id: '6', name: 'Dr. James Lee', role: 'Medical Director', department: 'Medical' },
];

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
}

export default function ApprovalWorkflowPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [showAddWorkflow, setShowAddWorkflow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  // Load data from localStorage on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      // Simulate async loading for UX
      await new Promise(resolve => setTimeout(resolve, 300));
      const storedWorkflows = loadFromStorage(STORAGE_KEYS.WORKFLOWS, defaultWorkflows);
      const storedApprovers = loadFromStorage(STORAGE_KEYS.APPROVERS, defaultApprovers);
      setWorkflows(storedWorkflows);
      setApprovers(storedApprovers);
      setSelectedWorkflow(storedWorkflows[0] || null);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Persist workflows to localStorage
  const persistWorkflows = useCallback((updatedWorkflows: Workflow[]) => {
    setIsSaving(true);
    saveToStorage(STORAGE_KEYS.WORKFLOWS, updatedWorkflows);
    setTimeout(() => setIsSaving(false), 200);
  }, []);

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
    setWorkflows(updatedWorkflows);
    persistWorkflows(updatedWorkflows);
    setSelectedWorkflow(workflow);
    setShowAddWorkflow(false);
    setNewWorkflow({ name: '', description: '' });
  }, [newWorkflow, workflows, persistWorkflows]);

  // CRUD: Delete Workflow
  const handleDeleteWorkflow = useCallback((id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    const updatedWorkflows = workflows.filter(w => w.id !== id);
    setWorkflows(updatedWorkflows);
    persistWorkflows(updatedWorkflows);
    
    if (selectedWorkflow?.id === id) {
      setSelectedWorkflow(updatedWorkflows[0] || null);
    }
  }, [workflows, selectedWorkflow, persistWorkflows]);

  // CRUD: Add Level to Workflow
  const handleAddLevel = useCallback(() => {
    if (!selectedWorkflow || !newLevel.name.trim()) return;
    
    const level: ApprovalLevel = {
      id: `level-${Date.now()}`,
      level: selectedWorkflow.levels.length + 1,
      name: newLevel.name,
      minAmount: newLevel.minAmount,
      maxAmount: newLevel.maxAmount,
      approvers: newLevel.approvers,
      escalationHours: newLevel.escalationHours,
      autoApprove: newLevel.autoApprove,
      autoApproveThreshold: newLevel.autoApproveThreshold,
    };
    
    const updatedWorkflow = {
      ...selectedWorkflow,
      levels: [...selectedWorkflow.levels, level],
    };
    
    const updatedWorkflows = workflows.map(w =>
      w.id === selectedWorkflow.id ? updatedWorkflow : w
    );
    
    setWorkflows(updatedWorkflows);
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
  }, [selectedWorkflow, newLevel, workflows, persistWorkflows]);

  // CRUD: Delete Level from Workflow
  const handleDeleteLevel = useCallback((levelId: string) => {
    if (!selectedWorkflow) return;
    if (!confirm('Are you sure you want to delete this approval level?')) return;
    
    const updatedLevels = selectedWorkflow.levels
      .filter(l => l.id !== levelId)
      .map((l, idx) => ({ ...l, level: idx + 1 }));
    
    const updatedWorkflow = { ...selectedWorkflow, levels: updatedLevels };
    const updatedWorkflows = workflows.map(w =>
      w.id === selectedWorkflow.id ? updatedWorkflow : w
    );
    
    setWorkflows(updatedWorkflows);
    persistWorkflows(updatedWorkflows);
    setSelectedWorkflow(updatedWorkflow);
  }, [selectedWorkflow, workflows, persistWorkflows]);

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
    setWorkflows(updatedWorkflows);
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
    return `KES ${amount.toLocaleString()}`;
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
                  selectedWorkflow?.id === workflow.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
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
          {selectedWorkflow ? (
            <>
              <div className="p-6 border-b bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedWorkflow.name}</h2>
                    <p className="text-sm text-gray-500">{selectedWorkflow.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleWorkflowActive(selectedWorkflow.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        selectedWorkflow.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {selectedWorkflow.isActive ? 'Active' : 'Inactive'}
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Settings className="w-5 h-5 text-gray-500" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg">
                      <Edit2 className="w-5 h-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteWorkflow(selectedWorkflow.id)}
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
                  {selectedWorkflow.levels.map((level, index) => (
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

                      {index < selectedWorkflow.levels.length - 1 && (
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount (KES)</label>
                  <input
                    type="number"
                    value={newLevel.minAmount}
                    onChange={(e) => setNewLevel(prev => ({ ...prev, minAmount: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (KES)</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auto-Approve Threshold (KES)</label>
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
