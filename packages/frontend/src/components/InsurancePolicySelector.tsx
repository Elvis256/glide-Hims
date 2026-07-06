import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, CreditCard, Building2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { insuranceService, type InsurancePolicy } from '../services/insurance';
import type { PayerType } from '../services/encounters';

// Coverage compatibility map — mirrors backend A.5 logic
const COVERAGE_COMPAT: Record<string, string[]> = {
  opd: ['outpatient'],
  ipd: ['inpatient'],
  emergency: ['outpatient', 'inpatient'],
  anc: ['maternity'],
  pnc: ['maternity'],
  dental: ['dental'],
  optical: ['optical'],
};

function isCoverageCompatible(encounterType: string | undefined, coverageType: string): boolean {
  if (!encounterType) return true;
  if (coverageType === 'comprehensive' || coverageType === 'both') return true;
  const required = COVERAGE_COMPAT[encounterType.toLowerCase()];
  if (!required) return true;
  return required.includes(coverageType);
}

interface InsurancePolicySelectorProps {
  patientId: string | undefined;
  payerType: PayerType;
  onPayerTypeChange: (type: PayerType) => void;
  selectedPolicyId: string | undefined;
  onPolicyChange: (policyId: string | undefined) => void;
  encounterType?: string;
  compact?: boolean;
}

export default function InsurancePolicySelector({
  patientId,
  payerType,
  onPayerTypeChange,
  selectedPolicyId,
  onPolicyChange,
  encounterType,
  compact = false,
}: InsurancePolicySelectorProps) {
  const [showPolicies, setShowPolicies] = useState(false);

  const { data: policies, isLoading: policiesLoading } = useQuery({
    queryKey: ['patient-insurance-policies', patientId],
    queryFn: async () => {
      if (!patientId) return [];
      const data = await insuranceService.policies.getByPatient(patientId);
      return Array.isArray(data) ? data : (data as any)?.data || [];
    },
    enabled: !!patientId && payerType === 'insurance',
  });

  useEffect(() => {
    setShowPolicies(payerType === 'insurance');
  }, [payerType]);

  // Auto-select single active policy
  useEffect(() => {
    if (payerType === 'insurance' && policies && policies.length === 1 && !selectedPolicyId) {
      const active = policies.find((p: InsurancePolicy) => p.status === 'active');
      if (active) onPolicyChange(active.id);
    }
  }, [policies, payerType, selectedPolicyId, onPolicyChange]);

  // Clear policy when switching away from insurance
  useEffect(() => {
    if (payerType !== 'insurance' && selectedPolicyId) {
      onPolicyChange(undefined);
    }
  }, [payerType, selectedPolicyId, onPolicyChange]);

  const activePolicies = (policies || []).filter((p: InsurancePolicy) => p.status === 'active');
  const selectedPolicy = activePolicies.find((p: InsurancePolicy) => p.id === selectedPolicyId);

  const payerOptions: { value: PayerType; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'cash', label: 'Cash', icon: <CreditCard className="w-4 h-4" />, color: 'green' },
    { value: 'insurance', label: 'Insurance', icon: <Shield className="w-4 h-4" />, color: 'blue' },
    { value: 'corporate', label: 'Corporate', icon: <Building2 className="w-4 h-4" />, color: 'purple' },
  ];

  const formatCurrency = (amount: number) =>
    `UGX ${Number(amount || 0).toLocaleString()}`;

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {/* Payer Type Toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
        <div className="flex gap-1">
          {payerOptions.map((opt) => {
            const isActive = payerType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPayerTypeChange(opt.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? opt.color === 'green'
                      ? 'bg-green-100 text-green-700 border-2 border-green-400'
                      : opt.color === 'blue'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                        : 'bg-purple-100 text-purple-700 border-2 border-purple-400'
                    : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Insurance Policy Selector */}
      {showPolicies && (
        <div>
          {policiesLoading ? (
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading policies...
            </div>
          ) : activePolicies.length === 0 ? (
            <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg text-sm text-yellow-700">
              <AlertTriangle className="w-4 h-4" />
              No active insurance policies for this patient
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Select Policy</label>
              {activePolicies.map((policy: InsurancePolicy) => {
                const isSelected = selectedPolicyId === policy.id;
                const remaining = (Number(policy.coverageLimit) || 0) - (Number(policy.usedAmount) || 0);
                const isExpiringSoon = new Date(policy.endDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                const coverageIncompat = !isCoverageCompatible(encounterType, policy.coverageType);

                return (
                  <button
                    key={policy.id}
                    type="button"
                    onClick={() => onPolicyChange(policy.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                        : coverageIncompat
                          ? 'border-gray-200 hover:border-blue-300 bg-gray-50 opacity-70'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Shield className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {policy.provider?.name || 'Insurance'}
                          </span>
                          {isSelected && <CheckCircle className="w-3.5 h-3.5 text-blue-600" />}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-500 pl-5">
                          #{policy.policyNumber}
                          {policy.memberNumber && ` • Member: ${policy.memberNumber}`}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 pl-5 text-xs">
                          <span className={`capitalize px-1.5 py-0.5 rounded ${
                            policy.coverageType === 'comprehensive'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {policy.coverageType}
                          </span>
                          {policy.copayPercent != null && policy.copayPercent > 0 && (
                            <span className="text-gray-500">
                              {policy.copayPercent}% copay
                            </span>
                          )}
                          {isExpiringSoon && (
                            <span className="text-orange-600 flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Expiring soon
                            </span>
                          )}
                          {coverageIncompat && (
                            <span className="text-amber-600 flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              May not cover {encounterType?.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      {policy.coverageLimit != null && Number(policy.coverageLimit) > 0 && (
                        <div className="text-right text-xs ml-2">
                          <div className="text-gray-500">Balance</div>
                          <div className={`font-medium ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(remaining)}
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
