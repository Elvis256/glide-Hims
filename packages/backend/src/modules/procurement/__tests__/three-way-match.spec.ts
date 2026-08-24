import { ProcurementGLIntegrationService } from '../procurement-gl-integration.service';

/**
 * The match used to pair po.items[i] with grn.items[i]. Neither relation is
 * loaded with an ORDER BY, so it compared one item's ordered quantity against
 * another item's received quantity — flagging clean deliveries and passing
 * bad ones whenever the mismatched pairs carried equal numbers.
 */
describe('validateThreeWayMatch', () => {
  const TENANT = 'tenant-1';

  const build = (po: any, grn: any) => {
    const svc = Object.create(ProcurementGLIntegrationService.prototype) as any;
    svc.poRepo = { findOne: jest.fn().mockResolvedValue(po) };
    svc.grnRepo = { findOne: jest.fn().mockResolvedValue(grn) };
    svc.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    return svc;
  };

  const run = (po: any, grn: any) =>
    build(po, grn).validateThreeWayMatch('po-1', 'grn-1', 'inv-1', TENANT);

  it('matches by item even when the GRN rows come back in a different order', async () => {
    const po = {
      items: [
        { itemId: 'gloves', itemName: 'Gloves', quantityOrdered: 100, unitPrice: 10 },
        { itemId: 'para', itemName: 'Paracetamol', quantityOrdered: 50, unitPrice: 20 },
      ],
    };
    // Same delivery, reversed row order — the old positional compare failed this.
    const grn = {
      invoiceAmount: 2000,
      items: [
        { itemId: 'para', itemName: 'Paracetamol', quantityReceived: 50, quantityAccepted: 50, unitCost: 20 },
        { itemId: 'gloves', itemName: 'Gloves', quantityReceived: 100, quantityAccepted: 100, unitCost: 10 },
      ],
    };

    const result = await run(po, grn);

    expect(result.quantitiesMatch).toBe(true);
    expect(result.amountsMatch).toBe(true);
    expect(result.isMatched).toBe(true);
    expect(result.lineDiscrepancies).toEqual([]);
  });

  it('does not pass a genuine mismatch that positionally looked equal', async () => {
    const po = {
      items: [
        { itemId: 'gloves', itemName: 'Gloves', quantityOrdered: 100, unitPrice: 10 },
        { itemId: 'para', itemName: 'Paracetamol', quantityOrdered: 50, unitPrice: 10 },
      ],
    };
    // 50 gloves and 100 paracetamol: positionally 100/50 lines up, by item it does not.
    const grn = {
      invoiceAmount: null,
      items: [
        { itemId: 'para', itemName: 'Paracetamol', quantityReceived: 100, quantityAccepted: 100, unitCost: 10 },
        { itemId: 'gloves', itemName: 'Gloves', quantityReceived: 50, quantityAccepted: 50, unitCost: 10 },
      ],
    };

    const result = await run(po, grn);

    expect(result.quantitiesMatch).toBe(false);
    expect(result.lineDiscrepancies).toHaveLength(2);
  });

  it('reconciles against the accepted quantity, not everything unloaded', async () => {
    const po = {
      items: [{ itemId: 'gloves', itemName: 'Gloves', quantityOrdered: 100, unitPrice: 10 }],
    };
    const grn = {
      invoiceAmount: null,
      items: [
        { itemId: 'gloves', itemName: 'Gloves', quantityReceived: 100, quantityAccepted: 80, unitCost: 10 },
      ],
    };

    const result = await run(po, grn);

    // 20 were rejected, so only 80 are owed for.
    expect(result.grnAmount).toBe(800);
    expect(result.quantitiesMatch).toBe(false);
    expect(result.lineDiscrepancies[0]).toMatchObject({
      itemId: 'gloves',
      quantityOrdered: 100,
      quantityAccepted: 80,
    });
  });

  it('flags goods delivered that were never ordered', async () => {
    const po = {
      items: [{ itemId: 'gloves', itemName: 'Gloves', quantityOrdered: 100, unitPrice: 10 }],
    };
    const grn = {
      invoiceAmount: null,
      items: [
        { itemId: 'gloves', itemName: 'Gloves', quantityReceived: 100, quantityAccepted: 100, unitCost: 10 },
        { itemId: 'syringes', itemName: 'Syringes', quantityReceived: 20, quantityAccepted: 20, unitCost: 5 },
      ],
    };

    const result = await run(po, grn);

    expect(result.quantitiesMatch).toBe(false);
    expect(result.lineDiscrepancies).toContainEqual(
      expect.objectContaining({ itemId: 'syringes', quantityOrdered: 0, quantityAccepted: 20 }),
    );
  });

  it('checks the invoice leg and fails the match when it disagrees', async () => {
    const po = {
      items: [{ itemId: 'gloves', itemName: 'Gloves', quantityOrdered: 100, unitPrice: 10 }],
    };
    const grn = {
      // supplier billed for the full order though everything was accepted at 1000
      invoiceAmount: 1500,
      items: [
        { itemId: 'gloves', itemName: 'Gloves', quantityReceived: 100, quantityAccepted: 100, unitCost: 10 },
      ],
    };

    const result = await run(po, grn);

    expect(result.quantitiesMatch).toBe(true);
    expect(result.amountsMatch).toBe(true);
    expect(result.invoiceMatches).toBe(false);
    expect(result.isMatched).toBe(false);
  });

  it('distinguishes "no invoice recorded" from "invoice disagrees"', async () => {
    const po = {
      items: [{ itemId: 'gloves', itemName: 'Gloves', quantityOrdered: 100, unitPrice: 10 }],
    };
    const grn = {
      invoiceAmount: null,
      items: [
        { itemId: 'gloves', itemName: 'Gloves', quantityReceived: 100, quantityAccepted: 100, unitCost: 10 },
      ],
    };

    const result = await run(po, grn);

    expect(result.invoiceMatches).toBeNull();
    expect(result.isMatched).toBe(true);
  });
});
