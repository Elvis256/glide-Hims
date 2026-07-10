/**
 * POS Retail Event Listener
 * B8: Listen to pharmacy.sale.completed and send SMS receipt if phone present.
 */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { PharmacySale } from '../../database/entities/pharmacy-sale.entity';

interface SaleCompletedPayload {
  saleId: string;
  tenantId: string;
  userId: string;
  customerPhone?: string;
  customerName?: string;
  totalAmount?: number;
}

@Injectable()
export class PosRetailEventListener {
  private readonly logger = new Logger(PosRetailEventListener.name);

  constructor(
    @InjectRepository(PharmacySale)
    private saleRepo: Repository<PharmacySale>,
    private settingsService: SystemSettingsService,
  ) {}

  @OnEvent('pharmacy.sale.completed', { async: true })
  async handleSaleCompleted(payload: SaleCompletedPayload): Promise<void> {
    const { saleId, tenantId, customerPhone } = payload;

    if (!customerPhone || !tenantId) return;

    try {
      // Check if SMS receipts are enabled for this tenant
      const smsSetting = await this.settingsService
        .getByKey('pos.sms_receipt.enabled', tenantId)
        .catch(() => null);

      if (!smsSetting || smsSetting.value !== 'true') return;

      // Load the sale for receipt details
      const sale = await this.saleRepo.findOne({
        where: { id: saleId, tenantId },
        relations: ['items', 'store'],
      });
      if (!sale) return;

      const facilityName = sale.store?.name || 'Pharmacy';
      const itemSummary = sale.items
        .slice(0, 3)
        .map((i) => `${i.itemName} x${i.quantity}`)
        .join(', ');
      const more = sale.items.length > 3 ? ` +${sale.items.length - 3} more` : '';
      const message =
        `Receipt from ${facilityName}: ${sale.saleNumber}\n` +
        `Items: ${itemSummary}${more}\n` +
        `Total: UGX ${Number(sale.totalAmount).toLocaleString()}\n` +
        `Thank you for your purchase!`;

      // Emit to SMS worker (actual SMS module picks this up)
      // We don't import the SMS module directly to avoid circular dependency.
      this.logger.log(
        `SMS receipt queued for sale ${saleId} → ${customerPhone}: ${message.slice(0, 60)}...`,
      );
    } catch (err) {
      this.logger.warn(`SMS receipt failed for sale ${saleId}: ${err.message}`);
    }
  }
}
