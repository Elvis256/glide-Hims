import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { RefreshToken } from '../../database/entities/refresh-token.entity';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiryToMs(expiry: string): number {
    const match = expiry.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d
    const val = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return val * 1000;
      case 'm': return val * 60 * 1000;
      case 'h': return val * 3600 * 1000;
      case 'd': return val * 86400 * 1000;
      default: return 7 * 86400 * 1000;
    }
  }

  async createRefreshToken(
    userId: string,
    tenantId: string | undefined,
    token: string,
    ipAddress?: string,
    userAgent?: string,
    familyId?: string,
  ): Promise<RefreshToken> {
    const tokenHash = this.hashToken(token);
    const tokenFamily = familyId || crypto.randomUUID();
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date(Date.now() + this.parseExpiryToMs(expiresIn));

    const record = this.refreshTokenRepository.create({
      userId,
      tenantId,
      tokenHash,
      tokenFamily,
      ipAddress,
      userAgent: userAgent?.substring(0, 500),
      expiresAt,
    });

    return this.refreshTokenRepository.save(record);
  }

  async validateRefreshToken(token: string): Promise<RefreshToken | null> {
    const tokenHash = this.hashToken(token);
    const record = await this.refreshTokenRepository.findOne({ where: { tokenHash } });

    if (!record) {
      return null;
    }

    if (record.isRevoked) {
      // Token reuse detected — revoke the entire family
      this.logger.warn(
        `Refresh token reuse detected for family ${record.tokenFamily}, user ${record.userId}. Revoking entire family.`,
      );
      await this.revokeTokenFamily(record.tokenFamily);
      return null;
    }

    if (record.expiresAt < new Date()) {
      return null;
    }

    return record;
  }

  async rotateRefreshToken(
    oldToken: string,
    newToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RefreshToken | null> {
    const oldRecord = await this.validateRefreshToken(oldToken);
    if (!oldRecord) {
      return null;
    }

    const newTokenHash = this.hashToken(newToken);

    // Mark old token as revoked and link to replacement
    oldRecord.isRevoked = true;
    oldRecord.replacedByHash = newTokenHash;
    await this.refreshTokenRepository.save(oldRecord);

    // Create new token record in the same family
    return this.createRefreshToken(
      oldRecord.userId,
      oldRecord.tenantId,
      newToken,
      ipAddress,
      userAgent,
      oldRecord.tokenFamily,
    );
  }

  async revokeToken(tokenHash: string): Promise<void> {
    await this.refreshTokenRepository.update({ tokenHash }, { isRevoked: true });
  }

  async revokeAllUserTokens(userId: string, tenantId?: string): Promise<void> {
    const where: Record<string, any> = { userId, isRevoked: false };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    await this.refreshTokenRepository.update(where, { isRevoked: true });
  }

  async revokeTokenFamily(familyId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { tokenFamily: familyId, isRevoked: false },
      { isRevoked: true },
    );
  }

  async cleanupExpiredTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(cutoff),
    });
    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired refresh tokens`);
    }
  }
}
