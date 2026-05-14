import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  BarChart3,
  TrendingDown,
  DollarSign,
  Package,
  FileText,
  Loader2,
  Calendar,
  Wrench,
  Layers,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { FixedAsset } from '../../services/assets';

type ReportType =
  | 'register'
  | 'valuation'
  | 'age'
  | 'depreciation'
  | 'maintenance'
  | 'disposal';

const reportTypes: { value: ReportType; label: string; icon: typeof Package; description: string }[] = [
  { value: 'register', label: 'Asset Register', icon: Package, description: 'Complete list of all assets' },
  { value: 'valuation', label: 'Valuation', icon: DollarSign, description: 'Acquisition cost and book value' },
  { value: 'age', label: 'Age Analysis', icon: Layers, description: 'Distribution of assets by age' },
  { value: 'depreciation', label: 'Depreciation', icon: TrendingDown, description: 'Depreciation report by period' },
  { value: 'maintenance', label: 'Maintenance Cost', icon: Wrench, description: 'Maintenance spend over time' },
  { value: 'disposal', label: 'Loss on Disposal', icon: FileText, description: 'Gains/losses from disposals' },
];

function startOfYearStr() {
  return format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd');
}

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function AssetReportsPage() {
  const facilityId = useFacilityId();
  const [reportType, setReportType] = useState<ReportType>('register');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState<string>(startOfYearStr());
  const [endDate, setEndDate] = useState<string>(todayStr());

  // Asset Register
  const registerQuery = useQuery({
    queryKey: ['asset-report', 'register', facilityId],
    queryFn: () => assetsService.getRegister(facilityId),
    enabled: !!facilityId && reportType === 'register',
  });

  // Valuation
  const valuationQuery = useQuery({
    queryKey: ['asset-report', 'valuation', facilityId],
    queryFn: () => assetsService.getValuation(facilityId),
    enabled: !!facilityId && reportType === 'valuation',
  });

  // Age Analysis
  const ageQuery = useQuery({
    queryKey: ['asset-report', 'age-analysis', facilityId],
    queryFn: () => assetsService.getAgeAnalysis(facilityId),
    enabled: !!facilityId && reportType === 'age',
  });

  // Depreciation
  const depreciationQuery = useQuery({
    queryKey: ['asset-report', 'depreciation', facilityId, year],
    queryFn: () => assetsService.getDepreciationReport(facilityId, year),
    enabled: !!facilityId && reportType === 'depreciation',
  });

  // Maintenance Cost
  const maintenanceQuery = useQuery({
    queryKey: ['asset-report', 'maintenance-cost', facilityId, startDate, endDate],
    queryFn: () => assetsService.getMaintenanceCostReport(facilityId, startDate, endDate),
    enabled: !!facilityId && reportType === 'maintenance',
  });

  // Loss on Disposal
  const disposalQuery = useQuery({
    queryKey: ['asset-report', 'loss-on-disposal', facilityId, startDate, endDate],
    queryFn: () => assetsService.getLossOnDisposal(facilityId, startDate, endDate),
    enabled: !!facilityId && reportType === 'disposal',
  });

  const isLoading =
    (reportType === 'register' && registerQuery.isLoading) ||
    (reportType === 'valuation' && valuationQuery.isLoading) ||
    (reportType === 'age' && ageQuery.isLoading) ||
    (reportType === 'depreciation' && depreciationQuery.isLoading) ||
    (reportType === 'maintenance' && maintenanceQuery.isLoading) ||
    (reportType === 'disposal' && disposalQuery.isLoading);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Asset Reports</h1>
            <p className="text-sm text-gray-500">View asset reports across the facility</p>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {reportTypes.map((rt) => {
          const Icon = rt.icon;
          const active = reportType === rt.value;
          return (
            <button
              key={rt.value}
              onClick={() => setReportType(rt.value)}
              className={`p-4 rounded-lg border text-left transition-all ${
                active
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                  : 'border-gray-200 hover:border-purple-200'
              }`}
            >
              <Icon className={`w-6 h-6 mb-2 ${active ? 'text-purple-600' : 'text-gray-400'}`} />
              <p className="font-medium text-gray-900 text-sm">{rt.label}</p>
              <p className="text-xs text-gray-500">{rt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Report-specific filters */}
      {(reportType === 'depreciation' || reportType === 'maintenance' || reportType === 'disposal') && (
        <div className="flex flex-wrap items-center gap-4 bg-gray-50 rounded-lg p-4">
          {reportType === 'depreciation' && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <label className="text-sm text-gray-700">Year:</label>
              <input
                type="number"
                value={year}
                min={2000}
                max={2100}
                onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                className="px-3 py-2 border rounded-lg text-sm w-28"
              />
            </div>
          )}
          {(reportType === 'maintenance' || reportType === 'disposal') && (
            <>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <label className="text-sm text-gray-700">From:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">To:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Report Content */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {reportType === 'register' && <RegisterReport assets={registerQuery.data ?? []} />}
            {reportType === 'valuation' && <ValuationReport data={valuationQuery.data} />}
            {reportType === 'age' && <AgeAnalysisReport data={ageQuery.data} />}
            {reportType === 'depreciation' && <DepreciationReport data={depreciationQuery.data} />}
            {reportType === 'maintenance' && <MaintenanceCostReport data={maintenanceQuery.data} />}
            {reportType === 'disposal' && <LossOnDisposalReport data={disposalQuery.data} />}
          </>
        )}
      </div>
    </div>
  );
}

// ===== Asset Register =====
function RegisterReport({ assets }: { assets: FixedAsset[] }) {
  const totalAcquisitionCost = assets.reduce((s, a) => s + Number(a.acquisitionCost || 0), 0);
  const totalBookValue = assets.reduce((s, a) => s + Number(a.bookValue ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        <SummaryCard label="Total Assets" value={String(assets.length)} accent="text-gray-900" />
        <SummaryCard
          label="Total Acquisition Cost"
          value={formatCurrency(totalAcquisitionCost)}
          accent="text-blue-600"
        />
        <SummaryCard label="Total Book Value" value={formatCurrency(totalBookValue)} accent="text-green-600" />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Class</Th>
              <Th>Criticality</Th>
              <Th>Acquisition Date</Th>
              <Th right>Acquisition Cost</Th>
              <Th right>Accum. Dep.</Th>
              <Th right>Book Value</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {assets.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-900">{a.assetCode}</Td>
                <Td>{a.name}</Td>
                <Td className="capitalize">{(a.category || '').replace(/_/g, ' ')}</Td>
                <Td className="capitalize">{a.assetClass || '-'}</Td>
                <Td className="capitalize">{(a.criticalityLevel || '').replace(/_/g, ' ') || '-'}</Td>
                <Td>{a.acquisitionDate ? format(new Date(a.acquisitionDate), 'dd/MM/yyyy') : '-'}</Td>
                <Td right>{formatCurrency(a.acquisitionCost || 0)}</Td>
                <Td right className="text-red-600">{formatCurrency(a.accumulatedDepreciation || 0)}</Td>
                <Td right className="font-medium">{formatCurrency(a.bookValue ?? 0)}</Td>
                <Td>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full capitalize">
                    {(a.status || '').replace(/_/g, ' ')}
                  </span>
                </Td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No assets found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Valuation =====
type ValuationByClassRow = {
  count?: number;
  acquisitionCost?: number;
  bookValue?: number;
  accumulatedDepreciation?: number;
};
type ValuationData = {
  totalAcquisitionCost?: number;
  totalBookValue?: number;
  totalAccumulatedDepreciation?: number;
  byClass?: Record<string, ValuationByClassRow>;
};

function ValuationReport({ data }: { data: ValuationData | undefined }) {
  if (!data) {
    return <div className="p-8 text-center text-gray-500">No valuation data</div>;
  }
  const byClass = data.byClass ?? {};
  const classRows = Object.entries(byClass);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {data.totalAcquisitionCost !== undefined && (
          <SummaryCard
            label="Total Acquisition Cost"
            value={formatCurrency(data.totalAcquisitionCost)}
            accent="text-blue-600"
          />
        )}
        {data.totalAccumulatedDepreciation !== undefined && (
          <SummaryCard
            label="Total Accumulated Depreciation"
            value={formatCurrency(data.totalAccumulatedDepreciation)}
            accent="text-red-600"
          />
        )}
        {data.totalBookValue !== undefined && (
          <SummaryCard label="Total Book Value" value={formatCurrency(data.totalBookValue)} accent="text-green-600" />
        )}
      </div>

      {classRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Asset Class</Th>
                <Th right>Count</Th>
                <Th right>Acquisition Cost</Th>
                <Th right>Accum. Depreciation</Th>
                <Th right>Book Value</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classRows.map(([cls, row]) => (
                <tr key={cls} className="hover:bg-gray-50">
                  <Td className="capitalize">{cls.replace(/_/g, ' ')}</Td>
                  <Td right>{row.count ?? 0}</Td>
                  <Td right>{formatCurrency(row.acquisitionCost ?? 0)}</Td>
                  <Td right className="text-red-600">{formatCurrency(row.accumulatedDepreciation ?? 0)}</Td>
                  <Td right className="font-medium">{formatCurrency(row.bookValue ?? 0)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== Age Analysis =====
type AgeData = { buckets?: Record<string, number> };

function AgeAnalysisReport({ data }: { data: AgeData | undefined }) {
  const buckets = data?.buckets ?? {};
  const order = ['0-1y', '1-3y', '3-5y', '5-10y', '10y+'];
  const keys = order.filter((k) => k in buckets).length > 0 ? order : Object.keys(buckets);

  if (keys.length === 0) {
    return <div className="p-8 text-center text-gray-500">No age analysis data</div>;
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {keys.map((k) => (
          <SummaryCard key={k} label={k} value={String(buckets[k] ?? 0)} accent="text-purple-600" />
        ))}
      </div>
    </div>
  );
}

// ===== Depreciation Report =====
function DepreciationReport({ data }: { data: any }) {
  if (!data) {
    return <div className="p-8 text-center text-gray-500">No depreciation data</div>;
  }

  const items: any[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  const summary = !Array.isArray(data) && data.summary ? data.summary : null;

  const columns = items.length > 0 ? Object.keys(items[0]) : [];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {Object.entries(summary).map(([k, v]) => (
            <SummaryCard
              key={k}
              label={k}
              value={typeof v === 'number' ? formatCurrency(v) : String(v ?? '-')}
              accent="text-gray-900"
            />
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((c) => (
                  <Th key={c}>{c}</Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map((c) => (
                    <Td key={c}>{renderCell(row[c])}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !summary && <div className="p-8 text-center text-gray-500">No rows</div>
      )}
    </div>
  );
}

// ===== Maintenance Cost =====
function MaintenanceCostReport({ data }: { data: any }) {
  if (!data) {
    return <div className="p-8 text-center text-gray-500">No maintenance cost data</div>;
  }
  const items: any[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  const summary = !Array.isArray(data) && data.summary ? data.summary : null;
  const columns = items.length > 0 ? Object.keys(items[0]) : [];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {Object.entries(summary).map(([k, v]) => (
            <SummaryCard
              key={k}
              label={k}
              value={typeof v === 'number' ? formatCurrency(v) : String(v ?? '-')}
              accent="text-orange-600"
            />
          ))}
        </div>
      )}
      {items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((c) => (
                  <Th key={c}>{c}</Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map((c) => (
                    <Td key={c}>{renderCell(row[c])}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !summary && <div className="p-8 text-center text-gray-500">No maintenance records</div>
      )}
    </div>
  );
}

// ===== Loss on Disposal =====
function LossOnDisposalReport({ data }: { data: any }) {
  if (!data) {
    return <div className="p-8 text-center text-gray-500">No disposal data</div>;
  }
  const items: any[] = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  const summary = !Array.isArray(data) && data.summary ? data.summary : null;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          {Object.entries(summary).map(([k, v]) => (
            <SummaryCard
              key={k}
              label={k}
              value={typeof v === 'number' ? formatCurrency(v) : String(v ?? '-')}
              accent="text-gray-900"
            />
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <Th>Disposal Date</Th>
              <Th>Asset</Th>
              <Th right>Acquisition Cost</Th>
              <Th right>Accum. Dep.</Th>
              <Th right>Book Value</Th>
              <Th right>Disposal Value</Th>
              <Th right>Gain/Loss</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No disposals in selected period
                </td>
              </tr>
            ) : (
              items.map((row, i) => {
                const acquisitionCost = Number(row.acquisitionCost ?? row.asset?.acquisitionCost ?? 0);
                const accumulatedDepreciation = Number(
                  row.accumulatedDepreciation ?? row.asset?.accumulatedDepreciation ?? 0,
                );
                const bookValue = Number(
                  row.bookValue ?? row.asset?.bookValue ?? acquisitionCost - accumulatedDepreciation,
                );
                const disposalValue = Number(row.disposalValue ?? row.actualValue ?? 0);
                const gainLoss =
                  row.gainLoss !== undefined && row.gainLoss !== null
                    ? Number(row.gainLoss)
                    : disposalValue - bookValue;
                const name = row.assetName ?? row.asset?.name ?? row.name ?? '-';
                const code = row.assetCode ?? row.asset?.assetCode ?? '';
                const dDate = row.disposalDate ?? row.asset?.disposalDate;
                return (
                  <tr key={row.id ?? i} className="hover:bg-gray-50">
                    <Td>{dDate ? format(new Date(dDate), 'dd/MM/yyyy') : '-'}</Td>
                    <Td>
                      <div className="text-sm font-medium text-gray-900">{name}</div>
                      {code && <div className="text-xs text-gray-500">{code}</div>}
                    </Td>
                    <Td right>{formatCurrency(acquisitionCost)}</Td>
                    <Td right className="text-red-600">{formatCurrency(accumulatedDepreciation)}</Td>
                    <Td right>{formatCurrency(bookValue)}</Td>
                    <Td right>{formatCurrency(disposalValue)}</Td>
                    <Td right className={`font-medium ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {gainLoss >= 0 ? '+' : ''}
                      {formatCurrency(gainLoss)}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Helpers =====
function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-sm text-gray-500 capitalize">{label.replace(/([A-Z])/g, ' $1').trim()}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  className = '',
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-sm ${right ? 'text-right' : 'text-gray-600'} ${className}`}>
      {children}
    </td>
  );
}

function renderCell(v: any): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
