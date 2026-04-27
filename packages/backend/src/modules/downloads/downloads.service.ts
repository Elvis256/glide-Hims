import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Installer } from './installer.entity';
import { CreateInstallerDto, UpdateInstallerDto } from './installer.dto';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = process.env.INSTALLERS_DIR || '/var/lib/glide-hims/installers';

@Injectable()
export class DownloadsService {
  constructor(@InjectRepository(Installer) private readonly repo: Repository<Installer>) {}

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
}
