import { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  ChevronDown,
  ChevronRight,
  Eye,
  Mail,
  Clock,
  Plus,
  Settings,
  BarChart3,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  Scale,
  CheckCircle2,
  Play,
  X,
  FileSpreadsheet,
} from 'lucide-react';

type ReportType = 'income_statement' | 'balance_sheet' | 'cash_flow' | 'trial_balance';
type ReportStatus = 'ready' | 'generating' | 'scheduled';

interface Report {
  id: string;
  type: ReportType;
  name: string;
  dateRange: string;
  generatedAt: string;
  generatedBy: string;
  status: ReportStatus;
}

interface ScheduledReport {
  id: string;
  type: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly';
  nextRun: string;
  recipients: string[];
  active: boolean;
}

const reports: Report[] = [];

const scheduledReports: ScheduledReport[] = [];

const reportTypeConfig: Record<ReportType, { label: string; description: string; icon: React.ElementType; color: string }> = {
  income_statement: { label: 'Income Statement', description: 'Revenue and expenses over a period', icon: TrendingUp, color: 'bg-green-100 text-green-700' },
  balance_sheet: { label: 'Balance Sheet', description: 'Assets, liabilities, and equity snapshot', icon: Scale, color: 'bg-blue-100 text-blue-700' },
  cash_flow: { label: 'Cash Flow Statement', description: 'Cash inflows and outflows', icon: ArrowRightLeft, color: 'bg-purple-100 text-purple-700' },
  trial_balance: { label: 'Trial Balance', description: 'Debit and credit balances of all accounts', icon: Wallet, color: 'bg-orange-100 text-orange-700' },
};

const incomeStatementData: { revenue: { account: string; amount: number }[]; expenses: { account: string; amount: number }[] } = {
  revenue: [],
  expenses: [],
};

const balanceSheetData: { assets: { account: string; amount: number }[]; liabilities: { account: string; amount: number }[]; equity: { account: string; amount: number }[] } = {
  assets: [],
  liabilities: [],
  equity: [],
};

export default function FinancialReportsPage() {
  const [selectedType, setSelectedType] = useState<ReportType | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('2024-01-01');
  const [dateTo, setDateTo] = useState('2024-01-31');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateType, setGenerateType] = useState<ReportType>('income_statement');
  const [previewReport, setPreviewReport] = useState<Report | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      return selectedType === 'all' || report.type === selectedType;
    });
  }, [selectedType]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  const renderIncomeStatement = () => {
    const totalRevenue = incomeStatementData.revenue.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = incomeStatementData.expenses.reduce((sum, item) => sum + item.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    if (incomeStatementData.revenue.length === 0 && incomeStatementData.expenses.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No income statement data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Revenue
          </h3>
          <table className="w-full">
            <tbody className="divide-y">
              {incomeStatementData.revenue.map((item) => (
                <tr key={item.account}>
                  <td className="py-2 text-sm text-gray-600 pl-4">{item.account}</td>
                  <td className="py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(item.amount)}</td>
                  {compareWithPrevious && (
                    <td className="py-2 text-sm text-right text-gray-500">{formatCurrency(item.amount * 0.95)}</td>
                  )}
                </tr>
              ))}
              <tr className="bg-green-50">
                <td className="py-2 font-semibold text-green-700 pl-4">Total Revenue</td>
                <td className="py-2 text-right font-bold text-green-700">{formatCurrency(totalRevenue)}</td>
                {compareWithPrevious && (
                  <td className="py-2 text-right font-medium text-gray-600">{formatCurrency(totalRevenue * 0.95)}</td>
                )}
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-red-600" />
            Expenses
          </h3>
          <table className="w-full">
            <tbody className="divide-y">
              {incomeStatementData.expenses.map((item) => (
                <tr key={item.account}>
                  <td className="py-2 text-sm text-gray-600 pl-4">{item.account}</td>
                  <td className="py-2 text-sm text-right font-medium text-gray-900">{formatCurrency(item.amount)}</td>
                  {compareWithPrevious && (
                    <td className="py-2 text-sm text-right text-gray-500">{formatCurrency(item.amount * 0.92)}</td>
                  )}
                </tr>
              ))}
              <tr className="bg-red-50">
                <td className="py-2 font-semibold text-red-700 pl-4">Total Expenses</td>
                <td className="py-2 text-right font-bold text-red-700">{formatCurrency(totalExpenses)}</td>
                {compareWithPrevious && (
                  <td className="py-2 text-right font-medium text-gray-600">{formatCurrency(totalExpenses * 0.92)}</td>
                )}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-t pt-4">
          <div className={`flex items-center justify-between p-3 rounded-lg ${netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className={`font-bold ${netIncome >= 0 ? 'text-green-800' : 'text-red-800'}`}>Net Income</span>
            <span className={`text-xl font-bold ${netIncome >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {formatCurrency(netIncome)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderBalanceSheet = () => {
    const totalAssets = balanceSheetData.assets.reduce((sum, item) => sum + item.amount, 0);
    const totalLiabilities = balanceSheetData.liabilities.reduce((sum, item) => sum + item.amount, 0);
    const totalEquity = balanceSheetData.equity.reduce((sum, item) => sum + item.amount, 0);

    if (balanceSheetData.assets.length === 0 && balanceSheetData.liabilities.length === 0 && balanceSheetData.equity.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <Scale className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No balance sheet data available</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Assets
          </h3>
          <table className="w-full">
            <tbody className="divide-y">
              {balanceSheetData.assets.map((item) => (
                <tr key={item.account}>
                  <td className="py-2 text-sm text-gray-600">{item.account}</td>
                  <td className="py-2 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              <tr className="bg-blue-50">
                <td className="py-2 font-semibold text-blue-700">Total Assets</td>
                <td className="py-2 text-right font-bold text-blue-700">{formatCurrency(totalAssets)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-red-600" />
              Liabilities
            </h3>
            <table className="w-full">
              <tbody className="divide-y">
                {balanceSheetData.liabilities.map((item) => (
                  <tr key={item.account}>
                    <td className="py-2 text-sm text-gray-600">{item.account}</td>
                    <td className="py-2 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-red-50">
                  <td className="py-2 font-semibold text-red-700">Total Liabilities</td>
                  <td className="py-2 text-right font-bold text-red-700">{formatCurrency(totalLiabilities)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-600" />
              Equity
            </h3>
            <table className="w-full">
              <tbody className="divide-y">
                {balanceSheetData.equity.map((item) => (
                  <tr key={item.account}>
                    <td className="py-2 text-sm text-gray-600">{item.account}</td>
                    <td className="py-2 text-sm text-right font-medium">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-purple-50">
                  <td className="py-2 font-semibold text-purple-700">Total Equity</td>
                  <td className="py-2 text-right font-bold text-purple-700">{formatCurrency(totalEquity)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-100">
              <span className="font-bold text-gray-800">Liabilities + Equity</span>
              <span className="text-lg font-bold text-gray-800">{formatCurrency(totalLiabilities + totalEquity)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Generate and manage financial statements</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Clock className="w-4 h-4" />
              Scheduled Reports
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        </div>

        {/* Report Type Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          {Object.entries(reportTypeConfig).map(([type, config]) => {
            const Icon = config.icon;
            const count = reports.filter((r) => r.type === type).length;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(selectedType === type ? 'all' : type as ReportType)}
                className={`rounded-lg p-3 border text-left transition-colors ${selectedType === type ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${config.color} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{config.label}</p>
                    <p className="text-xs text-gray-500">{count} reports</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Report List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Report</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date Range</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Generated</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredReports.map((report) => {
                const config = reportTypeConfig[report.type];
                const Icon = config.icon;
                return (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{report.name}</p>
                          <p className="text-xs text-gray-500">{config.label}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {report.dateRange}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-900">{report.generatedAt}</p>
                      <p className="text-xs text-gray-500">by {report.generatedBy}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewReport(report)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Download PDF">
                          <Download className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Export Excel">
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Print">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700" title="Email">
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredReports.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No reports found</p>
            </div>
          )}
        </div>
      </div>

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Generate Financial Report</h2>
              <button onClick={() => setShowGenerateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(reportTypeConfig).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => setGenerateType(type as ReportType)}
                        className={`p-3 rounded-lg border text-left transition-colors ${generateType === type ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${generateType === type ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className={`text-sm font-medium ${generateType === type ? 'text-blue-700' : 'text-gray-700'}`}>
                            {config.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="compare"
                  checked={compareWithPrevious}
                  onChange={(e) => setCompareWithPrevious(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="compare" className="text-sm text-gray-700">
                  Compare with previous period
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Play className="w-4 h-4" />
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Report Modal */}
      {previewReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{previewReport.name}</h2>
                <p className="text-sm text-gray-500">{previewReport.dateRange}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={compareWithPrevious}
                    onChange={(e) => setCompareWithPrevious(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Compare
                </label>
                <button className="p-2 hover:bg-gray-100 rounded-lg" title="Download PDF">
                  <Download className="w-5 h-5 text-gray-500" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg" title="Print">
                  <Printer className="w-5 h-5 text-gray-500" />
                </button>
                <button onClick={() => setPreviewReport(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-140px)]">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-gray-900">Sample Hospital</h1>
                  <h2 className="text-lg font-semibold text-gray-700">{reportTypeConfig[previewReport.type].label}</h2>
                  <p className="text-sm text-gray-500">For the period {previewReport.dateRange}</p>
                </div>

                {compareWithPrevious && (
                  <div className="mb-4 flex justify-end">
                    <div className="flex gap-4 text-sm">
                      <span className="font-medium">Current Period</span>
                      <span className="text-gray-500">Previous Period</span>
                    </div>
                  </div>
                )}

                {previewReport.type === 'income_statement' && renderIncomeStatement()}
                {previewReport.type === 'balance_sheet' && renderBalanceSheet()}
                {(previewReport.type === 'cash_flow' || previewReport.type === 'trial_balance') && (
                  <div className="text-center py-12 text-gray-500">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Report preview for {reportTypeConfig[previewReport.type].label}</p>
                    <p className="text-sm">Full data would be displayed here</p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100">
                <FileSpreadsheet className="w-4 h-4" />
                Export to Excel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Reports Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Scheduled Reports</h2>
              <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(80vh-140px)]">
              {scheduledReports.length > 0 ? (
                <div className="space-y-3">
                  {scheduledReports.map((schedule) => {
                    const config = reportTypeConfig[schedule.type];
                    const Icon = config.icon;
                    return (
                      <div key={schedule.id} className={`p-4 rounded-lg border ${schedule.active ? '' : 'opacity-60'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{config.label}</p>
                              <p className="text-sm text-gray-500 capitalize">{schedule.frequency}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Next run: {schedule.nextRun}</p>
                              <p className="text-xs text-gray-500">{schedule.recipients.join(', ')}</p>
                            </div>
                            <button className="p-2 hover:bg-gray-100 rounded-lg">
                              <Settings className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No scheduled reports</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                Schedule New Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}