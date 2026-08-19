import { POStatus } from '../../database/entities/purchase-order.entity';

/**
 * The purchase-order statuses that count as money committed.
 *
 * The analytics services each had their own answer and none of them agreed:
 * category and department spend counted ('approved', 'fully_received'), the
 * supplier metrics counted [APPROVED, FULLY_RECEIVED], and both spend-trend
 * queries counted APPROVED alone. All three dropped SENT and
 * PARTIALLY_RECEIVED — orders placed with the supplier and either en route or
 * part-delivered, which are as committed as spend gets short of payment.
 *
 * Counting APPROVED alone was the worst of them: a PO leaves that status the
 * moment it is sent, so a month whose orders had actually been delivered
 * reported close to nothing. The trend line measured the approvals in-tray and
 * presented it as historical spend.
 *
 * DRAFT and PENDING_APPROVAL are excluded because nobody has committed to them
 * yet, and CANCELLED because the commitment was withdrawn.
 */
export const COMMITTED_SPEND_PO_STATUSES: POStatus[] = [
  POStatus.APPROVED,
  POStatus.SENT,
  POStatus.PARTIALLY_RECEIVED,
  POStatus.FULLY_RECEIVED,
  POStatus.CLOSED,
];

/** The same list for raw SQL `IN (...)` clauses. */
export const COMMITTED_SPEND_PO_STATUS_VALUES: string[] = COMMITTED_SPEND_PO_STATUSES.map(
  (s) => s as string,
);
