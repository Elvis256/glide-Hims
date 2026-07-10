import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { License } from '../../database/entities/license.entity';
import { User } from '../../database/entities/user.entity';
import { Facility } from '../../database/entities/facility.entity';

@Injectable()
export class SubscriptionLimitsService {
  private readonly logger = new Logger(SubscriptionLimitsService.name);

  constructor(
    @InjectRepository(License)
    private licenseRepo: Repository<License>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Facility)
    private facilityRepo: Repository<Facility>,
  ) {}

  private async findActiveLicense(tenantId: string): Promise<License | null> {
    return this.licenseRepo.findOne({
      where: { tenantId, status: 'active' },
      order: { expiresAt: 'DESC' },
    });
  }

  async checkUserLimit(tenantId: string): Promise<void> {
    const license = await this.findActiveLicense(tenantId);
    if (!license) {
      // No license → on-prem or unconfigured; skip enforcement
      return;
    }

    const userCount = await this.userRepo.count({
      where: { tenantId, deletedAt: IsNull() },
    });

    if (userCount >= license.maxUsers) {
      throw new ForbiddenException({
        message: `User limit reached. Your license allows ${license.maxUsers} users and you currently have ${userCount}.`,
        code: 'SUBSCRIPTION_USER_LIMIT',
        current: userCount,
        max: license.maxUsers,
      });
    }
  }

  async checkFacilityLimit(tenantId: string): Promise<void> {
    const license = await this.findActiveLicense(tenantId);
    if (!license) {
      return;
    }

    const facilityCount = await this.facilityRepo.count({
      where: { tenantId, deletedAt: IsNull() },
    });

    if (facilityCount >= license.maxFacilities) {
      throw new ForbiddenException({
        message: `Facility limit reached. Your license allows ${license.maxFacilities} facilities and you currently have ${facilityCount}.`,
        code: 'SUBSCRIPTION_FACILITY_LIMIT',
        current: facilityCount,
        max: license.maxFacilities,
      });
    }
  }

  async getUsageSummary(tenantId: string): Promise<{
    users: { current: number; max: number | null };
    facilities: { current: number; max: number | null };
  }> {
    const license = await this.findActiveLicense(tenantId);

    const userCount = await this.userRepo.count({
      where: { tenantId, deletedAt: IsNull() },
    });

    const facilityCount = await this.facilityRepo.count({
      where: { tenantId, deletedAt: IsNull() },
    });

    return {
      users: { current: userCount, max: license?.maxUsers ?? null },
      facilities: { current: facilityCount, max: license?.maxFacilities ?? null },
    };
  }
}
