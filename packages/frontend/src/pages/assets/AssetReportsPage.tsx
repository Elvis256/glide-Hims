import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  BarChart3,
  Download,
  TrendingDown,
  DollarSign,
  Package,
  FileText,
  Loader2,
  Calendar,
  Filter,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { FixedAsset } from '../../services/assets';

type ReportType = 'register' | 'valuation' | 'depreciation' | 'disposal';

const reportTypes = [
  { value: 'register', label: 'Asset Register', icon: Package, description: 'Complete list of all assets' },
  { value: 'valuation', label: 'Asset Valuation', icon: DollarSign, description: 'Current book values' },
  { value: 'depreciation', label: 'Depreciation Schedule', icon: TrendingDown, description: 'Monthly depreciation' },
  { value: 'disposal', label: 'Disposal Report', icon: FileText, description: 'Disposed assets and gains/losses' },
];

const categories = [
  { value: '', label: 'All Categories' },
  { value: 'medical_equipment', label: 'Medical Equipment' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'vehicle', label: 'Vehicles' },
  { value: 'computer_equipment', label: 'Computer Equipment' },
  { value: 'office_equipment', label: 'Office Equipment' },
  { value: 'building', label: 'Buildings' },
  { value: 'land', label: 'Land' },
  { value: 'other', label: 'Other' },
];

export default function AssetReportsPage() {
  const facilityId = useFacilityId();
  const [reportType, setReportType] = useState<ReportType>('register');
  const [category, setCategory] = useState('');
  const [asOfDate, setAsOfDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Get all assets for reports
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['assets', facilityId, category],
    queryFn: () => assetsService.list(facilityId, category ? { category } : {}),
    enabled: !!facilityId,
  });

  // Calculate report data
  const activeAssets = assets.filter(a => a.status === 'active');
  const disposedAssets = assets.filter(a => a.status === 'disposed');

  const totalPurchaseCost = activeAssets.reduce((sum, a) => sum + Number(a.purchaseCost || 0), 0);
  const totalAccumulatedDepreciation = activeAssets.reduce((sum, a) => sum + Number(a.accumulatedDepreciation || 0), 0);
  const totalBookValue = totalPurchaseCost - totalAccumulatedDepreciation;

  const exportCSV = () => {
    let data: string[][] = [];
    let filename = '';

    if (reportType === 'register') {
      filename = 'asset_register.csv';
      data = [
        ['Asset Code', 'Name', 'Category', 'Location', 'Status', 'Purchase Cost', 'Accumulated Dep.', 'Book Value'],
        ...activeAssets.map(a => [
          a.assetCode,
          a.name,
          a.category,
          a.location || '',
          a.status,
          String(a.purchaseCost || 0),
          String(a.accumulatedDepreciation || 0),
          String(Number(a.purchaseCost || 0) - Number(a.accumulatedDepreciation || 0)),
        ])
      ];
    } else if (reportType === 'valuation') {
      filename = 'asset_valuation.csv';
      data = [
        ['Asset Code', 'Name', 'Purchase Date', 'Purchase Cost', 'Useful Life', 'Depreciation Method', 'Accumulated Dep.', 'Current Book Value'],
        ...activeAssets.map(a => [
          a.assetCode,
          a.name,
          a.purchaseDate ? format(new Date(a.purchaseDate), 'dd/MM/yyyy') : '',
          String(a.purchaseCost || 0),
          `${a.usefulLifeYears || 0} years`,
          a.depreciationMethod || '',
          String(a.accumulatedDepreciation || 0),
          String(Number(a.purchaseCost || 0) - Number(a.accumulatedDepreciation || 0)),
        ])
      ];
    } else if (reportType === 'depreciation') {
      filename = 'depreciation_schedule.csv';
      data = [
        ['Asset Code', 'Name', 'Purchase Cost', 'Residual Value', 'Useful Life', 'Annual Depreciation', 'Monthly Depreciation', 'Accumulated', 'Remaining Life'],
        ...activeAssets.map(a => {
          const depreciableAmount = Number(a.purchaseCost || 0) - Number(a.residualValue || 0);
          const annualDep = a.usefulLifeYears ? depreciableAmount / a.usefulLifeYears : 0;
          const monthlyDep = annualDep / 12;
          return [
            a.assetCode,
            a.name,
            String(a.purchaseCost || 0),
            String(a.residualValue || 0),
            `${a.usefulLifeYears || 0} years`,
            String(annualDep.toFixed(0)),
            String(monthlyDep.toFixed(0)),
            String(a.accumulatedDepreciation || 0),
            a.remainingLife || 'N/A',
          ];
        })
      ];
    } else {
      filename = 'disposal_report.csv';
      data = [
        ['Asset Code', 'Name', 'Purchase Cost', 'Disposal Date', 'Disposal Method', 'Disposal Amount', 'Book Value at Disposal', 'Gain/Loss'],
        ...disposedAssets.map(a => [
          a.assetCode,
          a.name,
          String(a.purchaseCost || 0),
          a.disposalDate ? format(new Date(a.disposalDate), 'dd/MM/yyyy') : '',
          a.disposalMethod || '',
          String(a.disposalAmount || 0),
          String(Number(a.purchaseCost || 0) - Number(a.accumulatedDepreciation || 0)),
          String(Number(a.disposalAmount || 0) - (Number(a.purchaseCost || 0) - Number(a.accumulatedDepreciation || 0))),
        ])
      ];
    }

    const csvContent = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

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
            <p className="text-sm text-gray-500">Generate and export asset reports</p>
          </div>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-4 gap-4">
        {reportTypes.map((rt) => {
          const Icon = rt.icon;
          return (
            <button
              key={rt.value}
              onClick={() => setReportType(rt.value as ReportType)}
              className={`p-4 rounded-lg border text-left transition-all ${
                reportType === rt.value
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                  : 'border-gray-200 hover:border-purple-200'
              }`}
            >
              <Icon className={`w-6 h-6 mb-2 ${reportType === rt.value ? 'text-purple-600' : 'text-gray-400'}`} />
              <p className="font-medium text-gray-900">{rt.label}</p>
              <p className="text-xs text-gray-500">{rt.description}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          {categories.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Assets</p>
          <p className="text-2xl font-bold text-gray-900">{activeAssets.length}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Purchase Cost</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalPurchaseCost)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Accumulated Depreciation</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalAccumulatedDepreciation)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Net Book Value</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalBookValue)}</p>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Asset Register */}
            {reportType === 'register' && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchase Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Book Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activeAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{asset.assetCode}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{asset.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{asset.category.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{asset.location || '-'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full capitalize">{asset.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.purchaseCost || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatCurrency(Number(asset.purchaseCost || 0) - Number(asset.accumulatedDepreciation || 0))}
                      </td>
                    </tr>
                  ))}
                  {activeAssets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No assets found</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-100">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-bold text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(totalPurchaseCost)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(totalBookValue)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            {/* Asset Valuation */}
            {reportType === 'valuation' && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchase Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Residual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Accum. Dep.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Book Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activeAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                        <div className="text-xs text-gray-500">{asset.assetCode}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {asset.purchaseDate ? format(new Date(asset.purchaseDate), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.purchaseCost || 0)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {(asset.depreciationMethod || 'straight_line').replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.residualValue || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">
                        ({formatCurrency(asset.accumulatedDepreciation || 0)})
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                        {formatCurrency(Number(asset.purchaseCost || 0) - Number(asset.accumulatedDepreciation || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Depreciation Schedule */}
            {reportType === 'depreciation' && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Residual</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Life</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Annual</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monthly</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Accumulated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {activeAssets.map((asset) => {
                    const depreciableAmount = Number(asset.purchaseCost || 0) - Number(asset.residualValue || 0);
                    const annualDep = asset.usefulLifeYears ? depreciableAmount / asset.usefulLifeYears : 0;
                    const monthlyDep = annualDep / 12;
                    return (
                      <tr key={asset.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                          <div className="text-xs text-gray-500">{asset.assetCode}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.purchaseCost || 0)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.residualValue || 0)}</td>
                        <td className="px-4 py-3 text-sm">{asset.usefulLifeYears || 0} years</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600">{formatCurrency(annualDep)}</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600">{formatCurrency(monthlyDep)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.accumulatedDepreciation || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Disposal Report */}
            {reportType === 'disposal' && (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchase Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disposal Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Disposal Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Book Value</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {disposedAssets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">No disposed assets</td>
                    </tr>
                  ) : (
                    disposedAssets.map((asset) => {
                      const bookValue = Number(asset.purchaseCost || 0) - Number(asset.accumulatedDepreciation || 0);
                      const gainLoss = Number(asset.disposalAmount || 0) - bookValue;
                      return (
                        <tr key={asset.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                            <div className="text-xs text-gray-500">{asset.assetCode}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.purchaseCost || 0)}</td>
                          <td className="px-4 py-3 text-sm">
                            {asset.disposalDate ? format(new Date(asset.disposalDate), 'dd/MM/yyyy') : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm capitalize">{(asset.disposalMethod || '-').replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(asset.disposalAmount || 0)}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(bookValue)}</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}
