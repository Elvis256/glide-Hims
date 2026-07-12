import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { InsurancePolicy, PolicyStatus } from '../../database/entities/insurance-policy.entity';
import { InsuranceProvider } from '../../database/entities/insurance-provider.entity';
import { CheckCoverageDto, CoverageDetailResponse } from './dto/coverage-check.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class CoverageCheckService {
  private readonly logger = new Logger(CoverageCheckService.name);

  constructor(
    @InjectRepository(InsurancePolicy)
    private policyRepo: Repository<InsurancePolicy>,
    @InjectRepository(InsuranceProvider)
    private providerRepo: Repository<InsuranceProvider>,
  ) {}

  async checkCoverage(
    dto: CheckCoverageDto,
    tenantId?: string,
  ): Promise<{ covered: boolean; coverageDetails: CoverageDetailResponse[] }> {
    const tid = requireTenantId(tenantId);
    const today = new Date();

    // Find patient's active policies
    const where: any = {
      patientId: dto.patientId,
      status: PolicyStatus.ACTIVE,
      effectiveDate: LessThan(today),
      expiryDate: MoreThan(today),
      tenantId: tid,
    };

    const activePolicies = await this.policyRepo.find({
      where,
      relations: ['provider'],
    });

    if (activePolicies.length === 0) {
      return {
        covered: false,
        coverageDetails: dto.items.map((item) => ({
          drugId: item.drugId,
          covered: false,
          copayAmount: 0,
          requiresPreAuth: false,
          rejectionReason: 'No active insurance policy found for patient',
        })),
      };
    }

    // Use the first active policy (primary)
    const policy = activePolicies[0];
    const remainingBalance = Number(policy.annualLimit) - Number(policy.usedAmount);

    const coverageDetails: CoverageDetailResponse[] = dto.items.map((item) => {
      // Check exclusions
      if (policy.exclusions && policy.exclusions.includes(item.drugId)) {
        return {
          drugId: item.drugId,
          covered: false,
          copayAmount: 0,
          requiresPreAuth: false,
          rejectionReason: 'Drug is excluded from coverage under this policy',
        };
      }

      // Check if policy has remaining balance
      if (remainingBalance <= 0) {
        return {
          drugId: item.drugId,
          covered: false,
          copayAmount: 0,
          requiresPreAuth: false,
          rejectionReason: 'Annual coverage limit has been exceeded',
        };
      }

      // Calculate copay
      const copayAmount =
        Number(policy.copayPercentage) > 0
          ? Number(policy.copayPercentage)
          : Number(policy.copayAmount) || 0;

      // High-quantity orders may require pre-authorization
      const requiresPreAuth = item.quantity > 90;

      return {
        drugId: item.drugId,
        covered: true,
        copayAmount,
        requiresPreAuth,
        rejectionReason: undefined,
      };
    });

    const allCovered = coverageDetails.every((d) => d.covered);

    return {
      covered: allCovered,
      coverageDetails,
    };
  }
}
