import { ProcurementService } from '../procurement.service';
import { PRStatus } from '../../../database/entities/purchase-request.entity';

/**
 * Cancelling a PO used to change nothing but the PO's own status. The PR it
 * came from kept counting the cancelled units as ordered and stayed
 * FULLY_ORDERED, and createPOFromPR only accepted an APPROVED PR — so a
 * supplier who could not deliver cost the department its whole requisition.
 */
describe('cancelPurchaseOrder — returns quantities to the requisition', () => {
  const TENANT = 'tenant-1';

  const build = ({ poItems, prItems, prStatus = PRStatus.FULLY_ORDERED, purchaseRequestId = 'pr-1' }: any) => {
    const pr = { id: 'pr-1', status: prStatus, deletedAt: null };
    const po = {
      id: 'po-1',
      orderNumber: 'PO-001',
      status: 'sent',
      purchaseRequestId,
      deletedAt: null,
    };

    const manager = {
      getRepository: (entity: any) => {
        switch (entity?.name) {
          case 'PurchaseOrder':
            return { findOne: jest.fn().mockResolvedValue(po), save: jest.fn(async (x: any) => x) };
          case 'PurchaseRequest':
            return { findOne: jest.fn().mockResolvedValue(pr), save: jest.fn(async (x: any) => x) };
          case 'PurchaseOrderItem':
            return { find: jest.fn().mockResolvedValue(poItems) };
          case 'PurchaseRequestItem':
            return { find: jest.fn().mockResolvedValue(prItems), save: jest.fn(async (x: any) => x) };
          default:
            return { create: jest.fn((x: any) => x), save: jest.fn(async (x: any) => x) };
        }
      },
    };

    const releaseReservationsForDocument = jest.fn().mockResolvedValue(0);
    const svc = Object.create(ProcurementService.prototype) as any;
    svc.dataSource = { transaction: async (cb: any) => cb(manager) };
    svc.budgetService = { releaseReservationsForDocument };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    return { svc, pr, prItems, releaseReservationsForDocument };
  };

  it('gives back the un-received quantity and reopens the PR for ordering', async () => {
    const prItems = [
      { itemId: 'item-1', quantityRequested: 100, quantityApproved: 100, quantityOrdered: 100 },
    ];
    const { svc, pr } = build({
      poItems: [{ itemId: 'item-1', itemName: 'Gloves', quantityOrdered: 100, quantityReceived: 0 }],
      prItems,
    });

    await svc.cancelPurchaseOrder('po-1', 'user-1', TENANT, 'supplier could not deliver');

    expect(prItems[0].quantityOrdered).toBe(0);
    expect(pr.status).toBe(PRStatus.APPROVED);
  });

  it('keeps what was already received on order and leaves the PR partially ordered', async () => {
    const prItems = [
      { itemId: 'item-1', quantityRequested: 100, quantityApproved: 100, quantityOrdered: 100 },
    ];
    const { svc, pr } = build({
      poItems: [{ itemId: 'item-1', itemName: 'Gloves', quantityOrdered: 100, quantityReceived: 40 }],
      prItems,
    });

    await svc.cancelPurchaseOrder('po-1', 'user-1', TENANT);

    // 60 outstanding come back; the 40 that actually arrived stay ordered.
    expect(prItems[0].quantityOrdered).toBe(40);
    expect(pr.status).toBe(PRStatus.PARTIALLY_ORDERED);
  });

  it('never drives quantityOrdered below zero', async () => {
    const prItems = [
      { itemId: 'item-1', quantityRequested: 100, quantityApproved: 100, quantityOrdered: 30 },
    ];
    const { svc } = build({
      // a direct PO line larger than the PR ever asked for
      poItems: [{ itemId: 'item-1', itemName: 'Gloves', quantityOrdered: 500, quantityReceived: 0 }],
      prItems,
    });

    await svc.cancelPurchaseOrder('po-1', 'user-1', TENANT);

    expect(prItems[0].quantityOrdered).toBe(0);
  });

  it('releases the budget reservation the PO was holding', async () => {
    const { svc, releaseReservationsForDocument } = build({
      poItems: [{ itemId: 'item-1', itemName: 'Gloves', quantityOrdered: 100, quantityReceived: 0 }],
      prItems: [{ itemId: 'item-1', quantityRequested: 100, quantityApproved: 100, quantityOrdered: 100 }],
    });

    await svc.cancelPurchaseOrder('po-1', 'user-1', TENANT);

    expect(releaseReservationsForDocument).toHaveBeenCalledWith('po-1', TENANT);
  });

  it('is a no-op on the PR side for a direct PO with no requisition', async () => {
    const prItems = [
      { itemId: 'item-1', quantityRequested: 100, quantityApproved: 100, quantityOrdered: 100 },
    ];
    const { svc } = build({
      poItems: [{ itemId: 'item-1', itemName: 'Gloves', quantityOrdered: 100, quantityReceived: 0 }],
      prItems,
      purchaseRequestId: null,
    });

    await svc.cancelPurchaseOrder('po-1', 'user-1', TENANT);

    expect(prItems[0].quantityOrdered).toBe(100);
  });
});
