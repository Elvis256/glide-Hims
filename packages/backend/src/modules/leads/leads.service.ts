import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';
import { CreateLeadDto, UpdateLeadStatusDto } from './lead.dto';

@Injectable()
export class LeadsService {
  constructor(@InjectRepository(Lead) private readonly repo: Repository<Lead>) {}

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
    lead.status = dto.status;
    if (dto.internalNotes !== undefined) lead.internalNotes = dto.internalNotes;
    return this.repo.save(lead);
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
}
