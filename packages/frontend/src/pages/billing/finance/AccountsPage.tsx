import { useState, useMemo } from 'react';
import { formatCurrency } from '../../../lib/currency';
import {
  BookOpen,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  X,
  Wallet,
  CreditCard,
  Scale,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
} from 'lucide-react';

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
type AccountStatus = 'active' | 'inactive';

interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  balance: number;
  status: AccountStatus;
  description: string;
  children?: Account[];
}

const accounts: Account[] = [];

const accountTypeConfig: Record<AccountType, { label: string; color: string; icon: React.ElementType }> = {
  asset: { label: 'Assets', color: 'bg-blue-100 text-blue-700', icon: Wallet },
  liability: { label: 'Liabilities', color: 'bg-red-100 text-red-700', icon: CreditCard },
  equity: { label: 'Equity', color: 'bg-purple-100 text-purple-700', icon: Scale },
  revenue: { label: 'Revenue', color: 'bg-green-100 text-green-700', icon: TrendingUp },
  expense: { label: 'Expenses', color: 'bg-orange-100 text-orange-700', icon: TrendingDown },
};

const buildTree = (accounts: Account[]): Account[] => {
  const map = new Map<string, Account>();
  const roots: Account[] = [];

  accounts.forEach((acc) => {
    map.set(acc.id, { ...acc, children: [] });
  });

  accounts.forEach((acc) => {
    const node = map.get(acc.id)!;
    if (acc.parentId && map.has(acc.parentId)) {
      map.get(acc.parentId)!.children!.push(node);
    } else if (!acc.parentId) {
      roots.push(node);
    }
  });

  return roots;
};

export default function AccountsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all');
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const accountTree = useMemo(() => buildTree(accounts), []);

  const filteredTree = useMemo(() => {
    if (typeFilter === 'all' && !searchQuery) return accountTree;

    const filterAccount = (acc: Account): Account | null => {
      const matchesSearch = !searchQuery ||
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        acc.code.includes(searchQuery);
      const matchesType = typeFilter === 'all' || acc.type === typeFilter;

      const filteredChildren = acc.children?.map(filterAccount).filter(Boolean) as Account[];

      if ((matchesSearch && matchesType) || (filteredChildren && filteredChildren.length > 0)) {
        return { ...acc, children: filteredChildren || [] };
      }
      return null;
    };

    return accountTree.map(filterAccount).filter(Boolean) as Account[];
  }, [accountTree, searchQuery, typeFilter]);

  const summaryStats = useMemo(() => {
    const byType = accounts.filter((a) => !a.parentId).reduce(
      (acc, account) => {
        acc[account.type] = account.balance;
        return acc;
      },
      {} as Record<AccountType, number>
    );
    return byType;
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };



  const renderAccountRow = (account: Account, depth: number = 0): React.ReactNode => {
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const TypeIcon = accountTypeConfig[account.type].icon;

    return (
      <div key={account.id}>
        <div
          className={`flex items-center py-2.5 px-4 hover:bg-gray-50 border-b ${depth === 0 ? 'bg-gray-50 font-semibold' : ''}`}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
        >
          <div className="flex items-center flex-1 min-w-0">
            <button
              onClick={() => hasChildren && toggleExpand(account.id)}
              className={`mr-2 ${hasChildren ? 'text-gray-400 hover:text-gray-600' : 'invisible'}`}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <span className="text-gray-500 text-sm w-16 mr-3">{account.code}</span>
            <TypeIcon className="w-4 h-4 mr-2 text-gray-400" />
            <span className="truncate">{account.name}</span>
            {account.status === 'inactive' && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">Inactive</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className={`font-medium ${account.type === 'expense' ? 'text-red-600' : account.type === 'revenue' ? 'text-green-600' : 'text-gray-900'}`}>
              {formatCurrency(account.balance)}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEditingAccount(account);
                  setShowModal(true);
                }}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-500"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button className="p-1.5 hover:bg-gray-200 rounded text-gray-400 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {isExpanded && hasChildren && account.children!.map((child) => renderAccountRow(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your organization's account structure</p>
          </div>
          <button
            onClick={() => {
              setEditingAccount(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-4 mt-4">
          {Object.entries(accountTypeConfig).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <div key={type} className={`rounded-lg p-3 border ${config.color.replace('text-', 'border-').replace('100', '200')}`}>
                <div className={`flex items-center gap-2 text-sm ${config.color.split(' ')[1]}`}>
                  <Icon className="w-4 h-4" />
                  {config.label}
                </div>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {formatCurrency(summaryStats[type as AccountType] || 0)}
                </p>
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
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AccountType | 'all')}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            {Object.entries(accountTypeConfig).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>
          <button
            onClick={() => setExpandedAccounts(new Set(accounts.map((a) => a.id)))}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Expand All
          </button>
          <button
            onClick={() => setExpandedAccounts(new Set())}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Account Tree */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="flex items-center py-2 px-4 bg-gray-100 border-b text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <div className="flex-1">Account</div>
            <div className="w-40 text-right mr-16">Balance</div>
          </div>
          {filteredTree.length > 0 ? (
            filteredTree.map((account) => renderAccountRow(account))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No accounts found</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
                  <input
                    type="text"
                    defaultValue={editingAccount?.code}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                  <select
                    defaultValue={editingAccount?.type || 'asset'}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(accountTypeConfig).map(([type, config]) => (
                      <option key={type} value={type}>{config.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  defaultValue={editingAccount?.name}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter account name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Account</label>
                <select
                  defaultValue={editingAccount?.parentId || ''}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No Parent (Top Level)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  defaultValue={editingAccount?.description}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" name="status" defaultChecked={editingAccount?.status !== 'inactive'} />
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm">Active</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="status" defaultChecked={editingAccount?.status === 'inactive'} />
                  <XCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">Inactive</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingAccount ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
