import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { insuranceService } from '../../services/insurance';

interface PrescriptionItemInput {
  drugId: string;
  drugName: string;
  quantity: number;
}

interface InsuranceCoverageCheckProps {
  patientId: string;
  items: PrescriptionItemInput[];
}

interface CoverageDetail {
  drugId: string;
  covered: boolean;
  copayAmount: number;
  requiresPreAuth: boolean;
  rejectionReason?: string;
}

interface CoverageResult {
  covered: boolean;
  coverageDetails: CoverageDetail[];
}

export default function InsuranceCoverageCheck({ patientId, items }: InsuranceCoverageCheckProps) {
  const [result, setResult] = useState<CoverageResult | null>(null);

  const coverageMutation = useMutation({
    mutationFn: () =>
      insuranceService.checkCoverage({
        patientId,
        items: items.map((i) => ({ drugId: i.drugId, quantity: i.quantity })),
      }),
    onSuccess: (data) => {
      setResult(data);
      if (data.covered) {
        toast.success('All items are covered by insurance');
      } else {
        toast.warning('Some items may not be covered');
      }
    },
    onError: () => {
      toast.error('Failed to verify insurance coverage');
    },
  });

  const getStatusIcon = (detail: CoverageDetail) => {
    if (!detail.covered) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (detail.requiresPreAuth) {
      return <AlertTriangle className="w-5 h-5 text-orange-500" />;
    }
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const getStatusBadge = (detail: CoverageDetail) => {
    if (!detail.covered) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Not Covered
        </span>
      );
    }
    if (detail.requiresPreAuth) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          Requires Pre-Auth
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Covered
      </span>
    );
  };

  const getDrugName = (drugId: string) => {
    const item = items.find((i) => i.drugId === drugId);
    return item?.drugName || drugId;
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Insurance Coverage Check</h3>
        </div>
        <button
          onClick={() => coverageMutation.mutate()}
          disabled={coverageMutation.isPending || items.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {coverageMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              Verify Coverage
            </>
          )}
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-sm text-gray-500 italic">No prescription items to check.</p>
      )}

      {result && (
        <div className="space-y-3">
          {/* Summary */}
          <div
            className={`p-3 rounded-lg ${
              result.covered
                ? 'bg-green-50 border border-green-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <p className={`text-sm font-medium ${result.covered ? 'text-green-800' : 'text-yellow-800'}`}>
              {result.covered
                ? '✓ All prescribed items are covered by insurance'
                : '⚠ Some items may not be fully covered'}
            </p>
          </div>

          {/* Per-drug details */}
          <div className="divide-y divide-gray-100">
            {result.coverageDetails.map((detail) => (
              <div key={detail.drugId} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(detail)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{getDrugName(detail.drugId)}</p>
                    {detail.rejectionReason && (
                      <p className="text-xs text-red-600 mt-0.5">{detail.rejectionReason}</p>
                    )}
                    {detail.requiresPreAuth && (
                      <p className="text-xs text-orange-600 mt-0.5">
                        ⚠ Pre-authorization required before dispensing
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {detail.covered && detail.copayAmount > 0 && (
                    <span className="text-sm text-gray-600">
                      Copay: {detail.copayAmount}%
                    </span>
                  )}
                  {getStatusBadge(detail)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
