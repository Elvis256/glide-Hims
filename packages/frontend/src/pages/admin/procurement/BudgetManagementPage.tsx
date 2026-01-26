import { useState, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Edit2,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  PieChart,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
} from 'lucide-react';

interface Budget {
  id: string;
  department: string;
  category: string;
  annualBudget: number;
  allocated: number;
  spent: number;
  committed: number;
  period: 'annual' | 'quarterly';
  fiscalYear: string;
  lastUpdated: string;
}

interface TransferRequest {
  id: string;
  fromDepartment: string;
  toDepartment: string;
  amount: number;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

const mockBudgets: Budget[] = [
  { id: '1', department: 'Pharmacy', category: 'Medical Supplies', annualBudget: 5000000, allocated: 1250000, spent: 980000, committed: 150000, period: 'quarterly', fiscalYear: '2024', lastUpdated: '2024-01-20' },
  { id: '2', department: 'Laboratory', category: 'Reagents & Consumables', annualBudget: 3000000, allocated: 750000, spent: 720000, committed: 50000, period: 'quarterly', fiscalYear: '2024', lastUpdated: '2024-01-18' },
  { id: '3', department: 'Radiology', category: 'Equipment Maintenance', annualBudget: 2000000, allocated: 500000, spent: 280000, committed: 100000, period: 'quarterly', fiscalYear: '2024', lastUpdated: '2024-01-15' },
  { id: '4', department: 'Nursing', category: 'Patient Care Supplies', annualBudget: 1500000, allocated: 375000, spent: 360000, committed: 20000, period: 'quarterly', fiscalYear: '2024', lastUpdated: '2024-01-19' },
  { id: '5', department: 'Administration', category: 'Office Supplies', annualBudget: 500000, allocated: 125000, spent: 45000, committed: 10000, period: 'quarterly', fiscalYear: '2024', lastUpdated: '2024-01-10' },
  { id: '6', department: 'IT', category: 'Software & Hardware', annualBudget: 2500000, allocated: 625000, spent: 520000, committed: 80000, period: 'quarterly', fiscalYear: '2024', lastUpdated: '2024-01-22' },
  { id: '7', department: 'Maintenance', category: 'Facility Maintenance', annualBudget: 1800000, allocated: 450000, spent: 380000, committed: 90000, period: 'quarterly', fiscalYear: '2024', lastUpdated: '2024-01-21' },
];

const mockTransfers: TransferRequest[] = [
  { id: '1', fromDepartment: 'Administration', toDepartment: 'Laboratory', amount: 50000, reason: 'Urgent reagent purchase', requestedBy: 'John Doe', requestedAt: '2024-01-20', status: 'pending' },
  { id: '2', fromDepartment: 'Radiology', toDepartment: 'Pharmacy', amount: 100000, reason: 'Additional medication stock', requestedBy: 'Jane Smith', requestedAt: '2024-01-18', status: 'approved' },
  { id: '3', fromDepartment: 'IT', toDepartment: 'Nursing', amount: 30000, reason: 'PPE procurement', requestedBy: 'Mike Johnson', requestedAt: '2024-01-15', status: 'rejected' },
];

export default function BudgetManagementPage() {
  const [budgets] = useState(mockBudgets);
  const [transfers] = useState(mockTransfers);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>('all');
  const [showTransferPanel, setShowTransferPanel] = useState(false);

  const filteredBudgets = useMemo(() => {
    return budgets.filter(b =>
      b.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [budgets, searchTerm]);

  const stats = useMemo(() => {
    const totalBudget = budgets.reduce((sum, b) => sum + b.annualBudget, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
    const totalCommitted = budgets.reduce((sum, b) => sum + b.committed, 0);
    return {
      totalBudget,
      totalSpent,
      totalCommitted,
      available: totalBudget - totalSpent - totalCommitted,
      utilizationRate: Math.round((totalSpent / totalBudget) * 100),
      criticalBudgets: budgets.filter(b => ((b.spent + b.committed) / b.allocated) >= 0.9).length,
      pendingTransfers: transfers.filter(t => t.status === 'pending').length,
    };
  }, [budgets, transfers]);

  const getUtilizationColor = (spent: number, committed: number, allocated: number) => {
    const utilization = ((spent + committed) / allocated) * 100;
    if (utilization >= 100) return 'bg-red-500';
    if (utilization >= 90) return 'bg-amber-500';
    if (utilization >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getUtilizationBadge = (spent: number, committed: number, allocated: number) => {
    const utilization = ((spent + committed) / allocated) * 100;
    if (utilization >= 100) return { text: 'Exceeded', class: 'bg-red-100 text-red-700' };
    if (utilization >= 90) return { text: 'Critical', class: 'bg-amber-100 text-amber-700' };
    if (utilization >= 80) return { text: 'Warning', class: 'bg-yellow-100 text-yellow-700' };
    return { text: 'Healthy', class: 'bg-green-100 text-green-700' };
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Budget Management</h1>
              <p className="text-sm text-gray-500">Manage department budgets and allocations</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTransferPanel(!showTransferPanel)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${
                showTransferPanel ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfers
              {stats.pendingTransfers > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">{stats.pendingTransfers}</span>
              )}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
              <Plus className="w-4 h-4" />
              Add Budget
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-500">Total Annual Budget</div>
            <div className="text-xl font-bold text-gray-900">KES {(stats.totalBudget / 1000000).toFixed(1)}M</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-blue-600">
              <TrendingUp className="w-4 h-4" />
              Spent YTD
            </div>
            <div className="text-xl font-bold text-blue-700">KES {(stats.totalSpent / 1000000).toFixed(1)}M</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="text-sm text-purple-600">Committed</div>
            <div className="text-xl font-bold text-purple-700">KES {(stats.totalCommitted / 1000000).toFixed(1)}M</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-sm text-green-600">Available</div>
            <div className="text-xl font-bold text-green-700">KES {(stats.available / 1000000).toFixed(1)}M</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-1 text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              Critical Budgets
            </div>
            <div className="text-xl font-bold text-amber-700">{stats.criticalBudgets}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search departments or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Quarter:</span>
            {(['all', 'Q1', 'Q2', 'Q3', 'Q4'] as const).map(period => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  selectedPeriod === period
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period === 'all' ? 'All' : period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Budget Table */}
        <div className={`flex-1 overflow-auto p-6 ${showTransferPanel ? 'w-2/3' : 'w-full'}`}>
          <div className="bg-white rounded-lg border">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Department</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Allocated (Q)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Spent</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Committed</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Available</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Utilization</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredBudgets.map(budget => {
                  const available = budget.allocated - budget.spent - budget.committed;
                  const utilization = ((budget.spent + budget.committed) / budget.allocated) * 100;
                  const badge = getUtilizationBadge(budget.spent, budget.committed, budget.allocated);
                  
                  return (
                    <tr key={budget.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{budget.department}</div>
                          <div className="text-xs text-gray-500">{budget.category}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        KES {budget.allocated.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600">
                        KES {budget.spent.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-purple-600">
                        KES {budget.committed.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={available < 0 ? 'text-red-600' : 'text-green-600'}>
                          KES {available.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getUtilizationColor(budget.spent, budget.committed, budget.allocated)}`}
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 w-10">{Math.round(utilization)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${badge.class}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer Requests Panel */}
        {showTransferPanel && (
          <div className="w-1/3 border-l bg-white flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Transfer Requests</h3>
                <button className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800">
                  <Plus className="w-4 h-4" />
                  New Transfer
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {transfers.map(transfer => (
                <div key={transfer.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      transfer.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      transfer.status === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">{transfer.requestedAt}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-900">{transfer.fromDepartment}</span>
                    <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{transfer.toDepartment}</span>
                  </div>
                  
                  <div className="text-lg font-bold text-gray-900 mb-1">
                    KES {transfer.amount.toLocaleString()}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{transfer.reason}</p>
                  
                  <div className="text-xs text-gray-500">
                    Requested by {transfer.requestedBy}
                  </div>
                  
                  {transfer.status === 'pending' && (
                    <div className="flex items-center gap-2 mt-3">
                      <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
