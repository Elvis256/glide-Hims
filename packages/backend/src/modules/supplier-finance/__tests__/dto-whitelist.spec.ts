import { ValidationPipe } from '@nestjs/common';
import { CreatePaymentVoucherDto, CreateSupplierCreditNoteDto } from '../dto/supplier-finance.dto';

/**
 * The app's global ValidationPipe runs whitelist + forbidNonWhitelisted. A
 * property that carries only class-transformer decorators (@Type) and no
 * class-validator one is invisible to the whitelist and therefore REJECTED —
 * paymentDate and noteDate were exactly that, so creating a payment voucher
 * or a manual credit note failed validation on every request that included
 * the required field, and hit the NOT NULL column with a 500 on every request
 * that omitted it. Creation had never worked through any path.
 *
 * These run the real pipe against the real DTOs, so the trap cannot return
 * silently.
 */
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

describe('supplier-finance DTOs under the global validation pipe', () => {
  it('accepts a payment voucher with its own required paymentDate', async () => {
    const out = await pipe.transform(
      {
        facilityId: 'cebffc62-8517-4a89-b268-d46d11198950',
        supplierId: '90441689-1d6d-4945-b89a-addab17f80d0',
        paymentDate: '2026-08-19',
        grossAmount: 1000,
        paymentMethod: 'bank_transfer',
        items: [{ description: 'line', amount: 1000 }],
      },
      { type: 'body', metatype: CreatePaymentVoucherDto },
    );
    expect(out.paymentDate).toBeInstanceOf(Date);
  });

  it('accepts a credit note with its own required noteDate', async () => {
    const out = await pipe.transform(
      {
        facilityId: 'cebffc62-8517-4a89-b268-d46d11198950',
        supplierId: '90441689-1d6d-4945-b89a-addab17f80d0',
        noteType: 'credit_note',
        noteDate: '2026-08-19',
        reason: 'goods_returned',
        items: [{ description: 'line', quantity: 1, unitPrice: 1000 }],
      },
      { type: 'body', metatype: CreateSupplierCreditNoteDto },
    );
    expect(out.noteDate).toBeInstanceOf(Date);
  });

  it('still rejects a genuinely unknown property', async () => {
    await expect(
      pipe.transform(
        {
          facilityId: 'cebffc62-8517-4a89-b268-d46d11198950',
          supplierId: '90441689-1d6d-4945-b89a-addab17f80d0',
          paymentDate: '2026-08-19',
          grossAmount: 1000,
          paymentMethod: 'bank_transfer',
          items: [{ description: 'line', amount: 1000 }],
          smuggled: 'nope',
        },
        { type: 'body', metatype: CreatePaymentVoucherDto },
      ),
    ).rejects.toThrow();
  });
});
