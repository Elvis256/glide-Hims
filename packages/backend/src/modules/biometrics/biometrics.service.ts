import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { BiometricData } from '../../database/entities/biometric-data.entity';
import { User } from '../../database/entities/user.entity';
import { RegisterBiometricDto, UpdateStaffCoverageDto, FingerIndex } from './dto/biometric.dto';

@Injectable()
export class BiometricsService {
  constructor(
    @InjectRepository(BiometricData)
    private biometricRepository: Repository<BiometricData>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  /**
   * Register a fingerprint for a user
   */
  async register(dto: RegisterBiometricDto): Promise<BiometricData> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if this finger is already registered
    const existing = await this.biometricRepository.findOne({
      where: { userId: dto.userId, fingerIndex: dto.fingerIndex, deletedAt: IsNull() },
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
    });

    return this.biometricRepository.save(biometric);
  }

  /**
   * Check if a user has registered fingerprints
   */
  async checkEnrollment(userId: string): Promise<{ enrolled: boolean; fingers: FingerIndex[] }> {
    const records = await this.biometricRepository.find({
      where: { userId, deletedAt: IsNull() },
      select: ['fingerIndex'],
    });

    return {
      enrolled: records.length > 0,
      fingers: records.map(r => r.fingerIndex),
    };
  }

  /**
   * Get all registered fingerprints for a user
   */
  async getUserBiometrics(userId: string): Promise<BiometricData[]> {
    return this.biometricRepository.find({
      where: { userId, deletedAt: IsNull() },
      select: ['id', 'fingerIndex', 'qualityScore', 'registeredAt', 'lastVerifiedAt'],
    });
  }

  /**
   * Verify a fingerprint against stored templates
   * Note: Actual matching is done client-side with SecuGen SDK
   * This endpoint just returns the stored templates for comparison
   */
  async getTemplatesForVerification(userId: string): Promise<{ templates: { fingerIndex: FingerIndex; templateData: string }[] }> {
    const records = await this.biometricRepository.find({
      where: { userId, deletedAt: IsNull() },
      select: ['fingerIndex', 'templateData'],
    });

    if (records.length === 0) {
      throw new NotFoundException('No fingerprints registered for this user');
    }

    return {
      templates: records.map(r => ({
        fingerIndex: r.fingerIndex,
        templateData: r.templateData,
      })),
    };
  }

  /**
   * Record a successful verification
   */
  async recordVerification(userId: string, fingerIndex: FingerIndex): Promise<void> {
    await this.biometricRepository.update(
      { userId, fingerIndex, deletedAt: IsNull() },
      { lastVerifiedAt: new Date() },
    );
  }

  /**
   * Delete a fingerprint record
   */
  async deleteFingerprint(userId: string, fingerIndex: FingerIndex): Promise<void> {
    const result = await this.biometricRepository.softDelete({ userId, fingerIndex });
    if (result.affected === 0) {
      throw new NotFoundException('Fingerprint record not found');
    }
  }

  /**
   * Check staff insurance coverage
   */
  async checkStaffCoverage(userId: string): Promise<{
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
    const result = await this.dataSource.query(`
      SELECT e.insurance_coverage
      FROM employees e
      WHERE e.user_id = $1
    `, [userId]);

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
  async updateStaffCoverage(userId: string, dto: UpdateStaffCoverageDto): Promise<void> {
    const result = await this.dataSource.query(`
      UPDATE employees
      SET insurance_coverage = $1
      WHERE user_id = $2
    `, [JSON.stringify(dto), userId]);

    if (result[1] === 0) {
      throw new NotFoundException('Employee record not found for this user');
    }
  }
}
