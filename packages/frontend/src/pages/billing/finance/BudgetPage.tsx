import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency } from '../../../lib/currency';
import { useFacilityId } from '../../../lib/facility';
import api from '../../../services/api';
import {
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  X,
  Loader2,
  FileText,
  DollarSign,
  Calendar,
  BarChart3,
  Eye,
  ClipboardCheck,
} from 'lucide-react';

interface BudgetLine {
  id: string;
  accountId: string;
  accountName: string;
  accountCode: string;
  period: string;
  amount: number;
  actualAmount?: number;
  variance?: number;
}

interface Budget {
  id: string;
  name: string;
  fiscalYear: number;
  facilityId: string;
  facilityName?: string;
  status: 'draft' | 'approved' | 'closed';
  totalAmount: number;
  lines?: BudgetLine[];
  createdAt: string;
}

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
}

type ViewMode = 'list' | 'vs-actual';

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
};

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const currentYear = new Date().getFullYear();

  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLineModal, setShowLineModal] = useState(false);
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [vsActualBudgetId, setVsActualBudgetId] = useState<string | null>(null);

  const { data: budgets = [], isLoading } = useQuery<Budget[]>({
    queryKey: ['budgets', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/budgets', { params: { facilityId } });
      return response.data?.data || response.data || [];
    },
    enabled: !!facilityId,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['finance-accounts', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/accounts', { params: { facilityId } });
      const raw = response.data?.data || response.data || [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!facilityId,
  });

  const { data: vsActualData } = useQuery<BudgetLine[]>({
    queryKey: ['budget-vs-actual', vsActualBudgetId],
    queryFn: async () => {
      const response = await api.get(`/finance/budgets/${vsActualBudgetId}/vs-actual`);
      return response.data?.data || response.data || [];
    },
    enabled: !!vsActualBudgetId,
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (payload: { name: string; fiscalYear: number; facilityId: string }) => {
      const response = await api.post('/finance/budgets', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', facilityId] });
      toast.success('Budget created successfully');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to create budget'),
  });

  const addLineMutation = useMutation({
    mutationFn: async ({ budgetId, payload }: { budgetId: string; payload: { accountId: string; period: string; amount: number } }) => {
      const response = await api.post(`/finance/budgets/${budgetId}/lines`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', facilityId] });
      toast.success('Budget line added');
      setShowLineModal(false);
    },
    onError: () => toast.error('Failed to add budget line'),
  });

  const approveMutation = useMutation({
    mutationFn: async (budgetId: string) => {
      const response = await api.patch(`/finance/budgets/${budgetId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets', facilityId] });
      toast.success('Budget approved');
    },
    onError: () => toast.error('Failed to approve budget'),
  });

  const filtered = budgets.filter((b) => {
    const matchesSearch = !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = yearFilter === 'all' || b.fiscalYear === yearFilter;
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesYear && matchesStatus;
  });

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.totalAmount, 0);
  const approvedCount = budgets.filter((b) => b.status === 'approved').length;
  const draftCount = budgets.filter((b) => b.status === 'draft').length;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Budget Management</h1>
            <p className="text-sm text-gray-500 mt-1">Create, manage, and track budgets across fiscal years</p>
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'vs-actual' && (
              <button
                onClick={() => { setViewMode('list'); setVsActualBudgetId(null); }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg border"
              >
                Back to List
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Budget
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="rounded-lg p-3 border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <FileText className="w-4 h-4" />
              Total Budgets
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{budgets.length}</p>
          </div>
          <div className="rounded-lg p-3 border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <DollarSign className="w-4 h-4" />
              Total Budgeted
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalBudgeted)}</p>
          </div>
          <div className="rounded-lg p-3 border border-emerald-200 bg-emerald-50">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              Approved
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{approvedCount}</p>
          </div>
          <div className="rounded-lg p-3 border border-yellow-200 bg-yellow-50">
            <div className="flex items-center gap-2 text-sm text-yellow-700">
              <Calendar className="w-4 h-4" />
              Drafts
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{draftCount}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search budgets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={yearFilter === 'all' ? 'all' : String(yearFilter)}
            onChange={(e) => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Years</option>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {viewMode === 'vs-actual' && vsActualBudgetId ? (
          /* Budget vs Actual Report */
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 bg-gray-100 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Budget vs Actual Report
              </h3>
            </div>
            <div className="grid grid-cols-6 py-2 px-4 bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div>Account</div>
              <div>Period</div>
              <div className="text-right">Budgeted</div>
              <div className="text-right">Actual</div>
              <div className="text-right">Variance</div>
              <div className="text-right">%</div>
            </div>
            {vsActualData && vsActualData.length > 0 ? (
              vsActualData.map((line) => {
                const variance = line.amount - (line.actualAmount || 0);
                const pct = line.amount > 0 ? ((line.actualAmount || 0) / line.amount) * 100 : 0;
                return (
                  <div key={line.id} className="grid grid-cols-6 py-2.5 px-4 border-b hover:bg-gray-50 text-sm items-center">
                    <div>
                      <span className="text-gray-500 text-xs mr-2">{line.accountCode}</span>
                      <span className="text-gray-900">{line.accountName}</span>
                    </div>
                    <div className="text-gray-600">{line.period}</div>
                    <div className="text-right font-medium">{formatCurrency(line.amount)}</div>
                    <div className="text-right font-medium">{formatCurrency(line.actualAmount || 0)}</div>
                    <div className={`text-right font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(variance)}
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pct <= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No budget vs actual data available</p>
              </div>
            )}
          </div>
        ) : (
          /* Budget List */
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="grid grid-cols-7 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div className="col-span-2">Budget Name</div>
              <div>Fiscal Year</div>
              <div>Facility</div>
              <div>Status</div>
              <div className="text-right">Total Amount</div>
              <div className="text-right">Actions</div>
            </div>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
                <p>Loading budgets...</p>
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((budget) => {
                const isExpanded = expandedBudget === budget.id;
                const sc = statusConfig[budget.status] || statusConfig.draft;
                return (
                  <div key={budget.id}>
                    <div className="grid grid-cols-7 py-3 px-4 border-b hover:bg-gray-50 items-center text-sm">
                      <div className="col-span-2 flex items-center gap-2">
                        <button onClick={() => setExpandedBudget(isExpanded ? null : budget.id)} className="text-gray-400 hover:text-gray-600">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{budget.name}</span>
                      </div>
                      <div className="text-gray-700">{budget.fiscalYear}</div>
                      <div className="text-gray-600">{budget.facilityName || '—'}</div>
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                      </div>
                      <div className="text-right font-medium text-gray-900">{formatCurrency(budget.totalAmount)}</div>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setVsActualBudgetId(budget.id); setViewMode('vs-actual'); }}
                          className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="Budget vs Actual"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {budget.status === 'draft' && (
                          <>
                            <button
                              onClick={() => { setActiveBudgetId(budget.id); setShowLineModal(true); }}
                              className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="Add Line"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Approve this budget?')) approveMutation.mutate(budget.id);
                              }}
                              disabled={approveMutation.isPending}
                              className="p-1.5 hover:bg-green-100 rounded text-green-600" title="Approve"
                            >
                              <ClipboardCheck className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Expanded Budget Lines */}
                    {isExpanded && budget.lines && budget.lines.length > 0 && (
                      <div className="bg-gray-50 border-b">
                        <div className="grid grid-cols-4 py-1.5 px-8 text-xs font-semibold text-gray-500 uppercase border-b">
                          <div>Account</div>
                          <div>Period</div>
                          <div className="text-right">Amount</div>
                          <div></div>
                        </div>
                        {budget.lines.map((line) => (
                          <div key={line.id} className="grid grid-cols-4 py-2 px-8 text-sm border-b border-gray-100 items-center">
                            <div>
                              <span className="text-gray-500 text-xs mr-2">{line.accountCode}</span>
                              {line.accountName}
                            </div>
                            <div className="text-gray-600">{line.period}</div>
                            <div className="text-right font-medium">{formatCurrency(line.amount)}</div>
                            <div></div>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExpanded && (!budget.lines || budget.lines.length === 0) && (
                      <div className="bg-gray-50 border-b py-6 text-center text-gray-400 text-sm">
                        No budget lines yet.{' '}
                        {budget.status === 'draft' && (
                          <button
                            onClick={() => { setActiveBudgetId(budget.id); setShowLineModal(true); }}
                            className="text-blue-600 hover:underline"
                          >
                            Add one
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No budgets found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Create Budget</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createBudgetMutation.mutate({
                  name: fd.get('name') as string,
                  fiscalYear: Number(fd.get('fiscalYear')),
                  facilityId,
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Budget Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Operating Budget 2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
                  <select
                    name="fiscalYear"
                    defaultValue={currentYear}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBudgetMutation.isPending}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {createBudgetMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Budget Line Modal */}
      {showLineModal && activeBudgetId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Add Budget Line</h2>
              <button onClick={() => setShowLineModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                addLineMutation.mutate({
                  budgetId: activeBudgetId,
                  payload: {
                    accountId: fd.get('accountId') as string,
                    period: fd.get('period') as string,
                    amount: Number(fd.get('amount')),
                  },
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                  <select
                    name="accountId"
                    required
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select account...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>{acc.accountCode} - {acc.accountName}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <input
                      type="month"
                      name="period"
                      required
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input
                      type="number"
                      name="amount"
                      required
                      min="0"
                      step="0.01"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowLineModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLineMutation.isPending}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {addLineMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Add Line
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
