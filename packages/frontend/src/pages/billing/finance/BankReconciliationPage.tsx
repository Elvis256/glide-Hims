import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency } from '../../../lib/currency';
import { useFacilityId } from '../../../lib/facility';
import api from '../../../services/api';
import {
  Plus,
  Search,
  X,
  Loader2,
  Landmark,
  CheckCircle,
  AlertTriangle,
  Link2,
  RefreshCw,
  Eye,
  ArrowRightLeft,
  FileText,
} from 'lucide-react';

interface StatementItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference: string;
  matched: boolean;
  matchedJournalId?: string;
}

interface ReconciliationSummary {
  totalStatementItems: number;
  matchedCount: number;
  unmatchedCount: number;
  statementBalance: number;
  bookBalance: number;
  discrepancy: number;
}

interface Reconciliation {
  id: string;
  bankAccountName: string;
  bankAccountId: string;
  period: string;
  statementBalance: number;
  status: 'in_progress' | 'completed';
  createdAt: string;
  items?: StatementItem[];
  summary?: ReconciliationSummary;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
};

export default function BankReconciliationPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [activeRecId, setActiveRecId] = useState<string | null>(null);
  const [detailView, setDetailView] = useState<string | null>(null);

  const { data: reconciliations = [], isLoading } = useQuery<Reconciliation[]>({
    queryKey: ['bank-reconciliations', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/bank-reconciliation', { params: { facilityId } });
      return response.data?.data || response.data || [];
    },
    enabled: !!facilityId,
  });

  const { data: recDetail } = useQuery<Reconciliation>({
    queryKey: ['bank-reconciliation-detail', detailView],
    queryFn: async () => {
      const response = await api.get(`/finance/bank-reconciliation/${detailView}`);
      return response.data?.data || response.data;
    },
    enabled: !!detailView,
  });

  const { data: recSummary } = useQuery<ReconciliationSummary>({
    queryKey: ['bank-reconciliation-summary', detailView],
    queryFn: async () => {
      const response = await api.get(`/finance/bank-reconciliation/${detailView}/summary`);
      return response.data?.data || response.data;
    },
    enabled: !!detailView,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { bankAccountId: string; period: string; statementBalance: number; facilityId: string }) => {
      const response = await api.post('/finance/bank-reconciliation', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', facilityId] });
      toast.success('Reconciliation created');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to create reconciliation'),
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ recId, payload }: { recId: string; payload: { date: string; description: string; amount: number; reference: string } }) => {
      const response = await api.post(`/finance/bank-reconciliation/${recId}/statement-items`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-detail', detailView] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-summary', detailView] });
      toast.success('Statement item added');
      setShowItemModal(false);
    },
    onError: () => toast.error('Failed to add statement item'),
  });

  const autoMatchMutation = useMutation({
    mutationFn: async (recId: string) => {
      const response = await api.post(`/finance/bank-reconciliation/${recId}/auto-match`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-detail', detailView] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-summary', detailView] });
      toast.success('Auto-match completed');
    },
    onError: () => toast.error('Auto-match failed'),
  });

  const manualMatchMutation = useMutation({
    mutationFn: async ({ itemId, journalId }: { itemId: string; journalId: string }) => {
      const response = await api.patch(`/finance/bank-reconciliation/items/${itemId}/match`, { journalId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-detail', detailView] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-summary', detailView] });
      toast.success('Item matched');
    },
    onError: () => toast.error('Failed to match item'),
  });

  const completeMutation = useMutation({
    mutationFn: async (recId: string) => {
      const response = await api.patch(`/finance/bank-reconciliation/${recId}/complete`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliations', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-detail', detailView] });
      toast.success('Reconciliation completed');
    },
    onError: () => toast.error('Failed to complete reconciliation'),
  });

  const filtered = reconciliations.filter(
    (r) => !searchQuery || r.bankAccountName.toLowerCase().includes(searchQuery.toLowerCase()) || r.period.includes(searchQuery)
  );

  const inProgressCount = reconciliations.filter((r) => r.status === 'in_progress').length;
  const completedCount = reconciliations.filter((r) => r.status === 'completed').length;

  // Detail view for a specific reconciliation
  if (detailView && recDetail) {
    const summary = recSummary || recDetail.summary;
    const items = recDetail.items || [];
    const sc = statusConfig[recDetail.status] || statusConfig.in_progress;

    return (
      <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
        {/* Detail Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => setDetailView(null)} className="text-sm text-blue-600 hover:underline mb-1">
                ← Back to Reconciliations
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{recDetail.bankAccountName}</h1>
              <p className="text-sm text-gray-500 mt-1">Period: {recDetail.period} · Statement Balance: {formatCurrency(recDetail.statementBalance)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
              {recDetail.status === 'in_progress' && (
                <>
                  <button
                    onClick={() => { setActiveRecId(recDetail.id); setShowItemModal(true); }}
                    className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                  <button
                    onClick={() => autoMatchMutation.mutate(recDetail.id)}
                    disabled={autoMatchMutation.isPending}
                    className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-blue-50 text-blue-600"
                  >
                    <RefreshCw className={`w-4 h-4 ${autoMatchMutation.isPending ? 'animate-spin' : ''}`} />
                    Auto-Match
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Complete this reconciliation?')) completeMutation.mutate(recDetail.id);
                    }}
                    disabled={completeMutation.isPending}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="rounded-lg p-3 border border-blue-200 bg-blue-50">
                <div className="flex items-center gap-2 text-sm text-blue-700"><FileText className="w-4 h-4" />Total Items</div>
                <p className="text-xl font-bold text-gray-900 mt-1">{summary.totalStatementItems}</p>
              </div>
              <div className="rounded-lg p-3 border border-green-200 bg-green-50">
                <div className="flex items-center gap-2 text-sm text-green-700"><Link2 className="w-4 h-4" />Matched</div>
                <p className="text-xl font-bold text-gray-900 mt-1">{summary.matchedCount}</p>
              </div>
              <div className="rounded-lg p-3 border border-yellow-200 bg-yellow-50">
                <div className="flex items-center gap-2 text-sm text-yellow-700"><AlertTriangle className="w-4 h-4" />Unmatched</div>
                <p className="text-xl font-bold text-gray-900 mt-1">{summary.unmatchedCount}</p>
              </div>
              <div className="rounded-lg p-3 border border-red-200 bg-red-50">
                <div className="flex items-center gap-2 text-sm text-red-700"><ArrowRightLeft className="w-4 h-4" />Discrepancy</div>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(summary.discrepancy)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Statement Items Table */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="grid grid-cols-6 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div>Date</div>
              <div className="col-span-2">Description</div>
              <div className="text-right">Amount</div>
              <div>Reference</div>
              <div className="text-center">Status</div>
            </div>
            {items.length > 0 ? (
              items.map((item) => (
                <div key={item.id} className="grid grid-cols-6 py-2.5 px-4 border-b hover:bg-gray-50 text-sm items-center">
                  <div className="text-gray-700">{new Date(item.date).toLocaleDateString()}</div>
                  <div className="col-span-2 text-gray-900">{item.description}</div>
                  <div className={`text-right font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.amount)}
                  </div>
                  <div className="text-gray-500 text-xs font-mono">{item.reference}</div>
                  <div className="text-center">
                    {item.matched ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Link2 className="w-3 h-3" /> Matched
                      </span>
                    ) : recDetail.status === 'in_progress' ? (
                      <button
                        onClick={() => {
                          const journalId = window.prompt('Enter journal entry ID to match:');
                          if (journalId) manualMatchMutation.mutate({ itemId: item.id, journalId });
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Match manually
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Unmatched</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No statement items yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Add Statement Item Modal */}
        {showItemModal && activeRecId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-bold text-gray-900">Add Statement Item</h2>
                <button onClick={() => setShowItemModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  addItemMutation.mutate({
                    recId: activeRecId,
                    payload: {
                      date: fd.get('date') as string,
                      description: fd.get('description') as string,
                      amount: Number(fd.get('amount')),
                      reference: fd.get('reference') as string,
                    },
                  });
                }}
              >
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input type="date" name="date" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <input type="number" name="amount" required step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input type="text" name="description" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Transaction description" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                    <input type="text" name="reference" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Check/Reference number" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                  <button type="button" onClick={() => setShowItemModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={addItemMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                    {addItemMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bank Reconciliation</h1>
            <p className="text-sm text-gray-500 mt-1">Match bank statements with book entries</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Reconciliation
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg p-3 border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 text-sm text-blue-700"><Landmark className="w-4 h-4" />Total</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{reconciliations.length}</p>
          </div>
          <div className="rounded-lg p-3 border border-yellow-200 bg-yellow-50">
            <div className="flex items-center gap-2 text-sm text-yellow-700"><RefreshCw className="w-4 h-4" />In Progress</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{inProgressCount}</p>
          </div>
          <div className="rounded-lg p-3 border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 text-sm text-green-700"><CheckCircle className="w-4 h-4" />Completed</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{completedCount}</p>
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
              placeholder="Search by bank account or period..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="grid grid-cols-5 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <div>Bank Account</div>
            <div>Period</div>
            <div className="text-right">Statement Balance</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
              <p>Loading reconciliations...</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((rec) => {
              const sc = statusConfig[rec.status] || statusConfig.in_progress;
              return (
                <div key={rec.id} className="grid grid-cols-5 py-3 px-4 border-b hover:bg-gray-50 items-center text-sm">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{rec.bankAccountName}</span>
                  </div>
                  <div className="text-gray-700">{rec.period}</div>
                  <div className="text-right font-medium text-gray-900">{formatCurrency(rec.statementBalance)}</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => setDetailView(rec.id)}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Landmark className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No reconciliations found</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">New Reconciliation</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createMutation.mutate({
                  bankAccountId: fd.get('bankAccountId') as string,
                  period: fd.get('period') as string,
                  statementBalance: Number(fd.get('statementBalance')),
                  facilityId,
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account ID</label>
                  <input type="text" name="bankAccountId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter bank account ID" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <input type="month" name="period" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statement Balance</label>
                    <input type="number" name="statementBalance" required step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
