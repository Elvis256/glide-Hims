import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PosShift, PosRegister, PosPaymentSplit } from '../../../database/entities/pos.entity';
import { add } from '../../../common/utils/currency';

/**
 * Cross-module helper used by PharmacyService.completeSale to enforce POS
 * shift invariants without taking a hard dependency on PosService internals.
 *
 * Responsibilities:
 *  - Validate that an open, non-Z-finalized shift exists for the (cashier, register).
 *  - Atomically update the shift's cached totals and insert payment_splits in the
 *    same transaction as the sale completion (so X/Z reports are always consistent).
 */
@Injectable()
export class PosShiftGuardService {
  async assertOpenShift(
    manager: EntityManager,
    shiftId: string,
    tenantId: string,
    cashierId: string,
  ): Promise<PosShift> {
    const shift = await manager.findOne(PosShift, {
      where: { id: shiftId, tenantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!shift) {
      throw new NotFoundException(`POS shift ${shiftId} not found`);
    }
    if (shift.status !== 'open') {
      throw new BadRequestException(
        `Cannot ring sale on shift in status "${shift.status}". Open a new shift first.`,
      );
    }
    if (shift.cashierId !== cashierId) {
      throw new BadRequestException(
        `Shift ${shiftId} belongs to a different cashier. Only the shift owner may ring sales.`,
      );
    }
    return shift;
  }

  async assertActiveRegister(
    manager: EntityManager,
    registerId: string,
    tenantId: string,
  ): Promise<PosRegister> {
    const reg = await manager.findOne(PosRegister, {
      where: { id: registerId, tenantId },
    });
    if (!reg) throw new NotFoundException(`POS register ${registerId} not found`);
    if (reg.status !== 'active') {
      throw new BadRequestException(`POS register "${reg.name}" is ${reg.status}`);
    }
    return reg;
  }

  /**
   * Record a completed sale into the shift cache + insert payment splits.
   * Called from PharmacyService.completeSale within the same tx.
   *
   * `splits` may contain multiple rows for split-tender payments; if no
   * splits provided, a single split is inferred from (paymentMethod, amount).
   */
  async recordSale(
    manager: EntityManager,
    args: {
      shift: PosShift;
      saleId: string;
      tenantId: string;
      paymentMethod: string;
      amount: number;
      transactionReference?: string;
      splits?: Array<{
        paymentMethod: string;
        amount: number;
        transactionReference?: string;
      }>;
    },
  ): Promise<void> {
    const { shift, saleId, tenantId, paymentMethod, amount, transactionReference } = args;
    const splits =
      args.splits && args.splits.length > 0
        ? args.splits
        : [{ paymentMethod, amount, transactionReference }];

    const splitRepo = manager.getRepository(PosPaymentSplit);
    for (const s of splits) {
      const row = splitRepo.create({
        saleId,
        shiftId: shift.id,
        paymentMethod: s.paymentMethod,
        amount: s.amount,
        transactionReference: s.transactionReference,
        tenantId,
      });
      await splitRepo.save(row);

      switch (s.paymentMethod) {
        case 'cash':
          shift.cashSales = add(Number(shift.cashSales), Number(s.amount));
          break;
        case 'mobile_money':
          shift.mobileMoneySales = add(Number(shift.mobileMoneySales), Number(s.amount));
          break;
        case 'card':
          shift.cardSales = add(Number(shift.cardSales), Number(s.amount));
          break;
        default:
          // Credit, insurance, etc — no cash drawer impact, but still tracked
          break;
      }
    }
    shift.transactionCount += 1;
    await manager.save(PosShift, shift);
  }
}
