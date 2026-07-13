import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Session } from '../../database/entities/session.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    private configService: ConfigService,
  ) {}

  async createSession(
    userId: string,
    tenantId: string | undefined,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<Session> {
    const tokenHash = this.hashToken(refreshToken);
    const deviceInfo = this.parseDeviceInfo(userAgent);
    const expiresAt = this.calculateExpiry();

    const session = this.sessionRepository.create({
      userId,
      tenantId: tenantId || undefined,
      tokenHash,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent ? userAgent.substring(0, 500) : undefined,
      deviceInfo,
      isActive: true,
      lastActivityAt: new Date(),
      expiresAt,
    } as Partial<Session>);

    return this.sessionRepository.save(session as Session);
  }

  async validateSession(refreshToken: string): Promise<Session | null> {
    const tokenHash = this.hashToken(refreshToken);

    const session = await this.sessionRepository.findOne({
      where: { tokenHash, isActive: true },
    });

    if (!session) return null;

    if (session.expiresAt < new Date()) {
      session.isActive = false;
      await this.sessionRepository.save(session);
      return null;
    }

    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    return session;
  }

  async getUserSessions(userId: string, tenantId?: string): Promise<Session[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { userId, isActive: true, tenantId: tid };

    return this.sessionRepository.find({
      where,
      order: { lastActivityAt: 'DESC' },
      select: [
        'id',
        'ipAddress',
        'userAgent',
        'deviceInfo',
        'lastActivityAt',
        'createdAt',
        'expiresAt',
      ],
    });
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, userId, isActive: true },
    });

    if (!session) return;

    session.isActive = false;
    session.revokedAt = new Date();
    await this.sessionRepository.save(session);

    this.logger.log(`Session ${sessionId} revoked for user ${userId}`);
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    const where: any = { userId, isActive: true };
    const sessions = await this.sessionRepository.find({ where });

    for (const session of sessions) {
      if (exceptSessionId && session.id === exceptSessionId) continue;
      session.isActive = false;
      session.revokedAt = new Date();
    }

    await this.sessionRepository.save(sessions);
    this.logger.log(
      `All sessions revoked for user ${userId}${exceptSessionId ? ' (except current)' : ''}`,
    );
  }

  async revokeAllTenantSessions(tenantId: string): Promise<void> {
    await this.sessionRepository.update(
      { tenantId, isActive: true },
      { isActive: false, revokedAt: new Date() },
    );

    this.logger.log(`All sessions revoked for tenant ${tenantId}`);
  }

  async cleanupExpiredSessions(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const result = await this.sessionRepository.delete({
      isActive: false,
      updatedAt: LessThan(cutoff),
    });

    const deleted = result.affected || 0;
    if (deleted > 0) {
      this.logger.log(`Cleaned up ${deleted} expired sessions`);
    }
    return deleted;
  }

  async getActiveSessionCount(tenantId: string): Promise<number> {
    return this.sessionRepository.count({
      where: { tenantId, isActive: true },
    });
  }

  async getAllTenantSessions(tenantId: string): Promise<any[]> {
    return this.sessionRepository
      .createQueryBuilder('s')
      .leftJoin('users', 'u', 'u.id = s.userId')
      .select([
        's.id AS id',
        's.userId AS "userId"',
        'u.username AS username',
        'u.full_name AS "fullName"',
        's.ipAddress AS "ipAddress"',
        's.userAgent AS "userAgent"',
        's.deviceInfo AS "deviceInfo"',
        's.isActive AS "isActive"',
        's.lastActivityAt AS "lastActivityAt"',
        's.expiresAt AS "expiresAt"',
        's.createdAt AS "createdAt"',
      ])
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.isActive = true')
      .orderBy('s.lastActivityAt', 'DESC')
      .getRawMany();
  }

  async adminRevokeSession(sessionId: string, tenantId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId, tenantId, isActive: true },
    });
    if (!session) return;
    session.isActive = false;
    session.revokedAt = new Date();
    await this.sessionRepository.save(session);
    this.logger.log(`Admin revoked session ${sessionId} in tenant ${tenantId}`);
  }

  async adminRevokeUserSessions(userId: string, tenantId: string): Promise<void> {
    await this.sessionRepository.update(
      { userId, tenantId, isActive: true },
      { isActive: false, revokedAt: new Date() },
    );
    this.logger.log(`Admin revoked all sessions for user ${userId} in tenant ${tenantId}`);
  }

  /**
   * Update the token hash on a session after token rotation (refresh).
   * @param manager Pass the surrounding transaction's EntityManager when called
   * inside a transaction (never check out a pooled connection while holding locks).
   */
  async updateSessionToken(
    oldRefreshToken: string,
    newRefreshToken: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Session) : this.sessionRepository;
    const oldHash = this.hashToken(oldRefreshToken);
    const session = await repo.findOne({
      where: { tokenHash: oldHash, isActive: true },
    });
    if (session) {
      session.tokenHash = this.hashToken(newRefreshToken);
      session.lastActivityAt = new Date();
      await repo.save(session);
    }
  }

  /**
   * Revoke session by refresh token (used during logout).
   */
  async revokeSessionByToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepository.findOne({
      where: { tokenHash, isActive: true },
    });
    if (session) {
      session.isActive = false;
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseDeviceInfo(userAgent: string | undefined): string {
    if (!userAgent) return 'Unknown';
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Chrome')) return 'Chrome Desktop';
    if (userAgent.includes('Firefox')) return 'Firefox Desktop';
    if (userAgent.includes('Safari')) return 'Safari Desktop';
    return 'Desktop';
  }

  private calculateExpiry(): Date {
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 7);
      return expiry;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = new Date();

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 3600 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 86400 * 1000);
      default:
        return new Date(now.getTime() + 7 * 86400 * 1000);
    }
  }
}
