import { useState, useMemo } from 'react';
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

const mockExpenses: Expense[] = [
  { id: '1', date: '2024-01-18', category: 'supplies', description: 'Medical gloves and masks', vendor: 'MedSupply Kenya', amount: 45000, status: 'approved', submittedBy: 'Jane Nurse', approvedBy: 'Dr. Omondi', receiptAttached: true, notes: 'Monthly restock' },
  { id: '2', date: '2024-01-17', category: 'utilities', description: 'Electricity bill - January', vendor: 'Kenya Power', amount: 85000, status: 'paid', submittedBy: 'Finance Dept', approvedBy: 'CFO', receiptAttached: true, notes: '' },
  { id: '3', date: '2024-01-17', category: 'maintenance', description: 'X-Ray machine repair', vendor: 'Philips Medical', amount: 250000, status: 'pending', submittedBy: 'Radiology Dept', receiptAttached: false, notes: 'Urgent repair needed' },
  { id: '4', date: '2024-01-16', category: 'supplies', description: 'Lab reagents', vendor: 'Sigma Aldrich', amount: 120000, status: 'approved', submittedBy: 'Lab Manager', approvedBy: 'Dr. Kimani', receiptAttached: true, notes: '' },
  { id: '5', date: '2024-01-15', category: 'travel', description: 'Conference attendance - Nairobi', vendor: 'Various', amount: 35000, status: 'rejected', submittedBy: 'Dr. Wanjiru', receiptAttached: true, notes: 'Budget exceeded' },
  { id: '6', date: '2024-01-15', category: 'equipment', description: 'New blood pressure monitors (5)', vendor: 'Omron Healthcare', amount: 75000, status: 'paid', submittedBy: 'Procurement', approvedBy: 'CFO', receiptAttached: true, notes: '' },
  { id: '7', date: '2024-01-14', category: 'utilities', description: 'Water bill - January', vendor: 'Nairobi Water', amount: 25000, status: 'paid', submittedBy: 'Finance Dept', approvedBy: 'CFO', receiptAttached: true, notes: '' },
  { id: '8', date: '2024-01-13', category: 'other', description: 'Staff lunch meeting', vendor: 'Java House', amount: 12000, status: 'pending', submittedBy: 'HR Dept', receiptAttached: true, notes: 'Quarterly team building' },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const filteredExpenses = useMemo(() => {
    return mockExpenses.filter((expense) => {
      const matchesSearch =
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.vendor.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchQuery, categoryFilter, statusFilter]);

  const summaryStats = useMemo(() => {
    const total = mockExpenses.reduce((sum, e) => sum + e.amount, 0);
    const pending = mockExpenses.filter((e) => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);
    const approved = mockExpenses.filter((e) => e.status === 'approved' || e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
    const pendingCount = mockExpenses.filter((e) => e.status === 'pending').length;
    return { total, pending, approved, pendingCount };
  }, []);

  const categoryStats = useMemo(() => {
    const stats: Record<ExpenseCategory, { actual: number; budget: number }> = {} as Record<ExpenseCategory, { actual: number; budget: number }>;
    Object.keys(categoryConfig).forEach((cat) => {
      const category = cat as ExpenseCategory;
      const actual = mockExpenses
        .filter((e) => e.category === category && (e.status === 'approved' || e.status === 'paid'))
        .reduce((sum, e) => sum + e.amount, 0);
      stats[category] = { actual, budget: categoryConfig[category].budget };
    });
    return stats;
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

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
              Total This Month
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(summaryStats.total)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              Approved/Paid
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(summaryStats.approved)}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-600 text-sm">
              <Clock className="w-4 h-4" />
              Pending Approval
            </div>
            <p className="text-xl font-bold text-yellow-700 mt-1">{formatCurrency(summaryStats.pending)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Items Pending
            </div>
            <p className="text-xl font-bold text-blue-700 mt-1">{summaryStats.pendingCount}</p>
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

      {/* Expense List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredExpenses.map((expense) => {
                const StatusIcon = statusConfig[expense.status].icon;
                return (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {expense.date}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                      <p className="text-xs text-gray-500">Submitted by {expense.submittedBy}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${categoryConfig[expense.category].color}`}>
                        {categoryConfig[expense.category].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {expense.vendor}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-gray-900">{formatCurrency(expense.amount)}</span>
                      {expense.amount > 100000 && (
                        <span className="block text-xs text-orange-600">Requires approval</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[expense.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig[expense.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {expense.receiptAttached && (
                          <span className="p-1.5 text-green-600" title="Receipt attached">
                            <Paperclip className="w-4 h-4" />
                          </span>
                        )}
                        <button
                          onClick={() => setViewingExpense(expense)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {expense.status === 'pending' && (
                          <>
                            <button className="p-1.5 hover:bg-green-100 rounded-lg text-green-600" title="Approve">
                              <Check className="w-4 h-4" />
                            </button>
                            <button className="p-1.5 hover:bg-red-100 rounded-lg text-red-600" title="Reject">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No expenses found</p>
            </div>
          )}
        </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (KES)</label>
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