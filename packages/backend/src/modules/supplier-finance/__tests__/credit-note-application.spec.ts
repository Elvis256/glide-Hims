import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SupplierFinanceService } from '../supplier-finance.service';
import { PaymentVoucherStatus } from '../../../database/entities/supplier-payment.entity';
import { CreditNoteStatus } from '../../../database/entities/supplier-credit-note.entity';

/**
 * applyCreditNote took a paymentVoucherId, consumed the note's balance and
 * recorded the voucher id in an audit line — the voucher itself was never
 * loaded. The credit was written off and the supplier was still paid in full.
 */
describe('applyCreditNote', () => {
  const TENANT = 'tenant-1';
  const SUPPLIER = 'supplier-1';

  const build = ({ note, voucher }: any) => {
    const applications: any[] = [];
    const manager = {
      getRepository: (entity: any) => {
        switch (entity?.name) {
          case 'SupplierCreditNote':
            return { findOne: jest.fn().mockResolvedValue(note), save: jest.fn(async (x: any) => x) };
          case 'SupplierPayment':
            return { findOne: jest.fn().mockResolvedValue(voucher), save: jest.fn(async (x: any) => x) };
          case 'SupplierCreditNoteApplication':
            return {
              create: jest.fn((x: any) => x),
              save: jest.fn(async (x: any) => {
                applications.push(x);
                return x;
              }),
              find: jest.fn().mockResolvedValue([]),
            };
          default:
            return { create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x) };
        }
      },
    };

    const svc = Object.create(SupplierFinanceService.prototype) as any;
    svc.dataSource = { transaction: async (cb: any) => cb(manager) };
    svc.auditLogService = { log: jest.fn().mockResolvedValue(undefined) };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { svc, applications };
  };

  const aNote = (over: any = {}) => ({
    id: 'cn-1',
    noteNumber: 'CN-0001',
    supplierId: SUPPLIER,
    status: CreditNoteStatus.APPROVED,
    appliedAmount: 0,
    balanceAmount: 300,
    ...over,
  });

  const aVoucher = (over: any = {}) => ({
    id: 'pv-1',
    voucherNumber: 'PV-0001',
    supplierId: SUPPLIER,
    status: PaymentVoucherStatus.APPROVED,
    grossAmount: 1000,
    withholdingTax: 60,
    otherDeductions: 0,
    netAmount: 940,
    ...over,
  });

  it('reduces what the supplier is actually paid', async () => {
    const note = aNote();
    const voucher = aVoucher();
    const { svc, applications } = build({ note, voucher });

    await svc.applyCreditNote('cn-1', 'pv-1', 300, 'user-1', TENANT);

    expect(voucher.otherDeductions).toBe(300);
    expect(voucher.netAmount).toBe(640); // 1000 - 60 withholding - 300 credit
    expect(note.balanceAmount).toBe(0);
    expect(note.status).toBe(CreditNoteStatus.APPLIED);
    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      creditNoteId: 'cn-1',
      paymentVoucherId: 'pv-1',
      amount: 300,
    });
  });

  it('leaves a partially applied note spendable', async () => {
    const note = aNote();
    const voucher = aVoucher();
    const { svc } = build({ note, voucher });

    await svc.applyCreditNote('cn-1', 'pv-1', 100, 'user-1', TENANT);

    expect(note.balanceAmount).toBe(200);
    expect(note.status).toBe(CreditNoteStatus.APPROVED);
    expect(voucher.netAmount).toBe(840);
  });

  it("refuses another supplier's voucher", async () => {
    const { svc } = build({
      note: aNote(),
      voucher: aVoucher({ supplierId: 'supplier-2' }),
    });

    await expect(svc.applyCreditNote('cn-1', 'pv-1', 100, 'user-1', TENANT)).rejects.toThrow(
      /another supplier/i,
    );
  });

  it('refuses a voucher that has already been paid', async () => {
    const { svc } = build({
      note: aNote(),
      voucher: aVoucher({ status: PaymentVoucherStatus.PAID }),
    });

    await expect(svc.applyCreditNote('cn-1', 'pv-1', 100, 'user-1', TENANT)).rejects.toThrow(
      /already been settled/i,
    );
  });

  it('will not deduct more than the voucher still owes', async () => {
    const { svc } = build({
      note: aNote({ balanceAmount: 5000 }),
      voucher: aVoucher(),
    });

    await expect(svc.applyCreditNote('cn-1', 'pv-1', 2000, 'user-1', TENANT)).rejects.toThrow(
      /only 940 remains payable/,
    );
  });

  it('refuses an amount above the note balance', async () => {
    const { svc } = build({ note: aNote(), voucher: aVoucher() });

    await expect(svc.applyCreditNote('cn-1', 'pv-1', 400, 'user-1', TENANT)).rejects.toThrow(
      /exceeds available balance/i,
    );
  });

  it('refuses a zero or negative amount', async () => {
    const { svc } = build({ note: aNote(), voucher: aVoucher() });

    await expect(svc.applyCreditNote('cn-1', 'pv-1', 0, 'user-1', TENANT)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses when the voucher does not exist', async () => {
    const { svc } = build({ note: aNote(), voucher: null });

    await expect(svc.applyCreditNote('cn-1', 'missing', 100, 'user-1', TENANT)).rejects.toThrow(
      NotFoundException,
    );
  });
});

/**
 * Cancelling a voucher used to flip its status and nothing else, so a credit
 * applied to it stayed spent against a voucher that no longer existed.
 */
describe('cancelPaymentVoucher — returns applied credit', () => {
  const TENANT = 'tenant-1';

  const build = ({ voucher, applications, notes }: any) => {
    const saved: any[] = [];
    const manager = {
      getRepository: (entity: any) => {
        switch (entity?.name) {
          case 'SupplierPayment':
            return {
              findOne: jest.fn().mockResolvedValue(voucher),
              save: jest.fn(async (x: any) => x),
            };
          case 'SupplierCreditNoteApplication':
            return {
              find: jest.fn().mockResolvedValue(applications),
              save: jest.fn(async (x: any) => {
                saved.push(x);
                return x;
              }),
            };
          case 'SupplierCreditNote':
            return {
              findOne: jest.fn(async ({ where }: any) =>
                notes.find((n: any) => n.id === where.id) || null,
              ),
              save: jest.fn(async (x: any) => x),
            };
          default:
            return { create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x) };
        }
      },
    };

    const svc = Object.create(SupplierFinanceService.prototype) as any;
    svc.dataSource = { transaction: async (cb: any) => cb(manager) };
    svc.auditLogService = { log: jest.fn().mockResolvedValue(undefined) };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { svc, saved };
  };

  it('gives the credit back to the note and restores the voucher net', async () => {
    const voucher = {
      id: 'pv-1',
      voucherNumber: 'PV-0001',
      status: PaymentVoucherStatus.APPROVED,
      grossAmount: 1000,
      withholdingTax: 60,
      otherDeductions: 300,
      netAmount: 640,
    };
    const note = {
      id: 'cn-1',
      status: CreditNoteStatus.APPLIED,
      appliedAmount: 300,
      balanceAmount: 0,
    };
    const { svc, saved } = build({
      voucher,
      applications: [{ id: 'app-1', creditNoteId: 'cn-1', amount: 300, reversedAt: null }],
      notes: [note],
    });

    await svc.cancelPaymentVoucher('pv-1', 'user-9', TENANT);

    expect(note.balanceAmount).toBe(300);
    expect(note.appliedAmount).toBe(0);
    expect(note.status).toBe(CreditNoteStatus.APPROVED);
    expect(voucher.otherDeductions).toBe(0);
    expect(voucher.netAmount).toBe(940);
    expect(voucher.status).toBe(PaymentVoucherStatus.CANCELLED);
    expect(saved[0]).toMatchObject({ id: 'app-1', reversedBy: 'user-9' });
    expect(saved[0].reversedAt).toBeInstanceOf(Date);
  });

  it('still refuses to cancel a paid voucher', async () => {
    const { svc } = build({
      voucher: { id: 'pv-1', status: PaymentVoucherStatus.PAID },
      applications: [],
      notes: [],
    });

    await expect(svc.cancelPaymentVoucher('pv-1', 'user-9', TENANT)).rejects.toThrow(
      /cannot cancel a paid voucher/i,
    );
  });

  it('leaves a voucher with no applied credit untouched', async () => {
    const voucher = {
      id: 'pv-1',
      voucherNumber: 'PV-0001',
      status: PaymentVoucherStatus.APPROVED,
      grossAmount: 1000,
      withholdingTax: 0,
      otherDeductions: 50, // a manual deduction, not from a credit note
      netAmount: 950,
    };
    const { svc } = build({ voucher, applications: [], notes: [] });

    await svc.cancelPaymentVoucher('pv-1', 'user-9', TENANT);

    expect(voucher.otherDeductions).toBe(50);
    expect(voucher.netAmount).toBe(950);
  });
});
