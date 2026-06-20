import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { ClientOnboarding, ClientOnboardingItem, OnboardingPhase, OnboardingItemStatus } from './onboarding.entity';
import { SaasQuotation, SaasQuotationRevision } from './quotation.entity';
import { SaasSubscription } from './saas.entity';

// Default onboarding template items grouped by phase
const DEFAULT_TEMPLATE: Array<{ phase: OnboardingPhase; title: string; description: string }> = [
  // Setup
  { phase: 'setup', title: 'Tenant accessible and admin account created', description: 'Verify tenant login works' },
  { phase: 'setup', title: 'License activated', description: 'Ensure subscription license is active with correct modules' },
  { phase: 'setup', title: 'Initial health check passed', description: 'Deployment health check returns OK' },
  // Configuration
  { phase: 'configuration', title: 'Facility details configured', description: 'Organization name, address, logo, contact info' },
  { phase: 'configuration', title: 'User roles and permissions set up', description: 'Admin, clinical, finance roles configured' },
  { phase: 'configuration', title: 'Enabled modules configured', description: 'Activate purchased modules and disable unused ones' },
  { phase: 'configuration', title: 'Billing tariffs configured', description: 'Service prices, insurance schemes, and payment methods' },
  // Data Migration
  { phase: 'data_migration', title: 'Patient data migration', description: 'Import existing patient records (if applicable)' },
  { phase: 'data_migration', title: 'Drug catalog imported', description: 'Import formulary / drug list' },
  { phase: 'data_migration', title: 'Lab catalog imported', description: 'Import lab test catalog and reference ranges' },
  // Training
  { phase: 'training', title: 'Admin training completed', description: 'System administration, user management, settings' },
  { phase: 'training', title: 'Clinical staff training completed', description: 'Patient flow, encounters, lab, pharmacy' },
  { phase: 'training', title: 'Finance staff training completed', description: 'Billing, insurance claims, reporting' },
  // Testing
  { phase: 'testing', title: 'End-to-end workflow validated', description: 'Full patient journey from registration to discharge' },
  { phase: 'testing', title: 'Reporting validation completed', description: 'Key reports generate correctly with test data' },
  // Go-Live
  { phase: 'go_live', title: 'Go-live date confirmed with client', description: 'Final sign-off from client stakeholders' },
  { phase: 'go_live', title: 'Backup schedule configured', description: 'Automated backups running and verified' },
  { phase: 'go_live', title: 'Support handover completed', description: 'Client knows how to reach support, escalation path clear' },
];

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(ClientOnboarding) private readonly onboardings: Repository<ClientOnboarding>,
    @InjectRepository(ClientOnboardingItem) private readonly items: Repository<ClientOnboardingItem>,
    @InjectRepository(SaasQuotation) private readonly quotations: Repository<SaasQuotation>,
    @InjectRepository(SaasQuotationRevision) private readonly revisions: Repository<SaasQuotationRevision>,
    @InjectRepository(SaasSubscription) private readonly subscriptions: Repository<SaasSubscription>,
    private readonly events: EventEmitter2,
  ) {}

  async listOnboardings(filters: { status?: string } = {}) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    const [items, total] = await this.onboardings.findAndCount({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return { items, total };
  }

  async getOnboarding(id: string): Promise<ClientOnboarding> {
    const o = await this.onboardings.findOne({ where: { id }, relations: ['items'] });
    if (!o) throw new NotFoundException('Onboarding not found');
    // Sort items by phase order then sortOrder
    const phaseOrder: Record<string, number> = { setup: 0, configuration: 1, data_migration: 2, training: 3, testing: 4, go_live: 5 };
    o.items?.sort((a, b) => (phaseOrder[a.phase] ?? 99) - (phaseOrder[b.phase] ?? 99) || a.sortOrder - b.sortOrder);
    return o;
  }

  async createOnboarding(dto: Partial<ClientOnboarding>): Promise<ClientOnboarding> {
    const onboarding = this.onboardings.create({
      ...dto,
      status: 'not_started',
      progressPercent: 0,
    });
    const saved = await this.onboardings.save(onboarding);

    // Generate default checklist items
    for (let i = 0; i < DEFAULT_TEMPLATE.length; i++) {
      const t = DEFAULT_TEMPLATE[i];
      const item = this.items.create({
        onboardingId: saved.id,
        phase: t.phase,
        title: t.title,
        description: t.description,
        sortOrder: i + 1,
        status: 'pending',
      });
      await this.items.save(item);
    }

    this.events.emit('onboarding.created', { onboardingId: saved.id });
    return this.getOnboarding(saved.id);
  }

  async createFromQuotation(quotationId: string): Promise<ClientOnboarding> {
    const q = await this.quotations.findOne({ where: { id: quotationId } });
    if (!q) throw new NotFoundException('Quotation not found');

    // Resolve tenantId from the linked subscription
    let tenantId: string | null = null;
    if (q.subscriptionId) {
      const sub = await this.subscriptions.findOne({ where: { id: q.subscriptionId }, select: ['id', 'tenantId'] });
      tenantId = sub?.tenantId ?? null;
    }

    return this.createOnboarding({
      tenantId,
      quotationId: q.id,
      subscriptionId: q.subscriptionId,
      targetGoLiveDate: new Date(Date.now() + 30 * 86400000),
    });
  }

  async updateItem(onboardingId: string, itemId: string, dto: Partial<ClientOnboardingItem>): Promise<ClientOnboardingItem> {
    const item = await this.items.findOne({ where: { id: itemId, onboardingId } });
    if (!item) throw new NotFoundException('Onboarding item not found');

    if (dto.status !== undefined) item.status = dto.status;
    if (dto.notes !== undefined) item.notes = dto.notes;
    if (dto.assignedTo !== undefined) item.assignedTo = dto.assignedTo;
    if (dto.dueDate !== undefined) item.dueDate = dto.dueDate ? new Date(dto.dueDate as any) : null;
    if (dto.status === 'completed') item.completedAt = new Date();

    const saved = await this.items.save(item);
    await this.recalculateProgress(onboardingId);
    return saved;
  }

  async completeItem(onboardingId: string, itemId: string): Promise<ClientOnboardingItem> {
    return this.updateItem(onboardingId, itemId, { status: 'completed' as OnboardingItemStatus });
  }

  async recalculateProgress(onboardingId: string): Promise<void> {
    const allItems = await this.items.find({ where: { onboardingId } });
    const completable = allItems.filter((i) => i.status !== 'skipped');
    const completed = completable.filter((i) => i.status === 'completed');
    const progress = completable.length > 0 ? Math.round((completed.length / completable.length) * 100) : 0;

    const onboarding = await this.onboardings.findOne({ where: { id: onboardingId } });
    if (!onboarding) return;

    onboarding.progressPercent = progress;
    if (progress === 100) {
      onboarding.status = 'completed';
    } else if (progress > 0) {
      onboarding.status = 'in_progress';
    }
    if (allItems.some((i) => i.status === 'blocked')) {
      onboarding.status = 'blocked';
    }
    await this.onboardings.save(onboarding);
  }

  async markGoLive(id: string): Promise<ClientOnboarding> {
    const o = await this.getOnboarding(id);
    o.status = 'completed';
    o.actualGoLiveDate = new Date();
    o.progressPercent = 100;
    await this.onboardings.save(o);

    // Mark all pending go_live items as completed
    const goLiveItems = o.items.filter((i) => i.phase === 'go_live' && i.status !== 'completed');
    for (const item of goLiveItems) {
      item.status = 'completed';
      item.completedAt = new Date();
      await this.items.save(item);
    }

    this.events.emit('onboarding.go_live', { onboardingId: o.id, tenantId: o.tenantId });
    return this.getOnboarding(id);
  }
}
