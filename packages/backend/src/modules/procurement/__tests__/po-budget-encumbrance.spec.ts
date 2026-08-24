import { BadRequestException } from '@nestjs/common';
import { ProcurementService } from '../procurement.service';

/**
 * Auto-encumbering, turned on deliberately.
 *
 * The capacity check runs inside the approval transaction because that is what
 * blocks the order; the reservation runs after the commit because
 * BudgetService writes on its own connection and would otherwise survive an
 * approval that rolled back.
 */
describe('assertBudgetCapacity', () => {
  const TENANT = 'tenant-1';

  const build = (capacity: any, throws = false) => {
    const getRemainingCapacity = throws
      ? jest.fn().mockRejectedValue(new Error('budget service down'))
      : jest.fn().mockResolvedValue(capacity);
    const svc = Object.create(ProcurementService.prototype) as any;
    svc.budgetService = { getRemainingCapacity };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { svc, getRemainingCapacity };
  };

  const po = (amount: number) => ({
    id: 'po-1',
    orderNumber: 'PO-0001',
    facilityId: 'fac-1',
    totalAmount: amount,
  });

  it('refuses an order that exceeds the remaining budget', async () => {
    const { svc } = build({ remaining: 500_000, allocation: 10_000_000 });

    await expect(svc.assertBudgetCapacity(po(750_000), TENANT)).rejects.toThrow(
      BadRequestException,
    );
    await expect(svc.assertBudgetCapacity(po(750_000), TENANT)).rejects.toThrow(
      /remaining budget of 500,000/,
    );
  });

  it('allows an order that exactly exhausts the budget', async () => {
    const { svc } = build({ remaining: 500_000, allocation: 10_000_000 });
    await expect(svc.assertBudgetCapacity(po(500_000), TENANT)).resolves.toBeUndefined();
  });

  it('does not block a facility that has no budget configured', async () => {
    const { svc } = build(null);
    await expect(svc.assertBudgetCapacity(po(99_000_000), TENANT)).resolves.toBeUndefined();
  });

  it('does not turn a budget-service outage into an approval outage', async () => {
    const { svc } = build(null, true);
    await expect(svc.assertBudgetCapacity(po(99_000_000), TENANT)).resolves.toBeUndefined();
  });

  it('skips the lookup entirely for a zero-value order', async () => {
    const { svc, getRemainingCapacity } = build({ remaining: 0, allocation: 0 });
    await expect(svc.assertBudgetCapacity(po(0), TENANT)).resolves.toBeUndefined();
    expect(getRemainingCapacity).not.toHaveBeenCalled();
  });

  it('tells the approver what to do about it', async () => {
    const { svc } = build({ remaining: 100, allocation: 5000 });
    await expect(svc.assertBudgetCapacity(po(200), TENANT)).rejects.toThrow(
      /Increase the facility budget or cancel outstanding orders/,
    );
  });
});
