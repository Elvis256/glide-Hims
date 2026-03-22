import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Pill,
  Users,
  Activity,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { prescriptionsService } from '../../services/prescriptions';
import { useFacilityId } from '../../lib/facility';

type TabId = 'prescribing' | 'therapeutic' | 'prescriber';

const TABS: { id: TabId; label: string; icon: typeof Pill }[] = [
  { id: 'prescribing', label: 'Top Prescribed Drugs', icon: Pill },
  { id: 'therapeutic', label: 'Therapeutic Class Trends', icon: TrendingUp },
  { id: 'prescriber', label: 'Prescriber Analytics', icon: Users },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getDefaultDateRange() {
  const dateTo = new Date().toISOString().split('T')[0];
  const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { dateFrom, dateTo };
}

export default function DURReportsPage() {
  const defaults = getDefaultDateRange();
  const facilityId = useFacilityId();
  const [activeTab, setActiveTab] = useState<TabId>('prescribing');
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);

  const queryParams = { dateFrom, dateTo, facilityId };

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['dur-summary', queryParams],
    queryFn: () => prescriptionsService.getDURSummary(queryParams),
  });

  const { data: patterns = [], isLoading: loadingPatterns } = useQuery({
    queryKey: ['dur-patterns', queryParams],
    queryFn: () => prescriptionsService.getDURPrescribingPatterns(queryParams),
    enabled: activeTab === 'prescribing',
  });

  const { data: trends, isLoading: loadingTrends } = useQuery({
    queryKey: ['dur-trends', queryParams],
    queryFn: () => prescriptionsService.getDURTherapeuticTrends(queryParams),
    enabled: activeTab === 'therapeutic',
  });

  const { data: prescribers = [], isLoading: loadingPrescribers } = useQuery({
    queryKey: ['dur-prescribers', queryParams],
    queryFn: () => prescriptionsService.getDURPrescriberStats(queryParams),
    enabled: activeTab === 'prescriber',
  });

  const maxPrescribed = useMemo(() => {
    if (!patterns.length) return 1;
    return Math.max(...patterns.map((p: any) => p.totalPrescribed), 1);
  }, [patterns]);

  const isLoading = loadingSummary || loadingPatterns || loadingTrends || loadingPrescribers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Drug Utilization Review Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Analyze prescribing patterns, therapeutic class trends, and prescriber activity
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <BarChart3 className="h-6 w-6 text-blue-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900">
            {summary?.totalPrescriptions ?? '—'}
          </div>
          <div className="text-xs text-gray-500">Total Rx</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <Pill className="h-6 w-6 text-green-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900">
            {summary?.uniqueDrugs ?? '—'}
          </div>
          <div className="text-xs text-gray-500">Unique Drugs</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <Activity className="h-6 w-6 text-purple-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900">
            {summary?.avgItemsPerRx ?? '—'}
          </div>
          <div className="text-xs text-gray-500">Avg Items/Rx</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <TrendingUp className="h-6 w-6 text-orange-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900 text-sm">
            {summary?.topTherapeuticClass
              ? summary.topTherapeuticClass.replace(/_/g, ' ')
              : '—'}
          </div>
          <div className="text-xs text-gray-500">Top Class</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <Users className="h-6 w-6 text-teal-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900">
            {summary?.uniquePrescribers ?? '—'}
          </div>
          <div className="text-xs text-gray-500">Prescribers</div>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline h-4 w-4 mr-1" />
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <tab.icon className="inline h-4 w-4 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Top Prescribed Drugs */}
      {activeTab === 'prescribing' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : patterns.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No prescribing data found for the selected period
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Drug Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Code
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Times Prescribed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Avg Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-1/4">
                    Distribution
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {patterns.map((drug: any, idx: number) => (
                  <tr key={drug.drugCode || idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {drug.drugName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{drug.drugCode}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {drug.totalPrescribed}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {drug.totalQuantity}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {drug.avgQuantity}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-gray-100 rounded-full h-4">
                        <div
                          className="bg-blue-500 h-4 rounded-full transition-all"
                          style={{
                            width: `${(drug.totalPrescribed / maxPrescribed) * 100}%`,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Therapeutic Class Trends */}
      {activeTab === 'therapeutic' && (
        <div className="space-y-6">
          {/* Class breakdown table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Class Breakdown</h3>
            </div>
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : !trends?.classTotals?.length ? (
              <div className="p-8 text-center text-gray-500">
                No therapeutic class data found
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Therapeutic Class
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Items Prescribed
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Prescriptions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {trends.classTotals.map((cls: any) => (
                    <tr key={cls.therapeuticClass} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                        {(cls.therapeuticClass || 'unknown').replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-900 font-semibold">
                        {cls.totalItems}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {cls.totalPrescriptions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Monthly trends table */}
          {trends?.monthlyTrends?.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900">Monthly Trends</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Month
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Class
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {trends.monthlyTrends.map((row: any, idx: number) => (
                    <tr key={`${row.month}-${row.therapeuticClass}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.month}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {(row.therapeuticClass || 'unknown').replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        {row.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Prescriber Analytics */}
      {activeTab === 'prescriber' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : prescribers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No prescriber data found for the selected period
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prescriber
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total Rx
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total Items
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Avg Items/Rx
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Top Drugs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {prescribers.map((doc: any) => (
                  <tr key={doc.prescriberId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {doc.prescriberName}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {doc.totalPrescriptions}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {doc.totalItems}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                      {doc.avgItemsPerRx}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(doc.topDrugs || []).map((drug: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                          >
                            {drug}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
