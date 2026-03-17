import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  ArrowUpDown,
  Truck,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { pharmacyService } from '../../services/pharmacy';
import type { SupplierRanking } from '../../services/pharmacy';
import SupplierScorecard from '../../components/pharmacy/SupplierScorecard';

type SortField = 'rank' | 'overall' | 'delivery' | 'quality' | 'invoiceAccuracy' | 'name';

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBadge(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700';
  if (score >= 60) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getScoreBadge(score)}`}>
      {score}%
    </span>
  );
}

export default function SupplierRankingsPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('suppliers.read')) {
    return <AccessDenied />;
  }

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: rankings, isLoading, error } = useQuery<SupplierRanking[]>({
    queryKey: ['supplier-rankings'],
    queryFn: () => pharmacyService.supplierScoring.getRankings(),
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'rank' || field === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedRankings = React.useMemo(() => {
    if (!rankings) return [];
    return [...rankings].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'rank': cmp = a.rank - b.rank; break;
        case 'overall': cmp = a.scores.overall - b.scores.overall; break;
        case 'delivery': cmp = a.scores.delivery - b.scores.delivery; break;
        case 'quality': cmp = a.scores.quality - b.scores.quality; break;
        case 'invoiceAccuracy': cmp = a.scores.invoiceAccuracy - b.scores.invoiceAccuracy; break;
        case 'name': cmp = a.supplierName.localeCompare(b.supplierName); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rankings, sortField, sortDir]);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-7 h-7 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Rankings</h1>
          <p className="text-sm text-gray-500">Performance scores based on delivery, quality, and invoice accuracy</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> ≥80 Excellent</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> 60–79 Average</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> &lt;60 Poor</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">Calculating supplier scores...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center p-12 text-red-500">
          <AlertTriangle className="w-6 h-6 mr-2" />
          Failed to load rankings
        </div>
      )}

      {sortedRankings.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortHeader field="rank">Rank</SortHeader>
                <SortHeader field="name">Supplier</SortHeader>
                <SortHeader field="overall">Overall</SortHeader>
                <SortHeader field="delivery">
                  <Truck className="w-3.5 h-3.5" /> Delivery
                </SortHeader>
                <SortHeader field="quality">
                  <CheckCircle className="w-3.5 h-3.5" /> Quality
                </SortHeader>
                <SortHeader field="invoiceAccuracy">
                  <FileText className="w-3.5 h-3.5" /> Invoice
                </SortHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">POs</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedRankings.map(supplier => (
                <React.Fragment key={supplier.supplierId}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(prev => prev === supplier.supplierId ? null : supplier.supplierId)}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${
                        supplier.rank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {supplier.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{supplier.supplierName}</div>
                      <div className="text-xs text-gray-500">{supplier.supplierCode} · {supplier.supplierType}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-lg font-bold ${getScoreColor(supplier.scores.overall)}`}>
                        {supplier.scores.overall}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ScoreBadge score={supplier.scores.delivery} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={supplier.scores.quality} /></td>
                    <td className="px-4 py-3"><ScoreBadge score={supplier.scores.invoiceAccuracy} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{supplier.totalPOs}</td>
                    <td className="px-4 py-3">
                      {expandedId === supplier.supplierId ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                  </tr>
                  {expandedId === supplier.supplierId && (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 bg-gray-50 border-t">
                        <SupplierScorecard supplierId={supplier.supplierId} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !error && sortedRankings.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No suppliers found. Add suppliers to see rankings.</p>
        </div>
      )}
    </div>
  );
}
