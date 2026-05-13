import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan, DataSource } from 'typeorm';
import {
  SupportAccessGrant,
  SupportAccessTier,
} from '../../database/entities/support-access-grant.entity';
import { SupportAccessRequest, SupportAccessRequestStatus } from './support-access-request.entity';
import { User } from '../../database/entities/user.entity';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';

@Injectable()
export class SupportAccessService {
  private readonly logger = new Logger(SupportAccessService.name);

  constructor(
    @InjectRepository(SupportAccessGrant)
    private readonly grantRepository: Repository<SupportAccessGrant>,
    @InjectRepository(SupportAccessRequest)
    private readonly requestRepository: Repository<SupportAccessRequest>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: InAppNotificationsService,
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

  async revokeAllForUserTenant(
    userId: string,
    tenantId: string,
    revokedById: string,
  ): Promise<void> {
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

  // ─── Support Access Request Flow ─────────────────────────────────────

  async createRequest(dto: {
    tenantId: string;
    requestedById: string;
    requestedTier: number;
    requestedDurationHours: number;
    reason: string;
  }): Promise<SupportAccessRequest> {
    const existing = await this.requestRepository.findOne({
      where: {
        tenantId: dto.tenantId,
        status: SupportAccessRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new ConflictException(
        'A pending support access request already exists for this tenant',
      );
    }

    const request = this.requestRepository.create(dto);
    const saved = await this.requestRepository.save(request);
    this.logger.log(
      `Support access requested: tenant=${dto.tenantId} tier=${dto.requestedTier} hours=${dto.requestedDurationHours} by=${dto.requestedById}`,
    );

    // Notify all system admins
    const systemAdmins = await this.dataSource
      .getRepository(User)
      .find({ where: { isSystemAdmin: true } });
    if (systemAdmins.length > 0) {
      await this.notificationsService.notifyMany(
        systemAdmins.map((u) => u.id),
        {
          type: InAppNotificationType.SUPPORT_ACCESS_REQUESTED,
          title: 'Support Access Requested',
          message: `A tenant has requested support access (Tier ${dto.requestedTier}, ${dto.requestedDurationHours}h): ${dto.reason}`,
          metadata: { referenceType: 'support_access_request', referenceId: saved.id },
        },
        dto.tenantId,
      );
    }

    return saved;
  }

  async listRequestsForTenant(tenantId: string): Promise<SupportAccessRequest[]> {
    return this.requestRepository.find({
      where: { tenantId },
      relations: ['requestedBy', 'reviewedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async listPendingRequests(): Promise<SupportAccessRequest[]> {
    return this.requestRepository.find({
      where: { status: SupportAccessRequestStatus.PENDING },
      relations: ['requestedBy', 'reviewedBy'],
      order: { createdAt: 'ASC' },
    });
  }

  async listAllRequests(limit = 200): Promise<SupportAccessRequest[]> {
    return this.requestRepository.find({
      relations: ['requestedBy', 'reviewedBy', 'tenant'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async listAllGrants(limit = 200): Promise<SupportAccessGrant[]> {
    return this.grantRepository.find({
      relations: ['grantedTo', 'grantedBy', 'tenant'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async approveRequest(requestId: string, reviewedById: string): Promise<SupportAccessGrant> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['requestedBy'],
    });
    if (!request) {
      throw new NotFoundException('Support access request not found');
    }
    if (request.status !== SupportAccessRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    request.status = SupportAccessRequestStatus.APPROVED;
    request.reviewedById = reviewedById;
    request.reviewedAt = new Date();
    await this.requestRepository.save(request);

    const grant = await this.grantAccess({
      grantedToId: reviewedById,
      tenantId: request.tenantId!,
      accessTier: request.requestedTier as SupportAccessTier,
      durationHours: request.requestedDurationHours,
      reason: `Approved request: ${request.reason}`,
      grantedById: reviewedById,
    });

    this.logger.warn(`Support access request approved: request=${requestId} by=${reviewedById}`);

    // Notify the requester
    await this.notificationsService.create(
      {
        targetUserId: request.requestedById,
        type: InAppNotificationType.SUPPORT_ACCESS_APPROVED,
        title: 'Support Access Approved',
        message: `Your support access request (Tier ${request.requestedTier}, ${request.requestedDurationHours}h) has been approved.`,
        metadata: { referenceType: 'support_access_request', referenceId: requestId },
      },
      request.tenantId,
    );

    return grant;
  }

  async denyRequest(
    requestId: string,
    reviewedById: string,
    reviewNotes?: string,
  ): Promise<SupportAccessRequest> {
    const request = await this.requestRepository.findOne({
      where: { id: requestId },
      relations: ['requestedBy'],
    });
    if (!request) {
      throw new NotFoundException('Support access request not found');
    }
    if (request.status !== SupportAccessRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be denied');
    }

    request.status = SupportAccessRequestStatus.DENIED;
    request.reviewedById = reviewedById;
    request.reviewedAt = new Date();
    request.reviewNotes = reviewNotes ?? null;
    const saved = await this.requestRepository.save(request);

    this.logger.warn(`Support access request denied: request=${requestId} by=${reviewedById}`);

    // Notify the requester
    await this.notificationsService.create(
      {
        targetUserId: request.requestedById,
        type: InAppNotificationType.SUPPORT_ACCESS_DENIED,
        title: 'Support Access Denied',
        message: reviewNotes
          ? `Your support access request was denied: ${reviewNotes}`
          : 'Your support access request was denied.',
        metadata: { referenceType: 'support_access_request', referenceId: requestId },
      },
      request.tenantId,
    );

    return saved;
  }
}
