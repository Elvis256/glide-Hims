/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InspectGRNModal } from './GoodsReceivedPage';

afterEach(cleanup);

/**
 * Inspection is the last point at which a short or damaged delivery can be
 * caught before the accepted quantity posts to stock and the supplier is
 * treated as having delivered in full.
 */
describe('InspectGRNModal', () => {
  const grn: any = {
    id: 'grn-1',
    grnNumber: 'GRN-0001',
    supplier: { id: 's1', name: 'Kampala Medical Supplies' },
    items: [
      {
        itemId: 'item-1',
        itemName: 'Examination Gloves (Medium)',
        itemUnit: 'box',
        quantityReceived: 100,
        batchNumber: 'B-77',
      },
      {
        itemId: 'item-2',
        itemName: 'Paracetamol 500mg',
        itemUnit: 'tin',
        quantityReceived: 50,
      },
    ],
  };

  const setup = (over: Partial<any> = {}) => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(
      <InspectGRNModal
        grn={grn}
        isSubmitting={false}
        onClose={onClose}
        onSubmit={onSubmit}
        {...over}
      />,
    );
    return { onSubmit, onClose };
  };

  const acceptedBoxes = () => screen.getAllByRole('spinbutton').filter((_, i) => i % 2 === 0);
  const rejectedBoxes = () => screen.getAllByRole('spinbutton').filter((_, i) => i % 2 === 1);

  it('defaults to accepting everything that arrived', async () => {
    const { onSubmit } = setup();

    await userEvent.click(screen.getByRole('button', { name: /record inspection/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      inspectedItems: [
        { itemId: 'item-1', quantityAccepted: 100, quantityRejected: 0, rejectionReason: undefined },
        { itemId: 'item-2', quantityAccepted: 50, quantityRejected: 0, rejectionReason: undefined },
      ],
      inspectionNotes: undefined,
    });
  });

  it('couples the two boxes so a line always accounts for what was received', async () => {
    setup();

    await userEvent.clear(rejectedBoxes()[0]);
    await userEvent.type(rejectedBoxes()[0], '30');

    expect((acceptedBoxes()[0] as HTMLInputElement).value).toBe('70');
  });

  it('will not accept more than was received', async () => {
    setup();

    await userEvent.clear(acceptedBoxes()[0]);
    await userEvent.type(acceptedBoxes()[0], '500');

    expect((acceptedBoxes()[0] as HTMLInputElement).value).toBe('100');
  });

  it('blocks submission until every rejected line has a reason', async () => {
    const { onSubmit } = setup();

    await userEvent.clear(rejectedBoxes()[0]);
    await userEvent.type(rejectedBoxes()[0], '10');

    const submit = screen.getByRole('button', { name: /record inspection/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/give a reason for every rejected line/i)).toBeTruthy();

    await userEvent.type(screen.getByPlaceholderText(/damaged in transit/i), 'torn packaging');
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        inspectedItems: expect.arrayContaining([
          {
            itemId: 'item-1',
            quantityAccepted: 90,
            quantityRejected: 10,
            rejectionReason: 'torn packaging',
          },
        ]),
      }),
    );
  });

  it('warns that rejected units will not enter stock', async () => {
    setup();

    await userEvent.clear(rejectedBoxes()[1]);
    await userEvent.type(rejectedBoxes()[1], '5');

    expect(screen.getByText(/5 units will be rejected/i)).toBeTruthy();
  });

  it('"Accept all in full" clears a rejection and its reason', async () => {
    setup();

    await userEvent.clear(rejectedBoxes()[0]);
    await userEvent.type(rejectedBoxes()[0], '40');
    await userEvent.type(screen.getByPlaceholderText(/damaged in transit/i), 'expired');

    await userEvent.click(screen.getByRole('button', { name: /accept all in full/i }));

    expect((acceptedBoxes()[0] as HTMLInputElement).value).toBe('100');
    expect(screen.queryByPlaceholderText(/damaged in transit/i)).toBeNull();
  });

  it('closes on Escape', async () => {
    const { onClose } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
