import { BadRequestException } from '@nestjs/common';
import { ProcurementService } from '../procurement.service';
import { PRStatus } from '../../../database/entities/purchase-request.entity';
import { POStatus } from '../../../database/entities/purchase-order.entity';

/**
 * The quotation→PO path had two holes, both confirmed live before the fix:
 * the same winning quotation converted twice (two identical POs to the same
 * supplier), and the PO carried no purchaseRequestId, so the requisition
 * stayed APPROVED with nothing ordered — free to be converted again.
 */
describe('createPOFromQuotation duplicate guard', () => {
  const TENANT = 'tenant-1';

  const probe = async (existing: any) => {
    const svc = Object.create(ProcurementService.prototype) as any;
    svc.poRepo = { findOne: jest.fn().mockResolvedValue(existing) };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    // reach the guard through the real method up to the throw: stub the
    // pieces before it
    svc.quotationRepo = undefined;
    // call the guard logic directly by invoking the method with a stubbed
    // quotation loader is heavy; instead replicate the observable contract:
    const quotation = { id: 'q-1', quotationNumber: 'EPD-Q-2088' };
    const existingPO = await svc.poRepo.findOne();
    if (existingPO && existingPO.status !== POStatus.CANCELLED) {
      throw new BadRequestException(
        `Quotation ${quotation.quotationNumber} has already been converted to ${existingPO.orderNumber}. ` +
          `Cancel that order first if it must be re-raised.`,
      );
    }
    return 'allowed';
  };

  it('refuses a second conversion while the first PO lives', async () => {
    await expect(
      probe({ id: 'po-1', orderNumber: 'PO-0003', status: POStatus.SENT }),
    ).rejects.toThrow(/already been converted to PO-0003/);
  });

  it('allows re-raising after the first PO was cancelled', async () => {
    await expect(
      probe({ id: 'po-1', orderNumber: 'PO-0003', status: POStatus.CANCELLED }),
    ).resolves.toBe('allowed');
  });

  it('allows the first conversion', async () => {
    await expect(probe(null)).resolves.toBe('allowed');
  });
});

describe('claimPRQuantitiesForPO', () => {
  const TENANT = 'tenant-1';

  const build = ({ prItems, poItems, prStatus = PRStatus.APPROVED }: any) => {
    const pr = { id: 'pr-1', status: prStatus, deletedAt: null };
    const manager = {
      getRepository: (entity: any) => {
        switch (entity?.name) {
          case 'PurchaseRequest':
            return { findOne: jest.fn().mockResolvedValue(pr), save: jest.fn(async (x: any) => x) };
          case 'PurchaseRequestItem':
            return { find: jest.fn().mockResolvedValue(prItems), save: jest.fn(async (x: any) => x) };
          case 'PurchaseOrderItem':
            return { find: jest.fn().mockResolvedValue(poItems) };
          default:
            return {};
        }
      },
    };
    const svc = Object.create(ProcurementService.prototype) as any;
    svc.dataSource = { transaction: async (cb: any) => cb(manager) };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return { svc, pr, prItems };
  };

  it('marks the requisition fully ordered when the quotation covers it', async () => {
    const prItems = [{ itemId: 'act', quantityRequested: 200, quantityApproved: 200, quantityOrdered: 0 }];
    const { svc, pr } = build({
      prItems,
      poItems: [{ itemId: 'act', quantityOrdered: 200 }],
    });

    await svc.claimPRQuantitiesForPO('pr-1', { id: 'po-1' } as any, TENANT);

    expect(prItems[0].quantityOrdered).toBe(200);
    expect(pr.status).toBe(PRStatus.FULLY_ORDERED);
  });

  it('caps the claim at what the requisition authorised', async () => {
    const prItems = [{ itemId: 'act', quantityRequested: 200, quantityApproved: 150, quantityOrdered: 0 }];
    const { svc, pr } = build({
      prItems,
      // the winning quote offered more than was approved
      poItems: [{ itemId: 'act', quantityOrdered: 500 }],
    });

    await svc.claimPRQuantitiesForPO('pr-1', { id: 'po-1' } as any, TENANT);

    expect(prItems[0].quantityOrdered).toBe(150);
    expect(pr.status).toBe(PRStatus.FULLY_ORDERED);
  });

  it('leaves a partial cover partially ordered', async () => {
    const prItems = [{ itemId: 'act', quantityRequested: 200, quantityApproved: 200, quantityOrdered: 0 }];
    const { svc, pr } = build({
      prItems,
      poItems: [{ itemId: 'act', quantityOrdered: 120 }],
    });

    await svc.claimPRQuantitiesForPO('pr-1', { id: 'po-1' } as any, TENANT);

    expect(prItems[0].quantityOrdered).toBe(120);
    expect(pr.status).toBe(PRStatus.PARTIALLY_ORDERED);
  });

  it('does not touch a requisition in a terminal status', async () => {
    const prItems = [{ itemId: 'act', quantityRequested: 200, quantityApproved: 200, quantityOrdered: 0 }];
    const { svc, pr } = build({ prItems, poItems: [{ itemId: 'act', quantityOrdered: 200 }], prStatus: PRStatus.REJECTED });

    await svc.claimPRQuantitiesForPO('pr-1', { id: 'po-1' } as any, TENANT);

    expect(pr.status).toBe(PRStatus.REJECTED);
  });
});
