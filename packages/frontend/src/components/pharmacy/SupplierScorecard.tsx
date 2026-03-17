import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Truck,
  CheckCircle,
  FileText,
  Package,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { pharmacyService, SupplierScorecard as ScorecardType } from '../../services/pharmacy';

interface SupplierScorecardProps {
  supplierId: string;
  dateFrom?: string;
  dateTo?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-yellow-100';
  return 'bg-red-100';
}

function getBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function ScoreBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-gray-600">
          {icon}
          {label}
        </span>
        <span className={`font-semibold ${getScoreColor(score)}`}>{score}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${getBarColor(score)}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function SupplierScorecard({ supplierId, dateFrom, dateTo }: SupplierScorecardProps) {
  const { data: scorecard, isLoading, error } = useQuery<ScorecardType>({
    queryKey: ['supplier-scorecard', supplierId, dateFrom, dateTo],
    queryFn: () => pharmacyService.supplierScoring.getScorecard(supplierId, { dateFrom, dateTo }),
    enabled: !!supplierId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Loading scorecard...</span>
      </div>
    );
  }

  if (error || !scorecard) {
    return (
      <div className="flex items-center justify-center p-8 text-red-500">
        <AlertTriangle className="w-5 h-5 mr-2" />
        Failed to load scorecard
      </div>
    );
  }

  const { supplier, scores, metrics, recentPOs } = scorecard;

  return (
    <div className="space-y-6">
      {/* Header with overall score */}
      <div className="flex items-center gap-6">
        <div className={`flex flex-col items-center justify-center w-24 h-24 rounded-full ${getScoreBg(scores.overall)}`}>
          <span className={`text-3xl font-bold ${getScoreColor(scores.overall)}`}>
            {scores.overall}
          </span>
          <span className="text-xs text-gray-500">Overall</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
          <p className="text-sm text-gray-500">{supplier.code} · {supplier.type}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
            supplier.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
            supplier.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {supplier.status}
          </span>
        </div>
      </div>

      {/* Score breakdown bars */}
      <div className="space-y-3">
        <ScoreBar
          label="Delivery (40%)"
          score={scores.delivery}
          icon={<Truck className="w-4 h-4" />}
        />
        <ScoreBar
          label="Quality (35%)"
          score={scores.quality}
          icon={<CheckCircle className="w-4 h-4" />}
        />
        <ScoreBar
          label="Invoice Accuracy (25%)"
          score={scores.invoiceAccuracy}
          icon={<FileText className="w-4 h-4" />}
        />
      </div>

      {/* Metrics summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">POs Delivered On Time</p>
          <p className="text-lg font-semibold">{metrics.deliveredOnTime}/{metrics.totalPOs}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Items Accepted/Rejected</p>
          <p className="text-lg font-semibold text-green-600">{metrics.acceptedItems} <span className="text-red-500 text-sm">/ {metrics.rejectedItems} rej</span></p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Invoices Matched</p>
          <p className="text-lg font-semibold">{metrics.matchedInvoices}/{metrics.totalInvoices}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total GRN Items</p>
          <p className="text-lg font-semibold">{metrics.totalGRNItems}</p>
        </div>
      </div>

      {/* Recent PO history */}
      {recentPOs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
            <Package className="w-4 h-4" />
            Recent Purchase Orders
          </h4>
          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Order #</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentPOs.slice(0, 5).map(po => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{po.orderNumber}</td>
                    <td className="px-3 py-2 text-gray-500">{new Date(po.orderDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-xs rounded ${
                        po.status === 'fully_received' ? 'bg-green-100 text-green-700' :
                        po.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {po.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{po.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
