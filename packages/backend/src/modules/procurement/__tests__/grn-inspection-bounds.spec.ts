import { BadRequestException } from '@nestjs/common';
import { ProcurementService } from '../procurement.service';
import { GRNStatus } from '../../../database/entities/goods-receipt.entity';

/**
 * createGoodsReceipt caps quantityReceived at the PO's outstanding quantity,
 * but postGoodsReceipt posts quantityAccepted to stock — and inspection set
 * quantityAccepted with no upper bound at all. Accepting more than arrived
 * walked stock straight past the PO ceiling.
 */
describe('inspectGoodsReceipt — accepted/rejected cannot exceed received', () => {
  const TENANT = 'tenant-1';
  const GRN_ID = 'grn-1';

  const buildService = (items: any[]) => {
    const saved: any[] = [];
    const grn = { id: GRN_ID, grnNumber: 'GRN-001', status: GRNStatus.PENDING_INSPECTION };

    const manager = {
      getRepository: (entity: any) => {
        const name = entity?.name || '';
        if (name === 'GoodsReceiptNote') {
          return { findOne: jest.fn().mockResolvedValue(grn), save: jest.fn(async (x) => x) };
        }
        if (name === 'GoodsReceiptItem') {
          return {
            find: jest.fn().mockResolvedValue(items),
            save: jest.fn(async (x) => {
              saved.push(x);
              return x;
            }),
          };
        }
        // AuditLog
        return { create: jest.fn((x) => x), save: jest.fn(async (x) => x) };
      },
    };

    const svc = Object.create(ProcurementService.prototype) as any;
    svc.dataSource = { transaction: async (cb: any) => cb(manager) };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { svc, saved, grn };
  };

  const line = (over: Partial<any> = {}) => ({
    itemId: 'item-1',
    itemName: 'Examination Gloves',
    quantityReceived: 100,
    quantityAccepted: 0,
    quantityRejected: 0,
    ...over,
  });

  it('rejects accepting more than was received', async () => {
    const { svc } = buildService([line()]);

    await expect(
      svc.inspectGoodsReceipt(
        GRN_ID,
        { inspectedItems: [{ itemId: 'item-1', quantityAccepted: 500, quantityRejected: 0 }] },
        'user-1',
        TENANT,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when accepted + rejected together exceed received', async () => {
    const { svc } = buildService([line()]);

    await expect(
      svc.inspectGoodsReceipt(
        GRN_ID,
        { inspectedItems: [{ itemId: 'item-1', quantityAccepted: 80, quantityRejected: 40 }] },
        'user-1',
        TENANT,
      ),
    ).rejects.toThrow(/only 100 were received/);
  });

  it('accepts a short delivery — accepted + rejected below received', async () => {
    const { svc, saved } = buildService([line()]);

    await svc.inspectGoodsReceipt(
      GRN_ID,
      {
        inspectedItems: [
          { itemId: 'item-1', quantityAccepted: 70, quantityRejected: 20, rejectionReason: 'torn' },
        ],
      },
      'user-1',
      TENANT,
    );

    expect(saved[0]).toMatchObject({ quantityAccepted: 70, quantityRejected: 20 });
  });

  it('accepts the exact received quantity', async () => {
    const { svc, saved } = buildService([line()]);

    await svc.inspectGoodsReceipt(
      GRN_ID,
      { inspectedItems: [{ itemId: 'item-1', quantityAccepted: 100, quantityRejected: 0 }] },
      'user-1',
      TENANT,
    );

    expect(saved[0].quantityAccepted).toBe(100);
  });

  it('rejects an inspection for an item that is not on the GRN', async () => {
    const { svc } = buildService([line()]);

    await expect(
      svc.inspectGoodsReceipt(
        GRN_ID,
        { inspectedItems: [{ itemId: 'ghost-item', quantityAccepted: 1, quantityRejected: 0 }] },
        'user-1',
        TENANT,
      ),
    ).rejects.toThrow(/not on GRN/);
  });
});
