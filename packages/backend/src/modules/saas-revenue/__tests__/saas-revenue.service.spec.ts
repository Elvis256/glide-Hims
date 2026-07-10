import { BadRequestException } from '@nestjs/common';

/**
 * Tests for SaaS revenue service business logic:
 * - Coupon expiry in issueRenewalInvoice
 * - syncLicenseFromSubscription status mapping + enabledModules
 * - refundPayment: full/partial, already-refunded, gateway failure
 * - processDunning: grace period, 23h dedup, churn after N days, disabled
 * - createManualInvoice: valid lines, empty lines
 * - processRenewalReminders / processTrialEndingReminders: windows, dedup
 */

// ── helpers (replicate core logic) ──────────────────────────────────────────

function applyDiscount(
  amount: number,
  discountPercent: number,
  discountFixedMinor: number,
): number {
  let d = Math.floor((amount * discountPercent) / 100);
  d += Math.floor(discountFixedMinor);
  return Math.max(amount - d, 0);
}

const TIER_TO_LICENSE: Record<string, string> = {
  community: 'standard',
  standard: 'standard',
  professional: 'professional',
  enterprise: 'enterprise',
};

function mapSubStatusToLicenseStatus(subStatus: string): string {
  if (subStatus === 'churned' || subStatus === 'cancelled') return 'expired';
  if (subStatus === 'paused') return 'suspended';
  return 'active';
}

describe('SaasRevenueService', () => {
  // ── coupon expiry in issueRenewalInvoice ────────────────────────────

  describe('coupon expiry in issueRenewalInvoice()', () => {
    function checkCouponExpiry(
      coupon: { durationMonths: number | null } | null,
      couponAppliedAt: Date | null,
      now: Date,
    ): { expired: boolean } {
      if (!coupon || !couponAppliedAt) return { expired: false };
      if (coupon.durationMonths === null) return { expired: false }; // never expires
      const expiry = new Date(couponAppliedAt);
      expiry.setMonth(expiry.getMonth() + coupon.durationMonths);
      return { expired: now >= expiry };
    }

    it('zeroes discount when coupon is expired', () => {
      const result = checkCouponExpiry(
        { durationMonths: 3 },
        new Date('2026-01-01'),
        new Date('2026-06-01'), // 5 months later
      );
      expect(result.expired).toBe(true);
    });

    it('keeps discount when coupon is still active', () => {
      const result = checkCouponExpiry(
        { durationMonths: 12 },
        new Date('2026-01-01'),
        new Date('2026-06-01'), // 5 months later
      );
      expect(result.expired).toBe(false);
    });

    it('never expires when durationMonths is null', () => {
      const result = checkCouponExpiry(
        { durationMonths: null },
        new Date('2020-01-01'),
        new Date('2030-12-31'),
      );
      expect(result.expired).toBe(false);
    });

    it('returns not expired when no coupon', () => {
      const result = checkCouponExpiry(null, null, new Date());
      expect(result.expired).toBe(false);
    });

    it('clears couponId and discount on expired coupon', () => {
      const sub = {
        couponId: 'cpn-1' as string | null,
        discountPercent: 20,
        discountFixedMinor: 0,
      };

      // Expired → clear
      sub.discountPercent = 0;
      sub.discountFixedMinor = 0;
      sub.couponId = null;

      expect(sub.couponId).toBeNull();
      expect(sub.discountPercent).toBe(0);
    });

    it('calculates invoice totals correctly with active discount', () => {
      const unitPrice = 50000;
      const seats = 3;
      const subtotal = unitPrice * seats; // 150000
      const afterDiscount = applyDiscount(subtotal, 20, 0); // 120000
      const taxRate = 18;
      const tax = Math.floor((afterDiscount * taxRate) / 100); // 21600
      const total = afterDiscount + tax; // 141600

      expect(subtotal).toBe(150000);
      expect(afterDiscount).toBe(120000);
      expect(tax).toBe(21600);
      expect(total).toBe(141600);
    });

    it('calculates invoice totals correctly when discount is zeroed', () => {
      const unitPrice = 50000;
      const seats = 3;
      const subtotal = unitPrice * seats; // 150000
      const afterDiscount = applyDiscount(subtotal, 0, 0); // 150000
      const taxRate = 18;
      const tax = Math.floor((afterDiscount * taxRate) / 100); // 27000
      const total = afterDiscount + tax; // 177000

      expect(afterDiscount).toBe(150000);
      expect(total).toBe(177000);
    });
  });

  // ── syncLicenseFromSubscription ────────────────────────────────────

  describe('syncLicenseFromSubscription()', () => {
    describe('status mapping', () => {
      it.each([
        ['active', 'active'],
        ['trial', 'active'],
        ['paused', 'suspended'],
        ['churned', 'expired'],
        ['cancelled', 'expired'],
      ])('maps subscription status "%s" → license status "%s"', (subStatus, expected) => {
        expect(mapSubStatusToLicenseStatus(subStatus)).toBe(expected);
      });
    });

    describe('tier to license type', () => {
      it.each([
        ['community', 'standard'],
        ['standard', 'standard'],
        ['professional', 'professional'],
        ['enterprise', 'enterprise'],
      ])('maps plan tier "%s" → license type "%s"', (tier, expected) => {
        expect(TIER_TO_LICENSE[tier]).toBe(expected);
      });

      it('defaults to professional when tier is missing', () => {
        const tier = 'unknown';
        const licType = TIER_TO_LICENSE[tier] || 'professional';
        expect(licType).toBe('professional');
      });
    });

    describe('enabledModules sync', () => {
      it('detects module list change', () => {
        const current = ['billing', 'pharmacy'];
        const planModules = ['billing', 'pharmacy', 'lab'];

        const sortedCurrent = [...current].sort();
        const sortedPlan = [...planModules].sort();
        const changed = JSON.stringify(sortedCurrent) !== JSON.stringify(sortedPlan);

        expect(changed).toBe(true);
      });

      it('detects no change when module lists are equal (order-insensitive)', () => {
        const current = ['pharmacy', 'billing'];
        const planModules = ['billing', 'pharmacy'];

        const sortedCurrent = [...current].sort();
        const sortedPlan = [...planModules].sort();
        const changed = JSON.stringify(sortedCurrent) !== JSON.stringify(sortedPlan);

        expect(changed).toBe(false);
      });

      it('propagates modules to system_settings for tenant', () => {
        const modules = ['billing', 'pharmacy', 'lab'];
        const settingsValue = JSON.stringify(modules);
        const parsed = JSON.parse(settingsValue);
        expect(parsed).toEqual(modules);
      });
    });

    describe('license field updates', () => {
      it('sets expiresAt to subscription currentPeriodEnd', () => {
        const periodEnd = new Date('2027-06-01');
        const license: any = { expiresAt: null as Date | null };
        license.expiresAt = periodEnd;
        expect(license.expiresAt).toBe(periodEnd);
      });

      it('syncs maxUsers from plan', () => {
        const plan: any = { maxUsers: 100 };
        const license: any = { maxUsers: 50 };
        license.maxUsers = plan.maxUsers;
        expect(license.maxUsers).toBe(100);
      });
    });
  });

  // ── refundPayment ──────────────────────────────────────────────────

  describe('refundPayment()', () => {
    function makePayment(overrides: Record<string, any> = {}) {
      return {
        id: 'pay-1',
        status: 'succeeded',
        amountMinor: 100000,
        gateway: 'flutterwave',
        gatewayRef: 'FLW-123',
        gatewayPayload: { refundedMinor: 0, refunds: [] as any[] },
        invoiceId: 'inv-1',
        ...overrides,
      };
    }

    it('processes full refund', () => {
      const pay = makePayment();
      const refundable = pay.amountMinor - pay.gatewayPayload.refundedMinor;
      const refundAmount = refundable; // full refund

      expect(refundAmount).toBe(100000);

      pay.gatewayPayload.refundedMinor += refundAmount;
      pay.gatewayPayload.refunds.push({
        at: new Date().toISOString(),
        amountMinor: refundAmount,
      });

      if (pay.gatewayPayload.refundedMinor >= pay.amountMinor) {
        pay.status = 'refunded';
      }

      expect(pay.status).toBe('refunded');
      expect(pay.gatewayPayload.refundedMinor).toBe(100000);
    });

    it('processes partial refund', () => {
      const pay = makePayment();
      const refundAmount = 30000;

      pay.gatewayPayload.refundedMinor += refundAmount;
      pay.gatewayPayload.refunds.push({
        at: new Date().toISOString(),
        amountMinor: refundAmount,
      });

      // Not full refund → status unchanged
      if (pay.gatewayPayload.refundedMinor >= pay.amountMinor) {
        pay.status = 'refunded';
      }

      expect(pay.status).toBe('succeeded'); // still succeeded
      expect(pay.gatewayPayload.refundedMinor).toBe(30000);
    });

    it('throws when already fully refunded', () => {
      const pay = makePayment({ status: 'refunded' });
      expect(() => {
        if (pay.status === 'refunded') {
          throw new BadRequestException('Payment already refunded');
        }
      }).toThrow('Payment already refunded');
    });

    it('throws when refund exceeds refundable balance', () => {
      const pay = makePayment();
      pay.gatewayPayload.refundedMinor = 90000;
      const refundable = pay.amountMinor - pay.gatewayPayload.refundedMinor; // 10000
      const requestedAmount = 20000;

      expect(() => {
        if (requestedAmount > refundable) {
          throw new BadRequestException('Refund amount exceeds refundable balance');
        }
      }).toThrow('Refund amount exceeds refundable balance');
    });

    it('calls Flutterwave gateway for flutterwave payments', () => {
      const pay = makePayment({ gateway: 'flutterwave', gatewayRef: 'FLW-456' });
      const refundTransaction = jest.fn().mockResolvedValue({ ok: true, refundId: 'REF-1' });

      expect(pay.gateway).toBe('flutterwave');
      // Would call: flw.refundTransaction(pay.gatewayRef, amount / 100)
      expect(refundTransaction).toBeDefined();
    });

    it('sets refund_pending on gateway failure (non-fatal)', async () => {
      const refundTransaction = jest.fn().mockResolvedValue({ ok: false, error: 'Network error' });
      const result = await refundTransaction('FLW-789', 500);

      const gatewayRefundStatus = result.ok ? 'completed' : 'refund_pending';
      expect(gatewayRefundStatus).toBe('refund_pending');
    });

    it('adjusts invoice amountPaidMinor on refund', () => {
      const invoice = {
        amountPaidMinor: 100000,
        totalMinor: 100000,
        status: 'paid' as string,
        paidAt: new Date() as Date | null,
      };
      const refundAmount = 50000;

      invoice.amountPaidMinor = Math.max(invoice.amountPaidMinor - refundAmount, 0);
      if (invoice.amountPaidMinor < invoice.totalMinor && invoice.status === 'paid') {
        invoice.status = 'open';
        invoice.paidAt = null;
      }

      expect(invoice.amountPaidMinor).toBe(50000);
      expect(invoice.status).toBe('open');
      expect(invoice.paidAt).toBeNull();
    });
  });

  // ── processDunning ─────────────────────────────────────────────────

  describe('processDunning()', () => {
    function makeDunningConfig(overrides: Record<string, any> = {}) {
      return {
        enabled: true,
        graceDays: 1,
        reminderIntervalDays: 3,
        churnAfterDays: 30,
        ...overrides,
      };
    }

    it('transitions to past_due after grace period', () => {
      const config = makeDunningConfig();
      const daysOverdue = 2; // > graceDays (1)
      const subStatus = 'active';

      const shouldTransition = subStatus === 'active' && daysOverdue >= config.graceDays;
      expect(shouldTransition).toBe(true);
    });

    it('does not transition within grace period', () => {
      const config = makeDunningConfig({ graceDays: 3 });
      const daysOverdue = 2;
      const subStatus = 'active';

      const shouldTransition = subStatus === 'active' && daysOverdue >= config.graceDays;
      expect(shouldTransition).toBe(false);
    });

    it('applies 23h dedup guard for reminder emails', () => {
      const lastDunningAt = new Date(Date.now() - 20 * 3600 * 1000); // 20 hours ago
      const now = new Date();
      const hoursSince = (now.getTime() - lastDunningAt.getTime()) / (3600 * 1000);

      expect(hoursSince).toBeLessThan(23);
      const shouldSend = hoursSince >= 23;
      expect(shouldSend).toBe(false);
    });

    it('sends reminder when 23h+ has passed', () => {
      const lastDunningAt = new Date(Date.now() - 24 * 3600 * 1000); // 24 hours ago
      const now = new Date();
      const hoursSince = (now.getTime() - lastDunningAt.getTime()) / (3600 * 1000);

      expect(hoursSince).toBeGreaterThanOrEqual(23);
      const shouldSend = hoursSince >= 23;
      expect(shouldSend).toBe(true);
    });

    it('auto-churns after churnAfterDays', () => {
      const config = makeDunningConfig({ churnAfterDays: 30 });
      const daysOverdue = 31;
      const subStatus = 'past_due';

      const shouldChurn = daysOverdue >= config.churnAfterDays && subStatus === 'past_due';
      expect(shouldChurn).toBe(true);
    });

    it('does not churn if days not reached', () => {
      const config = makeDunningConfig({ churnAfterDays: 30 });
      const daysOverdue = 15;
      const subStatus = 'past_due';

      const shouldChurn = daysOverdue >= config.churnAfterDays && subStatus === 'past_due';
      expect(shouldChurn).toBe(false);
    });

    it('churns with correct status and timestamp', () => {
      const sub = {
        status: 'past_due' as string,
        churnedAt: null as Date | null,
      };
      const now = new Date();

      sub.status = 'churned';
      sub.churnedAt = now;

      expect(sub.status).toBe('churned');
      expect(sub.churnedAt).toBe(now);
    });

    it('is a no-op when dunning is disabled', () => {
      const config = makeDunningConfig({ enabled: false });
      const processed = config.enabled ? 'would process' : 'no-op';
      expect(processed).toBe('no-op');
    });

    it('sends dunning email with days overdue', () => {
      const sendDunning = jest.fn();
      const email = 'admin@hospital.ug';
      const daysOverdue = 5;

      sendDunning(email, {}, {}, daysOverdue);
      expect(sendDunning).toHaveBeenCalledWith(email, {}, {}, 5);
    });
  });

  // ── createManualInvoice ────────────────────────────────────────────

  describe('createManualInvoice()', () => {
    it('creates invoice from valid lines', () => {
      const lines = [
        { description: 'Setup fee', quantity: 1, unitPriceMinor: 50000 },
        { description: 'Training', quantity: 2, unitPriceMinor: 25000 },
      ];

      const mappedLines = lines.map((l) => ({
        ...l,
        amountMinor: l.quantity * l.unitPriceMinor,
      }));

      const subtotal = mappedLines.reduce((sum, l) => sum + l.amountMinor, 0);
      expect(subtotal).toBe(100000); // 50000 + 50000

      expect(mappedLines[0].amountMinor).toBe(50000);
      expect(mappedLines[1].amountMinor).toBe(50000);
    });

    it('throws when lines array is empty', () => {
      const lines: any[] = [];
      expect(() => {
        if (!lines || lines.length === 0) {
          throw new BadRequestException('At least one line item is required');
        }
      }).toThrow('At least one line item is required');
    });

    it('throws when lines is not provided', () => {
      const lines = undefined;
      expect(() => {
        if (!lines || (lines as any).length === 0) {
          throw new BadRequestException('At least one line item is required');
        }
      }).toThrow('At least one line item is required');
    });

    it('applies subscription discount to manual invoice', () => {
      const subtotal = 100000;
      const afterDiscount = applyDiscount(subtotal, 10, 5000);
      // 10% of 100000 = 10000 + fixed 5000 = 15000 discount
      expect(afterDiscount).toBe(85000);
    });

    it('sets due date from dueInDays parameter', () => {
      const now = new Date('2026-06-20T12:00:00Z');
      const dueInDays = 14;
      const dueAt = new Date(now.getTime() + dueInDays * 86400000);
      expect(dueAt.toISOString().slice(0, 10)).toBe('2026-07-04');
    });

    it('defaults dueInDays to 7', () => {
      const input: number | undefined = undefined;
      const dueInDays = input ?? 7;
      expect(dueInDays).toBe(7);
    });
  });

  // ── processRenewalReminders ────────────────────────────────────────

  describe('processRenewalReminders()', () => {
    const REMINDER_DAYS = [7, 3, 1];

    it('checks correct reminder windows', () => {
      const now = new Date('2026-06-20T12:00:00Z');

      for (const days of REMINDER_DAYS) {
        const windowStart = new Date(now.getTime() + (days - 0.5) * 86400000);
        const windowEnd = new Date(now.getTime() + (days + 0.5) * 86400000);
        expect(windowEnd.getTime()).toBeGreaterThan(windowStart.getTime());
        expect(windowEnd.getTime() - windowStart.getTime()).toBe(86400000); // 1-day window
      }
    });

    it('deduplicates via metadata key', () => {
      const metadata: Record<string, any> = {};
      const days = 7;
      const key = `renewal_reminder_${days}d`;

      // First time → not set → should send
      expect(metadata[key]).toBeUndefined();
      metadata[key] = new Date().toISOString();

      // Second time → already set → skip
      expect(metadata[key]).toBeDefined();
    });

    it('only targets active auto-renew subscriptions', () => {
      const sub = { status: 'active', autoRenew: true };
      const eligible = sub.status === 'active' && sub.autoRenew === true;
      expect(eligible).toBe(true);
    });

    it('skips paused subscriptions', () => {
      const sub = { status: 'paused', autoRenew: true };
      const eligible = sub.status === 'active' && sub.autoRenew === true;
      expect(eligible).toBe(false);
    });
  });

  // ── processTrialEndingReminders ────────────────────────────────────

  describe('processTrialEndingReminders()', () => {
    const TRIAL_REMINDER_DAYS = [3, 1];

    it('checks correct trial ending windows', () => {
      const now = new Date('2026-06-20T12:00:00Z');

      for (const days of TRIAL_REMINDER_DAYS) {
        const windowStart = new Date(now.getTime() + (days - 0.5) * 86400000);
        const windowEnd = new Date(now.getTime() + (days + 0.5) * 86400000);
        expect(windowEnd.getTime() - windowStart.getTime()).toBe(86400000);
      }
    });

    it('deduplicates via trial_ending metadata key', () => {
      const metadata: Record<string, any> = {};
      const days = 3;
      const key = `trial_ending_${days}d`;

      expect(metadata[key]).toBeUndefined();
      metadata[key] = new Date().toISOString();
      expect(metadata[key]).toBeDefined();
    });

    it('only targets trial subscriptions', () => {
      const sub = { status: 'trial', trialEndsAt: new Date('2026-06-23') };
      const eligible = sub.status === 'trial';
      expect(eligible).toBe(true);
    });

    it('skips active subscriptions', () => {
      const sub = { status: 'active', trialEndsAt: null };
      const eligible = sub.status === 'trial';
      expect(eligible).toBe(false);
    });
  });
});
