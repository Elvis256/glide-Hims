/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcessPaymentModal } from './SupplierPaymentVouchersPage';

afterEach(cleanup);

/**
 * Process used to fire straight off the row button with no body, so the
 * cheque number and bank reference the endpoint accepts were never captured
 * and a cheque payment could not be matched to a bank statement later.
 */
describe('ProcessPaymentModal', () => {
  const voucher = (method: string): any => ({
    id: 'pv-1',
    voucherNumber: 'PV-0001',
    supplier: { name: 'Kampala Medical Supplies' },
    grossAmount: 1000,
    netAmount: 940,
    paymentMethod: method,
  });

  const setup = (method: string) => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ProcessPaymentModal
        voucher={voucher(method)}
        isSubmitting={false}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    return { onConfirm, onClose };
  };

  const submitBtn = () => screen.getByRole('button', { name: /record payment/i }) as HTMLButtonElement;

  it('requires a cheque number for a cheque payment', async () => {
    const { onConfirm } = setup('cheque');

    expect(submitBtn().disabled).toBe(true);

    await userEvent.type(screen.getByLabelText(/cheque number/i), '004512');
    expect(submitBtn().disabled).toBe(false);

    await userEvent.click(submitBtn());
    expect(onConfirm).toHaveBeenCalledWith({
      chequeNumber: '004512',
      bankReference: undefined,
    });
  });

  it('requires a transaction reference for a bank transfer', async () => {
    const { onConfirm } = setup('bank_transfer');

    expect(submitBtn().disabled).toBe(true);
    expect(screen.queryByLabelText(/cheque number/i)).toBeNull();

    await userEvent.type(screen.getByLabelText(/transaction reference/i), 'FT2408190042');
    await userEvent.click(submitBtn());

    expect(onConfirm).toHaveBeenCalledWith({
      chequeNumber: undefined,
      bankReference: 'FT2408190042',
    });
  });

  it('requires a reference for mobile money too', () => {
    setup('mobile_money');
    expect(screen.getByLabelText(/transaction reference/i)).toBeTruthy();
    expect(submitBtn().disabled).toBe(true);
  });

  it('lets a cash payment through with no reference', async () => {
    const { onConfirm } = setup('cash');

    expect(submitBtn().disabled).toBe(false);
    await userEvent.click(submitBtn());

    expect(onConfirm).toHaveBeenCalledWith({
      chequeNumber: undefined,
      bankReference: undefined,
    });
  });

  it('states the segregation-of-duties rule before the money moves', () => {
    setup('cash');
    expect(screen.getByText(/neither the person who prepared/i)).toBeTruthy();
  });

  it('closes on Escape without paying', async () => {
    const { onClose, onConfirm } = setup('cash');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
