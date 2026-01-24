import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  DollarSign,
  BookOpen,
  FileText,
  Calendar,
  Plus,
  Search,
  ChevronRight,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from 'lucide-react';

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  accountCategory: string;
  currentBalance: number;
  isHeader: boolean;
  isActive: boolean;
}

interface JournalEntry {
  id: string;
  journalNumber: string;
  journalDate: string;
  journalType: string;
  description: string;
  reference?: string;
  status: string;
  totalDebit: number;
  totalCredit: number;
}

interface DashboardStats {
  totalAccounts: number;
  draftJournals: number;
  postedJournals: number;
  openPeriods: number;
  trialBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
}

interface TrialBalance {
  asOfDate: string;
  accounts: { accountCode: string; accountName: string; debit: number; credit: number }[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

const FACILITY_ID = 'b94b30c8-f98e-4a70-825e-253224a1cb91';

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'journals' | 'reports'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const res = await api.get(`/finance/dashboard?facilityId=${FACILITY_ID}`);
        setDashboard(res.data);
      } else if (activeTab === 'accounts') {
        const res = await api.get(`/finance/accounts?facilityId=${FACILITY_ID}`);
        setAccounts(res.data || []);
      } else if (activeTab === 'journals') {
        const res = await api.get(`/finance/journals?facilityId=${FACILITY_ID}`);
        setJournals(res.data || []);
      } else if (activeTab === 'reports') {
        const res = await api.get(`/finance/reports/trial-balance?facilityId=${FACILITY_ID}`);
        setTrialBalance(res.data);
      }
    } catch (error) {
      console.error('Error loading finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      posted: 'bg-green-100 text-green-800',
      reversed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getAccountTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      asset: 'bg-blue-100 text-blue-800',
      liability: 'bg-purple-100 text-purple-800',
      equity: 'bg-indigo-100 text-indigo-800',
      revenue: 'bg-green-100 text-green-800',
      expense: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[type] || 'bg-gray-100 text-gray-800'}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const filteredAccounts = accounts.filter(acc => {
    const search = searchTerm.toLowerCase();
    return acc.accountCode.toLowerCase().includes(search) || 
           acc.accountName.toLowerCase().includes(search);
  });

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen },
    { id: 'journals', label: 'Journal Entries', icon: FileText },
    { id: 'reports', label: 'Reports', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance & Accounting</h1>
          <p className="text-gray-500">Manage chart of accounts, journal entries and financial reports</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          New Journal Entry
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && dashboard && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Accounts</p>
                      <p className="text-2xl font-bold text-gray-900">{dashboard.totalAccounts}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <BookOpen className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Draft Journals</p>
                      <p className="text-2xl font-bold text-yellow-600">{dashboard.draftJournals}</p>
                    </div>
                    <div className="p-3 bg-yellow-100 rounded-full">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Posted Journals</p>
                      <p className="text-2xl font-bold text-green-600">{dashboard.postedJournals}</p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Trial Balance</p>
                      <p className={`text-2xl font-bold ${dashboard.trialBalanced ? 'text-green-600' : 'text-red-600'}`}>
                        {dashboard.trialBalanced ? 'Balanced' : 'Unbalanced'}
                      </p>
                    </div>
                    <div className={`p-3 rounded-full ${dashboard.trialBalanced ? 'bg-green-100' : 'bg-red-100'}`}>
                      {dashboard.trialBalanced ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <TrendingDown className="h-6 w-6 text-red-600" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Trial Balance Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Debits</span>
                      <span className="font-semibold text-blue-600">{formatCurrency(dashboard.totalDebit)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Total Credits</span>
                      <span className="font-semibold text-green-600">{formatCurrency(dashboard.totalCredit)}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="text-gray-600">Difference</span>
                      <span className={`font-semibold ${Math.abs(dashboard.totalDebit - dashboard.totalCredit) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(dashboard.totalDebit - dashboard.totalCredit))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                      <Plus className="h-5 w-5 text-gray-400" />
                      <span>Create Journal Entry</span>
                    </button>
                    <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <span>Setup Fiscal Year</span>
                    </button>
                    <button className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <span>View Financial Statements</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chart of Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="flex gap-6">
              <div className="flex-1 bg-white rounded-lg shadow">
                <div className="p-4 border-b flex justify-between items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search accounts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button className="ml-4 flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Plus className="h-4 w-4" />
                    Add Account
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAccounts.map(acc => (
                        <tr
                          key={acc.id}
                          onClick={() => setSelectedAccount(acc)}
                          className={`cursor-pointer hover:bg-gray-50 ${selectedAccount?.id === acc.id ? 'bg-blue-50' : ''} ${acc.isHeader ? 'font-semibold bg-gray-50' : ''}`}
                        >
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-mono">{acc.accountCode}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm">{acc.accountName}</td>
                          <td className="px-6 py-3 whitespace-nowrap">{getAccountTypeBadge(acc.accountType)}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono">
                            {acc.isHeader ? '-' : formatCurrency(acc.currentBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Journal Entries Tab */}
          {activeTab === 'journals' && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold">Journal Entries</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  New Entry
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {journals.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          No journal entries found
                        </td>
                      </tr>
                    ) : (
                      journals.map(je => (
                        <tr key={je.id} className="hover:bg-gray-50 cursor-pointer">
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-mono">{je.journalNumber}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm">
                            {new Date(je.journalDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm capitalize">{je.journalType}</td>
                          <td className="px-6 py-3 text-sm max-w-xs truncate">{je.description || '-'}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono">
                            {formatCurrency(je.totalDebit)}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono">
                            {formatCurrency(je.totalCredit)}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">{getStatusBadge(je.status)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && trialBalance && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Trial Balance</h3>
                  <p className="text-sm text-gray-500">As of {trialBalance.asOfDate}</p>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${trialBalance.isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {trialBalance.isBalanced ? <CheckCircle className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="text-sm font-medium">{trialBalance.isBalanced ? 'Balanced' : 'Unbalanced'}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {trialBalance.accounts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          No account balances to display
                        </td>
                      </tr>
                    ) : (
                      trialBalance.accounts.map((acc, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-mono">{acc.accountCode}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm">{acc.accountName}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono">
                            {acc.debit > 0 ? formatCurrency(acc.debit) : ''}
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-mono">
                            {acc.credit > 0 ? formatCurrency(acc.credit) : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-gray-100 font-semibold">
                    <tr>
                      <td colSpan={2} className="px-6 py-3 text-right">Totals</td>
                      <td className="px-6 py-3 text-right font-mono">{formatCurrency(trialBalance.totalDebit)}</td>
                      <td className="px-6 py-3 text-right font-mono">{formatCurrency(trialBalance.totalCredit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
