import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { Repository, DataSource, IsNull } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { BiometricData } from '../../database/entities/biometric-data.entity';
import { User } from '../../database/entities/user.entity';
import {
  RegisterBiometricDto,
  UpdateStaffCoverageDto,
  FingerIndex,
  VerifyBiometricDto,
} from './dto/biometric.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class BiometricsService {
  private readonly logger = new Logger(BiometricsService.name);

  constructor(
    @InjectRepository(BiometricData)
    private biometricRepository: Repository<BiometricData>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a fingerprint for a user
   */
  async register(dto: RegisterBiometricDto, tenantId?: string): Promise<BiometricData> {
    const tid = requireTenantId(tenantId);
    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: dto.userId, tenantId: tid },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if this finger is already registered
    const existing = await this.biometricRepository.findOne({
      where: {
        userId: dto.userId,
        fingerIndex: dto.fingerIndex,
        deletedAt: IsNull(),
        tenantId: tid,
      },
    });

    if (existing) {
      // Update existing record
      existing.templateData = dto.templateData;
      existing.qualityScore = dto.qualityScore;
      existing.registeredAt = new Date();
      return this.biometricRepository.save(existing);
    }

    // Create new record
    const biometric = this.biometricRepository.create({
      userId: dto.userId,
      fingerIndex: dto.fingerIndex,
      templateData: dto.templateData,
      qualityScore: dto.qualityScore,
      registeredAt: new Date(),
      tenantId: tid,
    });

    return this.biometricRepository.save(biometric);
  }

  /**
   * Check if a user has registered fingerprints
   */
  async checkEnrollment(
    userId: string,
    tenantId?: string,
  ): Promise<{ enrolled: boolean; fingers: FingerIndex[] }> {
    const tid = requireTenantId(tenantId);
    const records = await this.biometricRepository.find({
      where: { userId, deletedAt: IsNull(), tenantId: tid },
      select: ['fingerIndex'],
    });

    return {
      enrolled: records.length > 0,
      fingers: records.map((r) => r.fingerIndex),
    };
  }

  /**
   * Get all registered fingerprints for a user
   */
  async getUserBiometrics(userId: string, tenantId?: string): Promise<BiometricData[]> {
    const tid = requireTenantId(tenantId);
    return this.biometricRepository.find({
      where: { userId, deletedAt: IsNull(), tenantId: tid },
      select: ['id', 'fingerIndex', 'qualityScore', 'registeredAt', 'lastVerifiedAt'],
    });
  }

  /**
   * Verify a fingerprint against stored templates
   * Note: Actual matching is done client-side with SecuGen SDK
   * This endpoint just returns the stored templates for comparison
   */
  async getTemplatesForVerification(
    userId: string,
    tenantId?: string,
  ): Promise<{ templates: { fingerIndex: FingerIndex; templateData: string }[] }> {
    const tid = requireTenantId(tenantId);
    const records = await this.biometricRepository.find({
      where: { userId, deletedAt: IsNull(), tenantId: tid },
      select: ['fingerIndex', 'templateData'],
    });

    if (records.length === 0) {
      throw new NotFoundException('No fingerprints registered for this user');
    }

    return {
      templates: records.map((r) => ({
        fingerIndex: r.fingerIndex,
        templateData: r.templateData,
      })),
    };
  }

  /**
   * Verify a fingerprint captured by the client against stored templates on the server.
   * This prevents raw templates from being sent to the client.
   */
  async verifyProxy(
    dto: VerifyBiometricDto,
    tenantId?: string,
  ): Promise<{ matched: boolean; fingerIndex?: FingerIndex }> {
    const tid = requireTenantId(tenantId);
    const stored = await this.biometricRepository.find({
      where: { userId: dto.userId, deletedAt: IsNull(), tenantId: tid },
      select: ['fingerIndex', 'templateData'],
    });

    if (stored.length === 0) {
      throw new NotFoundException('No fingerprints registered for this user');
    }

    const fingerprintServiceUrl = this.configService.get<string>(
      'FINGERPRINT_SERVICE_URL',
      'http://localhost:8444',
    );
    const fingerprintApiKey = this.configService.get<string>('FINGERPRINT_API_KEY');

    if (!fingerprintApiKey) {
      this.logger.error('FINGERPRINT_API_KEY is not configured in backend');
      throw new InternalServerErrorException('Biometric service configuration error');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${fingerprintServiceUrl}/verify`,
          {
            capturedTemplate: dto.templateData,
            storedTemplates: stored.map((s) => ({
              fingerIndex: s.fingerIndex,
              templateData: s.templateData,
            })),
          },
          {
            headers: {
              'X-API-Key': fingerprintApiKey,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (response.data?.success && response.data?.matched) {
        // Record successful verification
        await this.recordVerification(dto.userId, response.data.fingerIndex, tenantId);
        return {
          matched: true,
          fingerIndex: response.data.fingerIndex,
        };
      }

      return { matched: false };
    } catch (error) {
      this.logger.error(`Biometric verification failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to communicate with biometric service');
    }
  }

  /**
   * Record a successful verification
   */
  async recordVerification(
    userId: string,
    fingerIndex: FingerIndex,
    tenantId?: string,
  ): Promise<void> {
    const tid = requireTenantId(tenantId);
    await this.biometricRepository.update(
      { userId, fingerIndex, deletedAt: IsNull(), tenantId: tid },
      { lastVerifiedAt: new Date() },
    );
  }

  /**
   * Delete a fingerprint record
   */
  async deleteFingerprint(
    userId: string,
    fingerIndex: FingerIndex,
    tenantId?: string,
  ): Promise<void> {
    const tid = requireTenantId(tenantId);
    const result = await this.biometricRepository.softDelete({
      userId,
      fingerIndex,
      tenantId: tid,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Fingerprint record not found');
    }
  }

  /**
   * Check staff insurance coverage
   */
  async checkStaffCoverage(
    userId: string,
    tenantId?: string,
  ): Promise<{
    hasEmployee: boolean;
    coverage: {
      enabled: boolean;
      planType?: string;
      validFrom?: string;
      validUntil?: string;
      coverageLimit?: number;
      usedAmount?: number;
      remainingAmount?: number;
    } | null;
  }> {
    const tid = requireTenantId(tenantId);
    const result = await this.dataSource.query(
      `
      SELECT e.insurance_coverage
      FROM employees e
      WHERE e.user_id = $1 AND e.tenant_id = $2
    `,
      [userId, tid],
    );

    if (result.length === 0) {
      return { hasEmployee: false, coverage: null };
    }

    const coverage = result[0].insurance_coverage || { enabled: false };

    // Calculate remaining amount if applicable
    if (coverage.coverageLimit && coverage.usedAmount !== undefined) {
      coverage.remainingAmount = coverage.coverageLimit - coverage.usedAmount;
    }

    // Check if coverage is expired
    if (coverage.validUntil) {
      const expiryDate = new Date(coverage.validUntil);
      if (expiryDate < new Date()) {
        coverage.enabled = false;
        coverage.expired = true;
      }
    }

    return { hasEmployee: true, coverage };
  }

  /**
   * Update staff insurance coverage
   */
  async updateStaffCoverage(
    userId: string,
    dto: UpdateStaffCoverageDto,
    tenantId?: string,
  ): Promise<void> {
    const tid = requireTenantId(tenantId);
    const result = await this.dataSource.query(
      `
      UPDATE employees
      SET insurance_coverage = $1
      WHERE user_id = $2 AND tenant_id = $3
    `,
      [JSON.stringify(dto), userId, tid],
    );

    if (result[1] === 0) {
      throw new NotFoundException('Employee record not found for this user');
    }
  }
}
