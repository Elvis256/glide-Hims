import {
  COMMITTED_SPEND_PO_STATUSES,
  COMMITTED_SPEND_PO_STATUS_VALUES,
} from '../spend-status.constants';
import { POStatus } from '../../../database/entities/purchase-order.entity';

/**
 * Three analytics queries each had their own answer to "what counts as spend"
 * and none agreed. Counting APPROVED alone was the damaging one: a PO leaves
 * that status the moment it is sent, so a month whose orders had actually been
 * delivered reported close to nothing.
 */
describe('COMMITTED_SPEND_PO_STATUSES', () => {
  it('counts an order that has been sent to the supplier', () => {
    expect(COMMITTED_SPEND_PO_STATUSES).toContain(POStatus.SENT);
  });

  it('counts a part-delivered order', () => {
    expect(COMMITTED_SPEND_PO_STATUSES).toContain(POStatus.PARTIALLY_RECEIVED);
  });

  it('counts delivered and closed orders', () => {
    expect(COMMITTED_SPEND_PO_STATUSES).toContain(POStatus.FULLY_RECEIVED);
    expect(COMMITTED_SPEND_PO_STATUSES).toContain(POStatus.CLOSED);
  });

  it('does not count an order nobody has committed to yet', () => {
    expect(COMMITTED_SPEND_PO_STATUSES).not.toContain(POStatus.DRAFT);
    expect(COMMITTED_SPEND_PO_STATUSES).not.toContain(POStatus.PENDING_APPROVAL);
  });

  it('does not count a withdrawn commitment', () => {
    expect(COMMITTED_SPEND_PO_STATUSES).not.toContain(POStatus.CANCELLED);
  });

  it('covers every status exactly once, so a new one cannot be forgotten silently', () => {
    const all = Object.values(POStatus);
    const excluded = [POStatus.DRAFT, POStatus.PENDING_APPROVAL, POStatus.CANCELLED];
    expect(new Set(COMMITTED_SPEND_PO_STATUSES).size).toBe(COMMITTED_SPEND_PO_STATUSES.length);
    expect([...COMMITTED_SPEND_PO_STATUSES, ...excluded].sort()).toEqual([...all].sort());
  });

  it('exposes the same list as plain strings for raw SQL', () => {
    expect(COMMITTED_SPEND_PO_STATUS_VALUES).toEqual(COMMITTED_SPEND_PO_STATUSES.map(String));
    expect(COMMITTED_SPEND_PO_STATUS_VALUES).toContain('sent');
  });
});
