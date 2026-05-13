import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Settings, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ApprovalChainPreviewResponse,
  PreviewApprovalChainInput,
  previewApprovalChain,
} from '../../services/orgApproval';

interface Props extends PreviewApprovalChainInput {
  /** ms to wait after props change before re-querying. Default 350. */
  debounceMs?: number;
  /** Render nothing when amount === 0 and no items. Default true. */
  hideWhenEmpty?: boolean;
  /** Allow admins to jump to policy admin from inline link. */
  showAdminLink?: boolean;
}

const SOURCE_LABEL: Record<ApprovalChainPreviewResponse['source'], string> = {
  policy: 'Policy',
  'default-manager-chain': 'Default manager chain',
  fallback: 'Fallback (no policy + no manager hierarchy)',
};

const QUORUM_LABEL: Record<NonNullable<ApprovalChainPreviewResponse['steps'][number]['quorumType']>, string> = {
  any: 'any one approves',
  all: 'all must approve',
  majority: 'majority must approve',
  m_of_n: 'quorum',
};

export function ApprovalChainPreview({
  documentType,
  amount,
  facilityId,
  departmentId,
  category,
  debounceMs = 350,
  hideWhenEmpty = true,
  showAdminLink = true,
}: Props) {
  const [data, setData] = useState<ApprovalChainPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hideWhenEmpty && (!amount || amount <= 0)) {
      setData(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await previewApprovalChain({
          documentType,
          amount,
          facilityId,
          departmentId,
          category,
        });
        setData(res);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load approval preview');
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [documentType, amount, facilityId, departmentId, category, debounceMs, hideWhenEmpty]);

  if (hideWhenEmpty && (!amount || amount <= 0) && !loading) return null;

  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
          <CheckCircle2 className="h-4 w-4" />
          Approval routing preview
        </div>
        {showAdminLink && (
          <Link
            to="/admin/procurement/org-approvals"
            className="text-xs text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
          >
            <Settings className="h-3 w-3" /> Manage
          </Link>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-600 py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Resolving chain…
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-2 text-sm text-red-700 py-2">
          <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="text-xs text-gray-600 mb-2">
            Source:{' '}
            <span
              className={
                data.source === 'policy'
                  ? 'font-medium text-blue-900'
                  : data.source === 'default-manager-chain'
                  ? 'font-medium text-amber-700'
                  : 'font-medium text-red-700'
              }
            >
              {SOURCE_LABEL[data.source]}
              {data.policyName ? ` — ${data.policyName}` : ''}
            </span>
          </div>

          {data.steps.length === 0 ? (
            <div className="text-sm text-amber-700">
              No approval steps could be resolved.{' '}
              {showAdminLink && (
                <Link to="/admin/procurement/org-approvals" className="underline">
                  Configure a policy
                </Link>
              )}{' '}
              or set the requester&rsquo;s manager.
            </div>
          ) : (
            <ol className="space-y-1">
              {data.steps.map((s, idx) => (
                <li key={s.approvalLevel} className="flex items-start gap-2 text-sm">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-200 text-blue-900 text-xs font-semibold flex-shrink-0">
                    {s.approvalLevel}
                  </span>
                  <div className="flex-1">
                    <div className="text-gray-900">
                      {s.groupId ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-blue-700" />
                          <span className="font-medium">{s.groupName || 'Group'}</span>
                          {s.quorumType && (
                            <span className="text-xs text-gray-600">
                              ({QUORUM_LABEL[s.quorumType]}
                              {s.quorumType === 'm_of_n' && s.quorumCount
                                ? ` ${s.quorumCount}`
                                : ''}
                              )
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="font-medium">
                          {s.approverName || (
                            <span className="italic text-gray-600">
                              Any user with role &ldquo;{s.requiredRole}&rdquo;
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 capitalize">{s.requiredRole}</div>
                  </div>
                  {idx < data.steps.length - 1 && (
                    <span className="text-gray-400 text-lg leading-none" aria-hidden>
                      ↓
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}

export default ApprovalChainPreview;
