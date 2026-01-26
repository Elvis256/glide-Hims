import { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  ArrowUp,
  ArrowDown,
  Activity,
  Users,
  Stethoscope,
  TestTube,
  Pill,
  Building,
  Clock,
  Filter,
  ChevronDown,
  BarChart3,
  PieChart,
  Target,
  AlertCircle,
} from 'lucide-react';

type RevenueSource = 'opd' | 'ipd' | 'lab' | 'pharmacy' | 'imaging' | 'procedures' | 'other';
type Period = 'daily' | 'weekly' | 'monthly';

interface RevenueData {
  source: RevenueSource;
  current: number;
  previous: number;
  target: number;
}

interface Receivable {
  id: string;
  customer: string;
  type: 'insurance' | 'corporate' | 'patient';
  amount: number;
  dueDate: string;
  aging: number;
}

interface TopGenerator {
  name: string;
  department: string;
  revenue: number;
  visits: number;
}

const mockRevenueData: RevenueData[] = [
  { source: 'opd', current: 1250000, previous: 1180000, target: 1300000 },
  { source: 'ipd', current: 2850000, previous: 2650000, target: 3000000 },
  { source: 'lab', current: 680000, previous: 720000, target: 750000 },
  { source: 'pharmacy', current: 1450000, previous: 1380000, target: 1500000 },
  { source: 'imaging', current: 520000, previous: 480000, target: 600000 },
  { source: 'procedures', current: 890000, previous: 750000, target: 900000 },
  { source: 'other', current: 180000, previous: 165000, target: 200000 },
];

const mockDailyTrend = [
  { day: 'Mon', revenue: 285000 },
  { day: 'Tue', revenue: 342000 },
  { day: 'Wed', revenue: 298000 },
  { day: 'Thu', revenue: 375000 },
  { day: 'Fri', revenue: 412000 },
  { day: 'Sat', revenue: 265000 },
  { day: 'Sun', revenue: 185000 },
];

const mockReceivables: Receivable[] = [
  { id: '1', customer: 'AAR Insurance', type: 'insurance', amount: 450000, dueDate: '2024-01-25', aging: 5 },
  { id: '2', customer: 'Jubilee Insurance', type: 'insurance', amount: 320000, dueDate: '2024-01-20', aging: 10 },
  { id: '3', customer: 'Safaricom Ltd', type: 'corporate', amount: 180000, dueDate: '2024-02-01', aging: 0 },
  { id: '4', customer: 'KCB Bank', type: 'corporate', amount: 95000, dueDate: '2024-01-15', aging: 20 },
  { id: '5', customer: 'John Mwangi', type: 'patient', amount: 45000, dueDate: '2024-01-10', aging: 25 },
];

const mockTopGenerators: TopGenerator[] = [
  { name: 'Dr. Peter Kimani', department: 'General Medicine', revenue: 450000, visits: 180 },
  { name: 'Dr. Sarah Ochieng', department: 'Pediatrics', revenue: 380000, visits: 220 },
  { name: 'Dr. James Mwangi', department: 'Surgery', revenue: 520000, visits: 45 },
  { name: 'Dr. Mary Wanjiku', department: 'OB/GYN', revenue: 340000, visits: 95 },
  { name: 'Dr. David Omondi', department: 'Cardiology', revenue: 290000, visits: 65 },
];

const sourceConfig: Record<RevenueSource, { label: string; icon: React.ElementType; color: string }> = {
  opd: { label: 'OPD', icon: Stethoscope, color: 'bg-blue-500' },
  ipd: { label: 'IPD', icon: Building, color: 'bg-purple-500' },
  lab: { label: 'Laboratory', icon: TestTube, color: 'bg-green-500' },
  pharmacy: { label: 'Pharmacy', icon: Pill, color: 'bg-orange-500' },
  imaging: { label: 'Imaging', icon: Activity, color: 'bg-pink-500' },
  procedures: { label: 'Procedures', icon: Users, color: 'bg-indigo-500' },
  other: { label: 'Other', icon: DollarSign, color: 'bg-gray-500' },
};

export default function RevenuePage() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [showFilters, setShowFilters] = useState(false);

  const totalStats = useMemo(() => {
    const currentTotal = mockRevenueData.reduce((sum, r) => sum + r.current, 0);
    const previousTotal = mockRevenueData.reduce((sum, r) => sum + r.previous, 0);
    const targetTotal = mockRevenueData.reduce((sum, r) => sum + r.target, 0);
    const percentChange = ((currentTotal - previousTotal) / previousTotal) * 100;
    const targetAchieved = (currentTotal / targetTotal) * 100;
    return { currentTotal, previousTotal, targetTotal, percentChange, targetAchieved };
  }, []);

  const totalReceivables = useMemo(() => {
    return mockReceivables.reduce((sum, r) => sum + r.amount, 0);
  }, []);

  const overdueReceivables = useMemo(() => {
    return mockReceivables.filter((r) => r.aging > 15).reduce((sum, r) => sum + r.amount, 0);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  const formatShortCurrency = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toString();
  };

  const maxDailyRevenue = Math.max(...mockDailyTrend.map((d) => d.revenue));

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revenue Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Track revenue performance and trends</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${period === p ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 ${showFilters ? 'bg-blue-50 border-blue-200' : ''}`}
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="flex items-center gap-2 text-blue-100 text-sm">
              <DollarSign className="w-4 h-4" />
              Total Revenue
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totalStats.currentTotal)}</p>
            <div className="flex items-center gap-1 mt-2 text-sm">
              {totalStats.percentChange >= 0 ? (
                <>
                  <ArrowUp className="w-4 h-4" />
                  <span>{totalStats.percentChange.toFixed(1)}% vs last period</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-4 h-4" />
                  <span>{Math.abs(totalStats.percentChange).toFixed(1)}% vs last period</span>
                </>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Target className="w-4 h-4" />
              Target Achievement
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalStats.targetAchieved.toFixed(0)}%</p>
            <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${totalStats.targetAchieved >= 100 ? 'bg-green-500' : totalStats.targetAchieved >= 80 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                style={{ width: `${Math.min(totalStats.targetAchieved, 100)}%` }}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Clock className="w-4 h-4" />
              Pending Receivables
            </div>
            <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(totalReceivables)}</p>
            <p className="text-sm text-gray-500 mt-1">{mockReceivables.length} pending invoices</p>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              Overdue (&gt;15 days)
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(overdueReceivables)}</p>
            <p className="text-sm text-gray-500 mt-1">Requires follow-up</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Revenue by Source */}
          <div className="col-span-2 bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-gray-400" />
                Revenue by Source
              </h2>
              <span className="text-sm text-gray-500">This {period}</span>
            </div>
            <div className="space-y-3">
              {mockRevenueData.map((data) => {
                const config = sourceConfig[data.source];
                const Icon = config.icon;
                const percentOfTotal = (data.current / totalStats.currentTotal) * 100;
                const change = ((data.current - data.previous) / data.previous) * 100;
                const targetPercent = (data.current / data.target) * 100;

                return (
                  <div key={data.source} className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg ${config.color} bg-opacity-20 flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${config.color.replace('bg-', 'text-').replace('-500', '-600')}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{config.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{formatCurrency(data.current)}</span>
                          <span className={`text-sm flex items-center gap-0.5 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(change).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${config.color}`} style={{ width: `${percentOfTotal}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-16 text-right">{percentOfTotal.toFixed(1)}%</span>
                        <span className={`text-xs w-16 text-right ${targetPercent >= 100 ? 'text-green-600' : 'text-gray-500'}`}>
                          {targetPercent.toFixed(0)}% of target
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Trend Chart */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-gray-400" />
                Daily Trend
              </h2>
            </div>
            <div className="flex items-end gap-2 h-40">
              {mockDailyTrend.map((day) => {
                const height = (day.revenue / maxDailyRevenue) * 100;
                return (
                  <div key={day.day} className="flex-1 flex flex-col items-center">
                    <div className="w-full flex flex-col items-center justify-end h-32">
                      <span className="text-xs text-gray-600 mb-1">{formatShortCurrency(day.revenue)}</span>
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 mt-2">{day.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Revenue Generators */}
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                Top Revenue Generators
              </h2>
            </div>
            <div className="space-y-3">
              {mockTopGenerators.map((gen, idx) => (
                <div key={gen.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{gen.name}</p>
                    <p className="text-xs text-gray-500">{gen.department} • {gen.visits} visits</p>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(gen.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Receivables */}
          <div className="col-span-2 bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-400" />
                Pending Receivables
              </h2>
              <button className="text-sm text-blue-600 hover:underline">View All</button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                  <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="pb-2 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                  <th className="pb-2 text-left text-xs font-semibold text-gray-600 uppercase">Due Date</th>
                  <th className="pb-2 text-right text-xs font-semibold text-gray-600 uppercase">Aging</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mockReceivables.map((recv) => (
                  <tr key={recv.id} className="hover:bg-gray-50">
                    <td className="py-2 text-sm font-medium text-gray-900">{recv.customer}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${recv.type === 'insurance' ? 'bg-blue-100 text-blue-700' : recv.type === 'corporate' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                        {recv.type.charAt(0).toUpperCase() + recv.type.slice(1)}
                      </span>
                    </td>
                    <td className="py-2 text-sm text-right font-medium">{formatCurrency(recv.amount)}</td>
                    <td className="py-2 text-sm text-gray-600">{recv.dueDate}</td>
                    <td className="py-2 text-right">
                      <span className={`text-sm font-medium ${recv.aging > 15 ? 'text-red-600' : recv.aging > 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {recv.aging > 0 ? `${recv.aging} days` : 'Current'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue Forecast */}
        <div className="mt-4 bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              Revenue Forecast
            </h2>
            <span className="text-sm text-gray-500">Next 3 months projection</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { month: 'February 2024', projected: 8200000, confidence: 85 },
              { month: 'March 2024', projected: 8500000, confidence: 75 },
              { month: 'April 2024', projected: 8800000, confidence: 65 },
            ].map((forecast) => (
              <div key={forecast.month} className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">{forecast.month}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(forecast.projected)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${forecast.confidence}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{forecast.confidence}% confidence</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
