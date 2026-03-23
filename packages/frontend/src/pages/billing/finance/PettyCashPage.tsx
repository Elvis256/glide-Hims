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
  Wallet,
  DollarSign,
  FileText,
  Eye,
  RefreshCw,
  CheckCircle,
  Coins,
  ArrowDownUp,
} from 'lucide-react';

interface PettyCashFund {
  id: string;
  name: string;
  facilityId: string;
  facilityName?: string;
  imprestAmount: number;
  currentBalance: number;
  custodian: string;
  isActive: boolean;
  createdAt: string;
}

interface PettyCashTransaction {
  id: string;
  fundId: string;
  type: 'expense' | 'topup';
  amount: number;
  description: string;
  category?: string;
  receiptNumber?: string;
  paidTo?: string;
  runningBalance: number;
  date: string;
}

const categories = ['supplies', 'transport', 'meals', 'cleaning', 'stationery', 'repairs', 'other'];

export default function PettyCashPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [activeFundId, setActiveFundId] = useState<string | null>(null);
  const [statementFundId, setStatementFundId] = useState<string | null>(null);

  const { data: funds = [], isLoading } = useQuery<PettyCashFund[]>({
    queryKey: ['petty-cash-funds', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/petty-cash/funds', { params: { facilityId } });
      return response.data?.data || response.data || [];
    },
    enabled: !!facilityId,
  });

  const { data: statement = [] } = useQuery<PettyCashTransaction[]>({
    queryKey: ['petty-cash-statement', statementFundId],
    queryFn: async () => {
      const response = await api.get(`/finance/petty-cash/funds/${statementFundId}/statement`);
      return response.data?.data || response.data || [];
    },
    enabled: !!statementFundId,
  });

  const createFundMutation = useMutation({
    mutationFn: async (payload: { name: string; facilityId: string; imprestAmount: number; custodianId: string }) => {
      const response = await api.post('/finance/petty-cash/funds', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-funds', facilityId] });
      toast.success('Fund created successfully');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to create fund'),
  });

  const recordExpenseMutation = useMutation({
    mutationFn: async ({ fundId, payload }: { fundId: string; payload: { amount: number; description: string; category: string; receiptNumber: string; paidTo: string } }) => {
      const response = await api.post(`/finance/petty-cash/funds/${fundId}/transactions`, { ...payload, type: 'expense' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-funds', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-statement', statementFundId] });
      toast.success('Expense recorded');
      setShowExpenseModal(false);
    },
    onError: () => toast.error('Failed to record expense'),
  });

  const replenishMutation = useMutation({
    mutationFn: async (fundId: string) => {
      const amountStr = window.prompt('Enter replenishment amount:');
      if (!amountStr) throw new Error('Cancelled');
      const amount = Number(amountStr);
      if (isNaN(amount) || amount <= 0) throw new Error('Invalid amount');
      const response = await api.post(`/finance/petty-cash/funds/${fundId}/replenish`, { amount });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-funds', facilityId] });
      queryClient.invalidateQueries({ queryKey: ['petty-cash-statement', statementFundId] });
      toast.success('Fund replenished');
    },
    onError: () => toast.error('Failed to replenish fund'),
  });

  const filtered = funds.filter(
    (f) => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.custodian.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalImprest = funds.reduce((sum, f) => sum + f.imprestAmount, 0);
  const totalBalance = funds.reduce((sum, f) => sum + f.currentBalance, 0);
  const activeFund = funds.find((f) => f.id === statementFundId);

  // Statement View
  if (statementFundId && activeFund) {
    return (
      <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => setStatementFundId(null)} className="text-sm text-blue-600 hover:underline mb-1">
                ← Back to Funds
              </button>
              <h1 className="text-2xl font-bold text-gray-900">{activeFund.name} — Statement</h1>
              <p className="text-sm text-gray-500 mt-1">
                Custodian: {activeFund.custodian} · Imprest: {formatCurrency(activeFund.imprestAmount)} · Balance: {formatCurrency(activeFund.currentBalance)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setActiveFundId(activeFund.id); setShowExpenseModal(true); }}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <Plus className="w-4 h-4" />
                Record Expense
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Replenish this fund to imprest amount?')) replenishMutation.mutate(activeFund.id);
                }}
                disabled={replenishMutation.isPending}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${replenishMutation.isPending ? 'animate-spin' : ''}`} />
                Replenish
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="grid grid-cols-7 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div>Date</div>
              <div>Type</div>
              <div className="col-span-2">Description</div>
              <div>Category</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Balance</div>
            </div>
            {statement.length > 0 ? (
              statement.map((txn) => (
                <div key={txn.id} className="grid grid-cols-7 py-2.5 px-4 border-b hover:bg-gray-50 text-sm items-center">
                  <div className="text-gray-700">{new Date(txn.date).toLocaleDateString()}</div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      txn.type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {txn.type === 'expense' ? 'Expense' : 'Top-up'}
                    </span>
                  </div>
                  <div className="col-span-2 text-gray-900">
                    {txn.description}
                    {txn.paidTo && <span className="text-gray-500 text-xs ml-2">→ {txn.paidTo}</span>}
                  </div>
                  <div className="text-gray-500 text-xs">{txn.category || '—'}</div>
                  <div className={`text-right font-medium ${txn.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                    {txn.type === 'expense' ? '-' : '+'}{formatCurrency(txn.amount)}
                  </div>
                  <div className="text-right font-medium text-gray-900">{formatCurrency(txn.runningBalance)}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ArrowDownUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No transactions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Expense Modal */}
        {showExpenseModal && activeFundId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-bold text-gray-900">Record Expense</h2>
                <button onClick={() => setShowExpenseModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  recordExpenseMutation.mutate({
                    fundId: activeFundId,
                    payload: {
                      amount: Number(fd.get('amount')),
                      description: fd.get('description') as string,
                      category: fd.get('category') as string,
                      receiptNumber: fd.get('receiptNumber') as string,
                      paidTo: fd.get('paidTo') as string,
                    },
                  });
                }}
              >
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <input type="number" name="amount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select name="category" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select...</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input type="text" name="description" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="What was purchased" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
                      <input type="text" name="receiptNumber" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="RCT-001" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Paid To</label>
                      <input type="text" name="paidTo" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Vendor/person name" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                  <button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button type="submit" disabled={recordExpenseMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                    {recordExpenseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fund List View
  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Petty Cash</h1>
            <p className="text-sm text-gray-500 mt-1">Manage petty cash funds and expenses</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Fund
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="rounded-lg p-3 border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 text-sm text-blue-700"><Wallet className="w-4 h-4" />Total Funds</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{funds.length}</p>
          </div>
          <div className="rounded-lg p-3 border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 text-sm text-green-700"><DollarSign className="w-4 h-4" />Total Imprest</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalImprest)}</p>
          </div>
          <div className="rounded-lg p-3 border border-purple-200 bg-purple-50">
            <div className="flex items-center gap-2 text-sm text-purple-700"><Coins className="w-4 h-4" />Total Balance</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalBalance)}</p>
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
              placeholder="Search by fund name or custodian..."
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
          <div className="grid grid-cols-6 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <div>Fund Name</div>
            <div>Custodian</div>
            <div className="text-right">Imprest Amount</div>
            <div className="text-right">Current Balance</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
              <p>Loading funds...</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map((fund) => {
              const utilizationPct = fund.imprestAmount > 0 ? ((fund.imprestAmount - fund.currentBalance) / fund.imprestAmount) * 100 : 0;
              return (
                <div key={fund.id} className="grid grid-cols-6 py-3 px-4 border-b hover:bg-gray-50 items-center text-sm">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{fund.name}</span>
                  </div>
                  <div className="text-gray-600">{fund.custodian}</div>
                  <div className="text-right text-gray-700">{formatCurrency(fund.imprestAmount)}</div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{formatCurrency(fund.currentBalance)}</div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                      <div
                        className={`h-1.5 rounded-full ${utilizationPct > 80 ? 'bg-red-500' : utilizationPct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${fund.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {fund.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setStatementFundId(fund.id)}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="View Statement"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => { setActiveFundId(fund.id); setShowExpenseModal(true); }}
                      className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="Record Expense"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {fund.currentBalance < fund.imprestAmount && (
                      <button
                        onClick={() => {
                          if (window.confirm('Replenish this fund?')) replenishMutation.mutate(fund.id);
                        }}
                        disabled={replenishMutation.isPending}
                        className="p-1.5 hover:bg-green-100 rounded text-green-600" title="Replenish"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No petty cash funds found</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Fund Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Create Petty Cash Fund</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createFundMutation.mutate({
                  name: fd.get('name') as string,
                  facilityId,
                  imprestAmount: Number(fd.get('imprestAmount')),
                  custodianId: fd.get('custodianId') as string,
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fund Name</label>
                  <input type="text" name="name" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Main Office Petty Cash" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Imprest Amount</label>
                    <input type="number" name="imprestAmount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custodian ID</label>
                    <input type="text" name="custodianId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="UUID of custodian" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createFundMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {createFundMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal (from list view) */}
      {showExpenseModal && activeFundId && !statementFundId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Record Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                recordExpenseMutation.mutate({
                  fundId: activeFundId,
                  payload: {
                    amount: Number(fd.get('amount')),
                    description: fd.get('description') as string,
                    category: fd.get('category') as string,
                    receiptNumber: fd.get('receiptNumber') as string,
                    paidTo: fd.get('paidTo') as string,
                  },
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input type="number" name="amount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select name="category" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select...</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" name="description" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="What was purchased" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
                    <input type="text" name="receiptNumber" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="RCT-001" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paid To</label>
                    <input type="text" name="paidTo" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Vendor/person" />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={recordExpenseMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {recordExpenseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
