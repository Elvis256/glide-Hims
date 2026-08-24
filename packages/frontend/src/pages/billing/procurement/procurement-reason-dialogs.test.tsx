/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RejectRequisitionModal } from './RequisitionsPage';
import { CancelPOModal } from './PurchaseOrdersPage';

afterEach(cleanup);

/**
 * Both endpoints require a reason and both screens used to send none —
 * rejection came back 400 every time and cancellation was recorded as
 * unexplained. These pin the reason to the request.
 */
describe('RejectRequisitionModal', () => {
  // Shaped like the API actually sends them — department and requestedBy are
  // joined relations, not strings. The original fixture used strings, which
  // let a render of the raw objects ("Objects are not valid as a React
  // child") pass the tests while crashing in the browser.
  const requisition: any = {
    id: 'pr-1',
    requestNumber: 'PR-0007',
    department: { id: 'd1', name: 'Maternity' },
    requestedBy: { id: 'u1', fullName: 'A. Nakato' },
  };

  const setup = () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <RejectRequisitionModal
        requisition={requisition}
        isSubmitting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    return { onConfirm, onClose };
  };

  it('will not submit without a reason', async () => {
    const { onConfirm } = setup();
    const submit = screen.getByRole('button', { name: /reject requisition/i });

    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(submit);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('passes the trimmed reason through', async () => {
    const { onConfirm } = setup();

    await userEvent.type(screen.getByLabelText(/reason for rejection/i), '  not budgeted  ');
    await userEvent.click(screen.getByRole('button', { name: /reject requisition/i }));

    expect(onConfirm).toHaveBeenCalledWith('not budgeted');
  });

  it('closes on Escape without rejecting', async () => {
    const { onClose, onConfirm } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('CancelPOModal', () => {
  const po: any = {
    id: 'po-1',
    poNumber: 'PO-0012',
    supplier: 'Kampala Medical Supplies',
    items: [{ id: 'i1' }, { id: 'i2' }],
  };

  const setup = () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <CancelPOModal po={po} isSubmitting={false} onClose={onClose} onConfirm={onConfirm} />,
    );
    return { onConfirm, onClose };
  };

  it('spells out what cancelling does before asking for confirmation', () => {
    setup();
    expect(screen.getByText(/goes back to the requisition/i)).toBeTruthy();
    expect(screen.getByText(/budget held for this order is released/i)).toBeTruthy();
  });

  it('requires a reason', async () => {
    const { onConfirm } = setup();
    const submit = screen.getByRole('button', { name: /cancel order/i });

    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(screen.getByLabelText(/reason for cancelling/i), 'supplier out of stock');
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledWith('supplier out of stock');
  });

  it('"Keep order" closes without cancelling', async () => {
    const { onClose, onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: /keep order/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
