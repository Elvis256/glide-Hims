import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  Banknote,
  Smartphone,
  CreditCard,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { api } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

interface Shift {
  id: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  salesCount: number;
  totalAmount: number;
  totalCash: number;
  totalMobileMoney: number;
  totalCard: number;
  status: 'open' | 'closed';
}

interface DailySummary {
  date: string;
  totalSales: number;
  totalAmount: number;
  cashAmount: number;
  mobileMoneyAmount: number;
  cardAmount: number;
}

export default function POSReportsPage() {
  const facilityId = useFacilityId();

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  // Fetch shifts
  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ['pos-shifts-report', facilityId, startDate, endDate],
    queryFn: async () => {
      const res = await api.get('/pos/shifts', {
        params: { startDate, endDate },
      });
      return res.data;
    },
  });

  // Fetch daily summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['pos-daily-summary', facilityId, startDate, endDate],
    queryFn: async () => {
      try {
        const res = await api.get('/pharmacy/summary/daily', {
          params: { startDate, endDate },
        });
        return res.data;
      } catch {
        return [];
      }
    },
  });

  const shifts = asList<Shift>(shiftsData);
  const closedShifts = shifts.filter((s) => s.status === 'closed');

  // Aggregate stats
  const stats = useMemo(() => {
    const totalShifts = closedShifts.length;
    const totalSales = closedShifts.reduce((sum, s) => sum + s.salesCount, 0);
    const totalAmount = closedShifts.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCash = closedShifts.reduce((sum, s) => sum + s.totalCash, 0);
    const totalMobile = closedShifts.reduce((sum, s) => sum + s.totalMobileMoney, 0);
    const totalCard = closedShifts.reduce((sum, s) => sum + s.totalCard, 0);

    // Average shift duration
    let avgDuration = 0;
    const durationsMs = closedShifts
      .filter((s) => s.closedAt)
      .map((s) => new Date(s.closedAt!).getTime() - new Date(s.openedAt).getTime());
    if (durationsMs.length > 0) {
      avgDuration = durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length;
    }

    // Cash difference
    let totalDifference = 0;
    closedShifts.forEach((s) => {
      if (s.closingBalance != null) {
        const expected = s.openingBalance + s.totalCash;
        totalDifference += s.closingBalance - expected;
      }
    });

    return {
      totalShifts,
      totalSales,
      totalAmount,
      totalCash,
      totalMobile,
      totalCard,
      avgDuration,
      totalDifference,
    };
  }, [closedShifts]);

  // Per-cashier performance
  const cashierPerformance = useMemo(() => {
    const map = new Map<
      string,
      { name: string; salesCount: number; totalAmount: number; shifts: number }
    >();
    closedShifts.forEach((s) => {
      const existing = map.get(s.cashierName) || {
        name: s.cashierName,
        salesCount: 0,
        totalAmount: 0,
        shifts: 0,
      };
      existing.salesCount += s.salesCount;
      existing.totalAmount += s.totalAmount;
      existing.shifts += 1;
      map.set(s.cashierName, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [closedShifts]);

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const isLoading = shiftsLoading || summaryLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">POS Reports</h1>
        <p className="text-sm text-gray-500">Shift and sales performance reports</p>
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2.5">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Shifts</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalShifts}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2.5">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Sales</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalSales}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2.5">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Revenue</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatCurrency(stats.totalAmount)}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-100 p-2.5">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Avg Shift Duration</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="font-semibold text-gray-900">Sales by Payment Method</h3>
            </div>
            <div className="grid grid-cols-1 gap-0 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="p-6 text-center">
                <Banknote className="mx-auto mb-2 h-8 w-8 text-green-500" />
                <p className="text-sm text-gray-500">Cash</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalCash)}
                </p>
                {stats.totalAmount > 0 && (
                  <p className="text-xs text-gray-400">
                    {((stats.totalCash / stats.totalAmount) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="p-6 text-center">
                <Smartphone className="mx-auto mb-2 h-8 w-8 text-blue-500" />
                <p className="text-sm text-gray-500">Mobile Money</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalMobile)}
                </p>
                {stats.totalAmount > 0 && (
                  <p className="text-xs text-gray-400">
                    {((stats.totalMobile / stats.totalAmount) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="p-6 text-center">
                <CreditCard className="mx-auto mb-2 h-8 w-8 text-purple-500" />
                <p className="text-sm text-gray-500">Card</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.totalCard)}
                </p>
                {stats.totalAmount > 0 && (
                  <p className="text-xs text-gray-400">
                    {((stats.totalCard / stats.totalAmount) * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Cash Difference */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Cash Difference Summary</h3>
                <p className="text-sm text-gray-500">
                  Total discrepancy between expected and actual cash across all shifts
                </p>
              </div>
              <div
                className={`text-2xl font-bold ${
                  stats.totalDifference >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {stats.totalDifference >= 0 ? '+' : ''}
                {formatCurrency(stats.totalDifference)}
              </div>
            </div>
          </div>

          {/* Cashier Performance */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Cashier Performance</h3>
              </div>
            </div>
            {cashierPerformance.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <BarChart3 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p>No data for the selected period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                      <th className="px-6 py-3">Cashier</th>
                      <th className="px-6 py-3 text-right">Shifts</th>
                      <th className="px-6 py-3 text-right">Sales Count</th>
                      <th className="px-6 py-3 text-right">Total Amount</th>
                      <th className="px-6 py-3 text-right">Avg / Transaction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cashierPerformance.map((cashier) => (
                      <tr key={cashier.name} className="hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-900">{cashier.name}</td>
                        <td className="px-6 py-3 text-right text-gray-600">{cashier.shifts}</td>
                        <td className="px-6 py-3 text-right text-gray-600">{cashier.salesCount}</td>
                        <td className="px-6 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(cashier.totalAmount)}
                        </td>
                        <td className="px-6 py-3 text-right text-gray-600">
                          {cashier.salesCount > 0
                            ? formatCurrency(cashier.totalAmount / cashier.salesCount)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
