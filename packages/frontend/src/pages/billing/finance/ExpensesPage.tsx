import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Eye,
  Edit2,
  Trash2,
  Upload,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Building2,
  Calendar,
  FileText,
  DollarSign,
  Paperclip,
  Loader2,
  Info,
  BookOpen,
} from 'lucide-react';

type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'paid';
type ExpenseCategory = 'supplies' | 'utilities' | 'maintenance' | 'salaries' | 'equipment' | 'travel' | 'other';

interface Expense {
  id: string;
  date: string;
  category: ExpenseCategory;
  description: string;
  vendor: string;
  amount: number;
  status: ExpenseStatus;
  submittedBy: string;
  approvedBy?: string;
  receiptAttached: boolean;
  notes: string;
}

// Expense account from chart of accounts
interface ExpenseAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountCategory: string;
  currentBalance: number;
  isActive: boolean;
}

// Journal entry line for expense transactions
interface JournalEntryLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  journalNumber: string;
  journalDate: string;
  description: string;
  reference: string;
  status: string;
  journalType: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalEntryLine[];
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
}

const expenses: Expense[] = [];

const categoryConfig: Record<ExpenseCategory, { label: string; color: string; budget: number }> = {
  supplies: { label: 'Medical Supplies', color: 'bg-blue-100 text-blue-700', budget: 500000 },
  utilities: { label: 'Utilities', color: 'bg-yellow-100 text-yellow-700', budget: 150000 },
  maintenance: { label: 'Maintenance', color: 'bg-orange-100 text-orange-700', budget: 200000 },
  salaries: { label: 'Salaries', color: 'bg-purple-100 text-purple-700', budget: 2000000 },
  equipment: { label: 'Equipment', color: 'bg-green-100 text-green-700', budget: 300000 },
  travel: { label: 'Travel', color: 'bg-pink-100 text-pink-700', budget: 100000 },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-700', budget: 50000 },
};

const statusConfig: Record<ExpenseStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: DollarSign },
};

export default function ExpensesPage() {
  const facilityId = localStorage.getItem('facilityId') || '';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch expense accounts from chart of accounts
  const { data: expenseAccountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ['expense-accounts', facilityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facilityId) params.append('facilityId', facilityId);
      params.append('type', 'expense');
      const response = await api.get(`/finance/accounts?${params.toString()}`);
      return response.data;
    },
    enabled: !!facilityId,
    staleTime: 30000,
  });

  const expenseAccounts: ExpenseAccount[] = useMemo(() => {
    return expenseAccountsData?.data || expenseAccountsData || [];
  }, [expenseAccountsData]);

  // Fetch journal entries (expense-related transactions)
  const { data: journalEntriesData, isLoading: loadingJournals } = useQuery({
    queryKey: ['expense-journals', facilityId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facilityId) params.append('facilityId', facilityId);
      // Fetch posted entries
      params.append('status', 'posted');
      const response = await api.get(`/finance/journals?${params.toString()}`);
      return response.data;
    },
    enabled: !!facilityId,
    staleTime: 30000,
  });

  // Filter journal entries to only include expense-related lines
  const expenseTransactions = useMemo(() => {
    const journals: JournalEntry[] = journalEntriesData?.data || journalEntriesData || [];
    const expenseAccountIds = new Set(expenseAccounts.map(acc => acc.id));
    const expenseAccountCodes = new Set(expenseAccounts.map(acc => acc.accountCode));
    
    // Extract expense lines from journal entries
    const transactions: Array<{
      id: string;
      journalId: string;
      journalNumber: string;
      date: string;
      description: string;
      accountCode: string;
      accountName: string;
      amount: number;
      createdBy: string;
    }> = [];

    journals.forEach(journal => {
      if (journal.lines) {
        journal.lines.forEach(line => {
          // Check if this line is for an expense account (debit side increases expenses)
          if (line.debit > 0 && (expenseAccountIds.has(line.accountId) || expenseAccountCodes.has(line.accountCode))) {
            transactions.push({
              id: line.id,
              journalId: journal.id,
              journalNumber: journal.journalNumber,
              date: journal.journalDate,
              description: line.description || journal.description,
              accountCode: line.accountCode,
              accountName: line.accountName,
              amount: line.debit,
              createdBy: journal.createdBy ? `${journal.createdBy.firstName} ${journal.createdBy.lastName}` : 'System',
            });
          }
        });
      }
    });

    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [journalEntriesData, expenseAccounts]);

  const isLoading = loadingAccounts || loadingJournals;

  // Filter expense transactions by search
  const filteredTransactions = useMemo(() => {
    return expenseTransactions.filter((transaction) => {
      const matchesSearch =
        transaction.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.journalNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [searchQuery, expenseTransactions]);

  // Legacy filtered expenses (for modal compatibility)
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.vendor.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchQuery, categoryFilter, statusFilter]);

  // Summary stats from expense accounts
  const summaryStats = useMemo(() => {
    const totalAccountBalances = expenseAccounts.reduce((sum, acc) => sum + Number(acc.currentBalance || 0), 0);
    const totalTransactions = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = expenseTransactions.length;
    const accountCount = expenseAccounts.length;
    return { 
      total: totalAccountBalances || totalTransactions, 
      pending: 0, 
      approved: totalTransactions, 
      pendingCount: 0,
      transactionCount,
      accountCount,
    };
  }, [expenseAccounts, expenseTransactions]);

  // Category stats from expense accounts by category
  const categoryStats = useMemo(() => {
    const stats: Record<ExpenseCategory, { actual: number; budget: number }> = {} as Record<ExpenseCategory, { actual: number; budget: number }>;
    
    // Map backend account categories to frontend categories
    const categoryMap: Record<string, ExpenseCategory> = {
      'salaries': 'salaries',
      'supplies': 'supplies',
      'utilities': 'utilities',
      'depreciation': 'other',
      'other_expense': 'other',
    };
    
    Object.keys(categoryConfig).forEach((cat) => {
      const category = cat as ExpenseCategory;
      stats[category] = { actual: 0, budget: categoryConfig[category].budget };
    });
    
    // Aggregate expense account balances by category
    expenseAccounts.forEach((acc) => {
      const mappedCategory = categoryMap[acc.accountCategory] || 'other';
      if (stats[mappedCategory]) {
        stats[mappedCategory].actual += Number(acc.currentBalance || 0);
      }
    });
    
    return stats;
  }, [expenseAccounts]);



  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="text-sm text-gray-500 mt-1">Track and manage organizational expenses</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Record Expense
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 rounded-lg p-3 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Receipt className="w-4 h-4" />
              Total Expense Balance
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(summaryStats.total)}
            </p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Posted Transactions
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(summaryStats.approved)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-center gap-2 text-purple-600 text-sm">
              <FileText className="w-4 h-4" />
              Transaction Count
            </div>
            <p className="text-xl font-bold text-purple-700 mt-1">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : summaryStats.transactionCount}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <BookOpen className="w-4 h-4" />
              Expense Accounts
            </div>
            <p className="text-xl font-bold text-blue-700 mt-1">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : summaryStats.accountCount}
            </p>
          </div>
        </div>
      </div>

      {/* Category Budget Summary */}
      <div className="bg-white border-b px-6 py-3">
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Budget vs Actual by Category</p>
        <div className="grid grid-cols-7 gap-2">
          {Object.entries(categoryStats).map(([cat, stats]) => {
            const category = cat as ExpenseCategory;
            const percentage = (stats.actual / stats.budget) * 100;
            const isOverBudget = percentage > 100;
            return (
              <div key={cat} className="text-center">
                <div className="text-xs text-gray-600 truncate">{categoryConfig[category].label}</div>
                <div className="h-2 bg-gray-200 rounded-full mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                <div className={`text-xs mt-0.5 ${isOverBudget ? 'text-red-600' : 'text-gray-600'}`}>
                  {percentage.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {Object.entries(categoryConfig).map(([cat, config]) => (
              <option key={cat} value={cat}>{config.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ExpenseStatus | 'all')}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {Object.entries(statusConfig).map(([status, config]) => (
              <option key={status} value={status}>{config.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <Filter className="w-4 h-4" />
            More
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expense Transactions List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {/* Backend Support Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Expense Tracking via Journal Entries</p>
            <p className="text-xs text-amber-700 mt-1">
              Expenses are currently derived from journal entries with expense account debits. 
              For full expense management with approval workflows, a dedicated expense module is needed.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
            <p className="text-gray-600">Loading expense data...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Journal #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Expense Account</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(transaction.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-blue-600">{transaction.journalNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{transaction.description || 'No description'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">{transaction.accountName}</span>
                        <span className="text-xs text-gray-500">{transaction.accountCode}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-900">{formatCurrency(transaction.amount)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transaction.createdBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTransactions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No expense transactions found</p>
                <p className="text-sm mt-1">Create journal entries with expense account debits to track expenses</p>
              </div>
            )}
          </div>
        )}

        {/* Expense Accounts Summary */}
        {!isLoading && expenseAccounts.length > 0 && (
          <div className="mt-4 bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Expense Account Balances</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {expenseAccounts.slice(0, 8).map((account) => (
                <div key={account.id} className="bg-gray-50 rounded-lg p-3 border">
                  <p className="text-xs text-gray-500 truncate">{account.accountCode}</p>
                  <p className="text-sm font-medium text-gray-900 truncate" title={account.accountName}>
                    {account.accountName}
                  </p>
                  <p className="text-lg font-bold text-orange-600 mt-1">
                    {formatCurrency(Number(account.currentBalance || 0))}
                  </p>
                </div>
              ))}
            </div>
            {expenseAccounts.length > 8 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                And {expenseAccounts.length - 8} more expense accounts...
              </p>
            )}
          </div>
        )}
      </div>

      {/* View Expense Modal */}
      {viewingExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Expense Details</h2>
              <button onClick={() => setViewingExpense(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{viewingExpense.date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-bold text-xl">{formatCurrency(viewingExpense.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Category</p>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${categoryConfig[viewingExpense.category].color}`}>
                    {categoryConfig[viewingExpense.category].label}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[viewingExpense.status].color}`}>
                    {statusConfig[viewingExpense.status].label}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium">{viewingExpense.description}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vendor</p>
                <p className="font-medium flex items-center gap-1">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  {viewingExpense.vendor}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Submitted By</p>
                  <p className="font-medium">{viewingExpense.submittedBy}</p>
                </div>
                {viewingExpense.approvedBy && (
                  <div>
                    <p className="text-sm text-gray-500">Approved By</p>
                    <p className="font-medium">{viewingExpense.approvedBy}</p>
                  </div>
                )}
              </div>
              {viewingExpense.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-sm text-gray-700">{viewingExpense.notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Paperclip className={`w-4 h-4 ${viewingExpense.receiptAttached ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="text-sm">
                  {viewingExpense.receiptAttached ? 'Receipt attached' : 'No receipt attached'}
                </span>
                {viewingExpense.receiptAttached && (
                  <button className="text-sm text-blue-600 hover:underline ml-auto">View Receipt</button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              {viewingExpense.status === 'pending' && (
                <>
                  <button className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                </>
              )}
              {viewingExpense.status === 'approved' && (
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <DollarSign className="w-4 h-4" />
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Expense Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Record New Expense</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({CURRENCY_SYMBOL})</label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select category</option>
                  {Object.entries(categoryConfig).map(([cat, config]) => (
                    <option key={cat} value={cat}>{config.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Vendor name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Expense description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-gray-50 cursor-pointer">
                  <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">Click to upload or drag and drop</p>
                  <p className="text-xs text-gray-400">PDF, PNG, JPG up to 5MB</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Submit Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}