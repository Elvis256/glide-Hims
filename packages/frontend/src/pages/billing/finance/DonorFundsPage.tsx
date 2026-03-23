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
  Gift,
  DollarSign,
  ArrowRightLeft,
  CheckCircle,
  FileText,
  Eye,
} from 'lucide-react';

interface DonorFund {
  id: string;
  name: string;
  donorName: string;
  description: string;
  grantAmount: number;
  disbursedAmount: number;
  remainingBalance: number;
  status: 'active' | 'exhausted' | 'closed';
  createdAt: string;
}

interface DonorExpense {
  id: string;
  fundId: string;
  amount: number;
  description: string;
  date: string;
  reference: string;
}

interface InterFacilityTransaction {
  id: string;
  fromFacilityId: string;
  fromFacilityName: string;
  toFacilityId: string;
  toFacilityName: string;
  fundId: string;
  fundName: string;
  amount: number;
  description: string;
  status: 'pending' | 'completed';
  date: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  exhausted: { label: 'Exhausted', color: 'bg-red-100 text-red-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600' },
};

type ViewMode = 'funds' | 'inter-facility';

export default function DonorFundsPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('funds');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [activeFundId, setActiveFundId] = useState<string | null>(null);

  const { data: funds = [], isLoading } = useQuery<DonorFund[]>({
    queryKey: ['donor-funds', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/donor-funds', { params: { facilityId } });
      const raw = response.data?.data || response.data || [];
      return (Array.isArray(raw) ? raw : []).map((f: any) => ({
        ...f,
        donorName: f.donorName || f.donor_name || '',
        grantAmount: Number(f.grantAmount || f.grant_amount || 0),
        disbursedAmount: Number(f.disbursedAmount || f.disbursed_amount || 0),
        remainingBalance: Number(f.remainingBalance || f.remaining_balance || 0),
      }));
    },
    enabled: !!facilityId,
  });

  const { data: interFacilityTxns = [], isLoading: loadingIFT } = useQuery<InterFacilityTransaction[]>({
    queryKey: ['donor-inter-facility', facilityId],
    queryFn: async () => {
      const response = await api.get('/finance/donor-funds/inter-facility', { params: { facilityId } });
      return response.data?.data || response.data || [];
    },
    enabled: !!facilityId && viewMode === 'inter-facility',
  });

  const createFundMutation = useMutation({
    mutationFn: async (payload: { name: string; donorName: string; description: string; grantAmount: number; fundCode: string; startDate: string; facilityId: string }) => {
      const response = await api.post('/finance/donor-funds', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donor-funds', facilityId] });
      toast.success('Donor fund created');
      setShowCreateModal(false);
    },
    onError: () => toast.error('Failed to create donor fund'),
  });

  const recordExpenseMutation = useMutation({
    mutationFn: async ({ fundId, payload }: { fundId: string; payload: { amount: number; description: string; reference: string } }) => {
      const response = await api.post(`/finance/donor-funds/${fundId}/expense`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donor-funds', facilityId] });
      toast.success('Expense recorded against fund');
      setShowExpenseModal(false);
    },
    onError: () => toast.error('Failed to record expense'),
  });

  const createTransferMutation = useMutation({
    mutationFn: async (payload: { fromFacilityId: string; toFacilityId: string; fundId: string; amount: number; description: string }) => {
      const response = await api.post('/finance/donor-funds/inter-facility', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donor-inter-facility', facilityId] });
      toast.success('Inter-facility transfer created');
      setShowTransferModal(false);
    },
    onError: () => toast.error('Failed to create transfer'),
  });

  const filtered = funds.filter(
    (f) => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.donorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalFunding = funds.reduce((sum, f) => sum + f.grantAmount, 0);
  const totalUtilized = funds.reduce((sum, f) => sum + f.disbursedAmount, 0);
  const totalRemaining = funds.reduce((sum, f) => sum + f.remainingBalance, 0);
  const activeCount = funds.filter((f) => f.status === 'active').length;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Donor Funds</h1>
            <p className="text-sm text-gray-500 mt-1">Track donor and grant fund utilization</p>
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'inter-facility' && (
              <button
                onClick={() => setShowTransferModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                <ArrowRightLeft className="w-4 h-4" />
                New Transfer
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Fund
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="rounded-lg p-3 border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-2 text-sm text-blue-700"><Gift className="w-4 h-4" />Total Funding</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalFunding)}</p>
          </div>
          <div className="rounded-lg p-3 border border-orange-200 bg-orange-50">
            <div className="flex items-center gap-2 text-sm text-orange-700"><DollarSign className="w-4 h-4" />Utilized</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalUtilized)}</p>
          </div>
          <div className="rounded-lg p-3 border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 text-sm text-green-700"><CheckCircle className="w-4 h-4" />Remaining</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalRemaining)}</p>
          </div>
          <div className="rounded-lg p-3 border border-purple-200 bg-purple-50">
            <div className="flex items-center gap-2 text-sm text-purple-700"><FileText className="w-4 h-4" />Active Funds</div>
            <p className="text-xl font-bold text-gray-900 mt-1">{activeCount}</p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-1 mt-4 border-b -mb-[1px]">
          <button
            onClick={() => setViewMode('funds')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'funds' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Gift className="w-4 h-4" />
            Donor Funds
          </button>
          <button
            onClick={() => setViewMode('inter-facility')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'inter-facility' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Inter-Facility Transactions
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={viewMode === 'funds' ? 'Search by fund name or donor...' : 'Search transfers...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {viewMode === 'funds' ? (
          /* Donor Funds List */
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="grid grid-cols-7 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div className="col-span-2">Fund Name</div>
              <div>Donor</div>
              <div className="text-right">Total</div>
              <div className="text-right">Utilized</div>
              <div>Utilization</div>
              <div className="text-right">Actions</div>
            </div>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
                <p>Loading donor funds...</p>
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((fund) => {
                const utilizationPct = fund.grantAmount > 0 ? (fund.disbursedAmount / fund.grantAmount) * 100 : 0;
                const sc = statusConfig[fund.status] || statusConfig.active;
                return (
                  <div key={fund.id} className="grid grid-cols-7 py-3 px-4 border-b hover:bg-gray-50 items-center text-sm">
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="font-medium text-gray-900">{fund.name}</span>
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                        </div>
                      </div>
                      {fund.description && <p className="text-xs text-gray-500 mt-0.5 ml-6 truncate">{fund.description}</p>}
                    </div>
                    <div className="text-gray-700">{fund.donorName}</div>
                    <div className="text-right font-medium text-gray-900">{formatCurrency(fund.grantAmount)}</div>
                    <div className="text-right font-medium text-orange-600">{formatCurrency(fund.disbursedAmount)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              utilizationPct >= 90 ? 'bg-red-500' : utilizationPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(utilizationPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{utilizationPct.toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Remaining: {formatCurrency(fund.remainingBalance)}</p>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      {fund.status === 'active' && (
                        <button
                          onClick={() => { setActiveFundId(fund.id); setShowExpenseModal(true); }}
                          className="p-1.5 hover:bg-gray-200 rounded text-gray-500" title="Record Expense"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Gift className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No donor funds found</p>
              </div>
            )}
          </div>
        ) : (
          /* Inter-Facility Transactions */
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="grid grid-cols-7 py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <div>Date</div>
              <div>Fund</div>
              <div>From</div>
              <div>To</div>
              <div className="text-right">Amount</div>
              <div>Status</div>
              <div>Description</div>
            </div>
            {loadingIFT ? (
              <div className="text-center py-12 text-gray-500">
                <Loader2 className="w-12 h-12 mx-auto mb-3 text-blue-500 animate-spin" />
                <p>Loading transactions...</p>
              </div>
            ) : interFacilityTxns.length > 0 ? (
              interFacilityTxns
                .filter((t) => !searchQuery || t.fundName.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((txn) => (
                  <div key={txn.id} className="grid grid-cols-7 py-2.5 px-4 border-b hover:bg-gray-50 text-sm items-center">
                    <div className="text-gray-700">{new Date(txn.date).toLocaleDateString()}</div>
                    <div className="font-medium text-gray-900">{txn.fundName}</div>
                    <div className="text-gray-600">{txn.fromFacilityName}</div>
                    <div className="text-gray-600">{txn.toFacilityName}</div>
                    <div className="text-right font-medium text-gray-900">{formatCurrency(txn.amount)}</div>
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        txn.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{txn.status}</span>
                    </div>
                    <div className="text-gray-500 truncate">{txn.description}</div>
                  </div>
                ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No inter-facility transactions found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Fund Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Create Donor Fund</h2>
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
                  donorName: fd.get('donor') as string,
                  description: fd.get('description') as string,
                  grantAmount: Number(fd.get('totalAmount')),
                  fundCode: `DF-${Date.now()}`,
                  startDate: new Date().toISOString().split('T')[0],
                  facilityId,
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fund Name</label>
                    <input type="text" name="name" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., USAID Grant 2025" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Donor</label>
                    <input type="text" name="donor" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Donor organization" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                  <input type="number" name="totalAmount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea name="description" rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Fund description and objectives" />
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

      {/* Record Expense Modal */}
      {showExpenseModal && activeFundId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Record Expense Against Fund</h2>
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
                    reference: fd.get('reference') as string,
                  },
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input type="number" name="amount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" name="description" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Expense description" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input type="text" name="reference" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Invoice/PO reference" />
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

      {/* Inter-Facility Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">New Inter-Facility Transfer</h2>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                createTransferMutation.mutate({
                  fromFacilityId: fd.get('fromFacilityId') as string,
                  toFacilityId: fd.get('toFacilityId') as string,
                  fundId: fd.get('fundId') as string,
                  amount: Number(fd.get('amount')),
                  description: fd.get('description') as string,
                });
              }}
            >
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fund</label>
                  <select name="fundId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select fund...</option>
                    {funds.filter((f) => f.status === 'active').map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({formatCurrency(f.remainingBalance)} remaining)</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Facility ID</label>
                    <input type="text" name="fromFacilityId" required defaultValue={facilityId} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To Facility ID</label>
                    <input type="text" name="toFacilityId" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Destination facility" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input type="number" name="amount" required min="0" step="0.01" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input type="text" name="description" required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Transfer description" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
                <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" disabled={createTransferMutation.isPending} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {createTransferMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
