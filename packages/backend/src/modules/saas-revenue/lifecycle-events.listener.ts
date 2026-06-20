import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadActivity } from '../leads/lead.entity';
import { SaasQuotation } from './quotation.entity';
import { ClientHealthService } from './client-health.service';
import { OnboardingService } from './onboarding.service';

/**
 * Centralized lifecycle event listener that wires the full pipeline:
 * Lead → Quotation → Contract → Subscription → Onboarding → Health
 */
@Injectable()
export class LifecycleEventsListener {
  private readonly logger = new Logger(LifecycleEventsListener.name);

  constructor(
    @InjectRepository(LeadActivity) private readonly leadActivities: Repository<LeadActivity>,
    @InjectRepository(SaasQuotation) private readonly quotations: Repository<SaasQuotation>,
    private readonly onboardingService: OnboardingService,
    private readonly healthService: ClientHealthService,
  ) {}

  // =========================================================================
  // Quotation events → LeadActivity logs
  // =========================================================================

  @OnEvent('quotation.created')
  async onQuotationCreated(payload: { quotationId: string; leadId?: string }) {
    this.logger.log(`Quotation created: ${payload.quotationId}`);
    if (payload.leadId) {
      await this.insertLeadActivity(payload.leadId, 'quotation_created', `Quotation created`, { quotationId: payload.quotationId });
    }
  }

  @OnEvent('quotation.sent')
  async onQuotationSent(payload: { quotationId: string; clientEmail?: string }) {
    this.logger.log(`Quotation sent: ${payload.quotationId}`);
    const q = await this.quotations.findOne({ where: { id: payload.quotationId } });
    if (q?.leadId) {
      await this.insertLeadActivity(q.leadId, 'quotation_sent', `Quotation sent to ${payload.clientEmail || 'client'}`, { quotationId: payload.quotationId });
    }
  }

  @OnEvent('quotation.accepted')
  async onQuotationAccepted(payload: { quotationId: string; subscriptionId?: string }) {
    this.logger.log(`Quotation accepted: ${payload.quotationId}`);
    const q = await this.quotations.findOne({ where: { id: payload.quotationId } });
    if (q?.leadId) {
      await this.insertLeadActivity(q.leadId, 'quotation_accepted', `Quotation accepted — subscription created`, { quotationId: payload.quotationId, subscriptionId: payload.subscriptionId });
    }

    // Auto-create onboarding
    try {
      await this.onboardingService.createFromQuotation(payload.quotationId);
      this.logger.log(`Onboarding created for quotation ${payload.quotationId}`);
    } catch (e: any) {
      this.logger.warn(`Failed to create onboarding: ${e?.message}`);
    }
  }

  @OnEvent('quotation.rejected')
  async onQuotationRejected(payload: { quotationId: string; reason?: string }) {
    this.logger.log(`Quotation rejected: ${payload.quotationId}`);
    const q = await this.quotations.findOne({ where: { id: payload.quotationId } });
    if (q?.leadId) {
      await this.insertLeadActivity(q.leadId, 'quotation_rejected', `Quotation rejected${payload.reason ? ': ' + payload.reason : ''}`, { quotationId: payload.quotationId });
    }
  }

  // =========================================================================
  // Onboarding events
  // =========================================================================

  @OnEvent('onboarding.go_live')
  async onOnboardingGoLive(payload: { onboardingId: string; tenantId?: string }) {
    this.logger.log(`Onboarding go-live: ${payload.onboardingId}`);
    // Initialize client health score
    if (payload.tenantId) {
      try {
        await this.healthService.initializeForTenant(payload.tenantId);
        this.logger.log(`Health score initialized for tenant ${payload.tenantId}`);
      } catch (e: any) {
        this.logger.warn(`Failed to initialize health score: ${e?.message}`);
      }
    }
  }

  // =========================================================================
  // Client Health events
  // =========================================================================

  @OnEvent('client_health.critical')
  async onHealthCritical(payload: { tenantId: string; overallScore: number }) {
    this.logger.warn(`CRITICAL health alert for tenant ${payload.tenantId} — score: ${payload.overallScore}`);
    // TODO: send alert email to account manager
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private async insertLeadActivity(leadId: string, type: string, content: string, metadata?: Record<string, any>) {
    try {
      await this.leadActivities.save(
        this.leadActivities.create({ leadId, type: type as any, content, metadata: metadata ?? null }),
      );
    } catch (e: any) {
      this.logger.warn(`Failed to insert lead activity: ${e?.message}`);
    }
  }
}
