import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '../../../services/api';

interface ComplianceStatus {
  score: number;
  status: 'compliant' | 'warning' | 'critical';
  lastAudit: string;
  policyCount: number;
  violationCount: number;
}

export const ComplianceStatusWidget: React.FC = () => {
  const [compliance, setCompliance] = useState<ComplianceStatus>({
    score: 0,
    status: 'compliant',
    lastAudit: 'N/A',
    policyCount: 0,
    violationCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComplianceStatus = async () => {
      try {
        const { data } = await api.get('/finance/compliance/status/overall');
        const score = data?.complianceScore || 0;
        setCompliance({
          score,
          status: score >= 90 ? 'compliant' : score >= 70 ? 'warning' : 'critical',
          lastAudit: data?.lastAuditDate || 'N/A',
          policyCount: data?.activePolicies || 0,
          violationCount: data?.violations || 0,
        });
      } catch (error) {
        console.error('Failed to fetch compliance status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComplianceStatus();
  }, []);

  const statusColors = {
    compliant: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };

  const colors = statusColors[compliance.status];

  return (
    <div className={`border rounded-lg p-6 ${colors.bg} ${colors.border} ${colors.text}`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold">Compliance Status</h3>
        <ShieldCheck className="w-6 h-6" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Compliance Score</span>
              <span className="text-3xl font-bold">{compliance.score}%</span>
            </div>
            <div className="w-full bg-gray-300 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  compliance.status === 'compliant'
                    ? 'bg-green-600'
                    : compliance.status === 'warning'
                    ? 'bg-amber-600'
                    : 'bg-red-600'
                }`}
                style={{ width: `${compliance.score}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-current border-opacity-20">
            <div>
              <p className="text-xs opacity-75">Active Policies</p>
              <p className="text-2xl font-bold">{compliance.policyCount}</p>
            </div>
            <div>
              <p className="text-xs opacity-75">Violations</p>
              <p className="text-2xl font-bold flex items-center gap-1">
                {compliance.violationCount}
                {compliance.violationCount > 0 && <AlertTriangle className="w-4 h-4" />}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-current border-opacity-20 text-sm">
            <p className="opacity-75">Last Audit: {compliance.lastAudit}</p>
          </div>
        </div>
      )}
    </div>
  );
};
