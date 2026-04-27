import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Installer } from './installer.entity';
import { InstallerDownload } from './installer-download.entity';
import { CreateInstallerDto, UpdateInstallerDto } from './installer.dto';
import { License } from '../../database/entities/license.entity';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = process.env.INSTALLERS_DIR || '/var/lib/glide-hims/installers';

const TIER_RANK: Record<string, number> = {
  trial: 0,
  free: 0,
  standard: 1,
  basic: 1,
  professional: 2,
  pro: 2,
  enterprise: 3,
};

function rank(t?: string | null) {
  if (!t) return 0;
  return TIER_RANK[t.toLowerCase()] ?? 0;
}

@Injectable()
export class DownloadsService {
  constructor(
    @InjectRepository(Installer) private readonly repo: Repository<Installer>,
    @InjectRepository(InstallerDownload) private readonly logs: Repository<InstallerDownload>,
    @InjectRepository(License) private readonly licenses: Repository<License>,
  ) {}

  storageDir() { return STORAGE_DIR; }

  async listPublished(channel?: string) {
    const where: any = { isPublished: true };
    if (channel) where.channel = channel;
    return this.repo.find({ where, order: { releasedAt: 'DESC' }, take: 100 });
  }

  async listAll() {
    return this.repo.find({ order: { releasedAt: 'DESC' }, take: 200 });
  }

  async findOne(id: string) {
    const x = await this.repo.findOne({ where: { id } });
    if (!x) throw new NotFoundException('Installer not found');
    return x;
  }

  async create(dto: CreateInstallerDto) {
    const e = this.repo.create({
      ...dto,
      channel: dto.channel || 'stable',
      kind: dto.kind || 'tarball',
      platform: dto.platform || 'linux-amd64',
      isPublished: dto.isPublished ?? true,
      releaseNotes: dto.releaseNotes ?? null,
      minLicenseTier: dto.minLicenseTier ?? null,
    });
    return this.repo.save(e);
  }

  async update(id: string, dto: UpdateInstallerDto) {
    const e = await this.findOne(id);
    if (dto.isPublished !== undefined) e.isPublished = dto.isPublished;
    if (dto.releaseNotes !== undefined) e.releaseNotes = dto.releaseNotes;
    if (dto.channel !== undefined) e.channel = dto.channel;
    return this.repo.save(e);
  }

  async remove(id: string) {
    const e = await this.findOne(id);
    await this.repo.remove(e);
    return { deleted: true };
  }

  resolveFilePath(installer: Installer): string | null {
    if (!fs.existsSync(STORAGE_DIR)) return null;
    const safe = path.basename(installer.filename);
    const full = path.join(STORAGE_DIR, safe);
    if (!full.startsWith(STORAGE_DIR)) return null;
    return fs.existsSync(full) ? full : null;
  }

  async tierForTenant(tenantId?: string | null): Promise<string> {
    if (!tenantId) return 'trial';
    const lic = await this.licenses.findOne({
      where: { tenantId, status: 'active' as any },
      order: { expiresAt: 'DESC' as any },
    });
    return lic?.licenseType || 'trial';
  }

  async assertTierAllowed(installer: Installer, tenantTier: string) {
    if (!installer.minLicenseTier) return;
    if (rank(tenantTier) < rank(installer.minLicenseTier)) {
      throw new ForbiddenException(
        `This installer requires the "${installer.minLicenseTier}" plan or higher (your plan: ${tenantTier}).`,
      );
    }
  }

  async logDownload(args: {
    installerId: string;
    userId?: string | null;
    tenantId?: string | null;
    username?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    bytesServed?: number | null;
    success: boolean;
  }) {
    try {
      await this.logs.save(
        this.logs.create({
          installerId: args.installerId,
          userId: args.userId ?? null,
          tenantId: args.tenantId ?? null,
          username: args.username ?? null,
          ipAddress: args.ipAddress ?? null,
          userAgent: args.userAgent ?? null,
          bytesServed: args.bytesServed != null ? String(args.bytesServed) : null,
          success: args.success,
        }),
      );
    } catch {
      // never let audit failure break a download
    }
  }

  async listLogs(installerId?: string, limit = 100) {
    const qb = this.logs
      .createQueryBuilder('d')
      .orderBy('d."createdAt"', 'DESC')
      .limit(limit);
    if (installerId) qb.where('d."installerId" = :id', { id: installerId });
    return qb.getMany();
  }
}
