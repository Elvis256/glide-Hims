import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PosMobileMoneyTransaction,
  MomoTransactionStatus,
} from '../../database/entities/pos-resilience.entity';
import { PharmacySale, SaleStatus } from '../../database/entities/pharmacy-sale.entity';
import { PaymentGatewayService } from '../payment-gateway/payment-gateway.service';
import { PharmacyService } from '../pharmacy/pharmacy.service';
import { PosShiftGuardService } from './services/pos-shift-guard.service';
import { InitiateMomoPaymentDto } from './pos-momo.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

const MOMO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MOMO_MIN_POLL_AGE_MS = 30 * 1000; // 30s before first poll
const MTN_PROVIDER_KEY = 'mtn-momo';
const AIRTEL_PROVIDER_KEY = 'airtel-money';

@Injectable()
export class PosMomoService {
  private readonly logger = new Logger(PosMomoService.name);

  constructor(
    @InjectRepository(PosMobileMoneyTransaction)
    private readonly momoRepo: Repository<PosMobileMoneyTransaction>,
    @InjectRepository(PharmacySale)
    private readonly saleRepo: Repository<PharmacySale>,
    private readonly gatewayService: PaymentGatewayService,
    @Inject(forwardRef(() => PharmacyService))
    private readonly pharmacyService: PharmacyService,
    private readonly posShiftGuard: PosShiftGuardService,
    private readonly dataSource: DataSource,
  ) {}

  private resolveProviderKey(provider: 'mtn' | 'airtel'): string {
    return provider === 'mtn' ? MTN_PROVIDER_KEY : AIRTEL_PROVIDER_KEY;
  }

  /** Normalise UG MSISDN to international format without + */
  private normaliseMsisdn(phone: string): string {
    const cleaned = phone.replace(/\s+/g, '').replace(/^\+/, '');
    if (cleaned.startsWith('256') && cleaned.length === 12) return cleaned;
    if (cleaned.startsWith('0') && cleaned.length === 10) return `256${cleaned.slice(1)}`;
    throw new BadRequestException(`Invalid UG MSISDN: ${phone}`);
  }

  async initiate(saleId: string, dto: InitiateMomoPaymentDto, userId: string, tenantId: string) {
    const tid = requireTenantId(tenantId);
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, tenantId: tid },
    });
    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
    if (sale.status !== SaleStatus.PENDING) {
      throw new BadRequestException('Sale is not in PENDING status');
    }
    if (Math.abs(Number(sale.totalAmount) - dto.amount) > 0.01) {
      throw new BadRequestException(
        `Amount ${dto.amount} does not match sale total ${sale.totalAmount}`,
      );
    }

    if (sale.posShiftId) {
      await this.posShiftGuard.assertOpenShift(
        this.dataSource.createEntityManager(),
        sale.posShiftId,
        tenantId,
        userId,
      );
    }

    const msisdn = this.normaliseMsisdn(dto.phone);
    const providerKey = this.resolveProviderKey(dto.provider);

    let externalReference: string | undefined;
    try {
      const result = await this.gatewayService.initiate(providerKey, {
        channel: 'mobile_money',
        amount: dto.amount,
        currency: 'UGX',
        invoiceId: sale.id,
        invoiceNumber: sale.saleNumber,
        description: `POS sale ${sale.saleNumber}`,
        customer: { phone: msisdn },
        msisdn,
        mobileProvider: dto.provider === 'mtn' ? 'mtn' : 'airtel',
        tenantId,
        idempotencyKey: `pos-sale:${sale.id}`,
      });
      externalReference = result.providerTransactionId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gateway initiate failed for sale ${saleId}: ${msg}`);
      externalReference = undefined;
    }

    const tx = this.momoRepo.create({
      saleId: sale.id,
      posShiftId: sale.posShiftId ?? undefined,
      posRegisterId: sale.posRegisterId ?? undefined,
      provider: dto.provider,
      phone: msisdn,
      amount: dto.amount,
      externalReference,
      status: MomoTransactionStatus.PENDING,
      requestedById: userId,
      requestedAt: new Date(),
      tenantId,
    });
    const saved = await this.momoRepo.save(tx);

    return { transactionId: saved.id, externalReference: saved.externalReference };
  }

  async getStatus(transactionId: string, userId: string, tenantId: string) {
    const tid = requireTenantId(tenantId);
    const tx = await this.momoRepo.findOne({
      where: { id: transactionId, tenantId: tid },
    });
    if (!tx) throw new NotFoundException(`Transaction ${transactionId} not found`);

    if (tx.status !== MomoTransactionStatus.PENDING) {
      return this.buildStatusResponse(tx);
    }

    const ageMs = Date.now() - new Date(tx.requestedAt).getTime();
    if (ageMs > MOMO_TIMEOUT_MS) {
      tx.status = MomoTransactionStatus.TIMEOUT;
      tx.failureReason = 'Payment timed out after 5 minutes';
      tx.completedAt = new Date();
      await this.momoRepo.save(tx);
      return this.buildStatusResponse(tx);
    }

    if (tx.externalReference) {
      try {
        const providerKey = this.resolveProviderKey(tx.provider as 'mtn' | 'airtel');
        const { status: gwStatus } = await this.gatewayService.getStatus(
          providerKey,
          tx.externalReference,
        );
        tx.lastPolledAt = new Date();
        tx.retryCount = (tx.retryCount || 0) + 1;

        if (gwStatus === 'success') {
          await this.handleSuccess(tx, userId, tenantId);
        } else if (gwStatus === 'failed' || gwStatus === 'cancelled') {
          tx.status =
            gwStatus === 'cancelled'
              ? MomoTransactionStatus.CANCELLED
              : MomoTransactionStatus.FAILED;
          tx.failureReason = 'Payment declined by provider';
          tx.completedAt = new Date();
          await this.momoRepo.save(tx);
        } else {
          await this.momoRepo.save(tx);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Poll failed for tx ${transactionId}: ${msg}`);
        tx.lastPolledAt = new Date();
        await this.momoRepo.save(tx);
      }
    }

    return this.buildStatusResponse(tx);
  }

  async cancel(transactionId: string, userId: string, tenantId: string) {
    const tid = requireTenantId(tenantId);
    // Row lock so cancel serializes with a concurrent success flip
    const tx = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(PosMobileMoneyTransaction, {
        where: { id: transactionId, tenantId: tid },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException(`Transaction ${transactionId} not found`);
      if (locked.status !== MomoTransactionStatus.PENDING) {
        return locked;
      }
      locked.status = MomoTransactionStatus.CANCELLED;
      locked.failureReason = `Cancelled by user ${userId}`;
      locked.completedAt = new Date();
      return manager.save(PosMobileMoneyTransaction, locked);
    });
    return this.buildStatusResponse(tx);
  }

  private async handleSuccess(tx: PosMobileMoneyTransaction, userId: string, tenantId: string) {
    // Claim the transaction under a row lock: the user-polling path and the
    // reconciliation cron can both observe PENDING and would otherwise both
    // flip it and complete the sale twice. (The previous "transaction" never
    // used its manager, so it provided no atomicity at all.)
    const claimed = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(PosMobileMoneyTransaction, {
        where: { id: tx.id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== MomoTransactionStatus.PENDING) return false;

      locked.status = MomoTransactionStatus.SUCCESS;
      locked.completedAt = new Date();
      locked.lastPolledAt = tx.lastPolledAt;
      locked.retryCount = tx.retryCount;
      await manager.save(PosMobileMoneyTransaction, locked);
      tx.status = locked.status;
      tx.completedAt = locked.completedAt;
      return true;
    });
    if (!claimed) return;

    // completeSale runs its own transaction; if it fails after the money was
    // taken, flag the tx so reconciliation staff can finish the sale manually
    try {
      await this.pharmacyService.completeSale(
        tx.saleId,
        {
          amountPaid: Number(tx.amount),
          paymentMethod: 'mobile_money',
          transactionReference: tx.externalReference || tx.id,
        },
        userId,
        tenantId,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `MoMo tx ${tx.id} succeeded but completeSale failed — sale ${tx.saleId} needs manual completion: ${msg}`,
      );
      await this.momoRepo.update(
        { id: tx.id },
        { failureReason: `PAID but sale completion failed: ${msg}`.slice(0, 500) },
      );
    }
  }

  private buildStatusResponse(tx: PosMobileMoneyTransaction) {
    return {
      transactionId: tx.id,
      saleId: tx.saleId,
      status: tx.status,
      provider: tx.provider,
      phone: tx.phone,
      amount: tx.amount,
      externalReference: tx.externalReference,
      failureReason: tx.failureReason,
      requestedAt: tx.requestedAt,
      completedAt: tx.completedAt,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'pos-momo-reconcile-pending' })
  async reconcilePending() {
    const cutoff = new Date(Date.now() - MOMO_MIN_POLL_AGE_MS);
    const timeoutCutoff = new Date(Date.now() - MOMO_TIMEOUT_MS);

    const pending = await this.momoRepo.find({
      where: { status: MomoTransactionStatus.PENDING },
    });

    for (const tx of pending) {
      const requestedAt = new Date(tx.requestedAt);
      if (requestedAt <= timeoutCutoff) {
        tx.status = MomoTransactionStatus.TIMEOUT;
        tx.failureReason = 'Timed out during reconciliation (max 5 minutes exceeded)';
        tx.completedAt = new Date();
        await this.momoRepo.save(tx);
        continue;
      }
      if (requestedAt > cutoff) continue;
      if (!tx.externalReference) continue;

      try {
        const providerKey = this.resolveProviderKey(tx.provider as 'mtn' | 'airtel');
        const { status: gwStatus } = await this.gatewayService.getStatus(
          providerKey,
          tx.externalReference,
        );
        tx.lastPolledAt = new Date();
        tx.retryCount = (tx.retryCount || 0) + 1;

        if (gwStatus === 'success') {
          await this.handleSuccess(tx, tx.requestedById, tx.tenantId!);
        } else if (gwStatus === 'failed' || gwStatus === 'cancelled') {
          tx.status = MomoTransactionStatus.FAILED;
          tx.failureReason = 'Declined by provider during reconciliation';
          tx.completedAt = new Date();
          await this.momoRepo.save(tx);
        } else {
          await this.momoRepo.save(tx);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Reconciler poll failed for ${tx.id}: ${msg}`);
      }
    }
  }
}
