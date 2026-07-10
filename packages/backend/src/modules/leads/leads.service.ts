import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead, LeadActivity, LeadActivityType } from './lead.entity';
import { CreateLeadDto, UpdateLeadStatusDto } from './lead.dto';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead) private readonly repo: Repository<Lead>,
    @InjectRepository(LeadActivity) private readonly activities: Repository<LeadActivity>,
  ) {}

  async create(dto: CreateLeadDto, ipAddress?: string, userAgent?: string): Promise<Lead> {
    const lead = this.repo.create({
      ...dto,
      ipAddress: ipAddress || null,
      userAgent: userAgent ? userAgent.substring(0, 500) : null,
      status: 'new',
    });
    return this.repo.save(lead);
  }

  async findAll(status?: string) {
    const where = status ? { status: status as any } : {};
    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return { items, total };
  }

  async findOne(id: string): Promise<Lead> {
    const lead = await this.repo.findOne({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async updateStatus(id: string, dto: UpdateLeadStatusDto): Promise<Lead> {
    const lead = await this.findOne(id);
    const oldStatus = lead.status;
    lead.status = dto.status;
    if (dto.internalNotes !== undefined) lead.internalNotes = dto.internalNotes;
    const saved = await this.repo.save(lead);

    // Auto-log status change
    if (oldStatus !== dto.status) {
      await this.addActivity(id, {
        type: 'status_change',
        content: `Status changed from ${oldStatus} to ${dto.status}`,
      });
    }
    return saved;
  }

  async stats() {
    const all = await this.repo.find({ select: ['status', 'createdAt'] });
    const byStatus: Record<string, number> = {};
    for (const l of all) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    const since30d = new Date(Date.now() - 30 * 86400 * 1000);
    return {
      total: all.length,
      last30d: all.filter((l) => l.createdAt >= since30d).length,
      byStatus,
    };
  }

  // ==========================================================================
  // Phase 2: Activity, Assign, Follow-up, Pipeline
  // ==========================================================================

  async addActivity(
    leadId: string,
    data: {
      type: LeadActivityType;
      content?: string;
      metadata?: Record<string, any>;
      actorId?: string;
    },
  ): Promise<LeadActivity> {
    const activity = this.activities.create({
      leadId,
      type: data.type,
      content: data.content ?? null,
      metadata: data.metadata ?? null,
      actorId: data.actorId ?? null,
    });
    return this.activities.save(activity);
  }

  async listActivities(leadId: string) {
    return this.activities.find({
      where: { leadId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async assignLead(id: string, assignedTo: string | null): Promise<Lead> {
    const lead = await this.findOne(id);
    lead.assignedTo = assignedTo;
    return this.repo.save(lead);
  }

  async setFollowUp(id: string, nextFollowUpAt: string | null): Promise<Lead> {
    const lead = await this.findOne(id);
    lead.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    return this.repo.save(lead);
  }

  async getLeadPipeline() {
    const all = await this.repo.find({
      select: [
        'id',
        'status',
        'priority',
        'estimatedArrMinor',
        'estimatedArrCurrency',
        'createdAt',
      ],
    });
    const byStatus: Record<string, { count: number; totalArr: number }> = {};
    for (const l of all) {
      if (!byStatus[l.status]) byStatus[l.status] = { count: 0, totalArr: 0 };
      byStatus[l.status].count++;
      byStatus[l.status].totalArr += l.estimatedArrMinor || 0;
    }
    return { total: all.length, byStatus };
  }
}
