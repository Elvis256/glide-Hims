import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { SupportAccessGrant, SupportAccessTier } from '../../database/entities/support-access-grant.entity';

@Injectable()
export class SupportAccessService {
  private readonly logger = new Logger(SupportAccessService.name);

  constructor(
    @InjectRepository(SupportAccessGrant)
    private readonly grantRepository: Repository<SupportAccessGrant>,
  ) {}

  async grantAccess(dto: {
    grantedToId: string;
    tenantId: string;
    accessTier: SupportAccessTier;
    durationHours: number;
    reason: string;
    grantedById: string;
  }): Promise<SupportAccessGrant> {
    if (dto.durationHours < 1 || dto.durationHours > 72) {
      throw new BadRequestException('Access duration must be between 1 and 72 hours');
    }
    if (dto.accessTier < 1 || dto.accessTier > 3) {
      throw new BadRequestException('Access tier must be 1, 2, or 3');
    }

    // Revoke any existing active grants for this user+tenant
    await this.revokeAllForUserTenant(dto.grantedToId, dto.tenantId, dto.grantedById);

    const grant = this.grantRepository.create({
      grantedToId: dto.grantedToId,
      tenantId: dto.tenantId,
      accessTier: dto.accessTier,
      expiresAt: new Date(Date.now() + dto.durationHours * 60 * 60 * 1000),
      reason: dto.reason,
      grantedById: dto.grantedById,
    });

    const saved = await this.grantRepository.save(grant);
    this.logger.warn(
      `Support access granted: user=${dto.grantedToId} tenant=${dto.tenantId} tier=${dto.accessTier} hours=${dto.durationHours} by=${dto.grantedById}`,
    );
    return saved;
  }

  async revokeAccess(grantId: string, revokedById: string): Promise<void> {
    const grant = await this.grantRepository.findOne({ where: { id: grantId } });
    if (!grant) throw new NotFoundException('Grant not found');

    grant.revokedAt = new Date();
    grant.revokedById = revokedById;
    await this.grantRepository.save(grant);
    this.logger.warn(`Support access revoked: grant=${grantId} by=${revokedById}`);
  }

  async revokeAllForUserTenant(userId: string, tenantId: string, revokedById: string): Promise<void> {
    const active = await this.grantRepository.find({
      where: {
        grantedToId: userId,
        tenantId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
    for (const grant of active) {
      grant.revokedAt = new Date();
      grant.revokedById = revokedById;
      await this.grantRepository.save(grant);
    }
  }

  async getActiveGrant(userId: string, tenantId: string): Promise<SupportAccessGrant | null> {
    return this.grantRepository.findOne({
      where: {
        grantedToId: userId,
        tenantId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  async getActiveTier(userId: string, tenantId: string): Promise<SupportAccessTier> {
    const grant = await this.getActiveGrant(userId, tenantId);
    return grant ? grant.accessTier : SupportAccessTier.NONE;
  }

  async listGrantsForTenant(tenantId: string): Promise<SupportAccessGrant[]> {
    return this.grantRepository.find({
      where: { tenantId },
      relations: ['grantedTo', 'grantedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async listActiveGrantsForUser(userId: string): Promise<SupportAccessGrant[]> {
    return this.grantRepository.find({
      where: {
        grantedToId: userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: ['tenant'],
      order: { expiresAt: 'ASC' },
    });
  }
}
